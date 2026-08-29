import { canonicalizeUrl, extractDomain, type ReadState } from '@rediscover/core'
import type { Database } from '@rediscover/db/generated'
import type { RediscoverClient } from './client.ts'
import { unwrap, unwrapVoid } from './result.ts'

export type ItemRow = Database['public']['Tables']['items']['Row']

/*
 * @brief The scraps filed under one collection, newest first.
 * @details A null collection means the inbox — scraps that have not been filed.
 *   Trashed scraps are excluded. The ordering is fixed for now; per-folder sort
 *   scripts replace it later.
 * @param client A signed-in client.
 * @param collectionId The collection to list, or null for the inbox.
 * @return The scraps, newest first.
 */
export async function listItems(
  client: RediscoverClient,
  collectionId: string | null,
): Promise<ItemRow[]> {
  const query = client.from('items').select('*').is('deleted_at', null)
  const scoped =
    collectionId === null
      ? query.is('collection_id', null)
      : query.eq('collection_id', collectionId)
  return unwrap(await scoped.order('created_at', { ascending: false }))
}

/*
 * @brief Save a link.
 * @details Only the link itself is stored; title, excerpt and thumbnail stay
 *   empty until extraction fills them, which is why the row starts as pending.
 *   The canonical form is what the duplicate check compares, so saving the same
 *   page with different tracking parameters is rejected by the database.
 * @param client A signed-in client.
 * @param input Owner, destination collection (null for the inbox), and the URL.
 * @return The created scrap.
 */
export async function createItem(
  client: RediscoverClient,
  input: { userId: string; collectionId: string | null; url: string },
): Promise<ItemRow> {
  const canonicalUrl = canonicalizeUrl(input.url)
  const domain = canonicalUrl === null ? null : extractDomain(canonicalUrl)
  if (canonicalUrl === null || domain === null) {
    throw new Error(`Not a web address: ${input.url}`)
  }

  return unwrap(
    await client
      .from('items')
      .insert({
        user_id: input.userId,
        collection_id: input.collectionId,
        url: input.url.trim(),
        canonical_url: canonicalUrl,
        domain,
      })
      .select()
      .single(),
  )
}

/*
 * @brief The little of every scrap that the folder overview needs.
 * @details Fetches the whole library rather than one request per folder, but
 *   only three columns of it, because the overview has to count and illustrate
 *   every folder at once. Should a library grow large enough for this to hurt,
 *   the counting belongs in the database instead.
 * @param client A signed-in client.
 * @return One row per live scrap.
 */
export async function listItemSummaries(
  client: RediscoverClient,
): Promise<{ collection_id: string | null; thumbnail_url: string | null; created_at: string }[]> {
  return unwrap(
    await client
      .from('items')
      .select('collection_id, thumbnail_url, created_at')
      .is('deleted_at', null),
  )
}

/*
 * @brief Find the live scrap that already holds a URL, if there is one.
 * @details Compares canonical forms, so a link that differs only by tracking
 *   parameters still matches. Used to say where a duplicate already lives
 *   rather than only that it exists.
 * @param client A signed-in client.
 * @param url The address the user tried to save.
 * @return The existing scrap, or null if the URL is unusable or not saved.
 */
export async function findLiveItemByUrl(
  client: RediscoverClient,
  url: string,
): Promise<ItemRow | null> {
  const canonicalUrl = canonicalizeUrl(url)
  if (canonicalUrl === null) return null

  const rows = unwrap(
    await client
      .from('items')
      .select('*')
      .eq('canonical_url', canonicalUrl)
      .is('deleted_at', null)
      .limit(1),
  )
  return rows[0] ?? null
}

/*
 * @brief Mark a scrap read, unread, or in progress.
 * @details read_at is kept consistent with the state, which the schema also
 *   enforces: an unread scrap cannot carry a time it was read.
 * @param client A signed-in client.
 * @param id The scrap to update.
 * @param state The state to move it to.
 */
export async function setReadState(
  client: RediscoverClient,
  id: string,
  state: ReadState,
): Promise<void> {
  unwrapVoid(
    await client
      .from('items')
      .update({
        read_state: state,
        read_at: state === 'unread' ? null : new Date().toISOString(),
      })
      .eq('id', id),
  )
}

/*
 * @brief Flag or unflag a scrap as important.
 * @param client A signed-in client.
 * @param id The scrap to update.
 * @param important Whether it is important.
 */
export async function setImportant(
  client: RediscoverClient,
  id: string,
  important: boolean,
): Promise<void> {
  unwrapVoid(await client.from('items').update({ is_important: important }).eq('id', id))
}

/*
 * @brief File a scrap under a different folder.
 * @param client A signed-in client.
 * @param id The scrap to move.
 * @param collectionId Its new folder, or null for the inbox.
 */
export async function setItemCollection(
  client: RediscoverClient,
  id: string,
  collectionId: string | null,
): Promise<void> {
  unwrapVoid(await client.from('items').update({ collection_id: collectionId }).eq('id', id))
}

/*
 * @brief Move a scrap to the trash.
 * @details A soft delete, so the row survives and its URL becomes available to
 *   scrap again.
 * @param client A signed-in client.
 * @param id The scrap to trash.
 */
export async function trashItem(client: RediscoverClient, id: string): Promise<void> {
  unwrapVoid(await client.from('items').update({ deleted_at: new Date().toISOString() }).eq('id', id))
}
