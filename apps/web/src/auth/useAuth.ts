import { useContext } from 'react'
import { AuthContext, type AuthValue } from './context.ts'

/*
 * @brief Read the current authentication state.
 * @details Must be called inside an AuthProvider.
 * @return The session, its loading state, and the sign in and out actions.
 */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (value === null) throw new Error('useAuth must be used inside an AuthProvider')
  return value
}
