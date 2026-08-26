import { describe, expect, it } from 'vitest'
import { applyUserEdit, mergeExtractedMetadata, resetProperties } from '../src/metadata.js'
import { EMPTY_ITEM_PROPERTIES } from '../src/types.js'

const empty = EMPTY_ITEM_PROPERTIES

describe('mergeExtractedMetadata', () => {
  it('fills properties that extraction found', () => {
    const merged = mergeExtractedMetadata(empty, { title: 'Real Title', readingTimeMin: 8 }, [])
    expect(merged.title).toBe('Real Title')
    expect(merged.readingTimeMin).toBe(8)
    expect(merged.excerpt).toBeNull()
  })

  it('never overwrites a property the user edited', () => {
    const current = { ...empty, title: 'My own title' }
    const merged = mergeExtractedMetadata(current, { title: 'Scraped title', author: 'Kim' }, ['title'])
    expect(merged.title).toBe('My own title')
    expect(merged.author).toBe('Kim')
  })

  it('leaves a property alone when extraction says nothing about it', () => {
    const current = { ...empty, excerpt: 'previously extracted' }
    const merged = mergeExtractedMetadata(current, { title: 'New' }, [])
    expect(merged.excerpt).toBe('previously extracted')
  })

  it('clears a property when extraction explicitly reports it absent', () => {
    const current = { ...empty, thumbnailUrl: 'https://example.com/old.png' }
    const merged = mergeExtractedMetadata(current, { thumbnailUrl: null }, [])
    expect(merged.thumbnailUrl).toBeNull()
  })

  it('does not mutate its inputs', () => {
    const current = { ...empty, title: 'before' }
    mergeExtractedMetadata(current, { title: 'after' }, [])
    expect(current.title).toBe('before')
  })
})

describe('applyUserEdit', () => {
  it('records every patched property as user-owned', () => {
    const result = applyUserEdit(empty, { title: 'Mine', excerpt: 'Also mine' }, [])
    expect(result.properties.title).toBe('Mine')
    expect(result.editedFields).toEqual(['title', 'excerpt'])
  })

  it('marks a field edited even when set back to the extracted value', () => {
    const current = { ...empty, title: 'Scraped' }
    const result = applyUserEdit(current, { title: 'Scraped' }, [])
    expect(result.editedFields).toEqual(['title'])
  })

  it('keeps previously edited fields and reports them in a stable order', () => {
    const result = applyUserEdit(empty, { author: 'Kim' }, ['excerpt'])
    expect(result.editedFields).toEqual(['excerpt', 'author'])
  })

  it('survives a later extraction', () => {
    const edited = applyUserEdit(empty, { title: 'Mine' }, [])
    const merged = mergeExtractedMetadata(edited.properties, { title: 'Scraped' }, edited.editedFields)
    expect(merged.title).toBe('Mine')
  })
})

describe('resetProperties', () => {
  it('restores the extracted value and releases user ownership', () => {
    const auto = { title: 'Scraped title' }
    const current = { ...empty, title: 'Mine' }
    const result = resetProperties(current, auto, ['title', 'excerpt'], ['title'])
    expect(result.properties.title).toBe('Scraped title')
    expect(result.editedFields).toEqual(['excerpt'])
  })

  it('clears the property when extraction never found it', () => {
    const current = { ...empty, author: 'Mine' }
    const result = resetProperties(current, {}, ['author'], ['author'])
    expect(result.properties.author).toBeNull()
    expect(result.editedFields).toEqual([])
  })
})
