import type { Session } from '@supabase/supabase-js'

const SESSION_REQUEST = 'rediscover:session-request'
const SESSION_OFFER = 'rediscover:session-offer'

/*
 * @brief What the extension is given: enough to rebuild a signed-in client.
 */
interface SharedSession {
  userId: string
  accessToken: string
  refreshToken: string
  email: string | null
}

function share(session: Session | null): SharedSession | null {
  if (session === null) return null
  return {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    email: session.user.email ?? null,
  }
}

/*
 * @brief Hand the signed-in session to the browser extension when it asks.
 * @details The extension could read the token out of storage itself, since its
 *   content script shares this origin. Answering a request instead means the
 *   page decides what it gives away, and the arrangement does not quietly break
 *   the day the auth client changes where it keeps things.
 *
 *   The message never leaves this origin: the listener ignores anything from
 *   another window or another origin, and the reply is posted back with this
 *   origin as its target. Nothing is exposed that a script already running on
 *   this page could not read anyway.
 * @param currentSession Reads the session at the moment of the request.
 * @return A function that removes the listener.
 */
export function serveSessionToExtension(currentSession: () => Session | null): () => void {
  const respond = (): void => {
    window.postMessage(
      { type: SESSION_OFFER, session: share(currentSession()) },
      window.location.origin,
    )
  }

  const onMessage = (event: MessageEvent): void => {
    if (event.source !== window) return
    if (event.origin !== window.location.origin) return
    if ((event.data as { type?: unknown }).type !== SESSION_REQUEST) return
    respond()
  }

  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}

/*
 * @brief Tell the extension the session changed, without being asked.
 * @details Signing in or out should reach the extension immediately rather than
 *   the next time it happens to ask.
 * @param session The session now in force, or null after signing out.
 */
export function announceSessionToExtension(session: Session | null): void {
  window.postMessage({ type: SESSION_OFFER, session: share(session) }, window.location.origin)
}
