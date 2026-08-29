import { detectDelimiter, parseDelimited } from './csv.ts'
import { canonicalizeUrl, extractDomain } from './url.ts'

/*
 * @brief One scrap read out of an export file, ready to be stored.
 */
export interface ImportedScrap {
  url: string
  canonicalUrl: string
  domain: string
  /*
   * @brief The folders it was filed under, outermost first; empty for the inbox.
   */
  folderPath: string[]
  title: string | null
  excerpt: string | null
  note: string | null
  thumbnailUrl: string | null
  tags: string[]
  /*
   * @brief When it was originally saved, as an ISO timestamp.
   */
  createdAt: string | null
  isImportant: boolean
}

export interface ImportReading {
  scraps: ImportedScrap[]
  /*
   * @brief Rows that carried no usable web address.
   */
  unusableRows: number
  /*
   * @brief Rows dropped because the same page appeared earlier in the file.
   */
  duplicateRows: number
  /*
   * @brief Column headings the file turned out to have, in order.
   */
  columns: string[]
}

/*
 * @brief Headings that mean the same thing across export formats.
 * @details Raindrop documents url, folder, title, note, tags and created, but
 *   its own export and other apps' add more; matching on a set of names rather
 *   than a fixed layout means one importer covers all of them, and an unknown
 *   column is ignored instead of shifting everything after it.
 */
const HEADINGS: Record<keyof typeof EMPTY_FIELDS, readonly string[]> = {
  url: ['url', 'link', 'href', 'address'],
  folder: ['folder', 'folders', 'collection', 'collections'],
  title: ['title', 'name'],
  excerpt: ['excerpt', 'description', 'summary'],
  note: ['note', 'notes', 'comment', 'comments'],
  thumbnail: ['cover', 'image', 'thumbnail'],
  tags: ['tags', 'labels', 'keywords'],
  created: ['created', 'created_at', 'date', 'saved', 'time', 'timestamp'],
  important: ['favorite', 'favourite', 'starred', 'important'],
}

const EMPTY_FIELDS = {
  url: -1,
  folder: -1,
  title: -1,
  excerpt: -1,
  note: -1,
  thumbnail: -1,
  tags: -1,
  created: -1,
  important: -1,
}

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function locateColumns(header: readonly string[]): typeof EMPTY_FIELDS {
  const found = { ...EMPTY_FIELDS }
  const normalized = header.map(normalizeHeading)

  for (const [field, names] of Object.entries(HEADINGS) as [
    keyof typeof EMPTY_FIELDS,
    readonly string[],
  ][]) {
    for (const name of names) {
      const index = normalized.indexOf(name)
      if (index !== -1) {
        found[field] = index
        break
      }
    }
  }
  return found
}

function cell(row: readonly string[], index: number): string | null {
  if (index === -1) return null
  const value = row[index]
  if (value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/*
 * @brief Read an export's timestamp, whatever shape it came in.
 * @details Raindrop accepts a Unix timestamp or an ISO 8601 date, and other
 *   apps emit seconds or milliseconds without saying which. A ten digit number
 *   is seconds; anything longer is milliseconds.
 * @param value The cell as written.
 * @return An ISO timestamp, or null if it cannot be read as a date.
 */
export function parseImportedDate(value: string | null): string | null {
  if (value === null) return null

  if (/^\d+$/.test(value)) {
    const digits = Number(value)
    const milliseconds = value.length <= 10 ? digits * 1000 : digits
    const fromEpoch = new Date(milliseconds)
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/*
 * @brief Split a folder cell into the path it describes.
 * @details Raindrop writes nesting as `a/b/c`. Empty segments are dropped so a
 *   leading or doubled slash does not produce a folder with no name.
 * @param value The cell as written.
 * @return The folder names, outermost first.
 */
export function parseFolderPath(value: string | null): string[] {
  if (value === null) return []
  return value
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
}

/*
 * @brief Split a tag cell into tags.
 * @param value The cell as written.
 * @return The tags, deduplicated and in the order they appeared.
 */
export function parseTags(value: string | null): string[] {
  if (value === null) return []
  const tags: string[] = []
  const seen = new Set<string>()
  for (const part of value.split(/[,;]/)) {
    const tag = part.trim()
    if (tag === '' || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    tags.push(tag)
  }
  return tags
}

function isTruthy(value: string | null): boolean {
  if (value === null) return false
  return ['true', 'yes', '1', 'y'].includes(value.toLowerCase())
}

/*
 * @brief Read an exported bookmark file into scraps ready to store.
 * @details Columns are located by heading rather than by position, so a file
 *   with extra or reordered columns still imports. A row whose address is not a
 *   usable web URL is counted and skipped rather than failing the file, and a
 *   page that appears twice is kept once — the first occurrence, which carries
 *   the folder the user filed it in.
 * @param text The whole export file.
 * @return The scraps found, with counts of what was skipped.
 */
export function readBookmarkExport(text: string): ImportReading {
  const rows = parseDelimited(text, detectDelimiter(text))
  const header = rows[0]
  if (header === undefined) {
    return { scraps: [], unusableRows: 0, duplicateRows: 0, columns: [] }
  }

  const columns = locateColumns(header)
  if (columns.url === -1) {
    return { scraps: [], unusableRows: rows.length - 1, duplicateRows: 0, columns: header }
  }

  const scraps: ImportedScrap[] = []
  const seen = new Set<string>()
  let unusableRows = 0
  let duplicateRows = 0

  for (const row of rows.slice(1)) {
    const rawUrl = cell(row, columns.url)
    const canonicalUrl = rawUrl === null ? null : canonicalizeUrl(rawUrl)
    const domain = canonicalUrl === null ? null : extractDomain(canonicalUrl)

    if (rawUrl === null || canonicalUrl === null || domain === null) {
      unusableRows++
      continue
    }
    if (seen.has(canonicalUrl)) {
      duplicateRows++
      continue
    }
    seen.add(canonicalUrl)

    scraps.push({
      url: rawUrl,
      canonicalUrl,
      domain,
      folderPath: parseFolderPath(cell(row, columns.folder)),
      title: cell(row, columns.title),
      excerpt: cell(row, columns.excerpt),
      note: cell(row, columns.note),
      thumbnailUrl: cell(row, columns.thumbnail),
      tags: parseTags(cell(row, columns.tags)),
      createdAt: parseImportedDate(cell(row, columns.created)),
      isImportant: isTruthy(cell(row, columns.important)),
    })
  }

  return { scraps, unusableRows, duplicateRows, columns: header }
}

/*
 * @brief Every folder path an import will need, parents before children.
 * @details Returned as `/`-joined paths so a caller can create them in order
 *   and be certain a parent exists by the time its child is reached.
 * @param scraps The scraps about to be imported.
 * @return The distinct paths, shallowest first.
 */
export function requiredFolderPaths(scraps: readonly ImportedScrap[]): string[][] {
  const paths = new Map<string, string[]>()

  for (const scrap of scraps) {
    for (let depth = 1; depth <= scrap.folderPath.length; depth++) {
      const prefix = scrap.folderPath.slice(0, depth)
      paths.set(prefix.join('/'), prefix)
    }
  }

  return [...paths.values()].sort((a, b) => a.length - b.length)
}
