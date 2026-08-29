import { SESSION_OFFER, SESSION_REQUEST, STORAGE_KEY, type SharedSession } from './messages.ts'

/*
 * @brief Ask the rediscover web app for the signed-in session and keep it.
 * @details Runs only on the web app's own origin. The page is asked rather than
 *   read: taking the token straight out of storage would work, but it would
 *   also mean the extension helps itself to a credential the page never offered,
 *   and it would break the moment the client changes where it keeps it.
 */
function requestSession(): void {
  window.postMessage({ type: SESSION_REQUEST }, window.location.origin)
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  if (event.origin !== window.location.origin) return

  const data = event.data as { type?: unknown; session?: SharedSession | null }
  if (data.type !== SESSION_OFFER) return

  void chrome.storage.local.set({ [STORAGE_KEY]: data.session ?? null })
})

requestSession()

// The offer is repeated after signing in or out, but a page that loaded before
// this script did needs asking again.
window.setTimeout(requestSession, 500)
