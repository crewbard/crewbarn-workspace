import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useEstimate,
  useDeleteEstimate,
  useMarkEstimateSent,
  useApproveEstimate,
  useRejectEstimate,
  useSupersedeEstimate,
} from '@/hooks/useEstimates'
import { EstimateLineItemEditorLive } from '@/components/EstimateLineItemEditorLive'
import { ConvertEstimateToJobModal } from '@/components/ConvertEstimateToJobModal'
import { AgreementBuilderModal } from '@/components/estimates/AgreementBuilderModal'
import { EstimateEditForm } from '@/components/estimates/EstimateEditForm'
import { BarnCamPanel } from '@/components/BarnCamPanel'
import { AttachmentsPanel } from '@/components/attachments/AttachmentsPanel'
import { EstimateHistoryPanel } from '@/components/estimates/EstimateHistoryPanel'
import { EntityActivityPanel } from '@/components/EntityActivityPanel'
import { MessagesDrawer } from '@/components/comms/MessagesDrawer'
import { useRecordShortcuts } from '@/hooks/useShortcuts'
import { EmailComposerModal } from '@/components/comms/EmailComposerModal'
import { SmsComposerModal } from '@/components/comms/SmsComposerModal'
import { CustomerLocationStrip } from '@/components/CustomerLocationStrip'
import { usePermissions } from '@/hooks/usePermissions'
import { useCustomer } from '@/hooks/useCustomers'
import { EstimateDetailOverview, EstimateProgress } from '@/components/estimates/EstimateDetailOverview'
import { PartsOrders } from '@/components/estimates/PartsOrders'
import { useTheme } from '@/hooks/useTheme'
import { JobTasksCard } from '@/components/jobTasks/JobTasksCard'

// Same portal base the rest of the app uses (see PublicScanPage).
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'https://portal.crewbarn.com'

type Tab = 'overview' | 'options' | 'line-items' | 'job-tasks' | 'edit' | 'crew-cam' | 'documents' | 'history' | 'activity'

const STATUS_PALETTE: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-800' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800' },
  superseded: { bg: 'bg-amber-100', text: 'text-amber-800' },
  expired: { bg: 'bg-amber-100', text: 'text-amber-800' },
}

export function EstimateDetailPage({ recordId }: { recordId?: string } = {}) {
  const { theme } = useTheme()
  const focus = theme === 'focus'
  const { id: routeId } = useParams<{ id: string }>()
  const id = recordId ?? routeId
  const navigate = useNavigate()
  const estimateQuery = useEstimate(id)
  const deleteEstimate = useDeleteEstimate()
  const markEstimateSent = useMarkEstimateSent()
  const approveEstimate = useApproveEstimate()
  const rejectEstimate = useRejectEstimate()
  const supersedeEstimate = useSupersedeEstimate()
  const { has } = usePermissions()
  // Writes on an estimate (send, approve, re-quote, convert, delete, edit)
  // need jobs.edit — the same key the create route uses.
  const canEdit = has('jobs.edit')
  // Estimates have no thread of their own — they ride the customer's. Fetch the
  // full customer (the estimate carries only a thin one) for the Messages drawer.
  const customerQuery = useCustomer(estimateQuery.data?.customer?.id)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [emailEstimateOpen, setEmailEstimateOpen] = useState(false)
  const [smsEstimateOpen, setSmsEstimateOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [agreementOpen, setAgreementOpen] = useState(false)
  // Good / better / best: which option the customer took, asked on approve.
  const [pickTierOpen, setPickTierOpen] = useState(false)

  // Deep-link from the Estimates list next-step chip (?action=convert) →
  // auto-open the convert modal (it still confirms before creating the job).
  // Clear the param so a refresh/back doesn't re-trigger it.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (recordId) return
    if (searchParams.get('action') !== 'convert') return
    const timeout = window.setTimeout(() => {
      if (canEdit) setShowConvertModal(true)
      const next = new URLSearchParams(searchParams)
      next.delete('action')
      setSearchParams(next, { replace: true })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [recordId, searchParams, setSearchParams, canEdit])

  // Keyboard shortcuts on this estimate (not when it's shown inside another page):
  // E opens Edit details, M the customer's messages.
  useRecordShortcuts({
    edit: canEdit && estimateQuery.data ? () => setTab('edit') : undefined,
    messages: estimateQuery.data?.customer && customerQuery.data ? () => setMessagesOpen(true) : undefined,
  }, !recordId)

  if (estimateQuery.isLoading) {
    return <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 text-slate-500">Loading...</div>
  }

  if (estimateQuery.error || !estimateQuery.data) {
    return (
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="text-red-600 mb-2">Estimate not found.</div>
        <Link to="/estimates" className="text-sm text-amber-700 hover:underline">
          &larr; Back to Estimates
        </Link>
      </div>
    )
  }

  const est = estimateQuery.data
  const palette = STATUS_PALETTE[est.status] ?? STATUS_PALETTE.draft
  const activeContacts = (customerQuery.data?.contacts ?? []).filter((contact) => contact.active)
  const contactRank = (contact: (typeof activeContacts)[number]) =>
    (contact.is_billing_contact ? 2 : 0) + (contact.is_main_contact ? 1 : 0)
  const emailContact = [...activeContacts]
    .filter((contact) => Boolean(contact.email))
    .sort((a, b) => contactRank(b) - contactRank(a))[0]
  const phoneContact = [...activeContacts]
    .filter((contact) => Boolean(contact.phone))
    .sort((a, b) => contactRank(b) - contactRank(a))[0]
  const estimatePortalUrl =
    `${PORTAL_URL}/providers/${est.tenant_id}/estimates/${est.id}`
  const tiers = est.options ?? []
  const chosenTier = tiers.find((o) => o.id === est.chosen_option_id) ?? null
  const lowestTier = tiers.length > 0 ? Math.min(...tiers.map((o) => o.money.total_cents)) : null
  const estimateMessage = tiers.length > 0 && !chosenTier && lowestTier !== null
    ? `Your estimate ${est.estimate_number} is ready to review: ${tiers.length} options from $${(lowestTier / 100).toFixed(2)}.`
    : `Your estimate ${est.estimate_number} for ${est.money.total_formatted} is ready to review.`
  const canDeliverEstimate =
    canEdit && !['superseded', 'expired'].includes(est.status) && (est.status !== 'draft' || est.can_send)

  async function handleDeliverySent() {
    if (!id || est.status !== 'draft') return
    try {
      await markEstimateSent.mutateAsync(id)
    } catch (err) {
      const errObj = err as { details?: { reason?: string } }
      alert(
        `The message was sent, but the estimate could not be marked Sent: ${
          errObj?.details?.reason ?? String(err)
        }`
      )
    }
  }


  async function handleApprove(optionId?: string) {
    if (!id) return
    if (tiers.length > 0 && !optionId) {
      setPickTierOpen(true)
      return
    }
    if (!optionId && !confirm('Mark this estimate as approved?')) return
    try {
      await approveEstimate.mutateAsync({ id, optionId })
      setPickTierOpen(false)
    } catch (err) {
      const errObj = err as { details?: { reason?: string }; message?: string }
      alert(`Could not approve: ${errObj?.details?.reason ?? errObj?.message ?? String(err)}`)
    }
  }

  async function handleReject() {
    if (!id) return
    if (!confirm('Mark this estimate as rejected?')) return
    try {
      await rejectEstimate.mutateAsync(id)
    } catch (err) {
      const errObj = err as { details?: { reason?: string } }
      alert(`Could not reject: ${errObj?.details?.reason ?? String(err)}`)
    }
  }

  async function handleDelete() {
    if (!id) return
    // Confirmation handled by the global delete modal (password + reason).
    try {
      await deleteEstimate.mutateAsync(id)
      navigate('/estimates')
    } catch {
      // Cancelled or failed.
    }
  }

  async function handleRequote() {
    if (!id) return
    if (!confirm(
      `Create a re-quote? All line items will be cloned into a new draft. ` +
      `This estimate (${est.estimate_number}) will be marked as superseded.`
    )) return
    try {
      const newEstimate = await supersedeEstimate.mutateAsync({ id })
      navigate(`/estimates/${newEstimate.id}`)
    } catch (err) {
      const errObj = err as { details?: { reason?: string } }
      alert(`Could not re-quote: ${errObj?.details?.reason ?? String(err)}`)
    }
  }

  const isMutating =
    markEstimateSent.isPending ||
    approveEstimate.isPending ||
    rejectEstimate.isPending ||
    deleteEstimate.isPending ||
    supersedeEstimate.isPending

  return (
    <div data-focus-record="estimate" className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="mb-3 text-sm">
        <Link to="/estimates" className="font-medium text-amber-700 hover:underline">← Back to Estimates</Link>
      </div>
      {/* Not overflow-hidden: that clipped the More actions menu to a sliver
          under its button. The header rounds its own top corners instead
          (15px inside the card's 1px border). */}
      <section className="relative z-10 mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Estimate record">
        <div data-tour="estimate-header" data-status={est.status} data-scope={est.approval_scope === 'partial' ? 'partial' : 'all'} data-tiers={tiers.length > 0 ? 'yes' : 'no'} data-job={est.converted_to_work_order_id ? 'yes' : 'no'} className={`grid gap-5 rounded-t-[15px] p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] ${focus ? 'bg-white text-slate-900' : 'text-white'}`} style={focus ? undefined : { backgroundColor: 'var(--chrome-bg)' }}>
          <div className="min-w-0">
            <div className={`text-xs font-bold uppercase tracking-widest ${focus ? 'text-slate-500' : 'text-amber-200'}`}>Estimate {est.estimate_number}</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{est.title || est.customer?.display_name || 'Estimate'}</h1>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${palette.bg} ${palette.text}`}>{est.status}</span>
              {est.customer?.vip && <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">VIP customer</span>}
            </div>
            <p className={`mt-2 text-sm ${focus ? 'text-slate-600' : 'text-white/75'}`}>{[est.customer?.display_name, est.service_location?.nickname].filter(Boolean).join(' · ') || 'Customer and location not set'}</p>
            {chosenTier && <p className={`mt-1 text-xs ${focus ? 'text-slate-500' : 'text-white/70'}`}>{est.chosen_option_id ? 'Chosen option' : 'Previewing option'}: {chosenTier.name}</p>}
          </div>
          <div className={`border-t pt-4 lg:min-w-52 lg:border-l lg:border-t-0 lg:py-2 lg:pl-6 lg:text-right ${focus ? 'border-slate-200' : 'border-white/20'}`}>
            <div className={`text-[11px] font-bold uppercase tracking-widest ${focus ? 'text-slate-500' : 'text-white/65'}`}>{tiers.length && !chosenTier ? 'Options from' : est.status === 'approved' && est.approval_scope !== 'partial' ? 'Approved estimate' : 'Estimate total'}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{tiers.length && !chosenTier && lowestTier !== null ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(lowestTier / 100) : est.money.total_formatted}</div>
            <p className={`mt-1 text-xs ${focus ? 'text-slate-500' : 'text-white/70'}`}>{est.converted_to_work_order ? 'Linked to a job' : est.status === 'approved' ? 'Ready for the next step' : est.status === 'sent' ? 'Waiting for customer decision' : 'Quote in progress'}</p>
          </div>
        </div>
        <div data-tour="estimate-actions" className="flex flex-wrap items-center gap-2 p-3 sm:px-5">
          {canEdit && est.status === 'approved' && !est.converted_to_work_order_id && <button type="button" data-tour="estimate-convert" onClick={() => setShowConvertModal(true)} disabled={isMutating} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Convert to job →</button>}
          {est.converted_to_work_order && <Link to={`/jobs/${est.converted_to_work_order.id}`} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700">Open linked job →</Link>}
          {est.customer && canDeliverEstimate && <>
            <button type="button" data-tour="estimate-email" onClick={() => setEmailEstimateOpen(true)} disabled={isMutating || !customerQuery.data} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Email estimate</button>
            <button type="button" data-tour="estimate-text" onClick={() => setSmsEstimateOpen(true)} disabled={isMutating || !customerQuery.data} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Text estimate</button>
          </>}
          {canEdit && est.can_approve && <button type="button" data-tour="estimate-approve" onClick={() => void handleApprove()} disabled={isMutating} className="rounded-md border border-amber-500 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Mark approved</button>}
          {est.customer && <button type="button" data-tour="estimate-messages" onClick={() => setMessagesOpen(true)} disabled={!customerQuery.data} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Messages</button>}
          <span className="hidden flex-1 sm:block" />
          {has('contracts.edit') && has('contracts.view') && canEdit && <button type="button" data-tour="estimate-agreement-builder" onClick={() => setAgreementOpen(true)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Service agreement</button>}
          {(canEdit && (est.can_reject || ['sent', 'approved', 'rejected'].includes(est.status))) && <details data-tour="estimate-more-actions" className="relative">
            <summary data-tour="estimate-more-actions-toggle" className="cursor-pointer list-none rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">More actions ···</summary>
            <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
              {est.can_reject && <button type="button" data-tour="estimate-reject" onClick={handleReject} disabled={isMutating} className="block w-full rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Mark rejected</button>}
              {['sent', 'approved', 'rejected'].includes(est.status) && <button type="button" data-tour="estimate-requote" onClick={handleRequote} disabled={isMutating} className="block w-full rounded px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50">Re-quote</button>}
              <button type="button" onClick={() => setTab('edit')} className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Edit details</button>
              <button type="button" data-tour="estimate-delete" onClick={handleDelete} disabled={isMutating} className="block w-full rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Delete estimate</button>
            </div>
          </details>}
          {canEdit && !['sent', 'approved', 'rejected'].includes(est.status) && <button type="button" data-tour="estimate-delete" onClick={handleDelete} disabled={isMutating} className="rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>}
        </div>
      </section>

      <div data-tour="estimate-tabs" className="mb-4 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <nav className="flex min-w-max gap-1" aria-label="Estimate sections">
          <TabButton tour="estimate-tab-overview" active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabButton>
          {focus && <TabButton tour="estimate-tab-options" active={tab === 'options'} onClick={() => setTab('options')}>Options{tiers.length > 0 ? ` (${tiers.length})` : ''}</TabButton>}
          <TabButton tour="estimate-tab-line-items" active={tab === 'line-items'} onClick={() => setTab('line-items')}>Work & pricing</TabButton>
          <TabButton tour="estimate-tab-job-tasks" active={tab === 'job-tasks'} onClick={() => setTab('job-tasks')}>Job tasks</TabButton>
          <TabButton tour="estimate-tab-edit" active={tab === 'edit'} onClick={() => setTab('edit')}>Edit details</TabButton>
          <TabButton tour="estimate-barncam" active={tab === 'crew-cam'} onClick={() => setTab('crew-cam')}>BarnCam</TabButton>
          <TabButton tour="estimate-documents" active={tab === 'documents'} onClick={() => setTab('documents')}>Documents</TabButton>
          <TabButton tour="estimate-history" active={tab === 'history'} onClick={() => setTab('history')}>History</TabButton>
          {has('settings.view') && <TabButton tour="estimate-tab-activity" active={tab === 'activity'} onClick={() => setTab('activity')}>Activity</TabButton>}
        </nav>
      </div>

      {/* Persistent customer + location strip — same component used on
          WorkOrderDetailPage. Customer name links to /customers/{id}. */}
      <div data-tour="estimate-customer-strip">
        <CustomerLocationStrip
          customer={est.customer ?? null}
          location={est.service_location ?? null}
        />
      </div>

      <EstimateProgress estimate={est} />

      {/* Content */}
      {focus && tab === 'overview' && tiers.length > 1 && <section data-tour="estimate-option-strip" aria-label="Estimate options" className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-semibold text-slate-900">Available options</h2>
          <button type="button" onClick={() => setTab('options')} className="text-sm font-semibold text-amber-700 hover:underline">Compare all options →</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {tiers.map((option) => <div key={option.id} className={`min-w-0 rounded-lg border px-3 py-2 ${est.chosen_option_id === option.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-900">{option.name}</span>{option.is_recommended && <span className="shrink-0 text-[10px] font-semibold text-amber-800">Recommended</span>}</div>
            <strong className="mt-1 block text-base tabular-nums text-slate-900">{option.money.total_formatted}</strong>
          </div>)}
        </div>
      </section>}
      {tab === 'overview' && <EstimateDetailOverview
        estimate={est}
        focus={focus}
        canEdit={canEdit}
        canDeliver={canDeliverEstimate && Boolean(customerQuery.data)}
        onTab={setTab}
        onConvert={() => setShowConvertModal(true)}
        onApprove={() => { void handleApprove() }}
        onSend={() => setEmailEstimateOpen(true)}
        onRequote={() => { void handleRequote() }}
        onMessages={() => setMessagesOpen(true)}
      />}

      {focus && tab === 'options' && <section data-tour="estimate-options-comparison" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{tiers.length > 1 ? 'Compare the solutions' : 'Estimate option'}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{tiers.length > 1 ? 'Each option shares this customer and site, but has its own work and price. Only the customer-approved option moves into the job.' : 'This estimate has one solution. You can still review its scope and pricing before sending or converting it.'}</p>
          </div>
          <button type="button" onClick={() => setTab('line-items')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Open work & pricing →</button>
        </div>
        <div className="grid items-stretch gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {tiers.length > 0 ? tiers.map((option) => {
            const optionLines = (est.line_items ?? []).filter((line) => line.estimate_option_id === option.id)
            const sharedLines = (est.line_items ?? []).filter((line) => !line.estimate_option_id)
            const chosen = est.chosen_option_id === option.id
            return <article key={option.id} className={`min-w-0 rounded-xl border bg-white p-5 shadow-sm ${chosen ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">{option.name}</h3>
                <div className="flex flex-wrap gap-1">
                  {chosen && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">Chosen</span>}
                  {option.is_recommended && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Recommended</span>}
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold tabular-nums text-slate-900">{option.money.total_formatted}</p>
              {option.highlights && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{option.highlights}</p>}
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{optionLines.length} option-specific {optionLines.length === 1 ? 'line' : 'lines'}{sharedLines.length > 0 ? ` · ${sharedLines.length} shared across options` : ''}</p>
            </article>
          }) : <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Single solution</h3>
            <p className="mt-4 text-2xl font-bold tabular-nums text-slate-900">{est.money.total_formatted}</p>
            <p className="mt-3 text-sm text-slate-600">{est.description || est.customer_notes || 'Review the work and price in the detailed editor.'}</p>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{est.line_items?.length ?? 0} {(est.line_items?.length ?? 0) === 1 ? 'line item' : 'line items'}</p>
          </article>}
        </div>
        {tiers.length > 0 && <p className="text-sm text-slate-600">To add or edit options, open Work & pricing. To record a customer decision, use Mark approved above; the approval dialog asks which option they chose.</p>}
      </section>}

      {pickTierOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 px-0 sm:items-center sm:px-4"
          onClick={() => setPickTierOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pick-tier-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
          >
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 id="pick-tier-title" className="text-base font-semibold text-slate-900">Which option did the customer choose?</h2>
              <p className="mt-0.5 text-xs text-slate-500">The other options' work is declined, so the job and invoice carry only this one.</p>
            </div>
            <div className="space-y-2 p-5">
              {tiers.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={approveEstimate.isPending}
                  onClick={() => handleApprove(o.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <span>
                    <span className="block font-semibold text-slate-900">
                      {o.name}
                      {o.is_recommended && <span className="ml-1.5 text-[11px] font-semibold text-amber-700">Recommended</span>}
                    </span>
                    {o.highlights && <span className="block text-xs text-slate-500">{o.highlights}</span>}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">{o.money.total_formatted}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setPickTierOpen(false)}
                className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'line-items' && (
        <div data-tour="estimate-line-items">
        <Card title="Line Items">
          <PartsOrders estimate={{ id: est.id, number: est.estimate_number, title: est.title ?? null, status: est.status }} />
          <EstimateLineItemEditorLive
            estimateId={est.id}
            availableAssets={(est.covered_assets ?? []).map((a) => ({
              id: a.id,
              name: a.name,
            }))}
            disabled={!canEdit}
          />
        </Card>
        </div>
      )}

      {tab === 'job-tasks' && <JobTasksCard parent={{ kind: 'estimate', id: est.id }} />}
      {tab === 'edit' && <EstimateEditForm estimate={est} readOnly={!canEdit} />}

      {tab === 'crew-cam' && (
        <div data-tour="estimate-barncam-panel">
        <BarnCamPanel
          basePath={`/v1/estimates/${est.id}`}
          cacheKey={['est-attachments', est.id]}
        />
        </div>
      )}

      {tab === 'documents' && (
        <div data-tour="estimate-documents-panel">
        <AttachmentsPanel
          basePath={`/v1/estimates/${est.id}`}
          cacheKey={['est-attachments', est.id]}
          mode="documents"
        />
        </div>
      )}

      {tab === 'history' && <EstimateHistoryPanel estimate={est} />}

      {tab === 'activity' && has('settings.view') && (
        <div data-tour="estimate-activity-panel"><EntityActivityPanel entityId={est.id} noun="estimate" /></div>
      )}

      {showConvertModal && canEdit && (
        // The window is fixed on screen; tutorials point inside it through this wrapper.
        <div data-tour="estimate-convert-modal">
        <ConvertEstimateToJobModal
          isOpen
          estimate={est}
          onClose={() => setShowConvertModal(false)}
        />
        </div>
      )}
      {agreementOpen && <AgreementBuilderModal estimateId={est.id} canSaveTemplates={has('templates.edit')} onClose={() => setAgreementOpen(false)} />}

      {emailEstimateOpen && (
      <div data-tour="estimate-email-composer">
      <EmailComposerModal
        isOpen={emailEstimateOpen}
        onClose={() => setEmailEstimateOpen(false)}
        customerId={est.customer_id}
        estimateId={est.id}
        locationId={est.customer_service_location_id ?? null}
        topic="estimate"
        defaultEmail={emailContact?.email ?? customerQuery.data?.email}
        defaultSubject={`Estimate ${est.estimate_number} is ready`}
        defaultBody={`${estimateMessage}

Review and respond:
${estimatePortalUrl}`}
        onSent={() => void handleDeliverySent()}
      />
      </div>
      )}

      {smsEstimateOpen && (
      <div data-tour="estimate-sms-composer">
      <SmsComposerModal
        isOpen={smsEstimateOpen}
        onClose={() => setSmsEstimateOpen(false)}
        customerId={est.customer_id}
        estimateId={est.id}
        locationId={est.customer_service_location_id ?? null}
        defaultPhone={phoneContact?.phone}
        defaultBody={`${estimateMessage} Review and respond: ${estimatePortalUrl}`}
        onSent={() => void handleDeliverySent()}
      />
      </div>
      )}

      <MessagesDrawer
        open={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        context={customerQuery.data ? { kind: 'customer', customer: customerQuery.data, estimateId: est.id, locationId: est.customer_service_location_id ?? null } : null}
        title={`Messages · ${est.customer?.display_name ?? 'Customer'}`}
      />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
  tour,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  tour?: string
}) {
  return (
    <button
      type="button"
      data-tour={tour}
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold ${
        active
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

function Card({ title, children, tour }: { title: string; children: React.ReactNode; tour?: string }) {
  return (
    <section data-tour={tour} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow transition-shadow p-6">
      <h2 className="text-base font-semibold text-navy-900 pb-3 mb-2 border-b border-slate-100">
        {title}
      </h2>
      <div className="divide-y divide-slate-100 text-sm">{children}</div>
    </section>
  )
}

