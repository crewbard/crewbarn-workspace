import { useLocation, useNavigate } from 'react-router-dom'
import { backLabel, previousPage } from '@/lib/navTrail'

// Pages that fill the window exactly: the button floats, so they don't scroll.
const FULL_SCREEN = ['/dispatch', '/schedule']

/**
 * Back to the page before this one in the app ("← Back to Tasks"), on every
 * page reached from another. Not on the first page of a visit, and not for a
 * change inside the same page (its own tabs).
 */
export function BackBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const previous = previousPage()
  if (!previous || new URL(previous, window.location.origin).pathname === location.pathname) return null

  const label = backLabel(previous)
  if (FULL_SCREEN.includes(location.pathname)) {
    return (
      <button
        type="button"
        data-back-bar="floating"
        onClick={() => navigate(-1)}
        className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg hover:bg-slate-50 hover:text-slate-900"
      >
        <span aria-hidden>←</span> {label}
      </button>
    )
  }

  return (
    <div data-back-bar className="px-4 pt-3 sm:px-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
      >
        <span aria-hidden>←</span> {label}
      </button>
    </div>
  )
}
