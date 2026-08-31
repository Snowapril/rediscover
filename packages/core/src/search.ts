import type { MediaType, ReadState } from './types.ts'

/*
 * @brief Where a search looks.
 * @details A kind alongside the id, because a null folder already means the
 *   inbox everywhere else, and "the inbox" and "anywhere" are different
 *   questions.
 */
export type SearchScope =
  | { kind: 'all' }
  | { kind: 'inbox' }
  | { kind: 'folder'; id: string; includeSubfolders: boolean }

/*
 * @brief How far back a search reaches.
 * @details Offered as spans rather than two dates, because what a person
 *   remembers is "some time last year", not a pair of calendar days.
 */
export type SavedWithin = 'any' | 'week' | 'month' | 'quarter' | 'year' | 'older'

export const SAVED_WITHIN: { value: SavedWithin; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: 'quarter', label: 'Past 3 months' },
  { value: 'year', label: 'Past year' },
  { value: 'older', label: 'Over a year ago' },
]

export interface SearchFilters {
  text: string
  scope: SearchScope
  states: ReadState[]
  kinds: MediaType[]
  flaggedOnly: boolean
  savedWithin: SavedWithin
}

export const NO_FILTERS: SearchFilters = {
  text: '',
  scope: { kind: 'all' },
  states: [],
  kinds: [],
  flaggedOnly: false,
  savedWithin: 'any',
}

/*
 * @brief A search that starts inside one folder.
 * @param collectionId The folder, or null for the inbox.
 * @return Filters scoped to it and otherwise empty.
 */
export function filtersWithin(collectionId: string | null): SearchFilters {
  return {
    ...NO_FILTERS,
    scope:
      collectionId === null
        ? { kind: 'inbox' }
        : { kind: 'folder', id: collectionId, includeSubfolders: false },
  }
}

/*
 * @brief Whether these filters narrow anything at all.
 * @details A search that narrows nothing is a request for the whole library,
 *   which the folder views already answer better than a result list can. Asking
 *   this before searching is also what keeps an empty box from looking like a
 *   library with nothing in it.
 * @param filters The filters to judge.
 * @return True if the search is worth running.
 */
export function narrowsAnything(filters: SearchFilters): boolean {
  return (
    filters.text.trim() !== '' ||
    filters.scope.kind !== 'all' ||
    filters.states.length > 0 ||
    filters.kinds.length > 0 ||
    filters.flaggedOnly ||
    filters.savedWithin !== 'any'
  )
}

/*
 * @brief How many narrowings are in force, not counting the words.
 * @details Shown on the control that reveals the filters, so a search narrowed
 *   by something out of sight still says so.
 * @param filters The filters to count.
 * @return The number of active filters.
 */
export function activeFilterCount(filters: SearchFilters): number {
  let count = 0
  if (filters.scope.kind !== 'all') count++
  if (filters.states.length > 0) count++
  if (filters.kinds.length > 0) count++
  if (filters.flaggedOnly) count++
  if (filters.savedWithin !== 'any') count++
  return count
}

const DAY_MS = 86_400_000

const SPAN_DAYS: Record<Exclude<SavedWithin, 'any' | 'older'>, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
}

/*
 * @brief The window a span describes.
 * @details "Over a year ago" is the only one that is a ceiling rather than a
 *   floor, which is the point of having it: the scraps most likely to be lost
 *   are the oldest, and every other span excludes them.
 * @param within The span chosen.
 * @param now The current moment, in milliseconds.
 * @return The bounds, either of which may be absent.
 */
export function savedWindow(
  within: SavedWithin,
  now: number,
): { after: Date | null; before: Date | null } {
  if (within === 'any') return { after: null, before: null }
  if (within === 'older') return { after: null, before: new Date(now - 365 * DAY_MS) }
  return { after: new Date(now - SPAN_DAYS[within] * DAY_MS), before: null }
}
