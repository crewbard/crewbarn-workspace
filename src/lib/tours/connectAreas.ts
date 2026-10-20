import type { GuidedTour, GuidedTourStep } from '@/lib/guidedTours'
import { SETTINGS_MENU, menuSlug } from '@/connect/settingsMenu'
import { SECTIONS, type SectionKey } from '@/settings/types'

/**
 * One tour per Connect area (/connect/business, /connect/money, ...).
 *
 * Built from the same menu the area page draws, so every group and every
 * setting link gets a step that says what it is for, and a setting added to
 * the menu is in its area's tour the same day. Settings a person can't see
 * have no target on screen, and their steps are skipped.
 */
const t = (id: string) => `[data-tour="${id}"]`
const sentence = (text: string) => {
  const trimmed = text.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function areaTour(key: SectionKey): GuidedTour {
  const section = SECTIONS[key]
  const groups = SETTINGS_MENU[key]?.groups ?? []
  const settingCount = groups.reduce((n, group) => n + group.items.length, 0)

  const steps: GuidedTourStep[] = [
    {
      selector: t('connect-area-header'),
      title: section.label,
      say: `${section.label}: ${sentence(section.blurb)} It holds ${settingCount} ${settingCount === 1 ? 'setting' : 'settings'} in ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}. Let’s go through each one and what it’s for.`,
    },
    {
      selector: t('connect-area-filter'),
      title: 'Jump or search',
      say: 'Tap a group to jump straight to it, or type a word in the box to find a setting in this area.',
    },
  ]
  const groupStep: number[] = []
  for (const group of groups) {
    groupStep.push(steps.length)
    steps.push({
      selector: t(`connect-group-${menuSlug(group.label)}`),
      title: group.label,
      say: `${group.label}. ${sentence(group.blurb)}`,
      optional: 'Skip this group',
    })
    for (const item of group.items) {
      steps.push({
        selector: t(`connect-setting-${menuSlug(item.label)}`),
        title: item.label,
        say: `${item.label}: ${sentence(item.blurb)}`,
        optional: 'Skip',
      })
    }
  }
  steps.push({
    selector: t('connect-area-breadcrumb'),
    title: 'Open a setting',
    say: 'Click any setting to open it. Every setting page has its own tour under Help. Connect, up here, takes you back to all ten areas.',
  })

  return {
    id: `connect-${key}`,
    title: section.label,
    description: section.blurb,
    route: new RegExp(`^\\/connect\\/${key}\\/?$`),
    roadmap: groups.slice(0, 6).map((group, i) => ({ title: group.label, detail: sentence(group.blurb), step: groupStep[i] })),
    steps,
  }
}

export const CONNECT_AREA_TOURS: GuidedTour[] = SETTINGS_MENU
  ? (Object.keys(SECTIONS) as SectionKey[]).filter((key) => SETTINGS_MENU[key]).map(areaTour)
  : []
