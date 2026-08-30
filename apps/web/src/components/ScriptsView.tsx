import { useEffect, useMemo, useState } from 'react'
import { orderByKeys, type SortKey } from '@rediscover/core'
import { toScriptItem, type ItemRow, type ScriptRow } from '@rediscover/api-client'
import { runExports, type ExportSpec } from '@rediscover/script-engine'
import {
  useAllScripts,
  useCollections,
  useCreateScript,
  useDeleteScript,
  useForkScript,
  useItems,
  useUpdateScript,
} from '../data/queries.ts'

interface Props {
  userId: string
}

const STARTER_SORT = `/* Sorts the folder. Return anything comparable, or an
   array to sort by one thing and then another. */
export function key(item) {
  return -item.createdAt
}

/* Optional. Names the group each scrap belongs to, which
   the list turns into chips you can filter by. */
export function category(item) {
  return item.readState === 'read' ? 'Read' : 'Unread'
}
`

const STARTER_GROUP = `/* Names the group each scrap belongs to. */
export function group(item) {
  return item.siteName ?? item.domain
}
`

/*
 * @brief How many scraps the preview runs over.
 * @details Enough to see the shape of the result without waiting on a whole
 *   library while somebody is still typing.
 */
const PREVIEW_LIMIT = 40

/*
 * @brief Write, fork and try out the scripts that arrange folders.
 * @details The scripts are stored on the account and read by every device, so
 *   this is the one place they can be looked at. Built-in scripts are shown
 *   read-only with a fork button: the point of shipping them as rows was that a
 *   person can see how their ordering is defined and start from it.
 *
 *   The preview runs against real scraps rather than made-up ones, because the
 *   mistakes worth catching are about real data — the scrap with no title, the
 *   one with no reading time.
 * @param userId The owner of anything created here.
 */
export function ScriptsView({ userId }: Props) {
  const scripts = useAllScripts()
  const collections = useCollections()
  const createScript = useCreateScript()
  const updateScript = useUpdateScript()
  const deleteScript = useDeleteScript()
  const forkScript = useForkScript()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [previewCollectionId, setPreviewCollectionId] = useState<string | null>(null)

  const selected = scripts.data?.find((script) => script.id === selectedId) ?? null
  const source = draft ?? selected?.source ?? ''
  const dirty = draft !== null && selected !== null && draft !== selected.source

  const previewItems = useItems(previewCollectionId)
  const sample = useMemo(
    () => (previewItems.data ?? []).slice(0, PREVIEW_LIMIT),
    [previewItems.data],
  )
  const preview = usePreview(selected, source, sample)

  function select(script: ScriptRow) {
    setSelectedId(script.id)
    setDraft(null)
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Scripts</h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        How your folders are ordered and grouped. These live on your account, so a script written
        here arranges your folders on every device you sign in from.
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <nav className="shrink-0 lg:w-56">
          {(['sort', 'group'] as const).map((kind) => (
            <div key={kind} className="mb-4">
              <p className="px-2 pb-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted">
                {kind === 'sort' ? 'Ordering' : 'Grouping'}
              </p>
              <ul className="space-y-0.5">
                {scripts.data
                  ?.filter((script) => script.kind === kind)
                  .map((script) => (
                    <li key={script.id}>
                      <button
                        type="button"
                        onClick={() => select(script)}
                        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm ${
                          selectedId === script.id ? 'bg-line font-medium' : 'hover:bg-line/60'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{script.name}</span>
                        {!script.is_builtin && (
                          <span className="shrink-0 text-[0.6rem] text-accent" title="Yours">
                            ●
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  createScript.mutate(
                    {
                      userId,
                      name: kind === 'sort' ? 'My ordering' : 'My grouping',
                      kind,
                      source: kind === 'sort' ? STARTER_SORT : STARTER_GROUP,
                    },
                    { onSuccess: select },
                  )
                }
                className="mt-1 rounded-md px-2 py-1 text-sm text-muted hover:text-ink"
              >
                + New {kind === 'sort' ? 'ordering' : 'grouping'}
              </button>
            </div>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {selected === null ? (
            <p className="text-sm text-muted">Choose a script to read it, or write a new one.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {selected.is_builtin ? (
                  <>
                    <span className="text-sm font-medium">{selected.name}</span>
                    <span className="text-xs text-muted">
                      Built in — fork it to make it yours
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        forkScript.mutate({ userId, original: selected }, { onSuccess: select })
                      }
                      className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas"
                    >
                      Fork
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      value={selected.name}
                      onChange={(event) =>
                        updateScript.mutate({ id: selected.id, patch: { name: event.target.value } })
                      }
                      className="rounded-md border border-line bg-surface px-2 py-1 text-sm font-medium outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(null)
                        setDraft(null)
                        deleteScript.mutate(selected.id)
                      }}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      disabled={!dirty}
                      onClick={() => {
                        updateScript.mutate({ id: selected.id, patch: { source } })
                        setDraft(null)
                      }}
                      className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-40"
                    >
                      {dirty ? 'Save' : 'Saved'}
                    </button>
                  </>
                )}
              </div>

              <textarea
                value={source}
                readOnly={selected.is_builtin}
                spellCheck={false}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Tab') return
                  // Without this, Tab leaves the box and indenting is impossible.
                  event.preventDefault()
                  const field = event.currentTarget
                  const { selectionStart, selectionEnd, value } = field
                  const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`
                  setDraft(next)
                  requestAnimationFrame(() => {
                    field.selectionStart = field.selectionEnd = selectionStart + 2
                  })
                }}
                rows={16}
                className={`mt-3 w-full rounded-lg border border-line bg-surface p-3 font-mono text-xs leading-relaxed outline-none focus:border-accent ${
                  selected.is_builtin ? 'text-muted' : ''
                }`}
              />

              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-ink">Preview</span>
                  <label className="flex items-center gap-1.5">
                    against
                    <select
                      value={previewCollectionId ?? ''}
                      onChange={(event) =>
                        setPreviewCollectionId(event.target.value === '' ? null : event.target.value)
                      }
                      className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
                    >
                      <option value="">Inbox</option>
                      {collections.data?.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {collection.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span>
                    {sample.length === 0
                      ? 'nothing saved there'
                      : `first ${sample.length} scraps`}
                  </span>
                  {preview.running && <span>· running…</span>}
                </div>

                {preview.error !== null && (
                  <p className="mt-2 rounded-lg border border-accent/40 bg-surface p-3 text-sm text-accent">
                    {preview.error}
                  </p>
                )}

                {preview.error === null && preview.rows.length > 0 && (
                  <ol className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
                    {preview.rows.map((row, index) => (
                      <li key={row.item.id} className="flex items-baseline gap-3 px-3 py-1.5 text-xs">
                        <span className="w-5 shrink-0 tabular-nums text-muted">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {row.item.title ?? row.item.url}
                        </span>
                        {row.category !== null && (
                          <span className="shrink-0 rounded-full border border-line px-1.5 text-muted">
                            {row.category}
                          </span>
                        )}
                        <span
                          className="shrink-0 font-mono text-muted"
                          title="What the script returned"
                        >
                          {row.key}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

interface PreviewRow {
  item: ItemRow
  key: string
  category: string | null
}

/*
 * @brief Run the script being edited over some real scraps.
 * @details Debounced, because it runs while somebody is typing and a half-typed
 *   script is usually a syntax error; showing that error on every keystroke
 *   would make the editor feel broken rather than helpful.
 * @param script The script being edited, for its kind.
 * @param source The text currently in the editor, saved or not.
 * @param items The scraps to run it over.
 * @return The arranged scraps, whether a run is in flight, and any failure.
 */
function usePreview(script: ScriptRow | null, source: string, items: readonly ItemRow[]) {
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (script === null || items.length === 0) {
      setRows([])
      setError(null)
      return
    }

    let current = true
    const timer = setTimeout(() => {
      setRunning(true)

      const wanted: ExportSpec[] =
        script.kind === 'sort'
          ? [
              { name: 'key', kind: 'sortKey', required: true },
              { name: 'category', kind: 'label', required: false },
            ]
          : [{ name: 'group', kind: 'label', required: true }]

      void runExports(
        source,
        wanted,
        items.map((item) => toScriptItem(item)),
      ).then((outcome) => {
        if (!current) return
        setRunning(false)

        if (!outcome.ok) {
          setError(outcome.message)
          return
        }
        setError(null)

        const keys = (outcome.values['key'] ?? []) as SortKey[]
        const labels = (outcome.values['category'] ?? outcome.values['group'] ?? []) as (
          | string
          | null
        )[]
        const byId = new Map(items.map((item, index) => [item.id, index]))
        const ordered =
          script.kind === 'sort' ? orderByKeys([...items], keys) : [...items]

        setRows(
          ordered.map((item) => {
            const index = byId.get(item.id) ?? 0
            return {
              item,
              key: script.kind === 'sort' ? JSON.stringify(keys[index]) : '',
              category: labels[index] ?? null,
            }
          }),
        )
      })
    }, 300)

    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [script, source, items])

  return { rows, error, running }
}
