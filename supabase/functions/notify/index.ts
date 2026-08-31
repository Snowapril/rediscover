// Must come first: the library reaches for these the moment it encrypts.
import './base64-polyfill.ts'
import { send, type PushError } from 'jsr:@daaku/webpush@0.2.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/*
 * @brief How long a push service should hold a notification for a device that
 *   is offline.
 * @details A day. A reminder that arrives three days late is worse than one
 *   that never arrives, because the inbox in the application is still right and
 *   the notification would be contradicting it.
 */
const TTL_SECONDS = 86_400

/*
 * @brief Who to contact about this sender, as the push protocol requires.
 */
const SUBSCRIBER = Deno.env.get('VAPID_SUBSCRIBER') ?? 'mailto:admin@example.com'

interface Subscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/*
 * @brief Whether a push service said this subscription will never work again.
 * @details PushError is an interface, not a class — the library attaches its
 *   fields to a plain Error — so there is nothing to test with instanceof. The
 *   flag is what carries the meaning: 404 or 410, the browser has revoked it.
 * @param cause Whatever the send rejected with.
 * @return True when the subscription should be forgotten rather than retried.
 */
function isGone(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as Partial<PushError>).permanent === true
  )
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const vapid = Deno.env.get('VAPID_PRIVATE_KEY')
  if (vapid === undefined) return json({ error: 'This deployment has no VAPID key' }, 500)

  // Runs on behalf of everyone, so it reaches the database as the service role
  // rather than as any one signed-in person.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  const { data: due, error: dueError } = await admin
    .from('reminders')
    .select('id, user_id, item:items!inner(id, title, url, domain, deleted_at)')
    .eq('status', 'scheduled')
    .lte('remind_at', new Date().toISOString())
    .is('items.deleted_at', null)
    .limit(200)

  if (dueError !== null) return json({ error: dueError.message }, 500)
  if (due === null || due.length === 0) return json({ sent: 0, reminders: 0 }, 200)

  const byUser = new Map<string, typeof due>()
  for (const reminder of due) {
    const list = byUser.get(reminder.user_id)
    if (list === undefined) byUser.set(reminder.user_id, [reminder])
    else list.push(reminder)
  }

  let sent = 0
  let pruned = 0
  const failures: string[] = []
  const delivered: string[] = []

  for (const [userId, reminders] of byUser) {
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (subscriptions === null || subscriptions.length === 0) {
      // Nowhere to send. The reminders stay scheduled rather than being marked
      // sent, so they are still waiting in the application's own inbox and will
      // go out if a device is ever registered.
      continue
    }

    const first = reminders[0] as { item: { title: string | null; url: string; domain: string } }
    const body = JSON.stringify({
      title:
        reminders.length === 1
          ? 'Time to read this'
          : `${reminders.length} things you meant to read`,
      body: first.item.title ?? first.item.domain,
      url: reminders.length === 1 ? first.item.url : null,
      count: reminders.length,
    })

    let reachedSomeone = false

    for (const subscription of subscriptions as Subscription[]) {
      try {
        await send(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { vapid, subscriber: SUBSCRIBER, ttl: TTL_SECONDS },
        )
        sent++
        reachedSomeone = true
        await admin
          .from('push_subscriptions')
          .update({ last_delivered_at: new Date().toISOString() })
          .eq('id', subscription.id)
      } catch (cause) {
        // A push service reporting the subscription gone is not a failure to
        // retry: that browser has revoked it, and keeping the row means trying
        // forever.
        if (isGone(cause)) {
          await admin.from('push_subscriptions').delete().eq('id', subscription.id)
          pruned++
        } else {
          failures.push(cause instanceof Error ? cause.message : String(cause))
        }
      }
    }

    // Only once something actually arrived somewhere. Marking a reminder sent
    // when every send failed would take it out of the application's own inbox
    // as well, so a person would have asked to be reminded and then be reminded
    // by nothing at all. Left scheduled, it is still waiting and will be tried
    // again.
    if (reachedSomeone) {
      for (const reminder of reminders) delivered.push(reminder.id)
    }
  }

  if (delivered.length > 0) {
    await admin
      .from('reminders')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .in('id', delivered)
  }

  return json(
    {
      sent,
      pruned,
      reminders: delivered.length,
      // Reported rather than swallowed: a run that delivered nothing needs to
      // say why, or a broken sender looks exactly like an empty queue.
      failures: failures.slice(0, 5),
    },
    200,
  )
})
