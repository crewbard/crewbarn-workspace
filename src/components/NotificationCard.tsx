import { useId, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'

/** A fixed-size notification: revealing actions never moves nearby content. */
export function NotificationCard({ kind, customer, avatar, subtitle, description, actions, onDismiss, tone = 'amber', urgent = false }: {
  kind: string
  customer: string
  avatar?: { id?: string | null; imageUrl?: string | null; preset?: string | null }
  subtitle?: string
  description: string
  actions?: ReactNode
  onDismiss: () => void
  tone?: 'amber' | 'violet' | 'rose'
  urgent?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  return (
    <section className={`cb-notification cb-notification-${tone}`} data-expanded={expanded} aria-label={`${kind}: ${customer}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold uppercase tracking-wide">{kind}</span>
        <button type="button" onClick={onDismiss} aria-label={`Dismiss ${kind}`} className="shrink-0 rounded px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>
      <div role={urgent ? 'alert' : 'status'} className="flex min-w-0 items-start gap-3">
        {avatar && <Avatar name={customer} colorKey={avatar.id} imageUrl={avatar.imageUrl} preset={avatar.preset} size={40} className="shrink-0" />}
        <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-900" title={customer}>{customer}</p>
        <p className="truncate text-xs leading-5 text-slate-500" title={subtitle}>{subtitle || '\u00a0'}</p>
        {urgent && <span className="sr-only">{description}</span>}
        </div>
      </div>
      <button type="button" className="w-fit rounded text-xs font-semibold text-slate-600 underline underline-offset-2" aria-controls={detailsId} aria-pressed={expanded} onClick={() => setExpanded(v => !v)}>
        {expanded ? 'Unpin details' : 'Keep details open'}
      </button>
      <div id={detailsId} className="cb-notification-details">
        <p className="break-words text-xs leading-5 text-slate-600">{description}</p>
        {actions && <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  )
}
