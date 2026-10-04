import { apiRequest } from '@/lib/api'

/**
 * What a piece of text refers to, for many pieces of text at once.
 *
 * Two kinds come back. **Vehicles** come from the key library, which
 * is the same for every shop. **Cards** are the shop's own — the words
 * they chose, opening the card they wrote. The server finds both in
 * one pass, so asking for them separately would be two requests for
 * one answer.
 *
 * A message thread renders a hundred bubbles at once. Asking about
 * each one separately opens a hundred requests, and a browser will
 * only run six at a time — so the rest queue behind them and the
 * thread's own messages arrive last. That looks like the page hanging,
 * which is a bad trade for a convenience feature.
 *
 * So callers ask per text and this collects them. Everything that asks
 * within the same tick goes out together, identical texts are asked
 * about once, and the answers are handed back to each caller.
 */

export type VehicleMention = {
  text: string
  start: number
  length: number
  make: string
  model: string | null
  year: number | null
  matched_on: string
  lookup: { make: string; model?: string; year?: number }
}

export type CardMention = {
  text: string
  start: number
  length: number
  card_id: string
  title: string
  matched: string
  scope: 'shop' | 'platform'
}

export type TextReferences = {
  mentions: VehicleMention[]
  cards: CardMention[]
}

const NOTHING: TextReferences = { mentions: [], cards: [] }

export type Span =
  | { kind: 'vehicle'; start: number; length: number; mention: VehicleMention }
  | { kind: 'card'; start: number; length: number; mention: CardMention }

/**
 * One set of spans out of two, none of them overlapping.
 *
 * The two kinds are found independently, so they can land on the same
 * words — a card triggered by a part number inside a vehicle somebody
 * named in full. The longer span wins, because it is the more
 * complete reference; on a true tie the shop's own card wins, since
 * somebody there chose that word on purpose.
 *
 * Anything that does not fit the text it came from is dropped rather
 * than rendered. A bad offset must not be able to duplicate or lose
 * the words around it — the note has to survive the feature.
 */
export function mergeSpans(
  mentions: VehicleMention[],
  cards: CardMention[],
  textLength: number,
): Span[] {
  const all: Span[] = [
    ...mentions.map((m): Span => ({ kind: 'vehicle', start: m.start, length: m.length, mention: m })),
    ...cards.map((c): Span => ({ kind: 'card', start: c.start, length: c.length, mention: c })),
  ]

  const rank = { card: 0, vehicle: 1 } as const

  all.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    if (a.length !== b.length) return b.length - a.length
    return rank[a.kind] - rank[b.kind]
  })

  const kept: Span[] = []
  let cursor = 0

  all.forEach((span) => {
    if (span.length <= 0 || span.start < cursor || span.start + span.length > textLength) {
      return
    }

    kept.push(span)
    cursor = span.start + span.length
  })

  return kept
}


/** At most this many texts per request; the API refuses more. */
const MAX_PER_BATCH = 200

/**
 * Long enough to collect a thread's worth of bubbles mounting, short
 * enough that nobody waits for it. A frame is about 16ms.
 */
const COLLECT_MS = 25

type Waiter = {
  resolve: (found: TextReferences) => void
  reject: (error: unknown) => void
}

type Response = {
  mentions?: VehicleMention[][]
  cards?: CardMention[][]
}

const pending = new Map<string, Waiter[]>()
let timer: ReturnType<typeof setTimeout> | null = null

async function flush(): Promise<void> {
  timer = null

  const batch = Array.from(pending.keys()).slice(0, MAX_PER_BATCH)
  if (batch.length === 0) return

  const waiters = batch.map((text) => {
    const list = pending.get(text) ?? []
    pending.delete(text)
    return list
  })

  // Anything that did not fit goes in the next batch.
  if (pending.size > 0 && timer === null) {
    timer = setTimeout(() => void flush(), COLLECT_MS)
  }

  try {
    const response = await apiRequest<Response>('/v1/vehicle-keys/detect', {
      method: 'POST',
      body: { texts: batch },
    })

    batch.forEach((_, i) => {
      const found: TextReferences = {
        mentions: response.mentions?.[i] ?? [],
        cards: response.cards?.[i] ?? [],
      }
      waiters[i].forEach((w) => w.resolve(found))
    })
  } catch (error) {
    // One failed batch must not break the text it was about: callers
    // treat a rejection as "nothing found" and render the plain words.
    waiters.forEach((list) => list.forEach((w) => w.reject(error)))
  }
}

export function detectReferences(text: string): Promise<TextReferences> {
  if (!text || text.trim() === '') {
    return Promise.resolve(NOTHING)
  }

  return new Promise<TextReferences>((resolve, reject) => {
    const existing = pending.get(text)

    if (existing) {
      existing.push({ resolve, reject })
    } else {
      pending.set(text, [{ resolve, reject }])
    }

    if (timer === null) {
      timer = setTimeout(() => void flush(), COLLECT_MS)
    }
  })
}
