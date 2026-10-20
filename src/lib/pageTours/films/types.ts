import type { FilmScene } from '../film'

/**
 * An intro film written for a page that has no page tour file of its own
 * (or whose tour file is shared). `route` is a RegExp source tested against
 * the path; `hash` (without #) picks one section of a page that has several.
 */
export interface PageFilm {
  route: string
  hash?: string
  film: FilmScene[]
}
