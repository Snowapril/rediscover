import type { ItemRow } from '@rediscover/api-client'

/*
 * @brief How many pages are read at once.
 * @details Each is a request the server makes on the user's behalf, so a few at
 *   a time keeps a folder filling in visibly without turning the act of opening
 *   it into a burst of traffic.
 */
export const FILL_CONCURRENCY = 3

/*
 * @brief How many reads may fail in a row before the app stops trying.
 * @details A page that cannot be read is ordinary; the extractor being
 *   unreachable is not, and it looks the same from here. Without a stop, opening
 *   a folder while it is down would march through the whole library marking
 *   everything failed.
 */
export const FILL_FAILURE_LIMIT = 4

/*
 * @brief Which scraps to read next.
 * @details Only what is already on screen: the folder being looked at is the one
 *   worth filling in first, and it bounds the work without needing a queue.
 *   Scraps already being read are skipped so a re-render does not start them
 *   again.
 * @param items The scraps currently shown.
 * @param inFlight Ids already being read.
 * @param limit How many may be read at once, in total.
 * @return The scraps to start on, oldest first.
 */
export function nextToFill(
  items: readonly ItemRow[],
  inFlight: ReadonlySet<string>,
  limit: number = FILL_CONCURRENCY,
): ItemRow[] {
  const room = limit - inFlight.size
  if (room <= 0) return []

  const waiting = items.filter(
    (item) => item.extract_status === 'pending' && !inFlight.has(item.id),
  )
  return waiting.slice(0, room)
}
