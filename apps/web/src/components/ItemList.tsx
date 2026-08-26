import { useState, type FormEvent } from 'react'
import type { ItemRow } from '@rediscover/api-client'
import { useCreateItem, useItems, useSetImportant, useSetReadState, useTrashItem } from '../data/queries.js'

interface Props {
  userId: string
  collectionId: string | null
  collectionName: string
}

/*
 * @brief Turn a database failure into something worth reading.
 * @details The only failure a user can reliably provoke here is saving a link
 *   twice, and Postgres reports that as a constraint name.
 * @param error Whatever the mutation rejected with.
 * @return A sentence to show under the input.
 */
function describeSaveError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('items_user_canonical_url_key')) return 'You have already saved this link.'
  return message
}

/*
 * @brief Elapsed time in the coarsest unit that still says something.
 * @param iso When the scrap was saved.
 * @return A phrase like "3 days ago".
 */
function savedAgo(iso: string): string {
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

export function ItemList({ userId, collectionId, collectionName }: Props) {
  const items = useItems(collectionId)
  const createItem = useCreateItem()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    createItem.mutate(
      { userId, collectionId, url },
      {
        onSuccess: () => setUrl(''),
        onError: (cause) => setError(describeSaveError(cause)),
      },
    )
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">{collectionName}</h1>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          inputMode="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste a link to save"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={createItem.isPending}
          className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-canvas disabled:opacity-50"
        >
          Save
        </button>
      </form>
      {error !== null && <p className="mt-2 text-sm text-accent">{error}</p>}

      <div className="mt-6">
        {items.isPending && <p className="text-sm text-muted">Loading…</p>}
        {items.isError && (
          <p className="text-sm text-accent">Could not load this folder. {String(items.error)}</p>
        )}
        {items.data?.length === 0 && (
          <p className="text-sm text-muted">Nothing saved here yet.</p>
        )}

        <ul className="divide-y divide-line">
          {items.data?.map((item) => (
            <ItemRowView key={item.id} item={item} collectionId={collectionId} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function ItemRowView({ item, collectionId }: { item: ItemRow; collectionId: string | null }) {
  const setReadState = useSetReadState(collectionId)
  const setImportant = useSetImportant(collectionId)
  const trashItem = useTrashItem(collectionId)

  const isRead = item.read_state === 'read'
  // Extraction has not run yet for a freshly saved link, so fall back to the
  // address rather than showing an empty row.
  const heading = item.title ?? item.url

  return (
    <li className="group flex items-start gap-3 py-3">
      <button
        type="button"
        aria-label={isRead ? 'Mark unread' : 'Mark read'}
        title={isRead ? 'Mark unread' : 'Mark read'}
        onClick={() => setReadState.mutate({ id: item.id, state: isRead ? 'unread' : 'read' })}
        className={`mt-1 size-4 shrink-0 rounded-full border ${
          isRead ? 'border-accent bg-accent' : 'border-line-strong'
        }`}
      />

      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className={`block truncate text-sm ${isRead ? 'text-muted' : 'font-medium'}`}
        >
          {heading}
        </a>
        <p className="mt-0.5 text-xs text-muted">
          {item.domain} · saved {savedAgo(item.created_at)}
          {item.extract_status === 'pending' && ' · not yet read in'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={item.is_important ? 'Remove flag' : 'Flag as important'}
          title={item.is_important ? 'Remove flag' : 'Flag as important'}
          onClick={() => setImportant.mutate({ id: item.id, important: !item.is_important })}
          className={`rounded px-1.5 py-0.5 text-sm ${
            item.is_important ? 'text-accent' : 'text-muted opacity-0 group-hover:opacity-100'
          }`}
        >
          ★
        </button>
        <button
          type="button"
          aria-label="Move to trash"
          title="Move to trash"
          onClick={() => trashItem.mutate(item.id)}
          className="rounded px-1.5 py-0.5 text-sm text-muted opacity-0 hover:text-ink group-hover:opacity-100"
        >
          ×
        </button>
      </div>
    </li>
  )
}
