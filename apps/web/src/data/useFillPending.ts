import { useEffect, useRef, useState } from 'react'
import { extractIntoItem, type ItemRow } from '@rediscover/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase.ts'
import { FILL_FAILURE_LIMIT, nextToFill } from './fillQueue.ts'

/*
 * @brief Read the pages of scraps that have never been read.
 * @details Imported scraps arrive with whatever the export carried and nothing
 *   else — no site name, no reading time, no author. Rather than a queue or a
 *   scheduled job, the folder being looked at is what gets filled in: a few at a
 *   time, only what is on screen, so opening a folder quietly completes it.
 *
 *   It stops after several consecutive failures. A page that cannot be read is
 *   ordinary, but the extractor being unreachable looks identical from here, and
 *   without a stop the first folder opened while it is down would march through
 *   the library marking everything failed.
 * @param items The scraps currently shown.
 * @param collectionId The folder they are in, so the list refreshes as they fill.
 * @return How many are being read right now, and whether it has given up.
 */
export function useFillPending(
  items: readonly ItemRow[],
  collectionId: string | null,
): { filling: number; stopped: boolean } {
  const client = useQueryClient()
  const inFlight = useRef<Set<string>>(new Set())
  const failures = useRef(0)
  const [filling, setFilling] = useState(0)
  const [stopped, setStopped] = useState(false)

  useEffect(() => {
    if (stopped) return

    const starting = nextToFill(items, inFlight.current)
    if (starting.length === 0) return

    for (const item of starting) inFlight.current.add(item.id)
    setFilling(inFlight.current.size)

    for (const item of starting) {
      void extractIntoItem(supabase, item)
        .then((filled) => {
          failures.current = filled.extract_status === 'failed' ? failures.current + 1 : 0
          if (failures.current >= FILL_FAILURE_LIMIT) setStopped(true)
        })
        .catch(() => {
          failures.current += 1
          if (failures.current >= FILL_FAILURE_LIMIT) setStopped(true)
        })
        .finally(() => {
          inFlight.current.delete(item.id)
          setFilling(inFlight.current.size)
          void client.invalidateQueries({ queryKey: ['items', collectionId] })
          void client.invalidateQueries({ queryKey: ['item-summaries'] })
        })
    }
  }, [items, collectionId, stopped, client])

  return { filling, stopped }
}
