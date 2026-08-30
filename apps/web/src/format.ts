/*
 * @brief The language the interface is written in.
 * @details Every string in this application is English, so dates are formatted
 *   in English too. Left to the reader's own locale, a date renders in their
 *   convention while the words beside it do not — "saved 8월 12일" on a line
 *   that also says "min read" reads as something broken rather than as a
 *   courtesy. When the interface itself becomes translatable, this is the single
 *   place that changes, and dates follow the words rather than diverging from
 *   them.
 */
const INTERFACE_LOCALE = 'en-GB'

/*
 * @brief The date a scrap was saved.
 * @details A date rather than "3 days ago". Elapsed time answers "how stale is
 *   this", which the Due list is for; a list of scraps is being searched, and
 *   what a person remembers about something they saved is roughly when — the
 *   week of the conference, the evening they went down a rabbit hole. "47 days
 *   ago" has to be turned back into a date before it means anything.
 *
 *   The year is shown only when it is not the current one, so a library spanning
 *   years stays readable without repeating this year on every row.
 * @param iso When it was saved.
 * @param now The current moment, for deciding whether the year is worth saying.
 * @param locale Overrides the interface language; for tests.
 * @return A phrase like "12 Aug" or "12 Nov 2024".
 */
export function savedOn(iso: string, now: Date = new Date(), locale: string = INTERFACE_LOCALE): string {
  const saved = new Date(iso)
  if (Number.isNaN(saved.getTime())) return ''

  const thisYear = saved.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(thisYear ? {} : { year: 'numeric' }),
  }).format(saved)
}
