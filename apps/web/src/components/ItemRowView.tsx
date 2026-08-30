import { useState } from 'react'
import type { ItemRow, ViewLayout } from '@rediscover/api-client'
import { useRetryExtraction, useSetImportant, useSetReadState, useTrashItem } from '../data/queries.ts'

interface Props {
  item: ItemRow
  collectionId: string | null
  layout: ViewLayout
}

/*
 * @brief Elapsed time in the coarsest unit that still says something.
 * @param iso When the scrap was saved.
 * @return A phrase like "3 days ago".
 */
export function savedAgo(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime()
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const units = [
    { unit: 'day', ms: 86_400_000 },
    { unit: 'hour', ms: 3_600_000 },
    { unit: 'minute', ms: 60_000 },
  ] as const

  for (const { unit, ms } of units) {
    const value = Math.floor(elapsedMs / ms)
    if (value >= 1) return format.format(-value, unit)
  }
  return 'just now'
}

/*
 * @brief The controls every layout carries, however it shows them.
 */
function useItemActions(item: ItemRow, collectionId: string | null) {
  const setReadState = useSetReadState(collectionId)
  const setImportant = useSetImportant(collectionId)
  const trashItem = useTrashItem(collectionId)
  const retry = useRetryExtraction(collectionId)

  const isRead = item.read_state === 'read'
  return {
    isRead,
    retry,
    toggleRead: () => setReadState.mutate({ id: item.id, state: isRead ? 'unread' : 'read' }),
    toggleImportant: () => setImportant.mutate({ id: item.id, important: !item.is_important }),
    trash: () => trashItem.mutate(item.id),
  }
}

function Thumbnail({ item, className }: { item: ItemRow; className: string }) {
  const [broken, setBroken] = useState(false)
  if (item.thumbnail_url === null || broken) return null

  return (
    <img
      src={item.thumbnail_url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={className}
    />
  )
}

function Meta({ item, retry }: { item: ItemRow; retry: ReturnType<typeof useItemActions>['retry'] }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
      <span>{item.site_name ?? item.domain}</span>
      {item.reading_time_min !== null && <span>· {item.reading_time_min} min read</span>}
      <span>· saved {savedAgo(item.created_at)}</span>
      {item.extract_status === 'pending' && <span>· reading the page…</span>}
      {item.extract_status === 'failed' && (
        <>
          <span className="text-accent" title={item.extract_error ?? undefined}>
            · could not read this page
          </span>
          <button
            type="button"
            onClick={() => retry.mutate(item)}
            disabled={retry.isPending}
            className="underline underline-offset-2 disabled:opacity-50"
          >
            {retry.isPending ? 'Retrying…' : 'Retry'}
          </button>
        </>
      )}
    </p>
  )
}

function Actions({
  item,
  actions,
  floating,
}: {
  item: ItemRow
  actions: ReturnType<typeof useItemActions>
  floating: boolean
}) {
  const base = 'rounded px-1.5 py-0.5 text-sm'
  return (
    <div
      className={
        floating
          ? 'absolute right-1 top-1 flex items-center gap-0.5 rounded-md bg-surface/90 px-0.5'
          : 'flex shrink-0 items-center gap-1'
      }
    >
      <button
        type="button"
        aria-label={item.is_important ? 'Remove flag' : 'Flag as important'}
        title={item.is_important ? 'Remove flag' : 'Flag as important'}
        onClick={actions.toggleImportant}
        className={`${base} ${
          item.is_important ? 'text-accent' : 'text-muted opacity-0 group-hover:opacity-100'
        }`}
      >
        ★
      </button>
      <button
        type="button"
        aria-label="Move to trash"
        title="Move to trash"
        onClick={actions.trash}
        className={`${base} text-muted opacity-0 hover:text-ink group-hover:opacity-100`}
      >
        ×
      </button>
    </div>
  )
}

function ReadDot({ actions, className }: { actions: ReturnType<typeof useItemActions>; className: string }) {
  return (
    <button
      type="button"
      aria-label={actions.isRead ? 'Mark unread' : 'Mark read'}
      title={actions.isRead ? 'Mark unread' : 'Mark read'}
      onClick={actions.toggleRead}
      className={`${className} size-4 shrink-0 rounded-full border ${
        actions.isRead ? 'border-accent bg-accent' : 'border-line-strong bg-surface'
      }`}
    />
  )
}

/*
 * @brief One scrap, drawn the way the current view asks.
 * @details The layouts are not decoration: each answers a different question.
 *   Headline is for scanning a long backlog by name; list adds the site and how
 *   long it takes, for choosing what to read next; card shows the excerpt, for
 *   remembering why it was saved; moodboard is nearly all image, for the folders
 *   where the picture is the point.
 * @param item The scrap.
 * @param collectionId The folder it is listed under, so an edit refreshes it.
 * @param layout How the current view draws its scraps.
 */
export function ItemRowView({ item, collectionId, layout }: Props) {
  const actions = useItemActions(item, collectionId)
  // Extraction may not have run, or may have failed, so fall back to the
  // address rather than showing an empty row.
  const heading = item.title ?? item.url
  const titleClass = actions.isRead ? 'text-muted' : 'font-medium'

  if (layout === 'grid') {
    return (
      <li className="group relative overflow-hidden rounded-lg border border-line bg-surface">
        <a href={item.url} target="_blank" rel="noreferrer noopener" className="block">
          <div className="aspect-[4/3] w-full bg-canvas">
            <Thumbnail item={item} className="size-full object-cover" />
          </div>
          <p className={`px-2.5 pb-2 pt-2 text-xs ${titleClass} line-clamp-2`}>{heading}</p>
        </a>
        <ReadDot actions={actions} className="absolute left-2 top-2" />
        <Actions item={item} actions={actions} floating />
      </li>
    )
  }

  if (layout === 'headline') {
    return (
      <li className="group flex items-center gap-3 py-1.5">
        <ReadDot actions={actions} className="" />
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className={`min-w-0 flex-1 truncate text-sm ${titleClass}`}
        >
          {heading}
        </a>
        <span className="shrink-0 text-xs text-muted">{item.domain}</span>
        <Actions item={item} actions={actions} floating={false} />
      </li>
    )
  }

  const showsExcerpt = layout === 'card'

  return (
    <li className="group flex items-start gap-3 py-3">
      <ReadDot actions={actions} className="mt-1.5" />

      {showsExcerpt && (
        <Thumbnail item={item} className="h-14 w-20 shrink-0 rounded border border-line object-cover" />
      )}

      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className={`block truncate text-sm ${titleClass}`}
        >
          {heading}
        </a>
        {showsExcerpt && item.excerpt !== null && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.excerpt}</p>
        )}
        <Meta item={item} retry={actions.retry} />
      </div>

      <Actions item={item} actions={actions} floating={false} />
    </li>
  )
}
