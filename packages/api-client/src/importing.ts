import { requiredFolderPaths, type ImportedScrap } from '@rediscover/core'
import type { RediscoverClient } from './client.ts'
import { createCollection, listCollections, type CollectionRow } from './collections.ts'
import { unwrap } from './result.ts'

/*
 * @brief Rows written per request.
 * @details Large enough that a few thousand scraps take a handful of round
 *   trips, small enough that one rejected row only costs its own batch when the
 *   fallback retries it one at a time.
 */
const BATCH_SIZE = 200

export interface ImportProgress {
  /*
   * @brief Scraps written so far.
   */
  imported: number
  /*
   * @brief Scraps the library already held.
   */
  skipped: number
  /*
   * @brief Scraps still to write.
   */
  remaining: number
}

export interface ImportResult {
  imported: number
  skipped: number
  foldersCreated: number
}

/*
 * @brief The key identifying a folder by its place in the tree.
 */
function folderKey(parentId: string | null, name: string): string {
  return `${parentId ?? ''} ${name.toLowerCase()}`
}

/*
 * @brief Create the folders an import needs, reusing any that already exist.
 * @details Paths arrive shallowest first, so a parent is always in the index by
 *   the time its child is looked up. Matching is case-insensitive on name
 *   within a parent, which is how a person reads a folder tree even though the
 *   database would happily hold two folders differing only in case.
 * @param client A signed-in client.
 * @param userId The owner.
 * @param paths The folder paths to ensure, shallowest first.
 * @param existing The folders the user already has.
 * @return The id of each path, keyed by its joined form, and how many were created.
 */
async function ensureFolders(
  client: RediscoverClient,
  userId: string,
  paths: readonly string[][],
  existing: readonly CollectionRow[],
): Promise<{ ids: Map<string, string>; created: number }> {
  const index = new Map<string, string>()
  for (const collection of existing) {
    index.set(folderKey(collection.parent_id, collection.name), collection.id)
  }

  const nextPosition = new Map<string | null, number>()
  for (const collection of existing) {
    const current = nextPosition.get(collection.parent_id) ?? 0
    nextPosition.set(collection.parent_id, Math.max(current, collection.position + 1))
  }

  const ids = new Map<string, string>()
  let created = 0

  for (const path of paths) {
    let parentId: string | null = null
    for (let depth = 0; depth < path.length; depth++) {
      const name = path[depth] as string
      const key = folderKey(parentId, name)
      let id = index.get(key)

      if (id === undefined) {
        const position = nextPosition.get(parentId) ?? 0
        const collection = await createCollection(client, { userId, parentId, name, position })
        nextPosition.set(parentId, position + 1)
        index.set(key, collection.id)
        id = collection.id
        created++
      }

      parentId = id
      ids.set(path.slice(0, depth + 1).join('/'), id)
    }
  }

  return { ids, created }
}

function toRow(scrap: ImportedScrap, userId: string, collectionId: string | null) {
  return {
    user_id: userId,
    collection_id: collectionId,
    url: scrap.url,
    canonical_url: scrap.canonicalUrl,
    domain: scrap.domain,
    title: scrap.title,
    excerpt: scrap.excerpt,
    note: scrap.note,
    thumbnail_url: scrap.thumbnailUrl,
    is_important: scrap.isImportant,
    // The export supplied these, so there is nothing to read the page for. They
    // are recorded as the automatic values, which leaves them free to be
    // replaced by a later extraction and keeps the user's own edits distinct.
    auto_metadata: {
      title: scrap.title,
      excerpt: scrap.excerpt,
      thumbnailUrl: scrap.thumbnailUrl,
    },
    extract_status: 'ok' as const,
    extracted_at: new Date().toISOString(),
    ...(scrap.createdAt === null ? {} : { created_at: scrap.createdAt }),
  }
}

/*
 * @brief Store the scraps read out of an export file.
 * @details Pages the library already holds are left alone rather than reported
 *   as errors: re-importing the same export should be safe and should not
 *   disturb what is already saved. The duplicate check runs against the
 *   canonical form, so a link that differs only by tracking parameters is
 *   recognised as one already held.
 * @param client A signed-in client.
 * @param userId The owner.
 * @param scraps The scraps to store.
 * @param onProgress Called after each batch.
 * @return How many were written, skipped, and how many folders were created.
 */
export async function importScraps(
  client: RediscoverClient,
  userId: string,
  scraps: readonly ImportedScrap[],
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const existingCollections = await listCollections(client)
  const { ids, created } = await ensureFolders(
    client,
    userId,
    requiredFolderPaths(scraps),
    existingCollections,
  )

  const held = new Set(
    unwrap(await client.from('items').select('canonical_url').is('deleted_at', null)).map(
      (row) => row.canonical_url,
    ),
  )

  const pending = scraps.filter((scrap) => !held.has(scrap.canonicalUrl))
  let imported = 0
  let skipped = scraps.length - pending.length

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE)
    const rows = batch.map((scrap) =>
      toRow(scrap, userId, ids.get(scrap.folderPath.join('/')) ?? null),
    )

    const { error } = await client.from('items').insert(rows)
    if (error === null) {
      imported += rows.length
    } else {
      // One bad row rejects the whole statement, so the batch is retried
      // individually to find out which, rather than losing all of them.
      for (const row of rows) {
        const single = await client.from('items').insert(row)
        if (single.error === null) imported++
        else skipped++
      }
    }

    onProgress?.({ imported, skipped, remaining: pending.length - (start + batch.length) })
  }

  return { imported, skipped, foldersCreated: created }
}
