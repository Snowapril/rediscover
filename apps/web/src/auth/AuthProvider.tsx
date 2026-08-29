import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase.ts'
import { AuthContext, type AuthValue } from './context.ts'
import { announceSessionToExtension, serveSessionToExtension } from './extensionBridge.ts'

/*
 * @brief Track the Supabase session and expose it to the tree below.
 * @details Reads the persisted session once at startup and then follows every
 *   later change, so a token refresh or a sign out in another tab is picked up
 *   without a reload.
 * @param children The subtree that may call useAuth.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Read through a ref so the listener installed below always sees the current
  // session without being torn down and rebuilt on every change.
  const latest = useRef<Session | null>(null)
  latest.current = session

  useEffect(() => serveSessionToExtension(() => latest.current), [])

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      announceSessionToExtension(nextSession)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error?.message ?? null
      },
      async signUp(email, password) {
        const { error } = await supabase.auth.signUp({ email, password })
        return error?.message ?? null
      },
      async signOut() {
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
