import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconBook2, IconPencil, IconScan, IconSearch, IconTrash, IconUpload } from '@tabler/icons-react'
import type { ApiError } from '@/lib/api'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/Button'
import { useObjectUrl } from '@/hooks/useCardPicture'
import { formatSize, readImage, uploadCatalogPdf } from '@/lib/referenceCardDocuments'
import { LIMITS } from '@/lib/referenceCards'
import {
  CATALOGS_KEY,
  deleteCatalog,
  loadCatalogs,
  matchCatalogs,
  openCatalogs,
  saveCatalogCover,
  shareCatalogWithCustomers,
  updateCatalog,
  type Catalog,
} from '@/lib/catalogs'
import { isSearchable, searchCatalogs } from '@/lib/catalogIndex'
import { CatalogIndexOverlay, Marked, type IndexJob } from '@/components/catalogs/CatalogIndexOverlay'

/**
 * The catalog library: the shop's price books and manuals as books.
 *
 * A catalog used to be a file on a reference card. Here it stands on its
 * own -- upload a PDF, name it, say who it is from, share it with
 * customers -- and opens in the book viewer with its tabs and its order
 * panel. Reference cards point into it ("found in: page 52"), and can be
 * made from it, a part at a time or a page at a time.
 */
export function CatalogsPage() {
  const { has } = usePermissions()
  const mayEdit = has(PERM.CATALOG_EDIT)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState(params.get('add') === '1' && mayEdit)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  // Catalogs being read for search, in the overlay.
  const [indexing, setIndexing] = useState<IndexJob[] | null>(null)
  // What was typed, a moment after typing stops: the search inside the books.
  const [inside, setInside] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setInside(query.trim()), 300)
    return () => window.clearTimeout(t)
  }, [query])

  // "Add a catalog" from the launcher lands here with the form open; the address goes back to plain.
  useEffect(() => {
    if (params.get('add') === '1') {
      params.delete('add')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const listQ = useQuery({ queryKey: CATALOGS_KEY, queryFn: loadCatalogs })
  const all = listQ.data?.catalogs
  const shown = useMemo(() => {
    const found = matchCatalogs(all ?? [], query)
    // Last opened first: the books in use are the ones looked for.
    return [...found].sort((a, b) => (b.last_opened_at ?? '').localeCompare(a.last_opened_at ?? '') || a.title.localeCompare(b.title))
  }, [all, query])

  const refresh = () => void qc.invalidateQueries({ queryKey: CATALOGS_KEY })

  const share = useMutation({
    mutationFn: (v: { id: string; on: boolean }) => shareCatalogWithCustomers(v.id, v.on),
    onSuccess: refresh,
    onError: (e) => setError((e as ApiError)?.message ?? 'That change did not save.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteCatalog(id),
    onSuccess: () => {
      refresh()
      void qc.invalidateQueries({ queryKey: ['reference-cards'] })
    },
    onError: (e) => setError((e as ApiError)?.message ?? 'That catalog was not deleted.'),
  })

  const mine = shown.filter((c) => c.mine)
  const shared = shown.filter((c) => !c.mine)
  const unread = (all ?? []).filter((c) => !isSearchable(c.index))
  const anyRead = (all ?? []).some((c) => (c.index?.pages_done ?? 0) > 0)

  const insideQ = useQuery({
    queryKey: ['catalog-search', inside],
    queryFn: () => searchCatalogs(inside, { limit: 12 }),
    enabled: inside.length >= 2 && anyRead,
    staleTime: 60_000,
  })

  const read = (catalogs: Catalog[], restart = false) => setIndexing(catalogs.map((catalog) => ({ catalog, restart })))

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div data-tour="catalogs-header" className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-slate-900">Catalogs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your price books and manuals, read like the printed copy: tabs down the edge, find any part number,
            order straight from the page. Make{' '}
            <Link to="/reference-cards" className="font-medium text-sky-700 hover:underline">reference cards</Link>{' '}
            from a page so a part opens wherever its number comes up.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {unread.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => read(unread)} data-tour="catalogs-index-all" className="whitespace-nowrap">
              <IconScan size={16} className="mr-1.5" aria-hidden />
              Make {unread.length === 1 ? 'it' : `all ${unread.length}`} searchable
            </Button>
          )}
          {mayEdit && !adding && (
            <Button size="sm" onClick={() => setAdding(true)} data-tour="catalogs-add" className="whitespace-nowrap">
              + Add a catalog
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}{' '}
          <button type="button" onClick={() => setError(null)} className="ml-2 text-xs underline">Dismiss</button>
        </p>
      )}

      {adding && (
        <AddCatalog
          onDone={(catalog, file) => {
            setAdding(false)
            refresh()
            setIndexing([{ catalog, file }])
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {(all?.length ?? 0) > 0 && (
        <label data-tour="catalogs-search" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
          <IconSearch size={18} className="shrink-0 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a catalog, or a part number or words inside one"
            aria-label="Find a catalog, or search inside them"
            className="flex-1 bg-transparent py-2.5 text-sm placeholder:text-slate-400 focus:outline-none"
          />
        </label>
      )}

      {inside.length >= 2 && anyRead && (
        <section data-tour="catalogs-inside" aria-label="Found inside the catalogs" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Inside the catalogs{insideQ.data ? ` · ${insideQ.data.hits.length === 12 ? '12+' : insideQ.data.hits.length} found` : ''}
          </p>
          {insideQ.isLoading ? (
            <p className="px-1 py-2 text-sm text-slate-500">Looking…</p>
          ) : (insideQ.data?.hits.length ?? 0) === 0 ? (
            <p className="px-1 py-2 text-sm text-slate-500">Nothing on any page of the searchable catalogs.</p>
          ) : (
            <ul className="m-0 mt-1 list-none divide-y divide-slate-100 p-0">
              {insideQ.data!.hits.map((h) => (
                <li key={`${h.document_id}-${h.page}`}>
                  <button
                    type="button"
                    onClick={() => openCatalogs({ documentId: h.document_id, page: h.page })}
                    className="flex w-full items-start gap-3 rounded-lg px-1 py-2 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-600">p. {h.page_label}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-900">
                        {h.part ? <span className="mr-2 font-mono font-semibold">{h.part.code}</span> : null}
                        <Marked text={h.snippet ?? ''} />
                      </span>
                      <span className="block truncate text-xs text-slate-500">{[h.title, h.heading].filter(Boolean).join(' · ')}</span>
                    </span>
                    {h.part?.price_cents ? (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-800">
                        {(h.part.price_cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {unread.length > 0 && (
            <p className="px-1 pt-1 text-xs text-slate-500">
              {unread.length} {unread.length === 1 ? 'catalog is' : 'catalogs are'} not searchable yet.{' '}
              <button type="button" onClick={() => read(unread)} className="font-medium text-sky-700 hover:underline">Read {unread.length === 1 ? 'it' : 'them'}</button>
            </p>
          )}
        </section>
      )}

      {listQ.isError && (
        <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-700">The catalog library could not be loaded.</p>
        </div>
      )}

      {listQ.isLoading && (
        <div className="grid animate-pulse grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/4] rounded-xl bg-slate-100" />)}
        </div>
      )}

      {!listQ.isLoading && !listQ.isError && (
        <section data-tour="catalogs-shelf" data-count={mine.length}>
          {mine.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <IconBook2 size={32} className="mx-auto text-slate-300" aria-hidden />
              <p className="mt-2 text-sm text-slate-600">
                {query.trim()
                  ? `No catalog matches “${query.trim()}”.`
                  : mayEdit
                    ? 'No catalogs yet. Add a supplier’s price book or a manual as a PDF and it opens here as a book.'
                    : 'No catalogs yet.'}
              </p>
            </div>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {mine.map((catalog) => (
                <li key={catalog.id}>
                  <CatalogCard
                    catalog={catalog}
                    mayEdit={mayEdit}
                    editing={editing === catalog.id}
                    onEdit={() => setEditing(catalog.id)}
                    onEdited={() => {
                      setEditing(null)
                      refresh()
                    }}
                    onShare={(on) => share.mutate({ id: catalog.id, on })}
                    onIndex={(restart) => read([catalog], restart)}
                    onDelete={() => {
                      const cards = catalog.card_count > 0
                        ? ` ${catalog.card_count} reference ${catalog.card_count === 1 ? 'card points' : 'cards point'} into it; the cards stay, the links to it go.`
                        : ''
                      if (window.confirm(`Delete “${catalog.title}”?${cards}${catalog.customer_visible ? ' Your customers will stop seeing it.' : ''}`)) {
                        remove.mutate(catalog.id)
                      }
                    }}
                    onError={setError}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {indexing && (
        <CatalogIndexOverlay
          jobs={indexing}
          onClose={() => {
            setIndexing(null)
            refresh()
            void qc.invalidateQueries({ queryKey: ['catalog-search'] })
          }}
        />
      )}

      {shared.length > 0 && (
        <section data-tour="catalogs-shared">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Shared across CrewBarn</h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {shared.map((catalog) => (
              <li key={catalog.id}>
                <CatalogCard catalog={catalog} mayEdit={false} editing={false} onEdit={() => {}} onEdited={() => {}} onShare={() => {}} onDelete={() => {}} onError={setError} onIndex={(restart) => read([catalog], restart)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function CatalogCard({
  catalog,
  mayEdit,
  editing,
  onEdit,
  onEdited,
  onShare,
  onDelete,
  onError,
  onIndex,
}: {
  catalog: Catalog
  mayEdit: boolean
  editing: boolean
  onEdit: () => void
  onEdited: () => void
  onShare: (on: boolean) => void
  onDelete: () => void
  onError: (message: string | null) => void
  /** Read it for search; `restart` reads it again from page 1. */
  onIndex: (restart: boolean) => void
}) {
  const canChange = mayEdit && catalog.editable
  const tabs = catalog.tabs.length

  return (
    <article data-tour="catalogs-book" className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => openCatalogs({ documentId: catalog.id })}
        aria-label={`Open ${catalog.title}`}
        data-tour="catalogs-open"
        className="group relative block aspect-[4/3] w-full overflow-hidden bg-slate-100"
      >
        <Cover catalog={catalog} />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 pb-2 pt-6 text-left text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Open
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {editing ? (
          <EditCatalog catalog={catalog} onDone={onEdited} onError={onError} />
        ) : (
          <>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-slate-900" title={catalog.title}>{catalog.title}</h3>
                <p className="truncate text-xs text-slate-500">{catalog.vendor || (canChange ? 'Who it is from: not set' : ' ')}</p>
              </div>
              {canChange && (
                <button type="button" onClick={onEdit} aria-label={`Rename ${catalog.title}`} data-tour="catalogs-edit" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <IconPencil size={15} />
                </button>
              )}
            </div>

            <p className="text-xs text-slate-500">
              {[
                catalog.page_count ? `${catalog.page_count} pages` : null,
                formatSize(catalog.size_bytes),
              ].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs" data-tour="catalogs-tabs-status">
              {tabs > 0
                ? <span className="text-emerald-700">{tabs} {tabs === 1 ? 'tab' : 'tabs'} set</span>
                : <span className="text-slate-400">No tabs yet</span>}
              {catalog.card_count > 0 && (
                <span className="text-slate-500"> · {catalog.card_count} {catalog.card_count === 1 ? 'card' : 'cards'}</span>
              )}
            </p>
            <p className="text-xs text-slate-400">{lastOpened(catalog.last_opened_at)}</p>
            <SearchStatus catalog={catalog} onIndex={onIndex} />

            {catalog.mine && (
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-600" data-tour="catalogs-share">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!catalog.customer_visible}
                    aria-label="Share with customers"
                    disabled={!mayEdit}
                    onClick={() => onShare(!catalog.customer_visible)}
                    className={
                      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:opacity-50 '
                      + (catalog.customer_visible ? 'bg-emerald-600' : 'bg-slate-300')
                    }
                  >
                    <span
                      aria-hidden
                      className={'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ' + (catalog.customer_visible ? 'translate-x-[18px]' : 'translate-x-0.5')}
                    />
                  </button>
                  {catalog.customer_visible ? 'Customers can see it' : 'Share with customers'}
                </label>
                {canChange && (
                  <button type="button" onClick={onDelete} aria-label={`Delete ${catalog.title}`} data-tour="catalogs-delete" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-700">
                    <IconTrash size={15} />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  )
}

/** Whether search can find things in it: read, part read, or not yet. */
function SearchStatus({ catalog, onIndex }: { catalog: Catalog; onIndex: (restart: boolean) => void }) {
  const ix = catalog.index
  if (isSearchable(ix)) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700" data-tour="catalogs-searchable">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Searchable · {ix!.parts_found.toLocaleString()} part numbers
        <button type="button" onClick={() => onIndex(true)} className="ml-auto text-slate-400 hover:text-slate-700" title="Read it again from page 1">Re-read</button>
      </p>
    )
  }
  const part = ix && ix.current && ix.pages_done > 0
  return (
    <button
      type="button"
      onClick={() => onIndex(false)}
      data-tour="catalogs-make-searchable"
      className="flex items-center gap-1.5 self-start rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
    >
      <IconScan size={14} aria-hidden />
      {part ? `Read to page ${ix!.pages_done} of ${ix!.page_count} · carry on` : 'Make it searchable'}
    </button>
  )
}

/** Page 1, small. A book that has never been opened shows its name until it has one. */
function Cover({ catalog }: { catalog: Catalog }) {
  const q = useQuery({
    queryKey: ['catalog-cover', catalog.id, catalog.has_cover],
    queryFn: () => readImage(`/v1/catalogs/${catalog.id}/cover`),
    enabled: !!catalog.has_cover,
    staleTime: 60 * 60 * 1000,
  })
  const url = useObjectUrl(q.data ?? null)

  return url ? (
    <img src={url} alt="" className="h-full w-full object-contain object-top" />
  ) : (
    <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-200 to-slate-100 px-4 text-center">
      <IconBook2 size={30} className="text-slate-400" aria-hidden />
      <span className="line-clamp-2 text-xs font-medium text-slate-500">{catalog.title}</span>
    </span>
  )
}

function lastOpened(at: string | null): string {
  if (!at) return 'Not opened yet'
  const then = new Date(at)
  if (Number.isNaN(then.getTime())) return 'Not opened yet'
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'Opened today'
  if (days === 1) return 'Opened yesterday'
  if (days < 30) return `Opened ${days} days ago`
  return `Opened ${then.toLocaleDateString()}`
}

function EditCatalog({ catalog, onDone, onError }: { catalog: Catalog; onDone: () => void; onError: (m: string | null) => void }) {
  const [title, setTitle] = useState(catalog.title)
  const [vendor, setVendor] = useState(catalog.vendor ?? '')
  const save = useMutation({
    mutationFn: () => updateCatalog(catalog.id, { title: title.trim(), vendor: vendor.trim() || null }),
    onSuccess: () => {
      onError(null)
      onDone()
    },
    onError: (e) => onError((e as ApiError)?.message ?? 'That change did not save.'),
  })

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim()) save.mutate()
      }}
    >
      <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-label="Name" placeholder="Name" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
      <input value={vendor} maxLength={120} onChange={(e) => setVendor(e.target.value)} aria-label="Who it is from" placeholder="Who it is from (a supplier or brand)" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={!title.trim() || save.isPending} className="rounded bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50">Save</button>
      </div>
    </form>
  )
}

/**
 * Upload one PDF. Its cover and page count are worked out here, in the
 * browser that already has the file, and sent along after it -- the
 * server never opens a PDF.
 */
function AddCatalog({ onDone, onCancel }: { onDone: (catalog: Catalog, file: File) => void; onCancel: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [vendor, setVendor] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = (picked: File | undefined) => {
    setError(null)
    if (!picked) return
    if (picked.type !== 'application/pdf' && !/\.pdf$/i.test(picked.name)) {
      setError('Only PDF files can go in the catalog library.')
      return
    }
    if (picked.size > LIMITS.documentMb * 1024 * 1024) {
      setError(`That file is ${formatSize(picked.size)}. The most one catalog takes is ${LIMITS.documentMb} MB — a catalog that size usually splits into sections.`)
      return
    }
    setFile(picked)
    setTitle(picked.name.replace(/\.pdf$/i, ''))
  }

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first.')
      setProgress(0)
      const catalog = await uploadCatalogPdf<Catalog>(file, {
        title: title.trim(),
        vendor: vendor.trim() || undefined,
        onProgress: setProgress,
      })
      // The shelf picture. A catalog without one still works; it gets one when first opened.
      await saveCatalogCover(catalog.id, file)
      return { catalog, file }
    },
    // Read straight away, from the file in hand: it is searchable the moment it lands.
    onSuccess: ({ catalog, file: uploaded }) => onDone(catalog, uploaded),
    onError: (e) => setError((e as Error).message),
    onSettled: () => setProgress(null),
  })

  return (
    <section data-tour="catalogs-upload" className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Add a catalog</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        A PDF up to {LIMITS.documentMb} MB: a supplier’s price book, a parts list, a manual. Only share it with
        customers if you are allowed to.
      </p>

      {error && <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}

      {!file ? (
        <>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              choose(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="inline-flex items-center gap-1.5 rounded border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-400 hover:bg-sky-50"
            >
              <IconUpload size={16} />
              Choose a PDF
            </button>
            <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-800">Cancel</button>
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
              <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Who it is from</span>
              <input value={vendor} maxLength={120} onChange={(e) => setVendor(e.target.value)} placeholder="A supplier or brand" className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm" />
            </label>
          </div>
          <p className="text-xs text-slate-500">{file.name} · {formatSize(file.size)}</p>

          {progress !== null ? (
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-sky-600 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Storing it and drawing its cover…'}</p>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFile(null)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Choose another</button>
              <button type="button" onClick={onCancel} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <Button size="sm" type="button" disabled={title.trim() === ''} onClick={() => upload.mutate()}>Upload</Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
