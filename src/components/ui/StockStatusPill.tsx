import { STATUS_LABEL, type StockStatus } from '@/lib/stockRows'

/**
 * OK / Low / Out, for Inventory > Stock and the Product catalog. Status colours
 * stay fixed on every theme so they always mean the same.
 */
const PILL: Record<StockStatus, string> = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  low: 'bg-orange-50 text-orange-800 border-orange-200',
  out: 'bg-red-50 text-red-700 border-red-200',
}

export function StatusPill({ status, label }: { status: StockStatus; label?: string }) {
  return <span data-status={status} className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${PILL[status]}`}>{label ?? STATUS_LABEL[status]}</span>
}
