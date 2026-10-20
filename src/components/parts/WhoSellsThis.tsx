import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconStar, IconStarFilled } from '@tabler/icons-react'
import { changeSeller, sellersFor, type Seller } from '@/lib/purchaseRequests'
import { money } from '@/lib/catalogOrders'
import { PERM, usePermissions } from '@/hooks/usePermissions'

/**
 * "Who sells this": the suppliers this part has been bought from (or that
 * a catalog says sell it), what it last cost, how long it took to come,
 * and the shop's preferred one starred. It fills in by itself from orders;
 * starring one makes it the first choice on Order parts.
 */
export function WhoSellsThis({
  catalogItemId,
  partNumbers,
  tour = 'who-sells',
  compact = false,
}: {
  catalogItemId?: string
  partNumbers?: string[]
  tour?: string
  compact?: boolean
}) {
  const qc = useQueryClient()
  const { has, hasAny } = usePermissions()
  const canStar = has(PERM.INVENTORY_EDIT)
  const codes = (partNumbers ?? []).filter((p) => p.trim() !== '')
  const key = ['who-sells', catalogItemId ?? null, codes.join('|')]

  const q = useQuery({
    queryKey: key,
    queryFn: () => sellersFor({ catalog_item_id: catalogItemId, part_numbers: codes }),
    enabled: (!!catalogItemId || codes.length > 0) && hasAny([PERM.INVENTORY_VIEW, PERM.CATALOG_VIEW]),
    staleTime: 60_000,
  })
  const rows = q.data ?? []
  if (!catalogItemId && codes.length === 0) return null

  const star = async (row: Seller) => {
    await changeSeller(row.id, { preferred: !row.preferred })
    void qc.invalidateQueries({ queryKey: ['who-sells'] })
    void qc.invalidateQueries({ queryKey: ['order-parts'] })
  }

  return (
    <div data-tour={tour} data-sellers={rows.length > 0 ? 'some' : 'none'}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Who sells this</h3>
      {q.isLoading && <p className="mt-1 text-sm text-slate-500">Looking…</p>}
      {!q.isLoading && rows.length === 0 && (
        <p className="mt-1 text-sm text-slate-500">
          Nobody yet. Once it is ordered from a supplier, they show here with what it cost and how long it took.
        </p>
      )}
      {rows.length > 0 && (
        <ul className={'mt-1.5 list-none divide-y divide-slate-100 rounded-lg border border-slate-200 p-0 ' + (compact ? 'text-xs' : 'text-sm')}>
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 px-3 py-1.5">
              <button
                type="button"
                disabled={!canStar}
                onClick={() => void star(row)}
                aria-pressed={row.preferred}
                aria-label={row.preferred ? `${row.vendor} is preferred` : `Make ${row.vendor} preferred`}
                title={canStar ? (row.preferred ? 'Preferred supplier' : 'Make this the preferred supplier') : (row.preferred ? 'Preferred supplier' : undefined)}
                className="shrink-0 text-amber-500 disabled:cursor-default"
              >
                {row.preferred ? <IconStarFilled size={16} /> : <IconStar size={16} className="text-slate-300" />}
              </button>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{row.vendor}</span>
                {row.vendor_sku && row.vendor_sku !== row.part_number && (
                  <span className="block truncate font-mono text-xs text-slate-500">Their code {row.vendor_sku}</span>
                )}
              </span>
              <span className="shrink-0 text-right tabular-nums text-slate-700">
                {row.last_cost_cents != null ? money(row.last_cost_cents) : <span className="text-slate-400">No price yet</span>}
                <span className="block text-xs text-slate-500">
                  {row.lead_time_days != null ? (row.lead_time_days === 0 ? 'Same day' : `${row.lead_time_days} ${row.lead_time_days === 1 ? 'day' : 'days'}`) : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
