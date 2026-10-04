/**
 * One roll-up tile at the top of an open folder — a count, a money figure,
 * and a one-line meaning — that doubles as a filter for the list below it.
 * Jobs use them for money (collected / unpaid / not invoiced) and progress
 * (complete / still open); estimates for won / lost / dormant. Same tile,
 * so the two pages read as one cabinet.
 */

export type FolderStatTone =
  | 'all'
  | 'collected'
  | 'unpaid'
  | 'not_invoiced'
  | 'complete'
  | 'open'
  | 'won'
  | 'lost'
  | 'dormant'

// Solid left accent + a tinted, ringed active state per tone.
const TONES: Record<FolderStatTone, { bar: string; value: string; activeBg: string; activeBorder: string; ring: string }> = {
  all: { bar: 'bg-navy-800', value: 'text-navy-900', activeBg: 'bg-navy-50', activeBorder: 'border-navy-400', ring: 'ring-navy-200' },
  collected: { bar: 'bg-emerald-500', value: 'text-emerald-700', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-400', ring: 'ring-emerald-200' },
  unpaid: { bar: 'bg-rose-500', value: 'text-rose-700', activeBg: 'bg-rose-50', activeBorder: 'border-rose-400', ring: 'ring-rose-200' },
  not_invoiced: { bar: 'bg-amber-500', value: 'text-amber-700', activeBg: 'bg-amber-50', activeBorder: 'border-amber-400', ring: 'ring-amber-200' },
  complete: { bar: 'bg-emerald-600', value: 'text-emerald-800', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-400', ring: 'ring-emerald-200' },
  open: { bar: 'bg-sky-500', value: 'text-sky-700', activeBg: 'bg-sky-50', activeBorder: 'border-sky-400', ring: 'ring-sky-200' },
  won: { bar: 'bg-emerald-500', value: 'text-emerald-700', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-400', ring: 'ring-emerald-200' },
  lost: { bar: 'bg-rose-500', value: 'text-rose-700', activeBg: 'bg-rose-50', activeBorder: 'border-rose-400', ring: 'ring-rose-200' },
  dormant: { bar: 'bg-slate-400', value: 'text-slate-700', activeBg: 'bg-slate-100', activeBorder: 'border-slate-400', ring: 'ring-slate-200' },
}

export function formatFolderMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function FolderStatTile({
  tone,
  label,
  count,
  countNoun = 'job',
  value,
  sublabel,
  active,
  onClick,
}: {
  tone: FolderStatTone
  label: string
  count?: number
  countNoun?: string
  /** The big figure — money, or a plain count when there's no money to show. */
  value: string
  sublabel: string
  active: boolean
  onClick: () => void
}) {
  const t = TONES[tone]
  return (
    <button
      data-easy-folder-stat={tone}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex flex-col overflow-hidden rounded-lg border py-2.5 pl-4 pr-3.5 text-left shadow-sm transition-all ${
        active ? `${t.activeBg} ${t.activeBorder} ring-2 ${t.ring}` : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${t.bar}`} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        {count !== undefined && (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
            {count} {count === 1 ? countNoun : countNoun + 's'}
          </span>
        )}
      </div>
      <div className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${t.value}`}>{value}</div>
      <div className="mt-0.5 text-[10.5px] text-slate-400">{sublabel}</div>
    </button>
  )
}
