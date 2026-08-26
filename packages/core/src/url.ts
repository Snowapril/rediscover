/*
 * @brief Query parameters that identify a referral or campaign rather than the resource.
 */
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'msclkid',
  'yclid',
  'twclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref_src',
  '_hsenc',
  '_hsmi',
  'spm',
  'scid',
  'vero_id',
  'vero_conv',
])

const TRACKING_PARAM_PREFIXES = ['utm_']

/*
 * @brief A fragment that encodes a client-side route rather than an in-page anchor.
 */
function isRoutingFragment(hash: string): boolean {
  return hash.startsWith('#!/') || hash.startsWith('#/')
}

function isTrackingParam(name: string): boolean {
  const lowered = name.toLowerCase()
  return (
    TRACKING_PARAMS.has(lowered) ||
    TRACKING_PARAM_PREFIXES.some((prefix) => lowered.startsWith(prefix))
  )
}

/*
 * @brief Reduce a URL to a stable identity string used to detect duplicate scraps.
 * @details The result is for comparison only and must never be navigated to: the
 *   scheme is forced to https, a leading `www.` is dropped, tracking parameters are
 *   removed, the remaining query is sorted, and a trailing slash is trimmed. The
 *   fragment is discarded unless it encodes a client-side route. Only http and
 *   https URLs are accepted; a bare `example.com/x` is treated as https.
 * @param raw The URL as the user or the browser supplied it.
 * @return The canonical form, or null if the input is not a usable web URL.
 */
export function canonicalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  let url: URL
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.hostname === '') return null

  url.protocol = 'https:'
  url.username = ''
  url.password = ''
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4)
  }

  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParam(name)) url.searchParams.delete(name)
  }
  url.searchParams.sort()

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1)
  }

  const fragment = isRoutingFragment(url.hash) ? url.hash : ''
  const query = url.searchParams.toString()

  return `${url.protocol}//${url.host}${url.pathname}${query === '' ? '' : `?${query}`}${fragment}`
}

/*
 * @brief Extract the display domain of a URL, without a leading `www.`.
 * @param raw The URL as the user or the browser supplied it.
 * @return The hostname, or null if the input is not a usable web URL.
 */
export function extractDomain(raw: string): string | null {
  const canonical = canonicalizeUrl(raw)
  if (canonical === null) return null
  return new URL(canonical).hostname
}
