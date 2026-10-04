import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconShoppingCart } from '@tabler/icons-react'
import { apiRequest } from '@/lib/api'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { openCatalogs } from '@/lib/catalogs'
import { relativeTime } from '@/lib/time'

type OrderLine = {
  part_number: string | null
  description: string
  qty: number
  source_document_id: string | null
  source_document_title: string | null
  source_page: number | null
  source_page_label: string | null
}

type CustomerOrder = {
  id: string
  status: 'new' | 'estimated' | 'declined'
  note: string | null
  declined_reason: string | null
  estimate_id: string | null
  estimate_number?: string | null
  created_at: string | null
  customer: { id: string; name: string } | null
  lines: OrderLine[]
}

/**
 * Orders customers sent from the shop's catalogues in the portal.
 *
 * Each is what the customer picked -- part numbers off a page, or lines in
 * their own words -- and one click makes a draft estimate of it: parts the
 * shop carries at its sell price, the rest at nothing to be priced. A page
 * reference opens the book at that page, so "7108, p. 164" is one click
 * from the row it came off. Hidden when there is nothing waiting.
 */
export function CustomerOrdersPanel() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { has } = usePermissions()
  const canAct = has(PERM.JOBS_EDIT)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const orders = useQuery({
    queryKey: ['customer-order-requests'],
    queryFn: () => apiRequest<{ waiting: CustomerOrder[]; recent: CustomerOrder[] }>('/v1/customer-order-requests'),
    refetchInterval: 60_000,
  })

  const waiting = orders.data?.waiting ?? []
  if (waiting.length === 0) return null

  const estimate = async (order: CustomerOrder) => {
    setBusy(order.id)
    setError(null)
    try {
      const res = await apiRequest<{ estimate: { id: string } }>(`/v1/customer-order-requests/${order.id}/estimate`, { method: 'POST', body: {} })
      void qc.invalidateQueries({ queryKey: ['customer-order-requests'] })
      void qc.invalidateQueries({ queryKey: ['estimates'] })
      navigate(`/estimates/${res.estimate.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The estimate was not made.')
    } finally {
      setBusy(null)
    }
  }

  const decline = async (order: CustomerOrder) => {
    const reason = window.prompt(`Why not? ${order.customer?.name ?? 'The customer'} will see this.`, '')
    if (!reason?.trim()) return
    setBusy(order.id)
    setError(null)
    try {
      await apiRequest(`/v1/customer-order-requests/${order.id}/decline`, { method: 'POST', body: { reason: reason.trim() } })
      void qc.invalidateQueries({ queryKey: ['customer-order-requests'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Orders from customers" className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <IconShoppingCart size={17} className="text-amber-600" />
        Orders from customers
        <span className="rounded-full bg-amber-500 px-2 py-px text-xs font-semibold text-white">{waiting.length}</span>
      </h2>
      <p className="mt-0.5 text-xs text-slate-600">
        Built from your catalogs in the customer portal. Make one an estimate, then price anything you don't carry.
      </p>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      <ul className="mt-3 list-none space-y-3 p-0">
        {waiting.map((order) => (
          <li key={order.id} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium text-slate-900">{order.customer?.name ?? 'Customer'}</span>
              <span className="text-xs text-slate-500">
                {relativeTime(order.created_at)} · {order.lines.length} {order.lines.length === 1 ? 'line' : 'lines'}
              </span>
              <span className="grow" />
              {canAct && (
                <>
                  <button
                    type="button"
                    disabled={busy === order.id}
                    onClick={() => void decline(order)}
                    className="rounded px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={busy === order.id}
                    onClick={() => void estimate(order)}
                    className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {busy === order.id ? 'Making it…' : 'Create estimate'}
                  </button>
                </>
              )}
            </div>
            {order.note && <p className="mt-1.5 text-sm text-slate-700">“{order.note}”</p>}
            <ul className="mt-2 list-none space-y-1 p-0 text-sm">
              {order.lines.map((line, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="w-10 shrink-0 text-right tabular-nums text-slate-500">{line.qty} ×</span>
                  {line.part_number && <span className="font-mono text-slate-900">{line.part_number}</span>}
                  <span className="min-w-0 flex-1 text-slate-700">{line.description !== line.part_number ? line.description : ''}</span>
                  {line.source_document_id && (
                    <button
                      type="button"
                      onClick={() => openCatalogs({ documentId: line.source_document_id!, page: line.source_page ?? undefined })}
                      className="text-xs text-sky-700 hover:underline"
                      title="Open the catalog at this page"
                    >
                      {line.source_document_title ?? 'Catalog'}{line.source_page_label ? ` p. ${line.source_page_label}` : ''}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
