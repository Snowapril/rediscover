import { useMemo } from 'react'
import {
  chooseTodaysReading,
  readingProgress,
  type PickReason,
  type ReadableItem,
} from '@rediscover/core'
import type { ItemRow } from '@rediscover/api-client'
import { savedOn } from '../format.ts'
import { useItemsByIds, useReadableItems, useSetReadState } from '../data/queries.ts'

/*
 * @brief Why each scrap is on the shortlist, in words.
 * @details Kept here rather than in the logic that chooses them: the reasons are
 *   the interface's job to phrase, and a shortlist that explains itself reads as
 *   considered where three unexplained links read as random.
 */
const REASONS: Record<PickReason, string> = {
  shortest: 'Short enough for right now',
  oldest: 'Waiting the longest',
  flagged: 'You marked this one',
  chance: 'Worth another look',
}

/*
 * @brief The day being chosen for, as a plain date.
 * @details Local rather than UTC, so the shortlist turns over at the reader's
 *   midnight rather than at some hour in the middle of their evening.
 */
function today(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/*
 * @brief A few things to read today, and how the library is doing.
 * @details The problem this application exists for is not finding something
 *   good to read; it is that choosing from hundreds is itself the work, so
 *   nothing gets read. This is the answer to that: three, with a reason each.
 */
export function TodayView() {
  const readable = useReadableItems()
  const setReadState = useSetReadState(null)

  const picks = useMemo(() => {
    const items: (ReadableItem & { id: string })[] = (readable.data ?? []).map((row) => ({
      id: row.id,
      createdAt: new Date(row.created_at).getTime(),
      readState: row.read_state,
      isImportant: row.is_important,
      readingTimeMin: row.reading_time_min,
    }))
    return chooseTodaysReading(items, today())
  }, [readable.data])

  const progress = useMemo(
    () =>
      readingProgress(
        (readable.data ?? []).map((row) => ({
          id: row.id,
          createdAt: new Date(row.created_at).getTime(),
          readState: row.read_state,
          isImportant: row.is_important,
          readingTimeMin: row.reading_time_min,
        })),
        Date.now(),
      ),
    [readable.data],
  )

  const full = useItemsByIds(picks.map((pick) => pick.item.id))
  const byId = new Map((full.data ?? []).map((item) => [item.id, item]))

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Today</h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        {progress.unread === 0
          ? 'Nothing is waiting. Everything you saved has been read.'
          : 'Three of them, so you do not have to choose from all of them.'}
      </p>

      <ul className="mt-6 space-y-3">
        {picks.map((pick) => {
          const item = byId.get(pick.item.id)
          if (item === undefined) return null
          return (
            <li
              key={item.id}
              className="rounded-lg border border-line bg-surface p-4"
            >
              <p className="text-[0.65rem] font-medium uppercase tracking-wide text-accent">
                {REASONS[pick.reason]}
              </p>
              <Pick item={item} onRead={() => setReadState.mutate({ id: item.id, state: 'read' })} />
            </li>
          )
        })}
      </ul>

      {readable.isPending && <p className="mt-6 text-sm text-muted">Loading…</p>}

      <Progress progress={progress} />
    </section>
  )
}

function Pick({ item, onRead }: { item: ItemRow; onRead(): void }) {
  return (
    <>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer noopener"
        onClick={onRead}
        className="mt-1 block text-sm font-medium"
      >
        {item.title ?? item.url}
      </a>
      {item.excerpt !== null && (
        <p className="mt-1 line-clamp-2 text-xs text-muted">{item.excerpt}</p>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
        <span>{item.site_name ?? item.domain}</span>
        {item.reading_time_min !== null && <span>· {item.reading_time_min} min read</span>}
        <span>· saved {savedOn(item.created_at)}</span>
        <button
          type="button"
          onClick={onRead}
          className="ml-auto rounded-md border border-line px-2 py-0.5 text-ink"
        >
          Mark read
        </button>
      </p>
    </>
  )
}

/*
 * @brief How much of the library has been read.
 * @details Stated plainly. A library that is almost entirely unread is worth
 *   knowing about, and softening the number would be the same instinct that let
 *   it get that way.
 */
function Progress({ progress }: { progress: ReturnType<typeof readingProgress> }) {
  if (progress.saved === 0) return null
  const percent = Math.round((progress.read / progress.saved) * 100)

  return (
    <div className="mt-8 border-t border-line pt-4">
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {progress.read} of {progress.saved} read ({percent}%).
        {progress.stale > 0 && (
          <>
            {' '}
            <span className="text-accent">
              {progress.stale} {progress.stale === 1 ? 'has' : 'have'} been waiting over a month.
            </span>
          </>
        )}
      </p>
    </div>
  )
}
