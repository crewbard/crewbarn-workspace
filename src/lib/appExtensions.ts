import type { ComponentType } from 'react'
import type { HelpTopic } from '@/lib/helpTopics'

/**
 * Places the full CrewBarn app plugs extra pieces into.
 *
 * The open-source work dashboard is generated from this tree
 * (scripts/generate-work-dashboard.mjs) and must not ship CrewBarn's own
 * platform admin code, which lives in src/admin/. Work code never imports
 * src/admin. Instead, the full app registers those pieces here once at start
 * (src/admin/register.tsx, imported by main.tsx), and the generator drops
 * that one import. With nothing registered, every slot is simply empty.
 */

export type ExtensionLink = {
  to: string
  label: string
  /** A small tag shown beside the label in the account menu. */
  badge?: string
  /** Sidebar icon name. */
  icon?: 'toolshed' | 'money' | 'messages'
}

export type AppExtensions = {
  /** Shown above every signed-in page. */
  Banner?: ComponentType
  /** Mounted once beside the whole app. */
  RootOverlay?: ComponentType
  /** Extra links in the account menu for platform staff. */
  staffMenuLinks?: ExtensionLink[]
  /** Extra links at the foot of the sidebar for platform staff. */
  staffSidebarLinks?: ExtensionLink[]
  /** Where a cross-tenant staff account with no company picked starts. */
  staffHome?: string
  /** Where staff pick a company to work in. */
  staffCompanyPicker?: ExtensionLink
  /** Extra Help panel topics (shown by their audience rules). */
  helpTopics?: HelpTopic[]
}

let current: AppExtensions = {}

export function registerAppExtensions(extensions: AppExtensions): void {
  current = { ...current, ...extensions }
}

export function appExtensions(): AppExtensions {
  return current
}
