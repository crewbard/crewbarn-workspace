import { useEffect, useRef, useState } from 'react'

/**
 * The two auth-page hero animations.
 *
 * Both replace SignupShowcase, which ran three animation systems side by side —
 * a one-shot detonation, 184 infinitely-animating DOM nodes and a canvas rocket
 * loop — forever, next to a form someone is trying to fill in. These play once
 * in about three seconds and then rest.
 *
 * The mark is the "wide stance" gable C: a broad amber gable over a white
 * wall-and-floor stroke. Two paths, nothing else.
 */

const GABLE = 'M51 27 L32 13 L13 27'
const WALL = 'M14 27 V38 q0 8 8 8 h20'

/** Keyframes both intros use. Scoped by the cb- prefix. */
const KEYFRAMES = `
@keyframes cbDraw { from { stroke-dashoffset: var(--dash, 60) } to { stroke-dashoffset: 0 } }
@keyframes cbWipe { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
@keyframes cbUp   { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes cbPop  { 0% { opacity: 0; transform: scale(.35) } 62% { opacity: 1 } 100% { opacity: 1; transform: scale(1) } }
@keyframes cbBlink{ 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
@keyframes cbFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes cbSky  { from { opacity: 0 } to { opacity: 1 } }
@keyframes cbSun  { from { opacity: 0; transform: translate(-50%, 58%) } to { opacity: 1; transform: translate(-50%, -4%) } }
@keyframes cbStar { from { opacity: 0 } to { opacity: 1 } }
@media (prefers-reduced-motion: reduce) {
  .cb-anim, .cb-anim * { animation: none !important }
}
`

function Keyframes() {
  return <style>{KEYFRAMES}</style>
}

function Wordmark({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        color: '#F8FAFC',
        ...style,
      }}
    >
      Crew<span style={{ color: '#F59E0B' }}>Barn</span>
    </div>
  )
}

/* ────────────────────────────  SIGN-UP · Blueprint  ─────────────────────── */

/** Trades and features alternate, which is what sells "every trade, one
 *  platform" — a list of only trades reads as a directory. */
const POOL = [
  'Jobs & dispatch', 'Locksmith', 'Estimates', 'HVAC',
  'Invoicing', 'Electrician', 'Field app', 'Plumbing',
  'Custom portal', 'Roofing', 'Marketplace', 'Appliance repair',
  'Own your data', 'Garage door', 'BYO API keys', 'Painting',
  'CBI assistant', 'Flooring', 'Scheduling', 'Carpentry',
  'Tap to pay', 'Drywall', 'Cash drawer', 'Windows & doors',
  'Accounting', 'Landscaping', 'Payroll', 'Tree service',
  'Inventory & QR', 'Pool & spa', 'Sub payouts', 'Pest control',
  'Reporting', 'Cleaning', 'Time tracking', 'Handyman',
  'Photo & video proof', 'Concrete & masonry', 'E-signatures', 'Septic',
  'Two-way texting', 'Security', 'Call recording', 'Fire safety',
  'Live tech GPS', 'IT & networking', 'Franchise mode', 'General contractor',
]

/** Four fixed pillars. These were four independent tickers in an earlier pass;
 *  four things moving at once reads as stress, so only the line under the
 *  wordmark moves now and the eye has one place to rest. */
const CALLOUTS = [
  { x: '6%', y: '17%', flip: false, delay: 2.15, label: 'Jobs & dispatch' },
  { x: '58%', y: '27%', flip: true, delay: 2.3, label: 'Estimates & invoicing' },
  { x: '6%', y: '74%', flip: false, delay: 2.45, label: 'Field app · photo & video proof' },
  { x: '60%', y: '82%', flip: true, delay: 2.6, label: 'Accounting & payroll' },
]

const RATE = 4   // frames per character
const HOLD = 26  // frames a finished word holds

function useTypedWord() {
  const [frame, setFrame] = useState(0)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const id = window.setInterval(() => setFrame((f) => f + 1), reduced.current ? 400 : 60)
    return () => window.clearInterval(id)
  }, [])

  const word = (step: number) => POOL[((step % POOL.length) + POOL.length) % POOL.length]
  if (reduced.current) return { text: word(Math.floor(frame / 6)), typing: false }

  // Each word gets its own span, so lengths differ naturally instead of every
  // word occupying an identical slot.
  let step = 0
  let cursor = frame
  for (let guard = 0; guard < 500; guard++) {
    const span = word(step).length * RATE + HOLD
    if (cursor < span) break
    cursor -= span
    step += 1
  }
  const w = word(step)
  const chars = Math.min(w.length, Math.floor(cursor / RATE))
  return { text: w.slice(0, chars), typing: chars < w.length }
}

/** Sign-up hero: the mark draws itself on a drafting grid, the wordmark wipes
 *  on, then a single line cycles what the platform covers. */
export function AuthIntroBlueprint() {
  const { text, typing } = useTypedWord()

  return (
    <div className="cb-anim" style={{ position: 'absolute', inset: 0, background: '#0B1120', overflow: 'hidden' }}>
      <Keyframes />
      <div style={{ position: 'absolute', inset: 0, animation: 'cbFade .6s ease-out both' }}>
        {/* Drafting grid + a warm pool of light behind the mark */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage:
              'linear-gradient(rgba(148,163,184,.10) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(148,163,184,.10) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 42%, rgba(245,158,11,.13), transparent 62%)' }} />

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <svg viewBox="0 0 64 64" width={150} height={150} style={{ overflow: 'visible' }}>
            <path
              d={WALL} fill="none" stroke="#F8FAFC" strokeWidth={7}
              strokeLinecap="round" strokeLinejoin="round" strokeDasharray={46}
              style={{ ['--dash' as string]: 46, strokeDashoffset: 46, animation: 'cbDraw .85s ease-out .35s both' }}
            />
            <path
              d={GABLE} fill="none" stroke="#F59E0B" strokeWidth={7}
              strokeLinecap="round" strokeLinejoin="round" strokeDasharray={50}
              style={{ ['--dash' as string]: 50, strokeDashoffset: 50, animation: 'cbDraw .8s ease-out 1.1s both' }}
            />
          </svg>

          <Wordmark size={62} style={{ marginTop: 10, animation: 'cbWipe .9s cubic-bezier(.6,0,.3,1) 1.75s both' }} />
          <div style={{ marginTop: 12, fontSize: 18, fontWeight: 500, letterSpacing: '.03em', color: '#94A3B8', animation: 'cbUp .7s ease-out 2.55s both' }}>
            Every trade. One platform.
          </div>

          <div style={{ marginTop: 22, minHeight: 30, display: 'flex', alignItems: 'center', animation: 'cbUp .7s ease-out 3.1s both' }}>
            <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.01em', color: '#F8FAFC', display: 'inline-flex', alignItems: 'baseline' }}>
              {text}
              <span
                style={{
                  display: 'inline-block', width: 2, height: 22, marginLeft: 3,
                  background: '#F59E0B', opacity: typing ? 1 : .85,
                  animation: 'cbBlink .9s step-end infinite',
                }}
              />
            </span>
          </div>
        </div>

        {CALLOUTS.map((c) => (
          <div
            key={c.label}
            style={{
              position: 'absolute', left: c.x, top: c.y,
              display: 'flex', alignItems: 'center', gap: 8,
              flexDirection: c.flip ? 'row-reverse' : 'row',
              animation: `cbUp .6s ease-out ${c.delay}s both`,
            }}
          >
            <span style={{ display: 'block', width: 54, height: 1, background: 'rgba(245,158,11,.6)', flex: 'none' }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(226,232,240,.85)', whiteSpace: 'nowrap' }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────  LOGIN · First light  ────────────────────── */

/** Fixed field, not random: a scatter that re-rolls on every replay reads as
 *  noise rather than as a sky. [x%, y%, radius, base alpha] */
const STARS: Array<[number, number, number, number]> = [
  [7,9,1.6,.85],[14,21,1.1,.6],[21,6,1.9,.95],[27,17,1.2,.7],[33,29,1.5,.8],
  [39,11,1,.55],[46,24,1.7,.9],[52,7,1.2,.65],[58,19,1.4,.75],[64,13,1,.5],
  [71,27,1.8,.9],[77,9,1.3,.7],[83,22,1.1,.6],[89,15,1.6,.85],[95,31,1.2,.65],
  [4,34,1.3,.7],[11,44,1,.5],[18,38,1.5,.8],[25,50,1.1,.55],[31,41,1.7,.85],
  [37,55,1.2,.6],[44,36,1.4,.75],[50,48,1,.5],[56,42,1.6,.8],[62,57,1.1,.55],
  [68,39,1.3,.7],[74,52,1.5,.75],[80,44,1,.5],[86,58,1.4,.7],[92,47,1.2,.6],
  [9,63,1.1,.45],[23,68,1.3,.55],[35,72,1,.4],[47,65,1.2,.5],[59,71,1,.4],
  [73,67,1.3,.5],[87,74,1.1,.45],[16,13,1.2,.65],[43,16,1.1,.6],[67,22,1.2,.6],
  [79,33,1.4,.7],[97,20,1.1,.55],[2,52,1.2,.55],[54,28,1,.5],[30,10,1.3,.7],
  [65,48,1.1,.5],
]

/** Login hero: night lifts, the sun comes up behind the barn, and the mark
 *  arrives with the light. Replays when the tab is returned to, so a page left
 *  open overnight still greets whoever comes back to it. */
export function AuthIntroFirstLight() {
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) return
      setPlaying(false)
      window.setTimeout(() => setPlaying(true), 70)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // The sun sits at 50%/73% of the pane; in the star band's own coordinates
  // (top 62%) that centre is just below at (50, 118). Stars near it wash out,
  // exactly as they do at real dawn.
  const SUN_X = 50, SUN_Y = 118, NEAR = 35, FAR = 105

  return (
    <div className="cb-anim" style={{ position: 'absolute', inset: 0, background: '#070C18', overflow: 'hidden' }}>
      <Keyframes />
      {playing && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#0B1120 0%,#2A2140 46%,#7A4A18 78%,#C97A1E 100%)', animation: 'cbSky 2.2s ease-out .2s both' }} />

          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '62%', overflow: 'hidden' }}>
            {STARS.map(([x, y, r, a], i) => {
              const d = Math.hypot(x - SUN_X, y - SUN_Y)
              const t = Math.min(1, Math.max(0, (d - NEAR) / (FAR - NEAR)))
              const alpha = +(a * (0.12 + 0.88 * t)).toFixed(3)
              return (
                <span
                  key={i}
                  style={{
                    position: 'absolute', left: `${x}%`, top: `${y}%`,
                    width: r, height: r, borderRadius: '50%',
                    background: `rgba(248,250,252,${alpha})`,
                    boxShadow: r > 1.4 && t > 0.55 ? `0 0 3px rgba(248,250,252,${(alpha * 0.7).toFixed(2)})` : 'none',
                    animation: 'cbStar 1.4s ease-out .3s both',
                  }}
                />
              )
            })}
          </div>

          <span style={{ position: 'absolute', left: '50%', bottom: '27%', width: '34%', paddingBottom: '34%', borderRadius: '50%', background: 'radial-gradient(circle,#FDE9C8 12%,#F59E0B 42%,rgba(245,158,11,0) 72%)', animation: 'cbSun 2.4s cubic-bezier(.3,.7,.3,1) .5s both' }} />

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%', background: '#060A12' }} />

          {/* Far ridge — the neighbourhood the crews service, flat and small so
              it reads as distance behind the barn. */}
          <svg viewBox="0 0 400 70" width="100%" height={70} preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: '30%', opacity: .55 }}>
            <path d="M0 70V54l18-13 18 13v6h14V46l16-11 16 11v7h10V50l20-14 20 14v4h12V44l17-12 17 12v10h13V48l19-13 19 13v8h11V45l18-13 18 13v9h12V52l16-11 16 11v18z" fill="#0A0F1C" />
          </svg>
          <svg viewBox="0 0 400 96" width="100%" height={96} preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: '26.5%' }}>
            <path d="M0 96V70l26-19 26 19v26z" fill="#070B14" />
            <path d="M58 96V62l30-22 30 22v34z" fill="#080D17" />
            <path d="M124 96V74l22-16 22 16v22z" fill="#070B14" />
            <path d="M232 96V66l28-20 28 20v30z" fill="#080D17" />
            <path d="M294 96V78l20-15 20 15v18z" fill="#070B14" />
            <path d="M340 96V70l26-19 26 19v26z" fill="#080D17" />
          </svg>
          {/* The barn itself — nearest, darkest, with the gable on the right. */}
          <svg viewBox="0 0 400 120" width="100%" height={120} preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: '26%' }}>
            <path d="M0 120h96l58-46 58 46h188v10H0z" fill="#060A12" />
            <path d="M262 120V60l38-28 38 28v60z" fill="#060A12" />
          </svg>

          <div style={{ position: 'absolute', left: 0, right: 0, top: '16%', textAlign: 'center', padding: '0 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', animation: 'cbPop .8s cubic-bezier(.2,1.4,.4,1) 1.45s both' }}>
              <svg viewBox="0 0 64 64" width={84} height={84}>
                <path d={WALL} fill="none" stroke="#F8FAFC" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
                <path d={GABLE} fill="none" stroke="#F59E0B" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <Wordmark size={62} style={{ marginTop: 8, textShadow: '0 6px 34px rgba(0,0,0,.6)', animation: 'cbUp 1s ease-out 1.7s both' }} />
            <div style={{ marginTop: 12, fontSize: 19, fontWeight: 500, letterSpacing: '.02em', color: '#E2E8F0', animation: 'cbUp .9s ease-out 2.3s both' }}>
              Every trade. One platform.
            </div>
          </div>

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 30, textAlign: 'center', fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'rgba(226,232,240,.6)', animation: 'cbUp .8s ease-out 2.8s both' }}>
            The day starts at the barn
          </div>
        </>
      )}
    </div>
  )
}
