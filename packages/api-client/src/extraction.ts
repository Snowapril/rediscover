import {
  ITEM_PROPERTY_KEYS,
  mergeExtractedMetadata,
  type ExtractedMetadata,
  type ItemProperties,
  type ItemPropertyKey,
  type MediaType,
} from '@rediscover/core'
import type { Database } from '@rediscover/db/generated'
import type { RediscoverClient } from './client.ts'
import type { ItemRow } from './items.ts'
import { unwrap } from './result.ts'

/*
 * @brief Read an item's standardized properties out of its stored row.
 * @param row The item as stored.
 * @return The properties in the shape the merge rules take.
 */
export function itemProperties(row: ItemRow): ItemProperties {
  return {
    title: row.title,
    excerpt: row.excerpt,
    thumbnailUrl: row.thumbnail_url,
    faviconUrl: row.favicon_url,
    siteName: row.site_name,
    author: row.author,
    publishedAt: row.published_at,
    readingTimeMin: row.reading_time_min,
    lang: row.lang,
    mediaType: row.media_type,
  }
}

/*
 * @brief The property names the user has taken ownership of.
 * @details The column is a plain text array, and the schema constrains its
 *   contents, but the values are narrowed here rather than asserted so a row
 *   written by an older client cannot widen the type.
 * @param row The item as stored.
 * @return The known property names it lists.
 */
export function editedFields(row: ItemRow): ItemPropertyKey[] {
  const known = new Set<string>(ITEM_PROPERTY_KEYS)
  return ITEM_PROPERTY_KEYS.filter((key) => known.has(key) && row.edited_fields.includes(key))
}

function toColumns(properties: ItemProperties) {
  return {
    title: properties.title,
    excerpt: properties.excerpt,
    thumbnail_url: properties.thumbnailUrl,
    favicon_url: properties.faviconUrl,
    site_name: properties.siteName,
    author: properties.author,
    published_at: properties.publishedAt,
    reading_time_min: properties.readingTimeMin,
    lang: properties.lang,
    media_type: properties.mediaType as MediaType | null,
  }
}

/*
 * @brief Ask the server to read a page and report its properties.
 * @details The fetch happens server-side because a browser cannot read another
 *   origin's markup, and because the page should not learn who is saving it.
 * @param client A signed-in client.
 * @param url The address to read.
 * @return What the page says about itself.
 */
export async function extractMetadata(
  client: RediscoverClient,
  url: string,
): Promise<ExtractedMetadata> {
  const { data, error } = await client.functions.invoke<{ metadata: ExtractedMetadata }>('extract', {
    body: { url },
  })
  if (error !== null) throw new Error(error.message, { cause: error })
  if (data === null) throw new Error('The extractor returned nothing')
  return data.metadata
}

/*
 * @brief Fill in a scrap's properties from the page it points at.
 * @details The merge never overwrites a property the user edited, and the raw
 *   result is kept alongside so a property can later be handed back to
 *   extraction. A failure is recorded on the row instead of being thrown away,
 *   so the list can show that the page could not be read and offer a retry.
 * @param client A signed-in client.
 * @param item The scrap to fill in.
 * @return The updated scrap.
 */
export async function extractIntoItem(
  client: RediscoverClient,
  item: ItemRow,
): Promise<ItemRow> {
  let extracted: ExtractedMetadata
  try {
    extracted = await extractMetadata(client, item.url)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Could not read the page'
    return unwrap(
      await client
        .from('items')
        .update({
          extract_status: 'failed',
          extract_error: message,
          extracted_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .select()
        .single(),
    )
  }

  const merged = mergeExtractedMetadata(itemProperties(item), extracted, editedFields(item))

  return unwrap(
    await client
      .from('items')
      .update({
        ...toColumns(merged),
        // Every value is a string, number, or null, so this is Json in fact
        // as well as in shape.
        auto_metadata: extracted as Database['public']['Tables']['items']['Row']['auto_metadata'],
        extract_status: 'ok',
        extract_error: null,
        extracted_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .select()
      .single(),
  )
}
