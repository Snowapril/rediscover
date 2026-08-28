import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@rediscover/db/generated'

/*
 * @brief A Supabase client typed against the rediscover schema.
 */
export type RediscoverClient = SupabaseClient<Database>

/*
 * @brief Build a client for talking to a rediscover backend.
 * @details The key is the project's publishable (anon) key, which is safe to
 *   ship to a browser or an extension: it grants nothing on its own, and every
 *   table is reachable only through row level security once a user signs in.
 *   The session is persisted and refreshed by the client itself.
 * @param url Base URL of the Supabase project.
 * @param publishableKey The project's publishable key.
 * @return A client bound to that project.
 */
export function createRediscoverClient(url: string, publishableKey: string): RediscoverClient {
  return createClient<Database>(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
