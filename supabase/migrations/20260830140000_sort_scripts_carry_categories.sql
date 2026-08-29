-- Let a sort script name categories as well as an order.
--
-- Ordering and bucketing are usually the same thought: "unread first" and "show
-- me unread and read separately" are one idea, and asking for two scripts to say
-- it made the second half feel like a separate feature nobody would find. A sort
-- script may now also export category(item), and the list turns what it returns
-- into chips you can click to narrow to.
--
-- The export is optional. A script without it sorts exactly as before.

update scripts set source = $js$/* The default: most recently saved at the top,
   split into what is still waiting and what is done. */
export function key(item) {
  return -item.createdAt
}

export function category(item) {
  return item.readState === 'read' ? 'Read' : 'Unread'
}
$js$ where is_builtin and kind = 'sort' and name = 'Newest first';

update scripts set source = $js$/* What has been waiting longest. */
export function key(item) {
  return item.createdAt
}

export function category(item) {
  return item.readState === 'read' ? 'Read' : 'Unread'
}
$js$ where is_builtin and kind = 'sort' and name = 'Oldest first';

update scripts set source = $js$/* Anything unread, newest first, then the rest. */
export function key(item) {
  const unread = item.readState === 'read' ? 1 : 0
  return [unread, -item.createdAt]
}

export function category(item) {
  if (item.readState === 'read') return 'Read'
  if (item.readState === 'reading') return 'Started'
  return 'Unread'
}
$js$ where is_builtin and kind = 'sort' and name = 'Unread first';

update scripts set source = $js$/* Flagged scraps rise to the top. */
export function key(item) {
  return [item.isImportant ? 0 : 1, -item.createdAt]
}

export function category(item) {
  return item.isImportant ? 'Important' : 'Everything else'
}
$js$ where is_builtin and kind = 'sort' and name = 'Important first';

update scripts set source = $js$/* Group a site together, newest first within it. */
export function key(item) {
  return [item.domain, -item.createdAt]
}

export function category(item) {
  return item.siteName ?? item.domain
}
$js$ where is_builtin and kind = 'sort' and name = 'By site';

update scripts set source = $js$/* Short reads first, for when there are ten minutes to spare.
   A scrap with no estimate returns null, which sorts it last. */
export function key(item) {
  return item.readingTimeMin
}

export function category(item) {
  if (item.readingTimeMin === null) return 'Length unknown'
  if (item.readingTimeMin <= 5) return 'Under 5 minutes'
  if (item.readingTimeMin <= 15) return '5 to 15 minutes'
  return 'Over 15 minutes'
}
$js$ where is_builtin and kind = 'sort' and name = 'Quickest to read';

update scripts set source = $js$/* Alphabetical, falling back to the address when a scrap has no title. */
export function key(item) {
  return (item.title ?? item.url).toLowerCase()
}

export function category(item) {
  const first = (item.title ?? item.url).trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(first) ? first : '#'
}
$js$ where is_builtin and kind = 'sort' and name = 'By title';
