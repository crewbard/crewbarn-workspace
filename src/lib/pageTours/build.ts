import type { GuidedTour } from '@/lib/guidedTours'
import type { TourIntro, TutorialData, TutorialLiveStep } from '@/lib/tutorials/types'
import type { PageTour } from './types'
import type { FilmScene, FilmVisual } from './film'
import { findPageFilm } from './films'

/**
 * Turns whatever is written for a page into one page tour: an intro film
 * (written for the page, or made from its intro), then the steps for that
 * page. The full tour shows the quick intro card instead of the film.
 *
 * Where the steps come from, first match wins:
 *   1. a page tour written for the page (src/lib/pageTours/pages),
 *   2. the steps of the page's area tutorial whose `route` is this page
 *      (an area tutorial sliced per page),
 *   3. the page's guided tour (src/lib/tours),
 *   4. nothing: the intro alone, from the menu's words.
 *
 * A written page tour is found by its route, so it works on any page:
 * Connect's, or the work app's (customers, jobs, schedule…). The menu
 * words come from Connect's menu or from the work app's page list
 * (connectPages.ts, workPages.ts).
 *
 * Pure (no DOM, no React), so the voice exporter builds the very same intro
 * lines the app speaks and they can be recorded.
 */

export interface PageLocation {
  path: string
  search?: string
  hash?: string
}

/** The page as the Connect menu (or the work app's page list) names it. */
export interface MenuPage {
  label: string
  to: string
  blurb?: string
  /** Its area, e.g. "Your business". */
  area?: string
}

export interface TourSources {
  pageTours: PageTour[]
  /** Area tutorials and the routes they cover (activeTutorial's TUTORIALS, with their data). */
  tutorials: Array<{ id: string; title: string; routes: RegExp[]; data?: TutorialData }>
  guided?: (path: string, search: string, hash: string) => GuidedTour | undefined
  menu?: (path: string, hash: string) => MenuPage | undefined
}

export interface BuiltPageTour {
  /** Unique per page (and section): the chapter key in the full tour. */
  key: string
  title: string
  area?: string
  /** Where the full tour goes to open it. */
  to: string
  /** The intro's route (RegExp source). */
  route: string
  source: 'page' | 'tutorial' | 'guided' | 'intro'
  /** The area tutorial the steps were sliced from. */
  tutorialId?: string
  intro: TutorialLiveStep
  steps: TutorialLiveStep[]
}

export interface BuildOptions {
  /**
   * Part of the full tour: show-only. Steps that wait for the person, do
   * things for them, or open other pages are left as plain steps, and the
   * intro moves on by itself.
   */
  full?: boolean
  /** Where the full tour opens the page (defaults to the path and hash). */
  to?: string
  /** Extra paths the page can land on (a menu link that redirects). */
  alsoRoutes?: string[]
}

/** Longer than this, a slice is a whole tutorial rather than a page's part of one. */
export const MAX_SLICE = 60

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

export const sentence = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

// Names that keep their capital in the middle of a sentence.
const PROPER = /^(Android|Apple|App Store|Google|CrewBarn|CBI|Connect|Stripe|Twilio|Cloudflare|QuickBooks|GoDaddy|GPS|API|AI|PDF|SMS|ACH|BYOK|iPhone|TestFlight|Zelle|TV)\b/
const lowerFirst = (text: string) => (PROPER.test(text) || /^[A-Z]{2}/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1))

/** A cover as it reads in a sentence: no "(here)" asides or end stops. */
export const coverWords = (text: string) => text.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[.:;,]+$/, '').trim()

const joinWords = (words: string[]) =>
  words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`

/** What the intro card says aloud. */
export function introLine(intro: Pick<TourIntro, 'page' | 'purpose' | 'covers'>): string {
  const covers = intro.covers.map(coverWords).filter(Boolean)
  const list = covers.length ? ` We’ll look at ${joinWords(covers.map(lowerFirst))}.` : ''
  return `${sentence(intro.page)} ${sentence(intro.purpose)}${list}`.replace(/\s+/g, ' ').trim()
}

/**
 * A drawing for what the page is about, picked from its words, for a film
 * nobody wrote. Every drawing has generic sample data of its own.
 */
export function autoVisual(intro: Pick<TourIntro, 'page' | 'purpose' | 'covers' | 'area'>): FilmVisual {
  const words = `${intro.page} ${intro.area ?? ''} ${intro.purpose}`.toLowerCase()
  const has = (re: RegExp) => re.test(words)
  const covers = intro.covers.map(coverWords).filter(Boolean)
  if (has(/\b(text|texting|email|messages?|calls?|voicemail|inbox|transcri|phone number|sender)\b/)) return { kind: 'thread' }
  if (has(/\b(dispatch|route|gps|territor|map|tracking|drove|where your crew)/)) return { kind: 'map', route: true }
  if (has(/\b(schedule|calendar|time off|vacation|clock|reminders?|visits?)\b/)) return { kind: 'calendar' }
  if (has(/\b(parts?|inventory|stock|purchase|suppliers?|vendors?|order|shelves|catalog|products?)\b/)) return { kind: 'cart' }
  if (has(/\b(invoices?|pay|paid|payments?|money|bills?|bank|ledger|tax|expenses?|payroll|cash|card|credits?|pric|cost|accounting|books|payouts?)/)) return { kind: 'money' }
  if (has(/\b(stages?|status(es)?|workflow|automations?|pipeline|steps)\b/)) return { kind: 'pipeline' }
  if (has(/\b(sign|signed|signature|contracts?|agreements?|estimates?|quotes?|warrant)/)) return { kind: 'signature' }
  if (has(/\b(customers?|accounts?|contacts?|locations?|places)\b/)) return { kind: 'account' }
  if (has(/\b(reports?|dashboard|usage|glance|numbers)\b/)) return { kind: 'tiles' }
  if (has(/\b(jobs?|tasks?|work orders?)\b/)) return { kind: 'list' }
  return { kind: 'toggles', heading: intro.page, rows: covers.length ? covers.slice(0, 4).map((label) => ({ label, on: true })) : undefined }
}

/**
 * The film a page plays when nobody wrote one, made from its intro: the
 * page's name, what it is for, what the walk-through covers, and "let's
 * walk through it". So every page has a film from day one.
 */
export function autoFilm(intro: Pick<TourIntro, 'page' | 'purpose' | 'covers' | 'area'>, hasWalk = true): FilmScene[] {
  const page = intro.page.trim() || 'This page'
  const generic = page.toLowerCase() === 'this page'
  const scenes: FilmScene[] = [{
    id: 'name',
    say: generic ? 'Here’s a quick look at this page.' : `This is ${page}.`,
    visual: { kind: 'title', title: page, area: intro.area && intro.area !== page ? intro.area : undefined },
  }]
  const purpose = sentence(intro.purpose)
  if (purpose) scenes.push({ id: 'what', say: purpose, title: generic ? undefined : page, visual: autoVisual(intro) })
  const covers = intro.covers.map(coverWords).filter(Boolean)
  if (hasWalk && covers.length) {
    scenes.push({ id: 'covers', say: `We’ll look at ${joinWords(covers.map(lowerFirst))}.`, title: 'What we’ll look at', visual: { kind: 'chips', chips: covers } })
  }
  scenes.push(hasWalk
    ? { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } }
    : { id: 'go', say: 'That’s the quick look. Have a look around.', visual: { kind: 'go', label: 'Have a look around' } })
  return scenes
}

export function pageKey(path: string, hash = ''): string {
  const slug = (path.replace(/\/+$/, '') || '/').replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home'
  const section = hash.replace(/^#/, '')
  return section ? `${slug}--${section}` : slug
}

function routeOf(path: string, also: string[] = []): string {
  const clean = path.replace(/\/+$/, '') || '/'
  const own = clean === '/' ? '^/$' : `^${escapeRe(clean)}/?$`
  return [own, ...also].join('|')
}

/** Step titles to list on the intro card, when nobody wrote them. */
function coversFrom(steps: TutorialLiveStep[], max = 5): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const step of steps) {
    const title = step.title.trim()
    if (!title || seen.has(title.toLowerCase())) continue
    seen.add(title.toLowerCase())
    out.push(title)
    if (out.length >= max) break
  }
  return out
}

/** Show-only, for the full tour. */
function showOnly(step: TutorialLiveStep, route: RegExp): TutorialLiveStep {
  const { wait: _wait, yourTurn: _yourTurn, doIt: _doIt, hold: _hold, ...rest } = step
  const open = step.open
  const keepOpen = !!open && (/^(click|first):/.test(open) || (open.startsWith('goto:') && route.test(open.slice(5).split(/[?#]/)[0])))
  return { ...rest, open: keepOpen ? open : undefined }
}

export function findPageTour(tours: PageTour[], path: string, hash = ''): PageTour | undefined {
  const section = hash.replace(/^#/, '')
  return tours.find((t) => t.hash && t.hash === section && new RegExp(t.route).test(path))
    ?? tours.find((t) => !t.hash && new RegExp(t.route).test(path))
}

export function buildPageTour(loc: PageLocation, sources: TourSources, options: BuildOptions = {}): BuiltPageTour {
  const path = loc.path
  const search = loc.search ?? ''
  const hash = loc.hash ?? ''
  const key = pageKey(path, hash)
  const route = routeOf(path, options.alsoRoutes)
  const routeRe = new RegExp(route)
  const menu = sources.menu?.(path, hash)
  const guided = sources.guided?.(path, search, hash)
  const full = !!options.full
  const to = options.to ?? `${path}${hash ? (hash.startsWith('#') ? hash : `#${hash}`) : ''}`

  const prefix = (steps: TutorialLiveStep[]) => steps.map((step) => ({ ...step, id: `${key}:${step.id}`, chapter: key }))

  let source: BuiltPageTour['source'] = 'intro'
  let steps: TutorialLiveStep[] = []
  let tutorialId: string | undefined
  let page = menu?.label ?? guided?.title ?? 'This page'
  let purpose = guided?.description ?? menu?.blurb ?? ''
  let covers: string[] = []

  const written = findPageTour(sources.pageTours, path, hash)
  if (written) {
    source = 'page'
    page = written.intro.page ?? page
    purpose = written.intro.purpose
    covers = written.intro.covers
    steps = written.steps.map((step) => ({ ...step, chapter: key, route: step.route ?? written.route }))
  } else {
    const tutorial = sources.tutorials.find((t) => t.data && t.routes.some((r) => r.test(path)))
    const slice = tutorial?.data?.steps.filter((step) => !step.intro && !!step.route && new RegExp(step.route).test(path)) ?? []
    // A tutorial that lives on one page (the welcome tutorial on Guided
    // setup) slices into the whole tutorial: too long for a page tour, so
    // the page's guided tour plays instead when it has one.
    const wholeTutorial = slice.length > MAX_SLICE && !!guided
    if (tutorial && slice.length && !wholeTutorial) {
      source = 'tutorial'
      tutorialId = tutorial.id
      steps = slice
      // This page's own parts, by the steps' titles.
      covers = coversFrom(slice.filter((step) => step.title.trim().toLowerCase() !== page.toLowerCase()))
    } else if (guided) {
      source = 'guided'
      const played: TutorialLiveStep[] = guided.steps.map((s, i) => ({
        id: `g${i + 1}`,
        chapter: key,
        title: s.title,
        say: s.say,
        route: guided.route.source,
        selector: s.selector || undefined,
        click: s.click,
      }))
      if (guided.use?.say) played.push({ id: 'use', chapter: key, title: 'Where you use this', say: guided.use.say, route: guided.route.source })
      steps = played
      covers = guided.roadmap.length ? guided.roadmap.slice(0, 5).map((r) => r.title) : coversFrom(played)
    }
  }

  if (full) steps = steps.map((step) => showOnly(step, routeRe))
  steps = prefix(steps)

  const introData: TourIntro = { page, purpose: sentence(purpose), covers: covers.map(coverWords).filter(Boolean), area: menu?.area }
  // The intro film: written for the page, or made from the intro's words.
  if (written?.film?.length) {
    introData.film = written.film
    introData.filmSource = 'written'
  } else {
    const mapped = findPageFilm(path, hash)
    if (mapped?.length) {
      introData.film = mapped
      introData.filmSource = 'page'
    } else {
      introData.film = autoFilm(introData, steps.length > 0)
      introData.filmSource = 'auto'
    }
  }
  const intro: TutorialLiveStep = {
    id: `${key}:intro`,
    chapter: key,
    title: page,
    say: introLine(introData),
    route,
    open: full ? `goto:${to}` : undefined,
    intro: introData,
    // On its own, the intro waits for "Walk me through it". In the full
    // tour it moves on by itself.
    hold: !full,
  }

  return { key, title: page, area: menu?.area, to, route, source, tutorialId, intro, steps }
}
