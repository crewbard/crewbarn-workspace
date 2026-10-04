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
import { EmailComposerModal } from '@/components/comms/EmailComposerModal'
import { SmsComposerModal } from '@/components/comms/SmsComposerModal'
import { CustomerLocationStrip } from '@/components/CustomerLocationStrip'
import { usePermissions } from '@/hooks/usePermissions'
import { useCustomer } from '@/hooks/useCustomers'
import { useTheme } from '@/hooks/useTheme'
import { EasyActionCards } from '@/components/easy/EasyActionCards'
import { PartsOrders } from '@/components/estimates/PartsOrders'

type Tab = 'overview' | 'line-items' | 'edit' | 'crew-cam' | 'documents' | 'history' | 'activity'

const STATUS_PALETTE: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-800' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800' },
  superseded: { bg: 'bg-amber-100', text: 'text-amber-800' },
  expired: { bg: 'bg-amber-100', text: 'text-amber-800' },
}

export function EstimateDetailPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const estimateQuery = useEstimate(id)
  const deleteEstimate = useDeleteEstimate()
  const markEstimateSent = useMarkEstimateSent()
  const approveEstimate = useApproveEstimate()
  const rejectEstimate = useRejectEstimate()
  const supersedeEstimate = useSupersedeEstimate()
  const { has } = usePermissions()
  // Estimates have no thread of their own — they ride the customer's. Fetch the
  // full customer (the estimate carries only a thin one) for the Messages drawer.
  const customerQuery = useCustomer(estimateQuery.data?.customer?.id)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [emailEstimateOpen, setEmailEstimateOpen] = useState(false)
  const [smsEstimateOpen, setSmsEstimateOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [agreementOpen, setAgreementOpen] = useState(false)

  // Deep-link from the Estimates list next-step chip (?action=convert) →
  // auto-open the convert modal (it still confirms before creating the job).
  // Clear the param so a refresh/back doesn't re-trigger it.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('action') === 'convert') {
      setShowConvertModal(true)
      searchParams.delete('action')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

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
    `https://portal.crewbarn.com/providers/${est.tenant_id}/estimates/${est.id}`
  const estimateMessage =
    `Your estimate ${est.estimate_number} for ${est.money.total_formatted} is ready to review.`
  const canDeliverEstimate =
    !['superseded', 'expired'].includes(est.status) && (est.status !== 'draft' || est.can_send)

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


  async function handleApprove() {
    if (!id) return
    if (!confirm('Mark this estimate as approved?')) return
    try {
      await approveEstimate.mutateAsync(id)
    } catch (err) {
      const errObj = err as { details?: { reason?: string } }
      alert(`Could not approve: ${errObj?.details?.reason ?? String(err)}`)
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
    <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      {/* Header — stacks on mobile so the action button row gets its
          own line below the title block (otherwise the buttons get
          squashed against the right edge). */}
      <div className={easy ? 'mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white' : 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6'}>
        <div className={easy ? 'min-w-0 bg-emerald-950 p-5 sm:p-7' : 'min-w-0'}>
          <Link to="/estimates" className={`text-sm hover:underline ${easy ? 'text-emerald-200' : 'text-amber-700'}`}>
            &larr; Back to Estimates
          </Link>
          <div className="flex items-baseline gap-2 sm:gap-3 mt-2 flex-wrap">
            <span className={`font-mono text-sm ${easy ? 'text-emerald-200' : 'text-slate-500'}`}>{est.estimate_number}</span>
            <h1 className={easy ? 'break-words text-3xl font-semibold tracking-tight text-white' : 'text-xl sm:text-2xl font-bold text-navy-900 break-words'}>
              {est.customer?.display_name ?? 'Customer'}
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded capitalize ${palette.bg} ${palette.text}`}
            >
              {est.status}
            </span>
            {est.customer?.vip && (
              <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                VIP customer
              </span>
            )}
          </div>
        </div>

        {/* Lifecycle action buttons - driven by server-side can_* predicates */}
        <div className={`flex items-center gap-2 flex-wrap ${easy ? 'p-4 sm:px-6' : ''}`}>
          {has('contracts.edit') && has('contracts.view') && has('jobs.edit') && <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setAgreementOpen(true)}>Service agreement</button>}
          {est.customer && (
            <button
              type="button"
              onClick={() => setMessagesOpen(true)}
              disabled={!customerQuery.data}
              className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap disabled:opacity-50"
              title="View / send texts + emails for this customer"
            >
              💬 Messages
            </button>
          )}
          {est.customer && canDeliverEstimate && (
            <>
              <button
                type="button"
                onClick={() => setEmailEstimateOpen(true)}
                disabled={isMutating || !customerQuery.data}
                className="px-3 py-1.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-md disabled:opacity-50"
                title="Review the recipient and message before sending"
              >
                Email estimate
              </button>
              <button
                type="button"
                onClick={() => setSmsEstimateOpen(true)}
                disabled={isMutating || !customerQuery.data}
                className="px-3 py-1.5 text-sm font-medium border border-amber-600 text-amber-700 hover:bg-amber-50 rounded-md disabled:opacity-50"
                title="Review the recipient and text before sending"
              >
                Text estimate
              </button>
            </>
          )}
          {est.can_approve && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isMutating}
              className="px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
            >
              Mark Approved
            </button>
          )}
          {est.can_reject && (
            <button
              type="button"
              onClick={handleReject}
              disabled={isMutating}
              className="px-3 py-1.5 text-sm font-medium border border-red-600 text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
            >
              Mark Rejected
            </button>
          )}
          {(['sent', 'approved', 'rejected'] as const).includes(est.status as 'sent' | 'approved' | 'rejected') && (
            <button
              type="button"
              onClick={handleRequote}
              disabled={isMutating}
              className="px-3 py-1.5 text-sm font-medium border border-amber-600 text-amber-700 hover:bg-amber-50 rounded-md disabled:opacity-50"
            >
              Re-quote
            </button>
          )}
          {est.status === 'approved' && !est.converted_to_work_order_id && (
            <button
              type="button"
              onClick={() => setShowConvertModal(true)}
              disabled={isMutating}
              className="px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
            >
              Convert to Job
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isMutating}
            className="px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs — scroll rather than wrap at narrow widths, same as the job page
          and the cash drawer. Fewer tabs here, but the failure is identical:
          flex compresses them and multi-word labels break mid-label. */}
      {!easy && <div className="border-b border-slate-200 mb-6 overflow-x-auto">
        <nav className="flex gap-6 min-w-max">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={tab === 'line-items'} onClick={() => setTab('line-items')}>
            Line Items
          </TabButton>
          <TabButton active={tab === 'edit'} onClick={() => setTab('edit')}>
            Edit
          </TabButton>
          <TabButton active={tab === 'crew-cam'} onClick={() => setTab('crew-cam')}>
            BarnCam
          </TabButton>
          <TabButton active={tab === 'documents'} onClick={() => setTab('documents')}>
            Documents
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            History
          </TabButton>
          {has('settings.view') && (
            <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>
              Activity
            </TabButton>
          )}
        </nav>
      </div>}

      {/* Persistent customer + location strip — same component used on
          WorkOrderDetailPage. Customer name links to /customers/{id}. */}
      <CustomerLocationStrip
        customer={est.customer ?? null}
        location={est.service_location ?? null}
      />

      {/* Content */}
      {easy && <EasyActionCards label="Review before your next step" actions={[
        { key: 'overview', title: 'Check the details', description: 'Review the customer, location and totals.', active: tab === 'overview', onClick: () => setTab('overview') },
        { key: 'line-items', title: 'Review the work', description: 'Check services, quantities and pricing.', active: tab === 'line-items', onClick: () => setTab('line-items') },
        { key: 'edit', title: 'Edit details', description: 'Update the estimate using the existing form.', active: tab === 'edit', onClick: () => setTab('edit') },
        { key: 'crew-cam', title: 'BarnCam', description: 'Review photos and field media.', active: tab === 'crew-cam', onClick: () => setTab('crew-cam') },
        { key: 'documents', title: 'Check documents', description: 'Review supporting files.', active: tab === 'documents', onClick: () => setTab('documents') },
        { key: 'history', title: 'See what happened', description: 'Review the estimate history before following up.', active: tab === 'history', onClick: () => setTab('history') },
        ...(has('settings.view') ? [{ key: 'activity', title: 'Activity', description: 'Review recorded changes.', active: tab === 'activity', onClick: () => setTab('activity') }] : []),
      ]} />}
      {tab === 'overview' && (
        <div className="space-y-6">
          <Card title="Customer & Location">
            <Row label="Customer">
              {est.customer ? (
                <Link
                  to={`/customers/${est.customer.id}`}
                  className="text-amber-700 hover:underline font-medium"
                  title="Open customer account"
                >
                  {est.customer.display_name}
                </Link>
              ) : (
                '—'
              )}
              {est.customer?.vip && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                  VIP
                </span>
              )}
            </Row>
            <Row label="Service Location">
              {est.service_location ? (
                <>
                  {est.service_location.nickname && <strong>{est.service_location.nickname}</strong>}
                  <div className="text-slate-600">
                    {[
                      est.service_location.street_address,
                      est.service_location.apt_unit,
                      est.service_location.city,
                      est.service_location.state,
                      est.service_location.postal_code,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </>
              ) : (
                <span className="text-slate-400 italic">Not set</span>
              )}
            </Row>
            {est.created_by && (
              <Row label="Created By">{est.created_by.full_name || est.created_by.email}</Row>
            )}
          </Card>

          <Card title="Money">
            <Row label="Subtotal">{est.money.subtotal_formatted}</Row>
            <Row label="Tax">{est.money.tax_formatted}</Row>
            {/* Its own line rather than a silently zeroed tax, so it's visible
                that the exemption was applied and what it was worth. */}
            {(est.money.tax_exempt_adjustment_cents ?? 0) > 0 && (
              <Row label="Tax exempt">
                <span className="text-emerald-700">
                  &minus;{est.money.tax_exempt_adjustment_formatted}
                </span>
              </Row>
            )}
            <Row label="Total">
              <strong>{est.money.total_formatted}</strong>
            </Row>
          </Card>

          {(est.customer_notes || est.internal_notes || est.terms) && (
            <Card title="Notes & Terms">
              {est.customer_notes && (
                <Row label="Customer Notes">
                  <span className="whitespace-pre-wrap">{est.customer_notes}</span>
                </Row>
              )}
              {est.internal_notes && (
                <Row label="Internal Notes">
                  <span className="whitespace-pre-wrap">{est.internal_notes}</span>
                </Row>
              )}
              {est.terms && (
                <Row label="Terms">
                  <span className="whitespace-pre-wrap">{est.terms}</span>
                </Row>
              )}
            </Card>
          )}

          <Card title="Lifecycle">
            <Row label="Created">
              {est.created_at ? new Date(est.created_at).toLocaleString() : '—'}
            </Row>
            {est.sent_at && (
              <Row label="Sent">{new Date(est.sent_at).toLocaleString()}</Row>
            )}
            {est.approved_at && (
              <Row label="Approved">{new Date(est.approved_at).toLocaleString()}</Row>
            )}
            {est.rejected_at && (
              <Row label="Rejected">{new Date(est.rejected_at).toLocaleString()}</Row>
            )}
            {est.expires_at && (
              <Row label="Expires">{new Date(est.expires_at).toLocaleDateString()}</Row>
            )}
            {est.superseded_estimate && (
              <Row label="Replaces">
                <Link
                  to={`/estimates/${est.superseded_estimate.id}`}
                  className="text-amber-700 hover:underline"
                >
                  {est.superseded_estimate.estimate_number}
                </Link>
              </Row>
            )}
            {est.converted_to_work_order && (
              <Row label="Converted to">
                <Link
                  to={`/jobs/${est.converted_to_work_order!.id}`}
                  className="text-amber-700 hover:underline"
                >
                  Job {est.converted_to_work_order!.display_number}
                </Link>
              </Row>
            )}
          </Card>
        </div>
      )}

      {tab === 'line-items' && (
        <Card title="Line Items">
          <PartsOrders estimate={{ id: est.id, number: est.estimate_number, title: est.title ?? null, status: est.status }} />
          <EstimateLineItemEditorLive
            estimateId={est.id}
            availableAssets={(est.covered_assets ?? []).map((a) => ({
              id: a.id,
              name: a.name,
            }))}
          />
        </Card>
      )}

      {tab === 'edit' && <EstimateEditForm estimate={est} />}

      {tab === 'crew-cam' && (
        <BarnCamPanel
          basePath={`/v1/estimates/${est.id}`}
          cacheKey={['est-attachments', est.id]}
        />
      )}

      {tab === 'documents' && (
        <AttachmentsPanel
          basePath={`/v1/estimates/${est.id}`}
          cacheKey={['est-attachments', est.id]}
          mode="documents"
        />
      )}

      {tab === 'history' && <EstimateHistoryPanel estimate={est} />}

      {tab === 'activity' && has('settings.view') && (
        <EntityActivityPanel entityId={est.id} noun="estimate" />
      )}

      {showConvertModal && (
        <ConvertEstimateToJobModal
          isOpen
          estimate={est}
          onClose={() => setShowConvertModal(false)}
        />
      )}
      {agreementOpen && <AgreementBuilderModal estimateId={est.id} canSaveTemplates={has('templates.edit')} onClose={() => setAgreementOpen(false)} />}

      {emailEstimateOpen && (
      <EmailComposerModal
        isOpen={emailEstimateOpen}
        onClose={() => setEmailEstimateOpen(false)}
        customerId={est.customer_id}
        defaultEmail={emailContact?.email ?? customerQuery.data?.email}
        defaultSubject={`Estimate ${est.estimate_number} is ready`}
        defaultBody={`${estimateMessage}

Review and respond:
${estimatePortalUrl}`}
        onSent={() => void handleDeliverySent()}
      />
      )}

      {smsEstimateOpen && (
      <SmsComposerModal
        isOpen={smsEstimateOpen}
        onClose={() => setSmsEstimateOpen(false)}
        customerId={est.customer_id}
        defaultPhone={phoneContact?.phone}
        defaultBody={`${estimateMessage} Review and respond: ${estimatePortalUrl}`}
        onSent={() => void handleDeliverySent()}
      />
      )}

      <MessagesDrawer
        open={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        context={customerQuery.data ? { kind: 'customer', customer: customerQuery.data } : null}
        title={`Messages · ${est.customer?.display_name ?? 'Customer'}`}
      />
    </div>
  )
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
      className={`pb-3 -mb-px text-sm font-medium border-b-2 ${
        active
          ? 'border-amber-600 text-amber-700'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

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
