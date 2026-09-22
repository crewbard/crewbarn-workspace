import { useEffect, useState } from 'react'
import { useLocation, NavLink } from 'react-router-dom'

interface SubNavItem {
  to: string
  label: string
  end?: boolean
  /** Key into NAV_ICONS. Only the workflow tabs carry one. */
  icon?: NavIconName
  /** Secondary surfaces, kept behind "More" so the workflow tabs stay short. */
  secondary?: boolean
}

/*
 * Tab icons, traced from the Accounting concept so the shipped nav is the
 * same drawing rather than a lookalike.
 *
 * Monochrome line art on purpose, not colour emoji: they inherit the link's
 * own colour, so an icon is black when its tab is active and grey when it is
 * not, and the row stays readable against the light bar. Colour emoji would
 * each bring their own palette and fight the one accent this bar has.
 *
 * salestax is the exception — the concept's icon map has no entry for it, so
 * this is drawn to match: pediment, columns, floor. A civic building, because
 * that money belongs to the state.
 */
type NavIconName = 'desk' | 'register' | 'po' | 'pay' | 'salestax' | 'reports'

const NAV_ICONS: Record<NavIconName, string[]> = {
  desk: ['M3 13h4l1.5 3h7L17 13h4', 'M4.5 5.5h15l1.5 7.5v5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-5z'],
  register: ['M2.5 6.5h19v11h-19z', 'M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M6 10v4M18 10v4'],
  po: ['M3 8l9-4 9 4-9 4z', 'M3 8v8l9 4 9-4V8', 'M12 12v8'],
  pay: [
    'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11z',
    'M2.5 19.5a6.5 6.5 0 0 1 13 0',
    'M16.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 19.5a6.6 6.6 0 0 0-2.6-4.3',
  ],
  salestax: ['M3 9.5 12 4.5l9 5', 'M4.5 12h15', 'M7 12v6M12 12v6M17 12v6', 'M3.5 20h17'],
  reports: ['M3 20h18', 'M6.5 20v-6M11.5 20V7M16.5 20v-9'],
}

function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" aria-hidden="true" className="shrink-0">
      {NAV_ICONS[name].map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

const SUB_NAV_BY_SECTION: Record<string, SubNavItem[]> = {
  '/jobs': [
    { to: '/jobs', label: 'All Jobs', end: true },
    { to: '/jobs/new', label: 'New Job' },
  ],
  '/customers': [
    { to: '/customers', label: 'All Customers', end: true },
    { to: '/customers/new', label: 'New Customer' },
  ],
  '/estimates': [
    { to: '/estimates', label: 'All Estimates', end: true },
    { to: '/estimates/new', label: 'New Estimate' },
  ],
  /*
   * Five workflows, not eleven destinations.
   *
   * This was a flat list of every accounting surface in the app, which asked
   * the reader to already know which page answers their question. These are
   * the jobs somebody actually sits down to do: money in, money out, paying
   * the crew, and finding something out. Reports joins them here — it was a
   * top-level nav item, which put "run a report" on the same footing as
   * "run the business".
   *
   * Nothing was removed. Everything that used to be listed is still one click
   * away under More, because a finance surface that hides a ledger is worse
   * than one that looks busy.
   */
  '/accounting': [
    { to: '/accounting', label: 'Money desk', end: true, icon: 'desk' },
    { to: '/accounting/cash-drawer', label: 'Cash register', icon: 'register' },
    { to: '/purchase-orders', label: 'Purchase orders', icon: 'po' },
    { to: '/accounting/payroll', label: 'Payroll', icon: 'pay' },
    // Promoted out of More: sales tax is money you are only holding. It was
    // never revenue, and burying it next to Sync Maps invites treating it as
    // profit until the state asks for it.
    { to: '/accounting/sales-tax', label: 'Sales tax', icon: 'salestax' },
    { to: '/accounting/reports', label: 'Reports', icon: 'reports' },

    { to: '/accounting/overview', label: 'Overview & charts', secondary: true },
    { to: '/accounting/invoices', label: 'Invoices', secondary: true },
    { to: '/accounting/customer-credits', label: 'Credits', secondary: true },
    { to: '/accounting/expenses', label: 'Expenses', secondary: true },
    { to: '/accounting/expenses/bills', label: 'Vendor bills', secondary: true },
    { to: '/accounting/inventory-cost', label: 'Inventory cost', secondary: true },
    { to: '/accounting/bank-match', label: 'Bank match', secondary: true },
    { to: '/accounting/ledger', label: 'Ledger', secondary: true },
    { to: '/accounting/sync-mappings', label: 'Sync maps', secondary: true },
  ],
}

/** Sections that live outside their nav prefix but belong to it. */
const ADOPTED: Record<string, string> = {
  '/purchase-orders': '/accounting',
  '/reports': '/accounting',
}

function findActiveSection(pathname: string): string | null {
  for (const [prefix, section] of Object.entries(ADOPTED)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return section
  }
  for (const section of Object.keys(SUB_NAV_BY_SECTION)) {
    if (pathname === section || pathname.startsWith(section + '/')) {
      return section
    }
  }
  return null
}

export function SubNav() {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const section = findActiveSection(location.pathname)

  // Close the overflow when the route changes, or it hangs open over the page
  // you just navigated to.
  useEffect(() => setMoreOpen(false), [location.pathname])

  if (!section) return null

  const items = SUB_NAV_BY_SECTION[section]
  const primary = items.filter((i) => !i.secondary)
  const secondary = items.filter((i) => i.secondary)
  // A secondary page is still the page you are on — say so rather than
  // leaving every tab looking inactive.
  const inSecondary = secondary.some(
    (i) => location.pathname === i.to || location.pathname.startsWith(i.to + '/'),
  )

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'inline-flex items-center gap-1.5 transition-colors',
      isActive ? 'text-navy-900 font-medium' : 'text-slate-600 hover:text-navy-700',
    ].join(' ')

  return (
    <div className="relative border-b border-slate-200 bg-slate-50">
      <div className="flex h-10 items-center gap-2 px-6 text-sm">
        {primary.map((item, idx) => (
          <span key={item.to} className="flex items-center gap-2">
            {idx > 0 && <span className="text-slate-300">·</span>}
            <NavLink to={item.to} end={item.end} className={linkClass}>
              {item.icon && <NavIcon name={item.icon} />}
              {item.label}
            </NavLink>
          </span>
        ))}

        {secondary.length > 0 && (
          <>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={[
                'transition-colors',
                inSecondary ? 'text-navy-900 font-medium' : 'text-slate-600 hover:text-navy-700',
              ].join(' ')}
            >
              More {moreOpen ? '▴' : '▾'}
            </button>
          </>
        )}
      </div>

      {moreOpen && secondary.length > 0 && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute right-6 z-20 mt-1 grid w-[420px] grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            {secondary.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'rounded px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-slate-100 font-medium text-navy-900'
                      : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
