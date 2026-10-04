import { QRCodeCanvas } from 'qrcode.react'
import { THERMAL_SIZES, type ThermalSizeKey } from '@/lib/thermalLabels'

/**
 * What is actually on a label.
 *
 * One component for the preview and for printing, drawn from the same
 * numbers, because a preview built separately is a preview of something
 * else — and the whole complaint about label printing is that what came
 * out did not match what was on screen.
 *
 * Thermal printers print one colour, so none of this uses colour to mean
 * anything: the hierarchy is size, weight and a solid black tag. The
 * location pin is an SVG rather than the 📍 emoji, which thermal heads
 * render as a grey smudge or drop entirely.
 *
 * Words fall away as the label shrinks rather than being squeezed. A 1×1
 * carries the QR and the code and nothing else — a name in 4pt is not a
 * name, it is a stripe.
 */

export interface LabelFaceData {
  qrValue: string
  /** Heavy, up to two lines. */
  name: string
  /** Monospace, under the name. */
  code?: string
  /** BIN, EXTINGUISHER, SERIAL… solid black, printed as a block. */
  tag?: string
  /** Where it lives: "Shop › Rack A › Shelf 3". */
  path?: string
  /** Only shown on the sizes with room — 3×2 and the placards. */
  company?: string
  phone?: string
  /** Extra line on big faces, e.g. what the group is for. */
  note?: string
}

/** Pixels per inch to draw at, capped so a 4×6 still fits a screen. */
export function faceScale(size: ThermalSizeKey): number {
  const spec = THERMAL_SIZES[size]
  if (!spec || spec.w === 0) return 96
  return Math.min(120, 300 / spec.w, 250 / spec.h)
}

export function LabelFace({
  data,
  size,
  ppi,
}: {
  data: LabelFaceData
  size: ThermalSizeKey
  /** Override the drawing scale — printing wants a bigger one than preview. */
  ppi?: number
}) {
  const spec = THERMAL_SIZES[size] ?? THERMAL_SIZES.sheet
  const scale = ppi ?? faceScale(size)
  const w = (spec.w || 2) * scale
  const h = (spec.h || 1) * scale

  // The three shapes a label can be. Anything else is one of these with
  // different numbers.
  const isTiny = spec.w <= 1.05 && spec.h <= 1.05
  const isPlacard = spec.w >= 3.9 || spec.h >= 5.5 || size === 'full'

  if (isTiny) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-white text-black"
        style={{ width: w, height: h, padding: scale * 0.04 }}
      >
        <QRCodeCanvas value={data.qrValue} size={Math.round(h * 0.72)} level="M" includeMargin={false} />
        {data.code && (
          <span
            className="mt-[2px] w-full truncate text-center font-mono font-bold leading-none"
            style={{ fontSize: Math.max(5, scale * 0.085) }}
          >
            {data.code}
          </span>
        )}
      </div>
    )
  }

  if (isPlacard) {
    return (
      <div className="flex flex-col bg-white text-black" style={{ width: w, height: h }}>
        {(data.company || data.phone) && (
          <div
            className="flex items-center justify-between bg-black px-[4%] text-white"
            style={{ height: h * 0.07, fontSize: Math.max(7, h * 0.026) }}
          >
            <span className="truncate font-bold">{data.company}</span>
            <span className="shrink-0 font-semibold">{data.phone}</span>
          </div>
        )}
        <div className="flex min-h-0 grow flex-col items-center justify-center px-[6%]">
          <QRCodeCanvas value={data.qrValue} size={Math.round(Math.min(w * 0.62, h * 0.46))} level="M" includeMargin={false} />
          <span
            className="mt-[3%] w-full text-center font-extrabold leading-tight"
            style={{ fontSize: Math.max(10, h * 0.045), overflowWrap: 'anywhere' }}
          >
            {data.name}
          </span>
          {data.code && (
            <span className="mt-[1%] font-mono font-bold" style={{ fontSize: Math.max(7, h * 0.026) }}>
              {data.code}
            </span>
          )}
          {data.note && (
            <span className="mt-[2%] text-center" style={{ fontSize: Math.max(6, h * 0.02) }}>
              {data.note}
            </span>
          )}
        </div>
        <div
          className="border-t border-black text-center font-semibold"
          style={{ fontSize: Math.max(6, h * 0.021), padding: `${h * 0.012}px 0` }}
        >
          Point your phone camera here
        </div>
      </div>
    )
  }

  // The common shape: QR on the left, words on the right.
  const qr = Math.round(h * 0.82)
  const body = Math.max(6, h * 0.115)
  const hasCompany = spec.w >= 2.9 && (data.company || data.phone)

  return (
    <div
      className="flex items-center gap-[3%] bg-white text-black"
      style={{ width: w, height: h, padding: h * 0.07 }}
    >
      <QRCodeCanvas value={data.qrValue} size={qr} level="M" includeMargin={false} />
      <div className="flex min-w-0 grow flex-col justify-center" style={{ gap: h * 0.02 }}>
        <span
          className="font-extrabold leading-[1.05]"
          style={{
            fontSize: body * 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {data.name}
        </span>
        {data.code && (
          <span className="truncate font-mono font-semibold leading-none" style={{ fontSize: body * 0.92 }}>
            {data.code}
          </span>
        )}
        {data.tag && (
          <span
            className="w-fit bg-black font-bold uppercase leading-none text-white"
            style={{ fontSize: body * 0.78, padding: `${h * 0.022}px ${h * 0.04}px`, letterSpacing: '0.04em' }}
          >
            {data.tag}
          </span>
        )}
        {data.path && (
          <span className="flex items-start gap-[3px] leading-tight" style={{ fontSize: body * 0.82 }}>
            <PinIcon size={body * 0.9} />
            <span
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
              }}
            >
              {data.path}
            </span>
          </span>
        )}
        {hasCompany && (
          <span className="truncate font-semibold leading-none" style={{ fontSize: body * 0.8 }}>
            {[data.company, data.phone].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}

/** A pin that survives a thermal head, unlike the emoji it replaces. */
function PinIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      style={{ flexShrink: 0, marginTop: size * 0.12 }}
    >
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  )
}

/** What each size has room for — drives the "what fits" chips. */
export function faceFits(size: ThermalSizeKey): { qr: boolean; code: boolean; name: boolean; tag: boolean; path: boolean } {
  const spec = THERMAL_SIZES[size] ?? THERMAL_SIZES.sheet
  const tiny = spec.w <= 1.05 && spec.h <= 1.05
  return {
    qr: true,
    code: true,
    name: !tiny,
    tag: !tiny,
    path: !tiny && spec.w >= 1.9,
  }
}
