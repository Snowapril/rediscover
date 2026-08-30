// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseMetadata } from '../src/extract.ts'

const PAGE_URL = 'https://blog.example.com/posts/why-we-forget'

function page(body: string): Document {
  return new DOMParser().parseFromString(body, 'text/html')
}

describe('parseMetadata', () => {
  it('prefers Open Graph over the title element', () => {
    const doc = page(`
      <html><head>
        <title>Why We Forget — Example Blog</title>
        <meta property="og:title" content="Why We Forget">
      </head><body></body></html>`)
    expect(parseMetadata(doc, PAGE_URL).title).toBe('Why We Forget')
  })

  it('falls back through Twitter cards to the title element', () => {
    const withTwitter = page(`<html><head><title>Ignored</title>
      <meta name="twitter:title" content="From Twitter"></head><body></body></html>`)
    expect(parseMetadata(withTwitter, PAGE_URL).title).toBe('From Twitter')

    const plain = page(`<html><head><title>  Just   the  title </title></head><body></body></html>`)
    expect(parseMetadata(plain, PAGE_URL).title).toBe('Just the title')
  })

  it('reads JSON-LD, including objects nested in a @graph', () => {
    const doc = page(`
      <html><head><script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[
          {"@type":"Article","headline":"Graph headline","datePublished":"2026-03-04T09:00:00Z",
           "author":{"@type":"Person","name":"Ada Lovelace"}}]}
      </script></head><body></body></html>`)
    const result = parseMetadata(doc, PAGE_URL)
    expect(result.title).toBe('Graph headline')
    expect(result.author).toBe('Ada Lovelace')
    expect(result.publishedAt).toBe('2026-03-04T09:00:00.000Z')
  })

  it('ignores a JSON-LD block that is not valid JSON', () => {
    const doc = page(`
      <html><head><title>Survived</title>
        <script type="application/ld+json">{ not json </script>
      </head><body></body></html>`)
    expect(parseMetadata(doc, PAGE_URL).title).toBe('Survived')
  })

  it('resolves relative images and icons against the page address', () => {
    const doc = page(`
      <html><head>
        <meta property="og:image" content="/media/cover.png">
        <link rel="icon" href="../favicon.png">
      </head><body></body></html>`)
    const result = parseMetadata(doc, PAGE_URL)
    expect(result.thumbnailUrl).toBe('https://blog.example.com/media/cover.png')
    expect(result.faviconUrl).toBe('https://blog.example.com/favicon.png')
  })

  it('assumes the conventional icon location when the page declares none', () => {
    const doc = page('<html><head></head><body></body></html>')
    expect(parseMetadata(doc, PAGE_URL).faviconUrl).toBe('https://blog.example.com/favicon.ico')
  })

  it('falls back to the host name for the site', () => {
    const doc = page('<html><head></head><body></body></html>')
    expect(parseMetadata(doc, 'https://www.example.com/a').siteName).toBe('example.com')
  })

  it('uses the opening body text as an excerpt when no description is given', () => {
    const doc = page(`
      <html><head></head><body><article>
        <script>ignore me</script>
        <nav>Home About</nav>
        <p>Memory fades faster than we expect.</p>
      </article></body></html>`)
    const excerpt = parseMetadata(doc, PAGE_URL).excerpt
    expect(excerpt).toBe('Memory fades faster than we expect.')
    expect(excerpt).not.toContain('ignore me')
    expect(excerpt).not.toContain('Home About')
  })

  it('estimates reading time from the article text', () => {
    const words = Array.from({ length: 660 }, () => 'word').join(' ')
    const doc = page(`<html><head></head><body><article><p>${words}</p></article></body></html>`)
    expect(parseMetadata(doc, PAGE_URL).readingTimeMin).toBe(3)
  })

  it('rounds a very short page up to a minute rather than to nothing', () => {
    const doc = page('<html><head></head><body><article><p>One line.</p></article></body></html>')
    expect(parseMetadata(doc, PAGE_URL).readingTimeMin).toBe(1)
  })

  it('reports no reading time for a page with no text at all', () => {
    const doc = page('<html><head><title>t</title></head><body></body></html>')
    expect(parseMetadata(doc, PAGE_URL).readingTimeMin).toBeNull()
  })

  it('classifies by Open Graph type, then by file extension', () => {
    const video = page('<html><head><meta property="og:type" content="video.other"></head><body></body></html>')
    expect(parseMetadata(video, PAGE_URL).mediaType).toBe('video')

    const bare = page('<html><head></head><body></body></html>')
    expect(parseMetadata(bare, 'https://example.com/paper.pdf').mediaType).toBe('pdf')
    expect(parseMetadata(bare, 'https://example.com/shot.JPG').mediaType).toBe('image')
    expect(parseMetadata(bare, 'https://example.com/page').mediaType).toBe('link')
  })

  it('treats a page with an article element as an article', () => {
    const doc = page('<html><head></head><body><article><p>Body.</p></article></body></html>')
    expect(parseMetadata(doc, PAGE_URL).mediaType).toBe('article')
  })

  it('reads the document language', () => {
    const doc = page('<html lang="ko"><head></head><body></body></html>')
    expect(parseMetadata(doc, PAGE_URL).lang).toBe('ko')
  })

  it('reports null rather than an empty string for absent properties', () => {
    const result = parseMetadata(page('<html><head></head><body></body></html>'), PAGE_URL)
    expect(result.title).toBeNull()
    expect(result.author).toBeNull()
    expect(result.publishedAt).toBeNull()
    expect(result.thumbnailUrl).toBeNull()
  })

  it('drops a date it cannot make sense of', () => {
    const doc = page('<html><head><meta property="article:published_time" content="soon"></head><body></body></html>')
    expect(parseMetadata(doc, PAGE_URL).publishedAt).toBeNull()
  })

  it('survives a thumbnail URL that cannot be resolved', () => {
    const doc = page('<html><head><meta property="og:image" content="http://["></head><body></body></html>')
    expect(parseMetadata(doc, PAGE_URL).thumbnailUrl).toBeNull()
  })

  it('resolves a sibling-relative image against the containing directory', () => {
    const doc = page('<html><head><meta property="og:image" content="cover.png"></head><body></body></html>')
    expect(parseMetadata(doc, PAGE_URL).thumbnailUrl).toBe(
      'https://blog.example.com/posts/cover.png',
    )
  })
})

describe('falling back to a picture in the page', () => {
  it('uses an image from the article when the page declares no cover', () => {
    const doc = page(`
      <html><head></head><body><article>
        <p>Text</p><img src="/media/diagram.png" width="640" height="400">
      </article></body></html>`)
    expect(parseMetadata(doc, PAGE_URL).thumbnailUrl).toBe(
      'https://blog.example.com/media/diagram.png',
    )
  })

  it('prefers what the page declares over what it merely contains', () => {
    const doc = page(`
      <html><head><meta property="og:image" content="/declared.png"></head>
      <body><article><img src="/inside.png" width="640"></article></body></html>`)
    expect(parseMetadata(doc, PAGE_URL).thumbnailUrl).toBe('https://blog.example.com/declared.png')
  })

  it('skips the furniture', () => {
    for (const markup of [
      '<img src="/site-logo.png" width="600">',
      '<img src="/x.png" alt="Author avatar" width="600">',
      '<img src="/x.png" class="emoji" width="600">',
      '<img src="/tracking-pixel.gif" width="600">',
    ]) {
      const doc = page(`<html><head></head><body><article>${markup}</article></body></html>`)
      expect(parseMetadata(doc, PAGE_URL).thumbnailUrl, markup).toBeNull()
    }
  })

  it('skips an image that says it is too small to be the subject', () => {
    const doc = page(
      '<html><head></head><body><article><img src="/thumb.png" width="48" height="48"></article></body></html>',
    )
    expect(parseMetadata(doc, PAGE_URL).thumbnailUrl).toBeNull()
  })

  it('takes an image that declares no size, since most do not', () => {
    const doc = page('<html><head></head><body><article><img src="/photo.jpg"></article></body></html>')
    expect(parseMetadata(doc, PAGE_URL).thumbnailUrl).toBe('https://blog.example.com/photo.jpg')
  })

  it('ignores an inline data image', () => {
    const doc = page(
      '<html><head></head><body><article><img src="data:image/gif;base64,R0lGOD"></article></body></html>',
    )
    expect(parseMetadata(doc, PAGE_URL).thumbnailUrl).toBeNull()
  })

  it('looks only inside the article, not the whole page', () => {
    const doc = page(`
      <html><head></head><body>
        <header><img src="/banner.png" width="900"></header>
        <article><p>No pictures here.</p></article>
      </body></html>`)
    expect(parseMetadata(doc, PAGE_URL).thumbnailUrl).toBeNull()
  })
})
