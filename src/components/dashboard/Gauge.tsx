/**
 * Gauge — a semicircular SVG gauge (ServiceTitan-style revenue dial).
 * `value` is 0..1; the arc fills + the needle points to that fraction.
 * Dependency-free.
 */
export function Gauge({
  value,
  color = '#3b82f6',
  track = '#e2e8f0',
  height = 130,
  fill = false,
}: {
  value: number
  color?: string
  track?: string
  height?: number
  /** Fill the parent's box (both dimensions) instead of sizing by width.
   *  Drop into a `flex-1 min-h-0` slot so it scales to the tile height. */
  fill?: boolean
}) {
  const f = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const cx = 110
  const cy = 110
  const r = 84
  // Full 180° arc (left → right over the top).
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const len = Math.PI * r
  // Needle angle: f=0 → points left (180°), f=1 → points right (0°).
  const theta = Math.PI * (1 - f)
  const nx = cx + (r - 16) * Math.cos(theta)
  const ny = cy - (r - 16) * Math.sin(theta)

  const inner = (
    <>
      <path d={arc} fill="none" stroke={track} strokeWidth={16} strokeLinecap="round" />
      <path
        d={arc}
        fill="none"
        stroke={color}
        strokeWidth={16}
        strokeLinecap="round"
        strokeDasharray={`${f * len} ${len}`}
      />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#0f172a" strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="#0f172a" />
    </>
  )

  if (fill) {
    // Fixed viewBox (the gauge geometry); `meet` scales it to fit whatever
    // box the flex slot gives us — width OR height, whichever is tighter.
    return (
      <div className="flex h-full w-full items-center justify-center">
        <svg viewBox="0 0 220 124" className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img">
          {inner}
        </svg>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 240 }}>
      <svg viewBox={`0 0 220 ${height}`} className="w-full" style={{ height: 'auto', display: 'block' }} preserveAspectRatio="xMidYMid meet" role="img">
        {inner}
      </svg>
    </div>
  )
}
