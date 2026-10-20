import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { detectReferences, type CardMention, type VehicleMention } from '@/lib/textReferences'
import { scanFlashWords, type FlashMatch, type FlashSource } from '@/lib/flashWords'
import { VehicleKeyOverlay } from '@/components/VehicleKeyOverlay'
import { ReferenceCardOverlay } from '@/components/ReferenceCardOverlay'
import { ReferenceCardEditor } from '@/components/ReferenceCardEditor'
import { draftOf, type Draft } from '@/lib/referenceCards'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { FlashCardPopover } from './FlashCardPopover'

/**
 * Text with the things it mentions turned into links: a note, a message, a
 * call transcript, an estimate line.
 *
 * Three kinds. **Flash words** are the shop's own part numbers and other
 * names for parts, underlined in dotted amber; hovering or tapping one opens
 * a small card with stock, orders, catalog pages and suppliers. A **card**
 * opens a reference card on a word the shop chose. A **vehicle** opens the
 * key reference.
 *
 * **The text is never rewritten.** The server says where each mention is;
 * this renders around those places. If finding them fails, or finds nothing,
 * the text shows exactly as it came in.
 *
 * **Tenant side only.** The customer portal shows the same text plain.
 */

type Span =
  | { kind: 'flash'; start: number; length: number; match: FlashMatch }
  | { kind: 'card'; start: number; length: number; mention: CardMention }
  | { kind: 'vehicle'; start: number; length: number; mention: VehicleMention }

/**
 * One set of spans, none overlapping. The longer wins; on a tie a part
 * number beats a card's word (it has the stock), and both beat a vehicle.
 * A span that does not fit the text is dropped, so a bad offset can never
 * duplicate or lose words.
 */
function mergeFlashSpans(
  flash: FlashMatch[],
  cards: CardMention[],
  vehicles: VehicleMention[],
  textLength: number,
): Span[] {
  const all: Span[] = [
    ...flash.map((m): Span => ({ kind: 'flash', start: m.start, length: m.end - m.start, match: m })),
    ...cards.map((c): Span => ({ kind: 'card', start: c.start, length: c.length, mention: c })),
    ...vehicles.map((v): Span => ({ kind: 'vehicle', start: v.start, length: v.length, mention: v })),
  ]
  const rank = { flash: 0, card: 1, vehicle: 2 } as const
  all.sort((a, b) => a.start - b.start || b.length - a.length || rank[a.kind] - rank[b.kind])

  const kept: Span[] = []
  let cursor = 0
  for (const span of all) {
    if (span.length <= 0 || span.start < cursor || span.start + span.length > textLength) continue
    kept.push(span)
    cursor = span.start + span.length
  }
  return kept
}

const HOVER_OPEN_MS = 250
const HOVER_CLOSE_MS = 250

export function FlashText({
  text,
  source = 'other',
  className,
  enabled = true,
}: {
  text: string | null | undefined
  /** What the text is. A transcript has spoken numbers ("S C one") read as part numbers. */
  source?: FlashSource
  className?: string
  enabled?: boolean
}) {
  const body = text ?? ''
  const { hasAny, isLoading: permsLoading } = usePermissions()
  const canFlash = !permsLoading && hasAny([PERM.CATALOG_VIEW, PERM.INVENTORY_VIEW])
  const live = enabled && body.trim().length > 0

  const [vehicle, setVehicle] = useState<VehicleMention | null>(null)
  const [card, setCard] = useState<CardMention | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [open, setOpen] = useState<{ match: FlashMatch; anchor: HTMLElement; pinned: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refsQ = useQuery({
    queryKey: ['text-references', body],
    queryFn: () => detectReferences(body),
    enabled: live,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const flashQ = useQuery({
    queryKey: ['flash-words', source, body],
    queryFn: () => scanFlashWords(body, source),
    enabled: live && canFlash,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clearTimer, [])

  const close = useCallback(() => {
    clearTimer()
    setOpen(null)
  }, [])

  const spans = mergeFlashSpans(
    flashQ.data?.matches ?? [],
    refsQ.data?.cards ?? [],
    refsQ.data?.mentions ?? [],
    body.length,
  )

  if (spans.length === 0) {
    return <span className={className}>{body}</span>
  }

  const pieces: React.ReactNode[] = []
  let cursor = 0

  spans.forEach((span, i) => {
    if (span.start > cursor) pieces.push(body.slice(cursor, span.start))
    const word = body.slice(span.start, span.start + span.length)

    if (span.kind === 'flash') {
      const m = span.match
      pieces.push(
        <button
          key={`f-${span.start}-${i}`}
          type="button"
          data-flash-word={m.term}
          data-tour={i === spans.findIndex((s) => s.kind === 'flash') ? 'flash-word' : undefined}
          aria-haspopup="dialog"
          aria-expanded={open?.match === m}
          title={m.label}
          onPointerEnter={(e) => {
            if (e.pointerType !== 'mouse' || open?.pinned) return
            const anchor = e.currentTarget
            clearTimer()
            timer.current = setTimeout(() => setOpen({ match: m, anchor, pinned: false }), HOVER_OPEN_MS)
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== 'mouse') return
            clearTimer()
            timer.current = setTimeout(() => setOpen((o) => (o && !o.pinned ? null : o)), HOVER_CLOSE_MS)
          }}
          onClick={(e) => {
            clearTimer()
            const anchor = e.currentTarget
            setOpen((o) => (o && o.match === m && o.pinned ? null : { match: m, anchor, pinned: true }))
          }}
          className="cursor-pointer text-inherit underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-2 hover:decoration-solid focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {word}
        </button>,
      )
    } else {
      pieces.push(
        <button
          key={`${span.kind}-${span.start}-${i}`}
          type="button"
          onClick={() => (span.kind === 'vehicle' ? setVehicle(span.mention) : setCard(span.mention))}
          className="text-[var(--accent-700)] underline decoration-[var(--accent-300)] decoration-dotted underline-offset-2 hover:decoration-solid"
          title={span.kind === 'vehicle' ? `Keys and parts that fit this ${span.mention.make}` : span.mention.title}
        >
          {word}
        </button>,
      )
    }
    cursor = span.start + span.length
  })
  if (cursor < body.length) pieces.push(body.slice(cursor))

  return (
    <>
      <span className={className}>{pieces}</span>
      {open && (
        <FlashCardPopover
          part={{ card_id: open.match.card_id, item_id: open.match.item_id, term: open.match.term, said: open.match.text }}
          anchor={open.anchor}
          pinned={open.pinned}
          onClose={close}
          onPointerEnter={clearTimer}
          onPointerLeave={() => {
            if (open.pinned) return
            clearTimer()
            timer.current = setTimeout(() => setOpen((o) => (o && !o.pinned ? null : o)), HOVER_CLOSE_MS)
          }}
        />
      )}
      {vehicle && (
        <VehicleKeyOverlay
          make={vehicle.lookup.make}
          model={vehicle.lookup.model ?? null}
          year={vehicle.lookup.year ?? null}
          yearTo={vehicle.lookup.year_to ?? null}
          onClose={() => setVehicle(null)}
        />
      )}
      {card && (
        <ReferenceCardOverlay
          cardId={card.card_id}
          onClose={() => setCard(null)}
          onEdit={(c) => {
            setCard(null)
            setEditing(draftOf(c))
          }}
        />
      )}
      {editing && <ReferenceCardEditor draft={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
