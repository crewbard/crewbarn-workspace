import type { HTMLAttributes, ReactNode } from 'react'

/**
 * The standard surface: white, hairline border, rounded-xl, subtle shadow.
 * Replaces the hand-typed `bg-white border border-slate-200 rounded-xl shadow-sm`
 * scattered across pages. Add your own padding (`p-4`, etc.) per use.
 *
 *   <Card className="p-4">…</Card>
 */
export function Card({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
