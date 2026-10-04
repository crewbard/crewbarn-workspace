import { lazy, Suspense, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { Link } from 'react-router-dom'
import { IconHelpCircle } from '@tabler/icons-react'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import { useOnboardingStatus } from '@/hooks/useOnboarding'
import { useFranchiseFeature } from '@/hooks/useFranchiseFeature'
import { openHelpTopic } from '@/lib/helpTopics'
import { settingsHelpForRoute, settingsHelpTopicId } from '@/lib/settingsHelp'
import { useSettingsInWorkspace } from '@/hooks/useSettingsInWorkspace'
import { CONNECT_URL, isCompanySetting } from '@/lib/workspaceScope'
import { canViewSetting } from '@/lib/settingAccess'

const EasySettingsDirectory = lazy(() => import('./EasySettingsDirectory'))

export interface ToolShedItem {
  label: string
  to: string
  comingSoon?: boolean
  /** Permission required to see this item. Omit for "always visible." */
  requires?: string
  /** Hide from platform admins — used for personal/tenant-user items that a
   *  CrewBarn admin manages elsewhere (e.g. 2FA lives in their account menu). */
  hideForPlatformAdmin?: boolean
  /** Only show when the current tenant is itself a franchise (has a franchisor). */
  franchiseOnly?: boolean
}

export interface ToolShedSection {
  title: string
  items: ToolShedItem[]
}

export const TOOL_SHED_SECTION_BLURBS: Record<string, string> = {
  'Create & Send': 'Templates, automations, imports, and exports.',
  'Inventory & Assets': 'Stock, products, assets, vendors, purchasing, and warranties.',
  'Customers & Workflow': 'Job setup, statuses, customer structure, tags, and custom fields.',
  'Team & Access': 'Staff, roles, subcontractors, time off, and security.',
  Connections: 'Integrations, communication providers, maps, AI, and API access.',
  'Business Controls': 'Company profile, pricing, taxes, layout, modules, billing, and audit.',
}

export const TOOL_SHED_SECTIONS: ToolShedSection[] = [
  {
    title: 'Create & Send',
    items: [
      { label: 'Automations', to: '/tool-shed/automations', requires: PERM.SETTINGS_VIEW },
      { label: 'Templates & Forms', to: '/custom-documents', requires: PERM.TEMPLATES_VIEW },
      { label: 'Service Agreements', to: '/tool-shed/service-agreements', requires: PERM.SETTINGS_VIEW },
      { label: 'Import Data', to: '/tool-shed/import', requires: PERM.SETTINGS_VIEW },
      { label: 'Data Export', to: '/tool-shed/data-export', requires: PERM.SETTINGS_EDIT },
    ],
  },
  {
    title: 'Inventory & Assets',
    items: [
      { label: 'Inventory', to: '/inventory', requires: PERM.INVENTORY_VIEW },
      { label: 'Service Catalog', to: '/catalog/services', requires: PERM.CATALOG_VIEW },
      { label: 'Product Catalog', to: '/catalog/products', requires: PERM.CATALOG_VIEW },
      { label: 'Service Categories', to: '/catalog/categories', requires: PERM.CATALOG_VIEW },
      { label: 'Product Categories', to: '/catalog/product-categories', requires: PERM.CATALOG_VIEW },
      { label: 'Customer Assets', to: '/assets', requires: PERM.ASSETS_VIEW },
      { label: 'Asset Access Requests', to: '/asset-access-requests', requires: PERM.ASSETS_VIEW },
      { label: 'Asset Types', to: '/asset-types', requires: PERM.ASSETS_VIEW },
      { label: 'Company Tools', to: '/company-assets', requires: PERM.ASSETS_VIEW },
      { label: 'Vendors', to: '/vendors', requires: PERM.INVENTORY_VIEW },
      { label: 'Purchase Orders', to: '/purchase-orders', requires: PERM.INVENTORY_VIEW },
      { label: 'Warranties', to: '/warranties', requires: PERM.WARRANTIES_VIEW },
      { label: 'Warranty Settings', to: '/tool-shed/warranty-settings', requires: 'settings_warranty.view' },
    ],
  },
  {
    title: 'Customers & Workflow',
    items: [
      { label: 'Job Types', to: '/tool-shed/job-types', requires: PERM.SETTINGS_VIEW },
      { label: 'Job Statuses', to: '/tool-shed/job-statuses', requires: PERM.SETTINGS_VIEW },
      { label: 'Tags', to: '/tool-shed/tags', requires: PERM.SETTINGS_VIEW },
      { label: 'Customer Types', to: '/tool-shed/customer-types', requires: PERM.CUSTOMERS_VIEW },
      { label: 'Service Locations', to: '/tool-shed/service-locations', requires: PERM.CUSTOMERS_VIEW },
      { label: 'Territories', to: '/tool-shed/territories', requires: PERM.SETTINGS_VIEW },
      { label: 'Custom Fields', to: '/tool-shed/custom-fields', requires: PERM.SETTINGS_VIEW },
    ],
  },
  {
    title: 'Team & Access',
    items: [
      { label: 'Staff & Crews', to: '/tool-shed/staff', requires: PERM.STAFF_VIEW },
      { label: 'Hiring', to: '/tool-shed/hiring', requires: PERM.STAFF_VIEW },
      { label: 'Subcontractors', to: '/tool-shed/subcontractors', requires: PERM.JOBS_VIEW },
      { label: 'Roles & Permissions', to: '/tool-shed/roles', requires: PERM.STAFF_VIEW },
      { label: 'Time Off', to: '/tool-shed/time-off', requires: PERM.STAFF_VIEW },
      // Tenant Security & 2FA: a real tenant user's own enrollment + the tenant
      // 2FA policy. The page itself hides the PERSONAL section for platform
      // admins (acting-as-tenant) and shows only the policy — so an admin never
      // sees their own CrewBarn 2FA under a tenant.
      { label: 'Security & 2FA', to: '/tool-shed/security' },
      // Delete permissions and team 2FA are owner RULES, so they live with the
      // rest of the shop rules rather than as separate menu entries. Deep-linked
      // to their sections; the standalone /tool-shed/delete-permissions route
      // still resolves so old links and bookmarks don't break.
      { label: 'Delete Permissions', to: '/tool-shed/preferences#delete-permissions', requires: PERM.SETTINGS_VIEW },
      { label: 'Data Encryption (BYOK)', to: '/tool-shed/encryption', requires: PERM.SETTINGS_EDIT },
      { label: 'Company Files', to: '/tool-shed/company-files', requires: PERM.COMPANY_SECURE_FILES_LIST },
    ],
  },
  {
    title: 'Connections',
    items: [
      { label: 'Integrations', to: '/tool-shed/integrations', requires: PERM.SETTINGS_VIEW },
      { label: 'Phone, SMS & Email', to: '/tool-shed/communication', requires: PERM.SETTINGS_VIEW },
      { label: 'Call transcription', to: '/tool-shed/communication/transcription', requires: PERM.SETTINGS_VIEW },
      { label: 'Where your email comes from', to: '/tool-shed/communication/email', requires: PERM.SETTINGS_EDIT },
      // The old single AI page is fully sliced now. It stays routed, so links
      // and bookmarks still work; the menu lists the pages it became.
      // One row, not seven. Every one of these settings is on the CBI AI
      // page, which also links the focused one-at-a-time versions — so the
      // cluster keeps its way in without burying the rest of Connections.
      { label: 'CBI AI', to: '/tool-shed/ai', requires: PERM.SETTINGS_EDIT },
      { label: 'Storage & Maps', to: '/tool-shed/storage-maps', requires: PERM.SETTINGS_VIEW },
      { label: 'GPS Devices', to: '/tool-shed/gps', requires: PERM.JOBS_VIEW },
      { label: 'Label Printer', to: '/tool-shed/label-printer', requires: PERM.SETTINGS_VIEW },
      { label: 'Shop TV', to: '/tool-shed/shop-tv', requires: PERM.SETTINGS_VIEW },
      { label: 'API Tokens', to: '/tool-shed/api-tokens', requires: PERM.SETTINGS_EDIT },
      { label: 'API Endpoint Guide', to: '/tool-shed/api-endpoints', requires: PERM.SETTINGS_VIEW },
      { label: 'Self-hosted Console', to: '/tool-shed/self-hosted', requires: PERM.SETTINGS_VIEW },
      { label: 'Webhooks', to: '/tool-shed/webhooks', requires: PERM.SETTINGS_EDIT },
      { label: 'Connected Apps', to: '/tool-shed/connected-apps', requires: PERM.SETTINGS_VIEW },
      { label: 'Marketplace Listing', to: '/tool-shed/marketplace', requires: PERM.SETTINGS_EDIT },
      { label: 'Partner Connections', to: '/tool-shed/partner-connections', requires: PERM.SETTINGS_EDIT },
    ],
  },
  {
    title: 'Business Controls',
    items: [
      { label: 'Company Info', to: '/tool-shed/company-info', requires: 'settings_company.view' },
      { label: 'Brand & Logo', to: '/tool-shed/brand', requires: PERM.SETTINGS_EDIT },
      { label: 'Your website', to: '/website-builder', requires: PERM.SETTINGS_EDIT },
      { label: 'Customer App', to: '/tool-shed/customer-app', requires: PERM.SETTINGS_EDIT },
      { label: 'Google Reviews', to: '/tool-shed/google-reviews', requires: PERM.SETTINGS_VIEW },
      { label: 'Shop Rules', to: '/tool-shed/preferences', requires: 'settings_preferences.view' },
      { label: 'Pricing & Discounts', to: '/tool-shed/pricing', requires: PERM.CATALOG_VIEW },
      { label: 'Cost Model', to: '/tool-shed/cost-model', requires: PERM.REVENUE_VIEW },
      { label: 'Tax Classes', to: '/catalog/tax-classes', requires: PERM.CATALOG_VIEW },
      { label: 'Payment Terms', to: '/tool-shed/payment-terms', requires: PERM.INVOICES_VIEW },
      { label: 'Payment Types', to: '/tool-shed/payment-types', requires: PERM.SETTINGS_VIEW },
      { label: 'Payments', to: '/tool-shed/payments', requires: PERM.SETTINGS_EDIT },
      { label: 'Let customers pay by bank transfer', to: '/tool-shed/payments/bank-transfer', requires: PERM.SETTINGS_EDIT },
      { label: 'Watch your bank for payments', to: '/tool-shed/payments/watch-bank', requires: PERM.SETTINGS_EDIT },
      { label: 'Connect Cloudflare', to: '/tool-shed/cloudflare', requires: PERM.SETTINGS_EDIT },
      { label: 'Modules', to: '/tool-shed/modules', requires: 'settings_modules.view' },
      // App Layout is not here on purpose. It is a per-person, per-browser
      // preference — which sidebar you like, how dense the pages are — and it
      // lives in the avatar menu under "Layout preview" with the rest of what
      // belongs to you. Listing it in the Tool Shed put a personal choice
      // among the company's settings and implied an owner could set it for
      // everybody, which is not what it does. See ALWAYS_IN_WORKSPACE in
      // lib/workspaceScope.ts for the longer version.
      { label: 'Onboarding', to: '/onboarding', requires: PERM.SETTINGS_VIEW },
      { label: 'Subscription', to: '/tool-shed/subscription', requires: PERM.SETTINGS_VIEW },
      { label: 'Usage & Limits', to: '/tool-shed/usage', requires: PERM.SETTINGS_VIEW },
      { label: 'Audit Log', to: '/tool-shed/audit-log', requires: PERM.SETTINGS_VIEW },
      // Only a tenant that IS a franchise sees this — controls franchisor support access.
      { label: 'Franchise access', to: '/franchise-support', requires: PERM.SETTINGS_VIEW, franchiseOnly: true },
    ],
  },
]

interface ToolShedMenuProps {
  onClose: () => void
  /** The Tool Shed trigger button — measured to position the panel just below
   *  it (banner-safe) and clamp it on-screen so it never runs off either edge. */
  triggerRef?: RefObject<HTMLElement | null>
}

/** Preferred panel width by viewport (capped to the viewport when measured). */
function preferredWidth(vw: number): number {
  if (vw >= 1536) return 1180
  if (vw >= 1280) return 980
  return Math.min(680, vw - 16)
}

export function useVisibleToolShedSections(): {
  sections: ToolShedSection[]
  isLoading: boolean
} {
  const { has, isLoading, isPlatformAdmin } = usePermissions()
  const { isRouteVisible } = useModuleVisibility()
  const { isFranchise } = useFranchiseFeature()
  const { show: showCompanySettings } = useSettingsInWorkspace()
  const canViewSettings = !isLoading && has(PERM.SETTINGS_VIEW)
  const onboardingQuery = useOnboardingStatus(canViewSettings)
  const onboarding = onboardingQuery.data?.data
  const hideOnboarding =
    !!onboarding &&
    !isPlatformAdmin &&
    (!onboarding.onboarding_required || (!onboarding.should_redirect && onboarding.progress_percent >= 100))

  // Filter sections + items by permission. While permissions load, hide
  // everything (avoid flash of items the user can't actually access).
  const sections: ToolShedSection[] = isLoading
    ? []
    : TOOL_SHED_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.to === '/onboarding' && hideOnboarding) return false
          if (item.hideForPlatformAdmin && isPlatformAdmin) return false
          if (item.franchiseOnly && !isFranchise) return false
          if (!isRouteVisible(item.to)) return false
          if (!canViewSetting(item.to, has)) return false
          // Company settings are run from connect.crewbarn.com unless this
          // workspace has asked for them here too. App layout is exempt: it
          // is a per-browser preference about the screen you are looking at.
          if (!showCompanySettings && isCompanySetting(item.to)) return false
          return !item.requires || has(item.requires)
        }),
      })).filter((section) => section.items.length > 0)

  return { sections, isLoading }
}

export function ToolShedMenu({ onClose, triggerRef }: ToolShedMenuProps) {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const { sections: filtered, isLoading } = useVisibleToolShedSections()
  const { show: showCompanySettings } = useSettingsInWorkspace()

  // Anchor to the trigger, not the viewport center. Clamp wide menus to
  // the viewport so both compact and full directories remain reachable.
  const [pos, setPos] = useState<CSSProperties>(() => ({
    position: 'fixed',
    top: 56,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(980px, calc(100vw - 1rem))',
    maxHeight: 'calc(100vh - 4rem)',
  }))

  useLayoutEffect(() => {
    const place = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const rect = triggerRef?.current?.getBoundingClientRect()
      const width = Math.min(preferredWidth(vw), vw - 16)
      const top = rect ? rect.bottom : 56
      const left = Math.max(8, Math.min(rect?.left ?? 8, vw - width - 8))
      setPos({
        position: 'fixed',
        top,
        left,
        width,
        maxHeight: Math.max(0, vh - top - 12),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const observer = new ResizeObserver(place)
    if (triggerRef?.current) {
      observer.observe(triggerRef.current)
      if (triggerRef.current.parentElement) observer.observe(triggerRef.current.parentElement)
    }
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      observer.disconnect()
    }
  }, [triggerRef, easy])

  // NOTE: no onMouseLeave here. This menu is a DOM descendant of the
  // TopBar trigger wrapper, which owns hover-intent (open on enter,
  // delayed close on leave). A local onMouseLeave={onClose} would snap
  // the menu shut the instant the cursor moved from the menu back up
  // to the trigger button — the classic flicker. Let the parent handle it.
  //
  // FIT-EVERY-SCREEN: the panel is anchored to the trigger, its width
  // is capped to the viewport, its height
  // is capped with vertical scroll, and sections flow via CSS multi-columns
  // (3 → 2 → 1 as width shrinks). That keeps the whole menu reachable on a
  // monitor, a laptop, or a tablet without cutting off menu entries.
  return (
    <div
      style={pos}
      className="z-40 overflow-y-auto overscroll-contain
                 bg-white border border-slate-200 rounded-xl shadow-2xl"
    >
      <Suspense fallback={<p role="status" className="p-4">Loading settings…</p>}><EasySettingsDirectory onClose={onClose} /></Suspense>
      {isLoading && <p role="status" className="p-4 text-sm text-slate-500">Loading your tools…</p>}
      {!isLoading && filtered.length === 0 && <p className="p-4 text-sm text-slate-500">No workspace tools are available with your current access.</p>}
      <div className="columns-1 sm:columns-2 xl:columns-3 2xl:columns-4 gap-3 p-4">
        {filtered.map((section) => (
          <div
            key={section.title}
            className="mb-3 break-inside-avoid rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm"
          >
            <div className="mb-1.5">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-slate-500">
                {section.title}
              </h3>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                {TOOL_SHED_SECTION_BLURBS[section.title]}
              </p>
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to} className="-mx-2 flex items-center rounded transition-colors hover:bg-amber-50">
                  <Link
                    to={item.to}
                    onClick={onClose}
                    className="flex min-w-0 flex-1 items-center justify-between px-2 py-1 text-sm text-slate-700 hover:text-amber-700"
                  >
                    <span>{item.label}</span>
                    {item.comingSoon && (
                      <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                        Soon
                      </span>
                    )}
                  </Link>
                  {settingsHelpForRoute(item.to) && (
                    <button
                      type="button"
                      onClick={() => {
                        const help = settingsHelpForRoute(item.to)
                        if (!help) return
                        onClose()
                        openHelpTopic(settingsHelpTopicId(help.id))
                      }}
                      className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      aria-label={`Help for ${item.label}`}
                      title={`Help for ${item.label}`}
                    >
                      <IconHelpCircle size={16} stroke={1.8} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-3 bg-slate-50 rounded-b-xl">
        <p className="text-xs text-slate-500">
          {showCompanySettings ? (
            <>Items visible per your role. Owner sees everything; ask the shop owner if you&apos;re missing something.</>
          ) : (
            <>
              Company settings are on{' '}
              <a
                href={CONNECT_URL}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-amber-700 hover:text-amber-800"
              >
                connect.crewbarn.com
              </a>
              . This menu keeps what you open while working.
            </>
          )}
        </p>
        <Link
          to="/tool-shed"
          onClick={onClose}
          className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-800"
        >
          Open full Tool Shed →
        </Link>
      </div>
    </div>
  )
}
