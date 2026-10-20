import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { Modal } from '@/components/ui/Modal'

/**
 * RequirePermission — page-level / section-level access guard.
 *
 * Renders children only if the current user has at least one of `permissions`.
 *
 * Usage:
 *   <RequirePermission permission="customers.view">
 *     <CustomersPage />
 *   </RequirePermission>
 *
 *   <RequirePermission permissions={['jobs.edit', 'jobs.view']}>
 *     <JobsPage />
 *   </RequirePermission>
 *
 * On denied: renders NotAuthorizedNotice (a small inline panel) unless a
 * custom `fallback` prop is supplied.
 *
 * On permission load: renders nothing (avoids a flash of denied content).
 *
 * Note: backend is the source of truth. This is UX — direct API hits
 * are still gated by the EnsurePermission middleware.
 */
interface Props {
  permission?: string
  permissions?: string[]
  children: ReactNode
  fallback?: ReactNode
}

export function RequirePermission({ permission, permissions, children, fallback }: Props) {
  const { hasAny, isLoading } = usePermissions()

  if (isLoading) return null

  const all = permissions ?? (permission ? [permission] : [])
  const allowed = all.length === 0 ? true : hasAny(all)

  if (allowed) return <>{children}</>

  return <>{fallback ?? <NotAuthorizedNotice title="Access denied" permissions={all} />}</>
}

/** Someone to ask: "Patrick Keeney (Owner)". */
export interface AskPerson {
  name: string
  role?: string | null
}

const roleWord = (r?: string | null) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : '')

function askLine(ask: readonly AskPerson[]): ReactNode {
  if (ask.length === 0) return 'the shop owner'
  return ask.map((p, i) => (
    <span key={`${p.name}-${i}`}>
      {i > 0 ? (i === ask.length - 1 ? ' or ' : ', ') : null}
      <strong className="font-semibold text-slate-900">{p.name}{p.role ? ` (${roleWord(p.role)})` : ''}</strong>
    </span>
  ))
}

/**
 * The one "you can't do this" look: a big sad face, a plain sentence and whom
 * to ask. Used for a whole page (RequirePermission's fallback) and, inside
 * NotAuthorizedOverlay, for one control a person may see but not change.
 * Colours come from the accent tokens, so it follows the shop's theme.
 */
export function NotAuthorizedNotice({
  title = "Sorry, you're not authorized",
  message = "Your role doesn't include access to this page.",
  ask = [],
  permissions = [],
  compact = false,
}: {
  title?: string
  message?: ReactNode
  ask?: readonly AskPerson[]
  permissions?: readonly string[]
  /** Inside a dialog: less padding. */
  compact?: boolean
}) {
  return (
    <div data-not-authorized className={`mx-auto max-w-md text-center ${compact ? 'px-2 py-4' : 'px-6 py-16'}`}>
      <div aria-hidden="true" className="text-[88px] leading-none select-none">🙁</div>
      <h2 className="mt-3 text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <p className="mt-1 text-sm text-slate-600">Ask {askLine(ask)} if this needs to change.</p>
      {permissions.length > 0 && (
        <p className="mt-3 font-mono text-[11px] text-slate-500">Required: {permissions.join(' OR ')}</p>
      )}
    </div>
  )
}

/** NotAuthorizedNotice in the shared ui/Modal, with one OK button. */
export function NotAuthorizedOverlay({
  open,
  onClose,
  message,
  ask,
}: {
  open: boolean
  onClose: () => void
  message?: ReactNode
  ask?: readonly AskPerson[]
}) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Sorry, you're not authorized" size="sm" hideHeader>
      <Modal.Body>
        <NotAuthorizedNotice compact message={message} ask={ask} />
        <button
          type="button"
          onClick={onClose}
          data-not-authorized-ok
          className="mt-1 mb-2 w-full rounded-lg bg-[var(--accent-500,#e8902c)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
        >
          OK
        </button>
      </Modal.Body>
    </Modal>
  )
}
