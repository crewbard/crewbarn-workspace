import { useEffect } from 'react'
import type { Customer } from '@/types/customer'
import { CustomerMessagesTab } from './CustomerMessagesTab'
import { WorkOrderMessagesTab } from './WorkOrderMessagesTab'

/**
 * What the drawer is messaging about. Estimates have no thread of their own —
 * they ride the customer's thread, so the caller passes the estimate's customer.
 */
export type MessagesContext =
  | { kind: 'customer'; customer: Customer }
  | { kind: 'work_order'; workOrderId: string; customerId: string | null }

/**
 * Slide-over messages panel — view + send texts/emails for a customer or job
 * without leaving the current page. Wraps the same thread/compose components
 * the Messages tab uses, so behavior stays identical everywhere.
 */
export function MessagesDrawer({
  open,
  onClose,
  context,
  title = 'Messages',
}: {
  open: boolean
  onClose: () => void
  context: MessagesContext | null
  title?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !context) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex h-[95vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl bg-slate-50 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shrink-0">
          <h2 className="text-base font-semibold text-navy-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 p-3 sm:p-4">
          {context.kind === 'customer' && <CustomerMessagesTab customer={context.customer} fill />}
          {context.kind === 'work_order' && (
            <WorkOrderMessagesTab workOrderId={context.workOrderId} customerId={context.customerId} fill />
          )}
        </div>
      </div>
    </div>
  )
}

export default MessagesDrawer
