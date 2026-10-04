import { Link, useLocation } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import { CONNECT_URL, isCompanySetting } from '@/lib/workspaceScope'
import { EasyAccountingTabs } from './EasyAccountingTabs'
import { activeEasyLink, findEasySection, matchesSectionPath } from './easySections'

export function EasySectionTabs() {
  const { pathname } = useLocation()
  const { has } = usePermissions()
  const { isRouteVisible } = useModuleVisibility()
  if (matchesSectionPath(pathname, '/accounting') || matchesSectionPath(pathname, '/invoices')) return <EasyAccountingTabs />
  const section = findEasySection(pathname)
  if (!section) return null
  const links = section.links.filter(link => has(link.permission) && isRouteVisible(link.to))
  if (!links.length) return null
  const active = activeEasyLink(pathname, links)
  return (
    <nav data-easy-section-tabs aria-label={`${section.label} sections`} className="border-b border-slate-200 bg-white px-3 sm:px-6">
      <div className="flex flex-wrap gap-x-1">
        {links.map(link => isCompanySetting(link.to) ? (
          <a key={link.to} href={new URL(link.to, CONNECT_URL).href} target="_blank" rel="noopener noreferrer"
            className="border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-600 hover:border-amber-300">
            {link.label} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in Connect in a new tab)</span>
          </a>
        ) : (
          <Link key={link.to} to={link.to} aria-current={active === link.to ? 'page' : undefined}
            className={`border-b-2 px-3 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 ${active === link.to ? 'border-amber-500 text-slate-950' : 'border-transparent text-slate-600 hover:border-amber-300 hover:text-slate-950'}`}>
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
