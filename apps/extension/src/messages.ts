/*
 * @brief The session the web app hands to the extension.
 * @details Only what is needed to rebuild a signed-in client; the rest of the
 *   Supabase session object is not the extension's business.
 */
export interface SharedSession {
  userId: string
  accessToken: string
  refreshToken: string
  email: string | null
}

/*
 * @brief The message the page and the content script exchange.
 * @details Named rather than anonymous so a page that is not the rediscover web
 *   app cannot accidentally satisfy the handshake.
 */
export const SESSION_REQUEST = 'rediscover:session-request'
export const SESSION_OFFER = 'rediscover:session-offer'

export const STORAGE_KEY = 'rediscover.session'
