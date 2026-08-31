/*
 * @brief What the main pane is showing.
 * @details The sidebar will grow entries that are not folders, so the selection
 *   is a tagged union rather than a folder id that overloads null to mean the
 *   inbox.
 */
export type View =
  | { kind: 'today' }
  | { kind: 'inbox' }
  | { kind: 'collection'; id: string }
  | { kind: 'folders' }
  | { kind: 'due' }
  | { kind: 'import' }
  | { kind: 'scripts' }

/*
 * @brief The folder a view is looking at, in the form the queries take.
 * @param view The current view.
 * @return The collection id, or null for the inbox; null too for views that are
 *   not a list of scraps.
 */
export function viewCollectionId(view: View): string | null {
  return view.kind === 'collection' ? view.id : null
}
