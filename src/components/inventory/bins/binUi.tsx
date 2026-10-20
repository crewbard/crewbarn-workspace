/** The type icons, the fill bar and the colour key for the Bins screen. */
import { FILL_LABELS, type NodeType, type Tone } from '@/lib/binTree'
import { FILL_BG, HATCH, TYPE_COLOR, fmtNum, toneLabel, toneStyle } from './binStyle'

const PATHS: Record<NodeType, string> = {
  location: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  rack: 'M5 3v18M19 3v18M5 8h14M5 13h14M5 18h14',
  shelf: 'M3 7h18M3 17h18M6 7v10M18 7v10',
  bin: 'M4 8l8-4 8 4v8l-8 4-8-4V8zm0 0l8 4 8-4M12 12v8',
  row: 'M4 6h16M4 12h16M4 18h16',
  other: 'M5 5h14v14H5z',
}

export function TypeIcon({ type, size = 26 }: { type: NodeType; size?: number }) {
  const c = TYPE_COLOR[type]
  const isLoc = type === 'location'
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-[8px]"
      style={{ width: size, height: size, background: isLoc ? c : `color-mix(in srgb, ${c} 15%, transparent)`, color: isLoc ? '#fff' : c }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[type]} />
      </svg>
    </span>
  )
}

/** "18 / 20" with a bar, or nothing when the capacity isn't known. */
export function FillBar({ amount, capacity, tone, compact = false }: { amount: number; capacity: number | null; tone: Tone; compact?: boolean }) {
  if (capacity == null || capacity <= 0) return null
  const pct = Math.min(100, Math.round((amount / capacity) * 100))
  return (
    <span className="flex min-w-0 items-center gap-2" title={`${fmtNum(amount)} of ${fmtNum(capacity)} · ${toneLabel(tone)}`}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bins-soft)]">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, ...toneStyle(tone), backgroundImage: 'none' }} />
      </span>
      {!compact && <span className="w-9 text-right text-[11.5px] tabular-nums text-[var(--bins-muted)]">{Math.round((amount / capacity) * 100)}%</span>}
    </span>
  )
}

/** The colour key, honest about what the colours mean. */
export function FillLegend({ withCapacity, withoutCapacity }: { withCapacity: boolean; withoutCapacity: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--bins-muted)]">
      <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded" style={HATCH} />Empty</span>
      {withCapacity && (['light', 'healthy', 'well', 'near', 'over'] as const).map((b) => (
        <span key={b} className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded" style={{ background: FILL_BG[b] }} />{FILL_LABELS[b]}</span>
      ))}
      {withoutCapacity && (
        <span className="inline-flex items-center gap-1" title="These places have no capacity set, so they are shaded against their neighbours, not by how full they are.">
          <i className="inline-block h-3 w-3 rounded" style={{ background: FILL_BG.some }} />
          <i className="inline-block h-3 w-3 rounded" style={{ background: FILL_BG.more }} />
          No capacity set: shaded against neighbours
        </span>
      )}
    </div>
  )
}
