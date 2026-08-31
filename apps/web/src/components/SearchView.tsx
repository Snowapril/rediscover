import { useEffect, useState } from 'react'
import { useSearchItems } from '../data/queries.ts'
import { ItemRowView } from './ItemRowView.tsx'

/*
 * @brief Find a scrap again.
 * @details The reason the library exists is that things saved get lost, so this
 *   is not a secondary feature. It searches what is written on a scrap — its
 *   title, the note you left, the excerpt taken from the page, the site and the
 *   address — because any of those may be the only part you remember.
 * @param userId Owner, for the actions on each result.
 * @param onOpenCollection Called when a result's folder should be opened.
 */
export function SearchView({
  userId,
  onOpenCollection,
}: {
  userId: string
  onOpenCollection(id: string | null): void
}) {
  const [typed, setTyped] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    // Waiting a moment before asking: a search runs against the whole library,
    // and every keystroke of "vulkan" would be six of them for one answer.
    const timer = setTimeout(() => setQuery(typed), 250)
    return () => clearTimeout(timer)
  }, [typed])

  const results = useSearchItems(query)
  const asked = query.trim() !== ''

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Search</h1>

      <input
        type="search"
        autoFocus
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        placeholder="A word from the title, your note, or the site"
        className="mt-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
      />

      {!asked && (
        <p className="mt-3 text-sm text-muted">
          Searches titles, notes, excerpts, sites and addresses.
        </p>
      )}

      {asked && (
        <p className="mt-3 text-sm text-muted">
          {results.isPending
            ? 'Looking…'
            : results.data?.length === 0
              ? `Nothing matches “${query}”.`
              : `${results.data?.length} ${results.data?.length === 1 ? 'result' : 'results'}`}
        </p>
      )}

      {results.isError && (
        <p className="mt-3 text-sm text-accent">The search failed. {String(results.error)}</p>
      )}

      <ul className="mt-2 divide-y divide-line">
        {results.data?.map((item) => (
          <ItemRowView
            key={item.id}
            item={item}
            // Results span folders, so an edit here refreshes the whole library
            // rather than one folder's list.
            collectionId={null}
            layout="list"
            userId={userId}
          />
        ))}
      </ul>

      {asked && results.data !== undefined && results.data.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenCollection(null)}
          className="mt-4 text-sm text-muted underline underline-offset-4"
        >
          Back to the inbox
        </button>
      )}
    </section>
  )
}
