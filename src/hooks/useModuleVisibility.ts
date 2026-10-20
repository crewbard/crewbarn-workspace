import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { readSnapshot, writeSnapshot } from '@/lib/snapshots'

/**
 * Per-tenant module visibility and Work placement. The disabled list removes
 * a module from navigation across apps. The separate Connect-only list removes
 * its links from Work navigation while keeping the module enabled.
 *
 * v1 toggleable module keys: assets, billing, inventory, workflow. The GET is
 * readable by ANY authenticated user — every member's nav must filter, not just
 * owners. Degrades to "everything visible" if the call fails.
 *
 * Enforcement is HIDE-FROM-NAV-ONLY. The API still serves these routes;
 * neither preference is a security boundary.
 */
export type ModuleKey = 'assets' | 'billing' | 'inventory' | 'workflow'

export const MODULE_LABELS: Record<ModuleKey, string> = {
  assets: 'Assets + QR / Scan',
  billing: 'Estimates + Invoices',
  inventory: 'Inventory + Catalog',
  workflow: 'Tasks, Reminders & Automations',
}

export const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  assets: 'Asset registry, asset types, company tools, and QR scan pages.',
  billing: 'Estimates, invoices, accounting, pricing & payment terms.',
  inventory: 'Inventory, product/service catalog, vendors, purchase orders.',
  workflow: 'Tasks board, reminder rules, and automation rules.',
}

/**
 * FALLBACK route prefix → module, used only when the server catalog has not
 * loaded yet (first paint from an old snapshot, or the call failed). The
 * catalog is the real source — see moduleForRouteIn.
 *
 * Route prefix → module. A nav route is hidden when its module is disabled.
 * Order matters only for readability; matching is by `startsWith` so list the
 * most specific routes a module owns. Routes not listed here are ALWAYS visible
 * (Dashboard, Jobs, Customers, Schedule, Dispatch, Reports, Staff, etc. are
 * core and never toggleable).
 */
const MODULE_ROUTES: Record<ModuleKey, string[]> = {
  assets: ['/assets', '/asset-types', '/company-assets'],
  billing: ['/estimates', '/accounting', '/tool-shed/pricing', '/tool-shed/payment-terms'],
  inventory: [
    '/inventory',
    '/settings/inventory',
    '/catalog',
    '/vendors',
    '/purchase-orders',
    '/order-parts',
  ],
  workflow: ['/tasks', '/tool-shed/automations'],
}

/** Which module (if any) governs a route. Longest-prefix wins. */
export function moduleForRoute(to: string): ModuleKey | null {
  let best: ModuleKey | null = null
  let bestLen = 0
  for (const key of Object.keys(MODULE_ROUTES) as ModuleKey[]) {
    for (const prefix of MODULE_ROUTES[key]) {
      if ((to === prefix || to.startsWith(prefix + '/')) && prefix.length > bestLen) {
        best = key
        bestLen = prefix.length
      }
    }
  }
  return best
}

interface CatalogRow {
  key: string
  name: string
  core: boolean
  routes: string[]
}

interface ModulesResponse {
  data: {
    toggleable: string[]
    disabled_modules: string[]
    disabled_modules_catalog?: string[]
    connect_only_modules?: string[]
    /** The server's catalog (App\Services\Modules\ModuleCatalog). Absent on an old cached snapshot. */
    catalog?: CatalogRow[]
  }
}

/**
 * Which module owns a route, preferring the server's catalog over the local
 * map. The local map only covers the four original keys, so without this a
 * workspace could switch off Dispatch and still see the Dispatch nav item.
 * Longest prefix wins, same rule as before.
 */
function moduleForRouteIn(catalog: CatalogRow[] | undefined, to: string): string | null {
  if (!catalog?.length) return moduleForRoute(to)
  let best: string | null = null
  let bestLen = 0
  for (const row of catalog) {
    if (row.core) continue
    for (const prefix of row.routes) {
      if ((to === prefix || to.startsWith(prefix + '/')) && prefix.length > bestLen) {
        best = row.key
        bestLen = prefix.length
      }
    }
  }
  return best
}

export interface ModuleVisibility {
  disabled: Set<string>
  connectOnly: Set<string>
  isModuleEnabled: (key: string) => boolean
  /** True when this route's governing module is enabled (or the route is core). */
  isRouteVisible: (to: string) => boolean
  /** Work navigation excludes enabled modules placed in Connect only. */
  isRouteVisibleInWork: (to: string) => boolean
  /** First load with nothing cached — the shell waits for this. */
  isLoading: boolean
}

export function useModuleVisibility(): ModuleVisibility {
  const query = useQuery({
    queryKey: ['settings-modules'],
    queryFn: async () => {
      const res = await apiRequest<ModulesResponse>('/v1/settings/modules')
      writeSnapshot('settings-modules', res)
      return res
    },
    staleTime: 5 * 60_000,
    // Last-known answer first, so a disabled module's nav item doesn't show
    // for a beat and then vanish.
    placeholderData: () => readSnapshot<ModulesResponse>('settings-modules'),
  })

  const disabled = new Set<string>(query.data?.data.disabled_modules_catalog ?? query.data?.data.disabled_modules ?? [])
  const connectOnly = new Set<string>(query.data?.data.connect_only_modules ?? [])
  const catalog = query.data?.data.catalog

  const isModuleEnabled = (key: string) => !disabled.has(key)
  const isRouteVisible = (to: string) => {
    const mod = moduleForRouteIn(catalog, to)
    return mod === null || !disabled.has(mod)
  }
  const isRouteVisibleInWork = (to: string) => {
    const mod = moduleForRouteIn(catalog, to)
    return mod === null || (!disabled.has(mod) && !connectOnly.has(mod))
  }

  return { disabled, connectOnly, isModuleEnabled, isRouteVisible, isRouteVisibleInWork, isLoading: query.isLoading }
}
