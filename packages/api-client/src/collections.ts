import type { CollectionInput } from '@rediscover/core'
import type { Database } from '@rediscover/db/generated'
import type { RediscoverClient } from './client.ts'
import { unwrap, unwrapVoid } from './result.ts'

export type CollectionRow = Database['public']['Tables']['collections']['Row']

/*
 * @brief Reshape a collection row into the form the tree layout takes.
 * @param row A collection as stored.
 * @return The same collection, with the fields buildCollectionTree reads.
 */
export function toCollectionInput(row: CollectionRow): CollectionInput & { row: CollectionRow } {
  return { id: row.id, parentId: row.parent_id, name: row.name, position: row.position, row }
}

/*
 * @brief Every collection the signed-in user owns.
 * @details The whole tree is fetched at once: folder counts are small, and
 *   having all of them lets the tree be laid out without a request per level.
 * @param client A signed-in client.
 * @return The collections, in no particular order.
 */
export async function listCollections(client: RediscoverClient): Promise<CollectionRow[]> {
  return unwrap(await client.from('collections').select('*'))
}

/*
 * @brief Create a collection.
 * @param client A signed-in client.
 * @param input Owner, optional parent, display name, and sibling position.
 * @return The created collection.
 */
export async function createCollection(
  client: RediscoverClient,
  input: { userId: string; parentId: string | null; name: string; position: number },
): Promise<CollectionRow> {
  return unwrap(
    await client
      .from('collections')
      .insert({
        user_id: input.userId,
        parent_id: input.parentId,
        name: input.name,
        position: input.position,
      })
      .select()
      .single(),
  )
}

/*
 * @brief Change a collection's display name.
 * @param client A signed-in client.
 * @param id The collection to rename.
 * @param name The new name.
 */
export async function renameCollection(
  client: RediscoverClient,
  id: string,
  name: string,
): Promise<void> {
  unwrapVoid(await client.from('collections').update({ name }).eq('id', id))
}

/*
 * @brief File a collection under a new parent, at a given place among its siblings.
 * @details Position is fractional, so reordering touches one row rather than
 *   renumbering the whole level. The database refuses a move that would make a
 *   folder its own ancestor; canMoveCollection in @rediscover/core answers the
 *   same question up front so the drop is never offered.
 * @param client A signed-in client.
 * @param id The collection to move.
 * @param parentId Its new parent, or null for the top level.
 * @param position Where it sits among its new siblings.
 */
export async function moveCollection(
  client: RediscoverClient,
  id: string,
  parentId: string | null,
  position: number,
): Promise<void> {
  unwrapVoid(
    await client.from('collections').update({ parent_id: parentId, position }).eq('id', id),
  )
}

/*
 * @brief Empty one folder into another and remove it.
 * @details The scraps move, the subfolders move, and the emptied folder goes —
 *   in one database transaction, because a failure between those steps would
 *   leave a half-merged tree, and deleting a folder that still held scraps would
 *   send them to the trash. The database refuses a merge into the folder's own
 *   subtree, and, because the function runs with the caller's rights, reports a
 *   folder belonging to anyone else as missing.
 * @param client A signed-in client.
 * @param sourceId The folder to empty out and remove.
 * @param targetId The folder that receives its contents.
 */
export async function mergeCollection(
  client: RediscoverClient,
  sourceId: string,
  targetId: string,
): Promise<void> {
  const { error } = await client.rpc('merge_collection', {
    source_id: sourceId,
    target_id: targetId,
  })
  if (error !== null) throw new Error(error.message, { cause: error })
}

/*
 * @brief Delete a collection and everything nested under it.
 * @details Child collections are removed with it, and the scraps of the whole
 *   subtree are moved to the trash by a database trigger. They are trashed
 *   rather than destroyed, so they remain recoverable and their URLs are free
 *   to scrap again.
 * @param client A signed-in client.
 * @param id The collection to delete.
 */
export async function deleteCollection(client: RediscoverClient, id: string): Promise<void> {
  unwrapVoid(await client.from('collections').delete().eq('id', id))
}
