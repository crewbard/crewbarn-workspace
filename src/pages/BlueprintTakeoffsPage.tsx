import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconFileUpload, IconLoader2 } from '@tabler/icons-react'
import { useVendors } from '@/hooks/useVendors'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { CATALOGS_KEY, loadCatalogs } from '@/lib/catalogs'
import { isSearchable } from '@/lib/catalogIndex'
import { count, money } from '@/lib/catalogOrders'
import {
  TAKEOFFS_KEY,
  getTakeoff,
  lessDiscount,
  listTakeoffs,
  openBlueprintFile,
  orderTakeoff,
  priceFromCatalogs,
  readTakeoffAgain,
  setTakeoffVendor,
  uploadBlueprint,
  type CatalogPrice,
  type OrderLine,
  type Takeoff,
  type TakeoffLine,
  type TakeoffKind,
  type TakeoffStatus,
} from '@/lib/blueprints'
import { CatalogItemQuickCreate } from '@/components/CatalogItemQuickCreate'
import type { CatalogItem } from '@/types/catalogItem'
import '@/components/inventory/bins/bins.css'

/**
 * Parts from a blueprint. Upload a drawing or a door hardware schedule; the
 * company's AI reads the parts off it; they are priced from the vendor's
 * catalog here in the browser; the office checks the list and it becomes a
 * draft purchase order -- on the job or estimate it was started from.
 */

const STATUS: Record<TakeoffStatus, { label: string; tone: string }> = {
  reading: { label: 'Reading…', tone: 'bg-sky-100 text-sky-800' },
  ready: { label: 'Ready to check', tone: 'bg-amber-100 text-amber-900' },
  failed: { label: 'Not read', tone: 'bg-red-100 text-red-800' },
  ordered: { label: 'Draft PO made', tone: 'bg-emerald-100 text-emerald-800' },
}

const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp'

function StatusPill({ status }: { status: TakeoffStatus }) {
  const s = STATUS[status]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.tone}`}>{s.label}</span>
}

function forLabel(t: Pick<Takeoff, 'work_order' | 'estimate'>): string | null {
  if (t.work_order) return `Job #${t.work_order.number}`
  if (t.estimate) return `Estimate ${t.estimate.number}`
  return null
}

/** /purchase-orders/blueprints -- upload one, and the ones read lately. */
export function BlueprintTakeoffsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const workOrderId = params.get('work_order_id') ?? undefined
  const estimateId = params.get('estimate_id') ?? undefined
  const forWhat = params.get('for') ?? (workOrderId ? 'this job' : estimateId ? 'this estimate' : null)
  const { hasAny } = usePermissions()
  const canEdit = hasAny([PERM.INVENTORY_EDIT, PERM.JOBS_EDIT])

  const list = useQuery({
    queryKey: [...TAKEOFFS_KEY, workOrderId ?? '', estimateId ?? ''],
    queryFn: () => listTakeoffs({ work_order_id: workOrderId, estimate_id: estimateId }),
    refetchInterval: (q) => (q.state.data?.data.some((t) => t.status === 'reading') ? 5000 : false),
  })
  const vendors = useVendors({ active: true, per_page: 200 })
  const catalogs = useQuery({ queryKey: CATALOGS_KEY, queryFn: loadCatalogs })
  const withCatalogs = useMemo(() => new Set((catalogs.data?.catalogs ?? []).map((c) => c.vendor_id).filter(Boolean)), [catalogs.data])

  const [file, setFile] = useState<File | null>(null)
  const [vendorId, setVendorId] = useState('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TakeoffKind>(params.get('kind') === 'vendor_document' ? 'vendor_document' : 'blueprint')
  const isDoc = kind === 'vendor_document'
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const unavailable = list.data?.unavailable ?? null
  const rows = list.data?.data ?? []

  const pick = (f: File | undefined | null) => {
    if (!f) return
    setError(null)
    if (f.size > 32 * 1024 * 1024) {
      setError('That file is over 32 MB. Upload the sheets with the parts on them, or the hardware schedule.')
      return
    }
    setFile(f)
  }

  const send = async () => {
    if (!file) return
    setError(null)
    setProgress(0)
    try {
      const t = await uploadBlueprint(file, {
        title: title.trim() || undefined,
        vendor_id: vendorId || undefined,
        work_order_id: workOrderId,
        estimate_id: estimateId,
        kind,
      }, setProgress)
      navigate(`/purchase-orders/blueprints/${t.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The upload did not go through.')
      setProgress(null)
    }
  }

  return (
    <div data-focus-page="blueprint-takeoffs" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <Link to="/purchase-orders" className="text-sm text-slate-500 hover:text-slate-800">← Purchase orders</Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Parts from a blueprint</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Upload a blueprint or a door hardware schedule. CBI reads the parts off it, they are priced from your vendor&apos;s catalog,
          and you check the list before it becomes a draft purchase order. Nothing is ordered on its own.
        </p>
      </div>

      {canEdit && (
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div role="radiogroup" aria-label="What are you uploading" data-tour="bp-kind" data-bins-ui="" className="mb-3 inline-flex rounded-lg border border-[var(--bins-border)] bg-[var(--bins-soft)] p-0.5 text-sm">
            {([['blueprint', 'A blueprint'], ['vendor_document', 'A vendor invoice or PO']] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={`rounded-md px-3 py-1.5 font-medium ${kind === k ? 'bg-[var(--bins-surface)] text-[var(--bins-text)] shadow-sm' : 'text-[var(--bins-text-2)]'}`}>
                {label}
              </button>
            ))}
          </div>
          {isDoc && (
            <p data-bins-ui="" className="mb-3 max-w-3xl text-sm text-[var(--bins-text-2)]">
              CBI reads each line (their part #, what it is, qty, price) and matches it to your products by that vendor&apos;s part number, then your SKU or the name.
              Lines it can&apos;t match get a Create product button. Nothing is ordered or stocked on its own.
            </p>
          )}
          {forWhat && (
            <p className="mb-3 text-sm text-slate-700">
              The draft PO will be for <span className="font-semibold">{forWhat}</span>.
            </p>
          )}
          {unavailable ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{unavailable}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]) }}
                className={`flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  dragging ? 'border-amber-500 bg-amber-50' : 'border-slate-300 bg-slate-50 hover:border-amber-400 hover:bg-amber-50/60'
                }`}
              >
                <IconFileUpload size={28} stroke={1.5} className="text-slate-500" />
                {file ? (
                  <>
                    <span className="max-w-full truncate text-sm font-medium text-slate-900">{file.name}</span>
                    <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB · click to choose another</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-slate-800">{isDoc ? 'Drop the invoice or PO here, or click to choose it' : 'Drop the blueprint here, or click to choose it'}</span>
                    <span className="text-xs text-slate-500">PDF or a photo (PNG, JPG), up to 32 MB. A big set reads best as just the schedule sheets.</span>
                  </>
                )}
              </button>
              <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />

              <div className="flex flex-col gap-3">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Vendor</span>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">{isDoc ? 'Read it off the document' : 'Choose later'}</option>
                    {(vendors.data?.data ?? []).map((v) => (
                      <option key={v.id} value={v.id}>{v.label}{withCatalogs.has(v.id) ? ' · has a catalog' : ''}</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-slate-500">Prices come from this vendor&apos;s catalogs and what you have paid them.</span>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Name it <span className="font-normal text-slate-400">(optional)</span></span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={file ? file.name.replace(/\.[^.]+$/, '') : 'Harbor Medical, 2nd floor doors'}
                    maxLength={200}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </label>
                <button
                  type="button"
                  disabled={!file || progress !== null}
                  onClick={() => void send()}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {progress !== null && <IconLoader2 size={16} className="animate-spin" />}
                  {progress === null ? (isDoc ? 'Read the lines off it' : 'Read the parts off it') : progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : 'Starting the read…'}
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </section>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Read lately</h2>
      {list.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">No blueprints yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Blueprint</th>
                <th className="px-3 py-2 font-medium">Where it stands</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 text-right font-medium">Parts</th>
                <th className="px-3 py-2 font-medium">For</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => (
                <tr key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/purchase-orders/blueprints/${t.id}`)}>
                  <td className="px-3 py-2">
                    <Link to={`/purchase-orders/blueprints/${t.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-900 hover:underline">{t.title}</Link>
                    {t.kind === 'vendor_document' && <span data-bins-ui="" className="ml-2 rounded bg-[var(--bins-accent-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--bins-accent-ink)]">Vendor document{t.document_number ? ` #${t.document_number}` : ''}</span>}
                    <div className="text-xs text-slate-500">{[t.created_by, t.created_at && new Date(t.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={t.status} />
                    {t.purchase_order && <span className="ml-2 font-mono text-xs text-slate-600">{t.purchase_order.po_number}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{t.vendor?.label ?? <span className="text-slate-400">Not chosen</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.status === 'reading' ? '…' : t.line_count ?? 0}</td>
                  <td className="px-3 py-2 text-slate-700">{forLabel(t) ?? <span className="text-slate-400">Stock</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** What was changed on a line here, over what was read. */
type Edit = { include: boolean; qty: string; part: string; desc: string; cost: string }
type Row = TakeoffLine & Edit

const toRow = (l: TakeoffLine, e?: Partial<Edit>): Row => ({
  ...l,
  include: e?.include ?? true,
  qty: e?.qty ?? count(l.quantity),
  part: e?.part ?? l.part_number ?? '',
  desc: e?.desc ?? l.description ?? '',
  cost: e?.cost ?? '',
})

type Progress = { catalog: string; done: number; total: number; downloading?: number | null }

/** Dollars as typed ("12", "12.5", "$1,204.00") to cents; null when it isn't a price. */
function cents(text: string): number | null {
  const t = text.replace(/[$,\s]/g, '')
  if (t === '' || !/^\d+(\.\d{0,2})?$/.test(t)) return null
  return Math.round(parseFloat(t) * 100)
}

type Price = { cents: number | null; how: string; source: OrderLine['price_source']; list?: number; found?: CatalogPrice }

/** What a line will cost on the order, and why -- the same order the server takes them in. */
function priceOf(row: Row, found: CatalogPrice | undefined, discount: number | null | undefined): Price {
  const typed = cents(row.cost)
  if (typed !== null) return { cents: typed, how: 'You set it', source: 'typed' }
  if (row.price_source === 'document' && row.unit_cost_cents != null) return { cents: row.unit_cost_cents, how: 'On the document', source: 'document' }
  if (found) return { cents: lessDiscount(found.list_price_cents, discount), how: `${found.catalog_title}, p. ${found.source_page_label}`, source: 'catalog', list: found.list_price_cents, found }
  const vp = row.vendor_price
  if (vp?.list_price_cents != null) return { cents: lessDiscount(vp.list_price_cents, discount), how: 'Their list price', source: 'list', list: vp.list_price_cents }
  if (vp?.last_cost_cents != null) return { cents: vp.last_cost_cents, how: 'Last price paid', source: 'last' }
  if (row.catalog_item?.owner_cost_cents != null) return { cents: row.catalog_item.owner_cost_cents, how: 'Your cost', source: 'item' }
  return { cents: null, how: 'No price yet', source: null }
}

/** The prices the server found in the vendor's searchable catalogs, as the page's own lookups are kept. */
function fromIndex(lines: TakeoffLine[]): Record<string, CatalogPrice> {
  const out: Record<string, CatalogPrice> = {}
  for (const l of lines) {
    const c = l.catalog_price
    if (c) out[l.key] = { list_price_cents: c.list_price_cents, source_document_id: c.document_id, source_page: c.page, source_page_label: c.page_label, catalog_title: c.title }
  }
  return out
}

/** /purchase-orders/blueprints/:id -- check what was read, price it, make the draft PO. */
export function BlueprintTakeoffPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { hasAny } = usePermissions()
  const canEdit = hasAny([PERM.INVENTORY_EDIT, PERM.JOBS_EDIT])

  const q = useQuery({
    queryKey: [...TAKEOFFS_KEY, 'one', id],
    queryFn: () => getTakeoff(id),
    refetchInterval: (query) => (query.state.data?.status === 'reading' ? 4000 : false),
  })
  const t = q.data
  const vendors = useVendors({ active: true, per_page: 200 })
  const catalogs = useQuery({ queryKey: CATALOGS_KEY, queryFn: loadCatalogs })
  const vendorId = t?.vendor?.id ?? null
  const allVendorCatalogs = (catalogs.data?.catalogs ?? []).filter((c) => vendorId !== null && c.vendor_id === vendorId)
  // A searchable catalog was priced on the server already; only the others are opened here.
  const vendorCatalogs = allVendorCatalogs.filter((c) => !isSearchable(c.index))

  const [edits, setEdits] = useState<Record<string, Partial<Edit>>>({})
  const [progress, setProgress] = useState<Progress | null>(null)
  // "Look again": the part numbers as they stand now, and a new lookup.
  const [look, setLook] = useState<{ n: number; lines: TakeoffLine[] | null }>({ n: 0, lines: null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Products made here from an unmatched line, by line key.
  const [made, setMade] = useState<Record<string, { id: string; name: string; owner_cost_cents: number | null }>>({})
  const [creating, setCreating] = useState<Row | null>(null)

  const rows = (t?.lines ?? []).map((l) => toRow(made[l.key] ? { ...l, catalog_item: made[l.key], match_by: null } : l, edits[l.key]))

  /*
   * Priced from the vendor's catalogs once the list is in, and again when
   * the vendor changes. Leaving the page, or choosing another vendor, stops
   * the lookup part way.
   */
  const prices = useQuery({
    queryKey: ['blueprint-prices', t?.id, vendorId, vendorCatalogs.map((c) => c.id).join(','), t?.read_at, look.n],
    queryFn: ({ signal }) => {
      setProgress(null)
      return priceFromCatalogs(look.lines ?? t!.lines, vendorCatalogs, setProgress, () => signal.aborted)
    },
    enabled: !!t && t.status === 'ready' && vendorCatalogs.length > 0,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  })
  const found: Record<string, CatalogPrice> = { ...fromIndex(t?.lines ?? []), ...(prices.data ?? {}) }
  const pricing = prices.isFetching ? progress ?? { catalog: vendorCatalogs[0]?.title ?? 'the catalog', done: 0, total: 0, downloading: 0 } : null

  if (q.isLoading) return <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-slate-500">Loading…</div>
  if (!t) return <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-red-700">That blueprint is gone.</div>

  const ordered = t.status === 'ordered'
  const discount = t.vendor?.list_discount_pct
  const priced = rows.map((r) => ({ row: r, price: priceOf(r, found[r.key], discount) }))
  const kept = priced.filter((p) => p.row.include)
  const total = kept.reduce((sum, p) => sum + (p.price.cents ?? 0) * (parseFloat(p.row.qty) || 0), 0)
  const unpriced = kept.filter((p) => p.price.cents === null).length
  const editable = canEdit && t.status === 'ready'

  const change = (key: string, patch: Partial<Edit>) => setEdits((all) => ({ ...all, [key]: { ...all[key], ...patch } }))

  const lookAgain = () => setLook((l) => ({ n: l.n + 1, lines: rows.map((r) => ({ ...r, part_number: r.part.trim() || null })) }))

  const chooseVendor = async (next: string) => {
    setError(null)
    setBusy(true)
    try {
      qc.setQueryData([...TAKEOFFS_KEY, 'one', id], await setTakeoffVendor(id, next || null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The vendor did not change.')
    } finally {
      setBusy(false)
    }
  }

  const readAgain = async () => {
    setError(null)
    setBusy(true)
    try {
      qc.setQueryData([...TAKEOFFS_KEY, 'one', id], await readTakeoffAgain(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'It could not be read again.')
    } finally {
      setBusy(false)
    }
  }

  const makeOrder = async () => {
    const lines: OrderLine[] = kept.map(({ row, price }) => ({
      part_number: row.part.trim() || null,
      description: row.desc.trim() || null,
      quantity: Math.max(0.01, parseFloat(row.qty) || 1),
      where: row.where,
      catalog_item_id: row.catalog_item?.id ?? null,
      unit_cost_cents: price.cents,
      price_source: price.source,
      list_price_cents: price.list ?? null,
      source_document_id: price.found?.source_document_id ?? null,
      source_page: price.found?.source_page ?? null,
      source_page_label: price.found?.source_page_label ?? null,
    }))
    setError(null)
    setBusy(true)
    try {
      const res = await orderTakeoff(id, t.vendor?.id ?? null, lines)
      void qc.invalidateQueries({ queryKey: TAKEOFFS_KEY })
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      navigate(`/purchase-orders/${res.purchase_order.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The order was not made.')
      setBusy(false)
    }
  }

  const forWhat = forLabel(t)
  const isDoc = t.kind === 'vendor_document'
  const matchLabel = { vendor_sku: `${t.vendor?.label ?? 'Vendor'} part #`, shop_sku: 'your SKU', name: 'the name' } as const

  // The vendor's number is saved by the New product window itself (its vendor rows), once.
  const created = (row: Row, item: CatalogItem) => {
    setCreating(null)
    setMade((m) => ({ ...m, [row.key]: { id: item.id, name: item.name, owner_cost_cents: item.pricing?.owner_cost_cents ?? null } }))
  }

  return (
    <div data-focus-page="blueprint-takeoff" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link to="/purchase-orders/blueprints" className="text-sm text-slate-500 hover:text-slate-800">← Parts from a blueprint</Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900 [text-wrap:balance]">{t.title}</h1>
          {isDoc && (
            <p data-bins-ui="" data-tour="bp-doc-meta" className="mt-1 text-sm text-[var(--bins-text-2)]">
              Vendor document{t.document_number ? ` #${t.document_number}` : ''}
              {t.vendor_name_read ? ` · printed vendor: ${t.vendor_name_read}` : ''}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <StatusPill status={t.status} />
            <button type="button" onClick={() => void openBlueprintFile(t.id).catch((e: Error) => setError(e.message))} className="text-amber-700 underline underline-offset-2 hover:text-amber-900">
              Open the drawing
            </button>
            {t.work_order && <Link to={`/jobs/${t.work_order.id}`} className="underline underline-offset-2">{forWhat}</Link>}
            {t.estimate && <Link to={`/estimates/${t.estimate.id}`} className="underline underline-offset-2">{forWhat}</Link>}
            {!forWhat && <span className="text-slate-500">For stock</span>}
          </div>
        </div>
        {t.purchase_order && (
          <Link to={`/purchase-orders/${t.purchase_order.id}`} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Open {t.purchase_order.po_number}
          </Link>
        )}
      </div>

      {t.status === 'reading' && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
          <IconLoader2 size={20} className="mt-0.5 shrink-0 animate-spin" />
          <div>
            <p className="font-medium">Reading the drawing…</p>
            <p className="mt-0.5 text-sky-800">A big set or a long hardware schedule takes a minute or two. You can leave this page: the bell tells you when it&apos;s done.</p>
          </div>
        </div>
      )}

      {t.status === 'failed' && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900">
          <p className="font-medium">It wasn&apos;t read.</p>
          <p className="mt-0.5">{t.error}</p>
          {canEdit && (
            <button type="button" disabled={busy} onClick={() => void readAgain()} className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-800 hover:bg-red-100 disabled:opacity-50">
              Read it again
            </button>
          )}
        </div>
      )}

      {(t.status === 'ready' || ordered) && (
        <>
          {(t.summary || t.uncertain.length > 0) && (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {t.summary && <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{t.summary}</p>}
              {t.uncertain.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-medium">Check these against the drawing</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {t.uncertain.map((u) => <li key={u}>{u}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Vendor</span>
              <select
                value={t.vendor?.id ?? ''}
                disabled={!editable || busy}
                onChange={(e) => void chooseVendor(e.target.value)}
                className="min-w-56 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:bg-slate-100"
              >
                <option value="">Not chosen yet</option>
                {(vendors.data?.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </label>
            <div className="min-w-0 flex-1 text-sm text-slate-600">
              {pricing ? (
                <span className="inline-flex items-center gap-2 text-slate-800">
                  <IconLoader2 size={16} className="animate-spin" />
                  {pricing.downloading !== undefined
                    ? `Opening ${pricing.catalog}${pricing.downloading ? ` (${Math.round(pricing.downloading * 100)}%)` : ''}…`
                    : `Looking up prices in ${pricing.catalog}: ${pricing.done} of ${pricing.total}`}
                </span>
              ) : !t.vendor ? (
                'Choose the vendor to price the parts from their catalog.'
              ) : allVendorCatalogs.length === 0 ? (
                <>No catalog for {t.vendor.label} yet. Add one on <Link to="/vendors" className="underline">Vendors</Link>, or type the prices in.</>
              ) : (
                <>
                  {Object.keys(found).length} of {rows.filter((r) => r.part.trim()).length} part numbers found in {allVendorCatalogs.map((c) => c.title).join(', ')}
                  {discount != null ? `, priced at list less ${discount}%` : ', priced at list (no discount set for this vendor)'}.
                  {editable && vendorCatalogs.length > 0 && (
                    <button type="button" onClick={lookAgain} className="ml-2 text-amber-700 underline underline-offset-2 hover:text-amber-900">Look again</button>
                  )}
                </>
              )}
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">{t.error ?? 'No parts were found on it.'}</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-2 font-medium"><span className="sr-only">Keep</span></th>
                    <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
                    <th className="px-2 py-2 font-medium">Part number</th>
                    <th className="px-2 py-2 font-medium">What it is, and where</th>
                    <th className="w-32 px-2 py-2 text-right font-medium">Each</th>
                    <th className="px-3 py-2 font-medium">Price from</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Line</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {priced.map(({ row, price }) => {
                    const line = price.cents !== null ? price.cents * (parseFloat(row.qty) || 0) : null
                    return (
                      <tr key={row.key} className={row.include ? '' : 'bg-slate-50 text-slate-400'}>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={row.include}
                            disabled={!editable}
                            onChange={(e) => change(row.key, { include: e.target.checked })}
                            aria-label={`Keep ${row.part || row.desc}`}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <input value={row.qty} disabled={!editable || !row.include} onChange={(e) => change(row.key, { qty: e.target.value })} inputMode="decimal" className="w-16 rounded border border-slate-300 px-2 py-1 text-right tabular-nums disabled:border-transparent disabled:bg-transparent" />
                          {row.unit && row.unit !== 'ea' && <div className="mt-0.5 text-right text-xs text-slate-500">{row.unit}</div>}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <input value={row.part} disabled={!editable || !row.include} onChange={(e) => change(row.key, { part: e.target.value })} placeholder="—" className="w-40 rounded border border-slate-300 px-2 py-1 font-mono text-xs disabled:border-transparent disabled:bg-transparent" />
                          <div className="mt-0.5 text-xs text-slate-500">{[row.manufacturer, row.finish && `finish ${row.finish}`].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td className="px-2 py-2 align-top">
                          <input value={row.desc} disabled={!editable || !row.include} onChange={(e) => change(row.key, { desc: e.target.value })} className="w-full min-w-48 rounded border border-slate-300 px-2 py-1 disabled:border-transparent disabled:bg-transparent" />
                          {row.where && <div className="mt-0.5 text-xs text-slate-500">{row.where}</div>}
                          {row.catalog_item && <div className="mt-0.5 text-xs text-emerald-700">You stock this: {row.catalog_item.name}{row.match_by ? ` (matched by ${matchLabel[row.match_by]})` : ''}</div>}
                          {!row.catalog_item && isDoc && editable && row.include && (
                            <button type="button" data-bins-ui="" data-tour="bp-create-product" onClick={() => setCreating(row)}
                              className="mt-1 rounded border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--bins-accent-ink)]">
                              Not in your products: Create product
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top text-right">
                          <input
                            value={row.cost}
                            disabled={!editable || !row.include}
                            onChange={(e) => change(row.key, { cost: e.target.value })}
                            placeholder={price.cents !== null && cents(row.cost) === null ? money(price.cents) : '$0.00'}
                            inputMode="decimal"
                            aria-label="Price each"
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right tabular-nums placeholder:text-slate-700 disabled:border-transparent disabled:bg-transparent"
                          />
                          {price.list !== undefined && <div className="mt-0.5 text-xs text-slate-500">list {money(price.list)}</div>}
                        </td>
                        <td className="px-3 py-2 align-top text-xs">
                          <span className={price.cents === null ? 'font-medium text-red-700' : 'text-slate-600'}>{price.how}</span>
                        </td>
                        <td className="px-3 py-2 align-top text-right tabular-nums text-slate-800">{line !== null ? money(line) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {editable && rows.length > 0 && (
            <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
              <span className="text-sm text-slate-600">
                {kept.length} of {rows.length} lines · <span className="font-semibold tabular-nums text-slate-900">{money(total)}</span>
                {unpriced > 0 && <span className="text-red-700"> · {unpriced} without a price</span>}
              </span>
              <button
                type="button"
                disabled={busy || kept.length === 0 || !!pricing}
                onClick={() => void makeOrder()}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Make the draft PO{t.vendor ? ` for ${t.vendor.label}` : ''}
              </button>
            </div>
          )}
        </>
      )}

      {creating && (
        <CatalogItemQuickCreate
          title="New product from the vendor document"
          defaultName={creating.desc}
          defaultUnitCostCents={creating.unit_cost_cents ?? 0}
          defaultSupplierName={t.vendor?.label ?? t.vendor_name_read ?? ''}
          defaultVendorNumbers={t.vendor ? [{ vendor_id: t.vendor.id, vendor_sku: creating.part.trim() }] : undefined}
          stockComesFromPo
          onCreated={(item) => created(creating, item)}
          onClose={() => setCreating(null)}
        />
      )}
      {prices.error && <p className="mt-3 text-sm text-red-700">The catalog could not be read: {prices.error instanceof Error ? prices.error.message : 'try again'}.</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  )
}
