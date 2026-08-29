-- The sort and group scripts every account starts with.
--
-- They are rows rather than hard-coded options because the point of the feature
-- is that a user can read how the ordering they use is defined, and fork it.
-- Owned by nobody (user_id null) so row level security lets everyone read them
-- and nobody write them; editing one means forking it into a row of your own.

insert into scripts (user_id, name, kind, source, is_builtin) values
  (null, 'Newest first', 'sort', $js$/* The default: most recently saved at the top. */
export function key(item) {
  return -item.createdAt
}
$js$, true),

  (null, 'Oldest first', 'sort', $js$/* What has been waiting longest. */
export function key(item) {
  return item.createdAt
}
$js$, true),

  (null, 'Unread first', 'sort', $js$/* Anything unread, newest first, then the rest. */
export function key(item) {
  const unread = item.readState === 'read' ? 1 : 0
  return [unread, -item.createdAt]
}
$js$, true),

  (null, 'Important first', 'sort', $js$/* Flagged scraps rise to the top. */
export function key(item) {
  return [item.isImportant ? 0 : 1, -item.createdAt]
}
$js$, true),

  (null, 'By title', 'sort', $js$/* Alphabetical, falling back to the address when a scrap has no title. */
export function key(item) {
  return (item.title ?? item.url).toLowerCase()
}
$js$, true),

  (null, 'By site', 'sort', $js$/* Group a site together, newest first within it. */
export function key(item) {
  return [item.domain, -item.createdAt]
}
$js$, true),

  (null, 'Quickest to read', 'sort', $js$/* Short reads first, for when there are ten minutes to spare.
   A scrap with no estimate returns null, which sorts it last. */
export function key(item) {
  return item.readingTimeMin
}
$js$, true),

  (null, 'By site', 'group', $js$/* One group per site. */
export function group(item) {
  return item.siteName ?? item.domain
}
$js$, true),

  (null, 'Read and unread', 'group', $js$/* Two piles. */
export function group(item) {
  return item.readState === 'read' ? 'Read' : 'Still to read'
}
$js$, true),

  (null, 'By month saved', 'group', $js$/* Calendar months, newest scraps naming the group they land in. */
export function group(item) {
  const when = new Date(item.createdAt)
  const month = String(when.getUTCMonth() + 1).padStart(2, '0')
  return when.getUTCFullYear() + '-' + month
}
$js$, true);
