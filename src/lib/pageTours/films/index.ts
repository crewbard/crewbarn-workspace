import type { FilmScene } from '../film'
import type { PageFilm } from './types'
import { WORK_FILMS } from './work'
import { ACCOUNTING_FILMS } from './accounting'
import { CONNECT_FILMS } from './connect'
import { SETTINGS_FILMS } from './settings'
import { SETTINGS_MORE_FILMS } from './settingsMore'

export type { PageFilm } from './types'

/**
 * Intro films written for pages, by route. A film written on a page's own
 * tour (pages/*.ts `film`) wins over one here; a page with neither gets a
 * film made from its intro.
 */
export const PAGE_FILMS: PageFilm[] = [...WORK_FILMS, ...ACCOUNTING_FILMS, ...CONNECT_FILMS, ...SETTINGS_FILMS, ...SETTINGS_MORE_FILMS]

export function findPageFilm(path: string, hash = ''): FilmScene[] | undefined {
  const section = hash.replace(/^#/, '')
  const clean = path.replace(/\/+$/, '') || '/'
  const hits = PAGE_FILMS.filter((f) => f.film.length && new RegExp(f.route).test(clean))
  return (hits.find((f) => section && f.hash === section) ?? hits.find((f) => !f.hash))?.film
}
