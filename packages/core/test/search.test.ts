import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  filtersWithin,
  narrowsAnything,
  savedWindow,
  NO_FILTERS,
  type SearchFilters,
} from '../src/search.ts'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 8, 1)

function withFilters(overrides: Partial<SearchFilters>): SearchFilters {
  return { ...NO_FILTERS, ...overrides }
}

describe('narrowsAnything', () => {
  it('refuses a search that narrows nothing', () => {
    // Asking for everything is browsing, and the folder views do that better.
    expect(narrowsAnything(NO_FILTERS)).toBe(false)
    expect(narrowsAnything(withFilters({ text: '   ' }))).toBe(false)
  })

  it('accepts words alone', () => {
    expect(narrowsAnything(withFilters({ text: 'vulkan' }))).toBe(true)
  })

  it('accepts a filter with no words, since that is a real question', () => {
    expect(narrowsAnything(withFilters({ states: ['unread'] }))).toBe(true)
    expect(narrowsAnything(withFilters({ flaggedOnly: true }))).toBe(true)
    expect(narrowsAnything(withFilters({ savedWithin: 'year' }))).toBe(true)
    expect(narrowsAnything(withFilters({ kinds: ['video'] }))).toBe(true)
    expect(narrowsAnything(withFilters({ scope: { kind: 'inbox' } }))).toBe(true)
  })
})

describe('activeFilterCount', () => {
  it('counts the narrowings that are out of sight, not the words', () => {
    // The words are in the box; the filters may be behind a disclosure, so they
    // are what the badge is for.
    expect(activeFilterCount(withFilters({ text: 'vulkan' }))).toBe(0)
    expect(activeFilterCount(withFilters({ states: ['unread'], flaggedOnly: true }))).toBe(2)
  })

  it('counts a folder scope but not the whole library', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0)
    expect(
      activeFilterCount(
        withFilters({ scope: { kind: 'folder', id: 'a', includeSubfolders: true } }),
      ),
    ).toBe(1)
  })
})

describe('filtersWithin', () => {
  it('starts a folder search inside that folder, not recursively', () => {
    expect(filtersWithin('folder-1').scope).toEqual({
      kind: 'folder',
      id: 'folder-1',
      includeSubfolders: false,
    })
  })

  it('treats no folder as the inbox', () => {
    expect(filtersWithin(null).scope).toEqual({ kind: 'inbox' })
  })

  it('leaves everything else unnarrowed', () => {
    const filters = filtersWithin('folder-1')
    expect(filters.text).toBe('')
    expect(filters.states).toEqual([])
    expect(filters.savedWithin).toBe('any')
  })
})

describe('savedWindow', () => {
  it('has no bounds for any time', () => {
    expect(savedWindow('any', NOW)).toEqual({ after: null, before: null })
  })

  it('reaches back from now for a recent span', () => {
    expect(savedWindow('week', NOW).after?.getTime()).toBe(NOW - 7 * DAY)
    expect(savedWindow('year', NOW).after?.getTime()).toBe(NOW - 365 * DAY)
    expect(savedWindow('month', NOW).before).toBeNull()
  })

  it('is a ceiling rather than a floor for what is over a year old', () => {
    // The one span that looks the other way, because the scraps most likely to
    // be lost are the oldest and every other span excludes them.
    const window = savedWindow('older', NOW)
    expect(window.after).toBeNull()
    expect(window.before?.getTime()).toBe(NOW - 365 * DAY)
  })
})
