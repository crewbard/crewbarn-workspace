import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconCards, IconCheck, IconListSearch, IconX } from '@tabler/icons-react'
import { apiRequest } from '@/lib/api'
import { foldName, namesOf, type ReferenceCard } from '@/lib/referenceCards'
import { makeCardsFromCatalog, type MadeCards } from '@/lib/catalogs'
import type { PartOnPage } from './partNumbers'
import type { Book } from './pdfBook'
import { splitPartNumber, type CardPrefill, type CardSelection } from './cardPicks'

export type { CardPrefill, CardSelection } from './cardPicks'

/**
 * Making reference cards from a catalog, beside the open book.
 *
 * A part is picked off the page two ways: press a part number the page's
 * text has, or drag a box around the part -- its picture, its number and
 * its name. Either way the card comes pre-filled: the number, the name,
 * the catalog and page it was found on, and the boxed area as its
 * picture. It opens in the card editor to check before anything is saved.
 *
 * Or a whole page at once: every part-number-looking word on it, ticked,
 * and a card for each. A number that already has a card is linked to
 * this page instead of getting a second one.
 */

const CARDS_KEY = ['reference-cards']

export function CardMaker({
  book,
  catalogId,
  pages,
  pageLabel,
  selection,
  onClear,
  onMake,
  onGo,
  onClose,
}: {
  book: Book
  catalogId: string
  /** The pages on screen: one, or two side by side. */
  pages: number[]
  pageLabel: (page: number) => string
  selection: CardSelection | null
  onClear: () => void
  onMake: (prefill: CardPrefill) => void
  onGo: (page: number) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'pick' | 'page'>('pick')

  return (
    <aside
      aria-label="Make reference cards"
      data-tour="book-cards"
      data-cards-mode={mode}
      data-selection={selection ? 'yes' : 'no'}
      className="flex h-full w-[min(22rem,100vw)] shrink-0 flex-col border-l border-white/10 bg-white text-slate-900"
    >
      <div className="flex items-start gap-2 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Make reference cards</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            A card says what a part is and where to find it, and opens wherever its number comes up.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <IconX size={16} />
        </button>
      </div>

      <div role="tablist" className="flex border-b border-slate-200 px-2 text-sm">
        <ModeTab on={mode === 'pick'} onClick={() => setMode('pick')} tour="book-cards-pick-tab">
          <IconCards size={15} /> One part
        </ModeTab>
        <ModeTab on={mode === 'page'} onClick={() => setMode('page')} tour="book-cards-page-tab">
          <IconListSearch size={15} /> Whole page
        </ModeTab>
      </div>

      {mode === 'pick' ? (
        <PickOne
          // A new pick starts the fields afresh.
          key={selection ? `${selection.page}:${selection.box.left}:${selection.box.top}:${selection.partNumber}` : 'none'}
          book={book}
          selection={selection}
          pageLabel={pageLabel}
          onClear={onClear}
          onMake={onMake}
        />
      ) : (
        <WholePage book={book} catalogId={catalogId} pages={pages} pageLabel={pageLabel} onGo={onGo} />
      )}
    </aside>
  )
}

function ModeTab({ on, onClick, tour, children }: { on: boolean; onClick: () => void; tour: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      data-tour={tour}
      onClick={onClick}
      className={
        '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium '
        + (on ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800')
      }
    >
      {children}
    </button>
  )
}

function PickOne({
  book,
  selection,
  pageLabel,
  onClear,
  onMake,
}: {
  book: Book
  selection: CardSelection | null
  pageLabel: (page: number) => string
  onClear: () => void
  onMake: (prefill: CardPrefill) => void
}) {
  // Keyed on the pick by the parent, so these start from it.
  const [picture, setPicture] = useState<{ blob: Blob; url: string } | null>(null)
  const [drawing, setDrawing] = useState(!!selection)
  const [usePicture, setUsePicture] = useState(true)
  const [partNumber, setPartNumber] = useState(() =>
    selection ? selection.partNumber || splitPartNumber(selection.text).partNumber : '')
  const [name, setName] = useState(() => {
    if (!selection) return ''
    const words = selection.partNumber
      ? selection.text.join(' ').replace(selection.partNumber, ' ')
      : splitPartNumber(selection.text).name
    return words.replace(/\s+/g, ' ').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '').slice(0, 160)
  })

  // The picked area, drawn sharp from the PDF rather than cut from the screen.
  useEffect(() => {
    if (!selection) return
    let live = true
    book.crop(selection.page, selection.box)
      .then((blob) => {
        if (!live) return
        const reader = new FileReader()
        reader.onload = () => live && setPicture({ blob, url: String(reader.result) })
        reader.readAsDataURL(blob)
      })
      .catch(() => undefined)
      .finally(() => live && setDrawing(false))
    return () => {
      live = false
    }
  }, [book, selection])

  if (!selection) {
    return (
      <div data-tour="book-cards-howto" className="space-y-3 px-4 py-4 text-sm text-slate-600">
        <p>Pick a part on the page:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>press a part number printed on the page, or</li>
          <li>drag a box around the part, its number and its name.</li>
        </ul>
        <p className="text-xs text-slate-500">
          The card comes filled in with what you picked, this catalog and page, and the boxed area as its picture.
          You check it before it is saved.
        </p>
      </div>
    )
  }

  const title = (name.trim() || partNumber.trim()).slice(0, 160)

  return (
    <div data-tour="book-cards-selection" className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {pageLabel(selection.page)}</span>
          <button type="button" onClick={onClear} className="font-medium text-sky-700 hover:underline">Pick again</button>
        </div>

        <div className="flex min-h-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {picture ? (
            <img src={picture.url} alt="The picked area" className="max-h-48 w-full object-contain" />
          ) : (
            <span className="py-8 text-xs text-slate-400">{drawing ? 'Drawing the picture…' : 'No picture'}</span>
          )}
        </div>
        {picture && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={usePicture} onChange={(e) => setUsePicture(e.target.checked)} />
            Use this as the card’s picture
          </label>
        )}

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Part number</span>
          <input
            value={partNumber}
            maxLength={80}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="None found. Type it in"
            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
          <input
            value={name}
            maxLength={160}
            onChange={(e) => setName(e.target.value)}
            placeholder="What it is"
            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        {selection.text.length > 0 && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Text near it</span>
            <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
              {selection.text.join('\n').slice(0, 600)}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <button
          type="button"
          data-tour="book-cards-make"
          disabled={title === ''}
          onClick={() => onMake({
            partNumber: partNumber.trim(),
            name: title,
            about: selection.text.join('\n').slice(0, 2000),
            page: selection.page,
            pageLabel: pageLabel(selection.page),
            picture: usePicture && picture ? picture.blob : null,
          })}
          className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          Make a reference card
        </button>
      </div>
    </div>
  )
}

function WholePage({
  book,
  catalogId,
  pages,
  pageLabel,
  onGo,
}: {
  book: Book
  catalogId: string
  pages: number[]
  pageLabel: (page: number) => string
  onGo: (page: number) => void
}) {
  const qc = useQueryClient()
  // The page asked for, while it is still on screen; otherwise the one on the right.
  const [chosen, setPage] = useState<number | null>(null)
  const page = chosen !== null && pages.includes(chosen) ? chosen : (pages[pages.length - 1] ?? 1)
  const [found, setFound] = useState<{ page: number; parts: PartOnPage[] } | null>(null)
  const [looking, setLooking] = useState(false)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<MadeCards | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cards = useQuery({
    queryKey: CARDS_KEY,
    queryFn: () => apiRequest<{ cards: ReferenceCard[] }>('/v1/reference-cards'),
    staleTime: 60_000,
  })
  const known = useMemo(() => {
    const map = new Map<string, string>()
    for (const card of cards.data?.cards ?? []) {
      if (!card.mine) continue
      for (const name of namesOf(card)) if (!map.has(name)) map.set(name, card.title)
    }
    return map
  }, [cards.data])

  const look = async () => {
    setLooking(true)
    setResult(null)
    setError(null)
    try {
      const parts = (await book.partNumbers(page)).filter((p) => p.kind === 'part')
      // Once each: an index lists the same number in two columns.
      const once = parts.filter((p, i) => parts.findIndex((q) => foldName(q.text) === foldName(p.text)) === i)
      setFound({ page, parts: once })
      setTicked(new Set(once.filter((p) => !known.has(foldName(p.text))).map((p) => p.text)))
    } catch {
      setError('The text on this page could not be read.')
    } finally {
      setLooking(false)
    }
  }

  const make = async () => {
    if (!found) return
    setSaving(true)
    setError(null)
    try {
      const chosen = found.parts.filter((p) => ticked.has(p.text))
      const made = await makeCardsFromCatalog(catalogId, chosen.map((p) => ({
        part_number: p.text,
        title: titleFrom(p),
        page: found.page,
        page_label: pageLabel(found.page),
      })))
      setResult(made)
      setTicked(new Set())
      void qc.invalidateQueries({ queryKey: CARDS_KEY })
      void qc.invalidateQueries({ queryKey: ['text-references'] })
      void qc.invalidateQueries({ queryKey: ['catalogs'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The cards were not made.')
    } finally {
      setSaving(false)
    }
  }

  const parts = found?.page === page ? found.parts : null
  const count = ticked.size

  return (
    <div data-tour="book-cards-page" className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-slate-100 px-4 py-3">
        {pages.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            Page
            {pages.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={p === page}
                onClick={() => setPage(p)}
                className={'rounded px-2 py-0.5 ' + (p === page ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200')}
              >
                {pageLabel(p)}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          data-tour="book-cards-find"
          onClick={() => void look()}
          disabled={looking}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {looking ? 'Reading the page…' : `Find part numbers on page ${pageLabel(page)}`}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {error && <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}

        {result && (
          <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {summary(result)}
          </p>
        )}

        {parts === null && !result && (
          <p className="text-sm text-slate-500">
            Lists every number on the page that looks like a part number. Tick the ones you want a card for.
            Numbers that already have a card are linked to this page instead.
          </p>
        )}

        {parts !== null && parts.length === 0 && (
          <p className="text-sm text-slate-500">
            No part numbers found on this page. A scanned page has no text to read; drag a box around a part instead.
          </p>
        )}

        {parts !== null && parts.length > 0 && (
          <>
            <div className="mb-2 flex items-center gap-3 text-xs">
              <button type="button" className="font-medium text-sky-700 hover:underline" onClick={() => setTicked(new Set(parts.map((p) => p.text)))}>Tick all</button>
              <button type="button" className="font-medium text-sky-700 hover:underline" onClick={() => setTicked(new Set())}>Clear</button>
              <span className="grow" />
              <button type="button" className="text-slate-500 hover:underline" onClick={() => onGo(page)}>Show the page</button>
            </div>
            <ul data-tour="book-cards-list" className="m-0 list-none space-y-1 p-0">
              {parts.map((part) => {
                const has = known.get(foldName(part.text))
                return (
                  <li key={part.text}>
                    <label className="flex items-start gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={ticked.has(part.text)}
                        onChange={(e) => setTicked((was) => {
                          const next = new Set(was)
                          if (e.target.checked) next.add(part.text)
                          else next.delete(part.text)
                          return next
                        })}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm text-slate-900">{part.text}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {has ? `Has a card: ${has}. Ticking links it to this page.` : titleFrom(part) || ' '}
                        </span>
                      </span>
                      {has && <IconCheck size={14} className="mt-1 shrink-0 text-emerald-600" aria-label="Has a card" />}
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {parts !== null && parts.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            data-tour="book-cards-make-many"
            disabled={count === 0 || saving}
            onClick={() => void make()}
            className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? 'Making cards…' : count === 0 ? 'Tick the numbers you want' : `Make ${count} ${count === 1 ? 'card' : 'cards'}`}
          </button>
        </div>
      )}
    </div>
  )
}

/** The words on a part's row, without the number itself. */
function titleFrom(part: PartOnPage): string {
  return part.line.replace(part.text, ' ').replace(/\s+/g, ' ').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '').slice(0, 160)
}

function summary(result: MadeCards): string {
  const made = result.created.length
  const linked = result.linked.length
  const full = result.already_linked.filter((r) => r.reason === 'full').length
  const already = result.already_linked.length - full
  const bits: string[] = []
  if (made > 0) bits.push(`${made} ${made === 1 ? 'card' : 'cards'} made`)
  if (linked > 0) bits.push(`${linked} you already had ${linked === 1 ? 'is' : 'are'} now linked to this page`)
  if (already > 0) bits.push(`${already} ${already === 1 ? 'was' : 'were'} already linked here`)
  if (full > 0) bits.push(`${full} skipped: your card library is full`)
  return bits.length > 0 ? `${bits.join(', ')}.` : 'Nothing to do.'
}
