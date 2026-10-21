import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { prefetchClip, prefetchSpeech, speakLine, stopLine } from '@/lib/tourVoice'
import { tourClipFor, warmTourClips } from '@/lib/tourClips'
import {
  readFullTourResume,
  startFullTour,
  writeFullTourResume,
  writeTutorialProgress,
  type ActiveTutorialId,
  type PageTourRun,
} from '@/lib/activeTutorial'
import { usePermissions } from '@/hooks/usePermissions'
import { findVisible, isAlreadyOn, resolveStep, stepWillPlay, tourContext, type ResolvedStep } from './tutorialScript'
import { TUTORIAL_SCRIPTS } from './tutorials'
import { buildRunScript } from './pageTourRun'
import PageIntroFilm from './PageIntroFilm'

/**
 * The "active" tutorial player.
 *
 * Part one is a short film: drawn scenes, a narrator, and captions that light
 * up word by word. When it ends, the film shrinks into the corner and fades
 * into the background, and the narrator stays there as a small card while the
 * tutorial walks the real page. Each step lights up the part it talks about.
 * Steps that ask the person to do something wait until they do it, and "Do
 * it for me" does it for them. Steps whose part isn't on screen (no access,
 * nothing to show) are skipped.
 *
 * Practice copies keep the walk-through from changing anything: the editor
 * steps open a practice template that is never saved unless the person
 * presses Create template themselves.
 *
 * The same player plays page tours and the full tour (`run`): one chapter
 * per page. A page tour opens with the page's intro film (PageIntroFilm,
 * written for the page or made from its intro); the full tour opens each
 * page with a quick intro card instead. Steps follow what
 * is on screen (`when`, `variants`), and the step count only counts the
 * steps that will play.
 */

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

const MUTE_KEY = 'crewbarn_active_tutorial_muted'
function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}
function writeMuted(muted: boolean) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* private mode */ }
}
function prefersReducedMotion(): boolean {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false } catch { return false }
}
/** How long a line stays up when it isn't read aloud. */
const readingTime = (text: string) => Math.max(4200, text.length * 55)

type Phase = 'film' | 'handoff' | 'live' | 'done'
type Corner = 'br' | 'bl' | 'tr' | 'tl'

export default function ActiveTutorial({
  id,
  skipFilm = false,
  startStep,
  chapter: startChapter,
  run,
  onClose,
}: {
  id: ActiveTutorialId
  skipFilm?: boolean
  startStep?: number
  /** Start the live part at this chapter. */
  chapter?: string
  /** A page tour or the full tour, rather than an area tutorial. */
  run?: PageTourRun
  onClose: () => void
}) {
  const { has } = usePermissions()
  // Built once: the steps must not shift under a tour that is playing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(() => (run ? buildRunScript(run, has) : null), [])
  const script = built?.script ?? TUTORIAL_SCRIPTS[id] ?? TUTORIAL_SCRIPTS.templates
  const data = script.data
  const pageMode = !!built
  const fullMode = !!built?.full
  const navigate = useNavigate()
  const location = useLocation()
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname

  const [phase, setPhase] = useState<Phase>(skipFilm || startStep != null || !data.film.length ? 'live' : 'film')
  const [muted, setMuted] = useState(readMuted)
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const [progress, setProgress] = useState(0)
  const reduceMotion = useRef(prefersReducedMotion())

  // ---------- film ----------
  const [scene, setScene] = useState(0)
  const [filmPlaying, setFilmPlaying] = useState(true)
  const [shown, setShown] = useState(0)
  const [filmTake, setFilmTake] = useState(0)
  const filmRun = useRef(0)

  // ---------- live ----------
  const steps = data.steps
  const [stepIndex, setStepIndex] = useState(() => {
    const fromChapter = startChapter ? steps.findIndex((s) => s.chapter === startChapter) : -1
    return Math.min(Math.max(fromChapter >= 0 ? fromChapter : startStep ?? 0, 0), steps.length - 1)
  })
  const stepRef = useRef(stepIndex)
  stepRef.current = stepIndex
  const [take, setTake] = useState(0)
  const [auto, setAuto] = useState(true)
  const autoRef = useRef(auto)
  autoRef.current = auto
  const [minimized, setMinimized] = useState(false)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [stepState, setStepState] = useState<'finding' | 'showing' | 'done'>('finding')
  // What the card shows: the last step that was found, so the card doesn't
  // flash the titles of parts it is skipping past.
  const [shownIndex, setShownIndex] = useState(stepIndex)
  const [chaptersOpen, setChaptersOpen] = useState(false)
  // What the shown step says and lights up on this page (its variant).
  const [resolved, setResolved] = useState<(ResolvedStep & { index: number }) | null>(null)
  // "Step 3 of 12": only the steps that played or will play.
  const [count, setCount] = useState<{ n: number; total: number } | null>(null)
  const playedRef = useRef(new Set<number>())
  const dirRef = useRef<1 | -1>(1)
  const skipStreak = useRef(0)
  const liveRun = useRef(0)

  useEffect(() => {
    warmTourClips()
    return () => { filmRun.current += 1; liveRun.current += 1; stopLine() }
  }, [])

  /** Does a step's `open` / `doIt`. False when there was nothing on screen to click. */
  function runAction(action: string): boolean {
    if (action.startsWith('goto:')) { navigate(action.slice(5)); return true }
    if (action.startsWith('click:') || action.startsWith('first:')) {
      const el = findVisible(action.slice(6))
      el?.click()
      return !!el
    }
    script.actions?.[action]?.(navigate)
    return true
  }

  function close() {
    filmRun.current += 1
    liveRun.current += 1
    stopLine()
    writeTutorialProgress(null)
    onClose()
  }

  // ---------- film: build each scene up piece by piece ----------
  const filmScene = data.film[scene] ?? NO_SCENE
  useEffect(() => {
    if (phase !== 'film') return
    const pieces = script.reveal[filmScene.id] ?? 1
    if (reduceMotion.current) { setShown(pieces); return }
    setShown(0)
    const timers = Array.from({ length: pieces }, (_, k) => window.setTimeout(() => setShown(k + 1), 350 + k * 1150))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, filmScene.id, filmTake])

  // ---------- film: read the scene and move on when the line ends ----------
  useEffect(() => {
    if (phase !== 'film' || !filmPlaying) return
    const token = ++filmRun.current
    let timer = 0
    const advance = () => {
      if (token !== filmRun.current) return
      if (scene < data.film.length - 1) setScene((value) => value + 1)
      else handOff()
    }
    const byTimer = () => { setProgress(1); timer = window.setTimeout(advance, readingTime(filmScene.narration)) }
    const next = data.film[scene + 1]
    if (next) void tourClipFor(next.narration).then((url) => (url ? prefetchClip(url) : prefetchSpeech(next.narration)))
    else { const first = steps[stepRef.current]; if (first) void tourClipFor(first.say).then((url) => (url ? prefetchClip(url) : prefetchSpeech(first.say))) }
    if (muted) byTimer()
    else {
      setProgress(0)
      void tourClipFor(filmScene.narration).then((clipUrl) => {
        if (token !== filmRun.current) return
        return speakLine({ text: filmScene.narration, clipUrl, onProgress: (f) => { if (token === filmRun.current) setProgress(f) } })
          .then((result) => {
            if (token !== filmRun.current) return
            if (result === 'ended') timer = window.setTimeout(advance, 800)
            else byTimer()
          })
      })
    }
    return () => { window.clearTimeout(timer); stopLine() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, scene, filmPlaying, muted, filmTake])

  function chooseScene(next: number) {
    if (next < 0) return
    if (next >= data.film.length) { handOff(); return }
    stopLine()
    filmRun.current += 1
    setScene(next)
    setFilmPlaying(true)
    setFilmTake((value) => value + 1)
  }

  /** The film shrinks into the corner and the page comes back. */
  function handOff() {
    filmRun.current += 1
    stopLine()
    setPhase('handoff')
    window.setTimeout(() => setPhase('live'), reduceMotion.current ? 0 : 950)
  }

  function replayFilm() {
    liveRun.current += 1
    stopLine()
    setTarget(null)
    setScene(0)
    setFilmPlaying(true)
    setFilmTake((value) => value + 1)
    setPhase('film')
  }

  // ---------- live: find the step's part, light it up, read it, wait ----------
  useEffect(() => {
    if (phase !== 'live') return
    const step = steps[stepIndex]
    if (!step) return
    writeTutorialProgress({ id, step: stepIndex, run })
    if (fullMode && step.intro) {
      writeFullTourResume({ chapter: step.chapter, label: data.chapters.find((c) => c.key === step.chapter)?.label ?? step.title, at: Date.now() })
    }
    const token = ++liveRun.current
    const alive = () => token === liveRun.current
    const cleanups: Array<() => void> = []
    const later = (fn: () => void, ms: number) => { const timer = window.setTimeout(() => { if (alive()) fn() }, ms); cleanups.push(() => window.clearTimeout(timer)) }
    setTarget(null)
    setStepState('finding')
    setProgress(0)
    setChaptersOpen(false)

    // A page tour opens with its intro film, which plays itself, voice and
    // all (PageIntroFilm). The full tour keeps the quick intro card.
    if (step.intro && !fullMode && step.intro.film?.length) {
      setShownIndex(stepIndex)
      setResolved(null)
      setCount(null)
      setStepState('showing')
      return
    }

    const onRoute = () => !step.route || new RegExp(step.route).test(pathRef.current)
    // A step's `click`: one tab or opener, or several pressed in order (a
    // tab, then a panel inside it that Focus keeps folded). Each is pressed
    // once it's on screen, unless it's already on.
    const handled = new Set<string>()
    let handledOn = ''
    const press = async () => {
      if (!step.click) return
      if (handledOn !== pathRef.current) { handled.clear(); handledOn = pathRef.current }
      for (const selector of ([] as string[]).concat(step.click)) {
        if (handled.has(selector)) continue
        const opener = findVisible(selector)
        if (!opener) continue
        handled.add(selector)
        if (isAlreadyOn(opener)) continue
        opener.click()
        await sleep(400)
        if (!alive()) return
      }
    }
    type Found = { el: HTMLElement | 'none'; said: ResolvedStep }
    const smart = !!step.when || !!step.variants?.length
    const look = async (ms: number): Promise<Found | null> => {
      const started = Date.now()
      const end = started + ms
      while (alive() && Date.now() < end) {
        if (onRoute()) {
          await press()
          if (!alive()) return null
          // What the step says and points at, for what is on screen now.
          const said = resolveStep(step, tourContext())
          if (said) {
            if (!said.selector) return { el: 'none', said }
            const found = findVisible(said.selector)
            if (found) return { el: found, said }
          } else if (smart && Date.now() - started > 300) {
            // The page says this step isn't for it: move on without waiting.
            return null
          }
        }
        await sleep(150)
      }
      return null
    }

    const speak = (text: string, onEnd: () => void) => {
      const byTimer = () => { setProgress(1); later(onEnd, readingTime(text)) }
      if (mutedRef.current) { byTimer(); return }
      void tourClipFor(text).then((clipUrl) => {
        if (!alive()) return
        return speakLine({ text, clipUrl, onProgress: (f) => { if (alive()) setProgress(f) } }).then((result) => {
          if (!alive()) return
          if (result === 'ended') onEnd()
          else byTimer()
        })
      })
    }

    const complete = () => {
      if (!alive()) return
      cleanups.splice(0).forEach((fn) => fn())
      stopLine()
      setStepState('done')
      later(() => move(1), 650)
    }

    void (async () => {
      // Skipping through parts that aren't here goes quickly, and quicker
      // still going back. A step for another page is passed over at once
      // while skipping, unless it knows how to get there.
      const skipping = skipStreak.current > 0
      const backing = dirRef.current === -1
      // A step can wait a little for its part (lazy sections), never more
      // than 1.5 seconds. Page tours look for a second by default.
      const patient = step.waitMs != null ? Math.min(Math.max(step.waitMs, 0), 1500) : pageMode ? 1000 : 1800
      const quick = skipping && step.waitMs == null
      let found: Found | null = null
      if (step.intro && step.open) {
        // The full tour opens each page itself (a section of the same page
        // too), before its intro.
        runAction(step.open)
        found = await look(6000)
      } else {
        if (!(skipping && !step.open && !onRoute())) {
          found = await look(step.open ? 700 : quick ? (backing ? 150 : 400) : backing ? 700 : patient)
        }
        // Nothing to click (an opener only one look has, like Focus's
        // folded panels): wait the usual while, not the long one.
        if (!found && step.open && alive()) {
          const opened = runAction(step.open)
          found = await look(opened ? 6000 : patient)
        }
      }
      if (!alive()) return
      if (!found) { skipStreak.current += 1; skip(); return }
      skipStreak.current = 0
      const el = found.el === 'none' ? null : found.el
      el?.scrollIntoView({ behavior: reduceMotion.current ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })
      setTarget(el)
      setShownIndex(stepIndex)
      setResolved({ ...found.said, index: stepIndex })
      playedRef.current.add(stepIndex)
      setCount(countFor(stepIndex))
      setStepState('showing')

      // Get the next lines ready while this one plays.
      for (const upcoming of steps.slice(stepIndex + 1, stepIndex + 3)) {
        if (!upcoming.say.trim()) continue
        void tourClipFor(upcoming.say).then((url) => (url ? prefetchClip(url) : prefetchSpeech(upcoming.say)))
      }

      speak(found.said.say, () => {
        if (!step.wait && !step.hold && autoRef.current) later(() => move(1), 1100)
      })

      const wait = step.wait
      if (wait) {
        const met = () =>
          (wait.appear && findVisible(wait.appear)) ||
          (wait.gone && !findVisible(wait.gone)) ||
          (wait.route && new RegExp(wait.route).test(pathRef.current))
        const poll = window.setInterval(() => { if (met()) complete() }, 200)
        cleanups.push(() => window.clearInterval(poll))
        if (wait.click && el) {
          const onClick = (event: MouseEvent) => { if (el.contains(event.target as Node)) later(complete, 150) }
          document.addEventListener('click', onClick, true)
          cleanups.push(() => document.removeEventListener('click', onClick, true))
        }
      }
    })()

    return () => {
      liveRun.current += 1
      cleanups.forEach((fn) => fn())
      stopLine()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex, take])

  /**
   * "Step n of total" for this step: the steps that played before it, and
   * the ones still to come that will play on this page. A page tour counts
   * its own page's steps; an area tutorial counts all of them.
   */
  function countFor(index: number): { n: number; total: number } | null {
    const step = steps[index]
    if (!step || step.intro) return null
    const inScope = (i: number) => !steps[i].intro && (!pageMode || steps[i].chapter === step.chapter)
    const page = tourContext()
    let before = 0
    let after = 0
    steps.forEach((s, i) => {
      if (!inScope(i)) return
      if (i < index && playedRef.current.has(i)) before += 1
      else if (i > index && stepWillPlay(s, page)) after += 1
    })
    return { n: before + 1, total: before + 1 + after }
  }

  function move(delta: 1 | -1) {
    dirRef.current = delta
    const next = stepRef.current + delta
    if (next >= steps.length) { finish(); return }
    if (next < 0) return
    setStepIndex(next)
  }

  /** The step's part isn't here: keep going the way the person was going. */
  function skip() {
    const i = stepRef.current
    if (dirRef.current === -1 && i > 0) { setStepIndex(i - 1); return }
    dirRef.current = 1
    if (i + 1 >= steps.length) finish()
    else setStepIndex(i + 1)
  }

  function finish() {
    liveRun.current += 1
    stopLine()
    setTarget(null)
    writeTutorialProgress(null)
    if (fullMode) writeFullTourResume(null)
    setPhase('done')
  }

  /** The intro's "Not now": a page tour closes; the full tour goes on to the next page. */
  function notNow() {
    if (!fullMode) { close(); return }
    const at = data.chapters.findIndex((c) => c.key === steps[stepRef.current]?.chapter)
    const next = data.chapters[at + 1]
    if (next) jumpToChapter(next.key)
    else finish()
  }

  function beginFullTour(chapter?: string) {
    liveRun.current += 1
    stopLine()
    writeTutorialProgress(null)
    startFullTour(chapter)
  }

  function jumpToChapter(key: string) {
    const index = steps.findIndex((s) => s.chapter === key)
    if (index < 0) return
    dirRef.current = 1
    setChaptersOpen(false)
    if (index === stepIndex) setTake((value) => value + 1)
    else setStepIndex(index)
  }

  function doIt() {
    const step = steps[stepIndex]
    if (!step?.doIt) return
    if (/^(goto|click|first):/.test(step.doIt) || script.actions?.[step.doIt]) runAction(step.doIt)
    else findVisible(step.doIt)?.click()
  }

  function toggleAuto() {
    if (auto) { setAuto(false); stopLine() }
    else { setAuto(true); setTake((value) => value + 1) }
  }

  function toggleMute() {
    setMuted((value) => {
      writeMuted(!value)
      if (!value) stopLine()
      return !value
    })
    if (phase === 'live' && muted) setTake((value) => value + 1)
  }

  // Follow the lit part as the page scrolls, opens or reflows.
  useEffect(() => {
    if (phase !== 'live' || !target) { setRect(null); return }
    const selector = resolved?.index === stepIndex ? resolved.selector : steps[stepIndex]?.selector
    let el: HTMLElement = target
    let frame = 0
    let last = ''
    const tick = () => {
      if (!el.isConnected) {
        const again = selector ? findVisible(selector) : null
        if (again) el = again
        else { if (last !== 'gone') { last = 'gone'; setRect(null) } frame = requestAnimationFrame(tick); return }
      }
      const box = el.getBoundingClientRect()
      const key = `${Math.round(box.left)},${Math.round(box.top)},${Math.round(box.width)},${Math.round(box.height)}`
      if (key !== last) {
        last = key
        setRect(box.width > 0 && box.height > 0 ? { left: box.left, top: box.top, width: box.width, height: box.height } : null)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, target, stepIndex, steps, resolved])

  // Park the narrator in the corner that covers the least of the lit part.
  const corner = useMemo<Corner>(() => {
    if (!rect) return 'br'
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.min(400, vw - 24)
    const h = 300
    const boxes: Record<Corner, { left: number; top: number }> = {
      br: { left: vw - w - 16, top: vh - h - 16 },
      bl: { left: 16, top: vh - h - 16 },
      tr: { left: vw - w - 16, top: 16 },
      tl: { left: 16, top: 16 },
    }
    const overlap = (c: Corner) => {
      const b = boxes[c]
      const x = Math.max(0, Math.min(b.left + w, rect.left + rect.width) - Math.max(b.left, rect.left))
      const y = Math.max(0, Math.min(b.top + h, rect.top + rect.height) - Math.max(b.top, rect.top))
      return x * y
    }
    return (['br', 'bl', 'tr', 'tl'] as Corner[]).reduce((best, c) => (overlap(c) < overlap(best) ? c : best), 'br')
  }, [rect])

  function onFilmKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tag = (event.target as HTMLElement).tagName
    if (tag === 'SELECT' || tag === 'INPUT') return
    if (event.key === 'ArrowRight') { event.preventDefault(); chooseScene(scene + 1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); chooseScene(scene - 1) }
    if (event.key === 'Escape') { event.preventDefault(); close() }
  }

  // ---------- render: film ----------
  if (phase === 'film' || phase === 'handoff') {
    const words = filmScene.narration.split(/\s+/).filter(Boolean)
    const lit = muted || !filmPlaying ? words.length : Math.round(progress * words.length)
    const talking = filmPlaying && !muted && progress > 0 && progress < 1
    return (
      <div className={`cbat-root cbat-film-root fixed inset-0 z-[190] grid place-items-center p-3 ${phase === 'handoff' ? 'leaving' : ''}`}>
        <style>{PLAYER_CSS}{script.css}</style>
        <div className="cbat-shrink">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={data.title}
          tabIndex={-1}
          onKeyDown={onFilmKeyDown}
          ref={(node) => { if (node && phase === 'film' && document.activeElement === document.body) node.focus() }}
          className="cbat-frame w-full max-w-[1040px] overflow-y-auto rounded-3xl bg-navy-950 p-4 text-white shadow-2xl outline-none sm:p-5"
        >
          <header className="flex items-start justify-between gap-3 px-1 pb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">{data.kicker}</div>
              <h2 className="mt-1 text-2xl font-black">{data.title}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={toggleMute} aria-pressed={muted} className="rounded-full px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10">{muted ? 'Unmute' : 'Mute'}</button>
              <button type="button" onClick={close} aria-label="Close the tutorial" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-slate-300 hover:text-white">✕</button>
            </div>
          </header>

          <div className="cbat-screen relative overflow-hidden rounded-2xl">
            <div key={filmScene.id} className="cbat-scene">
              <span className="cbat-chip">{scene + 1} / {data.film.length} · {filmScene.label}</span>
              <h3 className="cbat-title">{filmScene.title}</h3>
              <div className="cbat-visual"><script.Visual id={filmScene.id} shown={shown} /></div>
            </div>
          </div>

          <div className="mt-4 flex min-h-[72px] items-start gap-3">
            <span className={`cbat-avatar ${talking ? 'talk' : ''}`} aria-hidden="true">CB</span>
            <p className="m-0 min-w-0 text-[15px] leading-7 sm:text-base" aria-live="polite">
              {words.map((word, k) => <span key={k} className={k < lit ? 'text-white' : 'text-slate-500'}>{word} </span>)}
            </p>
          </div>

          <div className="mt-3 flex gap-1" role="group" aria-label={`Scene ${scene + 1} of ${data.film.length}`}>
            {data.film.map((item, k) => (
              <button key={item.id} type="button" title={item.label} aria-label={`Play scene ${k + 1}: ${item.label}`} aria-current={k === scene ? 'step' : undefined} onClick={() => chooseScene(k)} className="relative h-6 flex-1">
                <span className="absolute inset-x-0 top-2.5 h-1 rounded-full bg-white/15" />
                <span className="absolute left-0 top-2.5 h-1 rounded-full bg-amber-400" style={{ width: k < scene ? '100%' : k === scene ? `${Math.round(progress * 100)}%` : '0%' }} />
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" disabled={scene === 0} onClick={() => chooseScene(scene - 1)} className="rounded-xl border border-white/20 px-3.5 py-2 text-sm font-bold disabled:opacity-30">Back</button>
            <button type="button" onClick={() => { if (filmPlaying) { stopLine(); filmRun.current += 1 } setFilmPlaying((value) => !value) }} className="rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-navy-950">{filmPlaying ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={() => chooseScene(scene + 1)} className="rounded-xl border border-white/20 px-3.5 py-2 text-sm font-bold">Next</button>
            <button type="button" onClick={handOff} className="ml-auto rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-navy-950 hover:bg-amber-400">Skip to the hands-on part →</button>
          </div>
        </div>
        </div>
      </div>
    )
  }

  // ---------- render: finished ----------
  if (phase === 'done') {
    return (
      <div className="cbat-root fixed bottom-4 right-4 z-[195] w-[min(400px,calc(100vw-2rem))] rounded-[20px] bg-navy-950 p-5 text-white shadow-2xl" role="dialog" aria-label="Tutorial finished">
        <style>{PLAYER_CSS}</style>
        <div className="flex items-center gap-3">
          <span className="cbat-avatar" aria-hidden="true">CB</span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">{data.kicker}</div>
            <div className="text-lg font-black">You’ve reached the end of {fullMode ? 'the tour' : pageMode ? 'this page’s tour' : 'the tutorial'}</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          {fullMode
            ? 'Parts that weren’t available were skipped. Take any page’s tour again from the tour button at the top of that page when you’re ready to set it up.'
            : pageMode
              ? 'Parts that weren’t available were skipped. Take this tour again any time from the tour button at the top of the page.'
              : 'Parts that weren’t available were skipped. Take any part again whenever you like, from Parts or the Tutorial button at the top of the page. Your setup is saved only when you save it on the page.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.film.length > 0 && <button type="button" onClick={replayFilm} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold">Watch the film again</button>}
          <button type="button" onClick={() => { dirRef.current = 1; playedRef.current.clear(); setStepIndex(0); setTake((v) => v + 1); setPhase('live') }} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold">{fullMode ? 'Start again' : 'Walk the page again'}</button>
          <button type="button" onClick={close} className="ml-auto rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-navy-950">Done</button>
        </div>
      </div>
    )
  }

  // ---------- render: live ----------
  const step = steps[stepState === 'finding' ? shownIndex : stepIndex] ?? steps[stepIndex]
  const cardIndex = steps.indexOf(step)
  const chapterIndex = data.chapters.findIndex((c) => c.key === step.chapter)
  const chapter = data.chapters[chapterIndex]
  const said = resolved?.index === cardIndex ? resolved : null
  const title = said?.title ?? step.title
  const line = said?.say ?? step.say
  const words = line.split(/\s+/).filter(Boolean)
  const stepLabel = count ? `Step ${count.n} of ${count.total}` : `Step ${cardIndex + 1} of ${steps.length}`
  const partLabel = fullMode ? `Page ${chapterIndex + 1} of ${data.chapters.length}` : ''
  const lit = muted || stepState !== 'showing' ? words.length : Math.round(progress * words.length)
  const talking = !muted && stepState === 'showing' && progress > 0 && progress < 1
  const waiting = !!step.wait && stepState === 'showing'

  if (minimized) {
    return (
      <button type="button" onClick={() => setMinimized(false)} className="fixed bottom-4 right-4 z-[195] flex items-center gap-2 rounded-full bg-navy-950 px-4 py-3 text-sm font-bold text-white shadow-2xl">
        <style>{PLAYER_CSS}</style>
        <span className="cbat-avatar small" aria-hidden="true">CB</span>
        {pageMode ? 'Tour' : 'Tutorial'} · {chapter?.label}{step.intro ? '' : ` · ${stepLabel.toLowerCase()}`}
      </button>
    )
  }

  const partsMenu = chaptersOpen && (
    <ul className="absolute bottom-full left-0 mb-2 max-h-[60vh] w-64 overflow-y-auto rounded-xl bg-white p-1 text-sm text-navy-950 shadow-2xl">
      {data.chapters.map((c, k) => (
        <li key={c.key}>
          {c.group && c.group !== data.chapters[k - 1]?.group && (
            <div className="px-3 pb-1 pt-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{c.group}</div>
          )}
          <button type="button" onClick={() => jumpToChapter(c.key)} className={`w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-amber-50 ${k === chapterIndex ? 'bg-amber-100' : ''}`}>{k + 1}. {c.label}</button>
        </li>
      ))}
      {data.film.length > 0 && <li><button type="button" onClick={replayFilm} className="w-full rounded-lg px-3 py-2 text-left font-semibold text-slate-600 hover:bg-amber-50">Watch the film again</button></li>}
    </ul>
  )
  const showParts = data.chapters.length > 1 || data.film.length > 0
  const chapterBar = data.chapters.length > 12 ? (
    <div className="mt-3 h-1 rounded bg-white/15" aria-hidden="true">
      <div className="h-1 rounded bg-amber-400" style={{ width: `${Math.round(((chapterIndex + 1) / data.chapters.length) * 100)}%` }} />
    </div>
  ) : (
    <div className="mt-3 flex gap-1" aria-hidden="true">
      {data.chapters.map((c, k) => (
        <span key={c.key} className={`h-1 flex-1 rounded ${k < chapterIndex ? 'bg-emerald-400' : k === chapterIndex ? 'bg-amber-400' : 'bg-white/15'}`} />
      ))}
    </div>
  )

  // ---------- render: a page's quick intro ----------
  if (step.intro) {
    const intro = step.intro
    const hasWalk = steps[cardIndex + 1]?.chapter === step.chapter
    const onHome = !fullMode && /^\/connect\/?$/.test(location.pathname)
    const resume = onHome ? readFullTourResume() : null
    if (!fullMode && intro.film?.length) {
      return (
        <PageIntroFilm
          key={step.id}
          scenes={intro.film}
          page={intro.page}
          kicker={`${intro.area && intro.area !== 'Home' ? `${intro.area} · ` : ''}Intro film`}
          hasWalk={hasWalk}
          muted={muted}
          onToggleMute={toggleMute}
          onWalk={() => (hasWalk ? move(1) : close())}
          onNotNow={notNow}
          onClose={close}
          firstStepLine={hasWalk ? steps[cardIndex + 1]?.say : undefined}
        />
      )
    }
    return (
      <>
        <style>{PLAYER_CSS}</style>
        <div aria-hidden="true" className="cbat-intro-dim pointer-events-none fixed inset-0 z-[185]" />
        <aside
          className="cbat-root cbat-dock fixed bottom-4 left-1/2 z-[195] w-[min(480px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] -translate-x-1/2 overflow-y-auto rounded-[20px] bg-navy-950 p-5 text-white shadow-2xl"
          role="dialog"
          aria-label={`${intro.page}: quick intro`}
        >
          <div className="flex items-center gap-3">
            <span className={`cbat-avatar ${talking ? 'talk' : ''}`} aria-hidden="true">CB</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-amber-300">
                {fullMode ? `${partLabel} · ${intro.area ?? chapter?.group ?? ''}` : `${intro.area && intro.area !== 'Home' ? `${intro.area} · ` : ''}Quick intro`}
              </div>
            </div>
            <button type="button" onClick={toggleMute} aria-pressed={muted} className="rounded-full px-2 py-1 text-xs text-slate-300 hover:bg-white/10">{muted ? 'Unmute' : 'Mute'}</button>
            <button type="button" onClick={close} className="rounded-full px-2 py-1 text-slate-300 hover:bg-white/10" aria-label={fullMode ? 'Stop the full tour' : 'Close the tour'}>✕</button>
          </div>

          <h2 className="mt-3 text-2xl font-black leading-tight">{intro.page}</h2>
          {intro.purpose && <p className="mt-2 text-sm leading-6 text-slate-200">{intro.purpose}</p>}
          {hasWalk && intro.covers.length > 0 && (
            <>
              <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">What we’ll cover</div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {intro.covers.map((item) => (
                  <li key={item} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-100">{item}</li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => (hasWalk || fullMode ? move(1) : close())} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-navy-950">
              {hasWalk ? 'Walk me through it' : fullMode ? 'Next page' : 'Got it'}
            </button>
            {hasWalk && <button type="button" onClick={notNow} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold">{fullMode ? 'Not now, next page' : 'Not now'}</button>}
            {onHome && <button type="button" onClick={() => beginFullTour()} className="rounded-xl border border-amber-300/60 px-3 py-2 text-sm font-bold text-amber-200">The full tour</button>}
            {fullMode && (
              <>
                <button type="button" onClick={toggleAuto} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold">{auto ? 'Pause' : 'Play'}</button>
                <div className="relative">
                  <button type="button" onClick={() => setChaptersOpen((v) => !v)} aria-expanded={chaptersOpen} className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold">Parts ▾</button>
                  {partsMenu}
                </div>
              </>
            )}
          </div>
          {resume && (
            <button type="button" onClick={() => beginFullTour(resume.chapter)} className="mt-3 text-xs font-bold text-slate-300 underline underline-offset-4">
              Pick up the full tour where you stopped: {resume.label}
            </button>
          )}
          {fullMode && chapterBar}
        </aside>
      </>
    )
  }

  const dockPosition = { br: 'bottom-4 right-4', bl: 'bottom-4 left-4', tr: 'top-4 right-4', tl: 'top-4 left-4' }[corner]

  return (
    <>
      <style>{PLAYER_CSS}</style>
      {rect && (
        <div
          aria-hidden="true"
          className={`cbat-spot pointer-events-none fixed z-[185] ${waiting ? 'waiting' : ''}`}
          style={{ left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16 }}
        />
      )}
      <aside
        className={`cbat-root cbat-dock fixed z-[195] w-[min(400px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[20px] bg-navy-950 p-4 text-white shadow-2xl ${dockPosition}`}
        role="dialog"
        aria-label={`${data.title}: ${title}`}
      >
        <div className="flex items-center gap-3">
          <span className={`cbat-avatar ${talking ? 'talk' : ''}`} aria-hidden="true">CB</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-amber-300">{fullMode ? `${chapter?.group ?? ''} · ${chapter?.label ?? ''}` : chapter?.label ?? data.kicker}</div>
            <div className="text-xs text-slate-400">{partLabel ? `${partLabel} · ` : ''}{stepLabel}</div>
          </div>
          <button type="button" onClick={toggleMute} aria-pressed={muted} className="rounded-full px-2 py-1 text-xs text-slate-300 hover:bg-white/10">{muted ? 'Unmute' : 'Mute'}</button>
          <button type="button" onClick={() => setMinimized(true)} className="rounded-full px-2 py-1 text-slate-300 hover:bg-white/10" aria-label="Make it smaller">—</button>
          <button type="button" onClick={close} className="rounded-full px-2 py-1 text-slate-300 hover:bg-white/10" aria-label="Close the tutorial">✕</button>
        </div>

        <h3 className="mt-3 text-lg font-black leading-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-6" aria-live="polite">
          {words.map((word, k) => <span key={k} className={stepState === 'finding' ? 'text-slate-500' : k < lit ? 'text-white' : 'text-slate-500'}>{word} </span>)}
        </p>

        {step.yourTurn && stepState !== 'finding' && (
          <div className={`mt-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ${stepState === 'done' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-400/15 text-amber-100'}`}>
            <span className="font-bold">{stepState === 'done' ? '✓ Nice.' : 'Your turn:'}</span>
            {stepState !== 'done' && <span className="min-w-0 flex-1">{step.yourTurn}</span>}
            {step.doIt && stepState === 'showing' && (
              <button type="button" onClick={doIt} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-black text-navy-950">Do it for me</button>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button type="button" disabled={stepIndex === 0} onClick={() => move(-1)} className="rounded-xl border border-white/20 px-3 py-1.5 text-sm font-bold disabled:opacity-30">Back</button>
          <button type="button" onClick={toggleAuto} className="rounded-xl border border-white/20 px-3 py-1.5 text-sm font-bold" title={auto ? 'Stop moving on by itself' : 'Move on by itself again'}>{auto ? 'Pause' : 'Play'}</button>
          {showParts && (
            <div className="relative">
              <button type="button" onClick={() => setChaptersOpen((v) => !v)} aria-expanded={chaptersOpen} className="rounded-xl border border-white/20 px-3 py-1.5 text-sm font-bold">Parts ▾</button>
              {partsMenu}
            </div>
          )}
          <button type="button" onClick={() => move(1)} className="ml-auto rounded-xl bg-amber-400 px-4 py-1.5 text-sm font-black text-navy-950">
            {stepIndex === steps.length - 1 ? 'Finish' : waiting ? 'Skip' : 'Next'}
          </button>
        </div>

        {chapterBar}
      </aside>
    </>
  )
}

/** A tour with no film still has a scene to point at. */
const NO_SCENE = { id: '', label: '', title: '', narration: '' }

const PLAYER_CSS = `
.cbat-intro-dim { background: rgba(7,12,26,.28); animation: cbat-fade .35s ease both; }
.cbat-film-root { background: rgba(7,12,26,.8); backdrop-filter: blur(4px); transition: background .9s ease, backdrop-filter .9s ease; }
.cbat-film-root.leaving { background: rgba(7,12,26,0); backdrop-filter: blur(0); pointer-events: none; }
.cbat-frame { max-height: calc(100vh - 1.5rem); animation: cbat-pop .45s cubic-bezier(.2,.9,.3,1.2) both; }
.cbat-shrink { width: 100%; max-width: 1040px; transform-origin: 100% 100%; transition: transform .9s cubic-bezier(.6,0,.3,1), opacity .9s cubic-bezier(.7,0,1,1); }
.cbat-film-root.leaving .cbat-shrink { transform: translate(calc(50vw - 300px), calc(50vh - 160px)) scale(.3); opacity: 0; }
.cbat-screen { background: radial-gradient(120% 120% at 0% 0%, #fff7e6 0%, #f8fafc 55%); color: #0b1324; min-height: 360px; }
.cbat-scene { padding: 18px 22px 22px; animation: cbat-fade .35s ease both; }
.cbat-chip { display: inline-block; background: #0b1324; color: #fde68a; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; padding: 5px 10px; border-radius: 99px; }
.cbat-title { font-size: clamp(19px, 2.4vw, 27px); line-height: 1.15; margin: 10px 0 14px; font-weight: 900; text-wrap: balance; }
.cbat-visual { min-height: 230px; }
.cbat-avatar { width: 32px; height: 32px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); position: relative; }
.cbat-avatar.small { width: 22px; height: 22px; font-size: 9px; }
.cbat-avatar.talk::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(251,191,36,.6); animation: cbat-ring 1.2s ease-out infinite; }
.cbat-dock { animation: cbat-dock-in .6s cubic-bezier(.2,.9,.3,1.15) both; }
.cbat-spot { border-radius: 14px; box-shadow: 0 0 0 3px #fbbf24, 0 0 0 9999px rgba(7,12,26,.42); transition: left .25s ease, top .25s ease, width .25s ease, height .25s ease; }
.cbat-spot.waiting::after { content: ""; position: absolute; inset: -6px; border-radius: 18px; border: 3px solid rgba(251,191,36,.75); animation: cbat-pulse 1.4s ease-out infinite; }
@keyframes cbat-pop { from { opacity: 0; transform: translateY(12px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes cbat-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cbat-ring { from { transform: scale(.9); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }
@keyframes cbat-pulse { from { transform: scale(.98); opacity: 1; } to { transform: scale(1.06); opacity: 0; } }
@keyframes cbat-dock-in { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }
@media (max-width: 760px) { .cbat-scene { padding: 14px 12px 16px; } .cbat-screen { min-height: 0; } }
@media (prefers-reduced-motion: reduce) { .cbat-root *, .cbat-root *::after, .cbat-root, .cbat-spot, .cbat-spot::after, .cbat-shrink { animation: none !important; transition: none !important; } }
`
