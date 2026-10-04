import { CONNECT_URL } from '@/lib/workspaceScope'
import { usePermissions } from '@/hooks/usePermissions'

/** Keep the workspace menu small; Connect owns the settings directory. */
export default function EasySettingsDirectory({ onClose, compact = false }: { onClose: () => void; compact?: boolean }) {
  const { connectAccess } = usePermissions()
  if (connectAccess !== true) return null
  return <section aria-label="Business settings" className={`border-b p-4 ${compact ? '' : 'flex flex-wrap items-center justify-between gap-3'}`}>
    <div>
      <h2 className="font-semibold text-slate-900">Business settings</h2>
      <p className="mt-1 text-sm text-slate-500">Manage your company, team, and connections in CrewBarn Connect.</p>
    </div>
    <a href={CONNECT_URL} target="_blank" rel="noopener noreferrer" onClick={onClose}
      className={`inline-flex rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 ${compact ? 'mt-3' : ''}`}>
      Open Connect <span aria-hidden="true" className="ml-1">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  </section>
}
