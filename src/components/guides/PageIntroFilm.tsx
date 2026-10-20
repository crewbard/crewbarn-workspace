import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { prefetchClip, prefetchSpeech, speakLine, stopLine } from '@/lib/tourVoice'
import { tourClipFor } from '@/lib/tourClips'
import { useWakeLock } from '@/lib/wakeLock'
import type { FilmScene } from '@/lib/pageTours/film'
import { FILM_VISUAL_CSS, FilmVisualView } from './filmVisuals'

/**
 * A page tour's intro film: a short animated film, one spoken line per
 * scene (the tour voice, a recorded clip when there is one), captions
 * always on. It plays before the walk-through; at the end "Walk me through
 * it" carries on into the page's steps.
 *
 * Controls: play / pause, sound on / off, skip the intro, replay, and the
 * scene markers. The screen stays on while it plays. With reduced motion
 * the drawings are still frames, and the lines are still read.
 */

function prefersReducedMotion(): boolean {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false } catch { return false }
}
/** How long a scene stays up when it isn't read aloud. */
const readingTime = (text: string) => Math.max(4200, text.length * 60)

export default function PageIntroFilm({
  scenes,
  page,
  kicker,
  hasWalk,
  muted,
  onToggleMute,
  onWalk,
  onNotNow,
  onClose,
  firstStepLine,
}: {
  scenes: FilmScene[]
  page: string
  kicker: string
  /** The page has steps to walk after the film. */
  hasWalk: boolean
  muted: boolean
  onToggleMute: () => void
  /** "Walk me through it" (or "Got it" with nothing to walk). */
  onWalk: () => void
  onNotNow: () => void
  onClose: () => void
  /** The walk-through's first line, fetched ahead while the film ends. */
  firstStepLine?: string
}) {
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [ended, setEnded] = useState(false)
  const [progress, setProgress] = useState(0)
  // Bumped to start the current scene over (replay, picking a scene).
  const [take, setTake] = useState(0)
  const run = useRef(0)
  const still = useRef(prefersReducedMotion()).current
  const walkButton = useRef<HTMLButtonElement | null>(null)
  const current = scenes[Math.min(scene, scenes.length - 1)]

  // Keep the phone's screen on while the film plays.
  useWakeLock(playing && !ended)

  useEffect(() => () => { run.current += 1; stopLine() }, [])

  // Read the scene, then move on when the line ends (or after a reading
  // pause with the sound off).
  useEffect(() => {
    if (!playing || ended || !current) return
    const token = ++run.current
    let timer = 0
    const advance = () => {
      if (token !== run.current) return
      if (scene < scenes.length - 1) setScene((value) => value + 1)
      else setEnded(true)
    }
    const byTimer = (spent = 0) => { setProgress(1); timer = window.setTimeout(advance, Math.max(600, readingTime(current.say) - spent)) }
    const next = scenes[scene + 1]?.say ?? firstStepLine
    if (next) void tourClipFor(next).then((url) => (url ? prefetchClip(url) : prefetchSpeech(next)))
    if (muted) byTimer()
    else {
      setProgress(0)
      const began = Date.now()
      void tourClipFor(current.say).then((clipUrl) => {
        if (token !== run.current) return
        return speakLine({ text: current.say, clipUrl, onProgress: (f) => { if (token === run.current) setProgress(f) } }).then((result) => {
          if (token !== run.current) return
          // A line nobody could read aloud "ends" at once: keep the
          // caption up long enough to read.
          if (result === 'ended' && Date.now() - began > 600) timer = window.setTimeout(advance, 700)
          else byTimer(Date.now() - began)
        })
      })
    }
    return () => { window.clearTimeout(timer); stopLine() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, playing, muted, take, ended])

  useEffect(() => { if (ended) walkButton.current?.focus() }, [ended])

  function goTo(index: number) {
    if (index < 0) return
    if (index >= scenes.length) { stopLine(); run.current += 1; setEnded(true); return }
    stopLine()
    run.current += 1
    setEnded(false)
    setScene(index)
    setPlaying(true)
    setTake((value) => value + 1)
  }

  function togglePlay() {
    if (ended) { goTo(0); return }
    if (playing) { stopLine(); run.current += 1 }
    setPlaying((value) => !value)
  }

  function leave(then: () => void) {
    run.current += 1
    stopLine()
    then()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); leave(onClose) }
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(scene + 1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(scene - 1) }
  }

  if (!current) return null
  const words = current.say.split(/\s+/).filter(Boolean)
  const lit = muted || ended || !playing ? words.length : Math.round(progress * words.length)
  const talking = playing && !ended && !muted && progress > 0 && progress < 1
  const done = (k: number) => (ended || k < scene ? 1 : k === scene ? progress : 0)

  return (
    <div className="cbpf-root fixed inset-0 z-[190] grid place-items-center bg-[rgba(7,12,26,.72)] p-2 backdrop-blur-[3px] sm:p-4">
      <style>{FILM_VISUAL_CSS}{FILM_CSS}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${page}: intro film`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        ref={(node) => { if (node && document.activeElement === document.body) node.focus() }}
        className="cbpf-frame w-full max-w-[760px] overflow-y-auto rounded-3xl bg-navy-950 p-3 text-white shadow-2xl outline-none sm:p-4"
      >
        <header className="flex items-center gap-2 px-1 pb-2.5">
          <span className={`cbpf-avatar ${talking ? 'talk' : ''}`} aria-hidden="true">CB</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">{kicker}</div>
            <h2 className="truncate text-lg font-black leading-tight">{page}</h2>
          </div>
          <button type="button" onClick={onToggleMute} aria-pressed={!muted} className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">{muted ? 'Sound off' : 'Sound on'}</button>
          <button type="button" onClick={() => leave(onClose)} aria-label="Close the tour" className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-slate-300 hover:text-white">✕</button>
        </header>

        <div className="cbpf-screen relative overflow-hidden rounded-2xl">
          <div key={`${current.id}-${scene}-${take}`} className={`cbpf cbpf-scene flex h-full flex-col px-3 py-3 sm:px-5 sm:py-4 ${still ? 'still' : ''} ${!playing && !ended ? 'paused' : ''}`}>
            {current.title && <div className="cbpf-scene-title truncate text-center text-xs font-black uppercase tracking-[0.16em] text-slate-500">{current.title}</div>}
            <div className="flex min-h-0 flex-1 items-center justify-center"><FilmVisualView visual={current.visual} still={still} /></div>
          </div>
          {ended && (
            <div className="cbpf-end absolute inset-0 grid place-items-center bg-navy-950/85 p-4 text-center">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{hasWalk ? 'Ready?' : 'That’s the quick look'}</div>
                <div className="mt-1 text-2xl font-black">{page}</div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button ref={walkButton} type="button" onClick={() => leave(onWalk)} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-navy-950 hover:bg-amber-300">{hasWalk ? 'Walk me through it' : 'Got it'}</button>
                  <button type="button" onClick={() => goTo(0)} className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-bold">Watch again</button>
                  {hasWalk && <button type="button" onClick={() => leave(onNotNow)} className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-bold">Not now</button>}
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 min-h-[3.25rem] px-1 text-[15px] leading-6 sm:text-base" aria-live="polite">
          {words.map((word, k) => <span key={k} className={k < lit ? 'text-white' : 'text-slate-500'}>{word} </span>)}
        </p>

        <div className="mt-2 flex gap-1" role="group" aria-label={`Scene ${scene + 1} of ${scenes.length}`}>
          {scenes.map((item, k) => (
            <button key={item.id} type="button" aria-label={`Play scene ${k + 1}`} aria-current={k === scene && !ended ? 'step' : undefined} onClick={() => goTo(k)} className="relative h-6 flex-1">
              <span className="absolute inset-x-0 top-2.5 h-1 rounded-full bg-white/15" />
              <span className="absolute left-0 top-2.5 h-1 rounded-full bg-amber-400" style={{ width: `${Math.round(done(k) * 100)}%` }} />
            </button>
          ))}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={togglePlay} className="rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-navy-950">{ended ? 'Replay' : playing ? 'Pause' : 'Play'}</button>
          {!ended && <button type="button" onClick={() => goTo(0)} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold">Replay</button>}
          <button type="button" onClick={() => leave(onWalk)} className="ml-auto rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-navy-950 hover:bg-amber-300">
            {ended ? (hasWalk ? 'Walk me through it' : 'Got it') : hasWalk ? 'Skip intro →' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  )
}

const FILM_CSS = `
.cbpf-frame { max-height: calc(100svh - 1rem); animation: cbpf-frame-in .45s cubic-bezier(.2,.9,.3,1.2) both; }
.cbpf-screen { background: radial-gradient(120% 120% at 0% 0%, #fff7e6 0%, #f8fafc 55%); height: clamp(280px, 46vh, 350px); }
.cbpf-scene { animation: cbpf-scene-in .4s ease both; }
.cbpf-end { animation: cbpf-scene-in .35s ease both; }
.cbpf-avatar { width: 30px; height: 30px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); position: relative; }
.cbpf-avatar.talk::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(251,191,36,.6); animation: cbpf-ring 1.2s ease-out infinite; }
@keyframes cbpf-frame-in { from { opacity: 0; transform: translateY(12px) scale(.97); } }
@keyframes cbpf-scene-in { from { opacity: 0; } }
@keyframes cbpf-ring { from { transform: scale(.9); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }
@media (max-width: 640px) { .cbpf-screen { height: clamp(280px, 50svh, 340px); } }
@media (prefers-reduced-motion: reduce) { .cbpf-root *, .cbpf-root *::after { animation: none !important; transition: none !important; } }
`
