import { Link, useNavigate } from 'react-router-dom'
import type { Estimate } from '@/types/estimate'
import { ReferencedText } from '@/components/ReferencedText'
import { FlashWordsContext } from '@/lib/flashContext'

type OverviewTab = 'line-items' | 'history' | 'documents' | 'crew-cam'

interface Props {
  estimate: Estimate
  focus?: boolean
  canEdit: boolean
  canDeliver: boolean
  onTab: (tab: OverviewTab) => void
  onConvert: () => void
  onApprove: () => void
  onSend: () => void
  onRequote: () => void
  onMessages: () => void
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function locationText(estimate: Estimate) {
  const site = estimate.service_location
  return site
    ? [site.street_address, site.apt_unit, site.city, site.state, site.postal_code].filter(Boolean).join(', ')
    : null
}

function Panel({ children, className = '', tour, state }: { children: React.ReactNode; className?: string; tour?: string; state?: string }) {
  return <section data-tour={tour} data-state={state} className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</section>
}

function Heading({ kicker, title, action }: { kicker: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-amber-700">{kicker}</div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-navy-900">{title}</h2>
    </div>
    {action}
  </div>
}

export function EstimateDetailOverview({
  estimate: est, focus = false, canEdit, canDeliver, onTab, onConvert, onApprove, onSend,
  onRequote, onMessages,
}: Props) {
  const navigate = useNavigate()
  const chosenOption = est.options?.find((option) => option.id === est.chosen_option_id)
    ?? est.options?.find((option) => option.is_recommended)
    ?? est.options?.[0]
  const visibleLines = (est.line_items ?? [])
    .filter((line) => !chosenOption || !line.estimate_option_id || line.estimate_option_id === chosenOption.id)
    .filter((line) => est.status !== 'approved' || line.customer_decision !== 'declined')
    .sort((a, b) => a.display_order - b.display_order)
  const isApproved = est.status === 'approved'
  const convertedJob = est.converted_to_work_order
  const isConverted = Boolean(est.converted_to_work_order_id)
  const siteName = est.service_location?.nickname || 'Service location'
  const address = locationText(est)
  const scopeText = est.description || est.customer_notes

  let nextTitle = 'Review and send the estimate'
  let nextBody = 'Check the work, recipient, and amount before sending this quote to the customer.'
  let nextLabel = 'Review work & pricing'
  let nextAction = () => onTab('line-items')
  if (est.status === 'sent') {
    nextTitle = 'Waiting for a decision'
    nextBody = 'Keep the conversation attached to this customer. If they agreed outside the portal, record the correct approval.'
    nextLabel = canEdit && est.can_approve ? 'Record approval' : 'Open messages'
    nextAction = canEdit && est.can_approve ? onApprove : onMessages
  } else if (isApproved && isConverted) {
    nextTitle = 'This estimate became a job'
    nextBody = 'The active job holds the approved scope, site, and work history. The estimate remains the quote record.'
    nextLabel = convertedJob ? 'Open linked job' : 'View estimate history'
    nextAction = convertedJob ? () => navigate(`/jobs/${convertedJob.id}`) : () => onTab('history')
  } else if (isApproved) {
    nextTitle = 'Turn approval into scheduled work'
    nextBody = 'Choose a job type, visit time, and active technician. Only approved work should follow into the job.'
    nextLabel = 'Convert to job'
    nextAction = onConvert
  } else if (est.status === 'superseded') {
    nextTitle = 'This estimate was replaced'
    nextBody = 'Keep this version for the record and follow the newer quote before making a job.'
    nextLabel = 'View estimate history'
    nextAction = () => onTab('history')
  } else if (['rejected', 'expired'].includes(est.status)) {
    nextTitle = 'This version is not active'
    nextBody = 'Keep the old decision and scope on record. Create a new draft when the customer wants different work.'
    nextLabel = 'Create a re-quote'
    nextAction = onRequote
  }

  return <div data-tour="estimate-overview" className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,.78fr)]">
    <div className="space-y-4">
      <Panel tour="estimate-overview-work">
        <Heading
          kicker={isApproved ? 'What the customer approved' : 'Estimate at a glance'}
          title="Work and price, together"
          action={<button type="button" onClick={() => onTab('line-items')} className="text-xs font-semibold text-amber-700 hover:underline">Full breakdown →</button>}
        />
        {chosenOption && <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
          {est.chosen_option_id ? 'Chosen option' : 'Previewing option'}: {chosenOption.name}
        </div>}
        {scopeText && <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{scopeText}</p>}
        {visibleLines.length > 0 ? <FlashWordsContext.Provider value={canEdit && !isApproved && !['superseded', 'rejected', 'expired'].includes(est.status) ? { estimate: { id: est.id, label: 'This estimate' } } : {}}><div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1fr)_3rem_6rem] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:grid-cols-[minmax(0,1fr)_4rem_7rem]">
            <span>Work</span><span className="text-center">Qty</span><span className="text-right">Amount</span>
          </div>
          {visibleLines.slice(0, 5).map((line) => <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_3rem_6rem] items-center gap-2 border-t border-slate-100 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_4rem_7rem]">
            <div className="min-w-0 font-medium text-slate-900"><ReferencedText text={line.description} source="estimate" /></div>
            <span className="text-center text-slate-600">{line.quantity}</span>
            <span className="text-right font-semibold tabular-nums text-slate-900">{line.money.line_total_formatted}</span>
          </div>)}
          {visibleLines.length > 5 && <button type="button" onClick={() => onTab('line-items')} className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50">View all {visibleLines.length} lines →</button>}
        </div></FlashWordsContext.Provider> : <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          No line items are available in this estimate view. Open Work & pricing to review the full scope.
        </div>}
        <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{isApproved && est.approval_scope !== 'partial' ? 'Approved total' : 'Estimate total'}</span>
            <span className="ml-2">Includes {est.money.tax_formatted} tax{est.money.tax_exempt_adjustment_cents > 0 ? `, less ${est.money.tax_exempt_adjustment_formatted} exemption` : ''}</span>
          </div>
          <strong className="text-xl tabular-nums text-navy-900">{est.money.total_formatted}</strong>
        </div>
        {isApproved && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          <strong>Approved scope is the source for the job.</strong> {est.approval_scope === 'partial'
            ? 'The customer accepted only part of this estimate; conversion carries approved lines, not every quoted line.'
            : 'Any later change to the accepted scope should be reviewed as a re-quote or change order.'}
        </div>}
      </Panel>

      {(isApproved || est.customer_signature || scopeText || est.terms || est.internal_notes) && <Panel tour="estimate-decision" state={est.customer_signature?.name ? 'signed' : 'unsigned'}>
        <Heading kicker="Customer decision" title={isApproved ? 'Approval and terms' : 'Notes and terms'} action={<button type="button" onClick={() => onTab('history')} className="text-xs font-semibold text-amber-700 hover:underline">See history →</button>} />
        <div className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Decision</div><div className="mt-1 font-medium text-slate-900">{isApproved ? (est.approval_scope === 'partial' ? 'Partially approved' : 'Approved') : est.status.charAt(0).toUpperCase() + est.status.slice(1)}</div></div>
          <div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{isApproved ? 'Approved on' : 'Updated'}</div><div className="mt-1 font-medium text-slate-900">{formatDate(isApproved ? est.approved_at : est.updated_at)}</div></div>
          {est.customer_signature?.name && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Signed by</div><div className="mt-1 font-medium text-slate-900">{est.customer_signature.name}</div></div>}
          {est.created_by && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Prepared by</div><div className="mt-1 font-medium text-slate-900">{est.created_by.full_name || est.created_by.email}</div></div>}
        </div>
        {est.terms && <div className="mt-4 border-t border-slate-100 pt-4"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Terms</div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{est.terms}</p></div>}
      </Panel>}
    </div>

    <aside className="space-y-4">
      <Panel tour="estimate-next-step" className="border-t-4 border-t-amber-500" >
        <Heading kicker="Next step" title={nextTitle} />
        <p className="mb-4 text-sm text-slate-600">{nextBody}</p>
        {(canEdit || isConverted) && <button type="button" onClick={nextAction} className="w-full rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">{nextLabel} →</button>}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs font-medium">
          {canDeliver && <button type="button" onClick={onSend} className="block text-amber-700 hover:underline">Send the customer a copy →</button>}
          {canEdit && ['sent', 'approved', 'rejected'].includes(est.status) && <button type="button" onClick={onRequote} className="block text-amber-700 hover:underline">Need to change scope? Re-quote →</button>}
        </div>
      </Panel>

      <details data-tour="estimate-connected" open={!focus} className={focus ? 'overflow-hidden rounded-xl border border-slate-200 bg-white' : 'space-y-4'}>
        {focus && <summary data-tour="estimate-connected-toggle" className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          Connected records &amp; activity <span className="ml-2 font-normal text-slate-500">· {est.covered_assets?.length ?? 0} assets{convertedJob ? ' · linked job' : ''}</span>
        </summary>}
        <div className={focus ? 'space-y-3 border-t border-slate-200 p-3' : 'space-y-4'}>
      <Panel>
        <Heading kicker="Connected records" title="Customer and site" />
        <dl className="divide-y divide-slate-100 text-sm">
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-2"><dt className="text-slate-500">Customer</dt><dd className="min-w-0 font-medium">{est.customer ? <Link to={`/customers/${est.customer.id}`} className="text-amber-700 hover:underline">{est.customer.display_name} ↗</Link> : '—'}</dd></div>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-2"><dt className="text-slate-500">Service site</dt><dd className="font-medium text-slate-900">{est.service_location ? siteName : 'Not set'}</dd></div>
          {address && <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-2"><dt className="text-slate-500">Address</dt><dd className="text-slate-700">{address}</dd></div>}
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-2"><dt className="text-slate-500">Assets</dt><dd className="text-slate-700">{est.covered_assets?.length ? `${est.covered_assets.length} linked` : 'None linked'}</dd></div>
          {convertedJob && <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-2"><dt className="text-slate-500">Job</dt><dd><Link to={`/jobs/${convertedJob.id}`} className="font-medium text-amber-700 hover:underline">{convertedJob.display_number} ↗</Link></dd></div>}
        </dl>
      </Panel>

      <Panel>
        <Heading kicker="Latest activity" title="At a glance" action={<button type="button" onClick={() => onTab('history')} className="text-xs font-semibold text-amber-700 hover:underline">All history →</button>} />
        <div className="space-y-3 text-sm">
          {est.approved_at && <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3"><span><strong className="block text-slate-900">Estimate approved</strong><small className="text-slate-500">{est.customer_signature?.name || 'Customer decision recorded'}</small></span><time className="shrink-0 text-xs text-slate-500">{formatDate(est.approved_at)}</time></div>}
          {est.sent_at && <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3"><span><strong className="block text-slate-900">Estimate sent</strong><small className="text-slate-500">Customer delivery</small></span><time className="shrink-0 text-xs text-slate-500">{formatDate(est.sent_at)}</time></div>}
          <div className="flex items-start justify-between gap-3"><span><strong className="block text-slate-900">Estimate created</strong><small className="text-slate-500">{est.created_by?.full_name || 'CrewBarn'}</small></span><time className="shrink-0 text-xs text-slate-500">{formatDate(est.created_at)}</time></div>
        </div>
      </Panel>
        </div>
      </details>
    </aside>
  </div>
}

export function EstimateProgress({ estimate: est }: { estimate: Estimate }) {
  const decisionLabel = est.status === 'rejected' ? 'Rejected'
    : est.status === 'superseded' ? 'Re-quoted'
      : est.status === 'expired' ? 'Expired'
        : est.approved_at ? 'Approved' : 'Customer decision'
  const decisionDate = est.status === 'rejected' ? est.rejected_at : est.approved_at
  const decisionDone = Boolean(decisionDate) || ['superseded', 'expired'].includes(est.status)
  const jobDone = Boolean(est.converted_to_work_order_id)
  const steps = [
    { label: 'Drafted', detail: formatDate(est.created_at), done: true },
    { label: 'Sent', detail: est.sent_at ? formatDate(est.sent_at) : 'Not sent yet', done: Boolean(est.sent_at) },
    { label: decisionLabel, detail: decisionDate ? formatDate(decisionDate) : 'Waiting', done: decisionDone },
    { label: jobDone ? 'Job created' : est.status === 'approved' ? 'Next: create job' : 'Job', detail: est.converted_to_work_order?.display_number || (est.status === 'approved' ? 'Schedule approved work' : 'After approval'), done: jobDone },
  ]

  return <ol data-tour="estimate-progress" className="mb-4 grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4" aria-label="Estimate progress">
    {steps.map((step, index) => <li key={index} className={`flex min-w-0 items-center gap-3 border-b border-slate-200 p-3 last:border-b-0 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0 ${est.status === 'approved' && index === 3 && !jobDone ? 'bg-amber-50' : ''}`}>
      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${step.done ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{step.done ? '✓' : index + 1}</span>
      <span className="min-w-0"><strong className="block text-xs text-slate-900">{step.label}</strong><small className="block truncate text-[11px] text-slate-500">{step.detail}</small></span>
    </li>)}
  </ol>
}
