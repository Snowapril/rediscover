import { describe, expect, it } from 'vitest'
import {
  branchesHoldingPinned,
  collectionPath,
  pinnedCollections,
  type PinnableCollection,
} from '../src/pinning.ts'

function folder(
  id: string,
  parentId: string | null,
  pinnedAt: string | null = null,
  name = id,
): PinnableCollection {
  return { id, parentId, name, position: 0, pinnedAt }
}

describe('pinnedCollections', () => {
  it('keeps only the pinned ones', () => {
    const pinned = pinnedCollections([
      folder('a', null, '2026-01-01T00:00:00Z'),
      folder('b', null, null),
    ])
    expect(pinned.map((entry) => entry.id)).toEqual(['a'])
  })

  it('orders by when they were pinned, oldest first', () => {
    // So the shelf does not reshuffle each time something joins it.
    const pinned = pinnedCollections([
      folder('later', null, '2026-03-01T00:00:00Z'),
      folder('earlier', null, '2026-01-01T00:00:00Z'),
    ])
    expect(pinned.map((entry) => entry.id)).toEqual(['earlier', 'later'])
  })

  it('falls back to name then id when pinned in the same instant', () => {
    const same = '2026-01-01T00:00:00Z'
    const pinned = pinnedCollections([
      folder('z', null, same, 'Beta'),
      folder('a', null, same, 'Alpha'),
    ])
    expect(pinned.map((entry) => entry.name)).toEqual(['Alpha', 'Beta'])
  })

  it('returns nothing when nothing is pinned', () => {
    expect(pinnedCollections([folder('a', null)])).toEqual([])
  })

  it('does not mutate the input', () => {
    const input = [folder('b', null, '2026-02-01T00:00:00Z'), folder('a', null, '2026-01-01T00:00:00Z')]
    pinnedCollections(input)
    expect(input.map((entry) => entry.id)).toEqual(['b', 'a'])
  })
})

describe('collectionPath', () => {
  const tree = [folder('a', null), folder('b', 'a'), folder('c', 'b')]

  it('reads from the outermost ancestor down', () => {
    expect(collectionPath(tree, 'c')).toEqual(['a', 'b', 'c'])
  })

  it('is just the name for a folder at the top level', () => {
    expect(collectionPath(tree, 'a')).toEqual(['a'])
  })

  it('tells apart two folders that share a name', () => {
    const ambiguous = [
      folder('reading', null, null, 'Reading'),
      folder('archive', null, null, 'Archive'),
      folder('later-1', 'reading', null, 'Later'),
      folder('later-2', 'archive', null, 'Later'),
    ]
    expect(collectionPath(ambiguous, 'later-1')).toEqual(['Reading', 'Later'])
    expect(collectionPath(ambiguous, 'later-2')).toEqual(['Archive', 'Later'])
  })

  it('gives nothing for an id it does not know', () => {
    expect(collectionPath(tree, 'missing')).toEqual([])
  })

  it('stops rather than hanging if the data ever contained a cycle', () => {
    const cyclic = [folder('a', 'b'), folder('b', 'a')]
    expect(collectionPath(cyclic, 'a').length).toBeLessThanOrEqual(100)
  })
})

describe('branchesHoldingPinned', () => {
  it('marks every ancestor of a pinned folder', () => {
    const tree = [folder('a', null), folder('b', 'a'), folder('c', 'b', '2026-01-01T00:00:00Z')]
    expect(branchesHoldingPinned(tree)).toEqual(new Set(['a', 'b']))
  })

  it('does not mark the pinned folder itself, which shows its own pin', () => {
    const tree = [folder('a', null, '2026-01-01T00:00:00Z')]
    expect(branchesHoldingPinned(tree)).toEqual(new Set())
  })

  it('marks nothing when nothing is pinned', () => {
    expect(branchesHoldingPinned([folder('a', null), folder('b', 'a')])).toEqual(new Set())
  })

  it('marks a branch once even when it holds several pinned folders', () => {
    const tree = [
      folder('a', null),
      folder('b', 'a', '2026-01-01T00:00:00Z'),
      folder('c', 'a', '2026-01-02T00:00:00Z'),
    ]
    expect(branchesHoldingPinned(tree)).toEqual(new Set(['a']))
  })
})
