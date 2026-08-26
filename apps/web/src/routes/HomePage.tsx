import { useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { useCollections } from '../data/queries.js'
import { CollectionTree } from '../components/CollectionTree.js'
import { ItemList } from '../components/ItemList.js'

/*
 * @brief The signed-in shell: folders on the left, their scraps on the right.
 */
export function HomePage() {
  const { session, signOut } = useAuth()
  const collections = useCollections()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const userId = session?.user.id
  const selected = collections.data?.find((collection) => collection.id === selectedId)
  const collectionName = selectedId === null ? 'Inbox' : (selected?.name ?? 'Folder')

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
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </aside>

        <main className="min-w-0 flex-1">
          {userId !== undefined && (
            <ItemList userId={userId} collectionId={selectedId} collectionName={collectionName} />
          )}
        </main>
      </div>
    </div>
  )
}
