import { useState } from 'react'
import { NO_FILTERS, type SearchFilters } from '@rediscover/core'
import { useCollections, useSearchItems } from '../data/queries.ts'
import { SearchControls } from './SearchControls.tsx'
import { SearchResults } from './SearchResults.tsx'

/*
 * @brief Searching the whole library.
 * @details The reason this application exists is that things get saved and then
 *   lost, so this is not a secondary feature. It starts unnarrowed and looks
 *   everywhere; the same controls appear inside a folder, already scoped to it.
 * @param userId Owner, for the actions on each result.
 */
export function SearchView({ userId }: { userId: string }) {
  const [filters, setFilters] = useState<SearchFilters>(NO_FILTERS)
  const collections = useCollections()
  const results = useSearchItems(filters)

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Search</h1>

      <div className="mt-4">
        <SearchControls
          filters={filters}
          onChange={setFilters}
          collections={collections.data ?? []}
          showRecursive
          autoFocus
        />
      </div>

      <SearchResults
        filters={filters}
        results={results}
        userId={userId}
        emptyHint="Type something, or narrow by folder, status, kind or when you saved it."
      />
    </section>
  )
}
