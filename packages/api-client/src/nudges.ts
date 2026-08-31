import type { RediscoverClient } from './client.ts'
import { unwrap, unwrapVoid } from './result.ts'

/*
 * @brief Whether this account has asked to be nudged about forgotten scraps.
 * @param client A signed-in client.
 * @return True if nudges are on.
 */
export async function nudgesEnabled(client: RediscoverClient): Promise<boolean> {
  const rows = unwrap(await client.from('profiles').select('nudge_enabled').limit(1))
  return rows[0]?.nudge_enabled ?? false
}

/*
 * @brief Turn nudges about forgotten scraps on or off.
 * @details Off until asked for. A reminder was requested for a particular
 *   scrap; this was not requested at all, and sending it uninvited is how a
 *   useful nudge becomes something to be silenced.
 * @param client A signed-in client.
 * @param enabled Whether to send them.
 */
export async function setNudgesEnabled(
  client: RediscoverClient,
  enabled: boolean,
): Promise<void> {
  const { data } = await client.auth.getUser()
  const id = data.user?.id
  if (id === undefined) throw new Error('Not signed in')
  unwrapVoid(await client.from('profiles').update({ nudge_enabled: enabled }).eq('id', id))
}
