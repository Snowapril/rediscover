/*
 * @brief Host names that always refer to the machine doing the fetching.
 */
const LOCAL_NAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', '[::1]'])

/*
 * @brief Whether a dotted-quad address belongs to a range that is not routable
 *   on the public internet.
 * @param host The host as written in the URL.
 * @return True if it is a private, loopback, or link-local IPv4 address.
 */
function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false

  const octets = parts.map((part) => Number(part))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false

  const [a, b] = octets as [number, number, number, number]
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true // link-local, and the cloud metadata address
  if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
  return false
}

function isPrivateIPv6(host: string): boolean {
  const address = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (address === '::1' || address === '::') return true
  if (address.startsWith('fe80:')) return true // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(address)) return true // unique local
  return false
}

/*
 * @brief Reject an address the server must not be made to fetch.
 * @details The function fetches whatever a signed-in user asks it to, which
 *   makes it a way to reach anything the server can reach but the user cannot:
 *   the loopback interface, private networks, and the cloud metadata endpoint.
 *   Only http and https are allowed, and hosts inside those ranges are refused.
 *   This checks the literal host, so a name that resolves into a private range
 *   is not caught here; the deployed function relies on egress rules for that.
 * @param raw The address to fetch.
 * @return The parsed URL.
 */
export function assertFetchable(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Not a URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported scheme: ${url.protocol}`)
  }

  const host = url.hostname.toLowerCase()
  if (LOCAL_NAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('Refusing to fetch a local address')
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw new Error('Refusing to fetch a private address')
  }

  return url
}
