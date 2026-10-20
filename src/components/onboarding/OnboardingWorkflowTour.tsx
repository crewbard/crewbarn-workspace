import { useEffect, useMemo, useRef, useState } from 'react'
import { useOnboardingWalkthrough } from '@/components/onboarding/onboardingWalkthrough'
import { buildOnboardingStages } from '@/components/onboarding/onboardingStages'
import { useOnboardingStatus } from '@/hooks/useOnboarding'
import { prefetchClip, speakLine, stopLine } from '@/lib/tourVoice'

/**
 * The onboarding roadmap, played like a short video.
 *
 * The map is drawn in SVG and a camera moves along it chapter by chapter:
 * boxes appear, arrows draw themselves, finished parts get green checks, and
 * the captions light up with the voice. On the last chapter, when the guide
 * says "That's the road", the camera pulls back to show the whole map.
 *
 * Words and layout live in onboarding-workflow.json ("roadmap"), so the
 * recorded voice and the screen stay in step.
 */

const W = 1500
const H = 420
const FULL = { x: -60, w: 6560 }

export function OnboardingWorkflowTour({ open, audioOn, onClose, onSetup }: {
  open: boolean
  audioOn: boolean
  onClose: () => void
  onSetup?: () => void
}) {
  const { walkthrough } = useOnboardingWalkthrough(open)
  // The title card counts this account's real steps (beta accounts have one
  // more: the agreement), not a fixed number.
  const statusQuery = useOnboardingStatus(open)
  const onboardingData = statusQuery.data?.data
  const stageCount = useMemo(() => (onboardingData ? buildOnboardingStages(onboardingData).length : null), [onboardingData])
  const map = walkthrough.roadmap
  const clips = walkthrough.narration?.clips ?? {}
  const chapters = map?.chapters ?? []
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [titleCard, setTitleCard] = useState(true)
  const [progress, setProgress] = useState(0)
  const [zoomedOut, setZoomedOut] = useState(false)
  const [cam, setCam] = useState(FULL)
  const camRef = useRef(FULL)
  const anim = useRef(0)
  const run = useRef(0)
  const reduceMotion = useRef(typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false))
  const chapter = chapters[index]
  const nodeById = useMemo(() => new Map((map?.nodes ?? []).map((n) => [n.id, n])), [map])

  function moveCamera(target: { x: number; w: number }, ms = 1300) {
    cancelAnimationFrame(anim.current)
    const from = camRef.current
    const start = performance.now()
    const dur = reduceMotion.current ? 0 : ms
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const step = (now: number) => {
      const k = dur ? Math.min(1, (now - start) / dur) : 1
      const e = ease(k)
      const next = { x: from.x + (target.x - from.x) * e, w: from.w + (target.w - from.w) * e }
      camRef.current = next
      setCam(next)
      if (k < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }

  // Opening: the whole map behind a title card, then chapter one.
  useEffect(() => {
    if (!open) return
    setIndex(0); setPlaying(true); setTitleCard(true); setZoomedOut(false); setProgress(0)
    camRef.current = FULL; setCam(FULL)
    const timer = window.setTimeout(() => setTitleCard(false), reduceMotion.current ? 200 : 2200)
    return () => { window.clearTimeout(timer); cancelAnimationFrame(anim.current); run.current += 1; stopLine() }
  }, [open])

  // Camera follows the chapter.
  useEffect(() => {
    if (!open || titleCard || !chapter) return
    setZoomedOut(false)
    const [a, b] = chapter.range
    const w = Math.max(900, b - a + 80)
    moveCamera({ x: (a + b) / 2 - w / 2, w })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titleCard, index, chapter])

  // The last chapter pulls back to the whole map at "That's the road".
  useEffect(() => {
    if (!chapter?.zoomOutAt || zoomedOut) return
    const words = chapter.narration.split(/\s+/)
    const at = chapter.narration.slice(0, chapter.zoomOutAt).split(/\s+/).filter(Boolean).length / words.length
    if (progress >= at) { setZoomedOut(true); moveCamera(FULL, 2200) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, chapter, zoomedOut])

  // Speak the chapter; move on when the voice finishes.
  useEffect(() => {
    if (!open || titleCard || !playing || !chapter) return
    const token = ++run.current
    let timer = 0
    let tick = 0
    setProgress(0)
    const next = chapters[index + 1]
    if (next) prefetchClip(clips[next.id])
    const advance = () => {
      if (token !== run.current) return
      if (index < chapters.length - 1) setIndex((v) => v + 1)
      else setPlaying(false)
    }
    if (audioOn) {
      void speakLine({ text: chapter.narration, clipUrl: clips[chapter.id], onProgress: (f) => { if (token === run.current) setProgress(f) } })
        .then((result) => { if (result === 'ended' && token === run.current) timer = window.setTimeout(advance, 700) })
    } else {
      // Sound off: captions still move at reading pace, so the last chapter
      // still pulls back on "That's the road" instead of at the start.
      const ms = Math.max(3500, chapter.narration.length * 45)
      const started = performance.now()
      tick = window.setInterval(() => {
        if (token !== run.current) return
        const f = Math.min(1, (performance.now() - started) / ms)
        setProgress(f)
        if (f >= 1) { window.clearInterval(tick); timer = window.setTimeout(advance, 500) }
      }, 100)
    }
    return () => { window.clearTimeout(timer); window.clearInterval(tick); stopLine() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioOn, index, open, playing, titleCard, chapter])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !map || !chapters.length) return null

  function choose(next: number) {
    stopLine(); run.current += 1
    setTitleCard(false); setPlaying(true)
    setIndex(Math.max(0, Math.min(chapters.length - 1, next)))
  }

  const shown = new Set(titleCard ? [] : chapters.slice(0, index + 1).flatMap((c) => c.nodes))
  const doneNodes = new Set(chapters.slice(0, index + 1).filter((c) => c.done).flatMap((c) => c.nodes))
  const words = (chapter?.narration ?? '').split(/\s+/).filter(Boolean)
  const lit = audioOn ? Math.round(progress * words.length) : words.length
  const finished = !playing && index === chapters.length - 1
  const viewH = Math.max(H, (cam.w * H) / W)
  const focus = chapter && !titleCard && !zoomedOut ? chapter.range : null

  return (
    <div className="cbr-root fixed inset-0 z-[170] grid place-items-center bg-navy-950/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="crewbarn-roadmap-title">
      <style>{ROADMAP_CSS}</style>
      <div className="cbr-frame w-full max-w-[1100px] overflow-y-auto rounded-3xl bg-navy-950 p-4 text-white shadow-2xl sm:p-5">
        <header className="flex items-start justify-between gap-3 px-1 pb-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">The road ahead</div>
            <h2 id="crewbarn-roadmap-title" className="mt-1 text-2xl font-black">Here’s the road to going live</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close the roadmap" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-slate-300 hover:text-white">✕</button>
        </header>

        <div className="cbr-screen relative overflow-hidden rounded-2xl bg-slate-50">
          <svg viewBox={`${cam.x} ${(H - viewH) / 2} ${cam.w} ${viewH}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full" role="img" aria-label="CrewBarn onboarding roadmap">
            <defs>
              <marker id="cbr-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" /></marker>
              <filter id="cbr-glow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#f59e0b" floodOpacity="0.45" /></filter>
            </defs>
            <rect x={-400} y={-900} width={7400} height={2200} fill="#f8fafc" />
            {focus && (
              <rect x={focus[0] - 10} y={14} width={focus[1] - focus[0] + 20} height={392} rx={26} fillOpacity={0.55}
                fill={chapter?.done ? '#d1fae5' : '#fef3c7'} stroke={chapter?.done ? '#10b981' : '#f59e0b'} strokeWidth={5} filter="url(#cbr-glow)" className="cbr-focus" />
            )}
            {map.edges.map((edge, k) => {
              const f = nodeById.get(edge.from), t = nodeById.get(edge.to)
              if (!f || !t) return null
              const x1 = f.x + 160, y1 = f.y + 55, x2 = t.x, y2 = t.y + 55, mid = (x1 + x2) / 2
              const d = Math.abs(y2 - y1) < 8 ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
              const len = Math.hypot(x2 - x1, y2 - y1) * 1.25 + 40
              const on = shown.has(edge.to)
              return (
                <g key={k}>
                  <path d={d} fill="none" stroke="#94a3b8" strokeWidth={3} markerEnd="url(#cbr-arrow)" className="cbr-edge"
                    style={{ strokeDasharray: len, strokeDashoffset: on ? 0 : len, opacity: on ? 1 : 0 }} />
                  {edge.label && <text x={mid} y={(y1 + y2) / 2 - 10} textAnchor="middle" fontSize={15} fontWeight={700} fill="#64748b" className="cbr-edge" style={{ opacity: on ? 1 : 0 }}>{edge.label}</text>}
                </g>
              )
            })}
            {map.nodes.map((n) => {
              const cx = n.x + 80, cy = n.y + 55
              const lines = wrap(n.label, n.kind === 'decision' ? 13 : 17)
              const y0 = cy - ((lines.length - 1) * 18) / 2 + 5
              return (
                <g key={n.id} className="cbr-node" style={{ opacity: shown.has(n.id) ? 1 : 0 }}>
                  {n.kind === 'decision'
                    ? <polygon points={`${cx},${n.y - 8} ${n.x + 168},${cy} ${cx},${n.y + 118} ${n.x - 8},${cy}`} fill="#fff7ed" stroke="#f59e0b" strokeWidth={3} />
                    : <rect x={n.x} y={n.y} width={160} height={110} rx={n.kind === 'terminal' ? 55 : 14} fill={n.kind === 'terminal' ? '#ecfdf5' : '#ffffff'} stroke={n.kind === 'terminal' ? '#10b981' : '#cbd5e1'} strokeWidth={3} />}
                  {lines.map((line, k) => <text key={k} x={cx} y={y0 + k * 18} textAnchor="middle" fontSize={15} fontWeight={700} fill="#1e293b">{line}</text>)}
                  {doneNodes.has(n.id) && !n.kind && n.id !== 'manual' && (
                    <g><circle cx={n.x + 150} cy={n.y + 6} r={15} fill="#10b981" /><path d={`M ${n.x + 143} ${n.y + 6} l 5 5 l 9 -10`} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" /></g>
                  )}
                </g>
              )
            })}
          </svg>
          {chapter && !titleCard && (
            <span className="cbr-chip">{zoomedOut ? 'The whole road' : `${chapter.done ? '✓ ' : ''}${chapter.label}`}</span>
          )}
          <div className={`cbr-titlecard ${titleCard ? '' : 'gone'}`} aria-hidden={!titleCard}>
            <span>CrewBarn onboarding</span>
            <strong>From sign-up to your first live job</strong>
            <em>{stageCount ? `${stageCount} steps · ` : ''}about a minute to watch</em>
          </div>
        </div>

        <div className="mt-4 flex min-h-[72px] items-start gap-3">
          <span className={`cbr-avatar ${playing && audioOn && progress < 1 && !titleCard ? 'talk' : ''}`} aria-hidden="true">CB</span>
          <p className="m-0 min-h-14 min-w-0 text-[15px] leading-7 sm:text-base" aria-live="polite">
            {!titleCard && words.map((word, k) => <span key={k} className={k < lit ? 'text-white' : 'text-slate-500'}>{word} </span>)}
          </p>
        </div>

        <div className="mt-3 flex gap-1" aria-label={`Chapter ${index + 1} of ${chapters.length}`}>
          {chapters.map((c, k) => (
            <button key={c.id} type="button" title={c.label} aria-label={`Play ${c.label}`} onClick={() => choose(k)} className="relative h-6 flex-1">
              <span className="absolute inset-x-0 top-2.5 h-1 rounded-full bg-white/15" />
              <span className="absolute left-0 top-2.5 h-1 rounded-full bg-amber-400" style={{ width: k < index ? '100%' : k === index && !titleCard ? `${Math.round(progress * 100)}%` : '0%' }} />
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" disabled={index === 0} onClick={() => choose(index - 1)} className="rounded-xl border border-white/20 px-3.5 py-2 text-sm font-bold disabled:opacity-30">Back</button>
          <button type="button" onClick={() => { if (finished) { choose(0); return } if (playing) { stopLine(); run.current += 1 } setPlaying((v) => !v) }} className="rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-navy-950">{finished ? 'Watch again' : playing ? 'Pause' : 'Play'}</button>
          <button type="button" disabled={index === chapters.length - 1} onClick={() => choose(index + 1)} className="rounded-xl border border-white/20 px-3.5 py-2 text-sm font-bold disabled:opacity-30">Next</button>
          <select value={index} onChange={(event) => choose(Number(event.target.value))} aria-label="Jump to a chapter" className="min-w-0 max-w-[220px] rounded-xl border border-white/20 bg-navy-900 px-2.5 py-2 text-sm text-white">
            {chapters.map((c, k) => <option key={c.id} value={k}>{k + 1}. {c.label}</option>)}
          </select>
          {onSetup ? (
            <>
              <button type="button" onClick={onClose} className="ml-auto text-sm font-semibold text-slate-300 underline decoration-slate-500 underline-offset-4">Skip setup, I’ll do it on my own</button>
              <button type="button" onClick={onSetup} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-navy-950 hover:bg-amber-400">Start setup with the guide →</button>
            </>
          ) : (
            <button type="button" onClick={onClose} className="ml-auto rounded-xl border border-white/20 px-3.5 py-2 text-sm font-bold">Close</button>
          )}
        </div>
      </div>
    </div>
  )
}

function wrap(label: string, max: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const word of label.split(' ')) {
    if ((cur + ' ' + word).trim().length > max) { out.push(cur.trim()); cur = word } else cur += ' ' + word
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const ROADMAP_CSS = `
.cbr-frame { max-height: calc(100vh - 1.5rem); animation: cbr-pop .5s cubic-bezier(.2,.9,.3,1.2) both; }
.cbr-screen { aspect-ratio: 16 / 6.2; min-height: 220px; }
.cbr-edge { transition: stroke-dashoffset 1s ease-out, opacity .4s; }
.cbr-node { transition: opacity .5s; }
.cbr-focus { transition: x .9s cubic-bezier(.65,0,.35,1), width .9s cubic-bezier(.65,0,.35,1); }
.cbr-chip { position: absolute; left: 14px; top: 12px; background: #0b1324; color: #fde68a; font-size: 11.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; padding: 6px 10px; border-radius: 99px; }
.cbr-titlecard { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 6px; background: linear-gradient(160deg, #0b1324, #1a2742); color: #fff; transition: opacity .8s; }
.cbr-titlecard span { color: #fcd34d; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; font-size: 12px; }
.cbr-titlecard strong { font-size: clamp(22px, 3.4vw, 36px); line-height: 1.15; text-wrap: balance; padding: 0 16px; }
.cbr-titlecard em { font-style: normal; color: #94a3b8; font-size: 14px; }
.cbr-titlecard.gone { opacity: 0; pointer-events: none; }
.cbr-avatar { width: 32px; height: 32px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); position: relative; }
.cbr-avatar.talk::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(251,191,36,.6); animation: cbr-ring 1.2s ease-out infinite; }
@keyframes cbr-pop { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes cbr-ring { from { transform: scale(.9); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }
@media (max-width: 640px) { .cbr-screen { aspect-ratio: 4 / 3; } }
@media (prefers-reduced-motion: reduce) { .cbr-root *, .cbr-root *::after { animation: none !important; transition: none !important; } }
`
