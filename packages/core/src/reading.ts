/*
 * @brief The fields choosing today's reading depends on.
 */
export interface ReadableItem {
  id: string
  createdAt: number
  readState: 'unread' | 'reading' | 'read'
  isImportant: boolean
  readingTimeMin: number | null
}

/*
 * @brief Why a scrap was put forward.
 * @details A tag rather than a sentence: the words belong with the interface,
 *   and the reason is worth showing — a shortlist that explains itself reads as
 *   considered, while three unexplained items read as random.
 */
export type PickReason = 'shortest' | 'oldest' | 'flagged' | 'chance'

export interface ReadingPick<T> {
  item: T
  reason: PickReason
}

/*
 * @brief A number generator that gives the same sequence for the same seed.
 * @details Today's shortlist has to survive a reload. Drawing again on every
 *   render would make it a slot machine rather than a queue, and nobody commits
 *   to reading something that might not be there when they come back.
 * @param seed Any string; the same string always yields the same sequence.
 * @return A function returning successive values in [0, 1).
 */
function seededRandom(seed: string): () => number {
  let state = 0x811c9dc5
  for (let index = 0; index < seed.length; index++) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 0x01000193)
  }

  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1)
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61)
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T]
  }
  return copy
}

/*
 * @brief A handful of scraps to actually read today.
 * @details The point is not to rank a library but to end the choosing. A person
 *   with hundreds of unread scraps does not fail to read because they cannot
 *   find a good one; they fail because picking from hundreds is itself the
 *   work. Three, with a reason each, removes that.
 *
 *   The reasons are deliberately different from one another, so the shortlist
 *   offers a choice rather than three of the same thing: one that fits a gap in
 *   the day, one that has been waiting longest and is closest to never being
 *   read, and one that was flagged as mattering. Anything left is filled at
 *   random — but the same random, for the whole day.
 * @param items Every scrap that could be read.
 * @param day The day being chosen for, as a plain date such as "2026-08-31".
 * @param count How many to put forward.
 * @return The shortlist, each with why it is there.
 */
export function chooseTodaysReading<T extends ReadableItem>(
  items: readonly T[],
  day: string,
  count = 3,
): ReadingPick<T>[] {
  const unread = items.filter((item) => item.readState !== 'read')
  if (unread.length === 0) return []

  const picks: ReadingPick<T>[] = []
  const taken = new Set<string>()

  const take = (candidate: T | undefined, reason: PickReason): void => {
    if (candidate === undefined) return
    if (taken.has(candidate.id)) return
    if (picks.length >= count) return
    taken.add(candidate.id)
    picks.push({ item: candidate, reason })
  }

  const byShortest = unread
    .filter((item) => item.readingTimeMin !== null)
    .sort((a, b) => (a.readingTimeMin as number) - (b.readingTimeMin as number))
  take(byShortest[0], 'shortest')

  const byOldest = [...unread].sort((a, b) => a.createdAt - b.createdAt)
  take(byOldest[0], 'oldest')

  const flagged = byOldest.filter((item) => item.isImportant)
  take(flagged[0], 'flagged')

  const random = seededRandom(day)
  for (const item of shuffled(unread, random)) {
    if (picks.length >= count) break
    take(item, 'chance')
  }

  return picks
}

export interface ReadingProgress {
  saved: number
  read: number
  unread: number
  /*
   * @brief Unread scraps older than the threshold.
   */
  stale: number
}

/*
 * @brief How much of what was saved has actually been read.
 * @details Counted rather than estimated, and shown plainly. A library that is
 *   nine tenths unread is worth knowing about; softening the number would be
 *   the same instinct that let it get that way.
 * @param items Every live scrap.
 * @param now The current moment, in milliseconds.
 * @param staleAfterDays How long a scrap may wait before it counts as stale.
 * @return The counts.
 */
export function readingProgress(
  items: readonly ReadableItem[],
  now: number,
  staleAfterDays = 30,
): ReadingProgress {
  const staleBefore = now - staleAfterDays * 86_400_000
  let read = 0
  let stale = 0

  for (const item of items) {
    if (item.readState === 'read') read++
    else if (item.createdAt < staleBefore) stale++
  }

  return { saved: items.length, read, unread: items.length - read, stale }
}
