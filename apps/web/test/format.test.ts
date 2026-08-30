import { describe, expect, it } from 'vitest'
import { savedOn } from '../src/format.ts'

const NOW = new Date('2026-08-30T12:00:00Z')

describe('savedOn', () => {
  it('gives the date rather than how long ago it was', () => {
    expect(savedOn('2026-08-12T09:00:00Z', NOW, 'en-GB')).toBe('12 Aug')
  })

  it('leaves this year unsaid, since every row would repeat it', () => {
    expect(savedOn('2026-01-03T09:00:00Z', NOW, 'en-GB')).not.toContain('2026')
  })

  it('says the year when it is not this one', () => {
    expect(savedOn('2024-11-12T09:00:00Z', NOW, 'en-GB')).toContain('2024')
  })

  it('follows the language the interface is written in, not the reader machine', () => {
    // Every other string on the row is English. A date in the reader's own
    // convention beside them reads as something broken, not as a courtesy —
    // "saved 8월 12일 · 3 min read". This is the line to change when the
    // interface itself becomes translatable.
    expect(savedOn('2026-08-12T09:00:00Z', NOW)).toBe('12 Aug')
  })

  it('can still be formatted for another language, for when it is translated', () => {
    expect(savedOn('2026-08-12T09:00:00Z', NOW, 'ko-KR')).toBe('8월 12일')
    expect(savedOn('2026-08-12T09:00:00Z', NOW, 'en-US')).toBe('Aug 12')
  })

  it('says nothing rather than Invalid Date', () => {
    expect(savedOn('not a date', NOW, 'en-GB')).toBe('')
  })
})
