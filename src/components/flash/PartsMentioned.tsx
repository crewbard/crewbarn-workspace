import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IconPlus } from '@tabler/icons-react'
import { ReferenceCardEditor } from '@/components/ReferenceCardEditor'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { loadMentioned, qty, type FlashSourceType, type MentionedPart } from '@/lib/flashWords'
import type { Draft } from '@/lib/referenceCards'
import { draftForPart } from '@/lib/flashContext'
import { FlashCardPopover } from './FlashCardPopover'

/**
 * "Parts mentioned": the parts a call, voicemail or intake draft named, each
 * once, with whether they are on the shelf. Shown at the top so whoever
 * answers knows straight away if they have it. Tap one for its flash card.
 *
 * Part-like words that matched nothing are listed after, with "Make a card"
 * filled in with the number, so the next call that names it links up.
 *
 * Nothing at all when the text named no parts.
 */
export function PartsMentioned({
  sourceType,
  sourceId,
  tour = 'parts-mentioned',
  showCandidates = true,
  className,
}: {
  sourceType: FlashSourceType
  sourceId: string | null | undefined
  tour?: string
  showCandidates?: boolean
  className?: string
}) {
  const { has, hasAny, isLoading: permsLoading } = usePermissions()
  const allowed = !permsLoading && hasAny([PERM.CATALOG_VIEW, PERM.INVENTORY_VIEW])
  const canMake = has(PERM.CATALOG_EDIT)
  const [open, setOpen] = useState<{ part: MentionedPart; anchor: HTMLElement } | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)

  const q = useQuery({
    queryKey: ['flash-mentioned', sourceType, sourceId ?? null],
    queryFn: () => loadMentioned(sourceType, sourceId as string),
    enabled: allowed && !!sourceId,
    staleTime: 60_000,
    retry: false,
  })

  const parts = q.data?.parts ?? []
  const candidates = showCandidates && canMake ? (q.data?.candidates ?? []) : []
  if (parts.length === 0 && candidates.length === 0) return null

  return (
    <div data-tour={tour} data-parts={parts.length} className={className ?? 'rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2'}>
      {parts.length > 0 && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Parts mentioned</p>
          <ul className="mt-1 flex list-none flex-wrap gap-1.5 p-0">
            {parts.map((part) => (
              <li key={`${part.card_id ?? ''}:${part.item_id ?? ''}:${part.term}`}>
                <button
                  type="button"
                  onClick={(e) => setOpen({ part, anchor: e.currentTarget })}
                  aria-haspopup="dialog"
                  className="inline-flex max-w-[18rem] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:border-amber-400"
                >
                  <span className="truncate">{part.label}</span>
                  <StockBadge part={part} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {candidates.length > 0 && (
        <div data-tour={`${tour}-unknown`} className={parts.length > 0 ? 'mt-2' : undefined}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Not on a card yet</p>
          <ul className="mt-1 flex list-none flex-wrap gap-1.5 p-0">
            {candidates.map((c) => (
              <li key={c.term}>
                <button
                  type="button"
                  onClick={() => setEditing(draftForPart(c.text))}
                  title="Make a card for this part number"
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-amber-400 hover:bg-amber-50"
                >
                  <span className="font-mono">{c.text}</span>
                  <span className="inline-flex items-center gap-0.5 font-medium text-amber-700"><IconPlus size={11} aria-hidden />Make a card</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <FlashCardPopover
          part={{ card_id: open.part.card_id, item_id: open.part.item_id, term: open.part.term, said: open.part.said }}
          anchor={open.anchor}
          pinned
          onClose={() => setOpen(null)}
        />
      )}
      {editing && (
        <ReferenceCardEditor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { void q.refetch() }}
        />
      )}
    </div>
  )
}

function StockBadge({ part }: { part: MentionedPart }) {
  if (!part.item_id) {
    return <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">Not stocked</span>
  }
  const onHand = part.stock?.on_hand ?? 0
  if (onHand <= 0) {
    return <span className="shrink-0 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-800">Out of stock</span>
  }
  return <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-800">{qty(onHand)} in stock</span>
}
