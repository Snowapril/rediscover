import { useState, type FormEvent } from 'react'
import type { ItemRow } from '@rediscover/api-client'
import { DEFAULT_VIEW, settingsOf, type ViewSettings } from '@rediscover/api-client'
import { useViewItems } from '../data/useViewItems.ts'
import { ViewBar } from './ViewBar.tsx'
import {
  useCollections,
  useCreateItem,
  useFindExistingItem,
  useItems,
  useRetryExtraction,
  useSetImportant,
  useCreateView,
  useDeleteView,
  useScripts,
  useSetReadState,
  useTrashItem,
  useUpdateView,
  useViews,
} from '../data/queries.ts'

interface Props {
  userId: string
  collectionId: string | null
  collectionName: string
  onOpenCollection(id: string | null): void
}

const DUPLICATE_CONSTRAINT = 'items_user_canonical_url_key'

/*
 * @brief Where a link the user tried to save again already lives.
 * @details Null collectionId means the inbox, matching how a scrap is stored.
 */
interface Duplicate {
  collectionId: string | null
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

export function ItemList({ userId, collectionId, collectionName, onOpenCollection }: Props) {
  const items = useItems(collectionId)
  const collections = useCollections()
  const sortScripts = useScripts('sort')
  const groupScripts = useScripts('group')
  const views = useViews(collectionId)
  const createItem = useCreateItem()
  const findExisting = useFindExistingItem()
  const createView = useCreateView(collectionId)
  const updateView = useUpdateView(collectionId)
  const deleteView = useDeleteView(collectionId)

  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null)
  const [chosenViewId, setChosenViewId] = useState<string | null>(null)

  // Falling back to the first view rather than remembering one per folder means
  // moving between folders never lands on a view that belongs to another.
  const savedViews = views.data ?? []
  const activeView =
    savedViews.find((view) => view.id === chosenViewId) ?? savedViews[0] ?? null
  const settings = activeView === null ? DEFAULT_VIEW : settingsOf(activeView)

  const allScripts = [...(sortScripts.data ?? []), ...(groupScripts.data ?? [])]
  const arranged = useViewItems(items.data, settings, allScripts)

  function changeView(patch: Partial<ViewSettings>) {
    if (activeView !== null) {
      updateView.mutate({ id: activeView.id, settings: patch })
      return
    }
    // Nothing was saved for this folder yet, so the first change is what turns
    // the default into a view of its own.
    createView.mutate(
      { userId, collectionId, name: 'Default', position: 0, ...settings, ...patch },
      { onSuccess: (created) => setChosenViewId(created.id) },
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setDuplicate(null)

    createItem.mutate(
      { userId, collectionId, url },
      {
        onSuccess: () => setUrl(''),
        onError: (cause) => {
          const message = cause instanceof Error ? cause.message : String(cause)
          if (!message.includes(DUPLICATE_CONSTRAINT)) {
            setError(message)
            return
          }
          // Saying only "already saved" leaves the user hunting for it, so find
          // the folder it is in before saying anything.
          void findExisting(url)
            .then((existing) => {
              if (existing === null) setError('You have already saved this link.')
              else setDuplicate({ collectionId: existing.collection_id })
            })
            .catch(() => setError('You have already saved this link.'))
        },
      },
    )
  }

  function nameOf(id: string | null): string {
    if (id === null) return 'Inbox'
    return collections.data?.find((collection) => collection.id === id)?.name ?? 'another folder'
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

      {duplicate !== null && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-accent">
          {duplicate.collectionId === collectionId ? (
            <span>Already saved in this folder.</span>
          ) : (
            <>
              <span>
                Already saved in <strong>{nameOf(duplicate.collectionId)}</strong>.
              </span>
              <button
                type="button"
                onClick={() => {
                  onOpenCollection(duplicate.collectionId)
                  setDuplicate(null)
                }}
                className="underline underline-offset-4"
              >
                Go there
              </button>
            </>
          )}
        </p>
      )}

      <ViewBar
        views={savedViews}
        activeId={activeView?.id ?? null}
        settings={settings}
        sortScripts={sortScripts.data ?? []}
        groupScripts={groupScripts.data ?? []}
        busy={arranged.running}
        onSelect={setChosenViewId}
        onChange={changeView}
        onAdd={(name) =>
          createView.mutate(
            { userId, collectionId, name, position: savedViews.length, ...settings },
            { onSuccess: (created) => setChosenViewId(created.id) },
          )
        }
        onRemove={(id) => {
          setChosenViewId(null)
          deleteView.mutate(id)
        }}
      />

      {arranged.error !== null && (
        <p className="mt-3 text-sm text-accent">
          This view&rsquo;s script did not run: {arranged.error} Showing the scraps unarranged.
        </p>
      )}

      <div className="mt-4">
        {items.isPending && <p className="text-sm text-muted">Loading…</p>}
        {items.isError && (
          <p className="text-sm text-accent">Could not load this folder. {String(items.error)}</p>
        )}
        {items.data?.length === 0 && <p className="text-sm text-muted">Nothing saved here yet.</p>}

        {arranged.groups.map((group) => (
          <section key={group.label} className={arranged.grouped ? 'mt-5 first:mt-0' : ''}>
            {arranged.grouped && (
              <h2 className="flex items-baseline gap-2 border-b border-line pb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {group.label}
                <span className="font-normal normal-case tracking-normal">
                  {group.items.length}
                </span>
              </h2>
            )}
            <ul className="divide-y divide-line">
              {group.items.map((item) => (
                <ItemRowView key={item.id} item={item} collectionId={collectionId} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}

function ItemRowView({ item, collectionId }: { item: ItemRow; collectionId: string | null }) {
  const setReadState = useSetReadState(collectionId)
  const setImportant = useSetImportant(collectionId)
  const trashItem = useTrashItem(collectionId)
  const retry = useRetryExtraction(collectionId)
  const [thumbnailBroken, setThumbnailBroken] = useState(false)

  const isRead = item.read_state === 'read'
  // Extraction may not have run, or may have failed, so fall back to the
  // address rather than showing an empty row.
  const heading = item.title ?? item.url
  const showThumbnail = item.thumbnail_url !== null && !thumbnailBroken

  return (
    <li className="group flex items-start gap-3 py-3">
      <button
        type="button"
        aria-label={isRead ? 'Mark unread' : 'Mark read'}
        title={isRead ? 'Mark unread' : 'Mark read'}
        onClick={() => setReadState.mutate({ id: item.id, state: isRead ? 'unread' : 'read' })}
        className={`mt-1.5 size-4 shrink-0 rounded-full border ${
          isRead ? 'border-accent bg-accent' : 'border-line-strong'
        }`}
      />

      {showThumbnail && (
        <img
          src={item.thumbnail_url ?? ''}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setThumbnailBroken(true)}
          className="h-14 w-20 shrink-0 rounded border border-line object-cover"
        />
      )}

      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className={`block truncate text-sm ${isRead ? 'text-muted' : 'font-medium'}`}
        >
          {heading}
        </a>

        {item.excerpt !== null && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.excerpt}</p>
        )}

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
