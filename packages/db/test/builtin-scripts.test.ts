import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { orderByKeys, type ScriptItem, type SortKey } from '@rediscover/core'
import { runExports, runScript } from '@rediscover/script-engine'
import { createTestDb, type TestDb } from '../src/testing.ts'

/*
 * @brief The scripts shipped in a migration, run in the sandbox that will run them.
 * @details Checking the seeded source merely contains the right export would let
 *   a script with a runtime fault ship and only fail the moment somebody picked
 *   it. These load the real rows out of the real migration and put them through
 *   the real engine.
 */
let db: TestDb
let scripts: { name: string; kind: string; source: string }[]

beforeAll(async () => {
  db = await createTestDb()
  const result = await db.pg.query<{ name: string; kind: string; source: string }>(
    'select name, kind, source from scripts where is_builtin order by kind, name',
  )
  scripts = result.rows
}, 60_000)

afterAll(async () => {
  await db.close()
})

const DAY = 86_400_000

function scrap(overrides: Partial<ScriptItem>): ScriptItem {
  return {
    id: 'id',
    url: 'https://example.com/a',
    domain: 'example.com',
    title: 'Untitled',
    excerpt: null,
    thumbnailUrl: null,
    siteName: null,
    author: null,
    publishedAt: null,
    createdAt: 0,
    updatedAt: 0,
    readState: 'unread',
    readAt: null,
    isImportant: false,
    tags: [],
    readingTimeMin: null,
    mediaType: null,
    note: null,
    ...overrides,
  }
}

// Deliberately awkward: a scrap with no title, none with a reading time in
// common, and two sites, so a script that assumes a field is present fails here
// rather than in somebody's folder.
const SAMPLE: ScriptItem[] = [
  scrap({
    id: 'old-important',
    title: null,
    domain: 'zeta.example',
    siteName: null,
    createdAt: 10 * DAY,
    isImportant: true,
    readingTimeMin: 20,
  }),
  scrap({
    id: 'new-read',
    title: 'Beta',
    domain: 'alpha.example',
    siteName: 'Alpha',
    createdAt: 40 * DAY,
    readState: 'read',
    readAt: 41 * DAY,
    readingTimeMin: null,
  }),
  scrap({
    id: 'mid-unread',
    title: 'alpha',
    domain: 'alpha.example',
    siteName: 'Alpha',
    createdAt: 25 * DAY,
    readingTimeMin: 3,
  }),
]

async function keysOf(source: string): Promise<SortKey[]> {
  const outcome = await runScript(source, 'key', SAMPLE)
  if (!outcome.ok) throw new Error(outcome.message)
  return outcome.values as SortKey[]
}

async function orderOf(source: string): Promise<string[]> {
  return orderByKeys(SAMPLE, await keysOf(source)).map((item) => item.id)
}

describe('every built-in script', () => {
  it('runs without failing on an awkward folder', async () => {
    expect(scripts.length).toBeGreaterThan(0)
    for (const script of scripts) {
      const exportName = script.kind === 'sort' ? 'key' : 'group'
      const outcome = await runScript(script.source, exportName, SAMPLE)
      expect(outcome.ok, `${script.kind} script "${script.name}": ${
        outcome.ok ? '' : outcome.message
      }`).toBe(true)
      if (outcome.ok) expect(outcome.values).toHaveLength(SAMPLE.length)
    }
  })

  it('has group scripts that all produce a label', async () => {
    for (const script of scripts.filter((entry) => entry.kind === 'group')) {
      const outcome = await runScript(script.source, 'group', SAMPLE)
      expect(outcome.ok).toBe(true)
      if (outcome.ok) {
        for (const value of outcome.values) {
          expect(typeof value, `group script "${script.name}"`).toBe('string')
        }
      }
    }
  })
})

describe('what the built-in sorts actually do', () => {
  function sourceOf(name: string): string {
    const script = scripts.find((entry) => entry.name === name && entry.kind === 'sort')
    if (script === undefined) throw new Error(`no built-in sort script called ${name}`)
    return script.source
  }

  it('orders newest first', async () => {
    expect(await orderOf(sourceOf('Newest first'))).toEqual([
      'new-read',
      'mid-unread',
      'old-important',
    ])
  })

  it('orders oldest first', async () => {
    expect(await orderOf(sourceOf('Oldest first'))).toEqual([
      'old-important',
      'mid-unread',
      'new-read',
    ])
  })

  it('lifts unread above read, newest of each first', async () => {
    expect(await orderOf(sourceOf('Unread first'))).toEqual([
      'mid-unread',
      'old-important',
      'new-read',
    ])
  })

  it('lifts the flagged scrap to the top', async () => {
    expect((await orderOf(sourceOf('Important first')))[0]).toBe('old-important')
  })

  it('orders by title, case-insensitively, and does not choke on a missing one', async () => {
    // 'alpha' before 'Beta' proves the lowercasing; the untitled scrap falls
    // back to its address, which begins with 'h'.
    expect(await orderOf(sourceOf('By title'))).toEqual([
      'mid-unread',
      'new-read',
      'old-important',
    ])
  })

  it('keeps a site together, newest first within it', async () => {
    expect(await orderOf(sourceOf('By site'))).toEqual([
      'new-read',
      'mid-unread',
      'old-important',
    ])
  })

  it('puts short reads first and scraps with no estimate last', async () => {
    expect(await orderOf(sourceOf('Quickest to read'))).toEqual([
      'mid-unread',
      'old-important',
      'new-read',
    ])
  })
})

describe('the categories a sort script names', () => {
  async function categoriesOf(name: string): Promise<(string | null)[]> {
    const script = scripts.find((entry) => entry.name === name && entry.kind === 'sort')
    if (script === undefined) throw new Error(`no built-in sort script called ${name}`)
    const outcome = await runExports(
      script.source,
      [{ name: 'category', kind: 'label', required: true }],
      SAMPLE,
    )
    if (!outcome.ok) throw new Error(outcome.message)
    return outcome.values['category'] as (string | null)[]
  }

  it('splits the default sort into what is waiting and what is done', async () => {
    // SAMPLE is [unread, read, unread] in that order.
    expect(await categoriesOf('Newest first')).toEqual(['Unread', 'Read', 'Unread'])
  })

  it('separates the flagged scrap', async () => {
    expect(await categoriesOf('Important first')).toEqual([
      'Important',
      'Everything else',
      'Everything else',
    ])
  })

  it('names a site, falling back to its host when there is no site name', async () => {
    expect(await categoriesOf('By site')).toEqual(['zeta.example', 'Alpha', 'Alpha'])
  })

  it('files a title under its first letter, and anything else under #', async () => {
    // SAMPLE is [no title, 'Beta', 'alpha']; the untitled scrap falls back to
    // its address, which starts with 'h'.
    expect(await categoriesOf('By title')).toEqual(['H', 'B', 'A'])
  })

  it('buckets by length and says so when there is no estimate', async () => {
    expect(await categoriesOf('Quickest to read')).toEqual([
      'Over 15 minutes',
      'Length unknown',
      'Under 5 minutes',
    ])
  })

  it('gives every sort script a category, since the list offers them for all', async () => {
    for (const script of scripts.filter((entry) => entry.kind === 'sort')) {
      const outcome = await runExports(
        script.source,
        [{ name: 'category', kind: 'label', required: false }],
        SAMPLE,
      )
      expect(outcome.ok, script.name).toBe(true)
      if (outcome.ok) {
        expect(Object.keys(outcome.values), `sort script "${script.name}"`).toContain('category')
      }
    }
  })
})
