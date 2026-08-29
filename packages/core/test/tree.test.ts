import { describe, expect, it } from 'vitest'
import {
  buildCollectionTree,
  canMoveCollection,
  collectSubtreeIds,
  flattenCollectionTree,
  nextPosition,
  positionBetween,
  summarizeCollections,
  type CollectionInput,
} from '../src/tree.ts'

function collection(id: string, parentId: string | null, position: number, name = id): CollectionInput {
  return { id, parentId, name, position }
}

function names<T extends CollectionInput>(nodes: readonly { collection: T }[]): string[] {
  return nodes.map((node) => node.collection.name)
}

describe('buildCollectionTree', () => {
  it('nests children under their parent', () => {
    const roots = buildCollectionTree([
      collection('reading', null, 0),
      collection('later', 'reading', 0),
      collection('archive', null, 1),
    ])
    expect(names(roots)).toEqual(['reading', 'archive'])
    expect(names(roots[0]!.children)).toEqual(['later'])
  })

  it('records depth', () => {
    const roots = buildCollectionTree([
      collection('a', null, 0),
      collection('b', 'a', 0),
      collection('c', 'b', 0),
    ])
    expect(roots[0]!.depth).toBe(0)
    expect(roots[0]!.children[0]!.depth).toBe(1)
    expect(roots[0]!.children[0]!.children[0]!.depth).toBe(2)
  })

  it('orders siblings by position', () => {
    const roots = buildCollectionTree([
      collection('third', null, 2),
      collection('first', null, 0),
      collection('second', null, 1),
    ])
    expect(names(roots)).toEqual(['first', 'second', 'third'])
  })

  it('falls back to name then id when positions collide', () => {
    const roots = buildCollectionTree([
      collection('b', null, 0, 'Beta'),
      collection('a', null, 0, 'Alpha'),
    ])
    expect(names(roots)).toEqual(['Alpha', 'Beta'])
  })

  it('treats a collection with a missing parent as a root', () => {
    const roots = buildCollectionTree([collection('orphan', 'gone', 0)])
    expect(names(roots)).toEqual(['orphan'])
  })

  it('returns nothing for an empty list', () => {
    expect(buildCollectionTree([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [collection('b', null, 1), collection('a', null, 0)]
    buildCollectionTree(input)
    expect(input.map((c) => c.id)).toEqual(['b', 'a'])
  })
})

describe('flattenCollectionTree', () => {
  const roots = buildCollectionTree([
    collection('reading', null, 0),
    collection('later', 'reading', 0),
    collection('deep', 'later', 0),
    collection('archive', null, 1),
  ])

  it('hides the children of a collapsed collection', () => {
    expect(names(flattenCollectionTree(roots, new Set()))).toEqual(['reading', 'archive'])
  })

  it('shows the children of an expanded collection', () => {
    expect(names(flattenCollectionTree(roots, new Set(['reading'])))).toEqual([
      'reading',
      'later',
      'archive',
    ])
  })

  it('stops at a collapsed collection even when its parent is expanded', () => {
    const rows = flattenCollectionTree(roots, new Set(['reading']))
    expect(names(rows)).not.toContain('deep')
  })

  it('reaches a grandchild when the whole path is expanded', () => {
    expect(names(flattenCollectionTree(roots, new Set(['reading', 'later'])))).toEqual([
      'reading',
      'later',
      'deep',
      'archive',
    ])
  })
})

describe('collectSubtreeIds', () => {
  it('includes the collection itself and every descendant', () => {
    const roots = buildCollectionTree([
      collection('a', null, 0),
      collection('b', 'a', 0),
      collection('c', 'b', 0),
      collection('other', null, 1),
    ])
    expect(collectSubtreeIds(roots[0]!)).toEqual(new Set(['a', 'b', 'c']))
  })
})

describe('nextPosition', () => {
  it('lands after the last sibling', () => {
    expect(nextPosition([collection('a', null, 0), collection('b', null, 4)])).toBe(5)
  })

  it('starts at zero when there are no siblings', () => {
    expect(nextPosition([])).toBe(0)
  })
})

describe('positionBetween', () => {
  it('lands halfway between two siblings', () => {
    expect(positionBetween(0, 1)).toBe(0.5)
    expect(positionBetween(2, 3)).toBe(2.5)
  })

  it('goes before the first sibling', () => {
    expect(positionBetween(null, 0)).toBe(-1)
  })

  it('goes after the last sibling', () => {
    expect(positionBetween(4, null)).toBe(5)
  })

  it('starts at zero in an empty list', () => {
    expect(positionBetween(null, null)).toBe(0)
  })

  it('keeps the folder ordered where it was dropped', () => {
    const siblings = [0, 1, 2]
    const dropped = positionBetween(siblings[0]!, siblings[1]!)
    expect([...siblings, dropped].sort((a, b) => a - b)).toEqual([0, 0.5, 1, 2])
  })
})

describe('canMoveCollection', () => {
  const roots = buildCollectionTree([
    collection('a', null, 0),
    collection('b', 'a', 0),
    collection('c', 'b', 0),
    collection('other', null, 1),
  ])

  it('allows a move to the top level', () => {
    expect(canMoveCollection(roots, 'a', null)).toBe(true)
  })

  it('allows a move into an unrelated folder', () => {
    expect(canMoveCollection(roots, 'a', 'other')).toBe(true)
  })

  it('refuses a move into itself', () => {
    expect(canMoveCollection(roots, 'a', 'a')).toBe(false)
  })

  it('refuses a move into its own child', () => {
    expect(canMoveCollection(roots, 'a', 'b')).toBe(false)
  })

  it('refuses a move into a deeper descendant', () => {
    expect(canMoveCollection(roots, 'a', 'c')).toBe(false)
  })

  it('allows a child to move into an unrelated folder', () => {
    expect(canMoveCollection(roots, 'b', 'other')).toBe(true)
  })
})

describe('summarizeCollections', () => {
  const roots = buildCollectionTree([
    collection('parent', null, 0),
    collection('child', 'parent', 0),
    collection('empty', null, 1),
  ])

  function item(collectionId: string | null, thumbnailUrl: string | null, createdAt: number) {
    return { collectionId, thumbnailUrl, createdAt }
  }

  it('counts a folder and its descendants separately', () => {
    const summaries = summarizeCollections(
      roots,
      [item('parent', null, 3), item('child', null, 2), item('child', null, 1)],
      4,
    )
    expect(summaries.get('parent')).toMatchObject({ directItems: 1, totalItems: 3 })
    expect(summaries.get('child')).toMatchObject({ directItems: 2, totalItems: 2 })
  })

  it('lets a folder of subfolders show what is beneath it', () => {
    const summaries = summarizeCollections(roots, [item('child', 'https://x/a.png', 1)], 4)
    expect(summaries.get('parent')?.directItems).toBe(0)
    expect(summaries.get('parent')?.thumbnails).toEqual(['https://x/a.png'])
  })

  it('takes the most recent thumbnails first', () => {
    const summaries = summarizeCollections(
      roots,
      [
        item('parent', 'https://x/old.png', 1),
        item('parent', 'https://x/new.png', 9),
        item('parent', 'https://x/mid.png', 5),
      ],
      2,
    )
    expect(summaries.get('parent')?.thumbnails).toEqual(['https://x/new.png', 'https://x/mid.png'])
  })

  it('does not let one repeated image fill the set', () => {
    const summaries = summarizeCollections(
      roots,
      [
        item('parent', 'https://x/same.png', 3),
        item('parent', 'https://x/same.png', 2),
        item('parent', 'https://x/other.png', 1),
      ],
      4,
    )
    expect(summaries.get('parent')?.thumbnails).toEqual(['https://x/same.png', 'https://x/other.png'])
  })

  it('skips scraps that have no thumbnail but still counts them', () => {
    const summaries = summarizeCollections(
      roots,
      [item('parent', null, 2), item('parent', 'https://x/a.png', 1)],
      4,
    )
    expect(summaries.get('parent')).toMatchObject({
      totalItems: 2,
      thumbnails: ['https://x/a.png'],
    })
  })

  it('reports an empty folder as empty rather than omitting it', () => {
    const summaries = summarizeCollections(roots, [], 4)
    expect(summaries.get('empty')).toEqual({ directItems: 0, totalItems: 0, thumbnails: [] })
  })

  it('ignores scraps in the inbox', () => {
    const summaries = summarizeCollections(roots, [item(null, 'https://x/a.png', 1)], 4)
    expect(summaries.get('parent')?.totalItems).toBe(0)
  })
})
