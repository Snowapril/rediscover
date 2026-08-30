/*
 * @brief The date a scrap was saved.
 * @details A date rather than "3 days ago". Elapsed time answers "how stale is
 *   this", which the Due list is for; a list of scraps is being searched, and
 *   what a person remembers about something they saved is roughly when — the
 *   week of the conference, the evening they went down a rabbit hole. "47 days
 *   ago" has to be turned back into a date before it means anything.
 *
 *   The year is shown only when it is not the current one, so a library spanning
 *   years stays readable without repeating this year on every row. The locale is
 *   the reader's, so this reads as a date in their own convention.
 * @param iso When it was saved.
 * @param now The current moment, for deciding whether the year is worth saying.
 * @param locale Overrides the reader's locale; for tests.
 * @return A phrase like "30 Aug" or "12 Nov 2024".
 */
export function savedOn(iso: string, now: Date = new Date(), locale?: string): string {
  const saved = new Date(iso)
  if (Number.isNaN(saved.getTime())) return ''

  const thisYear = saved.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(thisYear ? {} : { year: 'numeric' }),
  }).format(saved)
}
