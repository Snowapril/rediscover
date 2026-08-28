import {
  EMPTY_ITEM_PROPERTIES,
  ITEM_PROPERTY_KEYS,
  type ExtractedMetadata,
  type ItemProperties,
  type ItemPropertyKey,
} from './types.ts'

/*
 * @brief Write one property onto a properties object, skipping absent values.
 * @details `undefined` means the caller had nothing to say about this property,
 *   which is distinct from `null` — an explicit "this property does not exist".
 * @param target The object to write into; mutated in place.
 * @param key The property to write.
 * @param value The new value, or undefined to leave the property untouched.
 */
function assignProperty<K extends ItemPropertyKey>(
  target: ItemProperties,
  key: K,
  value: ItemProperties[K] | undefined,
): void {
  if (value === undefined) return
  target[key] = value
}

/*
 * @brief Fold a fresh extraction result into an item's current properties.
 * @details A property the user has edited is never overwritten, no matter what
 *   extraction returns. For the remaining properties, a key present in
 *   `extracted` wins — including when its value is null, which means extraction
 *   ran and found the property genuinely absent. A key missing from `extracted`
 *   leaves the current value untouched.
 * @param current The item's effective properties before this extraction.
 * @param extracted What extraction just produced.
 * @param editedFields Property names the user has overridden by hand.
 * @return The item's effective properties after the extraction.
 */
export function mergeExtractedMetadata(
  current: ItemProperties,
  extracted: ExtractedMetadata,
  editedFields: readonly ItemPropertyKey[],
): ItemProperties {
  const edited = new Set<ItemPropertyKey>(editedFields)
  const merged: ItemProperties = { ...current }

  for (const key of ITEM_PROPERTY_KEYS) {
    if (edited.has(key)) continue
    assignProperty(merged, key, extracted[key])
  }

  return merged
}

/*
 * @brief Apply a hand edit to an item's properties and record which fields it claims.
 * @details Every property named in `patch` becomes user-owned from this point on,
 *   so later extractions leave it alone. Editing a property back to its extracted
 *   value still marks it edited; use resetProperties to give a property back to
 *   extraction.
 * @param current The item's effective properties before the edit.
 * @param patch The properties the user changed.
 * @param editedFields Property names the user had already overridden.
 * @return The updated properties and the grown set of edited property names.
 */
export function applyUserEdit(
  current: ItemProperties,
  patch: ExtractedMetadata,
  editedFields: readonly ItemPropertyKey[],
): { properties: ItemProperties; editedFields: ItemPropertyKey[] } {
  const edited = new Set<ItemPropertyKey>(editedFields)
  const properties: ItemProperties = { ...current }

  for (const key of ITEM_PROPERTY_KEYS) {
    if (patch[key] === undefined) continue
    assignProperty(properties, key, patch[key])
    edited.add(key)
  }

  return {
    properties,
    editedFields: ITEM_PROPERTY_KEYS.filter((key) => edited.has(key)),
  }
}

/*
 * @brief Hand properties back to automatic extraction, discarding the user's overrides.
 * @details A property that extraction never found is cleared rather than left at
 *   the user's value, so the reset is always visible.
 * @param current The item's effective properties.
 * @param autoMetadata The last raw extraction result stored alongside the item.
 * @param editedFields Property names the user has overridden.
 * @param keys The properties to reset.
 * @return The restored properties and the shrunk set of edited property names.
 */
export function resetProperties(
  current: ItemProperties,
  autoMetadata: ExtractedMetadata,
  editedFields: readonly ItemPropertyKey[],
  keys: readonly ItemPropertyKey[],
): { properties: ItemProperties; editedFields: ItemPropertyKey[] } {
  const reset = new Set<ItemPropertyKey>(keys)
  const properties: ItemProperties = { ...current }

  for (const key of ITEM_PROPERTY_KEYS) {
    if (!reset.has(key)) continue
    const extracted = autoMetadata[key]
    assignProperty(properties, key, extracted === undefined ? EMPTY_ITEM_PROPERTIES[key] : extracted)
  }

  return { properties, editedFields: editedFields.filter((key) => !reset.has(key)) }
}
