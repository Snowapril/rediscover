import type { Database } from '@rediscover/db/generated'
import type { RediscoverClient } from './client.ts'
import { unwrap } from './result.ts'

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
