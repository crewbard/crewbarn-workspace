import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconShoppingCartPlus, IconX } from '@tabler/icons-react'
import { lookupParts, type CatalogPart } from '@/lib/catalogOrders'
import { CART_KEYS, addAsk, type AskFor, type NewAsk } from '@/lib/purchaseRequests'
import { PERM, usePermissions } from '@/hooks/usePermissions'

export type CartPart = Pick<NewAsk, 'catalog_item_id' | 'part_number' | 'description' | 'reference_card_id' | 'list_price_cents'> & {
  /** How the part is shown in the box. */
  label?: string
}

/**
 * "Add to parts cart": a part for the buyer to order, from wherever it
 * came up -- an item, a reference card, a job, an estimate.
 *
 * Nobody chooses a supplier here. The box asks how many, what it is for
 * (the shelves, or the job or estimate it was opened from), when it is
 * needed and a note; the buyer sees it on Order parts. With no part
 * given, the box starts with a search of the shop's items, or takes a
 * part number or words as typed.
 */
export function AddToCartButton({
  part,
  forJob,
  forEstimate,
  source,
  label = 'Add to parts cart',
  className,
  tour,
}: {
  part?: CartPart
  forJob?: { id: string; label: string }
  forEstimate?: { id: string; label: string }
  source: NonNullable<NewAsk['source']>
  label?: string
  className?: string
  tour?: string
}) {
  const { hasAny } = usePermissions()
  const [open, setOpen] = useState(false)
  if (!hasAny([PERM.INVENTORY_EDIT, PERM.JOBS_EDIT])) return null

  return (
    <>
      <button
        type="button"
        data-tour={tour}
        onClick={() => setOpen(true)}
        className={className ?? 'inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:border-amber-400 hover:bg-amber-50'}
      >
        <IconShoppingCartPlus size={16} stroke={1.75} aria-hidden />
        {label}
      </button>
      {open && (
        <AddToCartDialog
          part={part}
          forJob={forJob}
          forEstimate={forEstimate}
          source={source}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export function AddToCartDialog({
  part,
  forJob,
  forEstimate,
  source,
  onClose,
}: {
  part?: CartPart
  forJob?: { id: string; label: string }
  forEstimate?: { id: string; label: string }
  source: NonNullable<NewAsk['source']>
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [picked, setPicked] = useState<CartPart | null>(part ?? null)
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [qty, setQty] = useState('1')
  const [forKind, setForKind] = useState<AskFor>(forEstimate ? 'estimate' : forJob ? 'job' : 'stock')
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [alsoEstimate, setAlsoEstimate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(text.trim()), 250)
    return () => window.clearTimeout(t)
  }, [text])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const found = useQuery({
    queryKey: ['catalog-parts', debounced],
    queryFn: () => lookupParts(debounced),
    enabled: !picked && debounced.length >= 2,
    staleTime: 30_000,
  })
  const matches: CatalogPart[] = !picked && debounced.length >= 2 ? (found.data ?? []) : []

  const typed = (): CartPart | null => {
    const t = text.trim()
    if (!t) return null
    return /\d/.test(t) ? { part_number: t, label: t } : { description: t, label: t }
  }

  const submit = async () => {
    const what = picked ?? typed()
    const n = Number(qty)
    if (!what) {
      setError('Pick a part, or type a part number or what it is.')
      return
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError('How many?')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await addAsk({
        catalog_item_id: what.catalog_item_id,
        part_number: what.part_number,
        description: what.description,
        reference_card_id: what.reference_card_id,
        list_price_cents: what.list_price_cents,
        qty: n,
        for_kind: forKind,
        work_order_id: forKind === 'job' ? forJob?.id : undefined,
        estimate_id: forKind === 'estimate' ? forEstimate?.id : undefined,
        add_to_estimate: forKind === 'estimate' ? alsoEstimate : undefined,
        needed_by: neededBy || undefined,
        notes: notes.trim() || undefined,
        source,
      })
      for (const key of CART_KEYS) void qc.invalidateQueries({ queryKey: [...key] })
      void qc.invalidateQueries({ queryKey: ['parts-readiness'] })
      if (forKind === 'estimate') void qc.invalidateQueries({ queryKey: ['estimates'] })
      setDone(res.note ?? (res.ask ? 'In the cart. Whoever orders parts will see it.' : 'Nothing to order: the shelves cover it.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Add to parts cart"
        data-tour="cart-add-dialog"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-xl bg-white text-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold">Add to parts cart</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <IconX size={16} />
          </button>
        </div>

        {done ? (
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm text-emerald-800">{done}</p>
            <div className="flex justify-end gap-2">
              {!part && (
                <button type="button" onClick={() => { setDone(null); setPicked(null); setText(''); setQty('1'); setNotes('') }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  Add another
                </button>
              )}
              <button type="button" onClick={onClose} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="space-y-3 px-4 py-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
            {picked ? (
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{picked.label ?? picked.description ?? picked.part_number}</p>
                  {picked.part_number && picked.label !== picked.part_number && (
                    <p className="truncate font-mono text-xs text-slate-500">{picked.part_number}</p>
                  )}
                </div>
                {!part && (
                  <button type="button" onClick={() => setPicked(null)} className="text-xs font-medium text-sky-700 hover:underline">Change</button>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="cart-part" className="block text-xs font-medium text-slate-600">Part</label>
                <input
                  id="cart-part"
                  value={text}
                  autoFocus
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Part number or what it is"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                {matches.length > 0 && (
                  <ul className="mt-1 max-h-44 list-none overflow-y-auto rounded-md border border-slate-200 p-0">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => setPicked({ catalog_item_id: m.id, label: m.name, part_number: m.supplier_sku ?? m.sku ?? undefined })}
                          className="block w-full border-b border-slate-100 px-2.5 py-1.5 text-left text-sm last:border-0 hover:bg-amber-50">
                          <span className="block truncate">{m.name}</span>
                          <span className="block truncate font-mono text-xs text-slate-500">{[m.sku, m.supplier_sku].filter(Boolean).join(' · ')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {debounced.length >= 2 && found.isSuccess && matches.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">Not one of your items. It goes in the cart as typed.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-600">
                How many
                <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm tabular-nums" />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Needed by
                <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
            </div>

            <fieldset>
              <legend className="text-xs font-medium text-slate-600">For</legend>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <ForChip on={forKind === 'stock'} onClick={() => setForKind('stock')}>Stock</ForChip>
                {forJob && <ForChip on={forKind === 'job'} onClick={() => setForKind('job')}>{forJob.label}</ForChip>}
                {forEstimate && <ForChip on={forKind === 'estimate'} onClick={() => setForKind('estimate')}>{forEstimate.label}</ForChip>}
              </div>
            </fieldset>
            {forKind === 'estimate' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={alsoEstimate} onChange={(e) => setAlsoEstimate(e.target.checked)} />
                Also put it on the estimate, at its sell price
              </label>
            )}

            <label className="block text-xs font-medium text-slate-600">
              Note for the buyer
              <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500}
                placeholder="Color, size, a supplier you trust…"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="submit" disabled={busy}
                className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                {busy ? 'Adding…' : 'Add to cart'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}

function ForChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={'rounded-full border px-2.5 py-0.5 text-xs font-medium ' + (on ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-300 text-slate-600 hover:bg-slate-50')}>
      {children}
    </button>
  )
}
