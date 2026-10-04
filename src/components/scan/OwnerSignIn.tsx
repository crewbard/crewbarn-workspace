import { useState } from 'react'
import {
  clearOwnerToken,
  ownerName,
  setOwnerToken,
  signInAsOwner,
  type OwnerIdentity,
} from '@/lib/assetOwner'

/**
 * "Is this your building?"
 *
 * A private label was a dead end for the one person who should never have
 * been stopped by it. It offered a code, and the code came from the
 * servicer, who decided whether the building's owner could look at
 * their own equipment.
 *
 * So this card comes FIRST on a private record, above the inspector's
 * options — the most likely person holding the phone in front of a
 * private label is somebody who works in that building.
 *
 * It is the same login they use for their invoices. Somebody who owns a
 * building should not need a second account for their own equipment.
 */
export function OwnerSignInCard({ onSignedIn }: { onSignedIn: (who: OwnerIdentity) => void }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { token, identity } = await signInAsOwner(email.trim(), password)
      setOwnerToken(token)
      onSignedIn(identity)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign you in.')
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Is this your building?</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        Sign in with the login you use for your service provider&rsquo;s customer portal.
        You&rsquo;ll see everything on your own equipment, no code needed.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Sign in with portal login
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
            />
          </label>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
    </div>
  )
}

/**
 * Signed in, and what that means.
 *
 * It says which account and what it gets them, because somebody who
 * scanned a label and suddenly sees more should know why — and because the
 * same browser might be a contractor's tomorrow. Sign out is here for
 * exactly that.
 */
export function OwnerBar({
  identity,
  scope,
  accessUrl,
  onSignedOut,
}: {
  identity: OwnerIdentity
  /** "everything on your own equipment", or a named property. */
  scope?: string | null
  accessUrl?: string | null
  onSignedOut: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <span aria-hidden="true" className="font-semibold text-emerald-700">
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-emerald-900">
          Signed in as {ownerName(identity)} · owner
        </p>
        {scope && <p className="text-xs leading-relaxed text-emerald-800">You see {scope}</p>}
      </div>

      {accessUrl && (
        <a
          href={accessUrl}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-emerald-800 hover:underline"
        >
          Access ›
        </a>
      )}

      <button
        type="button"
        onClick={() => {
          clearOwnerToken()
          onSignedOut()
        }}
        className="inline-flex min-h-[44px] items-center text-sm text-emerald-800 hover:underline"
      >
        Sign out
      </button>
    </div>
  )
}
