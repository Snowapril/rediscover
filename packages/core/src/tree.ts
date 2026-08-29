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

/*
 * @brief A position that sorts between two siblings.
 * @details Ordering is fractional so a folder can be dropped between two others
 *   without renumbering the rest. Repeatedly inserting into the same gap halves
 *   it each time; at roughly fifty consecutive splits a double runs out of
 *   precision and the two positions collide, at which point the siblings need
 *   renumbering. Ties fall back to name then id, so a collision misorders rather
 *   than corrupts.
 * @param before The sibling the folder lands after, or null for the first slot.
 * @param after The sibling the folder lands before, or null for the last slot.
 * @return The position to store.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0
  if (before === null) return (after as number) - 1
  if (after === null) return before + 1
  return (before + after) / 2
}

/*
 * @brief Whether a folder may be moved under a new parent.
 * @details A folder cannot be filed inside itself or inside its own descendant,
 *   which the database also refuses; checking here means the drop is never
 *   offered in the first place.
 * @param roots The folder tree.
 * @param sourceId The folder being moved.
 * @param targetParentId The proposed parent, or null for the top level.
 * @return True if the move is allowed.
 */
export function canMoveCollection<T extends CollectionInput>(
  roots: readonly CollectionNode<T>[],
  sourceId: string,
  targetParentId: string | null,
): boolean {
  if (targetParentId === null) return true
  if (targetParentId === sourceId) return false

  const find = (nodes: readonly CollectionNode<T>[]): CollectionNode<T> | null => {
    for (const node of nodes) {
      if (node.collection.id === sourceId) return node
      const found = find(node.children)
      if (found !== null) return found
    }
    return null
  }

  const source = find(roots)
  if (source === null) return true
  return !collectSubtreeIds(source).has(targetParentId)
}

/*
 * @brief What a folder holds, for showing it without opening it.
 */
export interface CollectionSummary {
  /*
   * @brief Scraps filed directly in this folder.
   */
  directItems: number
  /*
   * @brief Scraps in this folder and every folder beneath it.
   */
  totalItems: number
  /*
   * @brief A few thumbnails drawn from the folder and its descendants, newest first.
   */
  thumbnails: string[]
}

/*
 * @brief The fields of a scrap a folder summary is built from.
 */
export interface SummarizableItem {
  collectionId: string | null
  thumbnailUrl: string | null
  createdAt: number
}

/*
 * @brief Count each folder's scraps and pick thumbnails to represent it.
 * @details Counts and thumbnails include descendants, so a folder holding only
 *   subfolders still shows what is under it rather than reading as empty.
 *   Thumbnails are the most recently saved, deduplicated so a repeated image
 *   does not fill the set.
 * @param roots The folder tree.
 * @param items Every scrap the user owns.
 * @param limit How many thumbnails a folder may show.
 * @return A summary per folder, keyed by folder id.
 */
export function summarizeCollections<T extends CollectionInput>(
  roots: readonly CollectionNode<T>[],
  items: readonly SummarizableItem[],
  limit: number,
): Map<string, CollectionSummary> {
  const direct = new Map<string, SummarizableItem[]>()
  for (const item of items) {
    if (item.collectionId === null) continue
    const bucket = direct.get(item.collectionId)
    if (bucket === undefined) direct.set(item.collectionId, [item])
    else bucket.push(item)
  }

  const summaries = new Map<string, CollectionSummary>()

  const visit = (node: CollectionNode<T>): SummarizableItem[] => {
    const own = direct.get(node.collection.id) ?? []
    const subtree = [...own]
    for (const child of node.children) subtree.push(...visit(child))

    subtree.sort((a, b) => b.createdAt - a.createdAt)

    const thumbnails: string[] = []
    const seen = new Set<string>()
    for (const item of subtree) {
      if (thumbnails.length >= limit) break
      const url = item.thumbnailUrl
      if (url === null || seen.has(url)) continue
      seen.add(url)
      thumbnails.push(url)
    }

    summaries.set(node.collection.id, {
      directItems: own.length,
      totalItems: subtree.length,
      thumbnails,
    })
    return subtree
  }

  for (const root of roots) visit(root)
  return summaries
}
