import { describe, expect, it } from 'vitest'
import type { ScriptItem } from '@rediscover/core'
import { runScript } from '../src/run.ts'

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

  it('stops a script that eats memory', async () => {
    const outcome = await runScript(
      'export function key() { const a = []; while (true) a.push(new Array(1000).fill(1)); }',
      KEY,
      [scrap()],
      { timeoutMs: 5000, memoryBytes: 1024 * 1024 },
    )
    expect(outcome.ok).toBe(false)
  })

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

  it('handles a large folder within its time budget', async () => {
    const many = Array.from({ length: 5000 }, (_, index) => scrap({ createdAt: index }))
    const outcome = await runScript('export function key(item) { return -item.createdAt }', KEY, many)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.values).toHaveLength(5000)
  })
})
