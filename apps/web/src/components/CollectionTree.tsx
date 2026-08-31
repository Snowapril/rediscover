import { useMemo, useState } from 'react'
import {
  branchesHoldingPinned,
  buildCollectionTree,
  collectionPath,
  flattenCollectionTree,
  nextPosition,
  pinnedCollections,
  type CollectionNode,
} from '@rediscover/core'
import { toCollectionInput, type CollectionRow } from '@rediscover/api-client'
import {
  useCreateCollection,
  useDueReminders,
  useDeleteCollection,
  useRenameCollection,
  useSetCollectionPinned,
} from '../data/queries.ts'
import {
  dropIndicatorClasses,
  useFolderDrag,
  type FolderDragHandlers,
  type DropMode,
} from '../data/useFolderDrag.ts'
import { MergeBadge } from './MergeBadge.tsx'
import type { View } from '../view.ts'

type TreeEntry = ReturnType<typeof toCollectionInput>

interface Props {
  userId: string
  collections: CollectionRow[]
  view: View
  onSelect(view: View): void
}

const rowBase = 'group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm'

export function CollectionTree({ userId, collections, view, onSelect }: Props) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const createCollection = useCreateCollection()
  const renameCollection = useRenameCollection()
  const deleteCollection = useDeleteCollection()
  const setPinned = useSetCollectionPinned()
  const due = useDueReminders()

  const entries = useMemo(() => collections.map(toCollectionInput), [collections])
  const roots = useMemo(() => buildCollectionTree(entries), [entries])
  const rows = useMemo(() => flattenCollectionTree(roots, expanded), [roots, expanded])
  const pinned = useMemo(() => pinnedCollections(entries), [entries])
  const holdingPinned = useMemo(() => branchesHoldingPinned(entries), [entries])

  const reveal = (parentId: string | null) => {
    if (parentId !== null) setExpanded((current) => new Set(current).add(parentId))
  }
  const drag = useFolderDrag(entries, roots, reveal)

  const selectedId = view.kind === 'collection' ? view.id : null

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addChild(parentId: string | null) {
    const siblings = entries.filter((entry) => entry.parentId === parentId)
    createCollection.mutate(
      { userId, parentId, name: 'New folder', position: nextPosition(siblings) },
      {
        onSuccess: (created) => {
          reveal(parentId)
          setRenaming(created.id)
        },
      },
    )
  }

  return (
    <nav className="flex h-full flex-col gap-4">
      <ul className="space-y-0.5">
        <li>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'today' })}
            className={`${rowBase} ${view.kind === 'today' ? 'bg-line font-medium' : 'hover:bg-line/60'}`}
          >
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="truncate font-medium">Today</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'inbox' })}
            className={`${rowBase} ${view.kind === 'inbox' ? 'bg-line font-medium' : 'hover:bg-line/60'}`}
          >
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Inbox</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'due' })}
            className={`${rowBase} ${view.kind === 'due' ? 'bg-line font-medium' : 'hover:bg-line/60'}`}
          >
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">Due</span>
            {due.data !== undefined && due.data.length > 0 && (
              <span className="shrink-0 rounded-full bg-accent px-1.5 text-[0.65rem] font-medium tabular-nums text-canvas">
                {due.data.length}
              </span>
            )}
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'folders' })}
            className={`${rowBase} ${view.kind === 'folders' ? 'bg-line font-medium' : 'hover:bg-line/60'}`}
          >
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">All folders</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'scripts' })}
            className={`${rowBase} ${view.kind === 'scripts' ? 'bg-line font-medium' : 'hover:bg-line/60'}`}
          >
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Scripts</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'import' })}
            className={`${rowBase} ${view.kind === 'import' ? 'bg-line font-medium' : 'hover:bg-line/60'}`}
          >
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Import</span>
          </button>
        </li>
      </ul>

      {pinned.length > 0 && (
        <ul className="space-y-0.5 border-t border-line pt-3">
          <li className="px-2 pb-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted">
            Pinned
          </li>
          {pinned.map((entry) => {
            const path = collectionPath(entries, entry.id)
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'collection', id: entry.id })}
                  title={path.join(' / ')}
                  className={`${rowBase} ${
                    selectedId === entry.id ? 'bg-line font-medium' : 'hover:bg-line/60'
                  }`}
                >
                  <span className="w-4 shrink-0 text-center text-accent" aria-hidden="true">
                    ◆
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {path.length > 1 && (
                      // The name alone is ambiguous once a folder is shown
                      // outside the tree it lives in.
                      <span className="text-muted">{path.slice(0, -1).join(' / ')} / </span>
                    )}
                    {entry.name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <ul className="space-y-0.5 border-t border-line pt-3">
        {rows.map((node) => (
          <CollectionRow
            key={node.collection.id}
            node={node}
            selected={selectedId === node.collection.id}
            expanded={expanded.has(node.collection.id)}
            renaming={renaming === node.collection.id}
            confirmingDelete={confirmingDelete === node.collection.id}
            dragging={drag.dragId === node.collection.id}
            dropMode={drag.modeFor(node.collection.id)}
            pinned={node.collection.pinnedAt !== null}
            holdsPinned={holdingPinned.has(node.collection.id)}
            onTogglePin={() =>
              setPinned.mutate({
                id: node.collection.id,
                pinned: node.collection.pinnedAt === null,
              })
            }
            dragProps={drag.dragProps(node.collection.id, renaming !== node.collection.id)}
            onSelect={() => onSelect({ kind: 'collection', id: node.collection.id })}
            onToggle={() => toggle(node.collection.id)}
            onStartRename={() => setRenaming(node.collection.id)}
            onRename={(name) => {
              setRenaming(null)
              const trimmed = name.trim()
              if (trimmed !== '' && trimmed !== node.collection.name) {
                renameCollection.mutate({ id: node.collection.id, name: trimmed })
              }
            }}
            onAskDelete={() => setConfirmingDelete(node.collection.id)}
            onCancelDelete={() => setConfirmingDelete(null)}
            onConfirmDelete={() => {
              setConfirmingDelete(null)
              deleteCollection.mutate(node.collection.id)
            }}
            onAddChild={() => addChild(node.collection.id)}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={() => addChild(null)}
        className="self-start rounded-md px-2 py-1 text-sm text-muted hover:text-ink"
      >
        + New folder
      </button>
    </nav>
  )
}

interface RowProps {
  node: CollectionNode<TreeEntry>
  selected: boolean
  expanded: boolean
  renaming: boolean
  confirmingDelete: boolean
  dragging: boolean
  dropMode: DropMode | null
  pinned: boolean
  holdsPinned: boolean
  dragProps: FolderDragHandlers
  onSelect(): void
  onToggle(): void
  onStartRename(): void
  onRename(name: string): void
  onAskDelete(): void
  onCancelDelete(): void
  onConfirmDelete(): void
  onAddChild(): void
  onTogglePin(): void
}

function CollectionRow(props: RowProps) {
  const { node, selected, expanded, renaming, confirmingDelete, dragging, dropMode } = props
  const hasChildren = node.children.length > 0
  // Once a branch is open its pinned folder shows its own mark, so the branch's
  // stands in only while it is hiding it.
  const showsBranchMark = props.holdsPinned && !expanded

  return (
    <li style={{ paddingLeft: `${node.depth * 0.85}rem` }}>
      <div
        {...props.dragProps}
        className={`relative ${rowBase} ${dropIndicatorClasses(dropMode)} ${
          dragging ? 'opacity-40' : ''
        } ${selected ? 'bg-line font-medium' : 'hover:bg-line/60'}`}
      >
        {dropMode === 'merge' && <MergeBadge name={node.collection.name} />}
        {hasChildren ? (
          <button
            type="button"
            onClick={props.onToggle}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            className="w-4 shrink-0 text-muted"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden="true" />
        )}

        {renaming ? (
          <input
            autoFocus
            defaultValue={node.collection.name}
            onBlur={(event) => props.onRename(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') props.onRename(node.collection.name)
            }}
            className="min-w-0 flex-1 rounded border border-accent bg-surface px-1 py-0 text-sm outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={props.onSelect}
            onDoubleClick={props.onStartRename}
            className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
          >
            <span className="truncate">{node.collection.name}</span>
            {props.pinned && (
              <span className="shrink-0 text-[0.6rem] text-accent" title="Pinned">
                ◆
              </span>
            )}
            {showsBranchMark && (
              <span
                className="shrink-0 text-[0.6rem] text-muted"
                title="Something inside this folder is pinned"
              >
                ◇
              </span>
            )}
          </button>
        )}

        {confirmingDelete ? (
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <button
              type="button"
              onClick={props.onConfirmDelete}
              title="Deletes this folder, the folders inside it, and their scraps"
              className="text-accent"
            >
              Delete all
            </button>
            <button type="button" onClick={props.onCancelDelete} className="text-muted">
              Cancel
            </button>
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <IconButton
              label={props.pinned ? 'Unpin this folder' : 'Pin this folder to the top'}
              onClick={props.onTogglePin}
            >
              {props.pinned ? '◆' : '◇'}
            </IconButton>
            <IconButton label="New subfolder" onClick={props.onAddChild}>
              +
            </IconButton>
            <IconButton label="Rename" onClick={props.onStartRename}>
              ✎
            </IconButton>
            <IconButton label="Delete folder and its contents" onClick={props.onAskDelete}>
              ×
            </IconButton>
          </span>
        )}
      </div>
    </li>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick(): void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded px-1 text-muted hover:bg-canvas hover:text-ink"
    >
      {children}
    </button>
  )
}
