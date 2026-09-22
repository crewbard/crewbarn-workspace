import { useEffect, useRef, useState } from 'react'

/**
 * Dependency-free SVG charts for dashboard widgets. Each measures its
 * container (ResizeObserver). By default it renders at a FIXED pixel height
 * (the `height` prop). Pass `fill` and the chart instead fills its container's
 * available HEIGHT — drop it into a `flex-1 min-h-0` slot and it shrinks to fit
 * shorter tiles (small/medium card sizes) with no scrollbar.
 */

function fmtUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/** Measure a wrapper's content width + height. */
function useMeasure(initialH = 140): [React.RefObject<HTMLDivElement | null>, number, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: initialH })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize((prev) => {
        const w = cr.width > 0 ? cr.width : prev.w
        const h = cr.height > 0 ? cr.height : prev.h
        return w === prev.w && h === prev.h ? prev : { w, h }
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size.w, size.h]
}

/** Effective height: measured (fill) or the fixed prop. Floored so labels fit. */
function effHeight(fill: boolean, measured: number, fixed: number): number {
  return Math.max(60, fill ? measured : fixed)
}

const wrapCls = (fill: boolean) => (fill ? 'w-full h-full min-h-0 overflow-hidden' : 'w-full')

function labelStride(n: number, width: number): number {
  const maxLabels = Math.max(2, Math.floor(width / 70))
  return n > maxLabels ? Math.ceil(n / maxLabels) : 1
}

// ---------- Single-series bars ----------

export function MiniBarChart({
  data,
  color = '#E8902C',
  colorAt,
  height = 140,
  fill = false,
}: {
  data: Array<{ label: string; cents: number }>
  color?: string
  /** Optional per-bar color (overrides `color`). */
  colorAt?: (i: number) => string
  height?: number
  fill?: boolean
}) {
  const [ref, W, H] = useMeasure(height)
  const h = effHeight(fill, H, height)
  const padBottom = 22
  const padTop = 8
  const chartH = Math.max(1, h - padBottom - padTop)
  const n = Math.max(data.length, 1)
  const gap = Math.max(4, W / (n * 6))
  const barW = Math.max(2, (W - gap * (n + 1)) / n)
  const max = Math.max(1, ...data.map((d) => d.cents))
  const every = labelStride(n, W)

  return (
    <div ref={ref} className={wrapCls(fill)}>
      <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} role="img">
        <line x1={0} y1={h - padBottom} x2={W} y2={h - padBottom} stroke="#e2e8f0" strokeWidth={1} />
        {data.map((d, i) => {
          const bh = (d.cents / max) * chartH
          const x = gap + i * (barW + gap)
          const y = padTop + (chartH - bh)
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={Math.max(bh, d.cents > 0 ? 2 : 0)} rx={2} fill={colorAt ? colorAt(i) : color} opacity={0.9}>
                <title>{`${d.label}: ${fmtUsd(d.cents)}`}</title>
              </rect>
              {i % every === 0 && (
                <text x={x + barW / 2} y={h - 7} textAnchor="middle" fontSize={11} fill="#94a3b8">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ---------- Grouped (in vs out) bars ----------

export function DualBarChart({
  data,
  inColor = '#15803d',
  outColor = '#dc2626',
  height = 150,
  fill = false,
}: {
  data: Array<{ label: string; inCents: number; outCents: number }>
  inColor?: string
  outColor?: string
  height?: number
  fill?: boolean
}) {
  const [ref, W, H] = useMeasure(height)
  const h = effHeight(fill, H, height)
  const padBottom = 22
  const padTop = 8
  const chartH = Math.max(1, h - padBottom - padTop)
  const n = Math.max(data.length, 1)
  const groupGap = Math.max(6, W / (n * 5))
  const groupW = Math.max(6, (W - groupGap * (n + 1)) / n)
  const barW = Math.max(2, (groupW - 3) / 2)
  const max = Math.max(1, ...data.flatMap((d) => [d.inCents, d.outCents]))
  const every = labelStride(n, W)

  return (
    <div ref={ref} className={wrapCls(fill)}>
      <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} role="img">
        <line x1={0} y1={h - padBottom} x2={W} y2={h - padBottom} stroke="#e2e8f0" strokeWidth={1} />
        {data.map((d, i) => {
          const gx = groupGap + i * (groupW + groupGap)
          const inH = (d.inCents / max) * chartH
          const outH = (d.outCents / max) * chartH
          return (
            <g key={i}>
              <rect x={gx} y={padTop + (chartH - inH)} width={barW} height={Math.max(inH, d.inCents > 0 ? 2 : 0)} rx={2} fill={inColor} opacity={0.9}>
                <title>{`${d.label} in: ${fmtUsd(d.inCents)}`}</title>
              </rect>
              <rect x={gx + barW + 3} y={padTop + (chartH - outH)} width={barW} height={Math.max(outH, d.outCents > 0 ? 2 : 0)} rx={2} fill={outColor} opacity={0.9}>
                <title>{`${d.label} out: ${fmtUsd(d.outCents)}`}</title>
              </rect>
              {i % every === 0 && (
                <text x={gx + groupW / 2} y={h - 7} textAnchor="middle" fontSize={11} fill="#94a3b8">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ---------- Stacked bars (segments per group) ----------

export function StackedBarChart({
  data,
  groups,
  colorFor,
  height = 150,
  fill = false,
}: {
  data: Array<{ label: string; byGroup: Record<string, number> }>
  groups: string[]
  colorFor: (g: string) => string
  height?: number
  fill?: boolean
}) {
  const [ref, W, H] = useMeasure(height)
  const h = effHeight(fill, H, height)
  const padBottom = 22
  const padTop = 8
  const chartH = Math.max(1, h - padBottom - padTop)
  const n = Math.max(data.length, 1)
  const gap = Math.max(4, W / (n * 6))
  const barW = Math.max(2, (W - gap * (n + 1)) / n)
  const max = Math.max(
    1,
    ...data.map((d) => groups.reduce((s, g) => s + (d.byGroup[g] ?? 0), 0)),
  )
  const every = labelStride(n, W)

  return (
    <div ref={ref} className={wrapCls(fill)}>
      <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} role="img">
        <line x1={0} y1={h - padBottom} x2={W} y2={h - padBottom} stroke="#e2e8f0" strokeWidth={1} />
        {data.map((d, i) => {
          const x = gap + i * (barW + gap)
          let yCursor = h - padBottom
          return (
            <g key={i}>
              {groups.map((g) => {
                const cents = d.byGroup[g] ?? 0
                if (cents <= 0) return null
                const bh = (cents / max) * chartH
                yCursor -= bh
                return (
                  <rect key={g} x={x} y={yCursor} width={barW} height={Math.max(bh, 1)} fill={colorFor(g)} opacity={0.92}>
                    <title>{`${d.label} · ${g}: ${fmtUsd(cents)}`}</title>
                  </rect>
                )
              })}
              {i % every === 0 && (
                <text x={x + barW / 2} y={h - 7} textAnchor="middle" fontSize={11} fill="#94a3b8">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ---------- Grouped (in vs out) lines ----------

export function DualLineChart({
  data,
  inColor = '#15803d',
  outColor = '#dc2626',
  height = 150,
  fill = false,
}: {
  data: Array<{ label: string; inCents: number; outCents: number }>
  inColor?: string
  outColor?: string
  height?: number
  fill?: boolean
}) {
  const [ref, W, H] = useMeasure(height)
  const h = effHeight(fill, H, height)
  const padX = 8
  const padBottom = 22
  const padTop = 8
  const chartH = Math.max(1, h - padBottom - padTop)
  const n = data.length
  const max = Math.max(1, ...data.flatMap((d) => [d.inCents, d.outCents]))
  const every = labelStride(Math.max(n, 1), W)
  const xAt = (i: number) => (n <= 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1))
  const yAt = (cents: number) => padTop + (chartH - (cents / max) * chartH)
  const path = (key: 'inCents' | 'outCents') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d[key]).toFixed(1)}`).join(' ')

  return (
    <div ref={ref} className={wrapCls(fill)}>
      <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} role="img">
        <line x1={0} y1={h - padBottom} x2={W} y2={h - padBottom} stroke="#e2e8f0" strokeWidth={1} />
        {n > 0 && (
          <>
            <path d={path('inCents')} fill="none" stroke={inColor} strokeWidth={2} strokeLinejoin="round" />
            <path d={path('outCents')} fill="none" stroke={outColor} strokeWidth={2} strokeLinejoin="round" />
            {data.map((d, i) => (
              <g key={i}>
                <circle cx={xAt(i)} cy={yAt(d.inCents)} r={2.5} fill={inColor} />
                <circle cx={xAt(i)} cy={yAt(d.outCents)} r={2.5} fill={outColor} />
                {i % every === 0 && (
                  <text x={xAt(i)} y={h - 7} textAnchor="middle" fontSize={11} fill="#94a3b8">
                    {d.label}
                  </text>
                )}
              </g>
            ))}
          </>
        )}
      </svg>
    </div>
  )
}
