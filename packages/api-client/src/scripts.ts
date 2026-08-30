import type { Database } from '@rediscover/db/generated'
import type { RediscoverClient } from './client.ts'
import { unwrap, unwrapVoid } from './result.ts'

export type ScriptRow = Database['public']['Tables']['scripts']['Row']

/*
 * @brief Every script the user can choose from.
 * @details Their own and the built-in ones together: row level security decides
 *   which is which, and a built-in is distinguished by carrying no owner.
 * @param client A signed-in client.
 * @param kind Whether to list sort scripts or group scripts.
 * @return The scripts, built-in ones first, each set by name.
 */
export async function listScripts(
  client: RediscoverClient,
  kind: 'sort' | 'group',
): Promise<ScriptRow[]> {
  const rows = unwrap(await client.from('scripts').select('*').eq('kind', kind))
  return rows.sort((a, b) => {
    if (a.is_builtin !== b.is_builtin) return a.is_builtin ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/*
 * @brief Every script the user can choose from, of either kind.
 * @param client A signed-in client.
 * @return The scripts, built-in ones first, each set by name.
 */
export async function listAllScripts(client: RediscoverClient): Promise<ScriptRow[]> {
  const rows = unwrap(await client.from('scripts').select('*'))
  return rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
    if (a.is_builtin !== b.is_builtin) return a.is_builtin ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/*
 * @brief Write a new script of the user's own.
 * @param client A signed-in client.
 * @param input Owner, name, kind, source, and the script it was forked from.
 * @return The created script.
 */
export async function createScript(
  client: RediscoverClient,
  input: {
    userId: string
    name: string
    kind: 'sort' | 'group'
    source: string
    forkedFrom?: string | null
  },
): Promise<ScriptRow> {
  return unwrap(
    await client
      .from('scripts')
      .insert({
        user_id: input.userId,
        name: input.name,
        kind: input.kind,
        source: input.source,
        is_builtin: false,
        forked_from: input.forkedFrom ?? null,
      })
      .select()
      .single(),
  )
}

/*
 * @brief Copy a script into one the user owns and can change.
 * @details How a built-in is edited: the original stays where it is, readable by
 *   everyone, and the copy records what it came from.
 * @param client A signed-in client.
 * @param userId The new owner.
 * @param original The script to copy.
 * @return The copy.
 */
export async function forkScript(
  client: RediscoverClient,
  userId: string,
  original: ScriptRow,
): Promise<ScriptRow> {
  return createScript(client, {
    userId,
    name: `${original.name} (mine)`,
    kind: original.kind,
    source: original.source,
    forkedFrom: original.id,
  })
}

/*
 * @brief Change a script the user owns.
 * @param client A signed-in client.
 * @param id The script to change.
 * @param patch The name or source to set.
 */
export async function updateScript(
  client: RediscoverClient,
  id: string,
  patch: { name?: string; source?: string },
): Promise<void> {
  unwrapVoid(await client.from('scripts').update(patch).eq('id', id))
}

/*
 * @brief Delete a script the user owns.
 * @details Views naming it fall back to their default order rather than
 *   breaking, because the schema clears the reference instead of refusing.
 * @param client A signed-in client.
 * @param id The script to delete.
 */
export async function deleteScript(client: RediscoverClient, id: string): Promise<void> {
  unwrapVoid(await client.from('scripts').delete().eq('id', id))
}
