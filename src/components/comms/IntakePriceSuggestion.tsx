import { PriceBreakdown } from './PriceBreakdown'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { useMutation, useQuery } from '@tanstack/react-query'
import { usePermissions } from '@/hooks/usePermissions'
import { ApiError } from '@/lib/api'
import { formatPricingAmount, getIntakePricing, hasPricingShortfall, previewIntakePricing, pricingReviewInputs, pricingNumberInput, type PricingReviewInputs, type PricingSuggestion } from '@/lib/intakePricing'

interface IntakePriceSuggestionProps {
  draftId: string
  initialPricing?: PricingSuggestion | null
  fetchOnMount?: boolean
}

export function IntakePriceSuggestion(props: IntakePriceSuggestionProps) {
  return <IntakePriceSuggestionLauncher key={props.draftId} {...props} />
}

function IntakePriceSuggestionLauncher(props: IntakePriceSuggestionProps) {
  const [open, setOpen] = useState(false)
  const { hasAll } = usePermissions()
  if (!hasAll(['ai.use', 'ai.billing.read', 'catalog.view']) || (!props.fetchOnMount && !props.initialPricing)) return null
  return <>
    <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5"><path d="M4 3h12v14H4V3Zm3 3h6M7 10h1m4 0h1m-6 3h1m4 0h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Review pricing
    </button>
    {open && createPortal(<Modal isOpen onClose={() => setOpen(false)} size="lg" title="Review pricing" subtitle="For the office to review before preparing an estimate.">
      <Modal.Body>
        <IntakePriceSuggestionPanel key={[props.draftId, props.initialPricing?.source_revision ?? ''].join(':')} {...props} />
      </Modal.Body>
      <Modal.Footer><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50">Done</button></Modal.Footer>
    </Modal>, document.body)}
  </>
}

function IntakePriceSuggestionPanel({ draftId, initialPricing, fetchOnMount = false }: IntakePriceSuggestionProps) {
  const { hasAll } = usePermissions()
  const allowed = hasAll(['ai.use', 'ai.billing.read', 'catalog.view'])
  const query = useQuery({
    queryKey: ['intake-pricing', draftId],
    queryFn: () => getIntakePricing(draftId),
    enabled: allowed && fetchOnMount,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    gcTime: 0,
  })
  const preview = useMutation({ mutationFn: (inputs: PricingReviewInputs) => previewIntakePricing(draftId, inputs), retry: false })
  if (!allowed || (preview.error instanceof ApiError && [401, 403, 404].includes(preview.error.status)) || (query.error instanceof ApiError && [401, 403, 404].includes(query.error.status))) return null
  const savedPricing = query.isError ? null : query.data ?? initialPricing
  const pricing = preview.isPending || preview.isError ? null : preview.data ?? savedPricing
  // Call summaries use only the server-provided result until the office requests a refresh.
  if (!fetchOnMount && !savedPricing && !query.isFetching && !query.isError) return null
  return (
    <section aria-label="Suggested price" className="text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-navy-900">Suggested price · For office review</h3>
        <button type="button" onClick={() => { preview.reset(); void query.refetch() }} disabled={query.isFetching || preview.isPending} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{query.isFetching ? 'Refreshing…' : 'Refresh price'}</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Prices before tax. This is not a customer quote. Review before preparing an estimate.</p>
      {query.isFetching && <p role="status" className="mt-3 text-slate-600">Checking the current catalog and company costs…</p>}
      {query.isError && <p role="alert" className="mt-3 text-amber-800">Pricing could not be loaded. Try Refresh price again.</p>}
      {preview.isPending && <p role="status" className="mt-3">Calculating preview…</p>}
      {preview.isError && <p role="alert" className="mt-3 text-amber-800">We could not calculate that price. Check the items and work hours, then try again.</p>}
      {preview.data && !preview.isError && !preview.isPending && <p className="mt-3 font-semibold text-amber-900">Temporary preview · not saved</p>}
      {pricing && <>
        <p className="mt-3 font-medium">{pricing.status === 'ready_for_review' ? 'Ready for office review' : pricing.status === 'partial' ? 'Some details still need confirmation' : 'More information needed'}</p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-600">Current catalog price</dt><dd className="mt-1 text-lg font-semibold">{formatPricingAmount(pricing.catalog_total_cents, pricing.currency)}</dd></div>
          <div className="rounded-lg bg-amber-50 p-3"><dt className="text-xs text-slate-600">Recommended price</dt><dd className="mt-1 text-lg font-semibold">{formatPricingAmount(pricing.suggested_total_cents, pricing.currency)}</dd></div>
        </dl>
        <PriceBreakdown pricing={pricing} />
        {hasPricingShortfall(pricing) && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">Catalog price shortfall: the recommended price is higher based on the company pricing model. Review the difference before quoting. The catalog has not been changed.</p>}
        {pricing.warnings.length > 0 && <ul aria-label="Pricing warnings" className="mt-3 list-disc space-y-1 pl-5 text-amber-800">{pricing.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
        {pricing.questions.length > 0 && <div className="mt-3"><h4 className="font-medium">Information to confirm</h4><ul className="list-disc space-y-1 pl-5">{pricing.questions.map((question, i) => <li key={i}>{question}</li>)}</ul></div>}
        <details className="mt-3">
          <summary className="cursor-pointer font-medium">Items and pricing details</summary>
          <ul className="mt-2 space-y-3">{pricing.lines.map((line, i) => <li key={i} className="border-t border-slate-100 pt-2">
            <div className="flex flex-wrap justify-between gap-2"><span>{line.label}</span><span>{formatPricingAmount(line.total_cents, pricing.currency)}</span></div>
            <p className="text-xs text-slate-500">{line.quantity ?? 'Quantity needed'} {line.unit ?? ''} · Unit price: {formatPricingAmount(line.unit_price_cents, pricing.currency)}</p>
            {line.source && <p className="text-xs text-slate-500">Reference: {line.source.label || 'Catalog'}{line.source.page != null ? ` · page ${line.source.page}` : ''}</p>}
          </li>)}</ul>
          {pricing.assumptions.length > 0 && <ul aria-label="Pricing assumptions" className="mt-3 list-disc pl-5 text-xs text-slate-600">{pricing.assumptions.map((assumption, i) => <li key={i}>{assumption}</li>)}</ul>}
          <p className="mt-3 break-all text-xs text-slate-500">Calculated: {Number.isNaN(Date.parse(pricing.calculated_at)) ? 'Not available' : new Date(pricing.calculated_at).toLocaleString()}</p>
        </details>
      </>}
      {savedPricing && <PricingAssumptionsForm key={[draftId, savedPricing.source_revision, savedPricing.calculated_at].join(':')} pricing={savedPricing} busy={preview.isPending || query.isFetching} onInputsChange={() => preview.reset()} onCalculate={inputs => preview.mutate(inputs)} />}
      {savedPricing?.questions.length && hasAll(['ai.accounting.read', 'revenue.view']) ? <p className="mt-3 text-xs"><Link className="underline" to="/tool-shed/cost-model">Review company cost model settings</Link></p> : null}
    </section>
  )
}


function PricingAssumptionsForm({ pricing, busy, onCalculate, onInputsChange }: {
  pricing: PricingSuggestion
  busy: boolean
  onInputsChange: () => void
  onCalculate: (inputs: PricingReviewInputs) => void
}) {
  const [inputs, setInputs] = useState<PricingReviewInputs>(() => pricingReviewInputs(pricing))
  const fieldClass = 'mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm'
  const updateItem = (index: number, update: Partial<PricingReviewInputs['items'][number]>) => {
    setInputs(current => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, ...update } : item) }))
  }
  return <details className="mt-4 border-t border-slate-100 pt-3">
    <summary className="cursor-pointer font-medium">Review pricing assumptions</summary>
    <p className="mt-2 text-xs text-slate-600">Preview only — no saved price or customer quote changes. Enter the work and time you want the office to review.</p>
    <form className="mt-3 space-y-3" onChange={onInputsChange} onSubmit={event => { event.preventDefault(); onCalculate(inputs) }}>
      <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
        <legend className="text-xs font-semibold">Items and quantities</legend>
        {inputs.items.map((item, i) => <div key={i} className="rounded-lg border border-slate-200 p-3">
          {item.catalog_item_id ? <p className="font-medium">{item.description}</p> : <>
            <label className="block text-xs">Item description<input className={fieldClass} value={item.description} maxLength={300} onChange={event => updateItem(i, { description: event.target.value })} /></label>
            <label className="mt-2 block text-xs">SKU if known<input className={fieldClass} value={item.sku ?? ''} maxLength={100} onChange={event => updateItem(i, { sku: event.target.value || null })} /></label>
          </>}
          <label className="mt-2 block text-xs">Quantity {item.unit ? `(${item.unit})` : ''}<input type="number" min="0" step="any" className={fieldClass} value={item.quantity ?? ''} onChange={event => updateItem(i, { quantity: pricingNumberInput(event.target.value) })} /></label>
        </div>)}
        <button type="button" disabled={inputs.items.length >= 50} onClick={() => { onInputsChange(); setInputs(current => ({ ...current, items: [...current.items, { description: '', catalog_item_id: null, sku: null, quantity: null, unit: null }] })) }} className="rounded border border-slate-300 px-3 py-2 text-xs disabled:opacity-50">Add item to preview</button>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">Labor hours<input type="number" min="0" step="any" className={fieldClass} value={inputs.labor_hours ?? ''} onChange={event => setInputs(current => ({ ...current, labor_hours: pricingNumberInput(event.target.value) }))} /></label>
          <label className="block text-xs">Where did the work hours come from?<select className={fieldClass} value={inputs.labor_basis} onChange={event => setInputs(current => ({ ...current, labor_basis: event.target.value as 'stated' | 'estimate' }))}><option value="estimate">Office estimate</option><option value="stated">Provided in the request</option></select></label>
          <label className="block text-xs">After hours<select className={fieldClass} value={inputs.after_hours === null ? 'unknown' : inputs.after_hours ? 'yes' : 'no'} onChange={event => setInputs(current => ({ ...current, after_hours: event.target.value === 'unknown' ? null : event.target.value === 'yes' }))}><option value="unknown">Not known</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={inputs.scope_complete} onChange={event => setInputs(current => ({ ...current, scope_complete: event.target.checked }))} />The items and labor cover all the work</label>
        <button type="submit" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold">{busy ? 'Please wait…' : 'Calculate preview'}</button>
      </fieldset>
    </form>
  </details>
}
