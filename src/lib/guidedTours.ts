import { START_TOURS } from './tours/start'
import { HOME_TOURS } from './tours/home'
import { CUSTOMER_TOURS } from './tours/customers'
import { JOB_TOURS } from './tours/jobs'
import { SCHEDULE_TOURS } from './tours/schedule'
import { SALES_TOURS } from './tours/sales'
import { MONEY_TOURS } from './tours/money'
import { INVENTORY_TOURS } from './tours/inventory'
import { ASSET_TOURS } from './tours/assets'
import { TEAM_TOURS } from './tours/team'
import { SETTINGS_TOURS } from './tours/settings'
import { SETTINGS_SECTION_TOURS } from './tours/settingsSections'
import { CONNECT_AREA_TOURS } from './tours/connectAreas'
import { PLATFORM_TOURS } from './tours/platform'

export type GuidedTourLink = { label: string; url: string }
/** A page inside CrewBarn the step can take you to. */
export type GuidedTourGo = { label: string; to: string }
export type GuidedTourStep = {
  /** What to light up. Empty: the step is just the card (nothing on the page to point at). */
  selector: string
  title: string
  say: string
  links?: GuidedTourLink[]
  optional?: string
  /** Click this first (e.g. a tab button) so the target inside it is on screen. */
  click?: string
  /** Buttons that take you to another page. */
  go?: GuidedTourGo[]
}
/** `step` = index of the tour step this stop jumps to; without it, stops spread evenly over the steps. */
export type GuidedRoadmapStop = { title: string; detail: string; step?: number }
export type GuidedTour = {
  id: string
  title: string
  description: string
  route: RegExp
  /** Only for this section of the page, e.g. 'pay' for /tool-shed/preferences#pay. */
  hash?: string
  /** Only when the address has this in its query, e.g. 'tab=settings'. */
  search?: string
  roadmap: GuidedRoadmapStop[]
  steps: GuidedTourStep[]
  /**
   * Where you go to actually use what this page sets up or shows: the pages
   * it feeds, and where the result turns up. Played as the tour's last step,
   * with a button for each page.
   */
  use?: { say: string; go: GuidedTourGo[] }
}

/** The tour's steps as played: its own steps, then "Where you use this". */
export function playedSteps(tour: GuidedTour): GuidedTourStep[] {
  if (!tour.use) return tour.steps
  return [...tour.steps, { selector: '', title: 'Where you use this', say: tour.use.say, go: tour.use.go }]
}

export const START_GUIDED_TOUR_EVENT = 'crewbarn:start-guided-tour'

/**
 * Every page's guided tour, written from the page itself (docs/CREWBARN-PAGE-TOURS.md).
 * A step targets [data-tour="..."] on that page; steps whose target isn't on screen are skipped.
 * The first tour whose route matches wins.
 */
export const GUIDED_TOURS: GuidedTour[] = [
  ...START_TOURS,
  ...HOME_TOURS,
  ...CUSTOMER_TOURS,
  ...JOB_TOURS,
  ...SCHEDULE_TOURS,
  ...SALES_TOURS,
  ...MONEY_TOURS,
  ...INVENTORY_TOURS,
  ...ASSET_TOURS,
  ...TEAM_TOURS,
  ...SETTINGS_SECTION_TOURS,
  ...CONNECT_AREA_TOURS,
  ...SETTINGS_TOURS,
  ...PLATFORM_TOURS,
]

/**
 * The tour for where the person is. A tour for a section (#pay) or a tab
 * (?tab=settings) wins over the page's general tour.
 */
export function guidedTourForPath(path: string, search = '', hash = ''): GuidedTour | undefined {
  const section = hash.replace(/^#/, '')
  const specific = GUIDED_TOURS.find((tour) =>
    (tour.hash || tour.search) && tour.route.test(path)
    && (!tour.hash || tour.hash === section)
    && (!tour.search || search.includes(tour.search)))
  return specific ?? GUIDED_TOURS.find((tour) => !tour.hash && !tour.search && tour.route.test(path))
}

export type GuidedTourRequest = { id?: string; roadmap?: boolean }

export function startGuidedTour(id?: string, roadmap = false) {
  window.dispatchEvent(new CustomEvent<GuidedTourRequest>(START_GUIDED_TOUR_EVENT, { detail: { id, roadmap } }))
}
