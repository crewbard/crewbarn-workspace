import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  detectReferences,
  mergeSpans,
  type CardMention,
  type VehicleMention,
} from '@/lib/textReferences'
import { VehicleKeyOverlay } from './VehicleKeyOverlay'
import { ReferenceCardOverlay } from './ReferenceCardOverlay'
import { ReferenceCardEditor } from './ReferenceCardEditor'
import { draftOf, type Draft } from '@/lib/referenceCards'

/**
 * A job description, a note or a call transcript, with the things it
 * refers to turned into links.
 *
 * Two kinds. A **vehicle** opens the key reference, which is the same
 * library for every shop. A **card** opens something this shop wrote
 * itself, on a word this shop chose — an AC unit, an access-control
 * node, a technique with no part number at all. Both are found in the
 * one request.
 *
 * **The text is never rewritten.** The backend returns spans — where
 * something was mentioned and what it resolved to — and this renders
 * around them. A transcript is a record of what was said and a
 * description is what somebody typed; storing markup in either would
 * be wrong the moment the library changes, and would quietly edit a
 * record people rely on.
 *
 * **Tenant side only.** The customer portal renders the same text as
 * plain text. A customer reading their own job does not need the
 * shop's tooling, its stock, or which tech is carrying what.
 *
 * If detection fails or finds nothing, the text renders exactly as it
 * came in. A reference feature should never be able to hide the note
 * somebody wrote.
 */

export function ReferencedText({
  text,
  className,
  enabled = true,
}: {
  text: string | null | undefined
  className?: string
  enabled?: boolean
}) {
  const [vehicle, setVehicle] = useState<VehicleMention | null>(null)
  const [card, setCard] = useState<CardMention | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  const body = text ?? ''

  const detectQ = useQuery({
    queryKey: ['text-references', body],
    /*
     * Batched: everything asking in the same tick goes out in one
     * request. A thread of a hundred bubbles costs one round trip, not
     * a hundred -- which is what made the message list hang the first
     * time this was wired in.
     */
    queryFn: () => detectReferences(body),
    enabled: enabled && body.trim().length > 0,
    // The same note re-renders constantly while a job is open, and the
    // answer only changes when the library is re-cut or a card saved.
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const spans = mergeSpans(
    detectQ.data?.mentions ?? [],
    detectQ.data?.cards ?? [],
    body.length,
  )

  if (spans.length === 0) {
    return <span className={className}>{body}</span>
  }

  const pieces: React.ReactNode[] = []
  let cursor = 0

  spans.forEach((span, i) => {
    if (span.start > cursor) {
      pieces.push(body.slice(cursor, span.start))
    }

    const word = body.slice(span.start, span.start + span.length)

    pieces.push(
      <button
        key={`${span.start}-${i}`}
        type="button"
        onClick={() =>
          span.kind === 'vehicle' ? setVehicle(span.mention) : setCard(span.mention as CardMention)
        }
        className="text-sky-700 underline decoration-dotted underline-offset-2 hover:decoration-solid"
        title={
          span.kind === 'vehicle'
            ? `Key reference for this ${span.mention.make}`
            : span.mention.title
        }
      >
        {word}
      </button>,
    )

    cursor = span.start + span.length
  })

  if (cursor < body.length) {
    pieces.push(body.slice(cursor))
  }

  return (
    <>
      <span className={className}>{pieces}</span>
      {vehicle && (
        <VehicleKeyOverlay
          make={vehicle.lookup.make}
          model={vehicle.lookup.model ?? null}
          year={vehicle.lookup.year ?? null}
          onClose={() => setVehicle(null)}
        />
      )}
      {card && (
        <ReferenceCardOverlay
          cardId={card.card_id}
          onClose={() => setCard(null)}
          /*
           * The overlay only offers this to somebody who may edit and
           * owns the card, so there is nothing to gate again here.
           */
          onEdit={(c) => {
            setCard(null)
            setEditing(draftOf(c))
          }}
        />
      )}

      {editing && (
        <ReferenceCardEditor draft={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
