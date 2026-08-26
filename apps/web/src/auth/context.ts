import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthValue {
  /*
   * @brief The signed-in session, or null while signed out.
   */
  session: Session | null
  /*
   * @brief True until the stored session has been read back at startup.
   * @details Routing decisions must wait for this, or a signed-in user is
   *   bounced to the sign in screen on every reload.
   */
  loading: boolean
  signIn(email: string, password: string): Promise<string | null>
  signUp(email: string, password: string): Promise<string | null>
  signOut(): Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)
