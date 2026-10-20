import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { IconShoppingCart } from '@tabler/icons-react'
import { cartCount } from '@/lib/purchaseRequests'
import { PERM, usePermissions } from '@/hooks/usePermissions'

/**
 * "Parts to order (N)" in the header. For whoever orders parts it counts
 * the different parts waiting for them; for anyone else, what they have
 * asked for that is still waiting. Both open Order parts.
 */
export function PartsCartBadge({ compact = false }: { compact?: boolean }) {
  const { has, hasAny } = usePermissions()
  const buyer = has(PERM.INVENTORY_ORDER)
  const q = useQuery({
    queryKey: ['parts-cart-count'],
    queryFn: cartCount,
    refetchInterval: 60_000,
    enabled: hasAny([PERM.INVENTORY_EDIT, PERM.JOBS_EDIT, PERM.INVENTORY_ORDER]),
  })
  const n = buyer ? (q.data?.waiting ?? 0) : (q.data?.mine ?? 0)
  if (!q.data || (!buyer && n === 0)) return null

  const text = `Parts to order (${n})`
  return (
    <Link
      to="/order-parts"
      data-tour="topbar-parts-cart"
      title={buyer ? 'Parts your crew asked for, waiting for suppliers to be chosen' : 'Parts you asked for that are still waiting to be ordered'}
      className={`${compact ? 'ml-1 h-8 px-2' : 'ml-2 h-9 px-2.5'} inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-white/85 transition-colors hover:bg-white/10`}
    >
      <IconShoppingCart size={18} stroke={1.75} aria-hidden />
      <span className={compact ? 'sr-only' : 'hidden lg:inline'}>{text}</span>
      {n > 0 && (
        <span className="min-w-[1.25rem] rounded-full bg-amber-400 px-1.5 text-center text-xs font-bold text-slate-900 tabular-nums">{n}</span>
      )}
    </Link>
  )
}
