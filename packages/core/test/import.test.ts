import { describe, expect, it } from 'vitest'
import {
  parseFolderPath,
  parseImportedDate,
  parseTags,
  readBookmarkExport,
  requiredFolderPaths,
} from '../src/import.ts'

// The shape raindrop.io documents for its own import and export.
const RAINDROP = [
  'folder,url,title,note,tags,created',
  '"Reading",https://example.com/a,First,"A note","search, app",1629980125',
  '"Reading/Later",https://example.com/b,Second,,,2021-08-26T12:15:25Z',
].join('\n')

describe('readBookmarkExport', () => {
  it('reads a raindrop export', () => {
    const reading = readBookmarkExport(RAINDROP)
    expect(reading.scraps).toHaveLength(2)

    const first = reading.scraps[0]!
    expect(first.url).toBe('https://example.com/a')
    expect(first.title).toBe('First')
    expect(first.note).toBe('A note')
    expect(first.tags).toEqual(['search', 'app'])
    expect(first.folderPath).toEqual(['Reading'])
    expect(first.createdAt).toBe('2021-08-26T12:15:25.000Z')

    expect(reading.scraps[1]!.folderPath).toEqual(['Reading', 'Later'])
  })

  it('locates columns by heading, not by position', () => {
    const reordered = ['Title,Tags,URL', 'Only,,https://example.com/x'].join('\n')
    const reading = readBookmarkExport(reordered)
    expect(reading.scraps[0]).toMatchObject({ title: 'Only', url: 'https://example.com/x' })
  })

  it('accepts the headings other exporters use', () => {
    const instapaper = ['URL,Title,Selection,Folder', 'https://example.com/y,T,Some text,Unread'].join('\n')
    const reading = readBookmarkExport(instapaper)
    expect(reading.scraps[0]).toMatchObject({ title: 'T', folderPath: ['Unread'] })
  })

  it('ignores columns it does not recognise', () => {
    const extra = ['url,highlights,id', 'https://example.com/z,lots of text,42'].join('\n')
    expect(readBookmarkExport(extra).scraps).toHaveLength(1)
  })

  it('counts rows with no usable address instead of failing the file', () => {
    const messy = [
      'url,title',
      'https://example.com/ok,Fine',
      ',Missing',
      'not a url,Broken',
      'javascript:alert(1),Hostile',
    ].join('\n')
    const reading = readBookmarkExport(messy)
    expect(reading.scraps).toHaveLength(1)
    expect(reading.unusableRows).toBe(3)
  })

  it('keeps the first occurrence when a page appears twice', () => {
    const repeated = [
      'folder,url',
      'Kept,https://example.com/same?utm_source=x',
      'Dropped,https://www.example.com/same/',
    ].join('\n')
    const reading = readBookmarkExport(repeated)
    expect(reading.scraps).toHaveLength(1)
    expect(reading.scraps[0]!.folderPath).toEqual(['Kept'])
    expect(reading.duplicateRows).toBe(1)
  })

  it('reports a file with no address column rather than importing nothing silently', () => {
    const reading = readBookmarkExport('title,note\nA,B')
    expect(reading.scraps).toEqual([])
    expect(reading.unusableRows).toBe(1)
    expect(reading.columns).toEqual(['title', 'note'])
  })

  it('returns nothing for an empty file', () => {
    expect(readBookmarkExport('')).toMatchObject({ scraps: [], columns: [] })
  })

  it('reads a favourite flag', () => {
    const reading = readBookmarkExport('url,favorite\nhttps://example.com/f,true')
    expect(reading.scraps[0]!.isImportant).toBe(true)
  })
})

describe('parseImportedDate', () => {
  it('reads Unix seconds', () => {
    expect(parseImportedDate('1629980125')).toBe('2021-08-26T12:15:25.000Z')
  })

  it('reads Unix milliseconds', () => {
    expect(parseImportedDate('1629980125000')).toBe('2021-08-26T12:15:25.000Z')
  })

  it('reads an ISO date', () => {
    expect(parseImportedDate('2021-08-26T12:15:25Z')).toBe('2021-08-26T12:15:25.000Z')
  })

  it('gives up on something that is not a date', () => {
    expect(parseImportedDate('whenever')).toBeNull()
    expect(parseImportedDate(null)).toBeNull()
  })
})

describe('parseFolderPath', () => {
  it('splits nesting on slashes', () => {
    expect(parseFolderPath('a/b/c')).toEqual(['a', 'b', 'c'])
  })

  it('drops empty segments and surrounding space', () => {
    expect(parseFolderPath('/ a // b /')).toEqual(['a', 'b'])
  })

  it('treats no folder as the inbox', () => {
    expect(parseFolderPath(null)).toEqual([])
    expect(parseFolderPath('   ')).toEqual([])
  })
})

describe('parseTags', () => {
  it('splits on commas and semicolons', () => {
    expect(parseTags('one, two; three')).toEqual(['one', 'two', 'three'])
  })

  it('keeps the first spelling of a repeated tag', () => {
    expect(parseTags('News, news, NEWS')).toEqual(['News'])
  })

  it('returns nothing for an empty cell', () => {
    expect(parseTags(null)).toEqual([])
  })
})

describe('requiredFolderPaths', () => {
  it('lists every ancestor, parents before children', () => {
    const reading = readBookmarkExport(RAINDROP)
    expect(requiredFolderPaths(reading.scraps)).toEqual([['Reading'], ['Reading', 'Later']])
  })

  it('lists each path once', () => {
    const repeated = [
      'folder,url',
      'a/b,https://example.com/1',
      'a/b,https://example.com/2',
      'a,https://example.com/3',
    ].join('\n')
    expect(requiredFolderPaths(readBookmarkExport(repeated).scraps)).toEqual([['a'], ['a', 'b']])
  })
})
