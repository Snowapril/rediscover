import { describe, expect, it } from 'vitest'
import type { ScriptItem } from '@rediscover/core'
import { defaultLimitsFor, runExports, runScript } from '../src/run.ts'

function scrap(overrides: Partial<ScriptItem> = {}): ScriptItem {
  return {
    id: 'id',
    url: 'https://example.com/a',
    domain: 'example.com',
    title: 'A title',
    excerpt: null,
    thumbnailUrl: null,
    siteName: null,
    author: null,
    publishedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
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

const KEY = 'key'

describe('runScript', () => {
  it('calls the exported function once per scrap, in order', async () => {
    const outcome = await runScript(
      'export function key(item) { return item.createdAt }',
      KEY,
      [scrap({ createdAt: 3 }), scrap({ createdAt: 1 }), scrap({ createdAt: 2 })],
    )
    expect(outcome).toEqual({ ok: true, values: [3, 1, 2] })
  })

  it('gives the script the whole scrap', async () => {
    const outcome = await runScript(
      'export function key(item) { return [item.domain, item.isImportant, item.tags.length] }',
      KEY,
      [scrap({ domain: 'a.com', isImportant: true, tags: ['x', 'y'] })],
    )
    expect(outcome).toEqual({ ok: true, values: [['a.com', true, 2]] })
  })

  it('accepts an array key for a multi-level sort', async () => {
    const outcome = await runScript(
      'export function key(item) { return [item.isImportant ? 0 : 1, -item.createdAt] }',
      KEY,
      [scrap({ isImportant: false, createdAt: 5 }), scrap({ isImportant: true, createdAt: 1 })],
    )
    expect(outcome).toEqual({ ok: true, values: [[1, -5], [0, -1]] })
  })

  it('returns nothing to sort by rather than failing when the script returns null', async () => {
    const outcome = await runScript('export function key() { return null }', KEY, [scrap()])
    expect(outcome).toEqual({ ok: true, values: [null] })
  })

  it('reports a syntax error instead of throwing', async () => {
    const outcome = await runScript('export function key( {', KEY, [scrap()])
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toMatch(/./)
  })

  it('names the scrap a script failed on', async () => {
    const outcome = await runScript(
      'export function key(item) { if (item.createdAt === 2) throw new Error("nope"); return 1 }',
      KEY,
      [scrap({ createdAt: 1 }), scrap({ createdAt: 2 })],
    )
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toContain('item 2')
  })

  it('rejects a key it cannot order', async () => {
    for (const [body, description] of [
      ['return {}', 'an object'],
      ['return undefined', 'nothing'],
      ['return () => 1', 'a function'],
      ['return 0 / 0', 'not finite'],
      ['return [[1]]', 'nested'],
    ]) {
      const outcome = await runScript(`export function key() { ${body} }`, KEY, [scrap()])
      expect(outcome.ok, body).toBe(false)
      if (!outcome.ok) expect(outcome.message).toContain(description)
    }
  })

  it('says so when the script exports nothing usable', async () => {
    const outcome = await runScript('export const key = 5', KEY, [scrap()])
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toContain('does not export')
  })

  it('stops a script that never finishes', async () => {
    const started = Date.now()
    const outcome = await runScript('export function key() { while (true) {} }', KEY, [scrap()], {
      timeoutMs: 150,
      memoryBytes: 64 * 1024 * 1024,
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toContain('ran too long')
    expect(Date.now() - started).toBeLessThan(3000)
  })

  it('stops a script that eats memory, on memory rather than on the clock', async () => {
    const outcome = await runScript(
      'export function key() { const a = []; while (true) a.push(new Array(100000).fill(1)); }',
      KEY,
      [scrap()],
      { timeoutMs: 2000, memoryBytes: 1024 * 1024 },
    )
    expect(outcome.ok).toBe(false)
    // Asserting which limit fired: allowing the clock to be what stops it would
    // leave the memory limit untested.
    if (!outcome.ok) expect(outcome.message).toContain('memory')
  }, 15_000)

  it('has no way to reach the host', async () => {
    const outcome = await runScript(
      `export function key() {
         return [
           typeof fetch, typeof XMLHttpRequest, typeof process,
           typeof require, typeof setTimeout, typeof WebAssembly,
         ].join(',')
       }`,
      KEY,
      [scrap()],
    )
    expect(outcome).toEqual({
      ok: true,
      values: ['undefined,undefined,undefined,undefined,undefined,undefined'],
    })
  })

  it('cannot import anything', async () => {
    const outcome = await runScript(
      'import fs from "node:fs"\nexport function key() { return 1 }',
      KEY,
      [scrap()],
    )
    expect(outcome.ok).toBe(false)
  })

  it('cannot see the scraps another run was given', async () => {
    await runScript('export function key(item) { globalThis.leak = item.title; return 1 }', KEY, [
      scrap({ title: 'secret' }),
    ])
    const outcome = await runScript(
      'export function key() { return typeof globalThis.leak }',
      KEY,
      [scrap()],
    )
    expect(outcome).toEqual({ ok: true, values: ['undefined'] })
  })

  it('cannot change the scraps it is handed', async () => {
    const outcome = await runScript(
      `export function key(item) {
         try { item.title = 'changed' } catch { /* frozen */ }
         return item.title
       }`,
      KEY,
      [scrap({ title: 'original' })],
    )
    expect(outcome).toEqual({ ok: true, values: ['original'] })
  })

  it('runs a group script the same way', async () => {
    const outcome = await runScript(
      'export function group(item) { return item.readState }',
      'group',
      [scrap({ readState: 'read' }), scrap({ readState: 'unread' })],
    )
    expect(outcome).toEqual({ ok: true, values: ['read', 'unread'] })
  })

  it('handles a folder with nothing in it', async () => {
    const outcome = await runScript('export function key() { return 1 }', KEY, [])
    expect(outcome).toEqual({ ok: true, values: [] })
  })

  it('handles a large folder on its default budget', async () => {
    // The budget scales with the folder, so this passes on a slow machine as
    // well as a fast one. A flat budget tuned on a developer's laptop rejected
    // this on a CI runner.
    const many = Array.from({ length: 5000 }, (_, index) => scrap({ createdAt: index }))
    const outcome = await runScript('export function key(item) { return -item.createdAt }', KEY, many)
    expect(outcome.ok, outcome.ok ? '' : outcome.message).toBe(true)
    if (outcome.ok) expect(outcome.values).toHaveLength(5000)
  })

  it('grows the budget with the folder', () => {
    expect(defaultLimitsFor(0).timeoutMs).toBeLessThan(defaultLimitsFor(5000).timeoutMs)
    // Still tight enough that a runaway script in a small folder is stopped
    // quickly rather than allowed a large folder's budget.
    expect(defaultLimitsFor(10).timeoutMs).toBeLessThan(500)
  })
})

describe('runExports', () => {
  const SORT_AND_CATEGORY = `
    export function key(item) { return -item.createdAt }
    export function category(item) { return item.readState === 'read' ? 'Read' : 'Unread' }
  `

  it('runs several exports in one pass', async () => {
    const outcome = await runExports(
      SORT_AND_CATEGORY,
      [
        { name: 'key', kind: 'sortKey', required: true },
        { name: 'category', kind: 'label', required: false },
      ],
      [scrap({ createdAt: 1, readState: 'read' }), scrap({ createdAt: 2 })],
    )
    expect(outcome).toEqual({
      ok: true,
      values: { key: [-1, -2], category: ['Read', 'Unread'] },
    })
  })

  it('leaves an optional export out rather than returning it empty', async () => {
    // Absent must be distinguishable from "every scrap is uncategorised", or
    // the list cannot tell whether to offer categories at all.
    const outcome = await runExports(
      'export function key(item) { return item.createdAt }',
      [
        { name: 'key', kind: 'sortKey', required: true },
        { name: 'category', kind: 'label', required: false },
      ],
      [scrap()],
    )
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.values['key']).toEqual([1000])
      expect('category' in outcome.values).toBe(false)
    }
  })

  it('fails when a required export is missing', async () => {
    const outcome = await runExports(
      'export function category() { return "x" }',
      [{ name: 'key', kind: 'sortKey', required: true }],
      [scrap()],
    )
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toContain('does not export')
  })

  it('accepts null from a category, meaning the scrap belongs to none', async () => {
    const outcome = await runExports(
      'export function category() { return null }',
      [{ name: 'category', kind: 'label', required: true }],
      [scrap()],
    )
    expect(outcome).toEqual({ ok: true, values: { category: [null] } })
  })

  it('rejects a category that is not a name', async () => {
    for (const [body, description] of [
      ['return 5', 'a number'],
      ['return true', 'a boolean'],
      ['return {}', 'not a name'],
      ['return ""', 'an empty name'],
    ]) {
      const outcome = await runExports(
        `export function category() { ${body} }`,
        [{ name: 'category', kind: 'label', required: true }],
        [scrap()],
      )
      expect(outcome.ok, body).toBe(false)
      if (!outcome.ok) expect(outcome.message).toContain(description)
    }
  })

  it('reports which export failed, not just that something did', async () => {
    const outcome = await runExports(
      `export function key() { return 1 }
       export function category() { throw new Error('bad bucket') }`,
      [
        { name: 'key', kind: 'sortKey', required: true },
        { name: 'category', kind: 'label', required: false },
      ],
      [scrap()],
    )
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.message).toContain('category()')
      expect(outcome.message).toContain('bad bucket')
    }
  })
})
