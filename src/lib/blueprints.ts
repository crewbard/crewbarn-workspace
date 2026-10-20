import { sendApiUpload } from '@/lib/api'
import { API_URL, apiRequest, getActingTenant, getStoredToken } from '@/lib/api'
import { isFileResponse, NOT_A_FILE_MESSAGE } from '@/lib/fileResponse'
import { authHeaders, readCatalogFile } from '@/lib/referenceCardDocuments'
import type { Catalog } from '@/lib/catalogs'

/**
 * Parts from a blueprint (/v1/blueprint-takeoffs).
 *
 * The company's AI reads the parts off an uploaded blueprint on the server.
 * Pricing them from the vendor's catalog happens here, in the browser, the
 * same way the catalog viewer does it: the server never opens a catalog.
 * The checked list then goes back as a draft purchase order.
 */

export type TakeoffStatus = 'reading' | 'ready' | 'failed' | 'ordered'

export type TakeoffLine = {
  key: string
  part_number: string | null
  manufacturer: string | null
  description: string | null
  finish: string | null
  quantity: number
  unit: string | null
  where: string | null
  /** The shop's own item with this part number, when exactly one has it. */
  catalog_item: { id: string; name: string; owner_cost_cents: number | null } | null
  /** What this vendor has charged for it before. */
  vendor_price: { list_price_cents: number | null; last_cost_cents: number | null } | null
  /** Its printed price in the vendor's own catalogs, where they are searchable (CatalogIndex). */
  catalog_price?: { list_price_cents: number; document_id: string; page: number; page_label: string; title: string } | null
  /** A vendor invoice or PO: the price printed on it. */
  unit_cost_cents?: number | null
  price_source?: 'document' | null
  /** How catalog_item was found: the vendor's part number on their list, the shop's SKU, or the exact name. */
  match_by?: 'vendor_sku' | 'shop_sku' | 'name' | null
}

/** A blueprint, or a vendor's invoice / PO read the same way. */
export type TakeoffKind = 'blueprint' | 'vendor_document'

export type Takeoff = {
  id: string
  title: string
  original_filename: string
  mime_type: string
  size_bytes: number
  status: TakeoffStatus
  kind?: TakeoffKind
  /** A vendor document: its invoice / order number, and the vendor name printed on it. */
  document_number?: string | null
  vendor_name_read?: string | null
  error: string | null
  summary: string | null
  lines: TakeoffLine[]
  uncertain: string[]
  vendor: { id: string; label: string; list_discount_pct: number | null } | null
  work_order: { id: string; number: number | string; title: string | null } | null
  estimate: { id: string; number: string; title: string | null; status: string } | null
  purchase_order: { id: string; po_number: string; status: string } | null
  created_by: string | null
  created_at: string | null
  read_at: string | null
  line_count?: number
}

/** A price found printed on a catalog page. */
export type CatalogPrice = {
  list_price_cents: number
  source_document_id: string
  source_page: number
  source_page_label: string
  catalog_title: string
}

/** One line as sent to make the order. */
export type OrderLine = {
  part_number: string | null
  description: string | null
  quantity: number
  where: string | null
  catalog_item_id?: string | null
  /** The price shown on the review page: what was checked is what is ordered. */
  unit_cost_cents?: number | null
  price_source?: 'typed' | 'catalog' | 'list' | 'last' | 'item' | 'document' | null
  list_price_cents?: number | null
  source_document_id?: string | null
  source_page?: number | null
  source_page_label?: string | null
}

export const TAKEOFFS_KEY = ['blueprint-takeoffs'] as const

export const listTakeoffs = (params: { work_order_id?: string; estimate_id?: string } = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString()
  return apiRequest<{ data: Takeoff[]; unavailable: string | null }>(`/v1/blueprint-takeoffs${q ? `?${q}` : ''}`)
}

export const getTakeoff = (id: string) =>
  apiRequest<{ data: Takeoff }>(`/v1/blueprint-takeoffs/${id}`).then((r) => r.data)

export const setTakeoffVendor = (id: string, vendorId: string | null) =>
  apiRequest<{ data: Takeoff }>(`/v1/blueprint-takeoffs/${id}`, { method: 'PATCH', body: { vendor_id: vendorId } }).then((r) => r.data)

export const readTakeoffAgain = (id: string) =>
  apiRequest<{ data: Takeoff }>(`/v1/blueprint-takeoffs/${id}/read`, { method: 'POST' }).then((r) => r.data)

export const orderTakeoff = (id: string, vendorId: string | null, lines: OrderLine[]) =>
  apiRequest<{ data: Takeoff; purchase_order: { id: string; po_number: string } }>(`/v1/blueprint-takeoffs/${id}/order`, {
    method: 'POST',
    body: { vendor_id: vendorId, lines },
  })

/** Upload a blueprint; the server starts reading it. Reports how far the upload has got. */
export function uploadBlueprint(
  file: File,
  fields: { title?: string; vendor_id?: string; work_order_id?: string; estimate_id?: string; kind?: TakeoffKind },
  onProgress?: (fraction: number) => void,
): Promise<Takeoff> {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/v1/blueprint-takeoffs`)
    xhr.setRequestHeader('Accept', 'application/json')
    const token = getStoredToken()

    const acting = getActingTenant()
    if (acting) xhr.setRequestHeader('X-Act-As-Tenant', acting)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    const complete = (status: number, responseText: string) => {
      let body: { data?: Takeoff; message?: string } = {}
      try {
        body = JSON.parse(responseText)
      } catch {
        // Not JSON: a proxy refused it before the API saw it.
      }
      if (status === 201 && body.data) {
        resolve(body.data)
        return
      }
      reject(new Error(body.message ?? (status === 413 ? 'That file is bigger than the server accepts.' : `The upload did not go through (HTTP ${status}).`)))
    }
    xhr.onload = () => complete(xhr.status, xhr.responseText)
    xhr.onerror = () => reject(new Error('The upload lost its connection. Nothing was saved.'))
    void sendApiUpload(xhr, `${API_URL}/v1/blueprint-takeoffs`, token, form, complete).catch(reject)
  })
}

/** The drawing itself, opened in a new tab. */
export async function openBlueprintFile(id: string): Promise<void> {
  const tab = window.open('', '_blank')
  const res = await fetch(`${API_URL}/v1/blueprint-takeoffs/${id}/file`, { headers: authHeaders('application/pdf, image/*') })
  if (!res.ok || !isFileResponse(res)) {
    tab?.close()
    throw new Error(res.ok ? NOT_A_FILE_MESSAGE : 'The drawing could not be opened.')
  }
  const url = URL.createObjectURL(await res.blob())
  if (tab) tab.location.href = url
  else window.location.href = url
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const foldCode = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** What to look a line up by: its part number, then the first word of it ("ND50PD RHO" → "ND50PD"). */
function lookups(part: string): string[] {
  const out = [part.trim()]
  const first = part.trim().split(/\s+/)[0] ?? ''
  if (first !== out[0] && /\d/.test(first) && foldCode(first).length >= 4) out.push(first)
  return out
}

/**
 * Price each line from the vendor's catalogs: the line's part number found
 * on a page, with the price printed on its row. The best match wins: the
 * very part number over one that contains it, the earliest page after that.
 * Lines with no part number, or none found, are left out of the answer.
 */
export async function priceFromCatalogs(
  lines: TakeoffLine[],
  catalogs: Catalog[],
  report: (progress: { catalog: string; done: number; total: number; downloading?: number | null }) => void,
  stopped: () => boolean,
): Promise<Record<string, CatalogPrice>> {
  const found: Record<string, CatalogPrice> = {}
  const wanted = lines.filter((l) => (l.part_number ?? '').trim() !== '')
  const { openBook } = await import('@/components/magazine/pdfBook')

  for (const catalog of catalogs) {
    const left = wanted.filter((l) => !found[l.key])
    if (left.length === 0 || stopped()) break
    report({ catalog: catalog.title, done: 0, total: left.length, downloading: 0 })

    const bytes = await readCatalogFile(catalog.id, {
      expectedBytes: catalog.size_bytes,
      onProgress: (p) => report({ catalog: catalog.title, done: 0, total: left.length, downloading: p.total ? p.loaded / p.total : null }),
    })
    const book = await openBook(bytes)
    try {
      const numbers = await book.pageNumbers().catch(() => null)
      let done = 0
      for (const line of left) {
        if (stopped()) break
        for (const query of lookups(line.part_number!)) {
          const hits = await book.search(query, () => {}, stopped, 40)
          const priced = hits
            .filter((h) => h.score >= 3 && h.part?.price !== undefined && h.part.price > 0)
            .sort((a, b) => b.score - a.score || a.page - b.page)[0]
          if (priced) {
            found[line.key] = {
              list_price_cents: priced.part!.price!,
              source_document_id: catalog.id,
              source_page: priced.page,
              source_page_label: numbers?.label(priced.page) ?? String(priced.page),
              catalog_title: catalog.title,
            }
            break
          }
        }
        done++
        report({ catalog: catalog.title, done, total: left.length })
      }
    } finally {
      book.destroy()
    }
  }

  return found
}

/** List less the vendor's discount, to the cent: what the server will charge the line at. */
export function lessDiscount(listCents: number, discountPct: number | null | undefined): number {
  const pct = Math.max(0, Math.min(100, discountPct ?? 0))
  return Math.round(listCents * (1 - pct / 100))
}
