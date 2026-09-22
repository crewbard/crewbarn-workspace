import type { ReactNode } from 'react'

/**
 * Status / category chip. Use for static, semantic labels (active/inactive,
 * VIP, plan tier, count badges). For work-order STATUS pills whose color comes
 * from tenant data, keep using the dynamic statusColor helpers instead.
 *
 *   <Badge tone="success">Paid</Badge>
 *   <Badge tone="neutral">inactive</Badge>
 */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-navy-100 text-navy-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-800',
}

export function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
