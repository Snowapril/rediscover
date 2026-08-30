import { describeDue, remindAtFrom, REMINDER_PRESETS } from '@rediscover/core'
import { useDueReminders, useResolveReminder } from '../data/queries.ts'

/*
 * @brief The scraps whose moment has come.
 * @details Nothing puts a reminder here — it arrives by the clock alone, which
 *   is why there is no scheduler behind this. What is here is what somebody
 *   once said they would come back to, which makes it the shortlist the whole
 *   application exists to produce.
 */
export function DueView() {
  const due = useDueReminders()
  const resolve = useResolveReminder()
  const now = Date.now()

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Due</h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Things you asked to be reminded about. Open one, or push it further out.
      </p>

      {due.isPending && <p className="mt-6 text-sm text-muted">Loading…</p>}

      {due.data?.length === 0 && (
        <p className="mt-6 text-sm text-muted">
          Nothing is due. Set a reminder on a scrap and it turns up here.
        </p>
      )}

      <ul className="mt-6 divide-y divide-line">
        {due.data?.map(({ reminder, item }) => {
          const overdue = new Date(reminder.remind_at).getTime() < now - 86_400_000

          return (
            <li key={reminder.id} className="py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate text-sm font-medium"
                  >
                    {item.title ?? item.url}
                  </a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    <span>{item.site_name ?? item.domain}</span>
                    {item.reading_time_min !== null && <span>· {item.reading_time_min} min read</span>}
                    <span className={overdue ? 'text-accent' : ''}>
                      · {describeDue(new Date(reminder.remind_at).getTime(), now)}
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <select
                    value=""
                    onChange={(event) => {
                      const preset = event.target.value
                      if (preset === '') return
                      resolve.mutate({
                        id: reminder.id,
                        until: new Date(
                          remindAtFrom(preset as (typeof REMINDER_PRESETS)[number]['value'], now),
                        ),
                      })
                    }}
                    aria-label="Remind me again"
                    className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
                  >
                    <option value="">Later…</option>
                    {REMINDER_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => resolve.mutate({ id: reminder.id, until: null })}
                    className="rounded-md border border-line px-2 py-1 text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
