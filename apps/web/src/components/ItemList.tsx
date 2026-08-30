import { useState, type FormEvent } from 'react'
import { DEFAULT_VIEW, settingsOf, type ViewSettings } from '@rediscover/api-client'
import { useFillPending } from '../data/useFillPending.ts'
import { useViewItems } from '../data/useViewItems.ts'
import { CategoryChips } from './CategoryChips.tsx'
import { ItemRowView } from './ItemRowView.tsx'
import { ViewBar } from './ViewBar.tsx'
import {
  useCollections,
  useCreateItem,
  useFindExistingItem,
  useItems,
  useCreateView,
  useDeleteView,
  useScripts,
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
  const [category, setCategory] = useState<string | null>(null)

  // Falling back to the first view rather than remembering one per folder means
  // moving between folders never lands on a view that belongs to another.
  const savedViews = views.data ?? []
  const activeView =
    savedViews.find((view) => view.id === chosenViewId) ?? savedViews[0] ?? null
  const settings = activeView === null ? DEFAULT_VIEW : settingsOf(activeView)

  const allScripts = [...(sortScripts.data ?? []), ...(groupScripts.data ?? [])]
  const arranged = useViewItems(items.data, settings, allScripts, category)
  const filling = useFillPending(items.data ?? [], collectionId)

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
        onSelect={(id) => {
          setChosenViewId(id)
          setCategory(null)
        }}
        onChange={(patch) => {
          // A category named by the previous script means nothing under the new
          // one, so narrowing is dropped rather than silently emptying the list.
          setCategory(null)
          changeView(patch)
        }}
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

      <CategoryChips
        categories={arranged.categories}
        selected={category}
        onSelect={setCategory}
      />

      {filling.stopped && (
        <p className="mt-3 text-sm text-accent">
          Gave up reading pages after several failures. Check the extractor is running, then
          reload.
        </p>
      )}

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
          <section key={group.label} className={group.label === '' ? '' : 'mt-5 first:mt-0'}>
            {group.label !== '' && category === null && (
              <h2 className="flex items-baseline gap-2 border-b border-line pb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {group.label}
                <span className="font-normal normal-case tracking-normal">
                  {group.items.length}
                </span>
              </h2>
            )}
            <ul
              className={
                settings.layout === 'grid'
                  ? 'grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 lg:grid-cols-4'
                  : 'divide-y divide-line'
              }
            >
              {group.items.map((item) => (
                <ItemRowView
                  key={item.id}
                  item={item}
                  collectionId={collectionId}
                  layout={settings.layout}
                  userId={userId}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}
