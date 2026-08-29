import { useMemo, useState } from 'react'
import {
  buildCollectionTree,
  flattenCollectionTree,
  nextPosition,
  type CollectionNode,
} from '@rediscover/core'
import { toCollectionInput, type CollectionRow } from '@rediscover/api-client'
import { useCreateCollection, useDeleteCollection, useRenameCollection } from '../data/queries.ts'
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

  const entries = useMemo(() => collections.map(toCollectionInput), [collections])
  const roots = useMemo(() => buildCollectionTree(entries), [entries])
  const rows = useMemo(() => flattenCollectionTree(roots, expanded), [roots, expanded])

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
            onClick={() => onSelect({ kind: 'folders' })}
            className={`${rowBase} ${view.kind === 'folders' ? 'bg-line font-medium' : 'hover:bg-line/60'}`}
          >
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">All folders</span>
          </button>
        </li>
      </ul>

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
  dragProps: FolderDragHandlers
  onSelect(): void
  onToggle(): void
  onStartRename(): void
  onRename(name: string): void
  onAskDelete(): void
  onCancelDelete(): void
  onConfirmDelete(): void
  onAddChild(): void
}

function CollectionRow(props: RowProps) {
  const { node, selected, expanded, renaming, confirmingDelete, dragging, dropMode } = props
  const hasChildren = node.children.length > 0

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
            className="min-w-0 flex-1 truncate text-left"
          >
            {node.collection.name}
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
