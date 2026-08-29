import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import {
  createCollection,
  createItem,
  deleteCollection,
  extractIntoItem,
  findLiveItemByUrl,
  listCollections,
  listItemSummaries,
  listItems,
  moveCollection,
  renameCollection,
  setImportant,
  setReadState,
  trashItem,
  type CollectionRow,
  type ItemRow,
} from '@rediscover/api-client'
import type { ReadState } from '@rediscover/core'
import { supabase } from '../supabase.ts'

const COLLECTIONS_KEY = ['collections'] as const

function itemsKey(collectionId: string | null) {
  return ['items', collectionId] as const
}

/*
 * @brief Every collection the signed-in user owns.
 * @return The query result holding the collections.
 */
export function useCollections(): UseQueryResult<CollectionRow[]> {
  return useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: () => listCollections(supabase),
  })
}

/*
 * @brief The scraps in one collection.
 * @param collectionId The collection to list, or null for the inbox.
 * @return The query result holding the scraps, newest first.
 */
export function useItems(collectionId: string | null): UseQueryResult<ItemRow[]> {
  return useQuery({
    queryKey: itemsKey(collectionId),
    queryFn: () => listItems(supabase, collectionId),
  })
}

export function useCreateCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; parentId: string | null; name: string; position: number }) =>
      createCollection(supabase, input),
    onSuccess: () => client.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  })
}

/*
 * @brief Every live scrap reduced to what the folder overview needs.
 */
export function useItemSummaries() {
  return useQuery({
    queryKey: ['item-summaries'],
    queryFn: () => listItemSummaries(supabase),
  })
}

export function useMoveCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; parentId: string | null; position: number }) =>
      moveCollection(supabase, input.id, input.parentId, input.position),
    onSuccess: () => client.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  })
}

export function useRenameCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      renameCollection(supabase, input.id, input.name),
    onSuccess: () => client.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  })
}

/*
 * @brief Delete a collection, refreshing both the tree and the inbox.
 * @details The schema detaches the collection's scraps rather than deleting
 *   them, so they reappear in the inbox and its cached list is now stale.
 */
export function useDeleteCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCollection(supabase, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: COLLECTIONS_KEY })
      void client.invalidateQueries({ queryKey: ['items'] })
      void client.invalidateQueries({ queryKey: ['item-summaries'] })
    },
  })
}

/*
 * @brief Save a link, then fill it in from the page it points at.
 * @details The scrap is stored first and shown immediately; reading the page
 *   can take seconds and must not hold up the save. Extraction records its own
 *   failure on the row, so a page that cannot be read still leaves a usable
 *   scrap behind.
 */
export function useCreateItem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; collectionId: string | null; url: string }) =>
      createItem(supabase, input),
    onSuccess: (item, input) => {
      void client.invalidateQueries({ queryKey: itemsKey(input.collectionId) })
      void client.invalidateQueries({ queryKey: ['item-summaries'] })
      void extractIntoItem(supabase, item).finally(() => {
        void client.invalidateQueries({ queryKey: itemsKey(input.collectionId) })
        void client.invalidateQueries({ queryKey: ['item-summaries'] })
      })
    },
  })
}

/*
 * @brief Read a page again for a scrap whose extraction failed or was never run.
 */
export function useRetryExtraction(collectionId: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (item: ItemRow) => extractIntoItem(supabase, item),
    onSuccess: () => client.invalidateQueries({ queryKey: itemsKey(collectionId) }),
  })
}

/*
 * @brief Look up where a URL is already saved.
 * @details Not a query hook: it runs once, in reaction to a failed save, rather
 *   than on render.
 * @return A function returning the existing scrap, or null.
 */
export function useFindExistingItem() {
  return (url: string) => findLiveItemByUrl(supabase, url)
}

export function useSetReadState(collectionId: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; state: ReadState }) =>
      setReadState(supabase, input.id, input.state),
    onSuccess: () => client.invalidateQueries({ queryKey: itemsKey(collectionId) }),
  })
}

export function useSetImportant(collectionId: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; important: boolean }) =>
      setImportant(supabase, input.id, input.important),
    onSuccess: () => client.invalidateQueries({ queryKey: itemsKey(collectionId) }),
  })
}

export function useTrashItem(collectionId: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => trashItem(supabase, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: itemsKey(collectionId) })
      void client.invalidateQueries({ queryKey: ['item-summaries'] })
    },
  })
}
