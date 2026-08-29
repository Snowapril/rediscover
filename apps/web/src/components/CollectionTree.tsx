import { useMemo, useState, type DragEvent } from 'react'
import {
  buildCollectionTree,
  canMoveCollection,
  flattenCollectionTree,
  nextPosition,
  positionBetween,
  type CollectionNode,
} from '@rediscover/core'
import { toCollectionInput, type CollectionRow } from '@rediscover/api-client'
import {
  useCreateCollection,
  useDeleteCollection,
  useMoveCollection,
  useRenameCollection,
} from '../data/queries.ts'
import type { View } from '../view.ts'

type TreeEntry = ReturnType<typeof toCollectionInput>

/*
 * @brief Where a dragged folder would land relative to the row under the cursor.
 */
type DropMode = 'before' | 'inside' | 'after'

interface DropTarget {
  id: string
  mode: DropMode
}

interface Props {
  userId: string
  collections: CollectionRow[]
  view: View
  onSelect(view: View): void
}

const rowBase = 'group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm'

/*
 * @brief Which third of a row the cursor is in.
 * @details The middle two thirds file the folder inside the row; the outer
 *   slivers place it before or after as a sibling, which is the only way to
 *   express reordering with a single pointer.
 * @param event The drag event over the row.
 * @return The drop this position means.
 */
function dropModeFor(event: DragEvent<HTMLElement>): DropMode {
  const box = event.currentTarget.getBoundingClientRect()
  const offset = (event.clientY - box.top) / box.height
  if (offset < 0.25) return 'before'
  if (offset > 0.75) return 'after'
  return 'inside'
}

export function CollectionTree({ userId, collections, view, onSelect }: Props) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const createCollection = useCreateCollection()
  const renameCollection = useRenameCollection()
  const deleteCollection = useDeleteCollection()
  const moveCollection = useMoveCollection()

  const entries = useMemo(() => collections.map(toCollectionInput), [collections])
  const roots = useMemo(() => buildCollectionTree(entries), [entries])
  const rows = useMemo(() => flattenCollectionTree(roots, expanded), [roots, expanded])

  const selectedId = view.kind === 'collection' ? view.id : null

  function siblingsOf(parentId: string | null): TreeEntry[] {
    return entries
      .filter((entry) => entry.parentId === parentId)
      .sort((a, b) => a.position - b.position)
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addChild(parentId: string | null) {
    createCollection.mutate(
      { userId, parentId, name: 'New folder', position: nextPosition(siblingsOf(parentId)) },
      {
        onSuccess: (created) => {
          if (parentId !== null) setExpanded((current) => new Set(current).add(parentId))
          setRenaming(created.id)
        },
      },
    )
  }

  /*
   * @brief The parent a drop would file the folder under.
   */
  function parentForDrop(target: DropTarget): string | null {
    if (target.mode === 'inside') return target.id
    return entries.find((entry) => entry.id === target.id)?.parentId ?? null
  }

  function allowsDrop(target: DropTarget): boolean {
    if (dragId === null) return false
    if (target.id === dragId) return false
    return canMoveCollection(roots, dragId, parentForDrop(target))
  }

  function handleDrop(target: DropTarget) {
    setDropTarget(null)
    if (dragId === null || !allowsDrop(target)) return

    const parentId = parentForDrop(target)
    let position: number

    if (target.mode === 'inside') {
      position = nextPosition(siblingsOf(target.id))
    } else {
      // Ordering is computed against the siblings the folder is joining, with
      // the folder itself removed so dropping it next to where it already sits
      // does not measure the gap against itself.
      const siblings = siblingsOf(parentId).filter((entry) => entry.id !== dragId)
      const index = siblings.findIndex((entry) => entry.id === target.id)
      const slot = target.mode === 'before' ? index : index + 1
      position = positionBetween(
        slot > 0 ? (siblings[slot - 1]?.position ?? null) : null,
        siblings[slot]?.position ?? null,
      )
    }

    moveCollection.mutate({ id: dragId, parentId, position })
    if (parentId !== null) setExpanded((current) => new Set(current).add(parentId))
    setDragId(null)
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
            dragging={dragId === node.collection.id}
            dropMode={dropTarget?.id === node.collection.id ? dropTarget.mode : null}
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
            onDragStart={() => setDragId(node.collection.id)}
            onDragEnd={() => {
              setDragId(null)
              setDropTarget(null)
            }}
            onDragOver={(event) => {
              const target: DropTarget = { id: node.collection.id, mode: dropModeFor(event) }
              if (!allowsDrop(target)) {
                setDropTarget(null)
                return
              }
              event.preventDefault()
              setDropTarget(target)
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(event) => {
              event.preventDefault()
              handleDrop({ id: node.collection.id, mode: dropModeFor(event) })
            }}
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
  onSelect(): void
  onToggle(): void
  onStartRename(): void
  onRename(name: string): void
  onAskDelete(): void
  onCancelDelete(): void
  onConfirmDelete(): void
  onAddChild(): void
  onDragStart(): void
  onDragEnd(): void
  onDragOver(event: DragEvent<HTMLElement>): void
  onDragLeave(): void
  onDrop(event: DragEvent<HTMLElement>): void
}

function CollectionRow(props: RowProps) {
  const { node, selected, expanded, renaming, confirmingDelete, dragging, dropMode } = props
  const hasChildren = node.children.length > 0

  const dropRing = dropMode === 'inside' ? 'ring-1 ring-accent' : ''
  const dropEdge =
    dropMode === 'before'
      ? 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-accent'
      : dropMode === 'after'
        ? 'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent'
        : ''

  return (
    <li style={{ paddingLeft: `${node.depth * 0.85}rem` }}>
      <div
        draggable={!renaming}
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
        onDragOver={props.onDragOver}
        onDragLeave={props.onDragLeave}
        onDrop={props.onDrop}
        className={`relative ${rowBase} ${dropRing} ${dropEdge} ${dragging ? 'opacity-40' : ''} ${
          selected ? 'bg-line font-medium' : 'hover:bg-line/60'
        }`}
      >
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
