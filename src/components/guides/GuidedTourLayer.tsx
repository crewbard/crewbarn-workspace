import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { guidedTourForPath, GUIDED_TOURS, playedSteps, START_GUIDED_TOUR_EVENT, type GuidedTour, type GuidedTourRequest } from '@/lib/guidedTours'
import { prefetchClip, prefetchSpeech, speakLine, stopLine } from '@/lib/tourVoice'
import { tourClipFor, warmTourClips } from '@/lib/tourClips'
import { isAlreadyOn } from './tutorialScript'
import {
  START_ACTIVE_TUTORIAL_EVENT,
  readTutorialProgress,
  type ActiveTutorialId,
  type ActiveTutorialRequest,
  type PageTourRun,
} from '@/lib/activeTutorial'

// The tutorial player loads only when a tutorial starts.
const ActiveTutorial = lazy(() => import('./ActiveTutorial'))

type Mode = 'overlay' | 'panel'
const MODE_KEY = 'crewbarn:guide-mode'

/** First element matching the selector that is actually on screen (has a box).
 *  Hidden copies (desktop-only menus on a phone, the other layout's brand
 *  link) are skipped so the tour never highlights something invisible. */
function findVisible(selector: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(selector)
  for (const el of Array.from(all)) {
    const box = el.getBoundingClientRect()
    if (box.width > 0 && box.height > 0) return el
  }
  return null
}

function readMode(): Mode {
  try { return localStorage.getItem(MODE_KEY) === 'panel' ? 'panel' : 'overlay' } catch { return 'overlay' }
}

/** Page tours, plus the active tutorials, in every layout. */
export function GuidedTourLayer() {
  return (
    <>
      <PageTourLayer />
      <ActiveTutorialHost />
    </>
  )
}

type TutorialRun = { id: ActiveTutorialId; skipFilm: boolean; startStep?: number; chapter?: string; run?: PageTourRun; nonce: number }

function ActiveTutorialHost() {
  // A tutorial in progress carries on after a reload or a layout change.
  const [run, setRun] = useState<TutorialRun | null>(() => {
    const saved = readTutorialProgress()
    return saved ? { id: saved.id, skipFilm: true, startStep: saved.step, run: saved.run, nonce: 0 } : null
  })

  useEffect(() => {
    const open = (event: Event) => {
      const request = (event as CustomEvent<ActiveTutorialRequest>).detail
      if (!request?.id) return
      stopLine()
      setRun({ id: request.id, skipFilm: !!request.skipFilm || !!request.chapter, chapter: request.chapter, run: request.run, nonce: Date.now() })
    }
    window.addEventListener(START_ACTIVE_TUTORIAL_EVENT, open)
    return () => window.removeEventListener(START_ACTIVE_TUTORIAL_EVENT, open)
  }, [])

  if (!run) return null
  return (
    <Suspense fallback={null}>
      <ActiveTutorial key={run.nonce} id={run.id} skipFilm={run.skipFilm} startStep={run.startStep} chapter={run.chapter} run={run.run} onClose={() => setRun(null)} />
    </Suspense>
  )
}

function PageTourLayer() {
  const location = useLocation()
  const navigate = useNavigate()
  const [tour, setTour] = useState<GuidedTour | null>(null)
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<Mode>(readMode)
  const [muted, setMuted] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [roadmapOpen, setRoadmapOpen] = useState(false)
  const targetRef = useRef<HTMLElement | null>(null)
  // Side panel mode docks the card to the edge away from the highlighted part.
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right')

  useEffect(() => {
    const open = (event: Event) => {
      const request = (event as CustomEvent<GuidedTourRequest>).detail ?? {}
      const found = request.id ? GUIDED_TOURS.find((item) => item.id === request.id) ?? guidedTourForPath(window.location.pathname, window.location.search, window.location.hash) : guidedTourForPath(window.location.pathname, window.location.search, window.location.hash)
      if (!found) return
      // "Where you use this" plays as the last step.
      const next: GuidedTour = { ...found, steps: playedSteps(found) }
      warmTourClips()
      // Start the first line's audio now; the roadmap or first highlight comes after.
      void tourClipFor(next.steps[0]?.say ?? '').then((url) => (url ? prefetchClip(url) : prefetchSpeech(next.steps[0]?.say ?? '')))
      setTour(next); setIndex(0); setMinimized(false); setRoadmapOpen(!!request.roadmap)
    }
    window.addEventListener(START_GUIDED_TOUR_EVENT, open)
    return () => window.removeEventListener(START_GUIDED_TOUR_EVENT, open)
  }, [])

  useEffect(() => {
    setTour(null); stopLine()
  }, [location.pathname])

  const step = tour?.steps[index]

  useEffect(() => {
    const old = targetRef.current
    if (old) {
      old.style.removeProperty('position'); old.style.removeProperty('z-index'); old.style.removeProperty('outline'); old.style.removeProperty('outline-offset'); old.style.removeProperty('box-shadow'); old.style.removeProperty('border-radius')
      targetRef.current = null
    }
    if (!tour || !step || roadmapOpen || minimized) return
    let cancelled = false
    const highlight = (target: HTMLElement | null) => {
      // A step with nothing on the page to point at is just the card.
      if (target) {
        targetRef.current = target
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        const rect = target.getBoundingClientRect()
        setDockSide(rect.left + rect.width / 2 > window.innerWidth / 2 ? 'left' : 'right')
        target.style.position = 'relative'; target.style.zIndex = '151'; target.style.outline = '3px solid #fbbf24'; target.style.outlineOffset = '5px'; target.style.borderRadius = '14px'
        if (mode === 'overlay') target.style.boxShadow = '0 0 0 9999px rgba(7,12,26,.62)'
      }
      if (!muted) {
        void tourClipFor(step.say).then((clipUrl) => {
          if (!cancelled) void speakLine({ text: step.say, clipUrl })
        })
        // Get the next two lines ready while this one plays, so Next starts talking at once.
        for (const upcoming of tour.steps.slice(index + 1, index + 3)) {
          void tourClipFor(upcoming.say).then((url) => (url ? prefetchClip(url) : prefetchSpeech(upcoming.say)))
        }
      }
    }
    const run = async () => {
      // A step can open a tab first (step.click), so parts that only exist
      // inside that tab can be shown. Steps whose target isn't on screen are skipped.
      for (let i = index; i < tour.steps.length; i += 1) {
        const s = tour.steps[i]
        if (s.click) {
          const opener = findVisible(s.click)
          if (opener && !isAlreadyOn(opener)) {
            opener.click()
            await new Promise((resolve) => window.setTimeout(resolve, 450))
            if (cancelled) return
          }
        }
        if (!s.selector) {
          if (i !== index) { setIndex(i); return }
          highlight(null)
          return
        }
        const target = findVisible(s.selector)
        if (target) {
          if (i !== index) { setIndex(i); return }
          highlight(target)
          return
        }
      }
      // Nothing left to show (for example, an empty or view-only page).
      // Do not leave the card describing a target that was never found.
      if (!cancelled) {
        stopLine()
        setTour(null)
        setIndex(0)
        setRoadmapOpen(false)
      }
    }
    void run()
    return () => { cancelled = true; stopLine() }
  }, [tour, step, index, mode, muted, roadmapOpen, minimized])

  function rememberMode(next: Mode) {
    setMode(next)
    try { localStorage.setItem(MODE_KEY, next) } catch { /* ignore */ }
  }
  function close() {
    stopLine(); setTour(null); setRoadmapOpen(false)
  }
  function advance() {
    if (!tour) return
    if (index >= tour.steps.length - 1) close()
    else setIndex((value) => value + 1)
  }

  if (!tour) return null

  if (minimized) return (
    <button type="button" onClick={() => setMinimized(false)} className="fixed bottom-4 right-4 z-[170] rounded-full bg-navy-950 px-4 py-3 text-sm font-bold text-white shadow-2xl">Guide · Step {index + 1} of {tour.steps.length}</button>
  )

  if (!step) return null

  return (
    <>
      {roadmapOpen && <div className="fixed inset-0 z-[165] grid place-items-center bg-navy-950/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-5xl rounded-3xl bg-navy-950 p-5 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.16em] text-amber-300">Page roadmap</div><h2 className="mt-1 text-2xl font-black">{tour.title}</h2><p className="mt-1 text-sm text-slate-300">{tour.description}</p></div><button type="button" onClick={() => setRoadmapOpen(false)} className="rounded-full bg-white/10 px-3 py-2" aria-label="Close roadmap">×</button></div>
          <div className="mt-6 overflow-x-auto pb-3"><div className="flex min-w-max items-stretch gap-3">{tour.roadmap.map((item, i) => <div key={item.title} className="flex items-center gap-3"><button type="button" onClick={() => { setIndex(Math.min(item.step ?? Math.floor((i * tour.steps.length) / tour.roadmap.length), tour.steps.length - 1)); setRoadmapOpen(false) }} className="w-52 rounded-2xl border border-white/15 bg-white p-4 text-left text-navy-950 shadow-lg"><span className="grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-xs font-black">{i + 1}</span><strong className="mt-3 block">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-600">{item.detail}</span></button>{i < tour.roadmap.length - 1 && <span className="text-2xl text-amber-300">→</span>}</div>)}</div></div>
          <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => setRoadmapOpen(false)} className="rounded-xl bg-amber-400 px-4 py-2 font-black text-navy-950">Start the page guide →</button><button type="button" onClick={() => close()} className="rounded-xl border border-white/20 px-4 py-2 font-bold">I’ll do it on my own</button></div>
        </div>
      </div>}
      {!roadmapOpen && <aside className={`fixed z-[170] w-[min(390px,calc(100vw-2rem))] overflow-y-auto bg-navy-950 p-5 text-white shadow-2xl ${mode === 'panel' ? `inset-y-0 ${dockSide === 'left' ? 'left-0' : 'right-0'} max-h-screen` : 'bottom-4 right-4 max-h-[calc(100vh-2rem)] rounded-[20px]'}`} role="dialog" aria-label="Guided page tour">
        <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-xs font-black text-navy-950">CB</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{tour.title}</div><div className="text-xs text-slate-400">Step {index + 1} of {tour.steps.length}</div></div><button type="button" onClick={() => setMuted((v) => !v)} className="rounded-full px-2 py-1 text-xs text-slate-300">{muted ? 'Unmute' : 'Mute'}</button><button type="button" onClick={() => setMinimized(true)} className="rounded-full px-2 py-1 text-slate-300" aria-label="Minimize">—</button><button type="button" onClick={() => close()} className="rounded-full px-2 py-1 text-slate-300" aria-label="Close">×</button></div>
        <div className="mt-3 inline-flex rounded-full bg-white/10 p-1 text-xs font-bold"><button type="button" aria-pressed={mode === 'overlay'} onClick={() => rememberMode('overlay')} className={`rounded-full px-3 py-1 ${mode === 'overlay' ? 'bg-white text-navy-950' : 'text-slate-300'}`}>Overlay</button><button type="button" aria-pressed={mode === 'panel'} onClick={() => rememberMode('panel')} className={`rounded-full px-3 py-1 ${mode === 'panel' ? 'bg-white text-navy-950' : 'text-slate-300'}`}>Side panel</button></div>
        <h3 className="mt-5 text-xl font-black">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-200">{step.say}</p>
        {step.go?.length ? <div className="mt-3 flex flex-wrap gap-2">{step.go.map((page) => <button key={page.to} type="button" onClick={() => { close(); navigate(page.to) }} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-navy-950">{page.label} →</button>)}</div> : null}
        {step.links?.length ? <div className="mt-3 flex flex-wrap gap-2">{step.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-3 py-2 text-xs font-black text-navy-950">{link.label} ↗</a>)}</div> : null}
        <div className="mt-5 flex items-center gap-2"><button type="button" disabled={index === 0} onClick={() => setIndex((v) => Math.max(0, v - 1))} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold disabled:opacity-30">Back</button><button type="button" onClick={() => setRoadmapOpen(true)} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold">Roadmap</button><button type="button" onClick={advance} className="ml-auto rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-navy-950">{index === tour.steps.length - 1 ? 'Finish' : 'Next'}</button></div>
        <button type="button" onClick={advance} className="mt-3 text-xs font-bold text-slate-400 underline underline-offset-4">{step.optional ?? 'Skip this step'}</button>
        <div className="mt-4 flex gap-1">{tour.steps.map((_, i) => <span key={i} className={`h-1 flex-1 rounded ${i < index ? 'bg-emerald-400' : i === index ? 'bg-amber-400' : 'bg-white/15'}`} />)}</div>
      </aside>}
    </>
  )
}
