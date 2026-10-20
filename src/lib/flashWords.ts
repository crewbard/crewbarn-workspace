import { apiRequest } from '@/lib/api'

/**
 * Flash words: the shop's part numbers, found wherever somebody writes or
 * says them. The server holds the dictionary (reference card part numbers
 * and other names, item SKUs, suppliers' codes) and does the matching; this
 * asks, and loads the flash card for a part.
 *
 * Asked for per text and sent in batches, the same way text references are:
 * a thread of a hundred bubbles is one request, not a hundred.
 */

/** What a piece of text is. A transcript has spoken numbers read as digits. */
export type FlashSource = 'transcript' | 'intake' | 'message' | 'note' | 'estimate' | 'job' | 'other'

export type FlashMatch = {
  /** UTF-16 offsets into the text, like a JavaScript string index. */
  start: number
  end: number
  text: string
  /** The folded part number: "sc1". */
  term: string
  label: string
  card_id: string | null
  item_id: string | null
  kind: string | null
}

/** A part-like word that matched nothing: what "Make a card" is offered for. */
export type FlashCandidate = { start: number; end: number; text: string; term: string }

export type FlashScan = { matches: FlashMatch[]; candidates: FlashCandidate[] }

const NOTHING: FlashScan = { matches: [], candidates: [] }

export type FlashStockLocation = { id: string; name: string; on_hand: number; available: number; van: boolean }

export type FlashStock = {
  on_hand: number
  available: number
  on_order: number
  locations: FlashStockLocation[]
}

export type FlashSeller = {
  id: string
  vendor: string | null
  vendor_sku: string | null
  part_number: string | null
  last_cost_cents: number | null
  list_price_cents: number | null
  lead_time_days: number | null
  preferred: boolean
}

export type FlashCard = {
  part: {
    card_id: string | null
    item_id: string | null
    title: string
    item_name: string | null
    part_numbers: string[]
    aliases: string[]
    sku: string | null
    supplier_sku: string | null
    unit_label: string | null
    has_picture: boolean
    image_url: string | null
  }
  stock: FlashStock | null
  on_order: {
    orders: { id: string; po_number: string | null; status: string; expected: string | null; vendor: string | null; qty: number }[]
    asks: { count: number; qty: number }
  }
  catalogs: { id: string; document_id: string; title: string; vendor: string | null; page: number | null; page_label: string | null }[]
  sellers: FlashSeller[]
  price: { sell_cents: number | null; cost_cents: number | null; list_cents: number | null }
  jobs: { id: string; number: string | number | null; title: string | null; customer: string | null; date: string | null; qty: number }[]
  mentions: { last_30_days: number; last_at: string | null }
}

export type MentionedPart = {
  term: string
  said: string
  label: string
  card_id: string | null
  item_id: string | null
  times: number
  has_picture: boolean
  stock: FlashStock | null
}

export type Mentioned = { parts: MentionedPart[]; candidates: FlashCandidate[] }

export type FlashSourceType = 'comms_message' | 'ai_intake_draft'

/** Which part a match or a mentioned part opens. */
export type FlashRef = { card_id?: string | null; item_id?: string | null; term?: string | null }

export function loadFlashCard(ref: FlashRef): Promise<FlashCard> {
  const q = new URLSearchParams()
  if (ref.card_id) q.set('card_id', ref.card_id)
  else if (ref.item_id) q.set('item_id', ref.item_id)
  else if (ref.term) q.set('term', ref.term)
  if (ref.card_id && ref.item_id) q.set('item_id', ref.item_id)
  return apiRequest<FlashCard>(`/v1/flash-words/card?${q.toString()}`)
}

export function flashCardKey(ref: FlashRef): readonly unknown[] {
  return ['flash-card', ref.card_id ?? null, ref.item_id ?? null, ref.card_id || ref.item_id ? null : ref.term ?? null]
}

export function loadMentioned(sourceType: FlashSourceType, sourceId: string): Promise<Mentioned> {
  const q = new URLSearchParams({ source_type: sourceType, source_id: sourceId })
  return apiRequest<Mentioned>(`/v1/flash-words/mentioned?${q.toString()}`)
}

/** "In stock: 4 at Shop, 1 in Van 2", or "Out of stock". */
export function stockLine(stock: FlashStock | null): string | null {
  if (!stock) return null
  if (stock.on_hand <= 0 || stock.locations.length === 0) return 'Out of stock'
  const where = stock.locations
    .slice(0, 3)
    .map((l) => `${qty(l.on_hand)} ${l.van ? 'in' : 'at'} ${l.name}`)
    .join(', ')
  const more = stock.locations.length > 3 ? ` and ${stock.locations.length - 3} more places` : ''
  return `In stock: ${where}${more}`
}

export function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function leadTime(days: number | null): string | null {
  if (days == null) return null
  if (days === 0) return 'same day'
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

// ---------------------------------------------------------------- batching

/** At most this many texts per request; the API refuses more. */
const MAX_PER_BATCH = 100

/** Long enough to collect a thread's bubbles mounting; nobody waits on it. */
const COLLECT_MS = 25

type Waiter = { resolve: (found: FlashScan) => void; reject: (error: unknown) => void }

const pending = new Map<FlashSource, Map<string, Waiter[]>>()
let timer: ReturnType<typeof setTimeout> | null = null

async function flushSource(source: FlashSource, texts: Map<string, Waiter[]>): Promise<void> {
  const batch = Array.from(texts.keys()).slice(0, MAX_PER_BATCH)
  const waiters = batch.map((text) => {
    const list = texts.get(text) ?? []
    texts.delete(text)
    return list
  })

  try {
    const response = await apiRequest<{ results?: FlashScan[] }>('/v1/flash-words/scan', {
      method: 'POST',
      body: { texts: batch, source },
    })
    batch.forEach((_, i) => {
      const found = response.results?.[i] ?? NOTHING
      waiters[i].forEach((w) => w.resolve({ matches: found.matches ?? [], candidates: found.candidates ?? [] }))
    })
  } catch (error) {
    // The words still show; they just are not underlined.
    waiters.forEach((list) => list.forEach((w) => w.reject(error)))
  }
}

function flush(): void {
  timer = null
  pending.forEach((texts, source) => {
    if (texts.size === 0) return
    void flushSource(source, texts)
  })
  // Anything that did not fit goes in the next batch.
  const left = Array.from(pending.values()).some((texts) => texts.size > 0)
  if (left && timer === null) timer = setTimeout(flush, COLLECT_MS)
}

export function scanFlashWords(text: string, source: FlashSource = 'other'): Promise<FlashScan> {
  if (!text || text.trim() === '') return Promise.resolve(NOTHING)

  return new Promise<FlashScan>((resolve, reject) => {
    let texts = pending.get(source)
    if (!texts) {
      texts = new Map()
      pending.set(source, texts)
    }
    const existing = texts.get(text)
    if (existing) existing.push({ resolve, reject })
    else texts.set(text, [{ resolve, reject }])

    if (timer === null) timer = setTimeout(flush, COLLECT_MS)
  })
}
