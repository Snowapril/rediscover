import { useState, type DragEvent } from 'react'
import {
  canMoveCollection,
  nextPosition,
  positionBetween,
  type CollectionInput,
  type CollectionNode,
} from '@rediscover/core'
import { useMoveCollection } from './queries.ts'

/*
 * @brief Where a dragged folder would land relative to the row under the cursor.
 */
export type DropMode = 'before' | 'inside' | 'after'

interface DropTarget {
  id: string
  mode: DropMode
}

/*
 * @brief Which third of a row the cursor is in.
 * @details The middle half files the folder inside the row; the outer quarters
 *   place it before or after as a sibling. Splitting the row is what lets one
 *   pointer express both, since there is otherwise no gesture that separates
 *   "into this" from "above this".
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

export interface FolderDragHandlers {
  draggable: boolean
  onDragStart(): void
  onDragEnd(): void
  onDragOver(event: DragEvent<HTMLElement>): void
  onDragLeave(): void
  onDrop(event: DragEvent<HTMLElement>): void
}

export interface FolderDrag {
  /*
   * @brief The folder currently being dragged, if any.
   */
  dragId: string | null
  /*
   * @brief How a drop on the given folder would land, or null if it is not the
   *   current target or the drop is not allowed.
   */
  modeFor(id: string): DropMode | null
  /*
   * @brief Drag handlers to spread onto the element representing a folder.
   * @param id The folder the element stands for.
   * @param enabled Whether this element may start a drag right now.
   */
  dragProps(id: string, enabled?: boolean): FolderDragHandlers
}

/*
 * @brief Dragging folders into and between each other.
 * @details Shared by the sidebar and the folder overview so the two cannot
 *   disagree about what a drop means. A drop into the folder's own subtree is
 *   never offered: the database refuses it, and refusing here means the cursor
 *   does not suggest a move that will fail.
 * @param entries Every folder, flat.
 * @param roots The same folders as a tree.
 * @param onMoved Called with the new parent after a successful drop, so a view
 *   can reveal where the folder went.
 * @return State and handlers for the elements standing in for folders.
 */
export function useFolderDrag<T extends CollectionInput>(
  entries: readonly T[],
  roots: readonly CollectionNode<T>[],
  onMoved?: (parentId: string | null) => void,
): FolderDrag {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const moveCollection = useMoveCollection()

  function siblingsOf(parentId: string | null): T[] {
    return entries
      .filter((entry) => entry.parentId === parentId)
      .sort((a, b) => a.position - b.position)
  }

  function parentForDrop(target: DropTarget): string | null {
    if (target.mode === 'inside') return target.id
    return entries.find((entry) => entry.id === target.id)?.parentId ?? null
  }

  function allowsDrop(target: DropTarget): boolean {
    if (dragId === null) return false
    if (target.id === dragId) return false
    return canMoveCollection(roots, dragId, parentForDrop(target))
  }

  function commit(target: DropTarget) {
    setDropTarget(null)
    if (dragId === null || !allowsDrop(target)) return

    const parentId = parentForDrop(target)
    let position: number

    if (target.mode === 'inside') {
      position = nextPosition(siblingsOf(target.id))
    } else {
      // Measured against the siblings the folder is joining, with the folder
      // itself removed so dropping it beside where it already sits does not
      // measure the gap against itself.
      const siblings = siblingsOf(parentId).filter((entry) => entry.id !== dragId)
      const index = siblings.findIndex((entry) => entry.id === target.id)
      const slot = target.mode === 'before' ? index : index + 1
      position = positionBetween(
        slot > 0 ? (siblings[slot - 1]?.position ?? null) : null,
        siblings[slot]?.position ?? null,
      )
    }

    moveCollection.mutate({ id: dragId, parentId, position })
    onMoved?.(parentId)
    setDragId(null)
  }

  return {
    dragId,

    modeFor(id) {
      return dropTarget?.id === id ? dropTarget.mode : null
    },

    dragProps(id, enabled = true) {
      return {
        draggable: enabled,
        onDragStart: () => setDragId(id),
        onDragEnd: () => {
          setDragId(null)
          setDropTarget(null)
        },
        onDragOver: (event) => {
          const target: DropTarget = { id, mode: dropModeFor(event) }
          if (!allowsDrop(target)) {
            setDropTarget(null)
            return
          }
          event.preventDefault()
          setDropTarget(target)
        },
        onDragLeave: () => setDropTarget(null),
        onDrop: (event) => {
          event.preventDefault()
          commit({ id, mode: dropModeFor(event) })
        },
      }
    },
  }
}

/*
 * @brief Tailwind classes that show where a drop would land.
 * @param mode The drop being previewed, or null for none.
 * @return Classes to add to the element; it must be positioned relatively.
 */
export function dropIndicatorClasses(mode: DropMode | null): string {
  if (mode === 'inside') return 'ring-1 ring-accent'
  if (mode === 'before') {
    return 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-accent'
  }
  if (mode === 'after') {
    return 'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent'
  }
  return ''
}
