import { useEffect, useState } from 'react'
import { orderByKeys, type SortKey } from '@rediscover/core'
import { toScriptItem, type ItemRow, type ScriptRow } from '@rediscover/api-client'
import { runScript } from '@rediscover/script-engine'

export interface SortOutcome {
  /*
   * @brief The scraps in the order the script asked for, or as they arrived
   *   while it is still running or if it failed.
   */
  items: ItemRow[]
  running: boolean
  /*
   * @brief Why the order is not the one that was asked for, if it is not.
   */
  error: string | null
}

/*
 * @brief Order a folder's scraps with a user script.
 * @details The script runs here rather than on the server so the same sandbox
 *   produces the order on every device, and so a folder reorders without a
 *   round trip. A script that fails leaves the scraps in the order they arrived
 *   and reports why, because a broken sort should not empty the folder.
 * @param items The scraps as the database returned them.
 * @param script The sort script to apply, or null to leave them as they came.
 * @param direction Which way to read the keys.
 * @return The ordered scraps, whether a run is in flight, and any failure.
 */
export function useSortedItems(
  items: ItemRow[] | undefined,
  script: ScriptRow | null,
  direction: 'asc' | 'desc' = 'asc',
): SortOutcome {
  const [ordered, setOrdered] = useState<ItemRow[] | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (items === undefined || script === null) {
      setOrdered(null)
      setError(null)
      return
    }

    let current = true
    setRunning(true)

    void runScript(script.source, 'key', items.map((item) => toScriptItem(item)))
      .then((outcome) => {
        if (!current) return
        if (!outcome.ok) {
          setError(outcome.message)
          setOrdered(null)
          return
        }
        setError(null)
        setOrdered(orderByKeys(items, outcome.values as SortKey[], direction))
      })
      .finally(() => {
        if (current) setRunning(false)
      })

    return () => {
      // A later selection may resolve first; ignoring the older run keeps the
      // list showing what was actually asked for.
      current = false
    }
  }, [items, script, direction])

  return { items: ordered ?? items ?? [], running, error }
}
