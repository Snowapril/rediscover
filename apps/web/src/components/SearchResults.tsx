import type { ItemRow } from '@rediscover/api-client'
import type { SearchFilters } from '@rediscover/core'
import { narrowsAnything } from '@rediscover/core'
import { ItemRowView } from './ItemRowView.tsx'

interface Props {
  filters: SearchFilters
  results: { data: ItemRow[] | undefined; isPending: boolean; isError: boolean; error: unknown }
  userId: string
  emptyHint: string
}

/*
 * @brief What a search found, or why it found nothing.
 * @details The three empty states are different and are worth telling apart: not
 *   having asked yet, having asked and got nothing, and having narrowed so far
 *   that nothing could match. Showing one blank list for all three is how a
 *   search comes to feel broken.
 */
export function SearchResults({ filters, results, userId, emptyHint }: Props) {
  if (!narrowsAnything(filters)) {
    return <p className="mt-3 text-sm text-muted">{emptyHint}</p>
  }

  if (results.isError) {
    return <p className="mt-3 text-sm text-accent">The search failed. {String(results.error)}</p>
  }

  if (results.isPending) return <p className="mt-3 text-sm text-muted">Looking…</p>

  const found = results.data ?? []
  if (found.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted">
        {filters.text.trim() === ''
          ? 'Nothing matches those filters.'
          : `Nothing matches “${filters.text.trim()}”.`}
      </p>
    )
  }

  return (
    <>
      <p className="mt-3 text-sm text-muted">
        {found.length} {found.length === 1 ? 'result' : 'results'}
      </p>
      <ul className="mt-1 divide-y divide-line">
        {found.map((item) => (
          <ItemRowView
            key={item.id}
            item={item}
            // Results cross folders, so an edit refreshes the library rather
            // than one folder's list.
            collectionId={null}
            layout="list"
            userId={userId}
          />
        ))}
      </ul>
    </>
  )
}
