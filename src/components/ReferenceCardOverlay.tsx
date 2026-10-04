import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconBook2, IconChevronRight } from '@tabler/icons-react'
import { apiRequest } from '@/lib/api'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { formatSize } from '@/lib/referenceCardDocuments'
import {
  tabsOf,
  type ReferenceCard,
  type ReferenceCardDocument,
  type ReferenceCardSection,
} from '@/lib/referenceCards'
import { OpenDocument } from '@/components/magazine/OpenDocument'

export type { ReferenceCard, ReferenceCardSection }

/**
 * A card the shop wrote, opened by a word the shop chose.
 *
 * The vehicle card answers one trade out of catalogues somebody else
 * published. This answers everything else — the thing the owner
 * explains out loud twice a week and nobody wrote down. An HVAC shop
 * puts a unit's specs and its manual here; a locksmith puts the
 * access-control node they sell; somebody else puts a technique with
 * no part number at all.
 *
 * Same drawer as the vehicle card, deliberately. Two references that
 * open from the same sentence should not behave like two different
 * features.
 *
 * **Tabs come from the sections themselves.** A section carries the
 * name of the tab it belongs to, or no name at all. The ones with no
 * name are the card — they show above the tabs and stay put whichever
 * tab is open, because "what is this" belongs on every tab, not on
 * one of them.
 */

export function ReferenceCardOverlay({
  cardId,
  onClose,
  onEdit,
}: {
  cardId: string
  onClose: () => void
  onEdit?: (card: ReferenceCard) => void
}) {
  const { has } = usePermissions()
  const mayEdit = has(PERM.CATALOG_EDIT)
  const qc = useQueryClient()
  const [reading, setReading] = useState<ReferenceCardDocument | null>(null)

  const cardQ = useQuery({
    queryKey: ['reference-card', cardId],
    queryFn: () => apiRequest<{ card: ReferenceCard }>(`/v1/reference-cards/${cardId}`),
    staleTime: 5 * 60 * 1000,
  })

  const card = cardQ.data?.card
  const sections = useMemo(() => card?.sections ?? [], [card])
  const tabs = useMemo(() => tabsOf(sections), [sections])

  const [tab, setTab] = useState(0)

  /*
   * A different card is a different set of tabs, so the index resets.
   * Adjusted during render rather than in an effect: an effect would
   * paint the old tab once and then correct itself, which on a card
   * with tabs means a visible flash of the previous card's section.
   */
  const [shown, setShown] = useState(cardId)
  if (shown !== cardId) {
    setShown(cardId)
    setTab(0)
  }

  const untabbed = sections.filter((s) => (s.tab ?? '').trim() === '')
  const current = tabs[tab] ?? null
  const onThisTab = current === null
    ? sections.filter((s) => (s.tab ?? '').trim() === '')
    : sections.filter((s) => (s.tab ?? '').trim() === current)

  /*
   * Into the body, not into the sentence this opened from. A job
   * description renders inside a <p>, and a <div> is not allowed
   * there -- the browser closes the paragraph early and reparents
   * everything after it, which loses the rest of the note.
   */
  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        /*
         * Down the right, so whatever this was opened from stays
         * visible beside it. Same shell as the vehicle card.
         */
        className="fixed inset-y-0 right-0 z-50 flex w-[min(34rem,100vw)] flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">
              {card?.title ?? 'Reference'}
            </h2>
            {card && (
              <p className="truncate text-xs text-slate-500">
                {card.scope === 'platform'
                  ? 'Shared across CrewBarn'
                  : 'Your shop wrote this'}
                {card.triggers.length > 0 && ` · opens on ${card.triggers.join(', ')}`}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {card && mayEdit && card.mine && card.status !== 'approved' && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(card)}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {cardQ.isLoading && <p className="text-sm text-slate-500">Opening…</p>}

          {cardQ.isError && (
            <p className="text-sm text-slate-600">
              That card could not be opened. It may have been retired.
            </p>
          )}

          {card && (
            <>
              {/*
                The files first: a card with a manual on it is usually
                opened for the manual.
              */}
              {(card.documents?.length ?? 0) > 0 && (
                <ul className="space-y-1.5">
                  {card.documents!.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        onClick={() => setReading(doc)}
                        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-sky-300 hover:bg-sky-50"
                      >
                        <IconBook2 size={20} className="shrink-0 text-sky-700" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">{doc.title}</span>
                          <span className="block text-xs text-slate-500">
                            {formatSize(doc.size_bytes)}
                            {doc.tabs.length > 0 && ` · ${doc.tabs.length} tabs`}
                          </span>
                        </span>
                        <IconChevronRight size={16} className="shrink-0 text-slate-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/*
                The untabbed sections are the card itself. They stay on
                screen whichever tab is open: "what is this" belongs on
                every tab rather than hidden behind one of them.
              */}
              {tabs.length > 0 && untabbed.map((section, i) => (
                <Section key={`fixed-${i}`} section={section} />
              ))}

              {tabs.length > 0 && (
                <div className="border-b border-slate-200">
                  <div className="-mb-px flex flex-wrap gap-1">
                    {tabs.map((name, i) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setTab(i)}
                        className={
                          'border-b-2 px-3 py-1.5 text-sm font-medium ' +
                          (tab === i
                            ? 'border-sky-600 text-sky-700'
                            : 'border-transparent text-slate-500 hover:text-slate-800')
                        }
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(tabs.length === 0 ? sections : onThisTab).map((section, i) => (
                <Section key={`${current ?? ''}-${i}`} section={section} />
              ))}

              {sections.length === 0 && (card.documents?.length ?? 0) === 0 && (
                <p className="text-sm text-slate-500">This card is empty.</p>
              )}
            </>
          )}
        </div>
      </div>

      {card && reading && (
        <OpenDocument
          cardId={card.id}
          document={reading}
          canEdit={mayEdit && card.mine && card.status !== 'approved'}
          onClose={() => setReading(null)}
          onTabsSaved={() => void qc.invalidateQueries({ queryKey: ['reference-card', card.id] })}
        />
      )}
    </div>,
    document.body,
  )
}

function Section({ section }: { section: ReferenceCardSection }) {
  const body = (section.body ?? '').trim()

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {section.heading}
      </h3>
      {body === '' ? (
        <p className="mt-1 text-sm italic text-slate-400">Nothing written here yet.</p>
      ) : (
        /*
         * Whitespace is kept. People paste a list of part numbers, one
         * per line, and collapsing it into a paragraph makes them
         * unreadable.
         */
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{body}</p>
      )}
    </div>
  )
}
