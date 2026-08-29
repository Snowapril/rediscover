import type { Database } from '@rediscover/db/generated'
import type { RediscoverClient } from './client.ts'
import { unwrap, unwrapVoid } from './result.ts'

export type ViewRow = Database['public']['Tables']['views']['Row']
export type SortDirection = Database['public']['Enums']['sort_direction']
export type ViewLayout = Database['public']['Enums']['view_layout']

/*
 * @brief The settings a view holds, without the row it lives in.
 * @details The tabs work the same whether a folder has saved views or is still
 *   showing the unsaved default, so both are described by this.
 */
export interface ViewSettings {
  sortScriptId: string | null
  sortDirection: SortDirection
  groupScriptId: string | null
  layout: ViewLayout
}

/*
 * @brief What a folder shows before anyone has saved a view for it.
 * @details Newest first, ungrouped — the order the database already returns, so
 *   an untouched folder costs no script run at all.
 */
export const DEFAULT_VIEW: ViewSettings = {
  sortScriptId: null,
  sortDirection: 'asc',
  groupScriptId: null,
  layout: 'card',
}

export function settingsOf(view: ViewRow): ViewSettings {
  return {
    sortScriptId: view.sort_script_id,
    sortDirection: view.sort_direction,
    groupScriptId: view.group_script_id,
    layout: view.layout,
  }
}

/*
 * @brief The views saved for one folder.
 * @param client A signed-in client.
 * @param collectionId The folder, or null for the inbox.
 * @return The views in the order their tabs should appear.
 */
export async function listViews(
  client: RediscoverClient,
  collectionId: string | null,
): Promise<ViewRow[]> {
  const query = client.from('views').select('*')
  const scoped =
    collectionId === null ? query.is('collection_id', null) : query.eq('collection_id', collectionId)
  return unwrap(await scoped.order('position'))
}

/*
 * @brief Save a view for a folder.
 * @param client A signed-in client.
 * @param input Owner, folder, name, place among the tabs, and settings.
 * @return The created view.
 */
export async function createView(
  client: RediscoverClient,
  input: {
    userId: string
    collectionId: string | null
    name: string
    position: number
  } & Partial<ViewSettings>,
): Promise<ViewRow> {
  const settings = { ...DEFAULT_VIEW, ...input }
  return unwrap(
    await client
      .from('views')
      .insert({
        user_id: input.userId,
        collection_id: input.collectionId,
        name: input.name,
        position: input.position,
        sort_script_id: settings.sortScriptId,
        sort_direction: settings.sortDirection,
        group_script_id: settings.groupScriptId,
        layout: settings.layout,
      })
      .select()
      .single(),
  )
}

/*
 * @brief Change what a view shows.
 * @param client A signed-in client.
 * @param id The view to change.
 * @param settings The settings to apply; omitted ones are left alone.
 */
export async function updateView(
  client: RediscoverClient,
  id: string,
  settings: Partial<ViewSettings & { name: string }>,
): Promise<void> {
  const patch: Database['public']['Tables']['views']['Update'] = {}
  if (settings.name !== undefined) patch.name = settings.name
  if (settings.sortScriptId !== undefined) patch.sort_script_id = settings.sortScriptId
  if (settings.sortDirection !== undefined) patch.sort_direction = settings.sortDirection
  if (settings.groupScriptId !== undefined) patch.group_script_id = settings.groupScriptId
  if (settings.layout !== undefined) patch.layout = settings.layout

  if (Object.keys(patch).length === 0) return
  unwrapVoid(await client.from('views').update(patch).eq('id', id))
}

/*
 * @brief Remove a view.
 * @details Its scraps are untouched; a view is only a way of looking at them.
 * @param client A signed-in client.
 * @param id The view to remove.
 */
export async function deleteView(client: RediscoverClient, id: string): Promise<void> {
  unwrapVoid(await client.from('views').delete().eq('id', id))
}
