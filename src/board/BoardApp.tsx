import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import {
  boardNonce,
  boardToken,
  fetchBoardConfig,
  fetchBoardData,
  pollPairing,
  startPairing,
  Unpaired,
  STAGE,
  boardGrid,
  boardStage,
  boardUnitPx,
  type BoardData,
  type Pairing,
} from '@/board/boardApi'
import { BOARD_WIDGETS, QuietDayHero, SIZE_SPAN } from '@/board/BoardWidgets'
import { BoardMoments } from '@/board/BoardMoments'
import { BoardHuddle } from '@/board/BoardHuddle'
import { BoardScene } from '@/board/BoardScene'
import { primeGoogleMapsKey } from '@/lib/googleMaps'
import { apiRequest } from '@/lib/api'
import '@/board/board.css'

/**
 * crewbarn.tv — the whole thing a television runs.
 *
 * Standalone on purpose. No AppLayout, no sidebar, no router, no signed-in
 * account: this is a screen on a wall that the entire office reads, not a
 * page somebody navigates. It shows a pairing code until somebody adopts
 * it, then it shows the shop.
 *
 * Two rules run through all of it. It never goes blank — a dark wall reads
 * as broken to everyone at once, so a failed refresh keeps the last good
 * data and says "Reconnecting". And it never shows a dead end: losing the
 * token is an ordinary event on a TV browser, so that puts the pairing
 * code back up rather than an error nobody is standing there to read.
 */

/** Where somebody goes to adopt this screen. */
const CLAIM_URL = import.meta.env.VITE_APP_URL || 'https://app.crewbarn.com'

const REFRESH_MS = 30_000

/**
 * Which board this is a preview of, if it is one.
 *
 * Read from the path rather than passed in, because the board renders
 * outside the router on purpose and adding one back for a single id
 * would be a lot of app to drag onto a television.
 */
function previewBoardId(): string | null {
  const m = window.location.pathname.match(/^\/tv\/preview\/([A-Za-z0-9_-]+)\/?$/)
  return m ? m[1] : null
}

/** How often the whole board nudges, so a static panel cannot burn in. */
const SHIFT_MS = 10 * 60_000

export function BoardApp() {
  /**
   * Whether this screen is paired, as state rather than a storage read.
   *
   * Reading localStorage inside an effect meant the refresh loop only ever
   * started if a token already existed when the page loaded — pair a fresh
   * screen and nothing re-ran, so it sat on "Loading the board" forever
   * with a perfectly good token in hand.
   */
  const preview = previewBoardId()
  const [hasToken, setHasToken] = useState(() => preview !== null || boardToken() !== '')
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [data, setData] = useState<BoardData | null>(null)
  const [stale, setStale] = useState(false)
  const [scene, setScene] = useState(0)
  const [shift, setShift] = useState(0)
  const timer = useRef<number | null>(null)
  const [fit, setFit] = useState(1)
  const [asking, setAsking] = useState(() => !document.fullscreenElement)
  // Signed and short-lived, refreshed on every config call.
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null)

  // ── pairing ───────────────────────────────────────────────────────────
  const beginPairing = useCallback(async () => {
    try {
      setPairing(await startPairing())
    } catch {
      // Even this failing must not blank the screen. Try again shortly.
      window.setTimeout(() => void beginPairing(), 5000)
    }
  }, [])

  useEffect(() => {
    if (hasToken || preview) return
    // A reload mid-pairing should not throw away a code somebody is
    // already reading off the wall.
    const existing = boardNonce()
    if (existing) {
      void pollPairing(existing).then((r) => {
        if (r.status === 'paired') setHasToken(true)
        else void beginPairing()
      })
      return
    }
    void beginPairing()
  }, [beginPairing, hasToken])

  useEffect(() => {
    if (!pairing || hasToken) return
    const id = window.setInterval(async () => {
      const r = await pollPairing(pairing.nonce)
      if (r.status === 'paired') {
        setPairing(null)
        setHasToken(true)
      } else if (r.status === 'expired') {
        void beginPairing()
      }
    }, Math.max(2, pairing.poll_seconds) * 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing, beginPairing, hasToken])

  // ── the board ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const next = preview
        ? (await apiRequest<{ data: BoardData }>(`/v1/boards/${preview}/preview`)).data
        : await fetchBoardData()
      setData(next)
      setStale(false)
    } catch (e) {
      if (e instanceof Unpaired) {
        setData(null)
        setHasToken(false)
        void beginPairing()
        return
      }
      // Keep whatever is on screen. Out of date and labelled beats blank.
      setStale(true)
    }
  }, [beginPairing, preview])

  useEffect(() => {
    if (!hasToken) return
    // The key comes with the config, because there is no session here for
    // the usual settings fetch to use.
    // A preview runs inside the app, which has already primed its own
    // Maps key, and has no device token to rotate.
    const syncConfig = () =>
      preview
        ? undefined
        : void fetchBoardConfig().then((c) => {
            primeGoogleMapsKey(c.mapsKey)
            setBackdropUrl(c.backdropUrl)
          })
    void load()
    syncConfig()
    timer.current = window.setInterval(() => {
      void load()
      syncConfig()
    }, REFRESH_MS)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [load, hasToken])

  const layout = data?.board.layout
  const scenes = layout?.scenes ?? []

  // Scene rotation, when it is switched on.
  useEffect(() => {
    const secs = layout?.behavior.scene_seconds ?? 0
    if (!secs || scenes.length < 2) return
    const id = window.setInterval(() => setScene((s) => (s + 1) % scenes.length), secs * 1000)
    return () => window.clearInterval(id)
  }, [layout?.behavior.scene_seconds, scenes.length, data?.todays_jobs?.total])

  // Burn-in. A few pixels every ten minutes is invisible to a person and
  // enough to stop an OLED ghosting a panel edge that never moves.
  useEffect(() => {
    const id = window.setInterval(() => setShift((s) => (s + 1) % 4), SHIFT_MS)
    return () => window.clearInterval(id)
  }, [])

  // Fit the stage to the window, whatever the window turns out to be.
  const stage = boardStage(data?.board.layout)
  useEffect(() => {
    const measure = () =>
      setFit(Math.min(window.innerWidth / stage.w, window.innerHeight / stage.h))
    measure()
    window.addEventListener('resize', measure)
    // A television that has just gone full screen is a resize the browser
    // does not always report as one.
    document.addEventListener('fullscreenchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      document.removeEventListener('fullscreenchange', measure)
    }
  }, [stage.w, stage.h])

  if (!hasToken) return <PairScreen pairing={pairing} />
  if (!data) return <Waiting stale={stale} />

  const grid = boardGrid(layout)

  // The server decides when it is huddle time — it is the only side that
  // knows when the first job starts and whether anybody is already out.
  const huddling = data.huddle != null && (layout?.moments?.huddle ?? true) !== false

  /*
   * After hours, in the tenant's own time.
   *
   * A stand-in until business hours are wired through: the point of it
   * here is to stop the board shouting at an empty building overnight,
   * and 7pm-to-6am is close enough for that while being obviously a
   * placeholder rather than pretending to know when a shop closes.
   */
  const localHour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: data.timezone }).format(
      new Date(),
    ),
  )
  const afterHours = localHour >= 19 || localHour < 6

  /*
   * Whatever they arranged, including on a quiet day.
   *
   * A built-in "nothing booked" layout used to take over here. It meant
   * the wall showed something the owner had never seen, could not edit
   * and had not asked for — and the quiet band above already says the
   * day is empty. Somebody who wants dormant jobs and approved estimates
   * on a slow morning can build exactly that board from the "Worth
   * chasing" template and let it take its turn.
   */
  const current = scenes[Math.min(scene, Math.max(0, scenes.length - 1))]

  return (
    <div className="tv-viewport" data-scene={layout?.look?.scene ?? 'none'}>
      {/*
       * Outside the stage, deliberately, and it was inside it once.
       *
       * The stage carries a transform, and a position:fixed child of a
       * transformed ancestor is positioned against that ancestor rather
       * than the window — so the canvas took the stage's 1920x1080 box
       * and then got scaled with it, which magnified the fireplace's
       * glow into an orange ellipse across the whole wall. Worse, a
       * positioned element paints above its non-positioned siblings
       * whatever the DOM order, so it covered the cards as well.
       *
       * Out here it measures the window it is actually filling, and the
       * stage below it paints on top because a later positioned sibling
       * wins.
       */}
      <BoardScene scene={layout?.look?.scene} url={backdropUrl} />
      <div
        className="tv-root"
        data-theme={layout?.look.theme ?? 'night'}
        data-text={layout?.look.text_size ?? 'large'}
        data-space={layout?.screen.extra_space ?? 'more-widgets'}
        style={{
          width: stage.w,
          height: stage.h,
          ['--u' as string]: `${boardUnitPx(layout)}px`,
          transform: `translate(-50%, -50%) scale(${fit})`,
        }}
      >
      {/* The burn-in nudge moves the content, never the stage — shifting
          the stage would shift the black bars with it. */}
      <div
        className="tv-shift"
        style={{ transform: `translate(${(shift % 2) * 2}px, ${Math.floor(shift / 2) * 2}px)` }}
      >
      <header className="tv-top">
        <span className="tv-brand">{data.company ?? 'CrewBarn'}</span>
        <span className={stale ? 'tv-live tv-live-off' : 'tv-live'}>
          <span className="tv-live-dot" />
          {stale ? 'Reconnecting…' : 'Live · crewbarn.tv'}
        </span>
        {scenes.length > 1 && (
          <span className="tv-scenes">
            {scenes.map((s, i) => (
              <span key={s.name} className={i === scene ? 'tv-scene tv-scene-on' : 'tv-scene'}>
                {s.name}
              </span>
            ))}
          </span>
        )}
        <span className="tv-clock">
          {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: data.timezone })}
        </span>
      </header>


      {/* An empty day announces itself rather than reading as 0 jobs. */}
      {!huddling && data.todays_jobs?.total === 0 && <QuietDayHero data={data} />}

      {huddling && <BoardHuddle data={data} />}

      {!huddling && (
      <main
        className="tv-grid"
        key={scene}
        data-transition={layout?.behavior?.transition ?? 'fade'}
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
          gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
        }}
      >
        {(current?.widgets ?? []).map((w, i) => {
          const def = BOARD_WIDGETS[w.type]
          // A widget this build does not know is skipped, not crashed on.
          if (!def) return null

          // Placed where it was put, or flowed by its old named size for
          // boards built before anybody could drag one.
          const span = SIZE_SPAN[w.size ?? 'medium'] ?? SIZE_SPAN.medium
          const placed = w.x != null && w.y != null

          /*
           * A card with nothing to say still holds its place.
           *
           * Dropping it made sense while cards flowed and the gap closed
           * behind them; on a grid it punches a hole in an arrangement
           * somebody made on purpose, and enough holes read as a broken
           * screen. An old flowed board still re-flows, because there
           * the gap does close.
           */
          if (!placed && def.hasContent && !def.hasContent(data)) return null
          const style = placed
            ? {
                gridColumn: `${w.x} / span ${Math.max(1, Math.min(w.w ?? span.cols, grid.cols))}`,
                gridRow: `${w.y} / span ${Math.max(1, Math.min(w.h ?? span.rows, grid.rows))}`,
              }
            : { gridColumn: `span ${span.cols}`, gridRow: `span ${span.rows}` }

          return (
            <div
              key={`${w.type}-${i}`}
              className="tv-cell"
              // How many rows tall, so the contents can be sized for the
              // card rather than for the stage.
              data-rows={placed ? Math.max(1, Math.min(w.h ?? span.rows, grid.rows)) : span.rows}
              style={style}
            >
              <def.Component data={data} widget={w} />
            </div>
          )
        })}
      </main>
      )}

      {/* Over the board, never instead of it.
          Held back after hours, not on a quiet day — a day with nothing
          booked is exactly when a finished job is worth announcing. The
          two were conflated here and it silenced the board all morning. */}
      <BoardMoments layout={layout} quiet={afterHours || asking || huddling} timezone={data.timezone} />

      <FullScreenNudge onChange={setAsking} />

      <footer className="tv-foot">
        <span>{data.board.label}</span>
        <span>
          as of{' '}
          {new Date(data.as_of).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: data.timezone,
          })}
        </span>
      </footer>
      </div>
      </div>
    </div>
  )
}

/**
 * Ask once for the whole screen.
 *
 * A browser bar across the top of a wall display is a sixth of the
 * television spent on controls nobody will ever click, and it is the
 * thing that makes a board look like somebody's laptop rather than a
 * fixture. Most TV browsers full-screen on the remote's OK button, and
 * every desktop one does it on F11.
 *
 * It asks once and gets out of the way: dismissed on any key or click,
 * gone by itself after twenty seconds, and never shown again on this
 * screen once somebody has taken it. A prompt that keeps reappearing on
 * a wall is worse than the bar it is complaining about.
 */
function FullScreenNudge({ onChange }: { onChange: (asking: boolean) => void }) {
  const [show, setShow] = useState(() => !document.fullscreenElement)

  // The board holds its moments back while this is up. Two overlays
  // stacked is a glitch, and the celebration would play out of sight
  // behind the card and be gone by the time anybody dismissed it.
  useEffect(() => onChange(show), [show, onChange])

  // Asked again only if full screen is lost — somebody hitting Escape
  // months later should be told how to get it back, and somebody who is
  // already full screen should never see this at all.
  useEffect(() => {
    const onChange = () => setShow(!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!show) return
    const dismiss = () => {
      // The press that dismisses this is the gesture browsers require, so
      // it is also the one chance to take full screen without anybody
      // hunting for F11. A remote's OK button counts as a key press.
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.().catch(() => {
          /* refused, or unsupported on this TV browser — the words stand */
        })
      }
      setShow(false)
    }
    const t = window.setTimeout(dismiss, 20_000)
    window.addEventListener('keydown', dismiss)
    window.addEventListener('pointerdown', dismiss)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', dismiss)
      window.removeEventListener('pointerdown', dismiss)
    }
  }, [show])

  if (!show) return null

  return (
    <div className="tv-nudge-wrap">
      <div className="tv-nudge">
        <span className="tv-nudge-key">OK</span>
        <span className="tv-nudge-words">
          <span className="tv-nudge-eyebrow">Make it full screen</span>
          <span className="tv-nudge-title">Press OK on your remote</span>
          <span className="tv-nudge-body">
            The browser bar goes away and the board fills the whole TV. On a keyboard, press F11.
          </span>
          <span className="tv-nudge-note">This hides itself in 20 seconds.</span>
        </span>
      </div>
    </div>
  )
}

/** The first thing a new television shows. */
function PairScreen({ pairing }: { pairing: Pairing | null }) {
  const claim = pairing ? `${CLAIM_URL}/tool-shed/shop-tv?code=${encodeURIComponent(pairing.code)}` : CLAIM_URL

  return (
    <div className="tv-root tv-pair" data-theme="night" data-text="large">
      <h1 className="tv-pair-title">Put this screen on the wall</h1>
      <p className="tv-pair-step">
        On a phone or computer, open <b>CrewBarn → Tool Shed → Shop TV</b> and enter this code.
      </p>

      <div className="tv-pair-code">{pairing ? pairing.code : '······'}</div>

      {pairing && (
        <div className="tv-pair-qr">
          <QRCodeSVG value={claim} size={220} level="M" includeMargin />
          <p className="tv-pair-scan">or scan this</p>
        </div>
      )}

      <p className="tv-pair-note">
        The code changes every ten minutes. Nothing is typed on the television.
      </p>
    </div>
  )
}

/**
 * Waiting, and saying so honestly.
 *
 * This used to be a dead end: if the very first fetch failed, data stayed
 * null and the screen read "Loading the board" for ever, with a retry
 * running every thirty seconds that nothing on the wall acknowledged. A
 * board that is retrying should look like it is retrying.
 *
 * It also needs the stage around it, or it draws unstyled on a white page
 * — which is precisely how it appeared on the shop wall.
 */
function Waiting({ stale }: { stale: boolean }) {
  return (
    <div className="tv-viewport">
      <div
        className="tv-root tv-pair"
        data-theme="night"
        data-text="large"
        style={{ width: STAGE.w, height: STAGE.h, transform: 'translate(-50%, -50%) scale(var(--fit, 1))' }}
      >
        <p className="tv-pair-step">
          {stale ? 'Cannot reach CrewBarn. Trying again…' : 'Loading the board…'}
        </p>
      </div>
    </div>
  )
}
