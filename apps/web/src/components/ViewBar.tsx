import { useState } from 'react'
import type { ScriptRow, ViewRow, ViewSettings } from '@rediscover/api-client'

interface Props {
  views: ViewRow[]
  activeId: string | null
  settings: ViewSettings
  sortScripts: readonly ScriptRow[]
  groupScripts: readonly ScriptRow[]
  busy: boolean
  onSelect(id: string | null): void
  onChange(settings: Partial<ViewSettings>): void
  onAdd(name: string): void
  onRemove(id: string): void
}

const tab = 'rounded-md px-2.5 py-1 text-sm'
const control = 'rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink'

/*
 * @brief The tabs and controls above a folder's scraps.
 * @details A folder with no saved views still shows one tab — the unsaved
 *   default. Changing anything on it is what turns it into a real view, so the
 *   common case of never wanting more than one ordering costs nothing, and
 *   wanting a second is one click away rather than a separate concept to learn.
 * @param views The views saved for this folder.
 * @param activeId The view being shown, or null for the unsaved default.
 * @param settings What that view asks for.
 * @param sortScripts Sort scripts to choose from.
 * @param groupScripts Group scripts to choose from.
 * @param busy Whether a script is running right now.
 * @param onSelect Called with the view to switch to.
 * @param onChange Called with the settings that changed.
 * @param onAdd Called with the name of a view to create.
 * @param onRemove Called with the view to delete.
 */
export function ViewBar(props: Props) {
  const { views, activeId, settings, busy } = props
  const [naming, setNaming] = useState(false)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
      <div className="flex flex-wrap items-center gap-1">
        {views.length === 0 && (
          <span className={`${tab} bg-line font-medium`} title="Change anything to save this view">
            Default
          </span>
        )}

        {views.map((view) => (
          <span key={view.id} className="group/tab flex items-center">
            <button
              type="button"
              onClick={() => props.onSelect(view.id)}
              className={`${tab} ${
                activeId === view.id ? 'bg-line font-medium' : 'text-muted hover:bg-line/60'
              }`}
            >
              {view.name}
            </button>
            {activeId === view.id && views.length > 1 && (
              <button
                type="button"
                aria-label={`Remove the ${view.name} view`}
                title="Remove this view"
                onClick={() => props.onRemove(view.id)}
                className="rounded px-1 text-xs text-muted opacity-0 group-hover/tab:opacity-100"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {naming ? (
          <input
            autoFocus
            placeholder="View name"
            onBlur={(event) => {
              setNaming(false)
              const name = event.target.value.trim()
              if (name !== '') props.onAdd(name)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                event.currentTarget.value = ''
                event.currentTarget.blur()
              }
            }}
            className="w-28 rounded-md border border-accent bg-surface px-2 py-1 text-sm outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            title="Add a view"
            className={`${tab} text-muted hover:bg-line/60`}
          >
            +
          </button>
        )}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted">
        {busy && <span>arranging…</span>}

        <label className="flex items-center gap-1.5">
          Sort
          <select
            value={settings.sortScriptId ?? ''}
            onChange={(event) =>
              props.onChange({ sortScriptId: event.target.value === '' ? null : event.target.value })
            }
            className={control}
          >
            <option value="">Newest first</option>
            {props.sortScripts.map((script) => (
              <option key={script.id} value={script.id}>
                {script.name}
                {script.is_builtin ? '' : ' (yours)'}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          title={settings.sortDirection === 'asc' ? 'Reverse the order' : 'Back to the script order'}
          onClick={() =>
            props.onChange({ sortDirection: settings.sortDirection === 'asc' ? 'desc' : 'asc' })
          }
          className={`${control} ${settings.sortDirection === 'desc' ? 'text-accent' : ''}`}
        >
          {settings.sortDirection === 'asc' ? '↓' : '↑'}
        </button>

        <label className="flex items-center gap-1.5">
          Group
          <select
            value={settings.groupScriptId ?? ''}
            onChange={(event) =>
              props.onChange({
                groupScriptId: event.target.value === '' ? null : event.target.value,
              })
            }
            className={control}
          >
            <option value="">None</option>
            {props.groupScripts.map((script) => (
              <option key={script.id} value={script.id}>
                {script.name}
                {script.is_builtin ? '' : ' (yours)'}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
