import { useEffect, useState } from 'react'
import { groupByLabels, orderByKeys, type Group, type SortKey } from '@rediscover/core'
import { toScriptItem, type ItemRow, type ScriptRow, type ViewSettings } from '@rediscover/api-client'
import { runExports, type ExportSpec } from '@rediscover/script-engine'

export interface ViewItems {
  /*
   * @brief The scraps as the view asks for them, in one unnamed group when
   *   nothing categorises them.
   */
  groups: Group<ItemRow>[]
  /*
   * @brief Every category the scraps fall into, in the order they first appear,
   *   with how many are in each. Empty when nothing categorises them.
   */
  categories: { label: string; count: number }[]
  running: boolean
  /*
   * @brief Why the view is not showing what it was asked to, if it is not.
   */
  error: string | null
}

/*
 * @brief What the scripts produced, before a category is chosen.
 * @details Held separately from the filtered result so that clicking a category
 *   only re-slices what is already computed. Re-running the sandbox to hide a
 *   few rows would be work for nothing.
 */
interface Arrangement {
  ordered: ItemRow[]
  grouped: Group<ItemRow>[] | null
  error: string | null
}

const NOTHING: Arrangement = { ordered: [], grouped: null, error: null }

/*
 * @brief Arrange a folder's scraps the way its view asks.
 * @details Ordering and categorising are usually one thought — "unread first"
 *   and "keep unread separate from read" are the same idea — so a sort script
 *   may export `category` alongside `key`, and both run in a single pass of the
 *   sandbox. A separate group script still wins when one is chosen, for the
 *   times the two really are different questions.
 *
 *   Sorting happens before categorising and categorising preserves it, so a
 *   split list is still ordered inside each part. Selecting one category
 *   narrows to it; selecting none shows them all, separated.
 *
 *   A script that fails leaves the scraps as they arrived and says why: a broken
 *   view should look wrong, not empty.
 * @param items The scraps as the database returned them.
 * @param settings What the current view asks for.
 * @param scripts Every script available, to resolve the view's choices.
 * @param selectedCategory The category to narrow to, or null for all of them.
 * @return The arranged scraps, the categories on offer, and any failure.
 */
export function useViewItems(
  items: ItemRow[] | undefined,
  settings: ViewSettings,
  scripts: readonly ScriptRow[],
  selectedCategory: string | null,
): ViewItems {
  const [arrangement, setArrangement] = useState<Arrangement>(NOTHING)
  const [running, setRunning] = useState(false)

  const sortScript = scripts.find((script) => script.id === settings.sortScriptId) ?? null
  const groupScript = scripts.find((script) => script.id === settings.groupScriptId) ?? null

  useEffect(() => {
    if (items === undefined) return

    if (sortScript === null && groupScript === null) {
      setArrangement({ ordered: items, grouped: null, error: null })
      return
    }

    let current = true
    setRunning(true)

    void (async () => {
      let ordered = items
      let labels: (string | null)[] | null = null
      let failure: string | null = null

      if (sortScript !== null) {
        const wanted: ExportSpec[] = [
          { name: 'key', kind: 'sortKey', required: true },
          { name: 'category', kind: 'label', required: false },
        ]
        const outcome = await runExports(sortScript.source, wanted, items.map((item) => toScriptItem(item)))
        if (!outcome.ok) failure = outcome.message
        else {
          ordered = orderByKeys(items, outcome.values['key'] as SortKey[], settings.sortDirection)
          const fromSort = outcome.values['category']
          if (fromSort !== undefined) {
            // Reordering happened after the categories were computed, so they
            // are looked up per scrap rather than by position.
            const byId = new Map(items.map((item, index) => [item.id, fromSort[index]]))
            labels = ordered.map((item) => (byId.get(item.id) as string | null | undefined) ?? null)
          }
        }
      }

      if (failure === null && groupScript !== null) {
        const outcome = await runExports(
          groupScript.source,
          [{ name: 'group', kind: 'label', required: true }],
          ordered.map((item) => toScriptItem(item)),
        )
        if (!outcome.ok) failure = outcome.message
        else labels = outcome.values['group'] as (string | null)[]
      }

      if (!current) return

      if (failure !== null) {
        setArrangement({ ordered: items, grouped: null, error: failure })
        setRunning(false)
        return
      }

      setArrangement({
        ordered,
        grouped: labels === null ? null : groupByLabels(ordered, labels, 'Uncategorised'),
        error: null,
      })
      setRunning(false)
    })()

    return () => {
      // A later view change may resolve first; ignoring the older run keeps the
      // list showing what was actually asked for.
      current = false
    }
    // Deliberately not depending on the chosen category: narrowing slices the
    // arrangement below rather than asking the scripts again.
  }, [items, sortScript, groupScript, settings.sortDirection])

  const { ordered, grouped, error } = arrangement

  return {
    groups:
      grouped === null
        ? [{ label: '', items: ordered }]
        : selectedCategory === null
          ? grouped
          : grouped.filter((group) => group.label === selectedCategory),
    categories:
      grouped === null
        ? []
        : grouped.map((group) => ({ label: group.label, count: group.items.length })),
    running,
    error,
  }
}
