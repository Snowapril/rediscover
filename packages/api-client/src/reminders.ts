import type { Database } from '@rediscover/db/generated'
import type { RediscoverClient } from './client.ts'
import type { ItemRow } from './items.ts'
import { unwrap, unwrapVoid } from './result.ts'

export type ReminderRow = Database['public']['Tables']['reminders']['Row']
export type ReminderStatus = Database['public']['Enums']['reminder_status']

/*
 * @brief A reminder that has come due, with the scrap it is about.
 */
export interface DueReminder {
  reminder: ReminderRow
  item: ItemRow
}

/*
 * @brief Set a reminder on a scrap, replacing any it already had.
 * @details One live reminder per scrap: asking to be reminded again is changing
 *   your mind about when, not asking to be told twice.
 * @param client A signed-in client.
 * @param input Owner, the scrap, and when to surface it.
 * @return The reminder.
 */
export async function setReminder(
  client: RediscoverClient,
  input: { userId: string; itemId: string; remindAt: Date },
): Promise<ReminderRow> {
  unwrapVoid(
    await client
      .from('reminders')
      .update({ status: 'cancelled' })
      .eq('item_id', input.itemId)
      .eq('status', 'scheduled'),
  )

  return unwrap(
    await client
      .from('reminders')
      .insert({
        user_id: input.userId,
        item_id: input.itemId,
        remind_at: input.remindAt.toISOString(),
      })
      .select()
      .single(),
  )
}

/*
 * @brief Drop the reminder on a scrap without touching the scrap.
 * @param client A signed-in client.
 * @param itemId The scrap to stop reminding about.
 */
export async function cancelReminder(client: RediscoverClient, itemId: string): Promise<void> {
  unwrapVoid(
    await client
      .from('reminders')
      .update({ status: 'cancelled' })
      .eq('item_id', itemId)
      .eq('status', 'scheduled'),
  )
}

/*
 * @brief Reminders still waiting for their moment, by the scrap they are on.
 * @details Read alongside a folder so a scrap can show that it is spoken for.
 * @param client A signed-in client.
 * @return Every scheduled reminder the user has.
 */
export async function listScheduledReminders(client: RediscoverClient): Promise<ReminderRow[]> {
  return unwrap(
    await client.from('reminders').select('*').eq('status', 'scheduled').order('remind_at'),
  )
}

/*
 * @brief Reminders whose moment has arrived, oldest first.
 * @details Nothing marks a reminder due — it simply becomes due as time passes,
 *   which is why this needs no scheduler behind it. A trashed scrap drops out
 *   with it: being reminded about something thrown away is noise.
 * @param client A signed-in client.
 * @return The due reminders with their scraps, longest overdue first.
 */
export async function listDueReminders(client: RediscoverClient): Promise<DueReminder[]> {
  const rows = unwrap(
    await client
      .from('reminders')
      .select('*, item:items!inner(*)')
      .eq('status', 'scheduled')
      .lte('remind_at', new Date().toISOString())
      .is('items.deleted_at', null)
      .order('remind_at'),
  ) as unknown as (ReminderRow & { item: ItemRow })[]

  return rows.map(({ item, ...reminder }) => ({ reminder, item }))
}

/*
 * @brief Put a due reminder out of mind, either for good or for a while longer.
 * @param client A signed-in client.
 * @param id The reminder.
 * @param until When to surface it again, or null to be done with it.
 */
export async function resolveReminder(
  client: RediscoverClient,
  id: string,
  until: Date | null,
): Promise<void> {
  unwrapVoid(
    await client
      .from('reminders')
      .update(
        until === null
          ? { status: 'dismissed', sent_at: new Date().toISOString() }
          : { remind_at: until.toISOString() },
      )
      .eq('id', id),
  )
}
