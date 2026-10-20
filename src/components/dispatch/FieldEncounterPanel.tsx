import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { encounterAnswerLabel, encounterColor, encounterTime, metersLabel, type FieldEncounterRow } from '@/lib/fieldEncounters'

/**
 * One location check, opened from its dot on the dispatch map (or the tech's
 * day): who, when, the address the phone showed, what they answered, the
 * customer address it matched, and the job or estimate it led to, with how
 * far the check was from where that job is.
 */
export function FieldEncounterPanel({ check, onClose, onOpenDay }: {
  check: FieldEncounterRow
  onClose: () => void
  onOpenDay?: (techId: string) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const rows: [string, React.ReactNode][] = [
    ['Starting', check.kind === 'new_estimate' ? 'A new estimate' : 'A new job'],
    ['Phone showed', check.address ?? 'No address (the map key could not name this spot)'],
  ]
  if (check.match) {
    rows.push(['Nearest customer', `${check.match.customer ? `${check.match.customer} · ` : ''}${check.match.label}${check.match.distance_m != null ? ` (${metersLabel(check.match.distance_m)} away)` : ''}`])
  }
  if (check.chosen) {
    rows.push(['Picked', `${check.chosen.customer ? `${check.chosen.customer} · ` : ''}${check.chosen.label}`])
  }
  if (check.accuracy_m != null) rows.push(['GPS accuracy', `±${metersLabel(check.accuracy_m)}`])

  return (
    <aside
      aria-label="Location check"
      className="absolute bottom-3 right-3 top-3 z-20 flex w-[360px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-navy-900">Location check</h2>
          <p className="text-[11px] text-slate-500">{[check.tech?.name, encounterTime(check)].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          ✕
        </button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: encounterColor(check) }} />
          <span className="font-semibold text-navy-900">“Is this the address where the job is located?”</span>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Answer</div>
          <div className="font-semibold" style={{ color: encounterColor(check) }}>{encounterAnswerLabel(check)}</div>
        </div>
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k}</dt>
              <dd className="m-0 text-navy-900">{v}</dd>
            </div>
          ))}
        </dl>
        {(check.job || check.estimate) && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <div className="mb-1 font-semibold text-navy-900">What it led to</div>
            {check.job && (
              <Link to={`/jobs/${check.job.id}`} className="block text-amber-700 hover:underline">
                Job {check.job.number ? `#${check.job.number}` : ''} {check.job.title ? `· ${check.job.title}` : ''}
              </Link>
            )}
            {check.estimate && (
              <Link to={`/estimates/${check.estimate.id}`} className="block text-amber-700 hover:underline">
                Estimate {check.estimate.number ?? ''} {check.estimate.title ? `· ${check.estimate.title}` : ''}
              </Link>
            )}
            {check.job_address && <div className="mt-1 text-slate-600">At {check.job_address}</div>}
            {check.distance_from_job_m != null && (
              <div className={`mt-0.5 ${check.distance_from_job_m > 200 ? 'font-semibold text-amber-800' : 'text-slate-600'}`}>
                {metersLabel(check.distance_from_job_m)} from where the tech stood
              </div>
            )}
          </div>
        )}
        <div className="text-[11px] text-slate-400">
          {check.latitude.toFixed(5)}, {check.longitude.toFixed(5)}
        </div>
        {check.tech && onOpenDay && (
          <button
            type="button"
            onClick={() => onOpenDay(check.tech!.id)}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-navy-900 hover:border-amber-300 hover:bg-amber-50"
          >
            {check.tech.name}’s day
          </button>
        )}
      </div>
    </aside>
  )
}
