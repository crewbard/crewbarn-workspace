import { listCatalogItems } from '@/lib/catalogItems'
import { openCatalogs } from '@/lib/catalogs'
import type { PickedPart } from '@/lib/catalogOrders'
import type { CatalogItem } from '@/types/catalogItem'

export type PdfLinePicker = (part: PickedPart) => Promise<string | void> | string | void

/** The same editor action works in every theme; only Focus docks the book. */
export function openPdfCatalogForLine(onPickLine: PdfLinePicker): void {
  const source = window.location.pathname + window.location.search
  openCatalogs({
    docked: document.querySelector('[data-focus-layout]') !== null,
    onPickLine: (part) => {
      if (window.location.pathname + window.location.search !== source) {
        throw new Error('The job or estimate editor changed. Return to its line items and reopen the PDF book.')
      }
      return onPickLine(part)
    },
  })
}

/** An exact active SKU gets the shop's actual catalog pricing and tax class. */
export async function exactCatalogItemForPdfPart(part: PickedPart): Promise<CatalogItem | null> {
  const sku = part.part_number?.trim()
  if (!sku) return null
  let exact: CatalogItem | null = null
  // Search includes names and partial identifiers, sorted by name. An exact SKU
  // may be on a later page, and a duplicate may follow it. Never price from a
  // partial result set. The cap prevents a pathological search from issuing
  // unbounded requests; an unverified match fails closed rather than guessing.
  for (let page = 1; page <= 10; page++) {
    let result: Awaited<ReturnType<typeof listCatalogItems>>
    try {
      result = await listCatalogItems({ q: sku, active: true, per_page: 100, page })
    } catch {
      throw new Error('Could not check the shop catalog. No line was added; please retry.')
    }
    for (const item of result.data) {
      if (item.sku?.trim().toLocaleLowerCase() !== sku.toLocaleLowerCase()) continue
      // Two products with one SKU are ambiguous: never choose a price at random.
      if (exact) return null
      exact = item
    }
    if (page >= (result.meta?.last_page ?? 1)) return exact
  }
  throw new Error('Too many catalog results to verify this SKU. No line was added; search the shop catalog instead.')
}

/** Preserve the PDF's identifier when it has not been cataloged by the shop. */
export function pdfPartLineDescription(part: PickedPart): string {
  const code = part.part_number?.trim() ?? ''
  const detail = part.description?.trim() ?? ''
  return code && detail && detail !== code ? `${code} — ${detail}` : code || detail || 'PDF catalog item'
}

export const pdfLineReviewNote = (matched: boolean): string => matched
  ? 'Added with the matching shop catalog price and tax class. Review the line before sending.'
  : 'Added from the PDF. Review its printed list price, customer rate, and tax before sending.'
