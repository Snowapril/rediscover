/*
 * @brief The fields of a collection the tree layout depends on.
 * @details Structural rather than a database row type, so this stays usable
 *   from any client without pulling in the schema.
 */
export interface CollectionInput {
  id: string
  parentId: string | null
  name: string
  position: number
}

/*
 * @brief A collection placed in the folder tree.
 */
export interface CollectionNode<T extends CollectionInput = CollectionInput> {
  collection: T
  depth: number
  children: CollectionNode<T>[]
}

function compareSiblings(a: CollectionInput, b: CollectionInput): number {
  if (a.position !== b.position) return a.position - b.position
  const byName = a.name.localeCompare(b.name)
  if (byName !== 0) return byName
  return a.id.localeCompare(b.id)
}

/*
 * @brief Arrange a flat list of collections into the folder tree.
 * @details Siblings are ordered by position, then name, then id, so the order is
 *   stable even when positions collide. A collection whose parent is not in the
 *   list is treated as a root rather than dropped, so a partial fetch never
 *   makes folders disappear.
 * @param collections Every collection to place, in any order.
 * @return The root collections, each carrying its descendants.
 */
export function buildCollectionTree<T extends CollectionInput>(
  collections: readonly T[],
): CollectionNode<T>[] {
  const nodes = new Map<string, CollectionNode<T>>()
  for (const collection of collections) {
    nodes.set(collection.id, { collection, depth: 0, children: [] })
  }

  const roots: CollectionNode<T>[] = []
  for (const node of nodes.values()) {
    const parentId = node.collection.parentId
    const parent = parentId === null ? undefined : nodes.get(parentId)
    if (parent === undefined) roots.push(node)
    else parent.children.push(node)
  }

  const order = (siblings: CollectionNode<T>[], depth: number): void => {
    siblings.sort((a, b) => compareSiblings(a.collection, b.collection))
    for (const sibling of siblings) {
      sibling.depth = depth
      order(sibling.children, depth + 1)
    }
  }
  order(roots, 0)

  return roots
}

/*
 * @brief Walk the tree into the row order a list renders, honouring collapse.
 * @details A collapsed collection keeps its place but hides its descendants.
 * @param roots The tree, as returned by buildCollectionTree.
 * @param expandedIds Ids of the collections whose children are shown.
 * @return The visible collections, top to bottom.
 */
export function flattenCollectionTree<T extends CollectionInput>(
  roots: readonly CollectionNode<T>[],
  expandedIds: ReadonlySet<string>,
): CollectionNode<T>[] {
  const rows: CollectionNode<T>[] = []

  const visit = (nodes: readonly CollectionNode<T>[]): void => {
    for (const node of nodes) {
      rows.push(node)
      if (expandedIds.has(node.collection.id)) visit(node.children)
    }
  }
  visit(roots)

  return rows
}

/*
 * @brief Every collection at or below a given one.
 * @details Used to stop a folder being moved into its own subtree, which the
 *   database would reject anyway; catching it in the UI avoids offering the
 *   move at all.
 * @param root The collection to start from.
 * @return Its id and the ids of all its descendants.
 */
export function collectSubtreeIds<T extends CollectionInput>(
  root: CollectionNode<T>,
): Set<string> {
  const ids = new Set<string>()

  const visit = (node: CollectionNode<T>): void => {
    ids.add(node.collection.id)
    for (const child of node.children) visit(child)
  }
  visit(root)

  return ids
}

/*
 * @brief The position that places a new collection after its last sibling.
 * @param siblings The collections already under the same parent.
 * @return A position greater than every sibling's.
 */
export function nextPosition(siblings: readonly CollectionInput[]): number {
  let highest = -1
  for (const sibling of siblings) {
    if (sibling.position > highest) highest = sibling.position
  }
  return highest + 1
}
