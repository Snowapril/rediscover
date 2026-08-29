import { useMemo, useState } from 'react'
import {
  buildCollectionTree,
  summarizeCollections,
  type CollectionNode,
  type CollectionSummary,
} from '@rediscover/core'
import { toCollectionInput, type CollectionRow } from '@rediscover/api-client'
import { useItemSummaries } from '../data/queries.ts'
import type { View } from '../view.ts'

type TreeEntry = ReturnType<typeof toCollectionInput>

/*
 * @brief How many thumbnails a folder card shows.
 */
const THUMBNAIL_SLOTS = 4

interface Props {
  collections: CollectionRow[]
  onOpen(view: View): void
}

/*
 * @brief The whole folder tree laid out at once, each folder showing what is in it.
 * @details The sidebar can only show one branch at a time and says nothing about
 *   what a folder holds. This is the view for remembering where something was
 *   filed: every folder visible together, illustrated by the scraps inside it.
 * @param collections Every folder the user owns.
 * @param onOpen Called with the view to switch to when a folder is opened.
 */
export function FolderMap({ collections, onOpen }: Props) {
  const summaries = useItemSummaries()

  const entries = useMemo(() => collections.map(toCollectionInput), [collections])
  const roots = useMemo(() => buildCollectionTree(entries), [entries])

  const byId = useMemo(() => {
    const items = (summaries.data ?? []).map((row) => ({
      collectionId: row.collection_id,
      thumbnailUrl: row.thumbnail_url,
      createdAt: new Date(row.created_at).getTime(),
    }))
    return summarizeCollections(roots, items, THUMBNAIL_SLOTS)
  }, [roots, summaries.data])

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">All folders</h1>
      <p className="mt-1 text-sm text-muted">
        Every folder at once, with a glimpse of what each one holds.
      </p>

      {roots.length === 0 && <p className="mt-6 text-sm text-muted">No folders yet.</p>}

      <div className="mt-6 space-y-6">
        {roots.map((node) => (
          <Branch key={node.collection.id} node={node} summaries={byId} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

function Branch({
  node,
  summaries,
  onOpen,
}: {
  node: CollectionNode<TreeEntry>
  summaries: Map<string, CollectionSummary>
  onOpen(view: View): void
}) {
  return (
    <div>
      <FolderCard node={node} summary={summaries.get(node.collection.id)} onOpen={onOpen} />

      {node.children.length > 0 && (
        // Nesting is shown with an indent and a rule rather than by repeating the
        // sidebar's disclosure triangles: this view exists to show everything.
        <div className="ml-4 mt-3 space-y-3 border-l border-line pl-4">
          {node.children.map((child) => (
            <Branch key={child.collection.id} node={child} summaries={summaries} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}

function FolderCard({
  node,
  summary,
  onOpen,
}: {
  node: CollectionNode<TreeEntry>
  summary: CollectionSummary | undefined
  onOpen(view: View): void
}) {
  const thumbnails = summary?.thumbnails ?? []
  const direct = summary?.directItems ?? 0
  const total = summary?.totalItems ?? 0

  return (
    <button
      type="button"
      onClick={() => onOpen({ kind: 'collection', id: node.collection.id })}
      className="flex w-full items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3 text-left hover:border-line-strong"
    >
      <Thumbnails urls={thumbnails} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{node.collection.name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {total === 0
            ? 'Empty'
            : direct === total
              ? `${direct} ${direct === 1 ? 'scrap' : 'scraps'}`
              : `${direct} here · ${total} including subfolders`}
          {node.children.length > 0 &&
            ` · ${node.children.length} ${node.children.length === 1 ? 'subfolder' : 'subfolders'}`}
        </p>
      </div>
    </button>
  )
}

/*
 * @brief A small grid of covers standing in for a folder's contents.
 * @details Slots left empty when a folder has fewer than four usable thumbnails
 *   keep the grid the same size, so folder names stay aligned down the page.
 * @param urls The thumbnails to show, most recent first.
 */
function Thumbnails({ urls }: { urls: readonly string[] }) {
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set())
  const usable = urls.filter((url) => !broken.has(url))

  return (
    <div className="grid size-14 shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded border border-line bg-line">
      {Array.from({ length: THUMBNAIL_SLOTS }, (_, slot) => {
        const url = usable[slot]
        return url === undefined ? (
          <span key={slot} className="bg-canvas" />
        ) : (
          <img
            key={url}
            src={url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken((current) => new Set(current).add(url))}
            className="size-full bg-canvas object-cover"
          />
        )
      })}
    </div>
  )
}
