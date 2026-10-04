import { TOOL_SHED_SECTIONS } from '@/components/layout/ToolShedMenu'
import { SETTINGS } from '@/settings/registry'
import { SECTIONS, type SectionKey } from '@/settings/types'
import { MENU_ITEMS, SETTINGS_MENU, type MenuItem } from '@/connect/settingsMenu'
import { canViewSetting } from '@/lib/settingAccess'

/**
 * Connect's eight sections, and what is in each.
 *
 * The section map in docs/design/connect/README.md is the source of truth for
 * where a setting belongs. It is written as route paths here rather than
 * labels, because a route is what a person navigates to and cannot quietly
 * rename itself under us.
 *
 * Two sources are merged, on purpose. A setting that has been declared in the
 * registry brings its own plain-English title and current value; one that has
 * not yet been rewritten still appears, using the label the Tool Shed menu
 * already shows, and links to its existing page. So the shell is complete on
 * day one and gets better as declarations land, instead of being useless
 * until all fifty-two are done.
 */

export interface SectionEntry {
  label: string
  to: string
  /** A one-line description, when we have one. */
  blurb?: string
  /** Extra words somebody might search for. Declared settings supply these. */
  keywords?: string[]
  /** True once this setting has a declaration — i.e. a focused page. */
  declared: boolean
  /** The submenu it is listed under. */
  group?: string
  icon?: MenuItem['icon']
  /** The permission it needs, beyond the setting's own scope. */
  requires?: string
}

/** route (or route prefix) -> section. From the README's table. */
const ROUTE_SECTION: Array<[string, SectionKey]> = [
  // Your business
  ['/tool-shed/company-info', 'business'],
  ['/tool-shed/brand', 'business'],
  // The full-screen builder is the way in; the old page is still routed for
  // the studio tools that have not been rebuilt yet.
  ['/website-builder', 'business'],
  ['/tool-shed/website', 'business'],
  ['/tool-shed/customer-app', 'business'],
  ['/tool-shed/google-reviews', 'business'],
  ['/tool-shed/preferences', 'business'],
  ['/tool-shed/modules', 'business'],
  ['/tool-shed/marketplace', 'business'],

  // Money
  ['/tool-shed/payments', 'money'],
  ['/tool-shed/payment-types', 'money'],
  ['/tool-shed/payment-terms', 'money'],
  ['/catalog/tax-classes', 'money'],
  ['/tool-shed/pricing', 'money'],
  ['/tool-shed/cost-model', 'money'],

  // Jobs & workflow
  ['/tool-shed/job-types', 'workflow'],
  ['/tool-shed/job-statuses', 'workflow'],
  ['/tool-shed/automations', 'workflow'],
  ['/custom-documents', 'workflow'],
  ['/tool-shed/custom-fields', 'workflow'],
  ['/tool-shed/warranty-settings', 'workflow'],

  // Customers & sites
  ['/tool-shed/customer-types', 'customers'],
  ['/tool-shed/tags', 'customers'],
  ['/tool-shed/service-locations', 'customers'],
  ['/tool-shed/territories', 'customers'],
  ['/tool-shed/service-agreements', 'customers'],

  // Catalog & inventory. Only the settings: the catalogs, vendors and stock
  // themselves are work surfaces and stay in the workspace's Tool Shed.
  ['/tool-shed/inventory-settings', 'catalog'],
  // Kept with the parts it labels.
  ['/tool-shed/label-printer', 'catalog'],

  // CBI AI
  ['/tool-shed/ai', 'ai'],

  // Team
  ['/tool-shed/staff', 'team'],
  // Trackers belong with the vans they are in.
  ['/tool-shed/gps', 'team'],
  ['/tool-shed/roles', 'team'],
  ['/tool-shed/security', 'team'],
  ['/tool-shed/delete-permissions', 'team'],
  ['/tool-shed/time-off', 'team'],
  ['/tool-shed/hiring', 'team'],
  ['/tool-shed/subcontractors', 'team'],

  // Connections
  ['/tool-shed/integrations', 'connections'],
  ['/tool-shed/communication', 'connections'],
  ['/tool-shed/storage-maps', 'connections'],
  ['/tool-shed/shop-tv', 'connections'],
  ['/tool-shed/connected-apps', 'connections'],
  ['/tool-shed/partner-connections', 'connections'],
  ['/tool-shed/cloudflare', 'connections'],

  // Developers
  ['/tool-shed/api-tokens', 'developers'],
  ['/tool-shed/api-endpoints', 'developers'],
  ['/tool-shed/webhooks', 'developers'],
  ['/tool-shed/self-hosted', 'developers'],

  // Account & billing
  ['/tool-shed/subscription', 'account'],
  ['/tool-shed/usage', 'account'],
  ['/tool-shed/import', 'account'],
  ['/tool-shed/data-export', 'account'],
  ['/tool-shed/encryption', 'account'],
  // Filed beside encryption on purpose: these are the files that setting
  // protects, and "your data" is the section a person looks in for both.
  ['/tool-shed/company-files', 'account'],
  ['/tool-shed/audit-log', 'account'],
  ['/onboarding', 'account'],
]

/**
 * A menu entry that deep-links into another page with a hash — Delete
 * Permissions lives in a section of Shop rules — belongs to the section its
 * SUBJECT is in, not the page that happens to host it. Matched on the full
 * string before the hash is stripped.
 */
const HASH_SECTION: Array<[string, SectionKey]> = [
  ['/tool-shed/preferences#delete-permissions', 'team'],
  ['/tool-shed/preferences#pay', 'team'],
  ['/tool-shed/preferences#vacation', 'team'],
  ['/tool-shed/preferences#clock', 'team'],
  ['/tool-shed/preferences#intake', 'workflow'],
  ['/tool-shed/preferences#numbering', 'workflow'],
  ['/tool-shed/preferences#field-rules', 'workflow'],
  ['/tool-shed/preferences#sender', 'connections'],
]

export const sectionForRoute = (to: string): SectionKey | null => {
  const exact = HASH_SECTION.find(([p]) => p === to)?.[1]
  if (exact) return exact
  const path = to.split('#')[0]
  // Focused settings can belong to a different section than their parent URL.
  // Use the same declarations that build the rail, with the most specific match.
  const routes: Array<[string, SectionKey]> = [
    ...SETTINGS.map((setting): [string, SectionKey] => [setting.route, setting.section]),
    ...ROUTE_SECTION,
  ]
  return routes
    .filter(([p]) => path === p || path.startsWith(p + '/'))
    .sort(([a], [b]) => b.length - a.length)[0]?.[1] ?? null
}

/** Card blurbs on Home, straight from the mockup. */
export const SECTION_CARD_BLURB: Record<SectionKey, string> = {
  customers: 'How you sort customers, where you work, and what you look after.',
  catalog: 'What you sell, what it costs you, and where it is kept.',
  ai: 'What your AI uses, what it may do, and what it has learned.',
  business: 'Company details, brand, website, customer app and shop rules.',
  money: 'How you get paid, taxes, terms and pricing.',
  workflow: 'Job types, statuses, automations, templates and fields.',
  team: 'Who can sign in, what they can do, and security.',
  connections: 'Payments, texting, email, maps, AI and GPS providers.',
  developers: 'API tokens, the API guide, webhooks and self-hosted domains.',
  account: 'Plan, seats, usage, your data and the audit log.',
}

export const SECTION_ORDER: SectionKey[] = [
  'business',
  'customers',
  'workflow',
  'catalog',
  'money',
  'team',
  'ai',
  'connections',
  'developers',
  'account',
]

/**
 * Where a route is listed in Connect's menu — which area to light up in the
 * sidebar while somebody is on it.
 *
 * The menu first, because it is what the person just clicked through: the
 * catalogs and reference cards are listed under Catalog & inventory without
 * being company settings, and they should still light that area up. Then
 * the company-setting filing above, for pages under a setting that the menu
 * does not list one by one.
 */
export function menuSectionForRoute(to: string): SectionKey | null {
  const exact = MENU_ITEMS.find((item) => item.to === to)
  if (exact) return exact.section

  const path = to.split('#')[0]
  const byPath = MENU_ITEMS
    .filter((item) => !item.to.includes('#'))
    .filter((item) => path === item.to || path.startsWith(item.to + '/'))
    .sort((a, b) => b.to.length - a.to.length)[0]

  return byPath?.section ?? sectionForRoute(to)
}

/**
 * The permission the Tool Shed menu already puts on a page.
 *
 * One list, not two: the menu reads its gates from the Tool Shed, and a
 * page it lists that the Tool Shed does not carries its own `requires`.
 */
function requiresFor(to: string): string | undefined {
  const path = to.split('#')[0]
  const items = TOOL_SHED_SECTIONS.flatMap((section) => section.items)

  return (
    items.find((item) => item.to === to)
    ?? items
      .filter((item) => !item.to.includes('#'))
      .filter((item) => path === item.to || path.startsWith(item.to + '/'))
      .sort((a, b) => b.to.length - a.to.length)[0]
  )?.requires
}

/** Whether this person should see an entry: the setting's scope, and the page's gate. */
export function canSeeEntry(entry: Pick<SectionEntry, 'to' | 'requires'>, has: (permission: string) => boolean): boolean {
  return canViewSetting(entry.to, has) && (!entry.requires || has(entry.requires))
}

/**
 * What is listed in an area, in menu order.
 *
 * The menu decides the list. A setting with a declaration lends it the
 * words somebody might search for, so "texting" still finds the phone
 * settings even though the menu calls them something else.
 */
export function entriesFor(section: SectionKey): SectionEntry[] {
  return (SETTINGS_MENU[section]?.groups ?? []).flatMap((group) =>
    group.items.map((item) => {
      const declared = SETTINGS.find((setting) => setting.route === item.to.split('#')[0])
      return {
        label: item.label,
        to: item.to,
        blurb: item.blurb,
        keywords: declared?.keywords,
        declared: Boolean(declared),
        group: group.label,
        icon: item.icon,
        requires: item.requires ?? requiresFor(item.to),
      }
    }),
  )
}

/** Every setting, flattened — what Find a setting searches. */
export function allEntries(): Array<SectionEntry & { section: SectionKey; sectionLabel: string }> {
  return SECTION_ORDER.flatMap((key) =>
    entriesFor(key).map((e) => ({ ...e, section: key, sectionLabel: SECTIONS[key].label })),
  )
}
