import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { IconSchool } from '@tabler/icons-react'
import {
  TUTORIALS_SHOWN_EVENT,
  setTutorialsShown,
  startActiveTutorial,
  startPageTour,
  tutorialForPath,
  tutorialsShown,
} from '@/lib/activeTutorial'
import { hasPageTour } from '@/lib/pageTours/available'

/** Whether tutorial buttons show on pages (the tick box in Help). */
export function useTutorialsShown(): boolean {
  const [shown, setShown] = useState(tutorialsShown)
  useEffect(() => {
    const update = () => setShown(tutorialsShown())
    window.addEventListener(TUTORIALS_SHOWN_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(TUTORIALS_SHOWN_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return shown
}

/**
 * "Tutorial" in the top bar, on any page that has one, while tutorials are
 * shown. Untick "Show tutorials on pages" in Help to hide it.
 *
 * With `pageTours`, it walks the page you're on instead: a quick intro,
 * then that page's steps. `true` is Connect, where every page has one.
 * `'work'` is the daily-work app: its pages (customers, jobs, schedule…)
 * get the page tour too, and a page with nothing to walk plays its area
 * tutorial instead (startWorkPageTour). Either way the whole-area tutorial
 * stays in Help.
 */
export function TutorialTopBarButton({ className = '', tone = 'dark', pageTours = false }: { className?: string; tone?: 'dark' | 'light'; pageTours?: boolean | 'work' }) {
  const location = useLocation()
  const shown = useTutorialsShown()
  const tutorial = tutorialForPath(location.pathname)
  const pageTour = !!pageTours && hasPageTour(location.pathname, location.search, location.hash)
  if (!shown || !(pageTour || tutorial)) return null
  const colors = tone === 'dark' ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-navy-900'
  const label = pageTour ? 'Take a tour of this page' : `Take the ${tutorial?.title} tutorial`
  return (
    <button
      type="button"
      data-tour="tutorial-launch"
      onClick={() => {
        if (pageTours === 'work' && pageTour) void startWorkPageTour()
        else if (pageTour) startPageTour()
        else if (tutorial) startActiveTutorial(tutorial.id)
      }}
      title={label}
      aria-label={label}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${colors} ${className}`}
    >
      <IconSchool size={20} stroke={1.8} />
      {/* A small gold dot: this page has a tutorial. */}
      <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-400" />
    </button>
  )
}

/**
 * The work app's page tour: walk the page you're on when there is something
 * to walk (a page tour written for it, its part of the area tutorial, or its
 * guided tour). A page with none of those, but with an area tutorial,
 * plays that whole tutorial instead of an intro with nothing after it.
 * The tours load on the first press, as they do for the player.
 */
export async function startWorkPageTour() {
  const { pathname, search, hash } = window.location
  const tutorial = tutorialForPath(pathname)
  if (tutorial) {
    try {
      const [{ buildPageTour }, { tourSources }] = await Promise.all([import('@/lib/pageTours/build'), import('./pageTourRun')])
      if (!buildPageTour({ path: pathname, search, hash }, tourSources()).steps.length) {
        startActiveTutorial(tutorial.id)
        return
      }
    } catch {
      startActiveTutorial(tutorial.id)
      return
    }
  }
  startPageTour()
}

/** For Help panels: this page's tutorial, and the show/hide tick box. */
export function TutorialHelpSection({ onStart }: { onStart?: () => void }) {
  const location = useLocation()
  const shown = useTutorialsShown()
  const tutorial = tutorialForPath(location.pathname)
  return (
    <div data-tour="tutorial-help" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
      {tutorial && (
        <button
          type="button"
          onClick={() => { onStart?.(); startActiveTutorial(tutorial.id) }}
          className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
        >
          <IconSchool size={16} />
          Take the {tutorial.title} tutorial
        </button>
      )}
      <label className="flex cursor-pointer items-start gap-2 text-slate-800">
        <input type="checkbox" checked={shown} onChange={(event) => setTutorialsShown(event.target.checked)} className="mt-0.5 rounded text-amber-600 focus:ring-amber-500" />
        <span>
          <span className="font-semibold">Show tutorials on pages</span>
          <span className="block text-xs text-slate-600">Puts a Tutorial button at the top of every page that has one. Untick to hide them.</span>
        </span>
      </label>
    </div>
  )
}
