import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  THERMAL_SIZES,
  computeSheetGrid,
  isFullSheetSize,
  rememberThermalSize,
  rememberedThermalSize,
  type ThermalSizeKey,
} from '@/lib/thermalLabels'
import { LabelFace, faceFits, type LabelFaceData } from '@/components/labels/LabelFace'
import { isWebBluetoothSupported } from '@/lib/escposBluetooth'
import { buildLabelBytes } from '@/lib/labelBytes'
import { bridgeIsRunning, bridgePrint, bridgePrinter, bridgeReady } from '@/lib/printBridge'

/**
 * One screen for choosing and printing labels.
 *
 * It replaces the row of dropdowns, checkboxes and number boxes that every
 * labels page grew its own version of. The questions are the same ones;
 * the difference is that they are asked in order, in words, with a picture
 * of the answer — because the failure mode of the old toolbar was never
 * "I could not find the control", it was "I did not know what would come
 * out until it came out".
 *
 * The preview draws the real face components at real proportions, so it is
 * a picture of the print rather than an impression of it.
 *
 * Nothing about printing changes here. Sizes, the sheet grid, the PDF, the
 * PNG, Bluetooth and every URL parameter stay exactly as they were; this
 * decides what to hand them.
 */

export interface LabelScopeOption {
  value: string
  title: string
  help: string
  count: number
}

export interface LabelStudioProps {
  backTo: { href: string; label: string }
  /** The labels that will print, already scoped and expanded. */
  faces: LabelFaceData[]
  size: ThermalSizeKey
  onSize: (next: ThermalSizeKey) => void
  copies: number
  onCopies: (next: number) => void
  gap: number
  onGap: (next: number) => void
  /** Step 1 — omitted entirely where there is nothing to scope. */
  scope?: { value: string; onChange: (next: string) => void; options: LabelScopeOption[] }
  /** The "also label what is inside" switch, where a page has one. */
  extra?: { label: string; on: boolean; onChange: (on: boolean) => void }
  onPrint: () => void
  onBluetooth?: () => void
  onDownloadImage?: () => void
  busy?: string | null
  error?: string | null
}

/** Which sizes belong on which tab, in the order they should be offered. */
const TABS = {
  roll: {
    label: 'Label printer',
    blurb: 'A Dymo, Brother, Zebra or Rollo that prints on a roll.',
    sizes: ['1x1', '2x1', '2.25x1.25', '3x2', '4x6'] as ThermalSizeKey[],
  },
  sheet: {
    label: 'Sticker sheet',
    blurb: 'Peel-off sticker paper in your regular printer.',
    sizes: [
      'full-1x1', 'full-2x1', 'full-2.25x1.25', 'full-3x2',
      'avery-5160', 'avery-5161', 'avery-5163', 'avery-5167', 'full',
    ] as ThermalSizeKey[],
  },
  paper: {
    label: 'Plain paper',
    blurb: 'Print on any paper, then cut or tape.',
    sizes: ['sheet'] as ThermalSizeKey[],
  },
} as const

type TabKey = keyof typeof TABS

function tabFor(size: ThermalSizeKey): TabKey {
  if (size === 'sheet') return 'paper'
  if (isFullSheetSize(size) || size === 'full') return 'sheet'
  return 'roll'
}

const GAPS = [0, 0.0625, 0.125, 0.1875, 0.25]
const GAP_LABEL: Record<string, string> = {
  '0': 'None', '0.0625': '1/16 in', '0.125': '1/8 in', '0.1875': '3/16 in', '0.25': '1/4 in',
}

export function LabelStudio(props: LabelStudioProps) {
  const { faces, size, copies, gap, scope, extra } = props
  const [tab, setTab] = useState<TabKey>(() => tabFor(size))
  const [helpOpen, setHelpOpen] = useState(false)

  // A printer on this computer, chosen by name. Checked once on mount:
  // the bridge either answers on localhost or it does not, and a settings
  // page is where that gets changed, not here.
  const [bridgeOn, setBridgeOn] = useState(false)
  const [viaWindow, setViaWindow] = useState(false)
  const [bridgeBusy, setBridgeBusy] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (!bridgeReady()) return
    void bridgeIsRunning().then((up) => {
      if (alive) setBridgeOn(up)
    })
    return () => {
      alive = false
    }
  }, [])

  const spec = THERMAL_SIZES[size] ?? THERMAL_SIZES.sheet
  const remembered = rememberedThermalSize()
  const isRoll = tabFor(size) === 'roll'
  const isSheet = tabFor(size) === 'sheet'

  const total = faces.length * copies
  const grid = useMemo(
    () => (isSheet && spec.w > 0 ? computeSheetGrid(spec, gap, 0.25) : null),
    [isSheet, spec, gap],
  )
  const perSheet = grid ? grid.cols * grid.rows : 0
  const sheets = perSheet > 0 ? Math.ceil(total / perSheet) : 0
  const blanks = perSheet > 0 ? sheets * perSheet - total : 0

  const fits = faceFits(size)

  const printWords = isSheet
    ? `Print ${sheets} sheet${sheets === 1 ? '' : 's'}`
    : isRoll
      ? `Print ${total} label${total === 1 ? '' : 's'}`
      : `Print ${total} page${total === 1 ? '' : 's'}`

  // Only for a roll. RAW bytes are a label in the printer's own language;
  // a sticker sheet is a page the browser lays out, and there is nothing
  // sensible to send raw.
  const useBridge = bridgeOn && isRoll && !viaWindow
  const bridgeName = bridgePrinter()

  const printViaBridge = async () => {
    setBridgeBusy(true)
    setBridgeError(null)
    try {
      for (const face of faces) {
        // Whatever this computer's printer speaks. A Zebra sent ESC/POS
        // does nothing at all, which reads as a broken cable.
        const bytes = await buildLabelBytes(
          {
            qrValue: face.qrValue,
            title: face.name,
            code: face.code,
            tag: face.tag,
            path: face.path,
            company: face.company,
            phone: face.phone,
            note: face.note,
          },
          size,
        )
        await bridgePrint(bytes, { copies, jobName: 'CrewBarn labels' })
      }
    } catch (e) {
      setBridgeError(
        e instanceof Error
          ? e.message
          : 'The Print Bridge did not answer. Is its window still open?',
      )
    } finally {
      setBridgeBusy(false)
    }
  }

  const pick = (next: ThermalSizeKey) => {
    rememberThermalSize(next)
    props.onSize(next)
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="no-print flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Link to={props.backTo.href} className="text-sm font-semibold text-slate-600 hover:text-navy-900">
          ← Back to {props.backTo.label}
        </Link>
        <span className="min-w-0 grow text-center text-base font-bold text-navy-900">Print labels</span>
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          aria-expanded={helpOpen}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ? Printer help
        </button>
      </div>

      <div className="flex min-h-0 grow flex-col lg:flex-row">
        {/* What will come out */}
        <div className="no-print flex min-w-0 grow flex-col items-center gap-3 p-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-3.5 py-1.5 text-[13px] font-bold text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            {isRoll ? 'Label roll' : isSheet ? 'Sticker sheet' : 'Plain paper'} · {spec.label.split('·').pop()?.trim()}
          </span>

          {isSheet && grid ? (
            <SheetPreview faces={faces} size={size} grid={grid} gap={gap} copies={copies} />
          ) : (
            <RollPreview faces={faces} size={size} />
          )}

          <p className="text-center text-[13px] text-slate-500">
            {isSheet
              ? `${total} label${total === 1 ? '' : 's'} · ${sheets} sheet${sheets === 1 ? '' : 's'} · ${blanks} sticker${blanks === 1 ? '' : 's'} left blank`
              : isRoll
                ? 'Shown at about actual size. Each label tears off on its own.'
                : 'Printed on ordinary paper — cut or tape them on.'}
          </p>
        </div>

        {/* The questions */}
        <aside className="no-print w-full shrink-0 border-t border-slate-200 bg-white lg:w-[440px] lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col">
            <div className="min-h-0 grow overflow-y-auto p-4">
              {helpOpen && <HelpPanel size={size} onClose={() => setHelpOpen(false)} />}

              {scope && (
                <Step n={1} title="What gets a label">
                  <div className="space-y-2">
                    {scope.options.map((o) => (
                      <label
                        key={o.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                          scope.value === o.value ? 'border-amber-400 bg-amber-50/60 ring-1 ring-amber-200' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          checked={scope.value === o.value}
                          onChange={() => scope.onChange(o.value)}
                          className="h-4 w-4 shrink-0 accent-amber-600"
                        />
                        <span className="min-w-0 grow">
                          <span className="block text-sm font-bold text-navy-900">{o.title}</span>
                          <span className="block text-[12px] text-slate-500">{o.help}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-bold text-slate-600">
                          {o.count} label{o.count === 1 ? '' : 's'}
                        </span>
                      </label>
                    ))}
                    {extra && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={extra.on}
                        onClick={() => extra.onChange(!extra.on)}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-slate-300"
                      >
                        <span
                          aria-hidden
                          className={`flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors ${extra.on ? 'bg-amber-500' : 'bg-slate-300'}`}
                        >
                          <span className={`h-4 w-4 rounded-full bg-white transition-transform ${extra.on ? 'translate-x-5' : ''}`} />
                        </span>
                        <span className="text-sm font-semibold text-navy-900">{extra.label}</span>
                      </button>
                    )}
                  </div>
                </Step>
              )}

              <Step n={scope ? 2 : 1} title="What are you printing on?">
                <div className="mb-3 inline-flex w-full rounded-lg border border-slate-200 p-1">
                  {(Object.keys(TABS) as TabKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setTab(k)
                        const first = TABS[k].sizes[0]
                        if (tabFor(size) !== k) pick(first)
                      }}
                      className={`min-h-[40px] grow rounded-md px-2 text-[13px] font-semibold ${
                        tab === k ? 'bg-white text-navy-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500'
                      }`}
                    >
                      {TABS[k].label}
                    </button>
                  ))}
                </div>
                <p className="mb-3 text-[12px] text-slate-500">{TABS[tab].blurb}</p>

                <div className="grid grid-cols-2 gap-2">
                  {TABS[tab].sizes.map((k) => {
                    const sz = THERMAL_SIZES[k]
                    if (!sz) return null
                    const sheetGrid = tab === 'sheet' && sz.w > 0 ? computeSheetGrid(sz, gap, 0.25) : null
                    const per = sheetGrid ? sheetGrid.cols * sheetGrid.rows : 0
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => pick(k)}
                        className={`relative flex items-center gap-2.5 rounded-xl border p-3 text-left ${
                          size === k ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {remembered === k && size !== k && (
                          <span className="absolute -top-2 right-2 rounded bg-sky-100 px-1.5 text-[9px] font-bold uppercase tracking-wide text-sky-700">
                            Last used
                          </span>
                        )}
                        <ShapeSwatch w={sz.w} h={sz.h} />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-bold text-navy-900">{shortName(k)}</span>
                          <span className="block text-[11px] leading-tight text-slate-500">
                            {per > 0 ? `${per} per sheet` : sizeNote(k)}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Step>

              <Step n={scope ? 3 : 2} title="How many of each?">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => props.onCopies(Math.max(1, copies - 1))}
                    className="h-11 w-11 rounded-lg border border-slate-300 text-lg font-bold">−</button>
                  <span className="w-10 text-center text-lg font-bold tabular-nums">{copies}</span>
                  <button type="button" onClick={() => props.onCopies(Math.min(50, copies + 1))}
                    className="h-11 w-11 rounded-lg border border-slate-300 text-lg font-bold">+</button>
                  {[1, 2, 5, 10].map((n) => (
                    <button key={n} type="button" onClick={() => props.onCopies(n)}
                      className={`h-11 w-11 rounded-full text-sm font-bold ${copies === n ? 'bg-navy-900 text-white' : 'border border-slate-300 text-slate-600'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[13px] text-slate-500">
                  {copies === 1
                    ? `${total} label${total === 1 ? '' : 's'} in all`
                    : `${faces.length} labels × ${copies} copies = ${total} labels`}
                </p>
              </Step>

              {isSheet && (
                <Step n={scope ? 4 : 3} title="Space between stickers">
                  <div className="flex flex-wrap gap-2">
                    {GAPS.map((g) => (
                      <button key={g} type="button" onClick={() => props.onGap(g)}
                        className={`min-h-[40px] rounded-lg px-3 text-[13px] font-semibold ${
                          Math.abs(gap - g) < 1e-9 ? 'bg-navy-900 text-white' : 'border border-slate-300 text-slate-600'
                        }`}>
                        {GAP_LABEL[String(g)]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                    {spec.stock
                      ? 'This sheet has its spacing built in — Avery sets it, so this is ignored.'
                      : 'Match the spacing printed on your sticker sheet box. Most cheap sheets have none.'}
                  </p>
                </Step>
              )}

              <Step n={(scope ? 4 : 3) + (isSheet ? 1 : 0)} title="What fits on this size">
                <div className="flex flex-wrap gap-1.5">
                  <Chip on={fits.qr}>QR code</Chip>
                  <Chip on={fits.code}>Code</Chip>
                  <Chip on={fits.name}>Name</Chip>
                  <Chip on={fits.tag}>Type</Chip>
                  <Chip on={fits.path}>Where it is</Chip>
                </div>
                {!fits.name && (
                  <p className="mt-2 text-[12px] text-slate-500">
                    Too small for words. The QR and code still scan fine.
                  </p>
                )}
              </Step>
            </div>

            <div className="shrink-0 border-t border-slate-200 p-4">
              {props.error && (
                <p className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                  {props.error}
                </p>
              )}
              {bridgeError && (
                <p className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                  {bridgeError}
                </p>
              )}

              <button
                type="button"
                onClick={useBridge ? printViaBridge : props.onPrint}
                disabled={total === 0 || Boolean(props.busy) || bridgeBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3.5 text-base font-bold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                🖨 {bridgeBusy ? 'Sending…' : (props.busy ?? printWords)}
              </button>

              {useBridge && (
                <p className="mt-2 text-center text-[12px] leading-relaxed text-slate-500">
                  Straight to <b className="text-slate-700">{bridgeName}</b> — no print window.{' '}
                  <button
                    type="button"
                    onClick={() => setViaWindow(true)}
                    className="font-semibold text-amber-700 underline"
                  >
                    Use the print window instead
                  </button>
                </p>
              )}
              {bridgeOn && isRoll && viaWindow && (
                <p className="mt-2 text-center text-[12px] text-slate-500">
                  Using the print window.{' '}
                  <button
                    type="button"
                    onClick={() => setViaWindow(false)}
                    className="font-semibold text-amber-700 underline"
                  >
                    Send straight to {bridgeName} instead
                  </button>
                </p>
              )}

              {isRoll ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {props.onBluetooth && isWebBluetoothSupported() && (
                    <button type="button" onClick={props.onBluetooth}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left">
                      <span className="block text-[13px] font-bold text-sky-700">Bluetooth printer</span>
                      <span className="block text-[11px] leading-tight text-slate-500">Chrome on a computer or Android</span>
                    </button>
                  )}
                  {props.onDownloadImage && (
                    <button type="button" onClick={props.onDownloadImage}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left">
                      <span className="block text-[13px] font-bold text-navy-900">Download image</span>
                      <span className="block text-[11px] leading-tight text-slate-500">For iPhone or your printer&apos;s app</span>
                    </button>
                  )}
                </div>
              ) : (
                !useBridge && (
                  <p className="mt-2 text-center text-[12px] text-slate-500">
                    Opens your computer&apos;s print window. Pick your regular printer.
                  </p>
                )
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-700">
        {n} · {title}
      </h2>
      {children}
    </section>
  )
}

function Chip({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400 line-through'
      }`}
    >
      {on ? '✓' : ''} {children}
    </span>
  )
}

/** The label's proportions, drawn small, so the shape is the label. */
function ShapeSwatch({ w, h }: { w: number; h: number }) {
  if (!w || !h) return <span className="h-8 w-8 shrink-0 rounded border-2 border-slate-300" />
  const scale = 30 / Math.max(w, h)
  return (
    <span
      className="shrink-0 rounded-[3px] border-2 border-slate-400 bg-white"
      style={{ width: Math.max(10, w * scale), height: Math.max(8, h * scale) }}
    />
  )
}

function RollPreview({ faces, size }: { faces: LabelFaceData[]; size: ThermalSizeKey }) {
  const shown = faces.slice(0, 3)
  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-t-2xl bg-navy-900 px-5 pb-6 pt-4 text-white">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
          <span>Label printer</span>
          <span className="flex items-center gap-1.5">
            Ready <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        </div>
      </div>
      <div className="-mt-3 flex flex-col items-center gap-2 rounded-b-2xl bg-amber-50/60 px-4 pb-4">
        {shown.map((f, i) => (
          <div key={i} className="overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200">
            <LabelFace data={f} size={size} />
          </div>
        ))}
        {faces.length > shown.length && (
          <span className="text-[12px] text-slate-500">+ {faces.length - shown.length} more</span>
        )}
      </div>
    </div>
  )
}

function SheetPreview({
  faces, size, grid, gap, copies,
}: {
  faces: LabelFaceData[]
  size: ThermalSizeKey
  grid: { cols: number; rows: number }
  gap: number
  copies: number
}) {
  const spec = THERMAL_SIZES[size]
  const perSheet = grid.cols * grid.rows
  // One page, drawn to scale. The rest follow the same pattern and do not
  // need to be drawn to be understood.
  const scale = Math.min(440 / 8.5, 560 / 11)
  const used = Math.min(perSheet, faces.length * copies)

  return (
    <div
      className="bg-amber-50/70 shadow-sm ring-1 ring-slate-200"
      style={{ width: 8.5 * scale, height: 11 * scale, padding: 0.25 * scale }}
    >
      <div
        className="grid h-full w-full content-start"
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, ${spec.w * scale}px)`,
          gap: gap * scale,
          justifyContent: 'center',
        }}
      >
        {Array.from({ length: perSheet }).map((_, i) => {
          const face = i < used ? faces[i % faces.length] : null
          return (
            <div
              key={i}
              className={face ? 'overflow-hidden bg-white ring-1 ring-slate-300' : 'rounded-[2px] border border-dashed border-slate-300'}
              style={{ width: spec.w * scale, height: spec.h * scale }}
            >
              {face && <LabelFace data={face} size={size} ppi={scale} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HelpPanel({ size, onClose }: { size: ThermalSizeKey; onClose: () => void }) {
  const spec = THERMAL_SIZES[size] ?? THERMAL_SIZES.sheet
  const roll = tabFor(size) === 'roll'
  const paperName = roll ? `${spec.w}" × ${spec.h}"` : 'Letter'

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 grow text-sm font-bold text-amber-900">
          If a label comes out blank, tiny, or cut off
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-amber-700">✕</button>
      </div>
      {roll && (
        <p className="mt-2 text-[13px] leading-relaxed text-amber-900">
          Start with step 1. Chrome asks Windows what size paper the printer holds — if the driver still says Letter,
          the exact {paperName} page CrewBarn sends is shrunk to fit a sheet of Letter, and nothing in the print
          window can undo that.
        </p>
      )}
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-amber-900">
        {roll ? (
          <li>
            In Windows: <b>Settings → Printers &amp; scanners</b>, click your label printer, then{' '}
            <b>Printing preferences</b>, and set the label size to <b>{paperName}</b>. Save it.
          </li>
        ) : (
          <li>Load the {size === 'sheet' ? 'paper' : 'sticker sheets'} in your regular printer.</li>
        )}
        <li>Pick that printer when the print window opens.</li>
        <li>Set scale to <b>100%</b> (Actual size). Turn <b>Fit to page</b> off — this is the one that ruins it.</li>
        <li>
          Set margins to <b>None</b> and turn headers and footers off. Chrome remembers all of this per site, so it
          is a one-time job.
        </li>
      </ol>

      <div className="mt-3 rounded-lg bg-white/70 p-3">
        <p className="text-[13px] font-bold text-amber-900">Printing labels all day? Get rid of the dialog.</p>
        <p className="mt-1 text-[13px] leading-relaxed text-amber-900">
          Make the label printer your Windows default, then start CrewBarn from a shortcut with this target. Printing
          then goes straight to it, with no window at all:
        </p>
        <code className="mt-2 block overflow-x-auto whitespace-pre rounded bg-white p-2 font-mono text-[12px] text-slate-800">
          chrome.exe --kiosk-printing --app={window.location.origin}
        </code>
        <p className="mt-1.5 text-[12px] text-amber-800">
          It always uses the default printer, so this suits a station with one label printer on it.
        </p>
      </div>
      {spec.stock && (
        <p className="mt-2 text-[12px] leading-relaxed text-amber-900">
          This sheet has fixed label positions. Print the PDF at actual size rather than printing this page — browser
          printing adds its own margins and everything shifts.
        </p>
      )}
    </div>
  )
}

function shortName(k: ThermalSizeKey): string {
  const spec = THERMAL_SIZES[k]
  if (!spec) return k
  if (k === 'sheet') return 'Letter / A4'
  if (k === 'full') return 'One big QR'
  if (spec.stock) return spec.label.split('·')[0].trim()
  return `${spec.w} × ${spec.h} in`
}

function sizeNote(k: ThermalSizeKey): string {
  switch (k) {
    case '1x1': return 'Tiny square'
    case '2x1': return 'Small'
    case '2.25x1.25': return 'Dymo 30334 · most common'
    case '3x2': return 'Big and easy to read'
    case '4x6': return 'Shipping size'
    case 'full': return 'Whole page'
    case 'sheet': return 'Regular paper'
    default: return ''
  }
}
