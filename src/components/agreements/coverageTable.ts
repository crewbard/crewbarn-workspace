/**
 * The service agreement coverage table: types, defaults, the payload the
 * API stores on the draft, and the section wording generated from it.
 *
 * The wording for "What is covered", "Visit schedule", "Price and payment"
 * and "Agreement term" is written from the table so the two always match;
 * the person can still edit the words afterwards.
 */

export type Rhythm = { mode: 'interval'; count: number; unit: 'week' | 'month' } | { mode: 'months'; months: number[] }

export interface CoverageRow {
  key: string
  asset_id: string | null
  request_asset_id: string | null
  name: string
  location_id: string
  /** One task per line. */
  tasks: string
  rhythm: Rhythm
  included: { parts: boolean; after_hours: boolean; emergency: boolean }
  extras_note: string
  /** Dollars as typed, e.g. "120" or "120.50". */
  price: string
}

export type PricingMode = 'per_item' | 'flat'
export type PricingPeriod = 'visit' | 'month' | 'quarter' | 'year'
export interface Pricing { mode: PricingMode; period: PricingPeriod; flat: string }
export interface Term { starts_on: string; ends_on: string; until_cancelled: boolean; notice_days: string }
export type OnSign = 'book' | 'suggest'

export interface CoverageState {
  rows: CoverageRow[]
  pricing: Pricing
  term: Term
  on_sign: OnSign
}

/** What the API stores on the draft (see AgreementCoverage.php). */
export interface CoveragePayload {
  items: {
    asset_id: string | null
    request_asset_id: string | null
    name: string
    location_id: string
    tasks: string
    rhythm: Rhythm
    included: CoverageRow['included']
    extras_note: string
    price_cents: number | null
  }[]
  pricing: { mode: PricingMode; period: PricingPeriod; flat_cents: number | null }
  term: { starts_on: string | null; ends_on: string | null; until_cancelled: boolean; notice_days: number | null }
  on_sign: OnSign
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const PERIOD_WORDS: Record<PricingPeriod, string> = { visit: 'per visit', month: 'per month', quarter: 'per quarter', year: 'per year' }
export const EXTRA_WORDS: Record<keyof CoverageRow['included'], string> = { parts: 'Parts', after_hours: 'After-hours visits', emergency: 'Emergency call-outs' }

export const DEFAULT_PRICING: Pricing = { mode: 'per_item', period: 'year', flat: '' }
export const DEFAULT_TERM: Term = { starts_on: '', ends_on: '', until_cancelled: false, notice_days: '30' }

export function rhythmFromCadence(cadence: string | null | undefined, fallback?: Rhythm | null): Rhythm {
  if (cadence === 'monthly') return { mode: 'interval', count: 1, unit: 'month' }
  if (cadence === 'quarterly') return { mode: 'interval', count: 3, unit: 'month' }
  if (cadence === 'annual') return { mode: 'interval', count: 12, unit: 'month' }
  return fallback ?? { mode: 'interval', count: 12, unit: 'month' }
}

export function rhythmWords(r: Rhythm): string {
  if (r.mode === 'months') return r.months.length ? `each ${listWords([...r.months].sort((a, b) => a - b).map((m) => MONTHS[m - 1]))}` : 'months to be agreed'
  if (r.unit === 'month' && r.count === 12) return 'once a year'
  if (r.unit === 'month' && r.count === 6) return 'twice a year'
  if (r.unit === 'month' && r.count === 3) return 'every 3 months'
  return r.count === 1 ? `every ${r.unit}` : `every ${r.count} ${r.unit}s`
}

export function toCents(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, '')
  if (!clean) return null
  const n = Number(clean)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

export function money(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export function centsToText(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2).replace(/\.00$/, '')
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function coveragePayload(state: CoverageState): CoveragePayload | null {
  if (!state.rows.length) return null
  return {
    items: state.rows.map((row) => ({
      asset_id: row.asset_id,
      request_asset_id: row.request_asset_id,
      name: row.name,
      location_id: row.location_id,
      tasks: row.tasks,
      rhythm: row.rhythm,
      included: row.included,
      extras_note: row.extras_note,
      price_cents: state.pricing.mode === 'per_item' ? toCents(row.price) : null,
    })),
    pricing: { mode: state.pricing.mode, period: state.pricing.period, flat_cents: state.pricing.mode === 'flat' ? toCents(state.pricing.flat) : null },
    term: {
      starts_on: state.term.starts_on || null,
      ends_on: state.term.until_cancelled ? null : state.term.ends_on || null,
      until_cancelled: state.term.until_cancelled,
      notice_days: state.term.notice_days.trim() ? Number(state.term.notice_days) : null,
    },
    on_sign: state.on_sign,
  }
}

/** Back from a saved draft's stored coverage into the editable table. */
export function coverageFromPayload(payload: CoveragePayload): Omit<CoverageState, 'rows'> & { rows: Omit<CoverageRow, 'key'>[] } {
  return {
    rows: payload.items.map((item) => ({ ...item, tasks: item.tasks ?? '', extras_note: item.extras_note ?? '', price: centsToText(item.price_cents) })),
    pricing: { mode: payload.pricing.mode, period: payload.pricing.period, flat: centsToText(payload.pricing.flat_cents) },
    term: {
      starts_on: payload.term.starts_on ?? '',
      ends_on: payload.term.ends_on ?? '',
      until_cancelled: payload.term.until_cancelled,
      notice_days: payload.term.notice_days === null ? '' : String(payload.term.notice_days),
    },
    on_sign: payload.on_sign,
  }
}

/** Problems that stop the table being saved, in plain words. */
export function coverageProblems(state: CoverageState): string[] {
  const out: string[] = []
  state.rows.forEach((row) => {
    if (row.rhythm.mode === 'months' && !row.rhythm.months.length) out.push(`Pick at least one month for ${row.name}.`)
    if (row.rhythm.mode === 'interval' && (!Number.isInteger(row.rhythm.count) || row.rhythm.count < 1 || row.rhythm.count > 52)) out.push(`Say how often ${row.name} is visited.`)
    if (state.pricing.mode === 'per_item' && row.price.trim() && toCents(row.price) === null) out.push(`The price for ${row.name} is not a number.`)
  })
  if (state.pricing.mode === 'flat' && state.pricing.flat.trim() && toCents(state.pricing.flat) === null) out.push('The price for everything is not a number.')
  if (!state.term.until_cancelled && state.term.starts_on && state.term.ends_on && state.term.ends_on < state.term.starts_on) out.push('The end date is before the start date.')
  if (state.term.notice_days.trim() && !/^\d{1,3}$/.test(state.term.notice_days.trim())) out.push('Notice must be a number of days.')
  return out
}

export type GeneratedKey = 'covered' | 'visits' | 'payment' | 'term'

/** The section wording, written from the table. */
export function coverageSections(state: CoverageState, placeName: (locationId: string) => string): Record<GeneratedKey, string> {
  const places = new Set(state.rows.map((row) => row.location_id))
  const where = (row: CoverageRow) => (places.size > 1 ? ` at ${placeName(row.location_id)}` : '')

  const covered = [
    places.size === 1 ? `This agreement covers the following equipment at ${placeName([...places][0])}:` : 'This agreement covers the following equipment:',
    ...state.rows.map((row) => {
      const tasks = row.tasks.split('\n').map((t) => t.trim()).filter(Boolean)
      const lines = [`- ${row.name}${where(row)}`]
      if (tasks.length) lines.push(`  Each visit: ${tasks.join('; ')}.`)
      const keys = Object.keys(EXTRA_WORDS) as (keyof CoverageRow['included'])[]
      const yes = keys.filter((k) => row.included[k]).map((k) => EXTRA_WORDS[k].toLowerCase())
      const no = keys.filter((k) => !row.included[k]).map((k) => EXTRA_WORDS[k].toLowerCase())
      if (yes.length) lines.push(`  Included: ${listWords(yes)}.`)
      if (no.length) lines.push(`  Charged as extra: ${listWords(no)}.`)
      if (row.extras_note.trim()) lines.push(`  ${row.extras_note.trim()}`)
      return lines.join('\n')
    }),
  ].join('\n')

  const visits = [
    ...state.rows.map((row) => `- ${row.name}${where(row)}: ${rhythmWords(row.rhythm)}.`),
    state.on_sign === 'book'
      ? 'Visits are booked on this schedule once the agreement is signed. We will confirm each date with you ahead of the visit.'
      : 'Once the agreement is signed, we will propose visit dates on this schedule and confirm each one with you before it is booked.',
  ].join('\n')

  const period = PERIOD_WORDS[state.pricing.period]
  let payment: string
  if (state.pricing.mode === 'flat') {
    const cents = toCents(state.pricing.flat)
    payment = cents === null ? `One price ${period} covers everything listed above: [enter the price].` : `One price of ${money(cents)} ${period} covers everything listed above.`
  } else {
    const priced = state.rows.map((row) => ({ row, cents: toCents(row.price) }))
    const lines = priced.map(({ row, cents }) => `- ${row.name}${where(row)}: ${cents === null ? '[enter the price]' : money(cents)} ${period}`)
    const total = priced.every((p) => p.cents !== null) ? priced.reduce((sum, p) => sum + (p.cents ?? 0), 0) : null
    payment = [...lines, total !== null && priced.length > 1 ? `Total: ${money(total)} ${period}.` : ''].filter(Boolean).join('\n')
  }
  payment += '\nWork, parts or visits not listed as included are quoted and charged separately.'

  const start = state.term.starts_on ? `starts on ${longDate(state.term.starts_on)}` : 'starts on the date it is signed'
  const notice = state.term.notice_days.trim() ? ` with ${state.term.notice_days.trim()} days' written notice` : ''
  const term = state.term.until_cancelled
    ? `This agreement ${start} and continues until either party cancels it${notice}.`
    : state.term.ends_on
      ? `This agreement ${start} and ends on ${longDate(state.term.ends_on)}.${notice ? ` Either party may cancel it early${notice}.` : ''}`
      : `This agreement ${start}. [Enter an end date, or choose "until cancelled".]`

  return { covered, visits, payment, term }
}
