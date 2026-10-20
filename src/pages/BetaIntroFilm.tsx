import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useWakeLock } from '@/lib/wakeLock'
import { API_URL } from '@/lib/api'
import { speakLine, stopLine } from '@/lib/tourVoice'
import { BETA_INTRO_LINES } from '@/lib/betaIntroLines'
import { ANDROID_APP_QR, ANDROID_APP_URL } from '@/lib/androidApp'

/**
 * The beta page's intro: a short film in the middle of the page that explains
 * the program, then fades away and leaves the invite box.
 *
 * It starts on its own with captions (browsers won't play sound until someone
 * clicks). "Play with sound" starts it over, read aloud in the tour voice:
 * a recorded clip when there is one (public clip list, no sign-in), otherwise
 * the best voice the browser has.
 */

type Scene = { key: string; visual: (props: { seats: SeatProps }) => ReactNode }
type SeatProps = { spots: number | null; left: number | null }

const FEATURES = ['One inbox', 'Call transcripts', 'Quotes, signed on a phone', 'Schedule and dispatch', 'A call when a tech runs late', 'Field app, works offline', 'Invoices and payments', 'The books', 'Your own app and website']

const SCENES: Scene[] = [
  { key: 'mark', visual: () => (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 64 64" className="cbif-mark h-20 w-20 sm:h-24 sm:w-24" aria-hidden="true">
        <path className="cbif-roof" d="M51 27 L32 13 L13 27" />
        <path className="cbif-cee" d="M14 27 V38 q0 8 8 8 h20" />
      </svg>
      <div className="cbif-in mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ animationDelay: '1.2s' }}>Crew<span className="text-amber-400">Barn</span></div>
      <div className="cbif-in mt-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-400" style={{ animationDelay: '1.5s' }}>The beta</div>
    </div>
  ) },
  { key: 'does', visual: () => (
    <div className="w-full max-w-xl">
      <div className="cbif-in text-center text-2xl font-extrabold sm:text-3xl">From the first call to the <span className="text-amber-400">paid invoice.</span></div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {FEATURES.map((f, i) => (
          <span key={f} className="cbif-in rounded-lg border border-white/15 bg-white/[.06] px-3 py-1.5 text-xs font-semibold text-slate-100 sm:text-sm" style={{ animationDelay: `${0.4 + i * 0.35}s` }}>{f}</span>
        ))}
      </div>
    </div>
  ) },
  { key: 'free', visual: () => (
    <div className="text-center">
      <div className="cbif-slam text-6xl font-black uppercase leading-[.9] tracking-tight sm:text-8xl">Free<br /><span className="text-amber-400">for life.</span></div>
      <div className="cbif-in mt-4 text-sm text-slate-300 sm:text-base" style={{ animationDelay: '1s' }}>For the trades who test it on real work.</div>
    </div>
  ) },
  { key: 'seats', visual: ({ seats }) => (
    <div className="text-center">
      <div className="cbif-in text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Seats are limited</div>
      <div className="cbif-slam mt-3 text-7xl font-black tabular-nums text-white sm:text-8xl">
        {seats.left ?? '—'}<span className="text-3xl text-slate-500 sm:text-4xl"> / {seats.spots ?? '—'}</span>
      </div>
      <div className="cbif-in mt-2 text-sm font-semibold text-amber-300" style={{ animationDelay: '.8s' }}>seats left</div>
      {seats.spots !== null && (
        <div className="mx-auto mt-4 flex max-w-xs justify-center gap-1.5" aria-hidden="true">
          {Array.from({ length: Math.min(seats.spots, 30) }, (_, i) => (
            <span key={i} className={`cbif-in h-3 flex-1 rounded-sm ${i < (seats.spots! - (seats.left ?? 0)) ? 'bg-slate-600' : 'bg-amber-400'}`} style={{ animationDelay: `${1 + i * 0.08}s` }} />
          ))}
        </div>
      )}
    </div>
  ) },
  { key: 'keys', visual: () => (
    <div className="w-full max-w-lg text-center">
      <div className="cbif-in text-2xl font-extrabold sm:text-3xl">Your keys. <span className="text-amber-400">Your bill.</span></div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {['AI', 'Phone', 'Maps', 'Storage'].map((k, i) => (
          <div key={k} className="cbif-in rounded-lg border border-white/15 bg-white/[.06] px-3 py-3 text-sm font-bold" style={{ animationDelay: `${0.4 + i * 0.3}s` }}>{k}</div>
        ))}
      </div>
      <div className="cbif-in mt-4 text-sm text-slate-300" style={{ animationDelay: '1.8s' }}>Most AI tasks cost less than <span className="font-bold text-amber-300">half a penny</span>.</div>
    </div>
  ) },
  { key: 'rule', visual: () => (
    <div className="w-full max-w-xl">
      <div className="cbif-slam text-center text-3xl font-black uppercase sm:text-5xl">The one rule: <span className="text-amber-400">testers test.</span></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {[['Use it', 'on your real jobs'], ['Report it', 'bugs and ideas, on the board'], ['Or lose it', 'the seat goes to the next trade']].map(([a, b], i) => (
          <div key={a} className={`cbif-in rounded-lg border px-3 py-3 text-center ${i === 2 ? 'border-red-400/50 bg-red-500/10' : 'border-amber-400/40 bg-amber-400/10'}`} style={{ animationDelay: `${0.8 + i * 0.5}s` }}>
            <div className={`text-sm font-extrabold ${i === 2 ? 'text-red-200' : 'text-amber-200'}`}>{a}</div>
            <div className="mt-0.5 text-xs text-slate-300">{b}</div>
          </div>
        ))}
      </div>
    </div>
  ) },
  { key: 'app', visual: () => (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <a href={ANDROID_APP_URL} target="_blank" rel="noreferrer" data-film-control className="cbif-slam block w-32 shrink-0 rounded-xl bg-white p-2 shadow-xl sm:w-40" aria-label="Install the CrewBarn Android app">
        <svg viewBox={`0 0 ${ANDROID_APP_QR.size} ${ANDROID_APP_QR.size}`} shapeRendering="crispEdges" className="block h-auto w-full" role="img" aria-label="QR code for the Android app">
          <rect width={ANDROID_APP_QR.size} height={ANDROID_APP_QR.size} fill="#fff" />
          <path d={ANDROID_APP_QR.path} fill="#0f1a2e" />
        </svg>
      </a>
      <div className="text-center sm:text-left">
        <div className="cbif-in text-2xl font-extrabold sm:text-3xl">The app for <span className="text-amber-400">your crew.</span></div>
        <div className="mt-4 grid gap-2">
          {[['Android', 'Ready now: scan to install', true], ['App Store', 'Coming soon', false], ['Google Play', 'Coming soon', false]].map(([store, note, live], k) => (
            <div key={store as string} className={`cbif-in flex items-center justify-between gap-6 rounded-lg px-3 py-2 text-sm ${live ? 'bg-amber-500 font-bold text-slate-950' : 'border border-dashed border-white/25 text-slate-200'}`} style={{ animationDelay: `${0.6 + k * 0.35}s` }}>
              <span className="font-bold">{store}</span><span className={live ? '' : 'text-slate-400'}>{note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) },
  { key: 'go', visual: () => (
    <div className="text-center">
      <div className="cbif-in text-3xl font-extrabold sm:text-4xl">Have an invite code?</div>
      <div className="cbif-in mt-2 text-base text-slate-300" style={{ animationDelay: '.6s' }}>Enter it below. No code? <span className="font-semibold text-amber-300">Ask for one.</span></div>
      <div className="cbif-in mx-auto mt-5 h-10 w-10 animate-bounce text-amber-400" style={{ animationDelay: '1.1s' }} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
      </div>
    </div>
  ) },
]

// Public list of recorded tour lines (no sign-in), keyed by the line's text.
let clipList: Promise<Record<string, string>> | null = null
function publicClips(): Promise<Record<string, string>> {
  if (!clipList) {
    clipList = fetch(`${API_URL}/v1/portal/guided-tours/clips`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((j) => (j?.data ?? {}) as Record<string, string>)
      .catch(() => { clipList = null; return {} })
  }
  return clipList
}
async function clipFor(text: string): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text.trim()))
    const key = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
    return (await publicClips())[key] ?? null
  } catch {
    return null
  }
}

const readMs = (t: string) => Math.max(2600, t.split(/\s+/).length * 330)

export function BetaIntroFilm({ seats, onDone }: { seats: SeatProps; onDone: () => void }) {
  const [i, setI] = useState(0)
  // The film waits on its Play button: browsers won't play sound until the
  // visitor clicks, so the click is what starts it, voice and all.
  const [started, setStarted] = useState(false)
  const sound = started
  const [leaving, setLeaving] = useState(false)
  // Fades in over the page's canvas once it has mounted.
  const [shown, setShown] = useState(false)
  useEffect(() => { const f = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(f) }, [])
  const run = useRef(0)
  // Keep the phone's screen on while the film plays.
  useWakeLock(started && !leaving)

  const finish = useCallback(() => {
    run.current++
    stopLine()
    setLeaving(true)
    window.setTimeout(onDone, 800)
  }, [onDone])

  // Play scene i: wait for the voice (sound on) or a reading pause (captions only).
  useEffect(() => {
    if (!started) return
    const my = ++run.current
    let timer = 0
    const next = () => {
      if (my !== run.current) return
      if (i < SCENES.length - 1) setI(i + 1)
      else timer = window.setTimeout(finish, 1200)
    }
    const line = BETA_INTRO_LINES[i] ?? ''
    if (sound) {
      void clipFor(line).then((clipUrl) => {
        if (my !== run.current) return
        const began = Date.now()
        // If no voice could read it (no recording, no browser voice) it "ends"
        // at once; keep the scene up long enough to read the caption anyway.
        void speakLine({ text: line, clipUrl }).then((r) => { if (r === 'ended') timer = window.setTimeout(next, Math.max(450, readMs(line) - (Date.now() - began))) })
      })
    } else {
      timer = window.setTimeout(next, readMs(line) + (i === 0 ? 1200 : 0))
    }
    return () => { window.clearTimeout(timer) }
  }, [i, sound, started, finish])

  useEffect(() => () => { run.current++; stopLine() }, [])
  useEffect(() => { void publicClips() }, [])

  const play = () => { stopLine(); run.current++; setI(0); setStarted(true) }
  const Visual = SCENES[i].visual

  return (
    <div className={`absolute inset-0 z-20 flex items-center justify-center p-4 transition-opacity duration-700 ${leaving || !shown ? 'opacity-0' : 'opacity-100'}`} role="dialog" aria-modal="true" aria-label="CrewBarn beta intro">
      <style>{FILM_CSS}</style>
      <div className="absolute inset-0 bg-[#0B1120]/70 backdrop-blur-[2px]" aria-hidden="true" />
      <div className={`relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0f1a2e] text-white shadow-2xl transition-transform duration-700 ${leaving || !shown ? 'scale-95' : 'scale-100'}`}>
        <div className="cbif-stripes pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative flex items-center justify-between px-4 pt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-400">
          <span>CrewBarn · the beta</span>
          <div className="flex gap-2 normal-case tracking-normal">
            <button type="button" data-film-control onClick={finish} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10">Skip</button>
          </div>
        </div>
        <div className="relative flex aspect-[9/15] max-h-[calc(100svh-5rem)] items-center justify-center px-5 pb-40 pt-10 sm:aspect-video sm:max-h-none sm:px-6 sm:pb-20 sm:pt-0">
          <div key={`${SCENES[i].key}-${sound ? 's' : 'q'}`} className="cbif-scene flex w-full justify-center">
            <Visual seats={seats} />
          </div>
        </div>
        {!started && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0f1a2e] px-6 text-center">
            <svg viewBox="0 0 64 64" className="cbif-mark h-16 w-16 sm:h-20 sm:w-20" aria-hidden="true">
              <path className="cbif-roof" d="M51 27 L32 13 L13 27" />
              <path className="cbif-cee" d="M14 27 V38 q0 8 8 8 h20" />
            </svg>
            <div className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">The CrewBarn <span className="text-amber-400">beta</span></div>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">Free for life, limited seats, and the one rule. One minute, sound on.</p>
            <button type="button" onClick={play} autoFocus className="mt-6 inline-flex items-center gap-3 rounded-full bg-amber-500 py-3 pl-3 pr-6 text-base font-bold text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-amber-400" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
              </span>
              Play the intro
            </button>
            <button type="button" onClick={finish} className="mt-4 text-sm text-slate-400 underline hover:text-white">Skip it, I have a code</button>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-5 pt-10 text-center" aria-live="polite">
          <p className="mx-auto max-w-2xl text-sm font-semibold leading-snug sm:text-base">{BETA_INTRO_LINES[i]}</p>
          <div className="mx-auto mt-3 flex max-w-md gap-1" aria-hidden="true">
            {SCENES.map((s, k) => <span key={s.key} className={`h-1 flex-1 rounded-full ${k <= i ? 'bg-amber-400' : 'bg-white/15'}`} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

const FILM_CSS = `
.cbif-stripes{background:repeating-linear-gradient(90deg,transparent 0 46px,rgba(255,255,255,.03) 46px 48px)}
.cbif-scene{animation:cbif-fade .5s ease both}
@keyframes cbif-fade{from{opacity:0}to{opacity:1}}
.cbif-in{opacity:0;animation:cbif-up .55s cubic-bezier(.2,1.3,.4,1) forwards}
@keyframes cbif-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.cbif-slam{animation:cbif-slam .6s cubic-bezier(.2,1.4,.4,1) both}
@keyframes cbif-slam{from{opacity:0;transform:scale(1.4);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
.cbif-mark path{fill:none;stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:80;stroke-dashoffset:80}
.cbif-roof{stroke:#F59E0B;animation:cbif-draw .9s .2s cubic-bezier(.6,0,.2,1) forwards}
.cbif-cee{stroke:#fff;animation:cbif-draw 1s .9s cubic-bezier(.6,0,.2,1) forwards}
@keyframes cbif-draw{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion: reduce){.cbif-scene,.cbif-in,.cbif-slam,.cbif-roof,.cbif-cee{animation-duration:.01s!important;animation-delay:0s!important}}
`
