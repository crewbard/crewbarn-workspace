import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOnboardingStatus } from '@/hooks/useOnboarding'
import { buildOnboardingStages, type OnboardingStage } from '@/components/onboarding/onboardingStages'
import { useOnboardingWalkthrough } from '@/components/onboarding/onboardingWalkthrough'
import { speakLine, stopLine } from '@/lib/tourVoice'
import { CLOUDFLARE_PERMS, MODEL_JOBS, SETUP_GUIDE, type GuideBeat, type GuideCtx } from './setupGuideScript'

/**
 * The setup guide: walks the real onboarding steps top to bottom, out loud.
 *
 * It points at the part of the page it is talking about (found by its
 * data-guide name), pauses whenever the person has to do something — paste a
 * key, connect Cloudflare, press Save — and only moves on when that thing is
 * actually done. Outside links mark the guide as "away"; when the tab comes
 * back it says welcome back and focuses the box.
 *
 * Two looks, remembered per person:
 *  - Overlay: the page dims except the highlighted part; the card sits beside it.
 *  - Side panel: the card docks bottom-right; the highlighted part gets a ring.
 *
 * Every step can be done on the page without the guide; the guide notices.
 */

const MODE_KEY = 'crewbarn:onboarding:guide-mode'
type Mode = 'overlay' | 'panel'

function readMode(): Mode {
  try { return window.localStorage.getItem(MODE_KEY) === 'panel' ? 'panel' : 'overlay' } catch { return 'overlay' }
}

/** The open setup window if there is one, else the page. */
function scope(): ParentNode {
  return document.querySelector('[data-guide-host="overlay"]') ?? document
}
function findPart(name: string): HTMLElement | null {
  return scope().querySelector<HTMLElement>(`[data-guide="${name}"]`)
}

export function OnboardingSetupGuide({ open, audioOn, onToggleAudio, onClose }: {
  open: boolean
  audioOn: boolean
  onToggleAudio: () => void
  onClose: (finished: boolean) => void
}) {
  const statusQuery = useOnboardingStatus(open)
  const onboarding = statusQuery.data?.data
  const stages = useMemo<OnboardingStage[]>(() => (onboarding ? buildOnboardingStages(onboarding) : []), [onboarding])
  const { walkthrough } = useOnboardingWalkthrough(open)
  const lines = (walkthrough as unknown as { setupLines?: Record<string, string> }).setupLines ?? {}
  const clips = walkthrough.narration?.clips ?? {}
  const line = useCallback((id?: string) => (id ? lines[id] ?? '' : ''), [lines])

  const [mode, setMode] = useState<Mode>(readMode)
  const [min, setMin] = useState(false)
  const [stageIndex, setStageIndex] = useState(-1)
  const [beatIndex, setBeatIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [talking, setTalking] = useState(false)
  const [met, setMet] = useState(false)
  const [away, setAway] = useState<false | 'leaving' | 'back'>(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const [finished, setFinished] = useState(false)
  const [, setTick] = useState(0)
  const run = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const script = useMemo(() => SETUP_GUIDE.filter((s) => stages.some((st) => st.key === s.key)), [stages])
  const stageState = (key: string) => stages.find((s) => s.key === key)
  const ctx: GuideCtx = useMemo(() => ({
    el: findPart,
    value: (name, index = 0) => {
      const inputs = Array.from(findPart(name)?.querySelectorAll<HTMLInputElement>('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea') ?? [])
      const input = index < 0 ? inputs[inputs.length + index] : inputs[index]
      return (input?.value ?? '').trim()
    },
    attr: (name, key) => findPart(name)?.getAttribute(`data-guide-${key}`) ?? '',
    complete: (key) => !!stages.find((s) => s.key === key)?.complete,
  }), [stages])

  const stage = script[stageIndex]
  const beat: GuideBeat | undefined = stage?.beats[beatIndex]

  /* ---------- starting and moving ---------- */
  const say = useCallback((id: string | undefined, onEnd?: () => void, lightCaption = true) => {
    const text = line(id)
    const token = ++run.current
    if (!text) { onEnd?.(); return }
    if (lightCaption) setProgress(audioOn ? 0 : 1)
    if (!audioOn) {
      const timer = window.setTimeout(() => { if (token === run.current) onEnd?.() }, Math.max(3500, text.length * 45))
      return () => window.clearTimeout(timer)
    }
    setTalking(true)
    void speakLine({ text, clipUrl: id ? clips[id] : undefined, onProgress: (f) => { if (token === run.current && lightCaption) setProgress(f) } })
      .then((result) => { if (token !== run.current) return; setTalking(false); if (result === 'ended') onEnd?.() })
  }, [audioOn, clips, line])

  const openStage = (key: string) => window.dispatchEvent(new CustomEvent('crewbarn:onboarding-open-stage', { detail: { key } }))

  const goStage = useCallback((from: number) => {
    for (let i = from; i < script.length; i++) {
      const st = stageState(script[i].key)
      if (!st) continue
      if (st.locked) { setSkipped((s) => s.includes(st.key) ? s : [...s, st.key]); continue }
      // A step that is already done gets its one-liner (if it has one) and is passed.
      const firstUsable = script[i].beats.findIndex((b) => !b.when || b.when(ctx))
      if (st.complete && !script[i].beats.some((b) => b.line.endsWith('.done'))) continue
      setStageIndex(i); setBeatIndex(Math.max(0, firstUsable)); setMet(false); setAway(false)
      openStage(script[i].key)
      return
    }
    setFinished(true); setStageIndex(-1)
    stopLine(); say('setup.finish')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, stages, ctx, say])

  const nextBeat = useCallback(() => {
    if (!stage) return
    for (let b = beatIndex + 1; b < stage.beats.length; b++) {
      const candidate = stage.beats[b]
      if (candidate.when && !candidate.when(ctx)) continue
      setBeatIndex(b); setMet(false); setAway(false)
      return
    }
    goStage(stageIndex + 1)
  }, [stage, beatIndex, ctx, goStage, stageIndex])

  // Start: say hello, then the first open step.
  useEffect(() => {
    if (!open || !stages.length || stageIndex !== -1 || finished) return
    say('setup.start', () => goStage(0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stages.length])

  useEffect(() => { if (!open) { run.current += 1; stopLine(); setStageIndex(-1); setFinished(false); setSkipped([]) } }, [open])

  const savedFor = useRef<string | null>(null)
  const live = useRef({ beat, met, ctx, stage, stageIndex, say, nextBeat, goStage })
  live.current = { beat, met, ctx, stage, stageIndex, say, nextBeat, goStage }

  // Each beat: point at it, say it, move on when there is nothing to wait for.
  useEffect(() => {
    if (!open || !beat) return
    const target = findPart(beat.el)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const already = !!beat.until?.(ctx)
    setMet(already)
    // Saved on the page before the guide got here: say so and move on.
    if (stage && !beat.line.endsWith('.done') && ctx.complete(stage.key) && savedFor.current !== stage.key) {
      savedFor.current = stage.key
      say('setup.saved', () => live.current.goStage(live.current.stageIndex + 1))
      return
    }
    say(beat.line, () => {
      if (!beat.until) window.setTimeout(() => live.current.nextBeat(), 600)
      else if (beat.until(live.current.ctx)) window.setTimeout(() => live.current.nextBeat(), 500)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stageIndex, beatIndex])

  // Watch the page: typing, choosing, saving. Polling keeps the steps free of
  // guide code. One timer for the whole session; it reads the latest state
  // through a ref so re-renders never reset it.
  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => {
      const L = live.current
      setTick((t) => t + 1)
      // Saved on the page from any beat (with or without the guide): move on.
      if (L.stage && L.beat && !L.beat.line.endsWith('.done') && L.ctx.complete(L.stage.key) && savedFor.current !== L.stage.key) {
        savedFor.current = L.stage.key
        L.say('setup.saved', () => live.current.goStage(live.current.stageIndex + 1))
        return
      }
      if (!L.beat?.until || L.met || !L.beat.until(L.ctx)) return
      setMet(true)
      L.met = true
      L.say(L.beat.done, () => window.setTimeout(() => live.current.nextBeat(), 400), false)
    }, 400)
    return () => window.clearInterval(timer)
  }, [open])

  // Coming back from an outside link.
  useEffect(() => {
    if (!open) return
    const returned = () => {
      if (away !== 'leaving' || !beat) return
      setAway('back')
      if (beat.until && !beat.until(ctx)) {
        findPart(beat.el)?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
        say(beat.back, undefined, false)
      }
    }
    const onVis = () => { if (document.visibilityState === 'visible') returned() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', returned)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', returned) }
  }, [open, away, beat, ctx, say])

  // Links on the page itself (e.g. "Open Connect Cloudflare") count as leaving too.
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      const a = (event.target as HTMLElement | null)?.closest?.('a[target="_blank"]')
      if (a) setAway('leaving')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [open])

  /* ---------- the highlight and where the card sits ---------- */
  useEffect(() => {
    if (!open) return
    let frame = 0
    let last: HTMLElement | null = null
    const loop = () => {
      const target = beat && !finished ? findPart(beat.el) : null
      if (target !== last) { last?.classList.remove('cbg-focus'); target?.classList.add('cbg-focus'); last = target }
      document.body.classList.toggle('cbg-overlay', mode === 'overlay' && !!target && !min)
      const card = cardRef.current
      if (card) {
        if (mode === 'overlay' && target && !min && window.innerWidth > 760) {
          const r = target.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, gap = 20
          const ct = (y: number) => Math.max(16, Math.min(y, vh - h - 16)), cl = (x: number) => Math.max(16, Math.min(x, vw - w - 16))
          let left: number, top: number
          if (r.right + gap + w <= vw - 16) { left = r.right + gap; top = ct(r.top) }
          else if (r.left - gap - w >= 16) { left = r.left - gap - w; top = ct(r.top) }
          else if (r.bottom + gap + h <= vh - 8) { left = cl(r.left + r.width / 2 - w / 2); top = r.bottom + gap }
          else if (r.top - gap - h >= 8) { left = cl(r.left + r.width / 2 - w / 2); top = r.top - gap - h }
          else { left = vw - w - 16; top = vh - h - 16 }
          card.style.left = `${Math.round(left)}px`; card.style.top = `${Math.round(top)}px`; card.style.right = 'auto'; card.style.bottom = 'auto'
        } else { card.style.left = card.style.top = card.style.right = card.style.bottom = '' }
      }
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => { cancelAnimationFrame(frame); last?.classList.remove('cbg-focus'); document.body.classList.remove('cbg-overlay') }
  }, [open, beat, mode, min, finished])

  if (!open) return null

  const close = () => { run.current += 1; stopLine(); onClose(finished) }
  const skipStep = () => {
    if (!stage) return
    setSkipped((s) => s.includes(stage.key) ? s : [...s, stage.key])
    say('setup.skipped', () => goStage(stageIndex + 1))
  }
  const back = () => {
    if (beatIndex > 0) { setBeatIndex(beatIndex - 1); setMet(false) }
    else if (stageIndex > 0) { setStageIndex(stageIndex - 1); setBeatIndex(0); openStage(script[stageIndex - 1].key) }
  }
  const setLook = (next: Mode) => { setMode(next); try { window.localStorage.setItem(MODE_KEY, next) } catch { /* private mode */ } }

  const text = finished ? line('setup.finish') : beat ? line(beat.line) : line('setup.start')
  const words = text.split(/\s+/).filter(Boolean)
  const lit = audioOn ? Math.round(progress * words.length) : words.length
  const waiting = !!beat?.until && !met
  const stageTitle = stage ? stageState(stage.key)?.title ?? '' : ''
  const links = beat?.links?.(ctx) ?? []

  if (min) {
    return (
      <div ref={cardRef} className="cbg-card cbg-min">
        <style>{GUIDE_CSS}</style>
        <button type="button" onClick={() => setMin(false)} className="flex items-center gap-2.5 font-bold text-white">
          <span className={`cbg-avatar ${talking ? 'talk' : ''}`}>CB</span>
          Guide{stage ? ` · Step ${stageIndex + 1} of ${script.length}` : ''}
        </button>
      </div>
    )
  }

  return (
    <div ref={cardRef} className="cbg-card" role="dialog" aria-label="Setup guide" aria-live="polite">
      <style>{GUIDE_CSS}</style>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-[12.5px] font-bold text-slate-300"><span className={`cbg-avatar ${talking ? 'talk' : ''}`}>CB</span>CrewBarn guide</div>
        <div className="flex">
          <button type="button" className="cbg-icon" onClick={onToggleAudio}>{audioOn ? 'Mute' : 'Unmute'}</button>
          <button type="button" className="cbg-icon" onClick={() => setMin(true)}>Minimize</button>
          <button type="button" className="cbg-icon" onClick={close} aria-label="Close the guide">✕</button>
        </div>
      </div>

      {stage && <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-300">Step {stageIndex + 1} of {script.length} · {stageTitle}</div>}
      <h3 className="mt-1 text-[19px] font-black leading-tight">{finished ? 'That’s the whole list' : beat?.title ?? 'Let’s get you set up'}</h3>
      <p className="mt-2 text-[14.5px] leading-[1.65]">{words.map((w, k) => <span key={k} className={k < lit ? 'text-white' : 'text-slate-500'}>{w} </span>)}</p>

      {beat?.models && (
        <div className="mt-3 grid gap-1.5">
          {MODEL_JOBS.map(([job, model]) => (
            <div key={job} className="flex justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[12.5px]"><span>{job}</span><em className={`whitespace-nowrap font-mono text-[11px] not-italic ${model.startsWith('OpenAI') ? 'text-emerald-200' : 'text-amber-200'}`}>{model}</em></div>
          ))}
          <div className="text-[12px] text-slate-400">Picked for you. Change it under “Choose a specific model” only if you want to.</div>
        </div>
      )}
      {beat?.cloudflarePerms && (
        <div className="mt-3 grid gap-1.5">
          {CLOUDFLARE_PERMS.map((p) => (
            <div key={p.what} className="flex justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[12.5px]"><span>{p.what}</span><em className={`whitespace-nowrap font-mono text-[11px] not-italic ${p.auto ? 'text-emerald-200' : 'text-amber-200'}`}>{p.auto ? '✓ picked' : '✋ by hand'}</em></div>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {links.map(([label, href]) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" onClick={() => setAway('leaving')} className="rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] font-extrabold text-navy-950">{label} ↗</a>)}
        </div>
      )}
      {beat?.until && (
        <div className={`mt-3 flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] ${met ? 'border-emerald-400/45 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/35 bg-amber-300/10 text-amber-100'}`}>
          {met ? '✓ ' + (line(beat.done) || 'Done.') : <><span className="cbg-spin" />{away === 'back' && beat.back ? line(beat.back) : line(beat.waiting)}</>}
        </div>
      )}
      {finished && skipped.length > 0 && (
        <div className="mt-3 text-[13px] text-slate-300">Still to do: {skipped.map((k) => stageState(k)?.title).filter(Boolean).join(', ')}.</div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {!finished && <button type="button" className="cbg-btn" onClick={back} disabled={stageIndex <= 0 && beatIndex === 0}>Back</button>}
        {!finished && beat && <button type="button" className="cbg-btn" onClick={() => { setMet(!!beat.until?.(ctx)); say(beat.line) }}>Replay</button>}
        {!finished && beat && (beat.optional
          ? <button type="button" className="cbg-btn" onClick={() => { run.current += 1; stopLine(); nextBeat() }}>{beat.optional}</button>
          : <button type="button" className="cbg-btn" onClick={skipStep} title="Skip for now. It stays on the list.">Skip step</button>)}
        {finished
          ? <button type="button" className="cbg-btn go ml-auto" onClick={close}>Close the guide</button>
          : <button type="button" className="cbg-btn go ml-auto" disabled={waiting} onClick={() => { run.current += 1; stopLine(); nextBeat() }}>{waiting ? 'Waiting for you' : 'Next'}</button>}
      </div>

      <div className="mt-3.5 flex gap-[3px]">
        {script.map((s, k) => {
          const st = stageState(s.key)
          return <i key={s.key} title={st?.title} className={`h-1 flex-1 rounded ${k === stageIndex ? 'bg-amber-400' : st?.complete ? 'bg-emerald-500' : skipped.includes(s.key) ? 'bg-slate-500' : 'bg-white/15'}`} />
        })}
      </div>
      <div className="mt-2.5 inline-flex rounded-full bg-white/10 p-0.5" role="group" aria-label="Guide style">
        {(['overlay', 'panel'] as Mode[]).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setLook(m)} className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${mode === m ? 'bg-white text-navy-950' : 'text-slate-300'}`}>{m === 'overlay' ? 'Overlay' : 'Side panel'}</button>
        ))}
      </div>
    </div>
  )
}

const GUIDE_CSS = `
.cbg-card { position: fixed; right: 16px; bottom: 16px; z-index: 200; width: min(390px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; background: #0b1324; color: #fff; border-radius: 20px; padding: 16px 18px 18px; box-shadow: 0 24px 60px rgba(11,19,36,.45); animation: cbg-rise .45s cubic-bezier(.2,.9,.3,1.2) both; transition: left .5s cubic-bezier(.65,0,.35,1), top .5s cubic-bezier(.65,0,.35,1); }
.cbg-card.cbg-min { width: auto; padding: 8px 14px 8px 8px; border-radius: 99px; }
.cbg-avatar { width: 30px; height: 30px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); position: relative; }
.cbg-avatar.talk::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(251,191,36,.6); animation: cbg-ring 1.2s ease-out infinite; }
.cbg-icon { background: none; border: 0; color: #cbd5e1; border-radius: 99px; padding: 5px 9px; font-size: 12px; font-weight: 700; }
.cbg-icon:hover { background: rgba(255,255,255,.1); }
.cbg-btn { border: 1px solid rgba(255,255,255,.22); background: none; color: #fff; border-radius: 10px; padding: 7px 11px; font-weight: 800; font-size: 13px; }
.cbg-btn:disabled { opacity: .3; cursor: default; }
.cbg-btn.go { background: #f59e0b; border-color: #f59e0b; color: #0b1324; }
.cbg-spin { width: 13px; height: 13px; flex: none; border-radius: 50%; border: 2px solid rgba(251,191,36,.3); border-top-color: #fbbf24; animation: cbg-spin 1s linear infinite; }
.cbg-focus { position: relative; z-index: 30; border-radius: 14px; box-shadow: 0 0 0 3px #fbbf24, 0 0 0 9px rgba(251,191,36,.25) !important; animation: cbg-pulse 2.2s ease-out infinite; }
body.cbg-overlay .cbg-focus { animation: none; background-color: #fff; box-shadow: 0 0 0 3px #fbbf24, 0 0 0 200vmax rgba(7,12,26,.62) !important; }
@keyframes cbg-rise { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes cbg-ring { from { transform: scale(.9); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }
@keyframes cbg-spin { to { transform: rotate(360deg); } }
@keyframes cbg-pulse { 0%,100% { box-shadow: 0 0 0 3px #fbbf24, 0 0 0 9px rgba(251,191,36,.25); } 50% { box-shadow: 0 0 0 3px #fbbf24, 0 0 0 14px rgba(251,191,36,.08); } }
@media (max-width: 760px) { .cbg-card { left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 52vh; } }
@media (prefers-reduced-motion: reduce) { .cbg-card, .cbg-focus, .cbg-avatar::after, .cbg-spin { animation: none !important; transition: none !important; } }
`
