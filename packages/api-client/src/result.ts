import type { PostgrestError } from '@supabase/supabase-js'

/*
 * @brief Unwrap a Supabase result, turning a reported error into a thrown one.
 * @details Supabase returns errors in the value rather than rejecting, which is
 *   easy to forget to check. Every query here goes through this so a failure
 *   surfaces instead of reading as an empty result.
 * @param result The data-and-error pair a query resolves to.
 * @return The data.
 */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error !== null) throw new Error(result.error.message, { cause: result.error })
  if (result.data === null) throw new Error('query returned no data')
  return result.data
}

/*
 * @brief Unwrap a Supabase result that is expected to return nothing.
 * @param result The error carrier a mutation resolves to.
 */
export function unwrapVoid(result: { error: PostgrestError | null }): void {
  if (result.error !== null) throw new Error(result.error.message, { cause: result.error })
}
