import type { TourIntro, TutorialLiveStep } from '@/lib/tutorials/types'
import type { FilmScene } from './film'

/**
 * A page tour written for one page: a quick intro, then the page's own
 * smart steps. See docs/tours/HOW-TO-WRITE-A-PAGE-TOUR.md.
 *
 * Kept import-free (types aside) so scripts/export-tour-lines.mjs can load
 * every page tour and export its lines for voice recording.
 */
export interface PageTour {
  /** Unique, also the voice-recording key prefix (`page.<id>.…`). */
  id: string
  /** The page's path, as a RegExp source, e.g. '^/tool-shed/customer-app/?$'. */
  route: string
  /** Only for this section of the page, e.g. 'pay' for /tool-shed/preferences#pay. */
  hash?: string
  intro: {
    /** Defaults to the page's name in the Connect menu. */
    page?: string
    purpose: string
    covers: string[]
  }
  /**
   * The intro film played before the walk-through: 3–5 scenes, one spoken
   * line and one drawing each (see film.ts). Leave it out and the page gets
   * a film made from `intro`.
   */
  film?: FilmScene[]
  steps: PageTourStep[]
}

/** A page tour step. `chapter` and `route` are filled in from the tour. */
export type PageTourStep = Omit<TutorialLiveStep, 'chapter' | 'intro'> & { chapter?: string }

export type { TourIntro }
export type { FilmScene }
