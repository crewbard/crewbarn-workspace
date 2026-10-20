import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ReceiveStockModal } from "@/components/inventory/ReceiveStockModal"
import { useStockInRules } from "@/hooks/usePoOverride"
import type { StockInKey } from "@/lib/poOverride"

/** The Inventory page's tabs (the ?tab= value). */
export type InventoryTabKey = "locations" | "bins" | "stock" | "units" | "movements" | "reconciliation" | "settings"
/**
 * The one way stock comes in, on the header and on Stock Levels: from a
 * purchase order (the Bins PO window), a counter pickup (ReceiveStockModal,
 * with the override box when PO-only is on), or a count correction (Edit on a
 * Stock Levels row). Which ones are open is useStockInRules (PoOnlyGate).
 */
export function StockInButton({ tour, defaultLocationId }: { tour: string; defaultLocationId?: string }) {
  const { canEdit, poRequired, choices } = useStockInRules()
  const [open, setOpen] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open])
  if (!canEdit) return null
  const go = (tab: InventoryTabKey, extra: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    for (const [k, v] of Object.entries(extra)) next.set(k, v)
    setSearchParams(next)
  }
  const pick = (key: StockInKey) => {
    setOpen(false)
    if (key === 'po') go('bins', { stockin: 'po' })
    else if (key === 'counter') setReceiving(true)
    else go('stock', { correct: '1' })
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-tour={tour}
        data-stock-in
        data-require-po={poRequired ? 'yes' : 'no'}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md bg-[var(--accent-500,#e8902c)] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
      >
        + Stock in <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" aria-hidden="true" onClick={() => setOpen(false)} />
          <div role="menu" data-tour="inv-stockin-menu" className="absolute right-0 z-40 mt-1 w-[300px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            {choices.map((c) => (
              <button
                key={c.key}
                type="button"
                role="menuitem"
                data-tour={`inv-stockin-${c.key}`}
                aria-disabled={!c.enabled || undefined}
                onClick={() => c.enabled && pick(c.key)}
                className={`block w-full rounded-md px-3 py-2 text-left ${c.enabled ? 'hover:bg-[var(--accent-50,#fdf7ee)]' : 'cursor-not-allowed'}`}
              >
                <span className={`block text-sm font-semibold ${c.enabled ? 'text-slate-900' : 'text-slate-600'}`}>{c.label}</span>
                <span className="block text-[12.5px] leading-snug text-slate-600">{c.hint}</span>
              </button>
            ))}
            {poRequired && (
              <p className="border-t border-slate-100 px-3 py-2 text-[12px] text-slate-600">
                Or receive it on the order in <Link to="/purchase-orders" className="font-semibold text-[var(--accent-700,#9c5c14)] underline">Purchase orders</Link>.
              </p>
            )}
          </div>
        </>
      )}
      <ReceiveStockModal
        isOpen={receiving}
        onClose={() => setReceiving(false)}
        defaultLocationId={defaultLocationId}
      />
    </div>
  )
}
