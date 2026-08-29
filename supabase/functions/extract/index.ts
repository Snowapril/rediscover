import { DOMParser } from 'jsr:@b-fuze/deno-dom@0.1.49'
import { parseMetadata } from '../../../packages/core/src/extract.ts'
import { assertFetchable } from '../../../packages/core/src/fetch-policy.ts'

/*
 * @brief How long the origin has to answer before the fetch is abandoned.
 */
const FETCH_TIMEOUT_MS = 10_000

/*
 * @brief How much of a response is read before giving up on it.
 * @details A page large enough to exceed this is not one worth extracting from,
 *   and reading it whole would let one request exhaust the function's memory.
 */
const MAX_BYTES = 3_000_000

const MAX_REDIRECTS = 5

/*
 * @brief Identify the fetcher rather than impersonate a browser.
 */
const USER_AGENT = 'rediscover-extract/0.1 (+https://github.com/Snowapril/rediscover)'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/*
 * @brief Read a response body up to a byte ceiling.
 * @param response The response to drain.
 * @return The decoded text, truncated at the ceiling.
 */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (reader === undefined) return ''

  const chunks: Uint8Array[] = []
  let total = 0
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  await reader.cancel().catch(() => {})

  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk.subarray(0, Math.min(chunk.length, total - offset)), offset)
    offset += chunk.length
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(joined)
}

/*
 * @brief Fetch a page, checking every address in the redirect chain.
 * @details Redirects are followed by hand because a public URL is free to
 *   redirect into a private one, and the guard would otherwise only ever see
 *   the address the user supplied.
 * @param startUrl The address the user asked for.
 * @return The final response and the address it came from.
 */
async function fetchPage(startUrl: URL): Promise<{ response: Response; finalUrl: string }> {
  let current = startUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
    const response = await fetch(current, {
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    })

    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location !== null) {
      await response.body?.cancel().catch(() => {})
      current = assertFetchable(new URL(location, current).toString())
      continue
    }

    return { response, finalUrl: current.toString() }
  }

  throw new Error('Too many redirects')
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405)

  // The function is exposed with JWT verification on, so reaching this point
  // means a signed-in caller; the header is still required explicitly so a
  // misconfiguration fails closed.
  if (request.headers.get('Authorization') === null) {
    return json({ error: 'Not signed in' }, 401)
  }

  let url: string
  try {
    const body = (await request.json()) as { url?: unknown }
    if (typeof body.url !== 'string') return json({ error: 'Expected a url' }, 400)
    url = body.url
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }

  let target: URL
  try {
    target = assertFetchable(url)
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'Unusable URL' }, 400)
  }

  try {
    const { response, finalUrl } = await fetchPage(target)
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      return json({ error: `The page answered ${response.status}` }, 502)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('html') && !contentType.includes('xml')) {
      await response.body?.cancel().catch(() => {})
      return json({ error: `Not a web page (${contentType || 'unknown type'})` }, 415)
    }

    const html = await readCapped(response)
    const document = new DOMParser().parseFromString(html, 'text/html')
    if (document === null) return json({ error: 'Could not read the page' }, 502)

    return json({ metadata: parseMetadata(document as unknown as Document, finalUrl) }, 200)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Could not reach the page'
    return json({ error: message }, 502)
  }
})
