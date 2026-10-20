import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Where each step of this tab's history went, so a page can say where its
 * back button goes ("Back to Tasks"). Keyed by the router's history index,
 * so it stays right through back and forward, and kept for the tab's life
 * (a reload keeps it).
 */
const KEY = 'crewbarn.navTrail'

function read(): string[] {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    const trail = raw ? JSON.parse(raw) : []
    return Array.isArray(trail) ? trail : []
  } catch {
    return []
  }
}

/** The router's place in this tab's history (0 for the first page). */
export function historyIndex(): number {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx : 0
}

/** Record each page as it's visited. Once, in the app frame. */
export function useNavTrail(): void {
  const location = useLocation()
  useEffect(() => {
    const trail = read()
    trail[historyIndex()] = location.pathname + location.search
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(trail.slice(0, 200)))
    } catch {
      // Storage off (a private window): no back button; the browser's own still works.
    }
  }, [location.key, location.pathname, location.search])
}

/**
 * The page before this one in this tab, or null: on the first page, or when
 * the one before wasn't in the app (the sign-in page).
 */
export function previousPage(): string | null {
  const idx = historyIndex()
  if (idx < 1) return null

  return read()[idx - 1] ?? null
}

const SECTIONS: Record<string, [list: string, one?: string]> = {
  '': ['the dashboard'],
  dashboard: ['the dashboard'],
  me: ['your page'],
  tasks: ['Tasks'],
  jobs: ['Jobs', 'the job'],
  customers: ['Customers', 'the customer'],
  estimates: ['Estimates', 'the estimate'],
  invoices: ['Invoices', 'the invoice'],
  payments: ['Payments', 'the payment'],
  dispatch: ['Dispatch'],
  schedule: ['the schedule'],
  communications: ['Messages'],
  calls: ['Calls'],
  'order-parts': ['Order parts'],
  'purchase-orders': ['Purchase orders', 'the purchase order'],
  inventory: ['Inventory'],
  assets: ['Equipment', 'the item'],
  accounting: ['Accounting'],
  reports: ['Reports'],
  'tool-shed': ['the Tool Shed'],
}

/** "Back to Tasks", "Back to the job", or just "Back". */
export function backLabel(path: string): string {
  const parts = new URL(path, window.location.origin).pathname.split('/').filter(Boolean)
  const section = SECTIONS[parts[0] ?? '']
  if (!section) return 'Back'
  const [list, one] = section

  return `Back to ${parts.length > 1 && one ? one : list}`
}
