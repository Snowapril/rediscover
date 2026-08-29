/*
 * @brief Split delimiter-separated text into rows of fields.
 * @details Follows RFC 4180: a field may be wrapped in double quotes, in which
 *   case it may itself contain the delimiter, line breaks, and doubled quotes
 *   standing for one. A byte order mark is dropped, and CRLF, LF and lone CR all
 *   end a line, because export files arrive from every operating system.
 *   Nothing is interpreted here — every field comes back as text.
 * @param text The whole file.
 * @param delimiter The field separator.
 * @return One array of fields per row, with trailing blank lines removed.
 */
export function parseDelimited(text: string, delimiter = ','): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let started = false

  const endField = (): void => {
    row.push(field)
    field = ''
    started = false
  }

  const endRow = (): void => {
    endField()
    rows.push(row)
    row = []
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index] as string

    if (quoted) {
      if (char !== '"') {
        field += char
        continue
      }
      if (source[index + 1] === '"') {
        field += '"'
        index++
        continue
      }
      quoted = false
      continue
    }

    if (char === '"' && !started) {
      quoted = true
      started = true
      continue
    }

    if (char === delimiter) {
      endField()
      continue
    }

    if (char === '\r') {
      if (source[index + 1] === '\n') index++
      endRow()
      continue
    }

    if (char === '\n') {
      endRow()
      continue
    }

    field += char
    started = true
  }

  if (field !== '' || row.length > 0) endRow()

  // A file ending in a newline produces one empty trailing row.
  while (rows.length > 0) {
    const last = rows[rows.length - 1] as string[]
    if (last.length === 1 && last[0] === '') rows.pop()
    else break
  }

  return rows
}

/*
 * @brief Guess which character separates the fields.
 * @details Exports are usually comma separated, but a locale that uses the
 *   comma as a decimal mark often produces semicolons instead. The winner is
 *   whichever appears most on the header line.
 * @param text The whole file.
 * @return The delimiter to parse with.
 */
export function detectDelimiter(text: string): string {
  const header = text.slice(0, text.search(/\r?\n/) === -1 ? text.length : text.search(/\r?\n/))
  const counts = [',', ';', '\t'].map((candidate) => ({
    candidate,
    count: header.split(candidate).length - 1,
  }))
  counts.sort((a, b) => b.count - a.count)
  const best = counts[0]
  return best === undefined || best.count === 0 ? ',' : best.candidate
}
