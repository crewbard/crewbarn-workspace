import { API_URL } from '@/lib/api'

/**
 * The television's own end of the wire.
 *
 * Deliberately separate from lib/api: that one carries a signed-in
 * person's token, an acting-tenant header and a redirect-to-login on 401.
 * None of those belong here. There is nobody to send to a login screen —
 * a board that hits 401 should put its pairing code back up and carry on,
 * because the only person who could fix it is not standing in front of it.
 */

const TOKEN_KEY = 'crewbarn.board.token'
const NONCE_KEY = 'crewbarn.board.nonce'

/**
 * Storage on a TV browser is not reliable — some clear it when the app
 * closes, some when memory runs short. Losing the token is a normal
 * event here, not an error, so every read is guarded and the board
 * treats "no token" as "show the code again".
 */
function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* see above — never throw on the way to drawing a screen */
  }
}

export const boardToken = () => read(TOKEN_KEY)
export const setBoardToken = (t: string | null) => write(TOKEN_KEY, t)
export const boardNonce = () => read(NONCE_KEY)
export const setBoardNonce = (n: string | null) => write(NONCE_KEY, n)

export function forgetBoard(): void {
  write(TOKEN_KEY, null)
  write(NONCE_KEY, null)
}

export interface Pairing {
  code: string
  nonce: string
  expires_at: string
  poll_seconds: number
}

export interface BoardWidget {
  type: string
  /** The old named size. Kept so boards built before free placement still draw. */
  size?: 'small' | 'medium' | 'wide' | 'tall' | 'big'
  /** Grid placement, 1-based. When absent the widget flows by its size. */
  x?: number
  y?: number
  w?: number
  h?: number
  options?: Record<string, unknown>
  accent?: string
}

/** Columns and rows available on a screen, from docs/CREWBARN-TV.md. */
export function boardGrid(layout: BoardLayout | undefined): { cols: number; rows: number } {
  const big = (layout?.screen?.resolution ?? '1080p') !== '1080p'
    && (layout?.screen?.extra_space ?? 'more-widgets') === 'more-widgets'

  return big ? { cols: 16, rows: 8 } : { cols: 12, rows: 6 }
}

export interface BoardScene {
  name: string
  widgets: BoardWidget[]
}

export interface BoardLayout {
  scenes: BoardScene[]
  look: {
    theme: 'night' | 'daylight' | 'high-contrast'
    text_size: 'normal' | 'large' | 'huge'
    /** Something to look at behind the cards. Painted, not filmed. */
    scene?: 'none' | 'snow' | 'rain' | 'fire' | 'ocean' | 'forest' | 'own' | 'library'
    /** Storage path of the shop's own loop. Never a URL — see backdrop_url. */
    backdrop?: string | null
    /** Which shipped backdrop, when scene is 'library'. An id, not a path. */
    backdrop_id?: string | null
  }
  screen: {
    resolution: '1080p' | '2k' | '4k'
    extra_space: 'more-widgets' | 'bigger-text'
    /** Diagonal inches. What somebody actually knows about their TV. */
    size_inches?: number
  }
  /** Which interruptions are welcome. Missing means on. */
  moments?: Partial<Record<'done' | 'new' | 'paid' | 'review' | 'huddle', boolean>>
  behavior: {
    scene_seconds: number
    hide_money: boolean
    dim_after_7pm: boolean
    big_alert_new_job: boolean
    /** How one board gives way to the next. */
    transition?: 'fade' | 'slide' | 'none'
    /** How long a page of a too-long list holds before the next. 0 = never. */
    list_scroll_seconds?: number
  }
}

/** Where the shop is, so the map has somewhere to be with no dots on it. */
export interface BoardHome {
  lat: number
  lng: number
}

export interface BoardData {
  as_of: string
  timezone: string
  company: string | null
  board: { id: string; label: string; layout: BoardLayout }
  todays_jobs: { total: number; done: number; going_now: number; still_to_go: number } | null
  up_next: Array<{ at: string | null; customer: string | null; title: string | null; tech: string | null }>
  crew: Array<{
    id: string
    name: string | null
    jobs_today: number
    done_today: number
    current: { customer: string | null; title: string | null; status: string | null; at: string | null } | null
  }>
  locations: Array<{
    id: string
    name: string | null
    lat: number
    lng: number
    speed_mph: number | null
    recorded_at: string | null
    age_minutes: number | null
  }>
  jobs_this_week: Array<{ date: string; label: string; count: number; today: boolean }>
  needs_a_hand: {
    overdue_invoices: { count: number; cents: number | null }
    stale_jobs: Array<{ customer: string | null; title: string | null; days: number }>
  } | null
  money: { collected_today_cents: number; outstanding_cents: number } | null
  dormant_jobs: Array<{
    customer: string | null
    title: string | null
    tech: string | null
    status: string | null
    days: number
  }>
  estimates: {
    approved: number
    waiting: number
    approved_cents: number | null
    top?: Array<{ customer: string | null; cents: number | null }>
  } | null
  parts: { needs_parts: number; parts_ordered: number } | null
  /** The sky, all day. Same source the morning huddle reads. */
  weather?: {
    hours: Array<{ at: string | null; temp: number | null; unit?: string; short?: string | null; rain: number | null }>
    warning: string | null
  } | null
  /**
   * Today as lanes and blocks. Minutes from midnight in the shop's own
   * zone, so the screen never does timezone arithmetic.
   */
  timeline?: {
    from: number
    to: number
    now: number
    lanes: Array<{
      tech: string | null
      tech_id: string | null
      jobs: Array<{
        customer: string | null
        title: string | null
        start: number | null
        end: number | null
        status: string | null
        done: boolean
        going: boolean
      }>
    }>
  } | null
  /** Stalled work, one entry per lead tech, worst first. */
  dormant_by_tech?: Array<{
    tech: string | null
    tech_id: string | null
    count: number
    oldest_days: number
    jobs: Array<{ customer: string | null; days: number }>
  }>
  /** Open tasks, one entry per assignee, most overdue first. */
  tasks_by_tech?: Array<{
    tech: string | null
    tech_id: string | null
    count: number
    overdue: number
    tasks: Array<{
      title: string | null
      due_at: string | null
      overdue: boolean
      priority: string | null
    }>
  }>
  home?: BoardHome | null
  huddle: {
    crew: Array<{
      id: string
      name: string | null
      jobs: number
      first_at: string | null
      first_customer: string | null
    }>
    weather: {
      hours: Array<{ at: string | null; temp: number | null; unit: string; short: string | null; rain: number | null }>
      warning: string | null
    }
    tip: { key: string; text: string }
  } | null
}

/**
 * One fixed stage, scaled to whatever window it lands in.
 *
 * Sizing from the declared resolution and screen inches was arithmetic on
 * the wrong number. A TV browser's real CSS viewport is not its
 * resolution — browser zoom, device pixel ratio and the browser's own
 * bars all move it — so the board was laid out for a screen that was not
 * there, which is why it came out huge on one television and left half
 * the other empty.
 *
 * The board is now drawn at a fixed size and the whole thing is scaled to
 * fit. Zoom, panel size and resolution stop mattering: every element is
 * always the same share of the screen, and the leftover is a black bar.
 */
export const STAGE = { w: 1920, h: 1080 }

export const STAGE_WIDE = { w: 2560, h: 1440 }

export function boardStage(layout: BoardLayout | undefined): { w: number; h: number } {
  const wide =
    (layout?.screen?.resolution ?? '1080p') !== '1080p' &&
    (layout?.screen?.extra_space ?? 'more-widgets') === 'more-widgets'

  return wide ? STAGE_WIDE : STAGE
}

/** The unit, inside the stage. A plain number now, not a density sum. */
const BASE_UNIT: Record<string, number> = { normal: 18, large: 20, huge: 24 }

export function boardUnitPx(layout: BoardLayout | undefined): number {
  return BASE_UNIT[layout?.look?.text_size ?? 'large'] ?? 20
}

/** Something worth interrupting the wall for. */
export interface BoardEvent {
  id: string
  type: 'done' | 'new' | 'paid' | 'review'
  at: string
  tech?: string | null
  tech_id?: string | null
  customer?: string | null
  title?: string | null
  minutes?: number | null
  at_time?: string | null
  cents?: number | null
  reviewer?: string | null
  source?: string | null
  text?: string | null
}

/** Thrown when the screen is not (or no longer) paired. */
export class Unpaired extends Error {}

async function boardFetch<T>(path: string): Promise<T> {
  const token = boardToken()
  if (!token) throw new Unpaired('no token')

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })

  if (res.status === 401 || res.status === 403) {
    forgetBoard()
    throw new Unpaired('rejected')
  }
  if (!res.ok) throw new Error(`board request failed (${res.status})`)

  return (await res.json()) as T
}

/** Ask for a code to put on the screen. */
export async function startPairing(): Promise<Pairing> {
  const res = await fetch(`${API_URL}/v1/board/hello`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('could not get a pairing code')
  const { data } = (await res.json()) as { data: Pairing }
  setBoardNonce(data.nonce)
  return data
}

/** Has anybody claimed us yet? */
export async function pollPairing(
  nonce: string,
): Promise<{ status: 'pending' | 'expired' | 'paired'; token?: string }> {
  const res = await fetch(`${API_URL}/v1/board/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ nonce }),
  })
  if (!res.ok) return { status: 'pending' }
  const { data } = (await res.json()) as { data: { status: 'pending' | 'expired' | 'paired'; token?: string } }
  if (data.status === 'paired' && data.token) {
    setBoardToken(data.token)
    setBoardNonce(null)
  }
  return data
}

/**
 * Everything on the wall.
 *
 * A rotated token arrives on the ordinary config call, so the screen
 * never has to go and fetch a credential — it just quietly starts using
 * the new one.
 */
export async function fetchBoardData(): Promise<BoardData> {
  const { data } = await boardFetch<{ data: BoardData }>('/v1/board/data')
  return data
}

/**
 * What has happened since the screen last looked.
 *
 * `since` is echoed back by the server rather than kept by the browser,
 * so a television with a wandering clock cannot miss events or replay
 * them — several TV browsers have a clock that is minutes out.
 */
export async function boardFetchEvents(
  since: string | null,
): Promise<{ events: BoardEvent[]; now: string }> {
  const q = since ? `?since=${encodeURIComponent(since)}` : ''
  const { data } = await boardFetch<{ data: { events: BoardEvent[]; now: string } }>(
    `/v1/board/events${q}`,
  )
  return data
}

/**
 * What this screen actually is.
 *
 * Multiplied by the pixel ratio because a 4K television running its
 * browser at 1080p reports 1920 with a ratio of 2, and the panel is what
 * we are asking about. Sent on the config call rather than at pairing:
 * the same wall gets a new stick often enough, and a fact recorded once
 * at setup is a fact that goes quietly wrong.
 */
function thisScreen(): string {
  const dpr = window.devicePixelRatio || 1
  const w = Math.round((window.screen?.width ?? window.innerWidth) * dpr)
  const h = Math.round((window.screen?.height ?? window.innerHeight) * dpr)
  return `?w=${w}&h=${h}&dpr=${dpr.toFixed(2)}`
}

export async function fetchBoardConfig(): Promise<{
  mapsKey: string | null
  backdropUrl: string | null
}> {
  const { data } = await boardFetch<{
    data: {
      new_token?: string
      board?: { maps_key?: string | null; backdrop_url?: string | null }
    }
  }>(`/v1/board/config${thisScreen()}`)
  if (data.new_token) setBoardToken(data.new_token)
  return {
    mapsKey: data.board?.maps_key ?? null,
    // Signed and short-lived, re-minted every time we ask — which is
    // every thirty seconds, so it never expires under a running board.
    backdropUrl: data.board?.backdrop_url ?? null,
  }
}
