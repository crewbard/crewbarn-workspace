import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

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
 * On denied: renders AccessDeniedNotice (a small inline panel) unless a
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

  return <>{fallback ?? <AccessDeniedNotice permissions={all} />}</>
}

function AccessDeniedNotice({ permissions }: { permissions: string[] }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 mb-4">
        <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
          <path d="M10 2l8 4v5c0 4-3 6-8 7-5-1-8-3-8-7V6l8-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 7v3M10 13v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-navy-900">Access denied</h2>
      <p className="text-sm text-slate-600 mt-1">
        Your role doesn&apos;t include access to this page. Ask the shop owner if
        you should be able to see it.
      </p>
      {permissions.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-3 font-mono">
          Required: {permissions.join(' OR ')}
        </p>
      )}
    </div>
  )
}
