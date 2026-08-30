import { useMemo, useState } from 'react'
import {
  branchesHoldingPinned,
  buildCollectionTree,
  collectionPath,
  pinnedCollections,
  summarizeCollections,
  type CollectionNode,
  type CollectionSummary,
} from '@rediscover/core'
import { toCollectionInput, type CollectionRow } from '@rediscover/api-client'
import { useItemSummaries, useSetCollectionPinned } from '../data/queries.ts'
import { dropIndicatorClasses, useFolderDrag, type FolderDrag } from '../data/useFolderDrag.ts'
import { MergeBadge } from './MergeBadge.tsx'
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
 *   Folders can be rearranged here too, using the same drop rules as the
 *   sidebar, so the view you reorganise in is not forced to be the narrow one.
 * @param collections Every folder the user owns.
 * @param onOpen Called with the view to switch to when a folder is opened.
 */
export function FolderMap({ collections, onOpen }: Props) {
  const summaries = useItemSummaries()

  const entries = useMemo(() => collections.map(toCollectionInput), [collections])
  const roots = useMemo(() => buildCollectionTree(entries), [entries])
  const drag = useFolderDrag(entries, roots)
  const setPinned = useSetCollectionPinned()
  const pinned = useMemo(() => pinnedCollections(entries), [entries])
  const holdingPinned = useMemo(() => branchesHoldingPinned(entries), [entries])

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
        Every folder at once, with a glimpse of what each one holds. Drag a folder onto another to
        file it inside, onto the edge of one to place it alongside, or shake it over one for a
        second to merge the two.
      </p>

      {roots.length === 0 && <p className="mt-6 text-sm text-muted">No folders yet.</p>}

      {pinned.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Pinned</h2>
          <div className="mt-2 space-y-2">
            {pinned.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpen({ kind: 'collection', id: entry.id })}
                className="flex w-full items-center gap-3 rounded-lg border border-accent/40 bg-surface px-4 py-2 text-left"
              >
                <Thumbnails urls={byId.get(entry.id)?.thumbnails ?? []} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {collectionPath(entries, entry.id).length > 1 && (
                    <span className="text-muted">
                      {collectionPath(entries, entry.id).slice(0, -1).join(' / ')} /{' '}
                    </span>
                  )}
                  <span className="font-medium">{entry.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {byId.get(entry.id)?.totalItems ?? 0}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 space-y-4">
        {roots.map((node) => (
          <Branch
            key={node.collection.id}
            node={node}
            summaries={byId}
            drag={drag}
            holdingPinned={holdingPinned}
            onTogglePin={(id, next) => setPinned.mutate({ id, pinned: next })}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  )
}

function Branch({
  node,
  summaries,
  drag,
  holdingPinned,
  onTogglePin,
  onOpen,
}: {
  node: CollectionNode<TreeEntry>
  summaries: Map<string, CollectionSummary>
  drag: FolderDrag
  holdingPinned: ReadonlySet<string>
  onTogglePin(id: string, pinned: boolean): void
  onOpen(view: View): void
}) {
  return (
    <div>
      <FolderCard
        node={node}
        summary={summaries.get(node.collection.id)}
        drag={drag}
        holdsPinned={holdingPinned.has(node.collection.id)}
        onTogglePin={onTogglePin}
        onOpen={onOpen}
      />

      {node.children.length > 0 && (
        // Nesting is shown with an indent and a rule rather than by repeating the
        // sidebar's disclosure triangles: this view exists to show everything.
        <div className="ml-4 mt-3 space-y-3 border-l border-line pl-4">
          {node.children.map((child) => (
            <Branch
              key={child.collection.id}
              node={child}
              summaries={summaries}
              drag={drag}
              holdingPinned={holdingPinned}
              onTogglePin={onTogglePin}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FolderCard({
  node,
  summary,
  drag,
  holdsPinned,
  onTogglePin,
  onOpen,
}: {
  node: CollectionNode<TreeEntry>
  summary: CollectionSummary | undefined
  drag: FolderDrag
  holdsPinned: boolean
  onTogglePin(id: string, pinned: boolean): void
  onOpen(view: View): void
}) {
  const isPinned = node.collection.pinnedAt !== null
  const thumbnails = summary?.thumbnails ?? []
  const direct = summary?.directItems ?? 0
  const total = summary?.totalItems ?? 0
  const dragging = drag.dragId === node.collection.id
  const dropMode = drag.modeFor(node.collection.id)

  return (
    <div
      {...drag.dragProps(node.collection.id)}
      className={`group/card relative rounded-lg border bg-surface ${
        isPinned ? 'border-accent/40' : 'border-line'
      } ${dropIndicatorClasses(
        dropMode,
      )} ${dragging ? 'opacity-40' : ''}`}
    >
      {dropMode === 'merge' && <MergeBadge name={node.collection.name} />}
      <button
        type="button"
        onClick={() => onOpen({ kind: 'collection', id: node.collection.id })}
        className="flex w-full items-center gap-4 px-4 py-3 text-left"
      >
        <Thumbnails urls={thumbnails} />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span className="truncate">{node.collection.name}</span>
            {isPinned && <span className="shrink-0 text-xs text-accent" title="Pinned">◆</span>}
            {holdsPinned && !isPinned && (
              <span
                className="shrink-0 text-xs text-muted"
                title="Something inside this folder is pinned"
              >
                ◇
              </span>
            )}
          </p>
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

      <button
        type="button"
        aria-label={isPinned ? 'Unpin this folder' : 'Pin this folder to the top'}
        title={isPinned ? 'Unpin this folder' : 'Pin this folder to the top'}
        onClick={() => onTogglePin(node.collection.id, !isPinned)}
        className={`absolute right-2 top-2 rounded px-1.5 py-0.5 text-xs ${
          isPinned ? 'text-accent' : 'text-muted opacity-0 hover:text-ink group-hover/card:opacity-100'
        }`}
      >
        {isPinned ? '◆' : '◇'}
      </button>
    </div>
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
