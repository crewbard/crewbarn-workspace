import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { useCreateInvoice, useInvoices } from '@/hooks/useInvoices'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'
import { Modal } from '@/components/ui/Modal'
import { CatalogItemPickerModal } from '@/components/CatalogItemPickerModal'
import { computeLineDiscountCents } from '@/components/WorkOrderLineItemEditorCore'
import type { LineType } from '@/types/workOrderLineItem'
import { ReceivePaymentModal } from '@/components/ReceivePaymentModal'
import { listLineItems } from '@/lib/workOrders'
import { apiRequest, ApiError } from '@/lib/api'
import type { CatalogItem } from '@/types/catalogItem'
import type { Customer } from '@/types/customer'
import type { Invoice } from '@/types/invoice'

interface TaxClassRow {
  id: string
  name: string
  rate_pct: number
  active: boolean
  is_default: boolean
}

/**
 * InvoiceCreatorModal — overlay for creating an invoice.
 *
 * Two paths drive the same modal:
 *   1. Convert WO → invoice: pick a work order, line items get
 *      snapshotted server-side.
 *   2. Counter / POS sale: skip the WO, type line items inline
 *      (description, qty, unit price, taxable). Used for walk-in
 *      shop sales — key copy, parts, etc. — where there's no field
 *      service to track.
 *
 * "Create + take payment" is the second submit button. It saves the
 * invoice, then immediately opens ReceivePaymentModal pre-scoped to
 * this customer so the counter clerk can ring up + accept payment in
 * one motion. The plain "Create" button still ships a draft for the
 * office to send later.
 */

interface DraftLine {
  line_type: LineType
  description: string
  quantity: string
  unit_label: string
  unit_price_dollars: string
  is_taxable: boolean
  // tax_class_id replaces free-form rate entry. Backend snapshots the
  // class's rate_pct onto the line at save-time. Empty string = no
  // class (non-taxable / 0 %).
  tax_class_id: string
  // On discount rows: the discount kind/value. Server computes the cents.
  discount_id: string | null
  discount_kind: 'percent' | 'fixed' | null
  discount_value: number
}

function emptyLine(taxClassId: string, isTaxable = true): DraftLine {
  return {
    line_type: 'item',
    description: '',
    quantity: '1',
    unit_label: 'each',
    unit_price_dollars: '',
    is_taxable: isTaxable,
    tax_class_id: taxClassId,
    discount_id: null,
    discount_kind: null,
    discount_value: 0,
  }
}

/** A fee row — a flat charge (non-taxable by default). */
function feeLine(): DraftLine {
  return { ...emptyLine('', false), line_type: 'fee', description: 'Fee' }
}

/** A discount row — percent by default. */
function discountLine(): DraftLine {
  return {
    ...emptyLine('', false),
    line_type: 'discount',
    description: 'Discount',
    discount_kind: 'percent',
    discount_value: 0,
  }
}

export function InvoiceCreatorModal({
  isOpen,
  onClose,
  customer,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  customer: Customer
  onCreated?: (invoice: Invoice) => void
}) {
  const tenantTimezone = useTenantTimezone()
  const [workOrderId, setWorkOrderId] = useState<string>('')
  const [issuedAt, setIssuedAt] = useState<string>(() => isoToday())
  const [dueAt, setDueAt] = useState<string>(() => isoNetDays(14))
  const [customerNotes, setCustomerNotes] = useState('')
  const [terms, setTerms] = useState(
    'Net 14. Late payments may incur a 1.5% monthly service charge.',
  )
  // Tax classes from settings. The user marks one as default in
  // /settings/tax-classes; that's the seed for new lines. Per-row
  // dropdown lets the clerk override (e.g. service line vs parts line
  // with different rates).
  const taxClassesQ = useQuery({
    queryKey: ['tax-classes', { active: true }],
    queryFn: () =>
      apiRequest<{ data: TaxClassRow[] }>(
        '/v1/tax-classes?active=true&per_page=100',
      ),
  })
  const taxClasses = taxClassesQ.data?.data ?? []
  // Priority order:
  //   1. Customer's own default_tax_class_id (per-customer override)
  //   2. Tenant default class (is_default = true)
  //   3. First active class (sensible fallback for fresh shops)
  //
  // Even tax-exempt customers (taxable=false) get a tax class on lines
  // — the invoice still computes "what tax would be" and then adds a
  // separate exempt-deduction line that zeros it out. Makes the
  // certificate audit trail readable.
  const defaultTaxClass = useMemo(() => {
    if (customer.default_tax_class_id) {
      const pick = taxClasses.find((c) => c.id === customer.default_tax_class_id)
      if (pick) return pick
    }
    return (
      taxClasses.find((c) => c.is_default) ??
      taxClasses.find((c) => c.active) ??
      null
    )
  }, [taxClasses, customer.default_tax_class_id])
  // The "active" default — what new lines pick up. Starts at the
  // tenant default, but the clerk can switch it for the whole invoice
  // via the header dropdown without affecting tenant settings.
  const [defaultTaxClassId, setDefaultTaxClassId] = useState<string>('')
  // Seed the default once classes load (don't clobber a user pick).
  useEffect(() => {
    if (defaultTaxClassId) return
    if (defaultTaxClass) setDefaultTaxClassId(defaultTaxClass.id)
  }, [defaultTaxClass, defaultTaxClassId])

  const taxClassById = useMemo(() => {
    const m = new Map<string, TaxClassRow>()
    for (const c of taxClasses) m.set(c.id, c)
    return m
  }, [taxClasses])
  const rateForRow = (ln: DraftLine): number => {
    if (!ln.tax_class_id) return 0
    return taxClassById.get(ln.tax_class_id)?.rate_pct ?? 0
  }

  const [lines, setLines] = useState<DraftLine[]>([emptyLine('')])
  const [error, setError] = useState<string | null>(null)
  // After successful save: the new invoice id, so we can chain into
  // ReceivePaymentModal if the user clicked "Create + take payment."
  const [postCreatePayInvoice, setPostCreatePayInvoice] = useState<Invoice | null>(null)
  // Catalog picker — when set, picking an item fills the row at this
  // index. Per-row because each line might need its own catalog item.
  const [catalogPickerForRow, setCatalogPickerForRow] = useState<number | null>(null)

  const { data: woData, isLoading: woLoading } = useWorkOrders({
    service_customer_id: customer.id,
    per_page: 100,
  })
  // Pull customer's existing invoices so we can hide WOs that are
  // already invoiced (prevents accidental double-invoicing). Amending
  // an existing invoice goes through that invoice's detail page —
  // re-opening it here would be confusing.
  const { data: existingInvoices } = useInvoices({
    customer_id: customer.id,
    per_page: 200,
  })
  const invoicedWoIds = useMemo(() => {
    const set = new Set<string>()
    for (const inv of existingInvoices ?? []) {
      if (inv.work_order_id) set.add(inv.work_order_id)
    }
    return set
  }, [existingInvoices])
  const workOrders = useMemo(
    () => (woData?.data ?? []).filter((w) => !invoicedWoIds.has(w.id)),
    [woData, invoicedWoIds],
  )
  const hiddenInvoicedCount = (woData?.data?.length ?? 0) - workOrders.length

  const create = useCreateInvoice()

  useEffect(() => {
    if (!isOpen) return
    setWorkOrderId('')
    setIssuedAt(isoToday(tenantTimezone))
    setDueAt(isoNetDays(14, tenantTimezone))
    setCustomerNotes('')
    setTerms('Net 14. Late payments may incur a 1.5% monthly service charge.')
    setLines([emptyLine(defaultTaxClassId)])
    setError(null)
    setPostCreatePayInvoice(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tenantTimezone])

  // When the header default tax class changes, sweep every existing
  // line that was on the OLD default onto the new one. Lines the user
  // explicitly overrode (different class than the prior default) stay
  // as-is. Tracks the last-applied default so we can tell which lines
  // were "default-tracking" vs "user-overridden."
  const [lastAppliedDefault, setLastAppliedDefault] = useState<string>('')
  useEffect(() => {
    if (!defaultTaxClassId) return
    if (lastAppliedDefault === defaultTaxClassId) return
    setLines((curr) =>
      curr.map((ln) =>
        ln.tax_class_id === lastAppliedDefault || !ln.tax_class_id
          ? { ...ln, tax_class_id: defaultTaxClassId }
          : ln,
      ),
    )
    setLastAppliedDefault(defaultTaxClassId)
  }, [defaultTaxClassId, lastAppliedDefault])

  // When the user picks a WO, fetch its line items and seed the editor
  // with them. They see what's about to be invoiced + can add MORE
  // lines (extra parts, last-minute upcharges) before saving.
  const woLinesQuery = useQuery({
    queryKey: ['wo-line-items-for-invoice', workOrderId],
    queryFn: () => listLineItems(workOrderId),
    enabled: !!workOrderId,
  })
  useEffect(() => {
    if (!workOrderId) {
      // Reset to a blank line set when the WO selection is cleared.
      setLines([emptyLine(defaultTaxClassId)])
      return
    }
    if (woLinesQuery.data) {
      // WO line items already carry their own tax_class_id — prefer
      // that over the invoice-level default since the WO was priced
      // with intent (e.g. resale-certified part with no tax). Fall back
      // to the invoice default if the WO line had no class.
      const seeded: DraftLine[] = woLinesQuery.data.map((wl) => {
        const woTaxable = !!wl.money?.is_taxable
        // If the WO line carries an explicit tax_class_id, use it.
        // If it's non-taxable, force empty (don't fall back to the
        // invoice default — that would re-tax a deliberately
        // non-taxable line).
        const taxClass = wl.tax_class_id
          ? wl.tax_class_id
          : woTaxable
            ? defaultTaxClassId
            : ''
        return {
          line_type: wl.line_type ?? 'item',
          description: wl.description ?? '',
          quantity: String(wl.quantity ?? 1),
          unit_label: wl.unit_label ?? 'each',
          unit_price_dollars: ((Number(wl.money?.customer_cost_cents) || 0) / 100).toFixed(2),
          is_taxable: woTaxable,
          tax_class_id: taxClass,
          discount_id: wl.money?.discount_id ?? null,
          discount_kind: wl.money?.discount_kind ?? null,
          discount_value: Number(wl.money?.discount_value) || 0,
        }
      })
      setLines(
        seeded.length > 0
          ? [...seeded, emptyLine(defaultTaxClassId)]
          : [emptyLine(defaultTaxClassId)],
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId, woLinesQuery.data])

  function patchLine(i: number, p: Partial<DraftLine>) {
    setLines((curr) => curr.map((row, idx) => (idx === i ? { ...row, ...p } : row)))
  }
  function addLine() {
    setLines((curr) => [...curr, emptyLine(defaultTaxClassId)])
  }
  function addFee() {
    setLines((curr) => [...curr, feeLine()])
  }
  function addDiscount() {
    setLines((curr) => [...curr, discountLine()])
  }
  function removeLine(i: number) {
    setLines((curr) => (curr.length <= 1 ? curr : curr.filter((_, idx) => idx !== i)))
  }

  /**
   * Apply a catalog item to a line — populate description, unit
   * label, default qty, customer price, AND respect the catalog
   * item's tax configuration:
   *
   *   - catalog has tax_class_id    → apply that class, is_taxable=true
   *   - catalog has NO tax_class_id → mark line non-taxable, clear class
   *
   * This is the catalog's job: if the shop set up "Lockout" as
   * non-taxable in /catalog, every invoice line for Lockout should
   * default to non-taxable. Clerk can still override per row.
   *
   * Doesn't overwrite quantity if the user already typed one.
   */
  function applyCatalogToRow(i: number, item: CatalogItem) {
    const catalogTaxClassId = item.pricing?.tax_class_id ?? null
    setLines((curr) =>
      curr.map((row, idx) => {
        if (idx !== i) return row
        const userTypedQty = row.quantity !== '' && row.quantity !== '1'
        return {
          ...row,
          description: item.name,
          unit_label: item.unit_label ?? row.unit_label,
          unit_price_dollars: ((item.pricing?.customer_cost_cents ?? 0) / 100).toFixed(2),
          quantity: userTypedQty ? row.quantity : String(item.default_quantity ?? 1),
          is_taxable: !!catalogTaxClassId,
          tax_class_id: catalogTaxClassId ?? '',
        }
      }),
    )
  }

  // Live totals so the counter clerk can read out the total before
  // taking payment. Same math the server runs in recalculateTotals,
  // including the tax-exempt deduction for non-taxable customers.
  const isExempt = customer.taxable === false
  const { totals, discountAmounts } = useMemo(() => {
    // Items + fees build the base; discount rows are separate. Tax scales by
    // (base - discount)/base — pro-rata allocation matching the server.
    let base = 0
    let fullTax = 0
    for (const ln of lines) {
      if (ln.line_type === 'discount') continue
      const q = parseFloat(ln.quantity || '0') || 0
      const price = Math.round((parseFloat(ln.unit_price_dollars || '0') || 0) * 100)
      const lineSubtotal = Math.round(q * price)
      const rate = rateForRow(ln)
      base += lineSubtotal
      fullTax += ln.is_taxable ? Math.round((lineSubtotal * rate) / 100) : 0
    }

    const amounts = new Map<number, number>()
    let discountTotal = 0
    lines.forEach((ln, i) => {
      if (ln.line_type !== 'discount') return
      const amt = computeLineDiscountCents(base - discountTotal, ln.discount_kind, ln.discount_value)
      amounts.set(i, amt)
      discountTotal += amt
    })

    const tax = base > 0 ? Math.round((fullTax * (base - discountTotal)) / base) : 0
    const exemptAdjustment = isExempt ? tax : 0
    return {
      discountAmounts: amounts,
      totals: {
        subtotal: base,
        discount: discountTotal,
        tax,
        exemptAdjustment,
        total: base - discountTotal + tax - exemptAdjustment,
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, taxClassById, isExempt])

  // True when the user has typed something on at least one line —
  // used to gate "Create + take payment" so the counter button only
  // lights up after they enter a sale.
  const hasInlineLines = lines.some(
    (l) => l.description.trim() !== '' || parseFloat(l.unit_price_dollars || '0') > 0,
  )

  async function handleSave(takePaymentAfter: boolean) {
    setError(null)
    try {
      // Build the line_items array from non-empty rows. Skip blank rows
      // entirely so the office can leave the "add another" placeholder
      // sitting in the editor.
      const lineItems = lines
        .map((l) => ({
          line_type: l.line_type,
          description: l.description.trim(),
          quantity: parseFloat(l.quantity || '1') || 1,
          unit_label: l.unit_label.trim() || 'each',
          customer_cost_cents:
            l.line_type === 'discount'
              ? 0
              : Math.round((parseFloat(l.unit_price_dollars || '0') || 0) * 100),
          is_taxable: l.line_type === 'discount' ? false : l.is_taxable,
          tax_class_id: l.line_type === 'discount' ? null : l.tax_class_id || null,
          discount_id: l.discount_id,
          discount_kind: l.discount_kind,
          discount_value: l.discount_value,
        }))
        .filter((l) => l.description !== '' && l.customer_cost_cents >= 0)

      const inv = await create.mutateAsync({
        customer_id: customer.id,
        work_order_id: workOrderId || null,
        issued_at: issuedAt || null,
        due_at: dueAt || null,
        customer_notes: customerNotes.trim() || null,
        terms: terms.trim() || null,
        // The editor is now the single source of truth for line items
        // — when a WO is picked we pre-seed it from the WO's lines, so
        // any extras the user typed are included. Skip the server-side
        // copy_line_items_from_work_order to avoid duplicating lines.
        copy_line_items_from_work_order: false,
        line_items: lineItems.length > 0 ? lineItems : undefined,
      })
      onCreated?.(inv)

      if (takePaymentAfter) {
        // Stay mounted; swap to ReceivePaymentModal pre-loaded with
        // this invoice's customer. The receive-payment endpoint will
        // pick this invoice up from outstanding-invoices automatically.
        setPostCreatePayInvoice(inv)
      } else {
        onClose()
      }
    } catch (e) {
      // Specific, friendly messages for the workflow gates instead of the
      // raw server text.
      if (e instanceof ApiError && e.code === 'not_completed') {
        setError('This job must be marked Complete before you can invoice it.')
        return
      }
      if (e instanceof ApiError && e.code === 'already_invoiced') {
        setError('This job already has an invoice — open the existing one instead.')
        return
      }
      const errObj = e as {
        payload?: { message?: string; errors?: Record<string, string[]> }
      }
      const firstFieldErr = errObj?.payload?.errors
        ? Object.values(errObj.payload.errors)[0]?.[0]
        : null
      setError(
        firstFieldErr ??
          errObj?.payload?.message ??
          (e instanceof Error ? e.message : String(e)),
      )
    }
  }

  // After the user picks "Create + take payment", swap to the payment
  // modal. Closing it closes the whole flow.
  if (postCreatePayInvoice) {
    return (
      <ReceivePaymentModal
        customerId={customer.id}
        customerName={customer.display_name}
        preSelectInvoiceId={postCreatePayInvoice.id}
        onClose={() => {
          setPostCreatePayInvoice(null)
          onClose()
        }}
      />
    )
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'
  const selectedWo = workOrders.find((w) => w.id === workOrderId)

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New invoice"
      subtitle={`For ${customer.display_name}`}
      size="lg"
    >
      <Modal.Body>
        <div className="space-y-4">
          {isExempt && (
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded px-3 py-2">
              <strong>Tax-exempt customer.</strong> Invoice shows tax for the audit
              trail, then deducts it on a "Tax Exempt" line so the customer pays
              subtotal only. Certificate on file backs this up.
            </div>
          )}
          {/* Work order picker */}
          <Labeled label="Work order to invoice (optional)">
            <select
              className={inputCls}
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
              disabled={woLoading}
            >
              <option value="">— No work order (blank invoice) —</option>
              {workOrders.map((wo) => (
                <option key={wo.id} value={wo.id}>
                  {wo.display_number ?? wo.id} · {wo.title}
                  {wo.status?.name ? ` · ${wo.status.name}` : ''}
                </option>
              ))}
            </select>
            {selectedWo && (
              <p className="mt-1 text-xs text-emerald-700">
                ✓ Line items loaded below — edit, remove, or add extras before saving.
                {woLinesQuery.isFetching && ' (loading…)'}
              </p>
            )}
            {!workOrderId && (
              <p className="mt-1 text-xs text-slate-500">
                Counter sale? Add line items below. Tablet POS workflow: type description +
                price, hit <strong>Create + take payment</strong> to run the card.
              </p>
            )}
            {hiddenInvoicedCount > 0 && (
              <p className="mt-1 text-[11px] text-slate-400 italic">
                {hiddenInvoicedCount} work order{hiddenInvoicedCount === 1 ? '' : 's'}{' '}
                already invoiced — hidden. Open that invoice directly to amend it.
              </p>
            )}
          </Labeled>

          {/* Inline line items. When a WO is picked, this seeds from
              the WO's existing lines so the user sees what's coming +
              can edit / remove / add more before the invoice is saved. */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Line items
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <span>Tax class</span>
                  <select
                    value={defaultTaxClassId}
                    onChange={(e) => setDefaultTaxClassId(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-sm bg-white max-w-[16rem]"
                    title="Default for new lines. Each line can override below."
                    disabled={taxClassesQ.isLoading}
                  >
                    <option value="">— No tax —</option>
                    {taxClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.rate_pct.toFixed(3).replace(/\.?0+$/, '')}%)
                        {c.is_default ? ' · default' : ''}
                      </option>
                    ))}
                  </select>
                  {taxClasses.length === 0 && !taxClassesQ.isLoading && (
                    <span className="text-[11px] text-amber-700">
                      No tax classes set up.{' '}
                      <a href="/settings/tax-classes" className="underline">
                        Add one
                      </a>
                    </span>
                  )}
                </label>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-xs font-medium text-slate-600">
                      Description
                    </th>
                    <th className="text-right px-2 py-1.5 text-xs font-medium text-slate-600 w-20">
                      Qty
                    </th>
                    <th className="text-right px-2 py-1.5 text-xs font-medium text-slate-600 w-28">
                      Unit $
                    </th>
                    <th className="text-center px-2 py-1.5 text-xs font-medium text-slate-600 w-14">
                      Tax
                    </th>
                    <th className="text-right px-2 py-1.5 text-xs font-medium text-slate-600 w-24">
                      Line $
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((ln, i) => {
                    if (ln.line_type === 'discount') {
                      const kind: 'percent' | 'fixed' =
                        ln.discount_kind === 'fixed' ? 'fixed' : 'percent'
                      const amt = discountAmounts.get(i) ?? 0
                      return (
                        <tr key={i} className="border-b border-slate-100 last:border-b-0 bg-rose-50/40">
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={ln.description}
                              onChange={(e) => patchLine(i, { description: e.target.value })}
                              placeholder="Discount label"
                              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-rose-400"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={kind}
                              onChange={(e) => patchLine(i, { discount_kind: e.target.value as 'percent' | 'fixed' })}
                              className="w-full px-1 py-1.5 text-xs border border-slate-300 rounded bg-white"
                            >
                              <option value="percent">%</option>
                              <option value="fixed">$</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step={kind === 'percent' ? '0.1' : '0.01'}
                              max={kind === 'percent' ? 100 : undefined}
                              value={ln.discount_value || ''}
                              onChange={(e) => patchLine(i, { discount_value: parseFloat(e.target.value) || 0 })}
                              placeholder="0"
                              className="w-full text-right px-2 py-1.5 text-sm border border-slate-300 rounded tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center text-slate-300">—</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-rose-600">
                            −${(amt / 100).toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(i)}
                              disabled={lines.length <= 1}
                              className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                              aria-label="Remove line"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      )
                    }
                    const q = parseFloat(ln.quantity || '0') || 0
                    const price = parseFloat(ln.unit_price_dollars || '0') || 0
                    const lineTotal = q * price
                    return (
                      <tr key={i} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={ln.description}
                              onChange={(e) => patchLine(i, { description: e.target.value })}
                              placeholder="Key copy / part / labor…"
                              className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setCatalogPickerForRow(i)}
                              className="shrink-0 text-xs px-2 py-1.5 border border-slate-300 hover:bg-slate-100 rounded"
                              title="Search catalog (products + services)"
                            >
                              🔎
                            </button>
                          </div>
                          {ln.line_type === 'fee' && (
                            <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                              Fee
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ln.quantity}
                            onChange={(e) => patchLine(i, { quantity: e.target.value })}
                            className="w-full text-right px-2 py-1.5 text-sm border border-slate-300 rounded tabular-nums"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ln.unit_price_dollars}
                            onChange={(e) => patchLine(i, { unit_price_dollars: e.target.value })}
                            placeholder="0.00"
                            className="w-full text-right px-2 py-1.5 text-sm border border-slate-300 rounded tabular-nums"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={ln.is_taxable}
                            onChange={(e) => patchLine(i, { is_taxable: e.target.checked })}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-900">
                          ${lineTotal.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            disabled={lines.length <= 1}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                            aria-label="Remove line"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                  >
                    + Add line
                  </button>
                  <button
                    type="button"
                    onClick={addFee}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    + Add fee
                  </button>
                  <button
                    type="button"
                    onClick={addDiscount}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                  >
                    + Add discount
                  </button>
                </div>
                <div className="text-xs text-slate-700 space-x-4">
                  <span>
                    Subtotal{' '}
                    <span className="font-mono">${(totals.subtotal / 100).toFixed(2)}</span>
                  </span>
                  {totals.discount > 0 && (
                    <span className="text-rose-600">
                      Discount{' '}
                      <span className="font-mono">−${(totals.discount / 100).toFixed(2)}</span>
                    </span>
                  )}
                  <span>
                    Tax <span className="font-mono">${(totals.tax / 100).toFixed(2)}</span>
                  </span>
                  {totals.exemptAdjustment > 0 && (
                    <span className="text-amber-700">
                      Tax exempt{' '}
                      <span className="font-mono">
                        -${(totals.exemptAdjustment / 100).toFixed(2)}
                      </span>
                    </span>
                  )}
                  <span className="font-semibold">
                    Total{' '}
                    <span className="font-mono">${(totals.total / 100).toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Issue date">
              <input
                type="date"
                className={inputCls}
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
              />
            </Labeled>
            <Labeled label="Due date">
              <input
                type="date"
                className={inputCls}
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
              <div className="mt-1 text-xs text-slate-500 flex gap-3">
                <button type="button" onClick={() => setDueAt(isoNetDays(0))} className="hover:text-amber-600">
                  Due on receipt
                </button>
                <button type="button" onClick={() => setDueAt(isoNetDays(14))} className="hover:text-amber-600">
                  Net 14
                </button>
                <button type="button" onClick={() => setDueAt(isoNetDays(30))} className="hover:text-amber-600">
                  Net 30
                </button>
              </div>
            </Labeled>
          </div>

          {/* Notes */}
          <Labeled label="Customer notes (visible on the invoice)">
            <textarea
              rows={2}
              className={inputCls}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Thank you for your business. Anything customer-facing you want to say."
            />
          </Labeled>

          <Labeled label="Terms">
            <textarea
              rows={2}
              className={inputCls}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </Labeled>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          disabled={create.isPending}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={create.isPending}
          className="px-4 py-2 text-sm font-medium border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-md disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create invoice'}
        </button>
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={create.isPending || !hasInlineLines}
          className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
          title="Saves the invoice then opens the receive-payment dialog so the customer can pay in one motion"
        >
          {create.isPending ? 'Creating…' : 'Create + take payment'}
        </button>
      </Modal.Footer>
    </Modal>

    {/* Catalog picker — opened per-line via the search button next to
        each description input. Applies name + unit + price + qty to
        the targeted row, then closes. */}
    <CatalogItemPickerModal
      isOpen={catalogPickerForRow !== null}
      onClose={() => setCatalogPickerForRow(null)}
      onPick={(item) => {
        if (catalogPickerForRow !== null) applyCatalogToRow(catalogPickerForRow, item)
        setCatalogPickerForRow(null)
      }}
    />
    </>
  )
}

function isoToday(
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
): string {
  return tenantDate(timezone)
}

function isoNetDays(
  days: number,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
): string {
  return tenantDate(timezone, days)
}

function Labeled({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
