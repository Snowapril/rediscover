import { useEffect, useState } from 'react'
import { groupByLabels, orderByKeys, type Group, type SortKey } from '@rediscover/core'
import { toScriptItem, type ItemRow, type ScriptRow, type ViewSettings } from '@rediscover/api-client'
import { runScript } from '@rediscover/script-engine'

export interface ViewItems {
  /*
   * @brief The scraps as the view asks for them, in one group when ungrouped.
   */
  groups: Group<ItemRow>[]
  grouped: boolean
  running: boolean
  /*
   * @brief Why the view is not showing what it was asked to, if it is not.
   */
  error: string | null
}

async function keysFor(
  script: ScriptRow,
  exportName: string,
  items: readonly ItemRow[],
): Promise<{ values: unknown[] } | { message: string }> {
  const outcome = await runScript(script.source, exportName, items.map((item) => toScriptItem(item)))
  return outcome.ok ? { values: outcome.values } : { message: outcome.message }
}

/*
 * @brief Apply a view's sort and grouping to a folder's scraps.
 * @details Both scripts run here rather than on the server, so the same sandbox
 *   produces the same arrangement on every device and changing a view costs no
 *   round trip. Sorting happens first and grouping preserves it, so a grouped
 *   view is still ordered inside each group.
 *
 *   A script that fails leaves the scraps as they arrived and says why: a broken
 *   view should look wrong, not empty.
 * @param items The scraps as the database returned them.
 * @param settings What the current view asks for.
 * @param scripts Every script available, to resolve the view's choices.
 * @return The arranged scraps, whether a run is in flight, and any failure.
 */
export function useViewItems(
  items: ItemRow[] | undefined,
  settings: ViewSettings,
  scripts: readonly ScriptRow[],
): ViewItems {
  const [groups, setGroups] = useState<Group<ItemRow>[] | null>(null)
  const [grouped, setGrouped] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortScript = scripts.find((script) => script.id === settings.sortScriptId) ?? null
  const groupScript = scripts.find((script) => script.id === settings.groupScriptId) ?? null

  useEffect(() => {
    if (items === undefined) return

    if (sortScript === null && groupScript === null) {
      setGroups(null)
      setGrouped(false)
      setError(null)
      return
    }

    let current = true
    setRunning(true)

    void (async () => {
      let ordered = items
      let failure: string | null = null

      if (sortScript !== null) {
        const keys = await keysFor(sortScript, 'key', items)
        if ('message' in keys) failure = keys.message
        else ordered = orderByKeys(items, keys.values as SortKey[], settings.sortDirection)
      }

      let arranged: Group<ItemRow>[] | null = null
      if (failure === null && groupScript !== null) {
        const labels = await keysFor(groupScript, 'group', ordered)
        if ('message' in labels) failure = labels.message
        else {
          arranged = groupByLabels(
            ordered,
            labels.values.map((value) => (typeof value === 'string' ? value : null)),
          )
        }
      }

      if (!current) return
      setError(failure)
      setGrouped(arranged !== null)
      setGroups(failure !== null ? null : (arranged ?? [{ label: '', items: ordered }]))
      setRunning(false)
    })()

    return () => {
      // A later view change may resolve first; ignoring the older run keeps the
      // list showing what was actually asked for.
      current = false
    }
  }, [items, sortScript, groupScript, settings.sortDirection])

  return {
    groups: groups ?? [{ label: '', items: items ?? [] }],
    grouped,
    running,
    error,
  }
}
