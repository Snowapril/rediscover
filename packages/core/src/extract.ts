import type { ExtractedMetadata, MediaType } from './types.ts'

/*
 * @brief Words a minute assumed when estimating how long a page takes to read.
 */
const READING_WORDS_PER_MINUTE = 220

/*
 * @brief Elements whose text is furniture rather than content.
 */
const NON_CONTENT = 'script, style, noscript, nav, header, footer, aside, form, iframe, svg'

function clean(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const collapsed = value.replace(/\s+/g, ' ').trim()
  return collapsed === '' ? null : collapsed
}

/*
 * @brief First non-empty content of the named meta tags, in preference order.
 * @param doc The page.
 * @param names Values of the tags' name, property, or itemprop attribute.
 * @return The winning content, or null if none carried any.
 */
function metaContent(doc: Document, names: readonly string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/"/g, '\\"')
    const element = doc.querySelector(
      `meta[property="${escaped}"], meta[name="${escaped}"], meta[itemprop="${escaped}"]`,
    )
    const value = clean(element?.getAttribute('content'))
    if (value !== null) return value
  }
  return null
}

/*
 * @brief Turn a possibly relative URL into an absolute one.
 * @param value The URL as written in the page.
 * @param baseUrl The address the page was served from.
 * @return An absolute URL, or null if it cannot be resolved.
 */
function absolute(value: string | null, baseUrl: string): string | null {
  if (value === null) return null
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

/*
 * @brief Every JSON-LD object the page declares, flattened.
 * @details Pages commonly wrap their objects in a @graph, and a malformed block
 *   is ignored rather than failing the whole extraction.
 * @param doc The page.
 * @return The objects, in document order.
 */
function jsonLdObjects(doc: Document): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = []

  const push = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) push(entry)
      return
    }
    if (typeof value !== 'object' || value === null) return
    const record = value as Record<string, unknown>
    objects.push(record)
    if ('@graph' in record) push(record['@graph'])
  }

  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      push(JSON.parse(script.textContent ?? ''))
    } catch {
      continue
    }
  }
  return objects
}

function jsonLdString(objects: readonly Record<string, unknown>[], key: string): string | null {
  for (const object of objects) {
    const value = object[key]
    if (typeof value === 'string') {
      const cleaned = clean(value)
      if (cleaned !== null) return cleaned
    }
  }
  return null
}

/*
 * @brief A name out of a JSON-LD field that may be a string, an object, or a list.
 * @param objects The page's JSON-LD objects.
 * @param key The field to read, such as author or publisher.
 * @return The name, or null.
 */
function jsonLdName(objects: readonly Record<string, unknown>[], key: string): string | null {
  for (const object of objects) {
    const value = object[key]
    const candidates = Array.isArray(value) ? value : [value]
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const cleaned = clean(candidate)
        if (cleaned !== null) return cleaned
      }
      if (typeof candidate === 'object' && candidate !== null) {
        const name = (candidate as Record<string, unknown>)['name']
        if (typeof name === 'string') {
          const cleaned = clean(name)
          if (cleaned !== null) return cleaned
        }
      }
    }
  }
  return null
}

/*
 * @brief An ISO timestamp from a date string a page supplied.
 * @param value The date as written.
 * @return The timestamp, or null if it is unparseable.
 */
function isoDate(value: string | null): string | null {
  if (value === null) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

/*
 * @brief The page's readable body text.
 * @details Prefers the element a page marks as its article, falling back to the
 *   whole body, and drops navigation and script furniture either way.
 * @param doc The page.
 * @return The text, collapsed to single spaces.
 */
function readableText(doc: Document): string {
  const root = doc.querySelector('article') ?? doc.querySelector('main') ?? doc.body
  if (root === null) return ''

  const copy = root.cloneNode(true) as Element
  for (const junk of Array.from(copy.querySelectorAll(NON_CONTENT))) junk.remove()
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  if (text === '') return 0
  return text.split(' ').length
}

/*
 * @brief What kind of thing the link points at.
 * @param doc The page.
 * @param url The address it was served from.
 * @return The classification.
 */
function classify(doc: Document, url: string): MediaType {
  const ogType = metaContent(doc, ['og:type'])
  if (ogType !== null) {
    if (ogType.startsWith('video')) return 'video'
    if (ogType.startsWith('article')) return 'article'
  }

  let pathname = ''
  try {
    pathname = new URL(url).pathname.toLowerCase()
  } catch {
    pathname = ''
  }
  if (pathname.endsWith('.pdf')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(pathname)) return 'image'

  return doc.querySelector('article') !== null ? 'article' : 'link'
}

/*
 * @brief Read a page's standardized properties out of its markup.
 * @details Works on any DOM, so the browser extension can run it against the
 *   live page and the server can run it against fetched HTML with identical
 *   results. Each property falls back through the conventions in order of how
 *   deliberately a publisher sets them: Open Graph, then Twitter cards, then
 *   JSON-LD, then plain HTML. A property nothing supplies comes back null,
 *   which tells the merge rules the page genuinely lacks it.
 * @param doc The parsed page.
 * @param url The address the page was served from, used to resolve relative
 *   links and to classify the target.
 * @return The properties, ready to merge into an item.
 */
export function parseMetadata(doc: Document, url: string): ExtractedMetadata {
  const jsonLd = jsonLdObjects(doc)
  const text = readableText(doc)
  const words = countWords(text)

  const title =
    metaContent(doc, ['og:title', 'twitter:title']) ??
    jsonLdString(jsonLd, 'headline') ??
    jsonLdString(jsonLd, 'name') ??
    clean(doc.querySelector('title')?.textContent)

  const excerpt =
    metaContent(doc, ['og:description', 'twitter:description', 'description']) ??
    jsonLdString(jsonLd, 'description') ??
    clean(text.slice(0, 400)) ??
    null

  const thumbnail =
    metaContent(doc, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']) ??
    jsonLdName(jsonLd, 'image') ??
    clean(doc.querySelector('link[rel="image_src"]')?.getAttribute('href'))

  const iconHref =
    clean(doc.querySelector('link[rel="icon"]')?.getAttribute('href')) ??
    clean(doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href')) ??
    clean(doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')) ??
    '/favicon.ico'

  const published =
    isoDate(metaContent(doc, ['article:published_time', 'og:published_time', 'date'])) ??
    isoDate(jsonLdString(jsonLd, 'datePublished')) ??
    isoDate(clean(doc.querySelector('time[datetime]')?.getAttribute('datetime')))

  let siteName = metaContent(doc, ['og:site_name']) ?? jsonLdName(jsonLd, 'publisher')
  if (siteName === null) {
    try {
      siteName = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      siteName = null
    }
  }

  return {
    title,
    excerpt,
    thumbnailUrl: absolute(thumbnail, url),
    faviconUrl: absolute(iconHref, url),
    siteName,
    author: metaContent(doc, ['author', 'article:author']) ?? jsonLdName(jsonLd, 'author'),
    publishedAt: published,
    readingTimeMin: words === 0 ? null : Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE)),
    lang: clean(doc.documentElement.getAttribute('lang')),
    mediaType: classify(doc, url),
  }
}
