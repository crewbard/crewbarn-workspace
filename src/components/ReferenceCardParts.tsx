import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconBook2, IconPhoto, IconX } from '@tabler/icons-react'
import { apiRequest, type ApiError } from '@/lib/api'
import { useCardPicture, useObjectUrl } from '@/hooks/useCardPicture'
import {
  CATALOGS_KEY,
  linkCardToCatalog,
  loadCatalogs,
  openCatalogs,
  unlinkCardFromCatalog,
} from '@/lib/catalogs'
import {
  LIMITS,
  foldName,
  linkLabel,
  type CatalogLink,
  type PendingLink,
  type ReferenceCard,
} from '@/lib/referenceCards'

/**
 * The parts of a card that are about a part: the numbers and names it
 * goes by, its picture, and the catalog pages it is found on.
 *
 * Kept out of the editor's file because the editor is about writing; these
 * are about finding, and a part found by number on a call is what they are
 * for.
 */

/** A list of short names, added with Enter: part numbers, other names. */
export function NameList({
  label,
  hint,
  names,
  placeholder,
  onChange,
  onError,
}: {
  label: string
  hint: string
  names: string[]
  placeholder: string
  onChange: (names: string[]) => void
  onError: (message: string | null) => void
}) {
  const [text, setText] = useState('')

  const add = () => {
    const name = text.trim()
    setText('')
    if (name === '') return
    if (name.length > LIMITS.name) {
      onError(`A name is at most ${LIMITS.name} characters.`)
      return
    }
    if (names.some((n) => foldName(n) === foldName(name))) return
    if (names.length >= LIMITS.names) {
      onError(`${LIMITS.names} is the most one card keeps.`)
      return
    }
    onError(null)
    onChange([...names, name])
  }

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      {names.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {names.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-800">
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onChange(names.filter((n) => n !== name))}
                className="text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={text}
        maxLength={LIMITS.name}
        onChange={(e) => setText(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  )
}

/** The picture in the editor: one waiting to save, the saved one, or none. */
export function CardPicture({
  cardId,
  pending,
  dropped,
  onPending,
  onDrop,
}: {
  cardId: string | null
  pending: Blob | null
  dropped: boolean
  onPending: (picture: Blob) => void
  onDrop: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const saved = useCardPicture(cardId, !pending && !dropped)
  const waiting = useObjectUrl(pending)
  const shown = waiting ?? (dropped ? null : saved)

  return (
    <div data-tour="refcards-ed-picture">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Picture</span>
      <div className="mt-2 flex items-start gap-3">
        <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {shown ? (
            <img src={shown} alt="The card’s picture" className="h-full w-full object-contain" />
          ) : (
            <IconPhoto size={28} className="text-slate-300" aria-hidden />
          )}
        </div>
        <div className="space-y-1.5 text-xs text-slate-500">
          <p>What the part looks like. Made from a catalog, it is the area you picked on the page.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => input.current?.click()} className="font-medium text-sky-700 hover:underline">
              {shown ? 'Change' : 'Add a picture'}
            </button>
            {shown && (
              <button type="button" onClick={onDrop} className="font-medium text-slate-500 hover:text-red-700">
                Remove
              </button>
            )}
          </div>
          {waiting && <p className="text-slate-400">Saved with the card.</p>}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPending(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

/**
 * "Found in": the catalog pages this card's part is on, and a picker to
 * add one. A saved card links straight away; a new one keeps the list
 * and sends it with the save.
 */
export function CardCatalogLinks({
  cardId,
  pending,
  onPending,
  onError,
}: {
  cardId: string | null
  pending: PendingLink[]
  onPending: (links: PendingLink[]) => void
  onError: (message: string | null) => void
}) {
  const qc = useQueryClient()
  const [picking, setPicking] = useState(false)
  const [catalogId, setCatalogId] = useState('')
  const [page, setPage] = useState('')
  const [busy, setBusy] = useState(false)

  const cardQ = useQuery({
    queryKey: ['reference-card', cardId],
    queryFn: () => apiRequest<{ card: ReferenceCard }>(`/v1/reference-cards/${cardId}`),
    enabled: !!cardId,
  })
  const catalogsQ = useQuery({ queryKey: CATALOGS_KEY, queryFn: loadCatalogs, enabled: picking, staleTime: 60_000 })
  const catalogs = catalogsQ.data?.catalogs ?? []

  const saved: CatalogLink[] = cardQ.data?.card.found_in ?? []
  const rows: Array<{ key: string; link: PendingLink; savedId?: string }> = cardId
    ? saved.map((l) => ({ key: l.id, link: l, savedId: l.id }))
    : pending.map((l, i) => ({ key: `p${i}`, link: l }))

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['reference-card', cardId] })
    void qc.invalidateQueries({ queryKey: ['reference-cards'] })
    void qc.invalidateQueries({ queryKey: CATALOGS_KEY })
  }

  const add = async () => {
    const catalog = catalogs.find((c) => c.id === catalogId)
    if (!catalog) return
    const n = page.trim() === '' ? null : Number(page)
    if (n !== null && (!Number.isInteger(n) || n < 1 || (catalog.page_count !== null && n > catalog.page_count))) {
      onError(catalog.page_count ? `Pages in that catalog run 1 to ${catalog.page_count}.` : 'That is not a page number.')
      return
    }
    onError(null)
    const link: PendingLink = { document_id: catalog.id, title: catalog.title, page: n, page_label: null }

    if (!cardId) {
      if (!pending.some((p) => p.document_id === link.document_id && p.page === link.page)) onPending([...pending, link])
    } else {
      setBusy(true)
      try {
        await linkCardToCatalog(cardId, { document_id: link.document_id, page: link.page })
        refresh()
      } catch (e) {
        onError((e as ApiError)?.message ?? 'That link did not save.')
      } finally {
        setBusy(false)
      }
    }
    setPicking(false)
    setPage('')
  }

  const remove = async (row: { link: PendingLink; savedId?: string }) => {
    if (!cardId || !row.savedId) {
      onPending(pending.filter((p) => p !== row.link))
      return
    }
    try {
      await unlinkCardFromCatalog(cardId, row.savedId)
      refresh()
    } catch (e) {
      onError((e as ApiError)?.message ?? 'That link was not removed.')
    }
  }

  return (
    <div data-tour="refcards-ed-found-in">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Found in</span>
      <p className="mt-0.5 text-xs text-slate-500">
        The catalog pages this part is on. Catalogs themselves live in the catalog library.
      </p>

      {rows.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5">
              <IconBook2 size={16} className="shrink-0 text-slate-400" />
              <button
                type="button"
                onClick={() => openCatalogs({ documentId: row.link.document_id, page: row.link.page ?? undefined })}
                className="min-w-0 flex-1 truncate text-left text-sm text-sky-700 hover:underline"
              >
                {linkLabel(row.link)}
              </button>
              <button
                type="button"
                aria-label={`Remove ${linkLabel(row.link)}`}
                onClick={() => void remove(row)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-700"
              >
                <IconX size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {picking ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/50 p-2.5">
          <select
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            aria-label="Catalog"
            className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">{catalogsQ.isPending ? 'Loading catalogs…' : 'Choose a catalog'}</option>
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>{c.vendor ? `${c.title} (${c.vendor})` : c.title}</option>
            ))}
          </select>
          <input
            value={page}
            onChange={(e) => setPage(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            placeholder="Page"
            aria-label="Page"
            className="w-20 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={!catalogId || busy}
            onClick={() => void add()}
            className="rounded bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Link
          </button>
          <button type="button" onClick={() => setPicking(false)} className="text-xs text-slate-500 hover:text-slate-800">
            Cancel
          </button>
          {!catalogsQ.isPending && catalogs.length === 0 && (
            <p className="w-full text-xs text-slate-500">No catalogs yet. Add one in the catalog library.</p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-sky-400 hover:bg-sky-50"
        >
          <IconBook2 size={16} />
          Link a catalog page
        </button>
      )}
    </div>
  )
}
