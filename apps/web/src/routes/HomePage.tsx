import { useAuth } from '../auth/useAuth.js'

/*
 * @brief The signed-in shell.
 * @details A placeholder for the collection tree and item list that follow; it
 *   exists so the session and sign out path can be exercised end to end.
 */
export function HomePage() {
  const { session, signOut } = useAuth()

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <span className="text-sm font-semibold tracking-tight">rediscover</span>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{session?.user.email}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-line px-2 py-1 text-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="px-6 py-10">
        <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted">Nothing scrapped yet.</p>
      </main>
    </div>
  )
}
