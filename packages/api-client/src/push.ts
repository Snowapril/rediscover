import type { Database } from '@rediscover/db/generated'
import type { RediscoverClient } from './client.ts'
import { unwrap, unwrapVoid } from './result.ts'

export type PushSubscriptionRow = Database['public']['Tables']['push_subscriptions']['Row']

/*
 * @brief Record that a browser will accept reminders.
 * @details Goes through a database function rather than an upsert, because the
 *   row may already belong to somebody else. A push endpoint identifies a
 *   browser installation, not a person, and subscribing twice on one browser
 *   returns the same endpoint — so on a shared machine the second account to
 *   turn notifications on finds the first account's row in its way. Row level
 *   security rightly refuses to let it update that row, and leaving the first
 *   account attached would send their reminders to a browser somebody else is
 *   now using.
 * @param client A signed-in client.
 * @param input The keys the browser reported.
 */
export async function savePushSubscription(
  client: RediscoverClient,
  input: { endpoint: string; p256dh: string; auth: string; userAgent: string },
): Promise<void> {
  const { error } = await client.rpc('claim_push_subscription', {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_user_agent: input.userAgent,
  })
  if (error !== null) throw new Error(error.message, { cause: error })
}

/*
 * @brief Forget a browser that no longer wants reminders.
 * @param client A signed-in client.
 * @param endpoint The endpoint that was cancelled.
 */
export async function removePushSubscription(
  client: RediscoverClient,
  endpoint: string,
): Promise<void> {
  unwrapVoid(await client.from('push_subscriptions').delete().eq('endpoint', endpoint))
}

/*
 * @brief The browsers this account has registered.
 * @param client A signed-in client.
 * @return One row per browser, newest first.
 */
export async function listPushSubscriptions(
  client: RediscoverClient,
): Promise<PushSubscriptionRow[]> {
  return unwrap(
    await client.from('push_subscriptions').select('*').order('created_at', { ascending: false }),
  )
}
