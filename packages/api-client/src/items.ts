import {
  canonicalizeUrl,
  extractDomain,
  narrowsAnything,
  savedWindow,
  type ReadState,
  type ScriptItem,
  type SearchFilters,
} from '@rediscover/core'
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

/*
 * @brief Reduce a stored scrap to the shape user scripts are given.
 * @details Timestamps become epoch milliseconds so a script can do arithmetic
 *   on them without a Date, and the object carries nothing a script has no
 *   business seeing.
 * @param row The scrap as stored.
 * @param tags Its tags, if they have been loaded.
 * @return The scrap as a script sees it.
 */
export function toScriptItem(row: ItemRow, tags: readonly string[] = []): ScriptItem {
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    title: row.title,
    excerpt: row.excerpt,
    thumbnailUrl: row.thumbnail_url,
    siteName: row.site_name,
    author: row.author,
    publishedAt: row.published_at === null ? null : new Date(row.published_at).getTime(),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    readState: row.read_state,
    readAt: row.read_at === null ? null : new Date(row.read_at).getTime(),
    isImportant: row.is_important,
    tags: [...tags],
    readingTimeMin: row.reading_time_min,
    mediaType: row.media_type,
    note: row.note,
  }
}

/*
 * @brief Every live scrap, reduced to what the reading shortlist needs.
 * @details Four columns rather than the whole row: the shortlist and the counts
 *   are computed over the entire library, and pulling all of it down in full to
 *   pick three would be a large download for a small answer.
 * @param client A signed-in client.
 * @return One row per live scrap.
 */
export async function listReadableItems(client: RediscoverClient): Promise<
  { id: string; created_at: string; read_state: ReadState; is_important: boolean; reading_time_min: number | null }[]
> {
  return unwrap(
    await client
      .from('items')
      .select('id, created_at, read_state, is_important, reading_time_min')
      .is('deleted_at', null),
  )
}

/*
 * @brief The scraps behind a shortlist, in full.
 * @param client A signed-in client.
 * @param ids The scraps to fetch.
 * @return The scraps, in no particular order.
 */
export async function listItemsByIds(
  client: RediscoverClient,
  ids: readonly string[],
): Promise<ItemRow[]> {
  if (ids.length === 0) return []
  return unwrap(await client.from('items').select('*').in('id', [...ids]))
}

/*
 * @brief Find scraps by what is written on them, by where they sit, or by both.
 * @details Text is one input among several. A search with no words but a folder
 *   and a date is a real question — "what did I put in Reading last month" — and
 *   refusing it because the box was empty would be answering the wrong one.
 *   Filters that narrow nothing are left off the call entirely rather than sent
 *   as empty arrays, so the database can tell "any state" from "no states".
 * @param client A signed-in client.
 * @param filters What to look for and where.
 * @param limit How many to return.
 * @return The matches, best first when words were given and newest first
 *   otherwise; nothing when the filters narrow nothing.
 */
export async function searchItems(
  client: RediscoverClient,
  filters: SearchFilters,
  limit = 50,
): Promise<ItemRow[]> {
  if (!narrowsAnything(filters)) return []

  const window = savedWindow(filters.savedWithin, Date.now())
  const { data, error } = await client.rpc('search_items', {
    query: filters.text,
    scope: filters.scope.kind,
    flagged_only: filters.flaggedOnly,
    max_results: limit,
    ...(filters.scope.kind === 'folder'
      ? { collection: filters.scope.id, include_subfolders: filters.scope.includeSubfolders }
      : {}),
    ...(filters.states.length > 0 ? { states: filters.states } : {}),
    ...(filters.kinds.length > 0 ? { kinds: filters.kinds } : {}),
    ...(window.after === null ? {} : { saved_after: window.after.toISOString() }),
    ...(window.before === null ? {} : { saved_before: window.before.toISOString() }),
  })
  if (error !== null) throw new Error(error.message, { cause: error })
  return data ?? []
}
