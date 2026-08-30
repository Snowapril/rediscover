import { describe, expect, it } from 'vitest'
import type { ItemRow } from '@rediscover/api-client'
import { FILL_CONCURRENCY, nextToFill } from '../src/data/fillQueue.ts'

function item(id: string, status: 'pending' | 'ok' | 'failed'): ItemRow {
  return { id, extract_status: status } as ItemRow
}

describe('nextToFill', () => {
  it('takes only the scraps that have never been read', () => {
    const chosen = nextToFill(
      [item('a', 'ok'), item('b', 'pending'), item('c', 'failed')],
      new Set(),
    )
    expect(chosen.map((entry) => entry.id)).toEqual(['b'])
  })

  it('leaves a failed scrap alone, since it has its own retry', () => {
    expect(nextToFill([item('a', 'failed')], new Set())).toEqual([])
  })

  it('never starts more than the limit at once', () => {
    const many = Array.from({ length: 20 }, (_, index) => item(String(index), 'pending'))
    expect(nextToFill(many, new Set())).toHaveLength(FILL_CONCURRENCY)
  })

  it('counts what is already running against the limit', () => {
    const many = Array.from({ length: 20 }, (_, index) => item(String(index), 'pending'))
    expect(nextToFill(many, new Set(['0', '1']))).toHaveLength(FILL_CONCURRENCY - 2)
  })

  it('starts nothing while the limit is taken', () => {
    const many = Array.from({ length: 20 }, (_, index) => item(String(index), 'pending'))
    expect(nextToFill(many, new Set(['0', '1', '2']))).toEqual([])
  })

  it('does not start a scrap that is already being read', () => {
    // A re-render must not launch the same read twice.
    const chosen = nextToFill([item('a', 'pending'), item('b', 'pending')], new Set(['a']))
    expect(chosen.map((entry) => entry.id)).toEqual(['b'])
  })

  it('has nothing to do when everything has been read', () => {
    expect(nextToFill([item('a', 'ok'), item('b', 'ok')], new Set())).toEqual([])
  })
})
