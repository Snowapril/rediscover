import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth.ts'

type Mode = 'signIn' | 'signUp'

/*
 * @brief The sign in screen.
 * @details Email and password only. Social providers are configured but
 *   disabled until their credentials exist, so this is the whole surface for
 *   now; adding one later adds buttons here and changes nothing else.
 */
export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const message = mode === 'signIn' ? await signIn(email, password) : await signUp(email, password)
    if (message !== null) setError(message)
    setBusy(false)
  }

  const field =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none ' +
    'placeholder:text-muted focus:border-accent'

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">rediscover</h1>
        <p className="mt-1 text-sm text-muted">Save it now, and actually come back to read it.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={field}
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={field}
          />

          {error !== null && <p className="text-sm text-accent">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-ink px-3 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            {busy ? 'Working…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn')
            setError(null)
          }}
          className="mt-4 text-sm text-muted underline underline-offset-4"
        >
          {mode === 'signIn' ? 'Create an account' : 'I already have an account'}
        </button>
      </div>
    </main>
  )
}
