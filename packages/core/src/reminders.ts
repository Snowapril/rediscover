/*
 * @brief How long from now a reminder should fire.
 * @details Offered as a few named choices rather than a date picker: the
 *   question being answered is "not now, but don't let me forget", and picking a
 *   calendar date is more decision than that deserves.
 */
export type ReminderPreset = 'tomorrow' | 'threeDays' | 'week' | 'month'

export const REMINDER_PRESETS: { value: ReminderPreset; label: string }[] = [
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'threeDays', label: 'In 3 days' },
  { value: 'week', label: 'In a week' },
  { value: 'month', label: 'In a month' },
]

const DAY_MS = 86_400_000

/*
 * @brief When a reminder set now should come due.
 * @details Fired at the same time of day it was set rather than at a fixed
 *   hour: somebody saving something at midnight is telling you when they are
 *   awake, and a reminder that arrives at 9am for them is one that arrives while
 *   they are asleep.
 * @param preset How far out to put it.
 * @param from The moment it is being set, in milliseconds.
 * @return When it comes due, in milliseconds.
 */
export function remindAtFrom(preset: ReminderPreset, from: number): number {
  const days = preset === 'tomorrow' ? 1 : preset === 'threeDays' ? 3 : preset === 'week' ? 7 : 30
  return from + days * DAY_MS
}

/*
 * @brief Whether a reminder has come due.
 * @param remindAt When it is set for, in milliseconds.
 * @param now The current moment, in milliseconds.
 * @return True once the moment has passed.
 */
export function isDue(remindAt: number, now: number): boolean {
  return remindAt <= now
}

/*
 * @brief How to describe when a reminder is, or was, due.
 * @details Overdue reminders say how long they have been waiting, because that
 *   is the number that should feel uncomfortable — the whole point of the
 *   feature is scraps that quietly rot.
 * @param remindAt When it is set for, in milliseconds.
 * @param now The current moment, in milliseconds.
 * @return A phrase like "due tomorrow" or "3 days overdue".
 */
export function describeDue(remindAt: number, now: number): string {
  const deltaDays = Math.round((remindAt - now) / DAY_MS)

  if (deltaDays === 0) return 'due today'
  if (deltaDays === 1) return 'due tomorrow'
  if (deltaDays > 1) return `due in ${deltaDays} days`
  if (deltaDays === -1) return '1 day overdue'
  return `${Math.abs(deltaDays)} days overdue`
}
