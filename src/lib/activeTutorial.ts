/**
 * Starting an "active" tutorial: a short film that then steps back into a
 * corner and walks the real pages, waiting while the person does each step.
 *
 * The player (components/guides/ActiveTutorial.tsx) is mounted with the page
 * tours in every layout and loads only when a tutorial starts, so pages can
 * import this file without pulling the player in.
 */

export type ActiveTutorialId = string

/**
 * Which tutorial belongs to which pages. The top bar's Tutorial button and
 * Help offer the tutorial for the page you're on. Kept here (small) rather
 * than in the tutorial files, so the main app doesn't load every tutorial.
 */
export const TUTORIALS: Array<{ id: ActiveTutorialId; title: string; routes: RegExp[] }> = [
  { id: 'templates', title: 'Templates & Forms', routes: [/^\/custom-documents(\/.*)?$/] },
  { id: 'inventory', title: 'Inventory', routes: [/^\/inventory(\/.*)?$/, /^\/purchase-orders(\/.*)?$/, /^\/tool-shed\/label-printer\/?$/, /^\/accounting\/inventory-cost\/?$/] },
  { id: 'jobs', title: 'Jobs', routes: [/^\/jobs(\/.*)?$/] },
  { id: 'estimates', title: 'Estimates', routes: [/^\/estimates(\/.*)?$/] },
  { id: 'contracts', title: 'Service agreements', routes: [/^\/maintenance-contracts(\/.*)?$/, /^\/tool-shed\/service-agreements\/?$/, /^\/tool-shed\/preferences\/contract-invoices\/?$/] },
  { id: 'invoices', title: 'Getting paid', routes: [/^\/accounting\/invoices\/?$/, /^\/invoices\/[^/]+\/?$/, /^\/accounting\/customer-credits\/?$/, /^\/tool-shed\/payment-terms\/?$/] },
  { id: 'customers', title: 'Customers', routes: [/^\/customers(\/.*)?$/, /^\/tool-shed\/customer-types\/?$/] },
  { id: 'schedule', title: 'Schedule & Dispatch', routes: [/^\/schedule\/?$/, /^\/dispatch(\/.*)?$/] },
  { id: 'team', title: 'Your team', routes: [/^\/tool-shed\/staff\/?$/, /^\/tool-shed\/roles\/?$/, /^\/accounting\/payroll(\/profiles)?\/?$/, /^\/tool-shed\/time-off\/?$/, /^\/tool-shed\/subcontractors\/?$/] },
  { id: 'workflow', title: 'Jobs & workflow', routes: [/^\/tool-shed\/job-statuses\/?$/, /^\/tool-shed\/job-types\/?$/, /^\/tool-shed\/automations(\/.*)?$/, /^\/tool-shed\/preferences\/(reminders|stalled-jobs)\/?$/] },
  { id: 'catalog', title: 'Catalog & pricing', routes: [/^\/catalog(\/.*)?$/, /^\/tool-shed\/pricing\/?$/, /^\/tool-shed\/cost-model\/?$/] },
  { id: 'messages', title: 'Messages, calls & intake', routes: [/^\/communications\/?$/, /^\/calls\/?$/, /^\/intake\/?$/] },
  { id: 'dashboard', title: 'Dashboard', routes: [/^\/$/] },
  { id: 'welcome', title: 'Welcome to CrewBarn', routes: [/^\/onboarding\/?$/] },
  { id: 'accounting', title: 'Accounting', routes: [/^\/accounting\/?$/, /^\/accounting\/overview\/?$/, /^\/accounting\/cash-drawer(\/classic)?\/?$/, /^\/accounting\/card-processor\/?$/, /^\/accounting\/expenses(\/register|\/bills)?\/?$/, /^\/accounting\/bank-match(\/review)?\/?$/, /^\/accounting\/ledger\/?$/, /^\/accounting\/sales-tax\/?$/, /^\/accounting\/reports(\/browse)?\/?$/, /^\/accounting\/sync-mappings\/?$/, /^\/vendors\/?$/, /^\/sub-payouts\/?$/] },
  { id: 'business-setup', title: 'Setting up your business', routes: [/^\/connect(\/business)?\/?$/, /^\/tool-shed\/company-info\/?$/, /^\/tool-shed\/brand\/?$/, /^\/tool-shed\/communication(\/.*)?$/, /^\/tool-shed\/payments(\/.*)?$/, /^\/tool-shed\/payment-types\/?$/, /^\/tool-shed\/customer-app\/?$/, /^\/tool-shed\/service-locations\/?$/] },
]

/** Tutorials started from Help rather than from one page (e.g. the main menu, in any layout). */
export const OTHER_TUTORIAL_IDS: ActiveTutorialId[] = ['getting-around']

export function tutorialForPath(path: string) {
  return TUTORIALS.find((t) => t.routes.some((route) => route.test(path)))
}

export const START_ACTIVE_TUTORIAL_EVENT = 'crewbarn:start-active-tutorial'

export type ActiveTutorialRequest = {
  id: ActiveTutorialId
  /** Go straight to the live part, skipping the film. */
  skipFilm?: boolean
  /** Start the live part at this chapter. */
  chapter?: string
  /** A page tour or the full tour, rather than an area tutorial. */
  run?: PageTourRun
}

// ---------- Page tours and the full tour ----------
// A page tour walks the page you're on: a quick intro card, then that page's
// steps. The full tour (offered on Connect Home) opens every Connect page in
// the left rail's order and plays each one's tour. Both play in the same
// player as the area tutorials (components/guides/ActiveTutorial.tsx).

export const PAGE_TOUR_ID = 'page'
export const FULL_TOUR_ID = 'full'

export type PageTourRun =
  | { kind: 'page'; path: string; search?: string; hash?: string }
  | { kind: 'full' }

/** Walk the page you're on. */
export function startPageTour() {
  const { pathname, search, hash } = window.location
  startActiveTutorial(PAGE_TOUR_ID, { skipFilm: true, run: { kind: 'page', path: pathname, search, hash } })
}

/** Every Connect page, area by area. `chapter`: start at this page (a page key). */
export function startFullTour(chapter?: string) {
  startActiveTutorial(FULL_TOUR_ID, { skipFilm: true, chapter, run: { kind: 'full' } })
}

const FULL_TOUR_KEY = 'crewbarn:full-tour'

/** Where the full tour stopped, kept across visits so it can pick up there. */
export type FullTourResume = { chapter: string; label: string; at: number }

export function readFullTourResume(): FullTourResume | null {
  try {
    const raw = localStorage.getItem(FULL_TOUR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FullTourResume>
    return typeof parsed.chapter === 'string' && typeof parsed.label === 'string' ? { chapter: parsed.chapter, label: parsed.label, at: Number(parsed.at) || 0 } : null
  } catch {
    return null
  }
}

export function writeFullTourResume(resume: FullTourResume | null) {
  try {
    if (resume) localStorage.setItem(FULL_TOUR_KEY, JSON.stringify(resume))
    else localStorage.removeItem(FULL_TOUR_KEY)
  } catch {
    /* private mode */
  }
}

export function startActiveTutorial(id: ActiveTutorialId, options: Omit<ActiveTutorialRequest, 'id'> = {}) {
  window.dispatchEvent(new CustomEvent<ActiveTutorialRequest>(START_ACTIVE_TUTORIAL_EVENT, { detail: { id, ...options } }))
}

/** Where a tutorial in progress is kept, so a reload picks it up again. */
export const ACTIVE_TUTORIAL_SESSION_KEY = 'crewbarn:active-tutorial'

export type ActiveTutorialProgress = { id: ActiveTutorialId; step: number; run?: PageTourRun }

export function readTutorialProgress(): ActiveTutorialProgress | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_TUTORIAL_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ActiveTutorialProgress>
    if (typeof parsed.id !== 'string' || typeof parsed.step !== 'number') return null
    const run = parsed.run
    const validRun = !!run && (run.kind === 'full' || (run.kind === 'page' && typeof run.path === 'string'))
    if (validRun && (parsed.id === PAGE_TOUR_ID || parsed.id === FULL_TOUR_ID)) return { id: parsed.id, step: parsed.step, run }
    if (!(TUTORIALS.some((t) => t.id === parsed.id) || OTHER_TUTORIAL_IDS.includes(parsed.id))) return null
    return { id: parsed.id, step: parsed.step }
  } catch {
    return null
  }
}

export function writeTutorialProgress(progress: ActiveTutorialProgress | null) {
  try {
    if (progress) sessionStorage.setItem(ACTIVE_TUTORIAL_SESSION_KEY, JSON.stringify(progress))
    else sessionStorage.removeItem(ACTIVE_TUTORIAL_SESSION_KEY)
  } catch {
    /* private mode */
  }
}

// ---------- "Show tutorials on pages" ----------
// One tick box (in Help) shows or hides every tutorial button and offer on
// the pages. Help itself always lists the page's tutorial.

const SHOW_KEY = 'crewbarn:show-tutorials'
export const TUTORIALS_SHOWN_EVENT = 'crewbarn:tutorials-shown'

export function tutorialsShown(): boolean {
  try { return localStorage.getItem(SHOW_KEY) !== '0' } catch { return true }
}

export function setTutorialsShown(shown: boolean) {
  try { localStorage.setItem(SHOW_KEY, shown ? '1' : '0') } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(TUTORIALS_SHOWN_EVENT))
}
