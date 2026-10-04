import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, ApiError, API_URL, getActingTenant, getStoredToken, isDeleteCancelled } from '@/lib/api'
import { formatTime12 } from '@/lib/time'
import { useWorkOrder, useDeleteWorkOrder, useLineItems } from '@/hooks/useWorkOrders'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'
import { usePermissions } from '@/hooks/usePermissions'
import { useTheme } from '@/hooks/useTheme'
import { WorkOrderLineItemEditorLive } from '@/components/WorkOrderLineItemEditorLive'
import { PartsOrders } from '@/components/estimates/PartsOrders'
import { WorkOrderFieldLogPanel } from '@/components/workorders/WorkOrderFieldLogPanel'
import { WorkOrderDrivesPanel } from '@/components/workorders/WorkOrderDrivesPanel'
import { WorkOrderPdfPreview } from '@/components/workorders/WorkOrderPdfPreview'
import {
  WorkOrderQuickEdit,
  type WorkOrderQuickEditHandle,
  type WorkOrderQuickEditState,
} from '@/components/workorders/WorkOrderQuickEdit'
import { WorkOrderStatusHistory } from '@/components/workorders/WorkOrderStatusHistory'
import { WorkOrderPhotosPanel } from '@/components/workorders/WorkOrderPhotosPanel'
import { ReferencedText } from '@/components/ReferencedText'
import { TasksPanel } from '@/components/tasks/TasksPanel'
import { EntityActivityPanel } from '@/components/EntityActivityPanel'
import { AttachmentsPanel } from '@/components/attachments/AttachmentsPanel'
import { WorkOrderNotesPanel, WorkOrderNotesTabButton } from '@/components/workorders/WorkOrderNotesPanel'
import { NeedsAttentionBanner } from '@/components/workorders/NeedsAttentionBanner'
import { WorkOrderCustomerAssetsPanel } from '@/components/workorders/WorkOrderCustomerAssetsPanel'
import { WorkOrderInspectionPanel } from '@/components/workorders/WorkOrderInspectionPanel'
import { WorkOrderAgreementsPanel } from '@/components/workorders/WorkOrderAgreementsPanel'
import { WorkOrderHistoryPanel } from '@/components/workorders/WorkOrderHistoryPanel'
import { WorkOrderAiFieldMapStatus } from '@/components/workorders/WorkOrderAiFieldMapStatus'
import { SubOutModal } from '@/components/subs/SubOutModal'
import { WorkOrderSubInvoicePanel } from '@/components/workorders/WorkOrderSubInvoicePanel'
import { WorkOrderSignaturesPanel } from '@/components/workorders/WorkOrderSignaturesPanel'
import { WorkOrderMessagesTab } from '@/components/comms/WorkOrderMessagesTab'
import { MessagesDrawer } from '@/components/comms/MessagesDrawer'
import { SubJobLinkPanel } from '@/components/workorders/SubJobLinkPanel'

import { ReceivePaymentModal } from '@/components/ReceivePaymentModal'
import { TerminalChargeButton } from '@/components/invoices/TerminalChargeButton'
import { InvoiceOverlay } from '@/components/invoices/InvoiceOverlay'
import type { Invoice } from '@/types/invoice'
import type { WorkOrder } from '@/types/workOrder'

type ReceiptAttachment = {
  id: string
  original_filename?: string | null
  url?: string | null
  thumbnail_url?: string | null
  mime_type?: string | null
}

type JobExpense = {
  id: string
  expense_date: string | null
  category: string
  description: string
  amount_cents: number
  tax_cents: number
  status: string
  payment_method: string | null
  reference_number: string | null
  reimbursable: boolean
  reimbursement_status: string
  billable_to_job: boolean
  notes: string | null
  receipt_attachment_ids?: string[]
  receipt_attachments?: ReceiptAttachment[]
  employee?: { id: string; name: string | null; email: string | null } | null
  created_at: string | null
}

type StaffOption = {
  id: string
  name: string
  email: string
  role_slug: string | null
  status: string
}

const EXPENSE_CATEGORY_OPTIONS = [
  ['parts_materials', 'Parts/materials'],
  ['fuel', 'Fuel'],
  ['parking_tolls', 'Parking/tolls'],
  ['tools_equipment', 'Tools/equipment'],
  ['travel_meals', 'Travel/meals'],
  ['other', 'Other'],
] as const

function money(cents: number) {
  return `$${((cents || 0) / 100).toFixed(2)}`
}

type Tab =
  | 'overview'
  | 'line-items'
  | 'tasks'
  | 'notes'
  | 'customer-assets'
  | 'inspection'
  | 'agreements'
  | 'doc'
  | 'photos'
  | 'documents'
  | 'cost'
  | 'reimbursements'
  | 'sub-invoice'
  | 'signatures'
  | 'messages'
  | 'drives'
  | 'history'
  | 'activity'

const TABS: Tab[] = [
  'overview',
  'line-items',
  'tasks',
  'notes',
  'customer-assets',
  'inspection',
  'agreements',
  'doc',
  'photos',
  'documents',
  'cost',
  'reimbursements',
  'sub-invoice',
  'signatures',
  'messages',
  'drives',
  'history',
  'activity',
]

type JobSection = 'overview' | 'field' | 'money' | 'messages' | 'notes' | 'log'

function tabSection(tab: Tab): JobSection {
  switch (tab) {
    case 'overview':
      return 'overview'
    case 'line-items':
    case 'tasks':
    case 'customer-assets':
    case 'inspection':
    case 'agreements':
    case 'doc':
    case 'photos':
    case 'documents':
      return 'field'
    case 'cost':
    case 'reimbursements':
    case 'sub-invoice':
    case 'signatures':
      return 'money'
    case 'messages':
      return 'messages'
    case 'notes':
      return 'notes'
    case 'drives':
    case 'history':
    case 'activity':
      return 'log'
  }
}

function sectionDefaultTab(section: JobSection): Tab {
  switch (section) {
    case 'overview':
      return 'overview'
    case 'field':
      return 'line-items'
    case 'money':
      return 'cost'
    case 'messages':
      return 'messages'
    case 'notes':
      return 'notes'
    case 'log':
      return 'drives'
  }
}
export function WorkOrderDetailPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const { has } = usePermissions()
  const workOrderQuery = useWorkOrder(id)
  const deleteWorkOrder = useDeleteWorkOrder()
  const tab = TABS.includes(searchParams.get('tab') as Tab) ? (searchParams.get('tab') as Tab) : 'overview'
  const activeSection = tabSection(tab)
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', next)
    }
    setSearchParams(params, { replace: true })
  }
  const [declineReason, setDeclineReason] = useState('')
  const [showDecline, setShowDecline] = useState(false)
  const [subOutOpen, setSubOutOpen] = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  /** When true, SubOutModal opens in edit mode (prefills from sub_assignment + PATCHes on save). */
  const [editSubOutOpen, setEditSubOutOpen] = useState(false)
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false)
  // The invoice opens on top of the job, not on its own page.
  const [invoiceOverlayId, setInvoiceOverlayId] = useState<string | null>(null)
  const quickEditRef = useRef<WorkOrderQuickEditHandle>(null)
  const [quickEditState, setQuickEditState] = useState<WorkOrderQuickEditState>({
    dirty: false,
    saving: false,
    saved: false,
  })

  const unSubMutation = useMutation({
    mutationFn: () => apiRequest(`/v1/work-orders/${id}/sub-out`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
    onError: (e: Error) => alert(`Couldn't un-sub: ${e.message}`),
  })

  const acceptReq = useMutation({
    mutationFn: () => apiRequest(`/v1/work-orders/${id}/accept`, { method: 'POST' }),
    onSuccess: () => {
      // useWorkOrder uses workOrderKeys.detail = ['work-orders','detail',id]
      // Invalidating the prefix catches detail + lists + the topbar count.
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['work-orders-incoming-requests'] })
      qc.invalidateQueries({ queryKey: ['topbar-incoming-work-requests'] })
    },
  })
  const declineReq = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${id}/decline`, {
        method: 'POST',
        body: { reason: declineReason.trim() || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders-incoming-requests'] })
      qc.invalidateQueries({ queryKey: ['topbar-incoming-work-requests'] })
      navigate('/jobs')
    },
  })

  // Create-invoice action — only enabled when the WO is in a 'complete'
  // status category. Reuses the existing POST /v1/invoices endpoint with
  // copy_line_items_from_work_order so the new invoice mirrors the WO.
  // `open` = show it in the overlay afterwards (a click); the automatic
  // create on Complete just makes the Charge / View invoice buttons appear.
  const createInvoice = useMutation({
    mutationFn: (v: { customerId: string; open: boolean; extraWorkOnly?: boolean }) =>
      apiRequest<{ data: { id: string; invoice_number: string } }>('/v1/invoices', {
        method: 'POST',
        body: {
          customer_id: v.customerId,
          work_order_id: id,
          copy_line_items_from_work_order: true,
          // Only sent after the server has refused once and the person
          // has said this invoice is the extra work, not the visit.
          ...(v.extraWorkOnly ? { extra_work_only: true } : {}),
        },
      }),
    onSuccess: (resp, v) => {
      qc.invalidateQueries({ queryKey: ['work-order-invoices', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      if (v.open) setInvoiceOverlayId(resp.data.id)
    },
    onError: (e: Error, v) => {
      if (e instanceof ApiError && e.code === 'already_invoiced') {
        qc.invalidateQueries({ queryKey: ['work-order-invoices', id] })
        const invoiceId =
          e.details && typeof e.details === 'object' && 'invoice_id' in e.details
            ? (e.details as { invoice_id?: unknown }).invoice_id
            : null
        if (invoiceId && v.open) setInvoiceOverlayId(String(invoiceId))
        return
      }
      if (!v.open) return // the automatic one stays quiet; the button is still there
      if (e instanceof ApiError && e.code === 'not_completed') {
        alert('This job must be marked Complete before you can invoice it.')
        return
      }
      alert(`Couldn't create invoice: ${e.message}`)
    },
  })

  // Does this job already have an invoice? Drives the payment button:
  // no invoice → "Take down payment"; invoice present → "Receive payment".
  const woInvoicesQ = useQuery({
    queryKey: ['work-order-invoices', id],
    queryFn: () =>
      apiRequest<{ data: Invoice[] }>(`/v1/invoices?work_order_id=${id}`),
    enabled: !!id,
  })
  // A job gets one invoice. Ignore cancelled ones (a fresh invoice is fine
  // after a cancel). The first live invoice is the one to view.
  const liveInvoice = (woInvoicesQ.data?.data ?? []).find((i) => i.status !== 'cancelled')
  const hasInvoice = !!liveInvoice

  // Marked Complete right here? Invoice it on the spot, so "View invoice"
  // and the terminal Charge button show up without anyone clicking Invoice
  // Job. Only on a change seen on this screen — an old completed job that
  // was never invoiced keeps its Invoice Job button and nothing happens
  // behind the office's back.
  const statusCategory = workOrderQuery.data?.status?.category ?? null
  const customerIdForInvoice = workOrderQuery.data?.service_customer?.id ?? null
  const prevCategory = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const prev = prevCategory.current
    prevCategory.current = statusCategory
    if (prev === undefined || prev === statusCategory || statusCategory !== 'complete' || !customerIdForInvoice) return
    woInvoicesQ.refetch().then((r) => {
      const live = (r.data?.data ?? []).find((i) => i.status !== 'cancelled')
      if (!live) createInvoice.mutate({ customerId: customerIdForInvoice, open: false })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusCategory, customerIdForInvoice])

  // Down payments collected on this job (received, not voided).
  const woPaymentsQ = useQuery({
    queryKey: ['work-order-payments', id],
    queryFn: () =>
      apiRequest<{ data: Array<{ amount_cents: number; status: string; payment_method?: string }> }>(
        `/v1/payments?work_order_id=${id}`,
      ),
    enabled: !!id,
  })
  const downPaymentCents = (woPaymentsQ.data?.data ?? [])
    .filter((p) => p.status === 'received')
    .reduce((sum, p) => sum + (p.amount_cents || 0), 0)
  // Cash / check / offline card a tech took but the office hasn't counted
  // in yet. The invoice already reads paid (the customer did pay); this is
  // the internal custody step, shown so the office knows where the money is.
  const awaitingCountIn = (woPaymentsQ.data?.data ?? []).some((p) => p.status === 'pending_turnover')

  if (workOrderQuery.isLoading) {
    return <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 pt-4 sm:pt-8 pb-40 text-slate-500">Loading...</div>
  }

  if (workOrderQuery.error || !workOrderQuery.data) {
    return (
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 pt-4 sm:pt-8 pb-40">
        <div className="text-red-600 mb-2">Job not found.</div>
        <Link to="/jobs" className="text-sm text-amber-700 hover:underline">
          &larr; Back to Jobs
        </Link>
      </div>
    )
  }

  const wo = workOrderQuery.data

  async function handleDelete() {
    if (!id) return
    // Confirmation handled by the global delete modal (password + reason).
    try {
      await deleteWorkOrder.mutateAsync(id)
      navigate('/jobs')
    } catch (err) {
      if (isDeleteCancelled(err)) return
      // Surface real reasons — notably the "this job has been invoiced" block.
      alert(err instanceof ApiError ? err.message : 'Failed to delete job.')
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 pt-4 sm:pt-8 pb-40">
      {/*
        Covered by a service agreement.
        Above everything, because it changes what the person is allowed to
        do on this job: the fee has already paid for the visit, so nobody
        collects for it and nobody invoices it a second time. Green, not
        amber — this is not a problem, it is a fact about the work.
      */}
      {wo.covered_by && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-bold text-emerald-900">
            Covered by {wo.covered_by.title ?? 'a service agreement'}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-emerald-800">
            Their fee already pays for this visit — do not collect payment for it. Extra work found on the visit
            is quoted and billed separately.
          </p>
          {wo.covered_by.contract_id && (
            <Link
              to={`/maintenance-contracts/${wo.covered_by.contract_id}`}
              className="mt-1.5 inline-block text-sm font-semibold text-emerald-900 underline"
            >
              Open the agreement
            </Link>
          )}
        </div>
      )}

      {/* Dormant force-notes gate (#3) — blocks the job until the tech logs
          a note on what's the hold-up. Gated server-side by the tenant rule. */}
      {wo.requires_note && id && (
        <DormantNoteGate
          workOrderId={id}
          onAdded={() => qc.invalidateQueries({ queryKey: ['work-orders', 'detail', id] })}
        />
      )}
      {/* COD force-collection gate (#4) — blocks the job until payment is
          collected or dispatch overrides. */}
      {wo.requires_collection && id && (
        <CodCollectionGate
          workOrderId={id}
          customerId={wo.billing_customer?.id ?? wo.service_customer?.id ?? null}
          customerName={wo.service_customer?.display_name ?? ''}
          onResolved={() => qc.invalidateQueries({ queryKey: ['work-orders', 'detail', id] })}
        />
      )}
      <Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-800 mb-4">
        &larr; Back to Jobs
      </Link>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-4">
        {easy && <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-950 px-5 py-4 text-white sm:px-7">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">Job workspace</p>
            <p className="mt-1 text-sm">Plan the visit, carry out the work, and review billing—all in one place.</p></div>
          <span className="rounded-full border border-emerald-700 px-3 py-1 text-xs text-emerald-100">{wo.display_number}</span>
        </div>}
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs font-semibold text-slate-500">{wo.display_number}</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                wo.status?.category === 'complete'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : wo.status?.category === 'cancelled'
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                {wo.status?.name ?? 'Open'}
              </span>
              {/* Billing state comes from the invoice, never from a job
                  status: not invoiced → invoiced (balance) → paid. */}
              {(() => {
                if (!liveInvoice) {
                  return wo.status?.category === 'complete' ? (
                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800" title="Complete but no invoice yet">
                      Not invoiced
                    </span>
                  ) : null
                }
                if (liveInvoice.status === 'paid') {
                  return (
                    <span
                      className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                      title={awaitingCountIn ? 'Customer paid; the money is with the tech until it is counted in at the cash register' : 'Invoice paid in full'}
                    >
                      Paid{awaitingCountIn ? ' · awaiting count-in' : ''}
                    </span>
                  )
                }
                const due = liveInvoice.money?.balance_due_cents ?? 0
                return (
                  <span
                    className="inline-flex items-center rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800"
                    title={liveInvoice.bank_transfer_promised_at ? 'Customer says a bank transfer is on the way' : `Invoice ${liveInvoice.display_number} — balance due`}
                  >
                    Invoiced{due > 0 ? ` · $${(due / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due` : ''}
                    {liveInvoice.bank_transfer_promised_at ? ' · transfer on the way' : ''}
                  </span>
                )
              })()}
            </div>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{wo.title}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 flex-wrap">
              {wo.job_type && <span>{wo.job_type.name}</span>}
              <span className="text-slate-300">•</span>
              <span className="capitalize">{wo.priority}</span>
              {downPaymentCents > 0 && (
                <span
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                  title={hasInvoice ? 'Applied to this job’s invoice' : 'Will auto-apply when this job is invoiced'}
                >
                  Down payment: ${(downPaymentCents / 100).toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 flex-wrap lg:justify-end">
            <button
              type="button"
              onClick={() => setMessagesOpen(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              title="View / send texts + emails for this job"
            >
              💬 Messages
            </button>
            {!wo.is_subbed && (
              <button
                type="button"
                onClick={() => setSubOutOpen(true)}
                className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 whitespace-nowrap"
                title="Outsource this job to a vendor partner"
              >
                Sub this out
              </button>
            )}
            {hasInvoice ? (
              <button
                type="button"
                onClick={() => setInvoiceOverlayId(liveInvoice!.id)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                title="Open this job's invoice"
              >
                View invoice
              </button>
            ) : (
              wo.status?.category === 'complete' && wo.service_customer?.id && (
                <button
                  type="button"
                  onClick={() => {
                    /*
                     * A covered visit is already paid for by the
                     * agreement's fee. The server refuses it too — this
                     * asks first so the answer is a decision rather than
                     * an error message.
                     */
                    if (wo.covered_by) {
                      const agreement = wo.covered_by.title ?? 'a service agreement'
                      const ok = window.confirm(
                        `This visit is covered by "${agreement}". Their fee already pays for it.\n\n` +
                          'Only continue if you are invoicing EXTRA work found on the visit.',
                      )
                      if (!ok) return
                      createInvoice.mutate({
                        customerId: wo.service_customer!.id,
                        open: true,
                        extraWorkOnly: true,
                      })
                      return
                    }
                    createInvoice.mutate({ customerId: wo.service_customer!.id, open: true })
                  }}
                  disabled={createInvoice.isPending}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                  title={
                    wo.covered_by
                      ? 'Covered by a service agreement — only invoice extra work'
                      : "Snapshot this job's line items into a new invoice"
                  }
                >
                  {createInvoice.isPending
                    ? 'Creating…'
                    : wo.covered_by
                      ? 'Invoice extra work'
                      : 'Invoice Job'}
                </button>
              )
            )}
            {wo.service_customer?.id && (
              <button
                type="button"
                onClick={() => setReceivePaymentOpen(true)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                title={hasInvoice ? 'Receive a payment against this job’s invoice' : 'Take a down payment on this job'}
              >
                {hasInvoice ? 'Receive payment' : 'Take down payment'}
              </button>
            )}
            {/* Straight to the Smart Terminal for whatever's still owed on
                the invoice. Renders only when a terminal is ticked and the
                invoice has a balance. */}
            {liveInvoice && liveInvoice.status !== 'paid' && liveInvoice.money && (
              <TerminalChargeButton
                invoice={liveInvoice}
                compact
                onSettled={() => {
                  woInvoicesQ.refetch()
                  qc.invalidateQueries({ queryKey: ['payments'] })
                }}
              />
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 whitespace-nowrap"
            >
              Delete
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm sm:grid-cols-2 lg:grid-cols-5 mb-5">
        <div className="bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Customer</div>
          {wo.service_customer ? (
            <Link
              to={`/customers/${wo.service_customer.id}`}
              className="mt-1 block truncate text-sm font-semibold text-amber-700 hover:text-amber-800 hover:underline"
            >
              {wo.service_customer.display_name}
            </Link>
          ) : (
            <div className="mt-1 truncate text-sm font-semibold text-slate-900">Not assigned</div>
          )}
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Location</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900">
            {wo.service_location
              ? [wo.service_location.city, wo.service_location.state].filter(Boolean).join(', ') || wo.service_location.nickname || 'Service location'
              : 'Not assigned'}
          </div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Schedule</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {wo.schedule?.is_scheduled ? `${wo.schedule.date ?? 'Scheduled'}${wo.schedule.start_time ? ` · ${formatTime12(wo.schedule.start_time)}` : ''}` : 'Unscheduled'}
          </div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Lead tech</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900">{wo.lead_tech?.full_name ?? 'Unassigned'}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{wo.money?.total_formatted ?? '—'}</div>
        </div>
      </div>
      {/* Cross-tenant mirror banner — when this WO landed in our
          tenant because a partner subbed it to us. Shows status +
          a deep-link back to the inbound inbox. The partner's side
          stays in their own WO; we never reference their wo_id by
          URL because it isn't accessible from our tenant scope. */}
      {wo.mirror && (
        <section
          className={`border rounded-xl p-4 mb-4 ${
            wo.mirror.status === 'pending_accept'
              ? 'bg-sky-50 border-sky-200'
              : wo.mirror.status === 'accepted'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider mb-1 text-slate-700">
                Cross-tenant sub job · {wo.mirror.status.replace(/_/g, ' ')}
              </div>
              <div className="text-sm text-slate-900">
                Routed in from a partner tenant. This is a mirror — the
                originator's work order lives in their tenant.
              </div>
              {wo.mirror.declined_reason && (
                <div className="mt-2 text-xs text-red-800 whitespace-pre-line border-l-2 border-red-400 pl-3">
                  Declined: {wo.mirror.declined_reason}
                </div>
              )}
            </div>
            <Link
              to="/inbound-sub-jobs"
              className="px-3 py-1.5 text-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md shrink-0"
            >
              Inbound inbox →
            </Link>
          </div>
        </section>
      )}

      {/* Sub assignment banner — only when this WO is subbed. */}
      {wo.is_subbed && wo.sub_assignment && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>Subbed out · {wo.sub_assignment.sub_status?.replace(/_/g, ' ')}</span>
                {wo.sub_assignment.sub_acceptance_status === 'pending' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                    Awaiting sub accept
                  </span>
                )}
                {wo.sub_assignment.sub_acceptance_status === 'accepted' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Sub accepted
                  </span>
                )}
                {wo.sub_assignment.sub_acceptance_status === 'declined_by_sub' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                    Sub declined
                  </span>
                )}
              </div>
              {wo.sub_assignment.sub_acceptance_status === 'declined_by_sub' && wo.sub_assignment.sub_decline_reason && (
                <div className="mt-1 mb-1 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2">
                  <strong>Decline reason:</strong> {wo.sub_assignment.sub_decline_reason}
                </div>
              )}
              <div className="text-sm text-slate-900">
                <span className="font-mono text-xs text-slate-600 mr-2">
                  {wo.sub_assignment.sub_wo_number}
                </span>
                <strong>{wo.sub_assignment.subcontractor?.business_name ?? '(unknown sub)'}</strong>
                {wo.sub_assignment.subcontractor?.phone && (
                  <span className="text-slate-500"> · {wo.sub_assignment.subcontractor.phone}</span>
                )}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Base NTE <span className="font-mono">${(wo.sub_assignment.sub_nte_cents / 100).toFixed(2)}</span>
                {wo.sub_assignment.effective_sub_nte_cents > wo.sub_assignment.sub_nte_cents && (
                  <>
                    {' · '}
                    Effective <span className="font-mono font-bold">${(wo.sub_assignment.effective_sub_nte_cents / 100).toFixed(2)}</span>
                    {' '}(extensions applied)
                  </>
                )}
              </div>
              {wo.sub_assignment.sub_special_instructions && (
                <div className="mt-2 text-xs text-slate-700 whitespace-pre-line border-l-2 border-amber-300 pl-3">
                  {wo.sub_assignment.sub_special_instructions}
                </div>
              )}
              {/* Magic-link panel — generate/copy/revoke the per-WO
                  sub.crewbarn.com/j/{token} link. Only meaningful for
                  non-CrewBarn subs; for CrewBarn-tenant subs the
                  cross-tenant mirror handles dispatch instead. */}
              <SubJobLinkPanel workOrderId={wo.id} />
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Link
                to="/sub-reviews"
                className="px-3 py-1.5 text-sm border border-amber-500 text-amber-700 hover:bg-amber-100 rounded-md"
              >
                Review pending →
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditSubOutOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md"
                  title="Change sub, revise NTE, or update instructions"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        "Un-sub this WO? Clears the assignment and returns the job to in-house. The sub loses portal access to it.",
                      )
                    ) {
                      unSubMutation.mutate()
                    }
                  }}
                  disabled={unSubMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
                  title="Clear the sub assignment entirely"
                >
                  {unSubMutation.isPending ? 'Un-subbing…' : 'Un-sub'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sub-out modal — create mode (no initial* props) */}
      {wo.id && (
        <SubOutModal
          isOpen={subOutOpen}
          onClose={() => setSubOutOpen(false)}
          workOrderId={wo.id}
          onSubbed={() => qc.invalidateQueries({ queryKey: ['work-orders'] })}
        />
      )}

      {/* Sub-out modal — edit mode. Prefilled from wo.sub_assignment;
          PATCHes on save instead of POST. */}
      {wo.id && wo.is_subbed && wo.sub_assignment && (
        <SubOutModal
          isOpen={editSubOutOpen}
          onClose={() => setEditSubOutOpen(false)}
          workOrderId={wo.id}
          initialSubcontractorId={wo.sub_assignment.subcontractor_id}
          initialNteCents={wo.sub_assignment.sub_nte_cents}
          initialSpecialInstructions={wo.sub_assignment.sub_special_instructions}
          onSubbed={() => qc.invalidateQueries({ queryKey: ['work-orders'] })}
        />
      )}

      {/* Receive payment / take down payment — scoped to this WO's
          customer AND tagged with the job, so a no-invoice payment is
          recorded as a down payment on the job. */}
      {receivePaymentOpen && wo.service_customer?.id && (
        <ReceivePaymentModal
          customerId={wo.service_customer.id}
          customerName={wo.service_customer.display_name}
          workOrderId={wo.id}
          onClose={() => setReceivePaymentOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['work-order-payments', id] })
            qc.invalidateQueries({ queryKey: ['work-order-invoices', id] })
          }}
        />
      )}
      {invoiceOverlayId && (
        <InvoiceOverlay
          invoiceId={invoiceOverlayId}
          onClose={() => { setInvoiceOverlayId(null); woInvoicesQ.refetch() }}
          onChanged={() => { woInvoicesQ.refetch(); qc.invalidateQueries({ queryKey: ['payments'] }) }}
        />
      )}

      <MessagesDrawer
        open={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        context={{ kind: 'work_order', workOrderId: wo.id, customerId: wo.service_customer?.id ?? null }}
        title={`Messages · ${wo.display_number ?? 'Job'}`}
      />

      {/* Customer-initiated request — accept / decline banner */}
      {wo.request_status === 'pending' && (
        <section className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1">
                Customer-submitted request
              </div>
              <p className="text-sm text-slate-700">
                This job was submitted through the customer portal and is
                awaiting your review. Accept to move it into the queue, or
                decline (the customer is notified).
              </p>
            </div>
          </div>
          {(acceptReq.isError || declineReq.isError) && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mt-3">
              {((acceptReq.error ?? declineReq.error) as ApiError)?.message ?? 'Action failed.'}
            </div>
          )}
          {!showDecline ? (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => acceptReq.mutate()}
                disabled={acceptReq.isPending || declineReq.isPending}
                className="text-sm px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
              >
                {acceptReq.isPending ? 'Accepting…' : 'Accept job'}
              </button>
              <button
                type="button"
                onClick={() => setShowDecline(true)}
                disabled={acceptReq.isPending || declineReq.isPending}
                className="text-sm px-4 py-2 rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={2}
                placeholder="Reason (optional, shown to customer)…"
                className="w-full text-xs rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => declineReq.mutate()}
                  disabled={declineReq.isPending}
                  className="text-sm px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
                >
                  {declineReq.isPending ? 'Declining…' : 'Confirm decline'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDecline(false)
                    setDeclineReason('')
                  }}
                  disabled={declineReq.isPending}
                  className="text-sm px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Needs attention — highlighted roll-up of dealer-billing routing,
          unbilled, subbed, unread messages, and notes for this job. */}
      <NeedsAttentionBanner
        workOrder={wo}
        onOpenNotes={() => setTab('notes')}
        onOpenMessages={() => setMessagesOpen(true)}
      />

      {/* Grouped navigation keeps the full job workspace discoverable without
          flattening every tool into one crowded row. */}
      {easy && <section aria-label="Job workspace guide" className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{activeSection === 'overview' ? 'Plan the job' : activeSection === 'field' ? 'Carry out the work' : activeSection === 'money' ? 'Review job costs' : activeSection === 'messages' ? 'Keep the conversation with the job' : activeSection === 'notes' ? 'Keep job notes together' : 'Review the job history'}</h2>
        <p className="mt-1 text-sm text-slate-600">{activeSection === 'overview'
          ? 'Review the customer, location, schedule, and assignments. Job status and billing actions stay above.'
          : activeSection === 'field'
            ? 'Use the tools below for line items, tasks, equipment, inspections, agreements, photos, and documents.'
            : activeSection === 'money'
              ? 'Review costs, reimbursements, and supporting records here. Use the existing invoice and payment actions above for customer billing.'
              : activeSection === 'messages'
                ? 'Your existing conversations, attachments, and reply controls remain available here.'
                : activeSection === 'notes'
                  ? 'Review internal and customer-facing notes using the existing visibility controls.'
                  : 'Review travel and recorded changes without changing the job.'}</p>
      </section>}
      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <nav className={`flex ${easy ? 'min-w-0 flex-wrap bg-slate-50 py-2' : 'min-w-max'} items-center gap-1 overflow-x-auto border-b border-slate-200 px-2`} aria-label="Job sections">
          <TabButton active={activeSection === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={activeSection === 'field'} onClick={() => setTab(sectionDefaultTab('field'))}>
            {easy ? 'The work' : <>Field <span className="ml-1 text-xs text-slate-400">6</span></>}
          </TabButton>
          <TabButton active={activeSection === 'money'} onClick={() => setTab(sectionDefaultTab('money'))}>
            {easy ? 'Costs & reimbursements' : 'Expense'}
          </TabButton>
          <TabButton active={activeSection === 'messages'} onClick={() => setTab('messages')}>
            Messages
          </TabButton>
          <div className="px-3 pt-3">
            <WorkOrderNotesTabButton
              workOrderId={wo.id}
              active={activeSection === 'notes'}
              onClick={() => setTab('notes')}
              legacyInternal={wo.internal_notes}
              legacyPublic={wo.public_notes}
            />
          </div>
          <TabButton active={activeSection === 'log'} onClick={() => setTab('drives')}>
            {easy ? 'History & travel' : 'Log'}
          </TabButton>
        </nav>
        {activeSection !== 'overview' && activeSection !== 'messages' && activeSection !== 'notes' && (
          <nav className={`flex ${easy ? 'min-w-0 flex-wrap' : 'min-w-max'} gap-1 overflow-x-auto bg-slate-50/80 px-4 py-2`} aria-label={`${activeSection} job tools`}>
            {activeSection === 'field' && (
              <>
                <TabButton active={tab === 'line-items'} onClick={() => setTab('line-items')}>Line items</TabButton>
                <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')}>Tasks</TabButton>
                <TabButton active={tab === 'customer-assets'} onClick={() => setTab('customer-assets')}>Customer assets</TabButton>
                {wo.inspection_checklist_id && <TabButton active={tab === 'inspection'} onClick={() => setTab('inspection')}>Inspection</TabButton>}
                <TabButton active={tab === 'agreements'} onClick={() => setTab('agreements')}>Agreements</TabButton>
                <TabButton active={tab === 'doc'} onClick={() => setTab('doc')}>Work order documents</TabButton>
                <TabButton active={tab === 'photos'} onClick={() => setTab('photos')}>BarnCam</TabButton>
                <TabButton active={tab === 'documents'} onClick={() => setTab('documents')}>Documents</TabButton>
              </>
            )}
            {activeSection === 'money' && (
              <>
                <TabButton active={tab === 'cost'} onClick={() => setTab('cost')}>Cost & profit</TabButton>
                <TabButton active={tab === 'reimbursements'} onClick={() => setTab('reimbursements')}>Reimbursements</TabButton>
                {wo.is_subbed && <TabButton active={tab === 'sub-invoice'} onClick={() => setTab('sub-invoice')}>Invoice</TabButton>}
                {wo.is_subbed && <TabButton active={tab === 'signatures'} onClick={() => setTab('signatures')}>Signed doc</TabButton>}
              </>
            )}
            {activeSection === 'log' && (
              <>
                <TabButton active={tab === 'drives'} onClick={() => setTab('drives')}>Drives</TabButton>
                <TabButton active={tab === 'history'} onClick={() => setTab('history')}>History</TabButton>
                {has('settings.view') && <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>Activity</TabButton>}
              </>
            )}
          </nav>
        )}
      </div>
      {/* Content */}
      {tab === 'overview' && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <WorkOrderQuickEdit
              ref={quickEditRef}
              wo={wo}
              onStateChange={setQuickEditState}
              showInlineSave={false}
            />
          <Card title="Customer & Location">
            <Row label="Service Customer">
              {wo.service_customer ? (
                <Link
                  to={`/customers/${wo.service_customer.id}`}
                  className="text-amber-700 hover:underline font-medium"
                  title="Open customer account"
                >
                  {wo.service_customer.display_name}
                </Link>
              ) : (
                '—'
              )}
              {wo.service_customer?.vip && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                  VIP
                </span>
              )}
            </Row>
            {wo.billing_customer && (
              <Row label="Billing Customer">
                <Link
                  to={`/customers/${wo.billing_customer.id}`}
                  className="text-amber-700 hover:underline font-medium"
                >
                  {wo.billing_customer.display_name}
                </Link>
              </Row>
            )}
            <Row label="Location">
              {wo.service_location ? (
                <>
                  {wo.service_location.nickname && <strong>{wo.service_location.nickname}</strong>}
                  <div className="text-slate-600">
                    {[
                      wo.service_location.street_address,
                      wo.service_location.apt_unit,
                      wo.service_location.city,
                      wo.service_location.state,
                      wo.service_location.postal_code,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </>
              ) : (
                '—'
              )}
            </Row>
            {wo.their_work_order_number && (
              <Row label="Their WO #">{wo.their_work_order_number}</Row>
            )}
            {wo.their_po_number && <Row label="PO #">{wo.their_po_number}</Row>}
          </Card>
          {wo.description && (
            <Card title="Description">
              {/*
                Vehicles named in the description become links to the
                key reference. The text itself is never rewritten --
                this renders around spans the backend reports, so the
                note stays exactly what somebody typed.
              */}
              <p className="text-sm whitespace-pre-wrap">
                <ReferencedText text={wo.description} />
              </p>
            </Card>
          )}

          {wo.inspection_checklist && (
            <Card title="Inspection Scope">
              <Row label="Checklist">
                <strong>{wo.inspection_checklist.name}</strong>
                {wo.inspection_checklist.is_system && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-1.5 py-0.5">
                    Standard
                  </span>
                )}
              </Row>
              <Row label="Items">{wo.inspection_checklist.item_count}</Row>
              {wo.inspection_checklist.category && (
                <Row label="Category">{wo.inspection_checklist.category}</Row>
              )}
              <p className="text-xs text-slate-500 mt-2 italic">
                Tech check-off + pass/fail capture ships with the next inspection
                workflow update.
              </p>
            </Card>
          )}
          </div>
          <aside className="space-y-6">
            <Card title="Assignment">
              {!wo.lead_tech && !wo.crew ? (
                <div className="py-3 text-sm text-slate-500 italic">
                  No tech or crew assigned. Use <strong>Quick edit</strong> above to assign.
                </div>
              ) : (
                <>
                  {wo.lead_tech && (
                    <Row label="Lead tech">
                      <span className="inline-flex items-center gap-2">
                        {wo.lead_tech.avatar_url ? (
                          <img
                            src={wo.lead_tech.avatar_url}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                            {(wo.lead_tech.first_name?.[0] ?? wo.lead_tech.full_name?.[0] ?? '?').toUpperCase()}
                          </span>
                        )}
                        <strong>{wo.lead_tech.full_name}</strong>
                      </span>
                    </Row>
                  )}
                  {wo.crew && (
                    <Row label="Crew">
                      <span className="inline-flex items-center gap-2">
                        {wo.crew.color && (
                          <span
                            className="inline-block w-3 h-3 rounded-full ring-2 ring-white shadow-sm"
                            style={{ background: wo.crew.color }}
                          />
                        )}
                        <strong>{wo.crew.name}</strong>
                        <span className="text-xs text-slate-500">
                          (multiple techs)
                        </span>
                      </span>
                    </Row>
                  )}
                </>
              )}
            </Card>

            <Card title="Schedule">
              <Row label="Status">
                {wo.schedule.is_scheduled ? 'Scheduled' : 'Unscheduled'}
              </Row>
              {wo.schedule.date && <Row label="Date">{wo.schedule.date}</Row>}
              {wo.schedule.start_time && (
                <Row label="Start">
                  {formatTime12(wo.schedule.start_time.slice(0, 5))}
                  {wo.schedule.tz_abbrev ? ` ${wo.schedule.tz_abbrev}` : ''}
                </Row>
              )}
              {wo.schedule.end_time && (
                <Row label="End">{formatTime12(wo.schedule.end_time.slice(0, 5))}</Row>
              )}
              {wo.schedule.estimated_duration_minutes != null && (
                <Row label="Duration">{wo.schedule.estimated_duration_minutes} min</Row>
              )}
            </Card>

            <Card title="Totals">
              <Row label="Subtotal">{wo.money.subtotal_formatted}</Row>
              <Row label="Tax">{wo.money.tax_formatted}</Row>
              {/* Shown as its own line rather than by quietly zeroing the tax
                  above, so the office can see the exemption was applied and
                  how much it was worth. Matches how invoices present it. */}
              {(wo.money.tax_exempt_adjustment_cents ?? 0) > 0 && (
                <Row label="Tax exempt">
                  <span className="text-emerald-700">
                    &minus;{wo.money.tax_exempt_adjustment_formatted}
                  </span>
                </Row>
              )}
              <Row label="Total">
                <strong>{wo.money.total_formatted}</strong>
              </Row>
            </Card>
            <WorkOrderStatusHistory
              workOrderId={wo.id}
              siteLat={wo.service_location?.latitude ?? null}
              siteLng={wo.service_location?.longitude ?? null}
            />
          </aside>
        </div>
      )}

      {tab === 'notes' && (
        <WorkOrderNotesPanel
          workOrderId={wo.id}
          legacyInternal={wo.internal_notes}
          legacyPublic={wo.public_notes}
        />
      )}

      {tab === 'customer-assets' && <WorkOrderCustomerAssetsPanel wo={wo} />}

      {tab === 'line-items' && (
        <Card title="Line Items">
          {/* Parts held for this job and the orders for it, when it came from an estimate. */}
          <PartsOrders workOrderId={wo.id} />
          <WorkOrderLineItemEditorLive
            workOrderId={wo.id}
            availableAssets={(wo.covered_assets ?? []).map((asset) => ({
              id: asset.id,
              name: asset.name ?? asset.asset_code ?? asset.id,
              asset_code: asset.asset_code ?? null,
            }))}
          />
        </Card>
      )}

      {tab === 'doc' && (
        <div className="space-y-6">
          {/* AI Vision field detection status — only shows when a template
              PDF is on file. Foundation is wired; in-place writes use the
              map at completion (Phase 2). */}
          <WorkOrderAiFieldMapStatus
            workOrderId={wo.id}
            hasTemplatePdf={!!wo.template_pdf_url}
            map={wo.ai_field_map}
            detectedAt={wo.ai_field_map_at}
          />
          {/* Live PDF viewer — template (live doc being filled) and the
              signed copy once the WO completes. Each shows inline via
              iframe; tap 'Open in new tab' for full-screen / download. */}
          <WorkOrderPdfPreview
            title="Customer's WO / PO (live)"
            url={wo.template_pdf_url}
            filename={wo.template_original_filename ?? 'template.pdf'}
            uploadedAt={wo.template_uploaded_at}
            emptyHint="No PDF on this job yet. Upload from the section below."
          />
          <WorkOrderPdfPreview
            title="Signed completion PDF"
            url={wo.filled_wo_pdf_url}
            filename={`WO-${wo.work_order_number}-signed.pdf`}
            uploadedAt={wo.completed_at}
            emptyHint="Generated automatically when the tech checks out as completed."
          />
          {/* Existing field workflow panel — visits, signatures, NTE,
              + the upload widget that puts a PDF on template_pdf_path */}
          <WorkOrderFieldLogPanel wo={wo} />
        </div>
      )}


      {tab === 'inspection' && (
        <WorkOrderInspectionPanel
          workOrderId={wo.id}
          hasChecklist={!!wo.inspection_checklist_id}
        />
      )}

      {tab === 'tasks' && (
        <TasksPanel
          anchorType="work_order"
          anchorId={wo.id}
          anchorLabel={wo.work_order_number != null ? String(wo.work_order_number) : undefined}
          canEdit={has('jobs.edit')}
        />
      )}

      {tab === 'agreements' && <WorkOrderAgreementsPanel workOrderId={wo.id} />}

      {tab === 'photos' && <WorkOrderPhotosPanel workOrderId={wo.id} />}

      {tab === 'documents' && (
        <AttachmentsPanel
          basePath={`/v1/work-orders/${wo.id}`}
          cacheKey={['wo-attachments', wo.id]}
          mode="documents"
        />
      )}

      {tab === 'cost' && <WorkOrderCostPanel wo={wo} paidRevenueCents={downPaymentCents} />}

      {tab === 'reimbursements' && <WorkOrderReimbursementsPanel wo={wo} />}

      {tab === 'sub-invoice' && wo.is_subbed && <WorkOrderSubInvoicePanel workOrderId={wo.id} />}

      {tab === 'signatures' && wo.is_subbed && <WorkOrderSignaturesPanel workOrderId={wo.id} />}

      {tab === 'messages' && (
        <WorkOrderMessagesTab workOrderId={wo.id} customerId={wo.service_customer_id} />
      )}
      {/* GPS drive history — the drive TO this job per visit (from /
          departed / arrived / duration / ≈miles), from the nightly rollup. */}
      {tab === 'drives' && <WorkOrderDrivesPanel workOrderId={wo.id} />}

      {tab === 'history' && <WorkOrderHistoryPanel wo={wo} />}

      {tab === 'activity' && has('settings.view') && (
        <EntityActivityPanel entityId={wo.id} noun="job" />
      )}

      {tab === 'overview' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-3 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <span
                className={
                  'h-2.5 w-2.5 rounded-full ' +
                  (quickEditState.saving || quickEditState.dirty ? 'bg-amber-500' : 'bg-emerald-500')
                }
              />
              {quickEditState.saving
                ? 'Saving...'
                : quickEditState.dirty
                  ? 'Unsaved changes'
                  : 'All changes saved'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => quickEditRef.current?.discard()}
                disabled={quickEditState.saving || !quickEditState.dirty}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => quickEditRef.current?.save()}
                disabled={!quickEditState.dirty || quickEditState.saving}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quickEditState.saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type JobPayrollProfile = {
  account_id: string
  pay_type: 'hourly' | 'salary' | 'commission' | 'hybrid'
  commission_percent: number
  commission_basis: 'paid_revenue' | 'gross_revenue' | 'gross_margin' | null
  parts_commission_percent: number
  parts_commission_max_parts_cents: number
  active: boolean
}

function WorkOrderCostPanel({
  wo,
  paidRevenueCents,
}: {
  wo: WorkOrder
  paidRevenueCents: number
}) {
  const lineItemsQ = useLineItems(wo.id)
  const expensesQ = useQuery({
    queryKey: ['work-order-reimbursements', wo.id],
    queryFn: () =>
      apiRequest<{ data: JobExpense[] }>(
        `/v1/expenses?work_order_id=${encodeURIComponent(wo.id)}&per_page=100`,
      ),
  })
  const payrollQ = useQuery({
    queryKey: ['payroll-profiles'],
    queryFn: () => apiRequest<{ data: JobPayrollProfile[] }>('/v1/payroll-profiles'),
    enabled: !!wo.lead_tech_account_id,
  })

  const lineItems = lineItemsQ.data ?? []
  const partLines = lineItems.filter(
    (line) =>
      line.line_type === 'item' &&
      line.money.owner_cost_cents > 0 &&
      (line.item_type === 'product' || line.item_type == null),
  )
  const partsCostCents = partLines.reduce(
    (sum, line) => sum + Math.round(Number(line.quantity) * line.money.owner_cost_cents),
    0,
  )
  const receiptExpenses = (expensesQ.data?.data ?? []).filter(
    (expense) => expense.status !== 'void',
  )
  const receiptCostCents = receiptExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount_cents || 0) + Number(expense.tax_cents || 0),
    0,
  )
  const profile = (payrollQ.data?.data ?? []).find(
    (candidate) => candidate.account_id === wo.lead_tech_account_id,
  )
  // Revenue is the total minus the tax the customer was ACTUALLY charged, which
  // is not tax_cents when the bill-to is exempt — total_cents already has that
  // tax removed, so subtracting it again would understate revenue and, through
  // commission_basis below, quietly underpay the tech.
  const taxChargedCents = Math.max(
    0,
    wo.money.tax_cents - (wo.money.tax_exempt_adjustment_cents ?? 0),
  )
  const revenueCents = Math.max(0, wo.money.total_cents - taxChargedCents)
  const grossMarginBeforeTechCents = revenueCents - partsCostCents - receiptCostCents
  const commissionBasisCents =
    profile?.commission_basis === 'gross_revenue'
      ? revenueCents
      : profile?.commission_basis === 'gross_margin'
        ? Math.max(0, grossMarginBeforeTechCents)
        : Math.max(0, paidRevenueCents)
  const commissionCents =
    profile?.active && (profile.pay_type === 'commission' || profile.pay_type === 'hybrid')
      ? Math.round(commissionBasisCents * (Math.max(0, Number(profile.commission_percent)) / 100))
      : 0
  const partsCommissionEligible =
    !!profile?.active &&
    partsCostCents > 0 &&
    Number(profile.parts_commission_percent) > 0 &&
    (Number(profile.parts_commission_max_parts_cents) <= 0 ||
      partsCostCents <= Number(profile.parts_commission_max_parts_cents))
  const partsCommissionCents = partsCommissionEligible
    ? Math.round(partsCostCents * (Math.max(0, Number(profile?.parts_commission_percent)) / 100))
    : 0
  const techPercentageCostCents = commissionCents + partsCommissionCents
  const totalCostCents = partsCostCents + receiptCostCents + techPercentageCostCents
  const profitCents = revenueCents - totalCostCents
  const profitPercent = revenueCents > 0 ? (profitCents / revenueCents) * 100 : 0
  const isLoading = lineItemsQ.isLoading || expensesQ.isLoading || payrollQ.isLoading

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Job cost & profit</h2>
            <p className="mt-1 text-sm text-slate-500">
              Uses part costs, imported receipts, and the lead tech&apos;s configured percentage.
            </p>
          </div>
          {isLoading && <span className="text-sm text-slate-500">Updating totals...</span>}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CostMetric label="Revenue before tax" value={money(revenueCents)} />
          <CostMetric label="Total cost" value={money(totalCostCents)} tone="cost" />
          <CostMetric label="Profit" value={money(profitCents)} tone={profitCents >= 0 ? 'profit' : 'loss'} />
          <CostMetric label="Profit margin" value={`${profitPercent.toFixed(1)}%`} tone={profitCents >= 0 ? 'profit' : 'loss'} />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold text-slate-900">Cost breakdown</h3>
        </div>
        <div className="divide-y divide-slate-100">
          <CostRow
            label="Parts & materials"
            detail={`${partLines.length} costed line item${partLines.length === 1 ? '' : 's'}`}
            value={partsCostCents}
          />
          <CostRow
            label="Imported receipts"
            detail={`${receiptExpenses.length} receipt expense${receiptExpenses.length === 1 ? '' : 's'}`}
            value={receiptCostCents}
          />
          <CostRow
            label="Lead tech percentage"
            detail={
              profile
                ? `${Number(profile.commission_percent).toFixed(2)}% ${(profile.commission_basis ?? 'paid_revenue').replaceAll('_', ' ')}${Number(profile.parts_commission_percent) > 0 ? ` + ${Number(profile.parts_commission_percent).toFixed(2)}% parts` : ''}`
                : wo.lead_tech_account_id
                  ? 'No active payroll percentage configured'
                  : 'No lead tech assigned'
            }
            value={techPercentageCostCents}
          />
          <CostRow
            label="Sales tax"
            // The row says "collected from the customer", so it has to show what
            // was collected. An exempt bill-to was charged none of it.
            detail={
              (wo.money.tax_exempt_adjustment_cents ?? 0) > 0
                ? 'None collected — this customer is tax exempt'
                : 'Collected from the customer; excluded from revenue, cost, and profit'
            }
            value={taxChargedCents}
          />
          <div className="flex items-center justify-between gap-4 bg-slate-50 px-5 py-4">
            <div className="font-semibold text-slate-900">Total job cost</div>
            <div className="text-lg font-bold text-slate-900">{money(totalCostCents)}</div>
          </div>
        </div>
      </section>

      {profile?.commission_basis === 'paid_revenue' && paidRevenueCents < revenueCents && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This tech uses paid-revenue commission. The percentage cost currently uses {money(paidRevenueCents)} received and will rise as payments are collected.
        </p>
      )}
    </div>
  )
}

function CostMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'cost' | 'profit' | 'loss'
}) {
  const toneClass =
    tone === 'profit'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'loss'
        ? 'border-red-200 bg-red-50 text-red-900'
        : tone === 'cost'
          ? 'border-amber-200 bg-amber-50 text-amber-950'
          : 'border-slate-200 bg-slate-50 text-slate-900'

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  )
}

function CostRow({ label, detail, value }: { label: string; detail: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <div className="font-medium text-slate-900">{label}</div>
        <div className="mt-0.5 text-sm text-slate-500">{detail}</div>
      </div>
      <div className="font-semibold text-slate-900">{money(value)}</div>
    </div>
  )
}
function WorkOrderReimbursementsPanel({ wo }: { wo: WorkOrder }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const tenantTimezone = useTenantTimezone()
  const [expenseDate, setExpenseDate] = useState(() => tenantDate(tenantTimezone))

  useEffect(() => {
    setExpenseDate(tenantDate(tenantTimezone))
  }, [tenantTimezone])
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORY_OPTIONS)[number][0]>('parts_materials')
  const [amount, setAmount] = useState('')
  const [tax, setTax] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [employeeAccountId, setEmployeeAccountId] = useState(wo.lead_tech_account_id ?? '')
  const [billableToJob, setBillableToJob] = useState(true)
  const [notes, setNotes] = useState('')

  const staffQ = useQuery({
    queryKey: ['work-order-reimbursement-staff'],
    queryFn: () => apiRequest<{ data: StaffOption[] }>('/v1/staff?per_page=200'),
  })

  const expensesQ = useQuery({
    queryKey: ['work-order-reimbursements', wo.id],
    queryFn: () =>
      apiRequest<{ data: JobExpense[] }>(
        `/v1/expenses?work_order_id=${encodeURIComponent(wo.id)}&per_page=100`,
      ),
  })

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose the receipt or invoice file first.')

      const fd = new FormData()
      const isDocument =
        file.type === 'application/pdf' ||
        file.type === 'application/msword' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      fd.append(isDocument ? 'document' : 'photos[]', file)
      fd.append('expense_date', expenseDate)
      fd.append('category', category)
      fd.append('description', description.trim() || file.name)
      if (amount.trim()) fd.append('amount', amount.trim())
      if (tax.trim()) fd.append('tax', tax.trim())
      if (paymentMethod.trim()) fd.append('payment_method', paymentMethod.trim())
      if (referenceNumber.trim()) fd.append('reference_number', referenceNumber.trim())
      if (employeeAccountId) fd.append('employee_account_id', employeeAccountId)
      fd.append('billable_to_job', billableToJob ? '1' : '0')
      if (notes.trim()) fd.append('notes', notes.trim())

      const token = getStoredToken()
      const tenant = getActingTenant()
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      if (tenant) headers['X-Act-As-Tenant'] = tenant

      const res = await fetch(`${API_URL}/v1/work-orders/${wo.id}/reimbursement-receipts`, {
        method: 'POST',
        headers,
        body: fd,
      })
      const text = await res.text()
      let payload: any = null
      try {
        payload = text ? JSON.parse(text) : null
      } catch {
        // ignore non-json upload errors
      }
      if (!res.ok) {
        const error = new Error(payload?.message ?? `Upload failed (${res.status})`) as ApiError
        error.status = res.status
        throw error
      }
      return payload
    },
    onSuccess: () => {
      setFile(null)
      setDescription('')
      setAmount('')
      setTax('')
      setPaymentMethod('')
      setReferenceNumber('')
      setEmployeeAccountId(wo.lead_tech_account_id ?? '')
      setBillableToJob(true)
      setNotes('')
      qc.invalidateQueries({ queryKey: ['work-order-reimbursements', wo.id] })
      qc.invalidateQueries({ queryKey: ['wo-attachments', wo.id] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['accounting'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })

  const updateExpense = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<Pick<JobExpense, 'status' | 'reimbursement_status'>>
    }) =>
      apiRequest<{ data: JobExpense }>(`/v1/expenses/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order-reimbursements', wo.id] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['accounting'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
  const reverseReimbursement = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<{ data: JobExpense; journal_entry_id?: string | null }>(
        `/v1/expenses/${encodeURIComponent(id)}/reimbursement-reversal`,
        {
          method: 'POST',
          body: { reason },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order-reimbursements', wo.id] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['accounting'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })

  const expenses = expensesQ.data?.data ?? []
  const reimbursable = expenses.filter((expense) => expense.reimbursable)
  const pendingTotal = reimbursable
    .filter((expense) => ['pending', 'approved'].includes(expense.reimbursement_status))
    .reduce((sum, expense) => sum + expense.amount_cents + expense.tax_cents, 0)
  function reversePaidReimbursement(expense: JobExpense) {
    const reason = window.prompt('Reason for reversing this reimbursement')
    if (!reason || reason.trim().length < 3) return

    reverseReimbursement.mutate({ id: expense.id, reason: reason.trim() })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-navy-900">Tech receipt upload</h2>
            <p className="text-sm text-slate-500">
              Upload a store invoice or receipt. It becomes a job document and a reimbursable tech expense.
            </p>
          </div>
          <div className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
            {money(pendingTotal)} pending
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Date
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="42.18"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tax
            <input
              type="number"
              min="0"
              step="0.01"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {EXPENSE_CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Store / description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Home Depot - lockset parts"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Payment method
            <input
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="Personal card / cash"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tech / staff
            <select
              value={employeeAccountId}
              onChange={(e) => setEmployeeAccountId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              disabled={staffQ.isLoading}
            >
              <option value="">Auto: assigned tech or uploader</option>
              {(staffQ.data?.data ?? []).map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name || staff.email}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Receipt / invoice file
            <input
              type="file"
              accept="image/*,application/pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Receipt #
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="mt-7 flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={billableToJob}
              onChange={(e) => setBillableToJob(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Billable job cost
          </label>
        </div>

        <label className="mt-3 block text-sm font-medium text-slate-700">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Why this was purchased, approval details, or what line item it supports."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        {upload.isError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {upload.error instanceof Error ? upload.error.message : 'Upload failed.'}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => upload.mutate()}
            disabled={upload.isPending || !file}
            className="rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {upload.isPending ? 'Saving...' : 'Save reimbursement receipt'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-navy-900">Job reimbursement history</h2>
          <p className="text-sm text-slate-500">Grouped in Accounting by the tech shown below.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Expense</th>
                <th className="px-4 py-3 text-left">Tech</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {reimbursable.map((expense) => {
                const isPending = expense.reimbursement_status === 'pending'
                const isApproved = expense.reimbursement_status === 'approved'
                const isReimbursed = expense.reimbursement_status === 'reimbursed'

                return (
                  <tr key={expense.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{expense.description}</div>
                      <div className="text-xs text-slate-500">
                        {expense.expense_date ?? 'No date'} · {expense.category.replace(/_/g, ' ')}
                        {expense.reference_number ? ` · #${expense.reference_number}` : ''}
                      </div>
                      {expense.receipt_attachment_ids?.length ? (
                        <ReceiptLinks
                          attachments={expense.receipt_attachments}
                          fallbackIds={expense.receipt_attachment_ids}
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {expense.employee?.name || expense.employee?.email || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold capitalize text-amber-800">
                        {expense.reimbursement_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {money(expense.amount_cents + expense.tax_cents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              disabled={updateExpense.isPending}
                              onClick={() =>
                                updateExpense.mutate({
                                  id: expense.id,
                                  payload: { reimbursement_status: 'approved', status: 'approved' },
                                })
                              }
                              className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={updateExpense.isPending}
                              onClick={() =>
                                updateExpense.mutate({
                                  id: expense.id,
                                  payload: { reimbursement_status: 'rejected', status: 'recorded' },
                                })
                              }
                              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {isApproved ? (
                          <button
                            type="button"
                            disabled={updateExpense.isPending}
                            onClick={() =>
                              updateExpense.mutate({
                                id: expense.id,
                                payload: { reimbursement_status: 'reimbursed', status: 'paid' },
                              })
                            }
                            className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
                          >
                            Mark paid
                          </button>
                        ) : null}
                        {isReimbursed ? (
                          <button
                            type="button"
                            disabled={reverseReimbursement.isPending}
                            onClick={() => reversePaidReimbursement(expense)}
                            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                          >
                            Reverse
                          </button>
                        ) : null}
                        {!isPending && !isApproved && !isReimbursed ? (
                          <span className="text-xs font-semibold text-slate-400">No action</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {expensesQ.isLoading && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>Loading reimbursements...</td>
                </tr>
              )}
              {!expensesQ.isLoading && reimbursable.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No tech reimbursement receipts on this job yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function ReceiptLinks({
  attachments,
  fallbackIds,
}: {
  attachments?: ReceiptAttachment[]
  fallbackIds?: string[]
}) {
  if (attachments?.length) {
    return (
      <div className="mt-1 space-y-1">
        {attachments.map((attachment) =>
          attachment.url ? (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="block max-w-[260px] truncate text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline"
            >
              View {attachment.original_filename || 'receipt'}
            </a>
          ) : (
            <div key={attachment.id} className="max-w-[260px] truncate text-xs font-semibold text-slate-500">
              {attachment.original_filename || attachment.id}
            </div>
          ),
        )}
      </div>
    )
  }

  if (fallbackIds?.length) {
    return (
      <div className="mt-1 max-w-[260px] truncate text-xs font-semibold text-slate-500">
        Receipt file {fallbackIds[0]}
      </div>
    )
  }

  return null
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // shrink-0 + whitespace-nowrap keep a two-word label on one line inside
      // the scrolling row; without them flex compresses the tab and the text
      // breaks mid-label.
      className={`shrink-0 whitespace-nowrap px-3 py-3 -mb-px text-sm font-medium border-b-2 ${
        active
          ? 'border-amber-600 text-amber-700'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

// Canonical card pattern — bg-white + slate-200 border + rounded-xl + shadow-sm + p-6
// Keep this in sync across pages so the visual language is consistent.
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow transition-shadow p-6">
      <h2 className="text-base font-semibold text-navy-900 pb-3 mb-2 border-b border-slate-100">
        {title}
      </h2>
      <div className="divide-y divide-slate-100 text-sm">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-3 first:pt-2">
      <div className="text-slate-500 text-xs sm:text-sm sm:text-slate-600 uppercase tracking-wide sm:normal-case sm:tracking-normal font-medium sm:font-normal">
        {label}
      </div>
      <div className="sm:col-span-2 text-slate-900">{children}</div>
    </div>
  )
}

/**
 * Dormant force-notes gate (#3). A blocking overlay shown when the job is
 * dormant and the tenant rule is on. The tech can't proceed until they log
 * a note — but it's not a dead-end: they add it right here and continue.
 */
function DormantNoteGate({
  workOrderId,
  onAdded,
}: {
  workOrderId: string
  onAdded: () => void
}) {
  const [body, setBody] = useState('')
  const add = useMutation({
    mutationFn: (text: string) =>
      apiRequest(`/v1/work-orders/${workOrderId}/notes`, {
        method: 'POST',
        body: { body: text },
      }),
    onSuccess: onAdded,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-500 text-xl">⚠</span>
          <h2 className="text-lg font-semibold text-navy-900">This job is dormant</h2>
        </div>
        <p className="text-sm text-slate-600">
          It hasn&rsquo;t been updated in a while. Add a quick note on what&rsquo;s the
          hold-up before continuing.
        </p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          autoFocus
          placeholder="e.g. Waiting on parts · customer rescheduled · need approval…"
          className="mt-3 w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
        {add.isError && (
          <div className="mt-2 text-xs text-red-700">{(add.error as Error).message}</div>
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={!body.trim() || add.isPending}
            onClick={() => add.mutate(body.trim())}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
          >
            {add.isPending ? 'Saving…' : 'Add note & continue'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Dispatch can override this from the dashboard (override coming soon).
        </p>
      </div>
    </div>
  )
}

/**
 * COD force-collection gate (#4). Blocks a COD job with an unpaid balance
 * until the tech collects payment — or a manager hits the dispatch override.
 */
function CodCollectionGate({
  workOrderId,
  customerId,
  customerName,
  onResolved,
}: {
  workOrderId: string
  customerId: string | null
  customerName: string
  onResolved: () => void
}) {
  const { has } = usePermissions()
  const [payOpen, setPayOpen] = useState(false)
  const override = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${workOrderId}/collection-override`, {
        method: 'PATCH',
        body: { override: true },
      }),
    onSuccess: onResolved,
  })

  if (payOpen && customerId) {
    return (
      <ReceivePaymentModal
        customerId={customerId}
        customerName={customerName}
        workOrderId={workOrderId}
        onClose={() => {
          setPayOpen(false)
          onResolved()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-emerald-600 text-xl font-bold">$</span>
          <h2 className="text-lg font-semibold text-navy-900">Collect payment</h2>
        </div>
        <p className="text-sm text-slate-600">
          This is a COD job with an unpaid balance. Collect payment before
          continuing.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={!customerId}
            onClick={() => setPayOpen(true)}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
          >
            Collect payment now
          </button>
          {has('jobs.edit') && (
            <button
              type="button"
              onClick={() => override.mutate()}
              disabled={override.isPending}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              {override.isPending ? 'Unlocking…' : 'Dispatch override — unlock without collecting'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
