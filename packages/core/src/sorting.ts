/*
 * @brief What a sort script may return for a scrap.
 * @details Scalars compare directly; an array compares element by element, which
 *   is how a script says "by this, then by that".
 */
export type SortKey = number | string | boolean | null | readonly SortKey[]

export type SortDirection = 'asc' | 'desc'

/*
 * @brief Rank of each kind of key, so mixed keys still order predictably.
 * @details A script that returns a number for some scraps and a string for
 *   others is probably a mistake, but it should not produce a different order
 *   depending on which pair happened to be compared first.
 */
function rank(value: Exclude<SortKey, null>): number {
  if (typeof value === 'number') return 0
  if (typeof value === 'string') return 1
  if (typeof value === 'boolean') return 2
  return 3
}

/*
 * @brief Compare two sort keys.
 * @details Strings compare by code point rather than by locale. A user's
 *   scripts follow their account to every device, and the whole point is that a
 *   folder looks the same on all of them; locale-aware collation would order
 *   the same two titles differently depending on the machine's language
 *   settings and its version of the collation tables.
 *
 *   Nulls are not handled here — callers put them last regardless of direction,
 *   which is what "sort by a field some scraps do not have" is asking for.
 * @param a The first key.
 * @param b The second key.
 * @return Negative, zero, or positive in the usual comparison sense.
 */
export function compareSortKeys(a: Exclude<SortKey, null>, b: Exclude<SortKey, null>): number {
  const rankA = rank(a)
  const rankB = rank(b)
  if (rankA !== rankB) return rankA - rankB

  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1
  }

  const listA = a as readonly SortKey[]
  const listB = b as readonly SortKey[]
  const shared = Math.min(listA.length, listB.length)
  for (let index = 0; index < shared; index++) {
    const left = listA[index] as SortKey
    const right = listB[index] as SortKey
    if (left === null && right === null) continue
    if (left === null) return 1
    if (right === null) return -1
    const step = compareSortKeys(left, right)
    if (step !== 0) return step
  }
  return listA.length - listB.length
}

/*
 * @brief Put scraps in the order their keys describe.
 * @details Scraps whose key is null go last whichever way the sort runs: a key
 *   of null means the script found nothing to sort this scrap by, and burying
 *   those is more useful than letting the direction decide whether they lead.
 *
 *   The sort is stable, and reversing the direction does not shuffle ties: the
 *   comparison is negated but the fallback to the original order is not.
 * @param items The scraps, in whatever order they arrived.
 * @param keys One key per scrap, in the same order.
 * @param direction Which way round to read the keys.
 * @return The scraps, ordered.
 */
export function orderByKeys<T>(
  items: readonly T[],
  keys: readonly SortKey[],
  direction: SortDirection = 'asc',
): T[] {
  const sign = direction === 'desc' ? -1 : 1

  return items
    .map((item, index) => ({ item, key: keys[index] ?? null, index }))
    .sort((a, b) => {
      if (a.key === null && b.key === null) return a.index - b.index
      if (a.key === null) return 1
      if (b.key === null) return -1
      const step = compareSortKeys(a.key, b.key)
      return step === 0 ? a.index - b.index : step * sign
    })
    .map((entry) => entry.item)
}

export interface Group<T> {
  label: string
  items: T[]
}

/*
 * @brief Gather scraps under the labels a group script gave them.
 * @details Groups appear in the order their first member does, so regrouping an
 *   already-sorted list does not throw away the sort. A scrap the script gave no
 *   label to is collected at the end rather than dropped, because a scrap
 *   missing from the folder it belongs to is worse than one in an "everything
 *   else" pile.
 * @param items The scraps, already in the order they should appear.
 * @param labels One label per scrap, in the same order; null for ungrouped.
 * @param fallbackLabel What to call the group holding the unlabelled scraps.
 * @return The groups, in order of first appearance.
 */
export function groupByLabels<T>(
  items: readonly T[],
  labels: readonly (string | null)[],
  fallbackLabel = 'Everything else',
): Group<T>[] {
  const groups = new Map<string, Group<T>>()
  let unlabelled: Group<T> | null = null

  for (const [index, item] of items.entries()) {
    const label = labels[index] ?? null

    if (label === null) {
      unlabelled ??= { label: fallbackLabel, items: [] }
      unlabelled.items.push(item)
      continue
    }

    const existing = groups.get(label)
    if (existing === undefined) groups.set(label, { label, items: [item] })
    else existing.items.push(item)
  }

  const ordered = [...groups.values()]
  if (unlabelled !== null) ordered.push(unlabelled)
  return ordered
}
