/*
 * @brief Whether the user has consumed a scrapped item yet.
 */
export type ReadState = 'unread' | 'reading' | 'read'

/*
 * @brief Coarse classification of what a scrapped link points at.
 */
export type MediaType = 'article' | 'video' | 'image' | 'pdf' | 'link'

/*
 * @brief How a view arranges its items on screen.
 */
export type ViewLayout = 'list' | 'card' | 'grid' | 'headline'

/*
 * @brief Kind of user script; determines which entry point the sandbox calls.
 */
export type ScriptKind = 'sort' | 'group'

/*
 * @brief The standardized, user-editable properties every scrapped item carries.
 * @details Every field is nullable because extraction may fail or the source may
 *   simply not expose it. `title` falls back to the URL at display time rather
 *   than being forced non-null here.
 */
export interface ItemProperties {
  title: string | null
  excerpt: string | null
  thumbnailUrl: string | null
  faviconUrl: string | null
  siteName: string | null
  author: string | null
  publishedAt: string | null
  readingTimeMin: number | null
  lang: string | null
  mediaType: MediaType | null
}

/*
 * @brief Names of the properties a user is allowed to override by hand.
 * @details Kept as a runtime array so the merge logic and the DB `edited_fields`
 *   column can be validated against the same source of truth.
 */
export const ITEM_PROPERTY_KEYS = [
  'title',
  'excerpt',
  'thumbnailUrl',
  'faviconUrl',
  'siteName',
  'author',
  'publishedAt',
  'readingTimeMin',
  'lang',
  'mediaType',
] as const satisfies readonly (keyof ItemProperties)[]

export type ItemPropertyKey = (typeof ITEM_PROPERTY_KEYS)[number]

/*
 * @brief Result of extracting metadata from a page, before user edits are applied.
 * @details A missing key means "extraction had nothing to say"; an explicit null
 *   means "extraction ran and found the field genuinely absent". Only the former
 *   preserves a previously extracted value.
 */
export type ExtractedMetadata = Partial<ItemProperties>

/*
 * @brief The frozen, plain-object view of an item handed to user sandbox scripts.
 * @details Timestamps are epoch milliseconds so scripts can do arithmetic without
 *   a Date implementation inside the sandbox.
 */
export interface ScriptItem {
  id: string
  url: string
  domain: string
  title: string | null
  excerpt: string | null
  thumbnailUrl: string | null
  siteName: string | null
  author: string | null
  publishedAt: number | null
  createdAt: number
  updatedAt: number
  readState: ReadState
  readAt: number | null
  isImportant: boolean
  tags: string[]
  readingTimeMin: number | null
  mediaType: MediaType | null
  note: string | null
}

/*
 * @brief An item with no known properties, used as the starting point for a new
 *   scrap and as the value a property falls back to when it is cleared.
 * @details Frozen; copy it with a spread before mutating.
 */
export const EMPTY_ITEM_PROPERTIES: Readonly<ItemProperties> = Object.freeze({
  title: null,
  excerpt: null,
  thumbnailUrl: null,
  faviconUrl: null,
  siteName: null,
  author: null,
  publishedAt: null,
  readingTimeMin: null,
  lang: null,
  mediaType: null,
})
