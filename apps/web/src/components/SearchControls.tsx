import { useState } from 'react'
import {
  activeFilterCount,
  SAVED_WITHIN,
  type MediaType,
  type ReadState,
  type SavedWithin,
  type SearchFilters,
} from '@rediscover/core'
import type { CollectionRow } from '@rediscover/api-client'

const STATES: { value: ReadState; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Started' },
  { value: 'read', label: 'Read' },
]

const KINDS: { value: MediaType; label: string }[] = [
  { value: 'article', label: 'Article' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'pdf', label: 'PDF' },
  { value: 'link', label: 'Link' },
]

const chip = 'rounded-full border px-2.5 py-0.5 text-xs'

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick(): void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`${chip} ${
        on ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-line-strong'
      }`}
    >
      {children}
    </button>
  )
}

interface Props {
  filters: SearchFilters
  onChange(filters: SearchFilters): void
  /*
   * @brief Folders to choose from; omitted where the scope is fixed.
   */
  collections?: CollectionRow[]
  /*
   * @brief Whether the folder this search started in can include its subfolders.
   */
  showRecursive?: boolean
  placeholder?: string
  autoFocus?: boolean
}

/*
 * @brief The search box and the ways of narrowing it.
 * @details One component for both the library-wide search and the one inside a
 *   folder, because they are the same question asked at different starting
 *   points. Two of these would drift, and a filter that behaved differently
 *   depending on where it was opened would be worse than not having it.
 *
 *   The filters are folded away by default, with a count on the control, so a
 *   search narrowed by something out of sight still says so.
 */
export function SearchControls({
  filters,
  onChange,
  collections,
  showRecursive = false,
  placeholder = 'A word from the title, your note, or the site',
  autoFocus = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const narrowed = activeFilterCount(filters)

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          autoFocus={autoFocus}
          value={filters.text}
          onChange={(event) => onChange({ ...filters, text: event.target.value })}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`shrink-0 rounded-lg border px-3 py-2 text-xs ${
            narrowed > 0 ? 'border-accent text-accent' : 'border-line text-muted'
          }`}
        >
          Filters{narrowed > 0 && ` · ${narrowed}`}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-lg border border-line bg-surface p-3">
          {collections !== undefined && (
            <Row label="Folder">
              <select
                value={filters.scope.kind === 'folder' ? filters.scope.id : filters.scope.kind}
                onChange={(event) => {
                  const value = event.target.value
                  onChange({
                    ...filters,
                    scope:
                      value === 'all' || value === 'inbox'
                        ? { kind: value }
                        : { kind: 'folder', id: value, includeSubfolders: true },
                  })
                }}
                className="rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink"
              >
                <option value="all">Anywhere</option>
                <option value="inbox">Inbox</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </Row>
          )}

          {showRecursive && filters.scope.kind === 'folder' && (
            <Row label="Subfolders">
              <Toggle
                on={filters.scope.includeSubfolders}
                onClick={() =>
                  onChange({
                    ...filters,
                    scope:
                      filters.scope.kind === 'folder'
                        ? { ...filters.scope, includeSubfolders: !filters.scope.includeSubfolders }
                        : filters.scope,
                  })
                }
              >
                Include what is filed inside
              </Toggle>
            </Row>
          )}

          <Row label="Status">
            {STATES.map((state) => (
              <Toggle
                key={state.value}
                on={filters.states.includes(state.value)}
                onClick={() => onChange({ ...filters, states: toggleIn(filters.states, state.value) })}
              >
                {state.label}
              </Toggle>
            ))}
            <Toggle
              on={filters.flaggedOnly}
              onClick={() => onChange({ ...filters, flaggedOnly: !filters.flaggedOnly })}
            >
              ★ Flagged
            </Toggle>
          </Row>

          <Row label="Kind">
            {KINDS.map((kind) => (
              <Toggle
                key={kind.value}
                on={filters.kinds.includes(kind.value)}
                onClick={() => onChange({ ...filters, kinds: toggleIn(filters.kinds, kind.value) })}
              >
                {kind.label}
              </Toggle>
            ))}
          </Row>

          <Row label="Saved">
            <select
              value={filters.savedWithin}
              onChange={(event) =>
                onChange({ ...filters, savedWithin: event.target.value as SavedWithin })
              }
              className="rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink"
            >
              {SAVED_WITHIN.map((span) => (
                <option key={span.value} value={span.value}>
                  {span.label}
                </option>
              ))}
            </select>
          </Row>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-16 shrink-0 text-[0.65rem] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </div>
  )
}
