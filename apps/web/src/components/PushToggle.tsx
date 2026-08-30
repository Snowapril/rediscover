import { useEffect, useState } from 'react'
import {
  currentRegistration,
  pushIsAvailable,
  registerForPush,
  unregisterFromPush,
} from '../push.ts'
import { useRemovePushSubscription, useSavePushSubscription } from '../data/queries.ts'

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/*
 * @brief Turn reminders on this browser on or off.
 * @details Registration is per browser, not per account, which is why this says
 *   "this browser" rather than "notifications": somebody who turned them on at
 *   work and is now on a laptop has not turned anything off, and the wording
 *   should not suggest otherwise.
 */
export function PushToggle() {
  const [registered, setRegistered] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState(false)

  const save = useSavePushSubscription()
  const remove = useRemovePushSubscription()

  useEffect(() => {
    void currentRegistration().then((registration) => setRegistered(registration !== null))
  }, [])

  if (!pushIsAvailable()) {
    return (
      <p className="text-xs text-muted">
        This browser cannot show notifications. On an iPhone, add rediscover to the home screen
        first.
      </p>
    )
  }

  if (PUBLIC_KEY === undefined || PUBLIC_KEY === '') {
    return (
      <p className="text-xs text-muted">
        Notifications are not configured for this deployment.
      </p>
    )
  }

  async function turnOn() {
    setBusy(true)
    setRefused(false)
    try {
      const registration = await registerForPush(PUBLIC_KEY)
      if (registration === null) {
        setRefused(true)
        return
      }
      await save.mutateAsync(registration)
      setRegistered(true)
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      const endpoint = await unregisterFromPush()
      if (endpoint !== null) await remove.mutateAsync(endpoint)
      setRegistered(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy || registered === null}
        onClick={() => void (registered === true ? turnOff() : turnOn())}
        className="rounded-lg border border-line px-3 py-1.5 text-xs disabled:opacity-50"
      >
        {busy
          ? 'Working…'
          : registered === true
            ? 'Stop notifying this browser'
            : 'Notify this browser'}
      </button>

      {refused && (
        <span className="text-xs text-accent">
          This browser refused. Allow notifications for the site in its settings, then try again.
        </span>
      )}
    </div>
  )
}
