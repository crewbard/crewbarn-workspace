import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type {
  FilmAccountVisual,
  FilmCalendarVisual,
  FilmCartVisual,
  FilmChipsVisual,
  FilmFormVisual,
  FilmGoVisual,
  FilmListVisual,
  FilmMapVisual,
  FilmMoneyVisual,
  FilmPipelineVisual,
  FilmRow,
  FilmSignatureVisual,
  FilmTextVisual,
  FilmThreadVisual,
  FilmTilesVisual,
  FilmTitleVisual,
  FilmTogglesVisual,
  FilmTone,
  FilmVisual,
} from '@/lib/pageTours/film'

/**
 * The intro films' drawings: one small animated picture per kind of visual
 * (lib/pageTours/film.ts). Each one is drawn from its data, and falls back
 * to generic sample data that fits any trade when a field is left out.
 *
 * Animations build each picture up over the first few seconds of a scene.
 * With reduced motion (`still`) every animation is off and the picture is
 * shown as it ends: every element's resting style is its final frame.
 */

/** Delay, in seconds, for a piece that builds in. */
const at = (seconds: number, extra?: CSSProperties): CSSProperties => ({ ...(extra ?? {}), '--d': `${seconds}s` }) as CSSProperties

const money = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** A number counting up to `target`, starting after `delay` ms. */
function useCountUp(target: number, delay: number, still: boolean, duration = 1100): number {
  const [value, setValue] = useState(still ? target : 0)
  useEffect(() => {
    if (still) { setValue(target); return }
    setValue(0)
    let frame = 0
    let begin = 0
    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!begin) begin = now
        const t = Math.min(1, (now - begin) / duration)
        setValue(target * (1 - Math.pow(1 - t, 3)))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, delay)
    return () => { window.clearTimeout(timer); cancelAnimationFrame(frame) }
  }, [target, delay, still, duration])
  return value
}

function Chip({ tone = 'gray', children, style, className = '' }: { tone?: FilmTone; children: ReactNode; style?: CSSProperties; className?: string }) {
  return <span className={`cbpf-chip ${className}`} data-tone={tone} style={style}>{children}</span>
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

// ---------- generic sample data (any trade) ----------

const ROWS: FilmRow[] = [
  { title: 'Service call', meta: 'Rivera family · Today, 9:00', chip: 'In progress', tone: 'amber' },
  { title: 'New install', meta: 'Oakwood Dental · Today, 1:00', chip: 'Scheduled', tone: 'blue' },
  { title: 'Repair visit', meta: 'Harbor View Apartments', chip: 'Needs scheduling', tone: 'gray' },
  { title: 'Yearly inspection', meta: 'City Library', chip: 'Done', tone: 'green' },
  { title: 'Follow-up visit', meta: 'Chen residence', chip: 'Invoiced', tone: 'purple' },
]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const VISITS: NonNullable<FilmCalendarVisual['visits']> = [
  { day: 0, slot: 0, label: 'Service call', tone: 'blue' },
  { day: 1, slot: 1, span: 2, label: 'New install', tone: 'amber' },
  { day: 2, slot: 0, label: 'Estimate visit', tone: 'purple' },
  { day: 3, slot: 2, label: 'Repair', tone: 'blue' },
  { day: 4, slot: 0, span: 2, label: 'Maintenance', tone: 'green' },
  { day: 0, slot: 2, label: 'Inspection', tone: 'green' },
  { day: 2, slot: 3, label: 'Follow-up', tone: 'gray' },
]
const PINS: NonNullable<FilmMapVisual['pins']> = [
  { label: 'Sam', x: 18, y: 70, to: { x: 46, y: 40 }, tone: 'blue', person: true },
  { label: 'Alex', x: 78, y: 24, to: { x: 70, y: 62 }, tone: 'green', person: true },
  { label: 'Job', x: 46, y: 40, tone: 'amber' },
  { label: 'Job', x: 70, y: 62, tone: 'amber' },
  { label: 'Nobody yet', x: 30, y: 22, tone: 'red' },
]
const MESSAGES: NonNullable<FilmThreadVisual['messages']> = [
  { from: 'them', text: 'Hi! Can someone come out this week?', channel: 'text' },
  { from: 'us', text: 'Sure. Does Thursday at 10 work?', channel: 'text' },
  { from: 'them', text: 'Thursday works. Thank you!', channel: 'text' },
]
const CART_ITEMS: NonNullable<FilmCartVisual['items']> = [
  { name: 'Mounting bracket', qty: 2, job: 'Repair visit' },
  { name: 'Sealant', qty: 3, job: 'New install' },
  { name: 'Replacement motor', qty: 1, job: 'Service call' },
]
const BILL: NonNullable<FilmMoneyVisual['lines']> = [
  { label: 'Labor', amount: 240 },
  { label: 'Parts', amount: 86.5 },
  { label: 'Trip charge', amount: 45 },
]

// ---------- the drawings ----------

function TitleVisual({ v }: { v: FilmTitleVisual }) {
  return (
    <div className="cbpf-center text-center">
      <svg viewBox="0 0 64 40" className="cbpf-roof mx-auto h-10 w-16" aria-hidden="true"><path d="M58 34 L32 8 L6 34" /></svg>
      {v.area && <div className="cbpf-in mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700" style={at(0.3)}>{v.area}</div>}
      <div className="cbpf-slam mt-1 text-4xl font-black leading-none tracking-tight sm:text-5xl" style={at(0.5)}>{v.title}</div>
      <div className="cbpf-bar mx-auto mt-3 h-1.5 w-24 rounded-full bg-amber-400" style={at(0.9)} />
      {v.subtitle && <div className="cbpf-in mt-3 text-sm font-semibold text-slate-600" style={at(1.2)}>{v.subtitle}</div>}
    </div>
  )
}

function TextVisual({ v }: { v: FilmTextVisual }) {
  return (
    <div className="cbpf-center max-w-lg text-center">
      <div className="cbpf-slam text-2xl font-black leading-tight sm:text-3xl" style={at(0.2)}>{v.headline}</div>
      {v.body && <div className="cbpf-in mt-3 text-sm leading-6 text-slate-600 sm:text-base" style={at(0.8)}>{v.body}</div>}
    </div>
  )
}

function ChipsVisual({ v }: { v: FilmChipsVisual }) {
  return (
    <div className="cbpf-center max-w-xl text-center">
      {v.heading && <div className="cbpf-in mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-500">{v.heading}</div>}
      <div className="flex flex-wrap justify-center gap-2">
        {v.chips.map((chip, i) => (
          <span key={chip} className="cbpf-pop rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold shadow-sm" style={at(0.3 + i * 0.45)}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />{chip}
          </span>
        ))}
      </div>
    </div>
  )
}

function GoVisual({ v }: { v: FilmGoVisual }) {
  return (
    <div className="cbpf-center w-full max-w-md">
      <div className="relative rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="h-3 w-24 rounded bg-slate-800/80" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="h-12 rounded-lg bg-slate-100" />
          <div className="cbpf-lit h-12 rounded-lg bg-slate-100" style={at(1.3)} />
          <div className="h-12 rounded-lg bg-slate-100" />
        </div>
        <div className="mt-2 h-16 rounded-lg bg-slate-100" />
        <svg viewBox="0 0 24 24" className="cbpf-cursor absolute h-7 w-7" aria-hidden="true" style={at(0.2)}>
          <path d="M4 3l15 7-6 2-2 6z" fill="#0b1324" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="cbpf-in mt-4 text-center text-xl font-black" style={at(1.6)}>{v.label ?? 'Let’s walk through it'} <span className="text-amber-600">→</span></div>
    </div>
  )
}

function ListVisual({ v }: { v: FilmListVisual }) {
  const rows = v.rows?.length ? v.rows : ROWS
  const startRows = v.search ? 1.4 : 0.3
  return (
    <div className="cbpf-center w-full max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
        {(v.heading || v.search) && (
          <div className="mb-2 flex items-center gap-2 px-1">
            {v.heading && <div className="text-sm font-black">{v.heading}</div>}
            {v.search && (
              <div className="ml-auto flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                <span aria-hidden="true">⌕</span>
                <span className="cbpf-type" style={at(0.3, { ['--n' as string]: v.search.length })}>{v.search}</span>
              </div>
            )}
          </div>
        )}
        <ul className="grid gap-1.5">
          {rows.slice(0, 5).map((row, i) => (
            <li key={`${row.title}-${i}`} className="cbpf-slide flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2" style={at(startRows + i * 0.4)}>
              <span className="h-7 w-1 shrink-0 rounded-full" data-tone-bar={row.tone ?? 'gray'} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">{row.title}</div>
                {row.meta && <div className="truncate text-[11px] text-slate-500">{row.meta}</div>}
              </div>
              {row.chip && <Chip tone={row.tone} className="cbpf-pop" style={at(startRows + i * 0.4 + 0.35)}>{row.chip}</Chip>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function CalendarVisual({ v }: { v: FilmCalendarVisual }) {
  const days = v.days?.length ? v.days.slice(0, 5) : DAYS
  const visits = v.visits?.length ? v.visits : VISITS
  return (
    <div className="cbpf-center w-full max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => <div key={d} className="pb-1 text-center text-[11px] font-black uppercase tracking-wider text-slate-500">{d}</div>)}
        </div>
        <div className="relative grid gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gridTemplateRows: 'repeat(4, 34px)' }}>
          {Array.from({ length: days.length * 4 }, (_, k) => <div key={k} className="rounded-md bg-slate-50" style={{ gridColumn: (k % days.length) + 1, gridRow: Math.floor(k / days.length) + 1 }} />)}
          {visits.filter((x) => x.day < days.length).map((x, i) => (
            <div
              key={`${x.label}-${i}`}
              className="cbpf-drop truncate rounded-md px-1.5 py-1 text-[10px] font-bold leading-tight sm:text-[11px]"
              data-tone-block={x.tone ?? 'blue'}
              style={at(0.3 + i * 0.35, { gridColumn: x.day + 1, gridRow: `${Math.min(x.slot, 3) + 1} / span ${Math.max(1, Math.min(x.span ?? 1, 4 - Math.min(x.slot, 3)))}` })}
            >{x.label}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MapVisual({ v }: { v: FilmMapVisual }) {
  const pins = v.pins?.length ? v.pins : PINS
  return (
    <div className="cbpf-center w-full max-w-lg">
      <div className="cbpf-map relative h-[200px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm sm:h-[230px]">
        <div className="cbpf-park" style={{ left: '56%', top: '8%', width: '22%', height: '26%' }} />
        <div className="cbpf-water" style={{ left: '-4%', top: '78%', width: '45%', height: '30%' }} />
        {v.route !== false && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {pins.filter((p) => p.to).map((p, i) => (
              <path key={i} className="cbpf-route" d={`M${p.x} ${p.y} L${p.x} ${p.to!.y} L${p.to!.x} ${p.to!.y}`} style={at(0.4 + i * 0.3)} />
            ))}
          </svg>
        )}
        {pins.map((p, i) => {
          const end = p.to ?? { x: p.x, y: p.y }
          const style = at(0.2 + i * 0.25, {
            left: `${end.x}%`, top: `${end.y}%`,
            ['--fx' as string]: `${p.x}%`, ['--fy' as string]: `${p.y}%`, ['--tx' as string]: `${end.x}%`, ['--ty' as string]: `${end.y}%`,
          })
          return (
            <div key={`${p.label}-${i}`} className={`cbpf-pin ${p.to ? 'moving' : ''} ${p.person ? 'person' : ''}`} data-tone-pin={p.tone ?? 'amber'} style={style}>
              <span className="cbpf-pin-dot">{p.person ? initials(p.label) : ''}</span>
              <span className="cbpf-pin-label">{p.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CHANNEL: Record<string, string> = { text: 'Text', email: 'Email', call: 'Call', portal: 'Portal' }

function ThreadVisual({ v }: { v: FilmThreadVisual }) {
  const messages = (v.messages?.length ? v.messages : MESSAGES).slice(0, 4)
  const lastThem = messages.map((m) => m.from).lastIndexOf('them')
  let t = 0.3
  const timing = messages.map((_, i) => {
    const typing = i === lastThem && i > 0 ? t : null
    if (typing != null) t += 1.3
    const show = t
    t += 0.9
    return { typing, show }
  })
  return (
    <div className="cbpf-center w-full max-w-sm">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-[11px] font-black text-amber-800">{initials(v.contact ?? 'Maria Rivera')}</span>
          <div className="text-sm font-black">{v.contact ?? 'Maria Rivera'}</div>
          <span className="ml-auto text-[11px] font-bold text-slate-400">{CHANNEL[messages[0]?.channel ?? 'text']}</span>
        </div>
        <div className="grid gap-1.5 p-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'us' ? 'justify-end' : 'justify-start'}`}>
              <div className="relative max-w-[80%]">
                {timing[i].typing != null && (
                  <span className="cbpf-typing absolute left-0 top-0 rounded-2xl bg-slate-100 px-3 py-2" style={at(timing[i].typing!)} aria-hidden="true"><i /><i /><i /></span>
                )}
                <div className={`cbpf-bubble rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${m.from === 'us' ? 'rounded-br-md bg-navy-950 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`} style={at(timing[i].show)}>
                  {m.channel && m.channel !== (messages[0]?.channel ?? 'text') && <span className="mr-1 text-[10px] font-black uppercase opacity-60">{CHANNEL[m.channel]}</span>}
                  {m.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CartVisual({ v }: { v: FilmCartVisual }) {
  const items = (v.items?.length ? v.items : CART_ITEMS).slice(0, 4)
  const orderAt = 0.4 + items.length * 0.5 + 0.4
  return (
    <div className="cbpf-center flex w-full max-w-xl items-stretch gap-2 sm:gap-3">
      <div className="w-1/2 min-w-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="mb-1.5 flex items-center gap-2 text-sm font-black">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 10.4a1 1 0 0 0 1 .6h8.8a1 1 0 0 0 1-.7L20 8H6" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></svg>
          Parts cart
          <span className="cbpf-pop ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-black" style={at(0.4 + (items.length - 1) * 0.5 + 0.2)}>{items.length}</span>
        </div>
        <ul className="grid gap-1">
          {items.map((item, i) => (
            <li key={`${item.name}-${i}`} className="cbpf-drop flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[12px]" style={at(0.4 + i * 0.5)}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-200 text-[10px] font-black">×{item.qty}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{item.name}</span>
              {item.job && <span className="truncate text-[10px] text-slate-500">{item.job}</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="cbpf-slide relative w-1/2 min-w-0 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-2.5 shadow-sm" style={at(orderAt)}>
        <div className="flex items-center gap-2">
          <div className="text-sm font-black">{v.order ?? 'Purchase order'}</div>
          <Chip tone="gray" className="ml-auto">Draft</Chip>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500">{v.supplier ?? 'Your supplier'}</div>
        <div className="mt-2 grid gap-1">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-[11px]"><span className="truncate">{item.name}</span><span className="font-bold">×{item.qty}</span></div>
          ))}
        </div>
        <span className="cbpf-stamp absolute right-3 top-8" style={at(orderAt + 1)}>Sent</span>
      </div>
    </div>
  )
}

function MoneyVisual({ v, still }: { v: FilmMoneyVisual; still: boolean }) {
  const lines = (v.lines?.length ? v.lines : BILL).slice(0, 5)
  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  const totalAt = 0.3 + lines.length * 0.4 + 0.1
  const shown = useCountUp(total, totalAt * 1000, still)
  return (
    <div className="cbpf-center w-full max-w-sm">
      <div className="relative rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-black">{v.title ?? 'Invoice'}</div>
          <div className="text-[11px] text-slate-400">#1042</div>
        </div>
        <div className="mt-2 grid gap-1.5">
          {lines.map((l, i) => (
            <div key={`${l.label}-${i}`} className="cbpf-slide flex justify-between border-b border-dashed border-slate-200 pb-1 text-[13px]" style={at(0.3 + i * 0.4)}>
              <span>{l.label}</span><span className="font-semibold tabular-nums">{money(l.amount)}</span>
            </div>
          ))}
        </div>
        <div className="cbpf-in mt-2 flex items-baseline justify-between" style={at(totalAt)}>
          <span className="text-sm font-black">Total</span>
          <span className="text-2xl font-black tabular-nums">{money(shown)}</span>
        </div>
        {v.stamp !== '' && <span className="cbpf-stamp green absolute right-4 top-9" style={at(totalAt + 1.4)}>{v.stamp ?? 'Paid'}</span>}
      </div>
    </div>
  )
}

function SignatureVisual({ v }: { v: FilmSignatureVisual }) {
  const lines = (v.lines?.length ? v.lines : ['The work, step by step', 'Parts and materials', 'Warranty']).slice(0, 4)
  return (
    <div className="cbpf-center">
      <div className="cbpf-phone relative">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300" />
        <div className="cbpf-in text-[13px] font-black" style={at(0.2)}>{v.doc ?? 'Estimate'}</div>
        <div className="mt-1.5 grid gap-1">
          {lines.map((l, i) => (
            <div key={i} className="cbpf-in flex items-center gap-1.5 text-[11px] text-slate-600" style={at(0.4 + i * 0.25)}>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{l}
            </div>
          ))}
        </div>
        <div className="cbpf-in mt-2 flex justify-between text-[12px] font-black" style={at(1.2)}><span>Total</span><span>{v.total ?? '$1,250.00'}</span></div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 pb-1 pt-1">
          <svg viewBox="0 0 160 46" className="h-11 w-full" aria-hidden="true">
            <path className="cbpf-sign" style={at(1.6)} d="M8 34 C 18 6, 26 6, 24 30 S 40 40, 46 20 S 58 8, 60 30 C 62 40, 72 20, 80 26 S 96 36, 104 18 C 110 8, 116 34, 124 28 S 140 20, 152 24" />
          </svg>
          <div className="border-t border-slate-300 pt-0.5 text-[9px] text-slate-500">{v.signer ?? 'Customer signature'}</div>
        </div>
        <span className="cbpf-stamp green absolute -right-3 top-10" style={at(3.4)}>{v.stamp ?? 'Signed'}</span>
      </div>
    </div>
  )
}

function AccountVisual({ v }: { v: FilmAccountVisual }) {
  const name = v.name ?? 'Harbor View Apartments'
  const places = (v.places?.length ? v.places : ['Main office', 'Building B', 'Pool house']).slice(0, 3)
  const people = (v.people?.length ? v.people : ['Dana Lee', 'Chris Patel']).slice(0, 3)
  const jobs = (v.jobs?.length ? v.jobs : [{ title: 'Repair visit', chip: 'Scheduled', tone: 'blue' as FilmTone }, { title: 'New install', chip: 'Paid', tone: 'green' as FilmTone }]).slice(0, 3)
  return (
    <div className="cbpf-center w-full max-w-xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="cbpf-in flex items-center gap-2.5" style={at(0.2)}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-950 text-sm font-black text-amber-300">{initials(name)}</span>
          <div className="min-w-0">
            <div className="truncate text-base font-black">{name}</div>
            <div className="text-[11px] text-slate-500">{v.type ?? 'Commercial'}</div>
          </div>
          <Chip tone="amber" className="cbpf-pop ml-auto" style={at(0.7)}>{v.balance ?? '$420.00 owed'}</Chip>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="mb-1 font-black uppercase tracking-wider text-slate-400">Places</div>
            {places.map((p, i) => <div key={p} className="cbpf-slide mb-1 truncate rounded-md bg-slate-50 px-1.5 py-1 font-semibold" style={at(1 + i * 0.3)}>⌂ {p}</div>)}
          </div>
          <div>
            <div className="mb-1 font-black uppercase tracking-wider text-slate-400">People</div>
            {people.map((p, i) => (
              <div key={p} className="cbpf-slide mb-1 flex items-center gap-1 truncate rounded-md bg-slate-50 px-1.5 py-1 font-semibold" style={at(1.9 + i * 0.3)}>
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-200 text-[8px] font-black">{initials(p)}</span><span className="truncate">{p}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 font-black uppercase tracking-wider text-slate-400">Jobs</div>
            {jobs.map((j, i) => (
              <div key={`${j.title}-${i}`} className="cbpf-slide mb-1 rounded-md bg-slate-50 px-1.5 py-1" style={at(2.6 + i * 0.3)}>
                <div className="truncate font-semibold">{j.title}</div>
                {j.chip && <Chip tone={j.tone} className="mt-0.5" style={{ fontSize: 9 }}>{j.chip}</Chip>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PipelineVisual({ v }: { v: FilmPipelineVisual }) {
  const stages = (v.stages?.length ? v.stages : ['New', 'Scheduled', 'In progress', 'Done', 'Invoiced', 'Paid']).slice(0, 6)
  const stop = Math.min(Math.max(v.stopAt ?? stages.length - 1, 0), stages.length - 1)
  const step = 0.75
  return (
    <div className="cbpf-center w-full max-w-2xl">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => (
          <div key={s} className="flex min-w-0 flex-col items-center gap-2">
            <div className={`cbpf-stage w-full truncate rounded-lg px-1 py-1.5 text-center text-[10px] font-black sm:text-[12px] ${i <= stop ? 'reached' : ''}`} style={at(0.4 + i * step)}>{s}</div>
            <div className="relative h-14 w-full rounded-xl bg-white/70 ring-1 ring-slate-200">
              {i <= stop && (
                <div className={`cbpf-card absolute inset-1.5 truncate rounded-lg bg-white px-1.5 py-1 text-[10px] font-bold shadow ring-1 ring-amber-300 sm:text-[11px] ${i < stop ? 'pass' : 'stay'}`} style={at(0.4 + i * step)}>
                  {v.card ?? 'Repair visit'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FormVisual({ v }: { v: FilmFormVisual }) {
  const fields = (v.fields?.length ? v.fields : [
    { label: 'Customer', value: 'Rivera family' },
    { label: 'Place', value: '12 Oak Street' },
    { label: 'The work', value: 'Repair visit' },
    { label: 'When', value: 'Thursday, 10:00' },
    { label: 'Who', value: 'Sam' },
  ]).slice(0, 5)
  const per = 0.8
  return (
    <div className="cbpf-center w-full max-w-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-1.5">
          {fields.map((f, i) => (
            <label key={`${f.label}-${i}`} className="grid grid-cols-[84px_1fr] items-center gap-2 text-[12px]">
              <span className="font-bold text-slate-500">{f.label}</span>
              <span className="cbpf-field rounded-lg border border-slate-200 bg-slate-50 px-2 py-1" style={at(0.3 + i * per)}>
                <span className="cbpf-type" style={at(0.3 + i * per, { ['--n' as string]: f.value.length })}>{f.value}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <span className="cbpf-press rounded-xl bg-amber-400 px-4 py-1.5 text-sm font-black" style={at(0.3 + fields.length * per + 0.2)}>{v.button ?? 'Save'}</span>
        </div>
      </div>
    </div>
  )
}

function Tile({ tile, i, still }: { tile: NonNullable<FilmTilesVisual['tiles']>[number]; i: number; still: boolean }) {
  const value = useCountUp(tile.value, (0.3 + i * 0.35) * 1000, still)
  const whole = Number.isInteger(tile.value)
  return (
    <div className="cbpf-pop rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" style={at(0.3 + i * 0.35)}>
      <div className="text-[11px] font-bold text-slate-500">{tile.label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums" data-tone-text={tile.tone ?? 'gray'}>
        {tile.prefix ?? ''}{whole ? Math.round(value).toLocaleString('en-US') : value.toFixed(1)}{tile.suffix ?? ''}
      </div>
    </div>
  )
}

function TilesVisual({ v, still }: { v: FilmTilesVisual; still: boolean }) {
  const tiles = (v.tiles?.length ? v.tiles : [
    { label: 'Jobs today', value: 8, tone: 'blue' as FilmTone },
    { label: 'Waiting on parts', value: 3, tone: 'amber' as FilmTone },
    { label: 'Unpaid', value: 1240, prefix: '$', tone: 'red' as FilmTone },
    { label: 'Done this week', value: 27, tone: 'green' as FilmTone },
  ]).slice(0, 4)
  return (
    <div className="cbpf-center grid w-full max-w-lg grid-cols-2 gap-2">
      {tiles.map((tile, i) => <Tile key={`${tile.label}-${i}`} tile={tile} i={i} still={still} />)}
    </div>
  )
}

function TogglesVisual({ v }: { v: FilmTogglesVisual }) {
  const rows = (v.rows?.length ? v.rows : [
    { label: 'Send reminders', on: true },
    { label: 'Text when on the way', on: true },
    { label: 'Ask for a signature', on: false },
    { label: 'Email the invoice', on: true },
  ]).slice(0, 5)
  return (
    <div className="cbpf-center w-full max-w-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {v.heading && <div className="mb-2 text-sm font-black">{v.heading}</div>}
        <ul className="grid gap-1.5">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`} className="cbpf-slide flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-[13px] font-semibold" style={at(0.3 + i * 0.35)}>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className={`cbpf-switch ${r.on === false ? '' : 'on'}`} style={at(0.7 + i * 0.35)}><i /></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** One scene's drawing. */
export function FilmVisualView({ visual, still }: { visual: FilmVisual; still: boolean }) {
  switch (visual.kind) {
    case 'title': return <TitleVisual v={visual} />
    case 'text': return <TextVisual v={visual} />
    case 'chips': return <ChipsVisual v={visual} />
    case 'go': return <GoVisual v={visual} />
    case 'list': return <ListVisual v={visual} />
    case 'calendar': return <CalendarVisual v={visual} />
    case 'map': return <MapVisual v={visual} />
    case 'thread': return <ThreadVisual v={visual} />
    case 'cart': return <CartVisual v={visual} />
    case 'money': return <MoneyVisual v={visual} still={still} />
    case 'signature': return <SignatureVisual v={visual} />
    case 'account': return <AccountVisual v={visual} />
    case 'pipeline': return <PipelineVisual v={visual} />
    case 'form': return <FormVisual v={visual} />
    case 'tiles': return <TilesVisual v={visual} still={still} />
    case 'toggles': return <TogglesVisual v={visual} />
    default: return null
  }
}

const TONES: Record<FilmTone, [string, string]> = {
  gray: ['#e2e8f0', '#334155'],
  blue: ['#dbeafe', '#1d4ed8'],
  amber: ['#fef3c7', '#b45309'],
  green: ['#dcfce7', '#15803d'],
  red: ['#fee2e2', '#b91c1c'],
  purple: ['#ede9fe', '#6d28d9'],
}
const toneCss = (Object.keys(TONES) as FilmTone[]).map((tone) => {
  const [bg, fg] = TONES[tone]
  return `.cbpf [data-tone="${tone}"]{background:${bg};color:${fg}}
.cbpf [data-tone-bar="${tone}"]{background:${fg}}
.cbpf [data-tone-block="${tone}"]{background:${bg};color:${fg};box-shadow:inset 3px 0 0 ${fg}}
.cbpf [data-tone-pin="${tone}"] .cbpf-pin-dot{background:${fg}}
.cbpf [data-tone-text="${tone}"]{color:${fg}}`
}).join('\n')

/**
 * The drawings' CSS. Every piece rests at its final frame; the animations
 * start it from somewhere else after its `--d` delay. `.still` (reduced
 * motion) turns them all off. `.paused` holds them where they are.
 */
export const FILM_VISUAL_CSS = `
.cbpf { color: #0b1324; }
.cbpf.paused * { animation-play-state: paused !important; }
.cbpf.still *, .cbpf.still *::before, .cbpf.still *::after { animation: none !important; transition: none !important; }
.cbpf-center { margin: 0 auto; }
.cbpf-chip { display: inline-block; white-space: nowrap; border-radius: 99px; padding: 2px 8px; font-size: 10.5px; font-weight: 800; }
.cbpf-in { animation: cbpf-up .55s cubic-bezier(.2,1.2,.4,1) var(--d, 0s) both; }
.cbpf-slam { animation: cbpf-slam .6s cubic-bezier(.2,1.3,.4,1) var(--d, 0s) both; }
.cbpf-pop { animation: cbpf-pop .45s cubic-bezier(.2,1.5,.4,1) var(--d, 0s) both; }
.cbpf-slide { animation: cbpf-slide .5s cubic-bezier(.2,1.1,.4,1) var(--d, 0s) both; }
.cbpf-drop { animation: cbpf-drop .55s cubic-bezier(.2,1.4,.4,1) var(--d, 0s) both; }
.cbpf-bar { transform-origin: left; animation: cbpf-grow .7s cubic-bezier(.6,0,.2,1) var(--d, 0s) both; }
.cbpf-roof path { fill: none; stroke: #f59e0b; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 420; animation: cbpf-draw .9s .1s cubic-bezier(.6,0,.2,1) both; }
.cbpf-type { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; max-width: 100%; animation: cbpf-type calc(var(--n, 10) * 45ms) steps(var(--n, 10), end) var(--d, 0s) both; }
.cbpf-field { animation: cbpf-focus 1.1s ease var(--d, 0s) none; }
.cbpf-press { animation: cbpf-press .9s ease var(--d, 0s) both; }
.cbpf-cursor { left: 50%; top: 22px; animation: cbpf-cursor 1.2s cubic-bezier(.6,0,.2,1) var(--d, 0s) both; }
.cbpf-lit { box-shadow: 0 0 0 3px #fbbf24; animation: cbpf-lit 1.4s ease var(--d, 0s) both; }
.cbpf-map { background-color: #eef2e6; background-image: linear-gradient(#fff 3px, transparent 3px), linear-gradient(90deg, #fff 3px, transparent 3px); background-size: 46px 38px; }
.cbpf-park { position: absolute; border-radius: 14px; background: #d6ead0; }
.cbpf-water { position: absolute; border-radius: 40%; background: #cfe3f3; }
.cbpf-route { fill: none; stroke: #0b1324; stroke-opacity: .55; stroke-width: 1.2; stroke-dasharray: 3 2.5; vector-effect: non-scaling-stroke; animation: cbpf-fade .6s ease var(--d, 0s) both; }
.cbpf-pin { position: absolute; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; animation: cbpf-drop .5s cubic-bezier(.2,1.4,.4,1) var(--d, 0s) both; }
.cbpf-pin.moving { animation: cbpf-drop .5s cubic-bezier(.2,1.4,.4,1), cbpf-drive 3.2s cubic-bezier(.5,0,.3,1); animation-delay: var(--d, 0s), calc(var(--d, 0s) + .7s); animation-fill-mode: both, both; }
.cbpf-pin-dot { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.25); font-size: 0; }
.cbpf-pin.person .cbpf-pin-dot { width: 24px; height: 24px; border-radius: 50%; transform: none; font-size: 9px; font-weight: 900; color: #fff; }
.cbpf-pin-label { margin-top: 2px; border-radius: 6px; background: rgba(255,255,255,.92); padding: 0 5px; font-size: 10px; font-weight: 800; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.cbpf-bubble { animation: cbpf-pop .4s cubic-bezier(.2,1.4,.4,1) var(--d, 0s) both; }
.cbpf-typing { display: flex; gap: 3px; opacity: 0; animation: cbpf-typing 1.3s ease var(--d, 0s) both; }
.cbpf-typing i { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; animation: cbpf-dot .9s ease-in-out infinite; }
.cbpf-typing i:nth-child(2) { animation-delay: .15s; } .cbpf-typing i:nth-child(3) { animation-delay: .3s; }
.cbpf-stamp { display: inline-block; transform: rotate(-12deg); border: 3px solid #b45309; color: #b45309; border-radius: 8px; padding: 1px 10px; font-size: 15px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; background: rgba(255,255,255,.85); animation: cbpf-stamp .5s cubic-bezier(.2,1.6,.4,1) var(--d, 0s) both; }
.cbpf-stamp.green { border-color: #15803d; color: #15803d; }
.cbpf-phone { width: 184px; border-radius: 26px; border: 6px solid #0b1324; background: #fff; padding: 8px 12px 14px; box-shadow: 0 14px 30px rgba(11,19,36,.2); animation: cbpf-up .55s cubic-bezier(.2,1.2,.4,1) var(--d, 0s) both; }
.cbpf-sign { fill: none; stroke: #1d4ed8; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 420; animation: cbpf-draw 1.6s cubic-bezier(.5,0,.4,1) var(--d, 0s) both; }
.cbpf-stage { background: #e2e8f0; color: #475569; }
.cbpf-stage.reached { background: #0b1324; color: #fde68a; animation: cbpf-reach .4s ease var(--d, 0s) both; }
.cbpf-card.stay { animation: cbpf-pop .45s cubic-bezier(.2,1.5,.4,1) var(--d, 0s) both; }
.cbpf-card.pass { opacity: 0; animation: cbpf-pass .75s ease var(--d, 0s) none; }
.cbpf-switch { position: relative; width: 34px; height: 20px; flex: none; border-radius: 99px; background: #cbd5e1; }
.cbpf-switch i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.cbpf-switch.on { background: #16a34a; animation: cbpf-switch-bg .4s ease var(--d, 0s) both; }
.cbpf-switch.on i { left: 16px; animation: cbpf-switch .4s ease var(--d, 0s) both; }
${toneCss}
@keyframes cbpf-up { from { opacity: 0; transform: translateY(14px); } }
@keyframes cbpf-slam { from { opacity: 0; transform: scale(1.35); filter: blur(5px); } }
@keyframes cbpf-pop { from { opacity: 0; transform: scale(.6); } }
@keyframes cbpf-slide { from { opacity: 0; transform: translateX(28px); } }
@keyframes cbpf-drop { from { opacity: 0; transform: translateY(-26px) scale(.9); } }
@keyframes cbpf-grow { from { transform: scaleX(0); } }
@keyframes cbpf-draw { from { stroke-dashoffset: 420; } }
@keyframes cbpf-fade { from { opacity: 0; } }
@keyframes cbpf-type { from { max-width: 0; } }
@keyframes cbpf-focus { from { border-color: #f59e0b; box-shadow: 0 0 0 2px rgba(245,158,11,.35); } 99% { border-color: #f59e0b; box-shadow: 0 0 0 2px rgba(245,158,11,.35); } }
@keyframes cbpf-press { 0% { opacity: 0; transform: scale(.8); } 40% { opacity: 1; transform: scale(1.08); } 60% { transform: scale(.95); } }
@keyframes cbpf-cursor { from { left: 8%; top: 80%; opacity: 0; } 20% { opacity: 1; } }
@keyframes cbpf-lit { from { box-shadow: 0 0 0 0 rgba(251,191,36,0); } 60% { box-shadow: 0 0 0 8px rgba(251,191,36,.35); } }
@keyframes cbpf-drive { from { left: var(--fx); top: var(--fy); } }
@keyframes cbpf-typing { 0% { opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { opacity: 0; } }
@keyframes cbpf-dot { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes cbpf-stamp { from { opacity: 0; transform: rotate(-12deg) scale(2.2); } }
@keyframes cbpf-reach { from { background: #e2e8f0; color: #475569; } }
@keyframes cbpf-pass { 0% { opacity: 0; transform: translateX(-10px); } 25% { opacity: 1; transform: none; } 80% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateX(14px); } }
@keyframes cbpf-switch { from { left: 2px; } }
@keyframes cbpf-switch-bg { from { background: #cbd5e1; } }
@media (prefers-reduced-motion: reduce) { .cbpf *, .cbpf *::before, .cbpf *::after { animation: none !important; transition: none !important; } }
`
