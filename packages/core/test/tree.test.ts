import { describe, expect, it } from 'vitest'
import {
  buildCollectionTree,
  collectSubtreeIds,
  flattenCollectionTree,
  nextPosition,
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
