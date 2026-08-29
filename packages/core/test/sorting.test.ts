import { describe, expect, it } from 'vitest'
import { compareSortKeys, groupByLabels, orderByKeys } from '../src/sorting.ts'

function order(keys: (number | string | boolean | null | unknown[])[], direction?: 'asc' | 'desc') {
  const items = keys.map((_, index) => index)
  return orderByKeys(items, keys as never, direction)
}

describe('compareSortKeys', () => {
  it('orders numbers, strings and booleans within their own kind', () => {
    expect(compareSortKeys(1, 2)).toBeLessThan(0)
    expect(compareSortKeys('a', 'b')).toBeLessThan(0)
    expect(compareSortKeys(false, true)).toBeLessThan(0)
    expect(compareSortKeys(2, 2)).toBe(0)
  })

  it('compares strings by code point, not by locale', () => {
    // Locale-aware collation puts these the other way round in most languages.
    expect(compareSortKeys('Z', 'a')).toBeLessThan(0)
    expect(compareSortKeys('a', 'á')).toBeLessThan(0)
  })

  it('keeps mixed kinds in a fixed order rather than an arbitrary one', () => {
    expect(compareSortKeys(1, 'a')).toBeLessThan(0)
    expect(compareSortKeys('a', true)).toBeLessThan(0)
    expect(compareSortKeys(1, true)).toBeLessThan(0)
  })

  it('compares arrays element by element', () => {
    expect(compareSortKeys([0, 5], [0, 9])).toBeLessThan(0)
    expect(compareSortKeys([1, 0], [0, 9])).toBeGreaterThan(0)
    expect(compareSortKeys([1, 2], [1, 2])).toBe(0)
  })

  it('puts a shorter array first when it is a prefix of the longer', () => {
    expect(compareSortKeys([1], [1, 0])).toBeLessThan(0)
  })

  it('puts a null inside an array after everything else at that position', () => {
    expect(compareSortKeys([0, null], [0, 9])).toBeGreaterThan(0)
  })
})

describe('orderByKeys', () => {
  it('sorts ascending by default', () => {
    expect(order([3, 1, 2])).toEqual([1, 2, 0])
  })

  it('sorts descending when asked', () => {
    expect(order([3, 1, 2], 'desc')).toEqual([0, 2, 1])
  })

  it('puts scraps with no key last whichever way it runs', () => {
    expect(order([2, null, 1])).toEqual([2, 0, 1])
    expect(order([2, null, 1], 'desc')).toEqual([0, 2, 1])
  })

  it('keeps ties in their original order', () => {
    expect(order([1, 1, 1])).toEqual([0, 1, 2])
  })

  it('keeps ties in their original order when reversed too', () => {
    // Reversing the comparison must not reverse the tiebreak, or the same
    // folder shuffles every time the direction is toggled.
    expect(order([1, 1, 1], 'desc')).toEqual([0, 1, 2])
  })

  it('treats a missing key as null rather than failing', () => {
    expect(orderByKeys([0, 1], [5], 'asc')).toEqual([0, 1])
  })

  it('does not mutate the input', () => {
    const items = [0, 1, 2]
    orderByKeys(items, [3, 2, 1])
    expect(items).toEqual([0, 1, 2])
  })

  it('sorts an ordinary multi-level key the way a script would write it', () => {
    // Important first, then newest.
    const keys = [
      [1, -100],
      [0, -50],
      [1, -200],
      [0, -90],
    ]
    expect(order(keys)).toEqual([3, 1, 2, 0])
  })
})

describe('groupByLabels', () => {
  it('gathers scraps under their labels', () => {
    const groups = groupByLabels(['a', 'b', 'c'], ['x', 'y', 'x'])
    expect(groups).toEqual([
      { label: 'x', items: ['a', 'c'] },
      { label: 'y', items: ['b'] },
    ])
  })

  it('orders groups by where each first appears, preserving the sort', () => {
    const groups = groupByLabels([1, 2, 3], ['late', 'early', 'late'])
    expect(groups.map((group) => group.label)).toEqual(['late', 'early'])
  })

  it('collects unlabelled scraps at the end instead of dropping them', () => {
    const groups = groupByLabels(['a', 'b'], ['x', null])
    expect(groups[1]).toEqual({ label: 'Everything else', items: ['b'] })
  })

  it('takes a name for the leftover group', () => {
    const groups = groupByLabels(['a'], [null], 'Unsorted')
    expect(groups[0]!.label).toBe('Unsorted')
  })

  it('returns nothing for no scraps', () => {
    expect(groupByLabels([], [])).toEqual([])
  })
})
