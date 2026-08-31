import { describe, expect, it } from 'vitest'
import {
  chooseTodaysReading,
  readingProgress,
  type ReadableItem,
} from '../src/reading.ts'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 7, 31)

function scrap(id: string, overrides: Partial<ReadableItem> = {}): ReadableItem {
  return {
    id,
    createdAt: NOW - 10 * DAY,
    readState: 'unread',
    isImportant: false,
    readingTimeMin: null,
    ...overrides,
  }
}

describe('chooseTodaysReading', () => {
  it('offers a short one, the longest waiting, and one that was flagged', () => {
    const picks = chooseTodaysReading(
      [
        scrap('quick', { readingTimeMin: 2 }),
        scrap('ancient', { createdAt: NOW - 400 * DAY }),
        scrap('starred', { isImportant: true, createdAt: NOW - 100 * DAY }),
        scrap('filler'),
      ],
      '2026-08-31',
    )
    expect(picks.map((pick) => [pick.item.id, pick.reason])).toEqual([
      ['quick', 'shortest'],
      ['ancient', 'oldest'],
      ['starred', 'flagged'],
    ])
  })

  it('never puts the same scrap forward twice', () => {
    // One scrap that is the shortest, the oldest and flagged all at once.
    const picks = chooseTodaysReading(
      [
        scrap('everything', { readingTimeMin: 1, createdAt: NOW - 500 * DAY, isImportant: true }),
        scrap('second'),
        scrap('third'),
      ],
      '2026-08-31',
    )
    expect(new Set(picks.map((pick) => pick.item.id)).size).toBe(picks.length)
    expect(picks).toHaveLength(3)
  })

  it('fills the remaining places when a reason has no candidate', () => {
    // Nothing flagged, nothing with a reading time.
    const picks = chooseTodaysReading([scrap('a'), scrap('b'), scrap('c'), scrap('d')], '2026-08-31')
    expect(picks).toHaveLength(3)
    expect(picks.filter((pick) => pick.reason === 'chance').length).toBeGreaterThan(0)
  })

  it('leaves out what has been read', () => {
    const picks = chooseTodaysReading(
      [scrap('done', { readState: 'read' }), scrap('waiting')],
      '2026-08-31',
    )
    expect(picks.map((pick) => pick.item.id)).toEqual(['waiting'])
  })

  it('keeps a scrap that was started but not finished', () => {
    const picks = chooseTodaysReading([scrap('midway', { readState: 'reading' })], '2026-08-31')
    expect(picks.map((pick) => pick.item.id)).toEqual(['midway'])
  })

  it('offers the same scraps all day', () => {
    // The property the whole idea rests on: a shortlist that changes on every
    // reload is a slot machine, and nobody commits to reading from one.
    const library = Array.from({ length: 40 }, (_, index) =>
      scrap(`item-${index}`, { createdAt: NOW - index * DAY }),
    )
    const morning = chooseTodaysReading(library, '2026-08-31')
    const afternoon = chooseTodaysReading(library, '2026-08-31')
    expect(afternoon).toEqual(morning)
  })

  it('offers different scraps tomorrow', () => {
    const library = Array.from({ length: 40 }, (_, index) => scrap(`item-${index}`))
    const today = chooseTodaysReading(library, '2026-08-31').map((pick) => pick.item.id)
    const tomorrow = chooseTodaysReading(library, '2026-09-01').map((pick) => pick.item.id)
    expect(tomorrow).not.toEqual(today)
  })

  it('gives back everything there is when the library is nearly empty', () => {
    expect(chooseTodaysReading([scrap('only')], '2026-08-31')).toHaveLength(1)
    expect(chooseTodaysReading([], '2026-08-31')).toEqual([])
  })

  it('has nothing to offer once everything is read', () => {
    expect(
      chooseTodaysReading([scrap('a', { readState: 'read' })], '2026-08-31'),
    ).toEqual([])
  })

  it('does not mutate the library it is given', () => {
    const library = [scrap('b'), scrap('a')]
    chooseTodaysReading(library, '2026-08-31')
    expect(library.map((item) => item.id)).toEqual(['b', 'a'])
  })
})

describe('readingProgress', () => {
  it('counts what has been read against what was saved', () => {
    const progress = readingProgress(
      [scrap('a', { readState: 'read' }), scrap('b'), scrap('c')],
      NOW,
    )
    expect(progress).toEqual({ saved: 3, read: 1, unread: 2, stale: 0 })
  })

  it('counts an unread scrap that has waited too long as stale', () => {
    const progress = readingProgress(
      [scrap('old', { createdAt: NOW - 200 * DAY }), scrap('recent', { createdAt: NOW - DAY })],
      NOW,
    )
    expect(progress.stale).toBe(1)
  })

  it('does not call something stale once it has been read', () => {
    const progress = readingProgress(
      [scrap('old', { createdAt: NOW - 200 * DAY, readState: 'read' })],
      NOW,
    )
    expect(progress.stale).toBe(0)
  })

  it('takes a different patience than the default', () => {
    const items = [scrap('a', { createdAt: NOW - 10 * DAY })]
    expect(readingProgress(items, NOW, 30).stale).toBe(0)
    expect(readingProgress(items, NOW, 7).stale).toBe(1)
  })

  it('reports an empty library without dividing by anything', () => {
    expect(readingProgress([], NOW)).toEqual({ saved: 0, read: 0, unread: 0, stale: 0 })
  })
})
