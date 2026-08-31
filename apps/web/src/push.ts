/*
 * @brief Turn the base64url public key into the bytes pushManager wants.
 * @details The subscription API predates the convention of passing keys as
 *   base64url text, so it takes raw bytes and every application converts them
 *   itself.
 * @param base64url The VAPID public key as it is written in configuration.
 * @return The same key as bytes.
 */
function decodeKey(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/*
 * @brief Read one of the keys off a subscription as text.
 * @param subscription The browser's subscription.
 * @param name Which key to read.
 * @return The key, base64 encoded, or null if the browser did not supply it.
 */
function keyOf(subscription: PushSubscription, name: 'p256dh' | 'auth'): string | null {
  const raw = subscription.getKey(name)
  if (raw === null) return null
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

export interface PushRegistration {
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string
}

/*
 * @brief Whether this browser can be sent notifications at all.
 * @details Safari on iOS only offers this to a page that has been added to the
 *   home screen, and a page served over plain http never has it, so the
 *   capability has to be asked about rather than assumed from the browser's
 *   name.
 */
export function pushIsAvailable(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/*
 * @brief Whether this browser is already registered to receive reminders.
 * @return The registration, or null if there is none.
 */
export async function currentRegistration(): Promise<PushRegistration | null> {
  if (!pushIsAvailable()) return null

  const worker = await navigator.serviceWorker.getRegistration()
  const subscription = await worker?.pushManager.getSubscription()
  if (subscription === undefined || subscription === null) return null

  return describe(subscription)
}

function describe(subscription: PushSubscription): PushRegistration | null {
  const p256dh = keyOf(subscription, 'p256dh')
  const auth = keyOf(subscription, 'auth')
  if (p256dh === null || auth === null) return null

  return { endpoint: subscription.endpoint, p256dh, auth, userAgent: navigator.userAgent }
}

/*
 * @brief Ask this browser to receive reminders.
 * @details The permission prompt is only shown in response to something the
 *   person did; browsers refuse it otherwise, and rightly, so this must be
 *   called from a click.
 * @param publicKey The sender's VAPID public key.
 * @return The registration to store, or null if permission was refused.
 */
export async function registerForPush(publicKey: string): Promise<PushRegistration | null> {
  if (!pushIsAvailable()) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const worker = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
  await navigator.serviceWorker.ready

  const subscription = await worker.pushManager.subscribe({
    // The only value browsers accept: a push message that arrives must result in
    // something visible, so a service worker cannot use this to wake up quietly.
    userVisibleOnly: true,
    applicationServerKey: decodeKey(publicKey) as BufferSource,
  })

  return describe(subscription)
}

/*
 * @brief Stop this browser receiving reminders.
 * @return The endpoint that was cancelled, so its row can be removed, or null
 *   if there was nothing registered.
 */
export async function unregisterFromPush(): Promise<string | null> {
  if (!pushIsAvailable()) return null

  const worker = await navigator.serviceWorker.getRegistration()
  const subscription = await worker?.pushManager.getSubscription()
  if (subscription === undefined || subscription === null) return null

  const { endpoint } = subscription
  await subscription.unsubscribe()
  return endpoint
}
