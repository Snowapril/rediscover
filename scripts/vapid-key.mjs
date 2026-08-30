/*
 * Generates the VAPID key pair a push sender identifies itself with.
 *
 * The private key is a secret and belongs in the environment, never in the
 * repository. The public key is not a secret — it is handed to every browser
 * that subscribes, which is why it appears in the client's own configuration.
 *
 * Run once per deployment. Regenerating invalidates every existing
 * subscription, because a browser's subscription is bound to the key that
 * created it.
 */
import { webcrypto } from 'node:crypto'

const base64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])

const privateJwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey)
const rawPublic = new Uint8Array(await webcrypto.subtle.exportKey('raw', pair.publicKey))

console.log('VAPID_PRIVATE_KEY=' + JSON.stringify(JSON.stringify(privateJwk)))
console.log('VITE_VAPID_PUBLIC_KEY=' + base64url(rawPublic))
