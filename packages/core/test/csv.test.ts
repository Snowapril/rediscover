import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseDelimited } from '../src/csv.ts'

describe('parseDelimited', () => {
  it('splits a plain file into rows and fields', () => {
    expect(parseDelimited('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps a delimiter that sits inside quotes', () => {
    expect(parseDelimited('url,tags\nhttp://x,"one, two"')).toEqual([
      ['url', 'tags'],
      ['http://x', 'one, two'],
    ])
  })

  it('reads a doubled quote as one quote', () => {
    expect(parseDelimited('title\n"He said ""hi"""')).toEqual([['title'], ['He said "hi"']])
  })

  it('keeps a line break that sits inside quotes', () => {
    expect(parseDelimited('note\n"line one\nline two"')).toEqual([['note'], ['line one\nline two']])
  })

  it('accepts CRLF, LF and a lone CR as line endings', () => {
    expect(parseDelimited('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseDelimited('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('drops a byte order mark', () => {
    expect(parseDelimited('﻿url\nhttp://x')).toEqual([['url'], ['http://x']])
  })

  it('keeps empty fields in place', () => {
    expect(parseDelimited('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ])
  })

  it('ignores a trailing newline rather than inventing a row', () => {
    expect(parseDelimited('a\n1\n')).toEqual([['a'], ['1']])
  })

  it('treats a quote in the middle of a bare field as text', () => {
    expect(parseDelimited('a\n5" nail')).toEqual([['a'], ['5" nail']])
  })

  it('returns nothing for an empty file', () => {
    expect(parseDelimited('')).toEqual([])
  })

  it('parses with a semicolon when told to', () => {
    expect(parseDelimited('a;b\n1;2', ';')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('detectDelimiter', () => {
  it('picks the separator the header uses most', () => {
    expect(detectDelimiter('folder,url,title\nx,y,z')).toBe(',')
    expect(detectDelimiter('folder;url;title\nx;y;z')).toBe(';')
    expect(detectDelimiter('folder\turl\ttitle')).toBe('\t')
  })

  it('falls back to a comma when the header has no separator at all', () => {
    expect(detectDelimiter('url')).toBe(',')
  })
})
