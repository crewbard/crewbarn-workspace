import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTenants } from '@/hooks/useAdminTenants'
import { getActingTenant, setActingTenant } from '@/lib/api'

/**
 * Banner shown across the top of authenticated pages for platform admins.
 *
 * Platform admins (Patrick + future CrewBarn staff) can act-as any tenant.
 * Without selecting one, writes fail because the backend's BelongsToTenant
 * trait can't auto-fill tenant_id from a bypassed session.
 *
 * Reads/writes localStorage. On change, dispatches a custom event so other
 * parts of the app can react without a full reload.
 *
 * Hidden entirely for non-platform-admin users.
 *
 * Tenants list comes from /v1/admin/tenants — adding a new tenant via
 * AdminTenantNewPage automatically makes it pickable here on next refresh.
 */
export function TenantBanner() {
  const { account } = useAuth()
  const isPlatformAdmin = !!account?.is_platform_admin

  const [acting, setActing] = useState<string | null>(getActingTenant())
  const [pickerOpen, setPickerOpen] = useState(false)

  const { data: tenantsResp } = useTenants({}, isPlatformAdmin)
  const tenants = tenantsResp?.data ?? []

  useEffect(() => {
    const handleStorage = () => setActing(getActingTenant())
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  if (!isPlatformAdmin) {
    return null
  }

  // Switching tenant context invalidates every in-flight query, websocket,
  // and EventSource on the page (they were all scoped to the previous
  // tenant). A full reload is the cheapest correct reset — and it forces
  // the dispatch SSE to reconnect with the new `?acting_tenant=` so the
  // stream lands on the right tenant instead of bouncing through the 401
  // → /login handler.
  const handleSelect = (tenantId: string) => {
    setActingTenant(tenantId)
    setActing(tenantId)
    setPickerOpen(false)
    if (typeof window === 'undefined') return
    // Selecting from the admin console means "drop into this tenant" → leave
    // /admin and land on the tenant dashboard. Switching while already inside
    // the tenant app reloads in place (stay on the current page, new tenant).
    if (window.location.pathname.startsWith('/admin')) {
      window.location.assign('/')
    } else {
      window.location.reload()
    }
  }

  const handleClear = () => {
    setActingTenant(null)
    setActing(null)
    // Drop back to the platform ops dashboard (the no-tenant admin home),
    // not a reload of the current tenant page (which would now be tenant-less).
    if (typeof window !== 'undefined') window.location.assign('/admin')
  }

  const actingTenant = acting ? tenants.find((t) => t.id === acting) : null

  const handleOnboard = () => {
    if (!actingTenant) return
    window.sessionStorage.removeItem(`crewbarn:onboarding:overlay-dismissed:${actingTenant.id}`)
    window.localStorage.removeItem(`crewbarn:onboarding:manual:${actingTenant.id}`)
    setActingTenant(actingTenant.id)
    if (typeof window !== 'undefined') window.location.assign('/onboarding')
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 no-print">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500 text-white">
            CREWBARN ADMIN
          </span>
          {actingTenant ? (
            <span className="text-amber-900">
              Acting as: <strong>{actingTenant.name}</strong>
              <span className="text-amber-700 ml-1">({actingTenant.slug})</span>
            </span>
          ) : (
            <span className="text-amber-900">
              No tenant selected — writes will fail until you pick one
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actingTenant ? (
            <>
              <button
                type="button"
                onClick={handleOnboard}
                className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 font-medium"
              >
                Onboard
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen(!pickerOpen)}
                className="px-3 py-1 text-xs bg-white border border-amber-300 text-amber-800 rounded hover:bg-amber-100"
              >
                Switch
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1 text-xs text-amber-700 hover:text-amber-900"
              >
                Clear
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 font-medium"
            >
              Select tenant
            </button>
          )}
        </div>
      </div>

      {pickerOpen && (
        <div className="max-w-7xl mx-auto mt-2 bg-white border border-amber-200 rounded-md shadow-sm">
          <div className="p-2 border-b border-amber-100 bg-amber-50/50">
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Select tenant
            </div>
          </div>
          {tenants.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              No tenants yet. Create one from <span className="font-mono">/admin/tenants/new</span>.
            </div>
          ) : (
            <ul className="divide-y divide-navy-100">
              {tenants.map((tenant) => (
                <li key={tenant.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(tenant.id)}
                    className="w-full px-4 py-2 text-left hover:bg-amber-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-navy-700">{tenant.name}</div>
                      <div className="text-xs text-navy-400 font-mono">{tenant.slug}</div>
                    </div>
                    {acting === tenant.id && (
                      <span className="text-xs text-amber-600 font-semibold">CURRENT</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
