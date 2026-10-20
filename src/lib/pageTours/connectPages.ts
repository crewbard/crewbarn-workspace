import { SECTIONS, type SectionKey } from '@/settings/types'
import { SECTION_ORDER, allEntries, canSeeEntry, entriesFor } from '@/connect/sections'
import type { MenuPage } from './build'

/**
 * Connect's pages as the menu lists them: Home, each area page, and every
 * setting in each area, in the left rail's order. The page tours take a
 * page's name and its one-line description from here, and the full tour
 * walks this list.
 */

export const CONNECT_HOME: MenuPage = {
  label: 'Connect home',
  to: '/connect',
  blurb: 'The front door of your company settings: what needs your attention, your plan, and every settings area.',
  area: 'Home',
}

/**
 * Menu links that land somewhere else. The full tour waits for the page it
 * really lands on (RegExp sources).
 */
export const LANDS_ON: Record<string, string[]> = {
  '/tool-shed/inventory-settings': ['^/inventory/?$'],
}

const areaKey = (path: string): SectionKey | null => {
  const m = path.match(/^\/connect\/([a-z]+)\/?$/)
  return m && (SECTION_ORDER as string[]).includes(m[1]) ? (m[1] as SectionKey) : null
}

/** The page at this address, as the Connect menu names it. */
export function connectMenuPage(path: string, hash = ''): MenuPage | undefined {
  const clean = path.replace(/\/+$/, '') || '/'
  if (clean === '/connect') return CONNECT_HOME
  const area = areaKey(clean)
  if (area) return { label: SECTIONS[area].label, to: `/connect/${area}`, blurb: SECTIONS[area].blurb, area: SECTIONS[area].label }
  const section = hash.replace(/^#/, '')
  const entries = allEntries()
  const exact = section ? entries.find((e) => e.to === `${clean}#${section}`) : undefined
  const hit = exact ?? entries
    .filter((e) => !e.to.includes('#'))
    .filter((e) => clean === e.to || clean.startsWith(`${e.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return hit ? { label: hit.label, to: hit.to, blurb: hit.blurb, area: hit.sectionLabel } : undefined
}

export interface FullTourPage {
  to: string
  label: string
  /** The area it is in, for the Parts menu. */
  area: string
}

/**
 * Every page the full tour opens, in the left rail's order: Home, then each
 * area's page and its settings. Pages this person can't open are left out,
 * and so is an area with nothing they can open (the rail hides it too).
 */
export function fullTourPages(has: (permission: string) => boolean): FullTourPage[] {
  const pages: FullTourPage[] = [{ to: '/connect', label: CONNECT_HOME.label, area: 'Home' }]
  const seen = new Set<string>()
  for (const key of SECTION_ORDER) {
    const entries = entriesFor(key).filter((entry) => canSeeEntry(entry, has))
    if (!entries.length) continue
    const area = SECTIONS[key].label
    pages.push({ to: `/connect/${key}`, label: area, area })
    for (const entry of entries) {
      if (seen.has(entry.to)) continue
      seen.add(entry.to)
      pages.push({ to: entry.to, label: entry.label, area })
    }
  }
  return pages
}
