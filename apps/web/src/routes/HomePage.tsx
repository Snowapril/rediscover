import { lazy, Suspense, useState } from 'react'
import { useAuth } from '../auth/useAuth.ts'
import { useCollections } from '../data/queries.ts'
import { CollectionTree } from '../components/CollectionTree.tsx'
import { FolderMap } from '../components/FolderMap.tsx'
import { ImportView } from '../components/ImportView.tsx'
import { DueView } from '../components/DueView.tsx'
import { SearchView } from '../components/SearchView.tsx'
import { TodayView } from '../components/TodayView.tsx'
import { ItemList } from '../components/ItemList.tsx'

// The script editor brings a code editor with it, which is a lot to download for
// a screen most sessions never open. Split out so only opening it pays for it.
const ScriptsView = lazy(() =>
  import('../components/ScriptsView.tsx').then((module) => ({ default: module.ScriptsView })),
)
import { viewCollectionId, type View } from '../view.ts'

/*
 * @brief The signed-in shell: navigation on the left, the chosen view on the right.
 */
export function HomePage() {
  const { session, signOut } = useAuth()
  const collections = useCollections()
  const [view, setView] = useState<View>({ kind: 'today' })

  const userId = session?.user.id

  // Deleting a folder can remove the one being viewed, or an ancestor of it, so
  // the selection is checked against the folders that actually exist rather than
  // trusted. Only once they have loaded — until then an unknown id is not yet
  // known to be missing.
  const loaded = collections.data !== undefined
  const selected =
    view.kind === 'collection'
      ? collections.data?.find((collection) => collection.id === view.id)
      : undefined
  const current: View = loaded && view.kind === 'collection' && selected === undefined
    ? { kind: 'inbox' }
    : view

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <span className="text-sm font-semibold tracking-tight">rediscover</span>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="hidden sm:inline">{session?.user.email}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-line px-2 py-1 text-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-line p-4 md:w-64 md:border-b-0 md:border-r">
          {collections.isError ? (
            <p className="text-sm text-accent">Could not load folders.</p>
          ) : userId === undefined ? null : (
            <CollectionTree
              userId={userId}
              collections={collections.data ?? []}
              view={current}
              onSelect={setView}
            />
          )}
        </aside>

        <main className="min-w-0 flex-1">
          {userId !== undefined &&
            (current.kind === 'search' ? (
              <SearchView userId={userId} />
            ) : current.kind === 'today' ? (
              <TodayView />
            ) : current.kind === 'due' ? (
              <DueView />
            ) : current.kind === 'scripts' ? (
              <Suspense fallback={<p className="px-6 py-8 text-sm text-muted">Loading the editor…</p>}>
                <ScriptsView userId={userId} />
              </Suspense>
            ) : current.kind === 'import' ? (
              <ImportView userId={userId} onDone={setView} />
            ) : current.kind === 'folders' ? (
              <FolderMap collections={collections.data ?? []} onOpen={setView} />
            ) : (
              <ItemList
                userId={userId}
                collectionId={viewCollectionId(current)}
                collectionName={current.kind === 'inbox' ? 'Inbox' : (selected?.name ?? 'Folder')}
                onOpenCollection={(id) =>
                  setView(id === null ? { kind: 'inbox' } : { kind: 'collection', id })
                }
              />
            ))}
        </main>
      </div>
    </div>
  )
}
