import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { prefetchClip, speakLine, stopLine } from '@/lib/tourVoice'

/**
 * "Set the pins" page tour.
 *
 * A brass key flies from stop to stop and turns when it lands, the page dims
 * around whatever it's talking about, captions light up word by word with the
 * voice, and each finished stop sets a pin in the lock at the bottom of the
 * card. When every pin is set, the padlock pops open. Locksmith shop, after all.
 */

export type KeyTourStep = { id: string; element: string; title: string; description: string; narration: string }
export type KeyTourFinale = { id: string; title: string; description: string; narration: string }

type Box = { top: number; left: number; width: number; height: number }

const PAD = 10
const CARD_W = 360

export function OnboardingKeyTour({ steps, finale, clips, audioOn, onToggleAudio, onClose, onWorkflow }: {
  steps: KeyTourStep[]
  finale: KeyTourFinale
  clips: Record<string, string>
  audioOn: boolean
  onToggleAudio: () => void
  onClose: (completed: boolean) => void
  onWorkflow: () => void
}) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'tour' | 'finale'>('tour')
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [landed, setLanded] = useState(false)
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const reduceMotion = useRef(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const step = steps[index]

  const goNext = useCallback(() => {
    stopLine()
    setPlaying(true)
    if (index < steps.length - 1) setIndex(index + 1)
    else setPhase('finale')
  }, [index, steps.length])

  const goBack = useCallback(() => {
    stopLine()
    setPlaying(true)
    if (phase === 'finale') setPhase('tour')
    else setIndex(Math.max(0, index - 1))
  }, [index, phase])

  const close = useCallback((completed: boolean) => { stopLine(); onClose(completed) }, [onClose])

  // Bring the stop into view, then track it every frame so the spotlight
  // follows scrolling, resizing and layout shifts without any listeners.
  useEffect(() => {
    if (phase !== 'tour' || !step) return
    const element = document.querySelector<HTMLElement>(step.element)
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion.current ? 'auto' : 'smooth' })
    setLanded(false)
    const landing = window.setTimeout(() => setLanded(true), reduceMotion.current ? 0 : 850)
    let frame = 0
    let last = ''
    const track = () => {
      const target = document.querySelector<HTMLElement>(step.element)
      const rect = target?.getBoundingClientRect()
      const next = rect && rect.width > 0 ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null
      const signature = next ? `${Math.round(next.top)},${Math.round(next.left)},${Math.round(next.width)},${Math.round(next.height)}` : 'none'
      if (signature !== last) { last = signature; setBox(next) }
      frame = requestAnimationFrame(track)
    }
    track()
    return () => { cancelAnimationFrame(frame); window.clearTimeout(landing) }
  }, [phase, step])

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Say the line, light the captions, move on when the voice finishes.
  useEffect(() => {
    if (!playing) return
    const line = phase === 'finale' ? finale : step
    if (!line) return
    let cancelled = false
    let timer = 0
    setProgress(audioOn ? 0 : 1)
    const nextId = phase === 'tour' ? (steps[index + 1]?.id ?? finale.id) : null
    if (nextId) prefetchClip(clips[nextId])
    const advance = (delay: number) => {
      if (phase === 'finale') return
      timer = window.setTimeout(() => { if (!cancelled) goNext() }, delay)
    }
    if (audioOn) {
      void speakLine({ text: line.narration, clipUrl: clips[line.id], onProgress: (fraction) => { if (!cancelled) setProgress(fraction) } })
        .then((result) => { if (!cancelled && result === 'ended') advance(900) })
    } else {
      advance(Math.max(4500, line.narration.length * 48))
    }
    return () => { cancelled = true; window.clearTimeout(timer); stopLine() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, playing, audioOn])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(phase === 'finale')
      else if (event.key === 'ArrowRight' && phase === 'tour') goNext()
      else if (event.key === 'ArrowLeft') goBack()
      else if (event.key === ' ' && phase === 'tour') { event.preventDefault(); setPlaying((value) => !value) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, goBack, goNext, phase])

  useEffect(() => () => stopLine(), [])

  const narration = phase === 'finale' ? finale.narration : step?.narration ?? ''
  const words = narration.split(/\s+/).filter(Boolean)
  const lit = audioOn ? Math.round(progress * words.length) : words.length
  const cardStyle = placeCard(phase === 'tour' ? box : null, viewport)
  const keyStyle: CSSProperties = box && phase === 'tour'
    ? { transform: `translate(${box.left - 46}px, ${box.top - 30}px) rotate(35deg)` }
    : { transform: `translate(${viewport.w / 2 - 30}px, ${viewport.h / 2 - 150}px) rotate(0deg)`, opacity: phase === 'finale' ? 0 : 1 }

  return (
    <div className="cbt-root fixed inset-0 z-[160]" role="dialog" aria-modal="true" aria-label="Guided page tour">
      <style>{TOUR_CSS}</style>

      {/* Swallow stray clicks so the setup screen underneath can't change mid-tour. */}
      <div className="fixed inset-0" onClick={(event) => event.stopPropagation()} />

      {/* The dimmer is a giant shadow around the spotlight, so the hole glides between stops. */}
      {phase === 'tour' && box ? (
        <div className="cbt-spot pointer-events-none fixed rounded-2xl" style={{ top: box.top, left: box.left, width: box.width, height: box.height }}>
          <div className={`absolute inset-0 rounded-2xl ring-2 ring-amber-400 ${landed ? 'cbt-pulse' : ''}`} />
        </div>
      ) : (
        <div className="fixed inset-0 bg-navy-950/70 backdrop-blur-[2px]" />
      )}

      {/* The guide: a brass key that travels, then turns in the "lock". */}
      <div className="cbt-key pointer-events-none fixed left-0 top-0" style={keyStyle} aria-hidden="true">
        <div className={landed && phase === 'tour' ? 'cbt-turn' : ''}><BrassKey /></div>
        {landed && phase === 'tour' && <span key={index} className="cbt-spark" />}
      </div>

      {phase === 'tour' && step && (
        <section key={step.id} className="cbt-card fixed rounded-3xl border border-white/10 bg-navy-950 p-5 text-white shadow-2xl" style={cardStyle} aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">Stop {index + 1} of {steps.length}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onToggleAudio} aria-pressed={audioOn} title={audioOn ? 'Mute the guide' : 'Turn the guide’s voice on'}
                className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10">
                <Wave active={audioOn && playing && progress < 1} muted={!audioOn} />
                {audioOn ? 'Voice' : 'Muted'}
              </button>
              <button type="button" onClick={() => close(false)} aria-label="Close tour" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
            </div>
          </div>
          <h3 className="mt-3 text-xl font-black leading-tight">{step.title}</h3>
          <p className="mt-2 text-[15px] leading-7">
            {words.map((word, i) => (
              <span key={i} className={`transition-colors duration-200 ${i < lit ? 'text-white' : 'text-slate-500'}`}>{word}{' '}</span>
            ))}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={goBack} disabled={index === 0} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold disabled:opacity-30">Back</button>
            <button type="button" onClick={() => setPlaying((value) => !value)} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold">{playing ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={goNext} className="ml-auto rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-navy-950 hover:bg-amber-400">{index === steps.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
          <PinStack total={steps.length} set={index} />
        </section>
      )}

      {phase === 'finale' && (
        <div className="fixed inset-0 grid place-items-center p-4" style={{ zIndex: 3 }}>
        <section className="cbt-pop relative w-full max-w-[440px] rounded-3xl bg-white p-7 text-center shadow-2xl" aria-live="polite">
          <KeyRain />
          <div className="relative mx-auto w-20"><Padlock /></div>
          <h3 className="relative mt-3 text-2xl font-black text-navy-950">{finale.title}</h3>
          <p className="relative mt-2 text-sm leading-6 text-slate-600">{finale.description}</p>
          <div className="relative mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => close(true)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">I’m good for now</button>
            <button type="button" onClick={() => { stopLine(); onClose(true); onWorkflow() }} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-navy-950 shadow-sm hover:bg-amber-400">Show me the whole shop</button>
          </div>
        </section>
        </div>
      )}
    </div>
  )
}

function placeCard(box: Box | null, viewport: { w: number; h: number }): CSSProperties {
  const width = Math.min(CARD_W, viewport.w - 32)
  const estimatedHeight = 330
  const clampTop = (top: number) => Math.max(16, Math.min(top, viewport.h - estimatedHeight - 16))
  const clampLeft = (left: number) => Math.max(16, Math.min(left, viewport.w - width - 16))
  if (!box || viewport.w < 640) {
    // Phones: dock to the bottom so the highlighted thing stays visible above.
    return { width, left: clampLeft((viewport.w - width) / 2), bottom: 16 }
  }
  if (box.left + box.width + 24 + width <= viewport.w - 16) return { width, left: box.left + box.width + 24, top: clampTop(box.top) }
  if (box.left - 24 - width >= 16) return { width, left: box.left - 24 - width, top: clampTop(box.top) }
  const below = box.top + box.height + 20
  if (below + estimatedHeight <= viewport.h) return { width, left: clampLeft(box.left + box.width / 2 - width / 2), top: below }
  return { width, left: clampLeft(box.left + box.width / 2 - width / 2), top: Math.max(16, box.top - estimatedHeight - 20) }
}

/** Progress as lock pins: each finished stop lifts its pin to the shear line. */
function PinStack({ total, set }: { total: number; set: number }) {
  return (
    <div className="mt-5 flex items-end gap-3 border-t border-white/10 pt-4" aria-label={`${set} of ${total} pins set`}>
      <svg viewBox={`0 0 ${total * 18 + 8} 40`} className="h-9" aria-hidden="true">
        <rect x="0" y="22" width={total * 18 + 8} height="16" rx="4" fill="#1e293b" />
        <line x1="0" y1="22" x2={total * 18 + 8} y2="22" stroke="#f59e0b" strokeDasharray="2 3" strokeWidth="1" opacity="0.6" />
        {Array.from({ length: total }, (_, i) => {
          const isSet = i < set
          const current = i === set
          return (
            <g key={i} className="cbt-pin" style={{ transform: `translateY(${isSet ? -8 : 0}px)` }}>
              <rect x={6 + i * 18} y="6" width="8" height="12" rx="2" fill={isSet ? '#f59e0b' : current ? '#fcd34d' : '#475569'} className={current ? 'cbt-blink' : ''} />
              <rect x={6 + i * 18} y="19" width="8" height="12" rx="2" fill={isSet ? '#b45309' : '#64748b'} />
            </g>
          )
        })}
      </svg>
      <span className="pb-1 text-xs font-semibold text-slate-400">{set === 0 ? 'Setting the first pin…' : `${set} pin${set === 1 ? '' : 's'} set`}</span>
    </div>
  )
}

function Wave({ active, muted }: { active: boolean; muted: boolean }) {
  if (muted) return <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 3.5 4.5 6H2v4h2.5L8 12.5z" fill="currentColor" stroke="none" /><path d="m11 6 4 4m0-4-4 4" /></svg>
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3].map((bar) => <span key={bar} className={`w-[3px] rounded-full bg-amber-300 ${active ? 'cbt-wave' : ''}`} style={{ height: active ? undefined : 4, animationDelay: `${bar * 0.12}s` }} />)}
    </span>
  )
}

function BrassKey() {
  return (
    <svg width="64" height="28" viewBox="0 0 64 28" aria-hidden="true" className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]">
      <defs>
        <linearGradient id="cbt-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="14" r="11" fill="url(#cbt-brass)" />
      <circle cx="9" cy="14" r="3.5" fill="#0b1324" />
      <path d="M22 11h40v6H22z" fill="url(#cbt-brass)" />
      <path d="M44 17h4v5h-4zM51 17h3v7h-3zM57 17h4v4h-4z" fill="url(#cbt-brass)" />
    </svg>
  )
}

function Padlock() {
  return (
    <svg viewBox="0 0 80 90" aria-hidden="true">
      <path className="cbt-shackle" d="M22 42V26a18 18 0 0 1 36 0v16" fill="none" stroke="#94a3b8" strokeWidth="9" strokeLinecap="round" />
      <rect x="10" y="40" width="60" height="46" rx="10" fill="#f59e0b" />
      <rect x="10" y="40" width="60" height="10" rx="5" fill="#fcd34d" opacity="0.6" />
      <circle cx="40" cy="60" r="6" fill="#0b1324" />
      <path d="M37 62h6l2 14h-10z" fill="#0b1324" />
    </svg>
  )
}

function KeyRain() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl opacity-60" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="cbt-fall absolute top-0" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.18}s` }}>
          <span className="block origin-top-left" style={{ transform: `scale(${0.35 + (i % 3) * 0.12})` }}><BrassKey /></span>
        </span>
      ))}
    </div>
  )
}

const TOUR_CSS = `
.cbt-spot { box-shadow: 0 0 0 200vmax rgba(7, 12, 26, 0.68); transition: top .7s cubic-bezier(.65,0,.35,1), left .7s cubic-bezier(.65,0,.35,1), width .7s cubic-bezier(.65,0,.35,1), height .7s cubic-bezier(.65,0,.35,1); }
.cbt-key { transition: transform .85s cubic-bezier(.65,0,.35,1), opacity .4s; z-index: 2; }
.cbt-card { z-index: 3; animation: cbt-rise .45s cubic-bezier(.2,.9,.3,1.2) both; }
.cbt-pulse { animation: cbt-pulse 2s ease-out infinite; }
.cbt-turn { animation: cbt-turn .6s ease-in-out both; transform-origin: 30% 50%; }
.cbt-spark { position: absolute; left: 52px; top: 8px; width: 14px; height: 14px; border-radius: 9999px; background: radial-gradient(circle, #fff7d6 0%, #fbbf24 45%, transparent 70%); animation: cbt-spark .7s ease-out .35s both; }
.cbt-pin { transition: transform .5s cubic-bezier(.3,1.6,.5,1); }
.cbt-blink { animation: cbt-blink 1.2s ease-in-out infinite; }
.cbt-wave { height: 4px; animation: cbt-wave .9s ease-in-out infinite; }
.cbt-pop { animation: cbt-pop .5s cubic-bezier(.2,.9,.3,1.3) both; }
.cbt-shackle { animation: cbt-shackle .6s cubic-bezier(.3,1.6,.5,1) .5s both; }
.cbt-fall { animation: cbt-fall 2.6s ease-in both; }
@keyframes cbt-rise { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes cbt-pulse { 0% { box-shadow: 0 0 0 0 rgba(251,191,36,.55); } 70% { box-shadow: 0 0 0 16px rgba(251,191,36,0); } 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); } }
@keyframes cbt-turn { 0% { transform: scaleY(1); } 45% { transform: scaleY(.18); } 100% { transform: scaleY(1); } }
@keyframes cbt-spark { 0% { transform: scale(.2); opacity: 0; } 40% { opacity: 1; } 100% { transform: scale(2.6); opacity: 0; } }
@keyframes cbt-blink { 50% { opacity: .45; } }
@keyframes cbt-wave { 0%, 100% { height: 4px; } 50% { height: 14px; } }
@keyframes cbt-pop { from { opacity: 0; transform: translateY(12px) scale(.9); } to { opacity: 1; transform: none; } }
@keyframes cbt-shackle { from { transform: translateY(0); } to { transform: translateY(-9px); } }
@keyframes cbt-fall { 0% { transform: translateY(-40px) rotate(0); opacity: 0; } 15% { opacity: .9; } 100% { transform: translateY(420px) rotate(320deg); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .cbt-spot, .cbt-key, .cbt-pin { transition: none; }
  .cbt-card, .cbt-pulse, .cbt-turn, .cbt-spark, .cbt-blink, .cbt-wave, .cbt-pop, .cbt-shackle, .cbt-fall { animation: none; }
  .cbt-fall { display: none; }
}
`
