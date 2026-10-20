import { guidedTourForPath } from '@/lib/guidedTours'
import { tutorialForPath } from '@/lib/activeTutorial'
import { connectMenuPage } from './connectPages'
import { workMenuPage } from './workPages'
import { TOUR_ROUTES } from './tourRoutes'

const WRITTEN = TOUR_ROUTES.map((route) => new RegExp(route))

/**
 * Whether the page at this address has a page tour. Every Connect page does
 * (its intro comes from the menu); so does any page with a guided tour or an
 * area tutorial, or a written page tour or film. Cheap: the tours themselves load only when one starts.
 */
export function hasPageTour(path: string, search = '', hash = ''): boolean {
  return !!(connectMenuPage(path, hash) || workMenuPage(path) || guidedTourForPath(path, search, hash) || tutorialForPath(path) || WRITTEN.some((re) => re.test(path.replace(/\/+$/, '') || '/')))
}

