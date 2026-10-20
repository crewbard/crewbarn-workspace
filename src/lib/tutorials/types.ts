import type { FilmScene } from '@/lib/pageTours/film'

/**
 * The shape of an "active" tutorial: a short film, then a hands-on walk
 * through the real pages (components/guides/ActiveTutorial.tsx plays it).
 *
 * Tutorial data files in this folder are kept import-free (types aside) so
 * scripts/export-tour-lines.mjs can load them on their own and export every
 * line for voice recording as `<id>.<n>`: film narration first, then each
 * step's `say`, in order.
 */

export interface TutorialFilmScene<Id extends string = string> {
  id: Id
  /** Short label for the progress bar and the scene picker. */
  label: string
  /** Headline drawn on the scene. */
  title: string
  narration: string
}

/**
 * One step of the live part.
 *
 * - `route`: the page the step belongs on (a RegExp source).
 * - `open`: what to do when the step's part isn't on screen yet. Built in:
 *   `goto:/path`, `click:<selector>`, `first:<selector>` (the first one on
 *   screen, e.g. the first row of a list). A tutorial can add its own.
 * - `click`: a tab or view button pressed first, unless it's already on
 *   (aria-pressed / aria-selected / aria-expanded, or an open <details>).
 *   A list presses several in order, e.g. a tab and then a panel the Focus
 *   look keeps folded inside it; one that isn't on screen is passed over.
 * - `wait`: the step waits for the person to do it. `click` waits for a click
 *   on the lit part; `appear` / `gone` wait for something to show up or go
 *   away; `route` waits for the page to change (a RegExp source).
 * - `doIt`: what "Do it for me" does: a selector to click, or an action.
 *   Never a save, send, delete or anything that changes real records.
 * - `hold`: don't move on by itself when the line ends; wait for Next.
 * - No `selector`: the step is just the card (nothing on the page to point at).
 *
 * A step whose part never shows up (no access, nothing to show) is skipped.
 *
 * Smart steps (docs/tours/HOW-TO-WRITE-A-PAGE-TOUR.md):
 * - `when`: the step plays only when this holds. A selector that must be on
 *   screen, `!selector` for one that must not be, or a function of the page.
 * - `variants`: other words (and optionally another part to light up) for
 *   what is on screen. The first variant whose `when` holds wins; with none,
 *   the step's own `title` / `say` / `selector` are used. A step whose `say`
 *   is '' plays only when a variant matches.
 * - `waitMs`: how long to wait for the part to appear (lazy sections),
 *   at most 1.5 seconds.
 * - `intro`: marks the quick intro card a page tour opens with.
 */
export interface TutorialLiveStep {
  id: string
  chapter: string
  title: string
  say: string
  route?: string
  open?: string
  selector?: string
  click?: string | string[]
  wait?: { click?: true; appear?: string; gone?: string; route?: string }
  doIt?: string
  yourTurn?: string
  hold?: boolean
  when?: TourCondition
  variants?: TourVariant[]
  waitMs?: number
  intro?: TourIntro
}

/** What the page looks like right now, for `when` functions. */
export interface TourContext {
  path: string
  search: string
  hash: string
  /** The first matching element that is on screen, or null. */
  find: (selector: string) => HTMLElement | null
  /** The text of the first matching element on screen ('' when none). */
  text: (selector: string) => string
}

/**
 * A selector that must be on screen, `!selector` for one that must not be,
 * or a function of the page.
 */
export type TourCondition = string | ((page: TourContext) => boolean)

export interface TourVariant {
  when: TourCondition
  title?: string
  say: string
  /** Light up this instead of the step's own selector. */
  selector?: string
}

/** The quick intro card at the start of a page tour. */
export interface TourIntro {
  /** The page's name, as the menu shows it. */
  page: string
  /** What the page is for, in one or two plain sentences. */
  purpose: string
  /** What the walk-through covers: a few words each. */
  covers: string[]
  /** The Connect area the page is in, e.g. "Your business". */
  area?: string
  /**
   * The intro film a page tour opens with (written for the page, or made
   * from these words). See lib/pageTours/film.ts.
   */
  film?: FilmScene[]
  /** Whether `film` was written for the page or made from its intro. */
  /** written on the page tour, written in pageTours/films, or made from the intro. */
  filmSource?: 'written' | 'page' | 'auto'
}

export interface TutorialChapter {
  key: string
  label: string
  /** A heading the Parts menu groups chapters under (the full tour's areas). */
  group?: string
}

export interface TutorialData {
  /** Also the voice-recording key prefix. */
  id: string
  /** Small line above the film title, e.g. "Inventory · tutorial". */
  kicker: string
  title: string
  film: TutorialFilmScene[]
  chapters: TutorialChapter[]
  steps: TutorialLiveStep[]
}
