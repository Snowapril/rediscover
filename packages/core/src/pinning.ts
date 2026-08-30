import type { CollectionInput } from './tree.ts'

/*
 * @brief A collection that may be pinned to the top.
 */
export interface PinnableCollection extends CollectionInput {
  /*
   * @brief When it was pinned, or null if it is not.
   */
  pinnedAt: string | null
}

/*
 * @brief The pinned collections, in the order they should sit at the top.
 * @details Ordered by when they were pinned, oldest first, so the shelf does not
 *   reshuffle every time something is added to it. Name and id break ties so two
 *   folders pinned in the same instant still land somewhere fixed.
 * @param collections Every collection the user owns.
 * @return The pinned ones, in display order.
 */
export function pinnedCollections<T extends PinnableCollection>(
  collections: readonly T[],
): T[] {
  return collections
    .filter((collection) => collection.pinnedAt !== null)
    .sort((a, b) => {
      const byTime = (a.pinnedAt as string).localeCompare(b.pinnedAt as string)
      if (byTime !== 0) return byTime
      const byName = a.name.localeCompare(b.name)
      return byName === 0 ? a.id.localeCompare(b.id) : byName
    })
}

/*
 * @brief The names leading to a collection, outermost first.
 * @details A pinned folder is shown outside the tree, where its name alone can
 *   be ambiguous — "Later" inside "Reading" and "Later" inside "Archive" are
 *   different folders. The path is what tells them apart.
 *
 *   A cycle cannot occur (the database refuses one) but the walk is bounded
 *   anyway, because this runs while rendering and a hang here would take the
 *   whole sidebar with it.
 * @param collections Every collection the user owns.
 * @param id The collection to describe.
 * @return The names from the outermost ancestor down to the collection itself,
 *   or an empty array if the id is unknown.
 */
export function collectionPath<T extends PinnableCollection>(
  collections: readonly T[],
  id: string,
): string[] {
  const byId = new Map(collections.map((collection) => [collection.id, collection]))
  const names: string[] = []

  let current = byId.get(id)
  let hops = 0
  while (current !== undefined && hops < 100) {
    names.unshift(current.name)
    current = current.parentId === null ? undefined : byId.get(current.parentId)
    hops++
  }

  return names
}

/*
 * @brief Collections that hold a pinned collection somewhere beneath them.
 * @details A folder pinned three levels down is invisible in a collapsed tree,
 *   so its ancestors carry a mark saying something inside is pinned. The pinned
 *   folder itself is not included: it shows its own pin.
 * @param collections Every collection the user owns.
 * @return The ids of every ancestor of a pinned collection.
 */
export function branchesHoldingPinned<T extends PinnableCollection>(
  collections: readonly T[],
): Set<string> {
  const byId = new Map(collections.map((collection) => [collection.id, collection]))
  const ancestors = new Set<string>()

  for (const collection of collections) {
    if (collection.pinnedAt === null) continue

    let parentId = collection.parentId
    let hops = 0
    while (parentId !== null && hops < 100) {
      if (ancestors.has(parentId)) break
      ancestors.add(parentId)
      parentId = byId.get(parentId)?.parentId ?? null
      hops++
    }
  }

  return ancestors
}
