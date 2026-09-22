import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getActingTenant } from '@/lib/api'

/**
 * Home (`/`) gate. A platform admin with NO tenant selected has no tenant
 * context — the tenant dashboard's queries would fail ("writes will fail until
 * you pick one"). Send them to the platform ops dashboard instead. Everyone
 * else (and admins who have picked a tenant) gets the normal tenant dashboard.
 */
export function HomeRoute({ children }: { children: React.ReactNode }) {
  const { account, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-500">Loading...</div>
  }

  // Only cross-tenant platform roles (Owner / Developer / Support) live in
  // the console. Sales and Billing are owners of the demo shop: they get the
  // normal app on their home tenant, with the console a click away.
  const crossTenant = !!account?.is_platform_admin && (account.platform_capabilities ?? []).includes('tenant_data.access')
  if (crossTenant && !getActingTenant()) {
    return <Navigate to="/admin" replace />
  }

  // Employee portal: the account's own setting decides where "/" goes. An
  // office user with the flag on can still reach the full app via
  // "Open the full app", which lands here with ?full=1.
  if (account?.extension?.employee_portal && !new URLSearchParams(window.location.search).has('full')) {
    return <Navigate to="/me" replace />
  }

  return <>{children}</>
}
