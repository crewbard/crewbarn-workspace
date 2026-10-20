import { FULL_TOUR_ID, TUTORIALS, type PageTourRun } from '@/lib/activeTutorial'
import { guidedTourForPath } from '@/lib/guidedTours'
import { buildPageTour, type BuiltPageTour, type TourSources } from '@/lib/pageTours/build'
import { PAGE_TOURS } from '@/lib/pageTours/pages'
import { LANDS_ON, connectMenuPage, fullTourPages } from '@/lib/pageTours/connectPages'
import { workMenuPage } from '@/lib/pageTours/workPages'
import type { TutorialData } from '@/lib/tutorials/types'
import { TUTORIAL_SCRIPTS } from './tutorials'
import type { TutorialScript } from './tutorialScript'

/** Everything a page tour can be made from (see lib/pageTours/build.ts). */
export function tourSources(): TourSources {
  return {
    pageTours: PAGE_TOURS,
    tutorials: TUTORIALS.map((t) => ({ ...t, data: TUTORIAL_SCRIPTS[t.id]?.data })),
    guided: guidedTourForPath,
    // Connect's menu names its pages; the work app's pages are named in workPages.
    menu: (path, hash) => connectMenuPage(path, hash) ?? workMenuPage(path),
  }
}

export interface PageRunScript {
  script: TutorialScript
  pages: BuiltPageTour[]
  full: boolean
}

/**
 * A page tour, or the full tour, as a script the tutorial player plays: one
 * chapter per page, each opening with its intro (the page's intro film in a
 * page tour, the quick intro card in the full tour).
 */
export function buildRunScript(run: PageTourRun, has: (permission: string) => boolean): PageRunScript {
  const sources = tourSources()
  const full = run.kind === 'full'
  const pages: BuiltPageTour[] = run.kind === 'page'
    ? [buildPageTour({ path: run.path, search: run.search, hash: run.hash }, sources)]
    : fullTourPages(has).map((page) => {
        const [path, hash = ''] = page.to.split('#')
        const built = buildPageTour({ path, hash }, sources, { full: true, to: page.to, alsoRoutes: LANDS_ON[path] })
        return { ...built, area: page.area, intro: { ...built.intro, intro: built.intro.intro && { ...built.intro.intro, area: page.area } } }
      })
  const first = pages[0]
  const data: TutorialData = {
    id: full ? FULL_TOUR_ID : `page:${first.key}`,
    kicker: full ? 'The full tour' : `${first.area ?? 'This page'} · page tour`,
    title: full ? 'The full tour of Connect' : first.title,
    film: [],
    chapters: pages.map((page) => ({ key: page.key, label: page.title, group: full ? page.area : undefined })),
    steps: pages.flatMap((page) => [page.intro, ...page.steps]),
  }
  // Steps sliced from an area tutorial keep that tutorial's own actions.
  const actions: NonNullable<TutorialScript['actions']> = {}
  for (const page of pages) {
    if (page.tutorialId) Object.assign(actions, TUTORIAL_SCRIPTS[page.tutorialId]?.actions ?? {})
  }
  return { script: { data, reveal: {}, Visual: () => null, css: '', actions }, pages, full }
}
