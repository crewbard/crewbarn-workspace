import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, API_URL, getStoredToken, getActingTenant, getFranchiseActAs } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { usePermissions } from '@/hooks/usePermissions'
import type { Customer } from '@/types/customer'

export function CustomerStatementButton({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [savingActivation, setSavingActivation] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)
  async function retryDelivery(id: string, attempts: number) {
    if (!window.confirm('Queue this failed delivery for the next worker run? It will rebuild the pack with current balances and use the original saved recipients and subject.')) return
    setRetrying(id)
    setDownloadError('')
    try {
      await apiRequest(`/v1/customers/${customer.id}/statement-deliveries/${id}/retry`, { method: 'POST', body: { attempts } })
      await history.refetch()
    } catch (error) { setDownloadError(error instanceof Error ? error.message : 'Could not queue retry.') }
    finally { setRetrying(null) }
  }
  async function toggleActivation() {
    setSavingActivation(true)
    setDownloadError('')
    try {
      await apiRequest(`/v1/customers/${customer.id}/statement-activation`, { method: 'PATCH', body: { enabled: !preview.data?.customer_enabled } })
      await preview.refetch()
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Could not change automatic delivery.')
    } finally { setSavingActivation(false) }
  }
  async function download() {
    setDownloading(true)
    setDownloadError('')
    try {
      const headers: Record<string, string> = { Accept: 'application/pdf' }
      const token = getStoredToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const tenant = getActingTenant()
      if (tenant) headers['X-Act-As-Tenant'] = tenant
      const franchise = getFranchiseActAs()
      if (franchise) headers['X-Franchise-Act-As'] = franchise.id
      const response = await fetch(`${API_URL}/v1/customers/${customer.id}/statement-pack`, { headers })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.errors?.statement?.[0] ?? error?.message ?? 'Could not generate the statement pack.')
      }
      if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The server did not return a PDF.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'statement-pack.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Download failed.')
    } finally {
      setDownloading(false)
    }
  }
  const { has } = usePermissions()
  const permitted = has('invoices.view') && ['commercial', 'government'].includes(customer.customer_type)
  const history = useQuery({
    queryKey: ['statement-deliveries', customer.id, historyPage],
    queryFn: () => apiRequest<{ data: Array<{ id: string; period: string; status: string; attempts: number; last_error: string | null }>; last_page: number }>(`/v1/customers/${customer.id}/statement-deliveries?page=${historyPage}`),
    enabled: open && permitted,
    staleTime: 0,
    gcTime: 0,
  })
  const preview = useQuery({
    queryKey: ['customer-statement-preview', customer.id],
    queryFn: () => apiRequest<{ html: string; customer_enabled: boolean; system_enabled: boolean; template_name: string | null; schedule: { next_scheduled_date: string; timezone: string } | null; data: { rows: unknown[] } }>(`/v1/customers/${customer.id}/statement-preview`),
    enabled: open && permitted,
    staleTime: 0,
    gcTime: 0,
  })
  if (!permitted) return null
  return <>
    <button type="button" onClick={() => setOpen(true)} className="text-sm px-4 py-2 border border-amber-300 text-amber-800 rounded-md hover:bg-amber-50 whitespace-nowrap">
      Preview statement
    </button>
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Statement preview" subtitle={customer.display_name} size="xl">
      <Modal.Body>
        <details className="mb-4 rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer font-medium">Delivery history</summary>
          <p className="mt-2 text-xs text-slate-500">Sent means accepted by the email provider, not confirmed received. Only failed, unsent deliveries in the current billing period can be queued again. Sending and uncertain deliveries cannot be retried here; check the provider to avoid duplicates. Retries preserve the original recipients and subject and rebuild current balances.</p>
          {history.isPending && <p role="status">Loading history…</p>}
          {history.isError && <p role="alert">Could not load delivery history. <button type="button" className="underline" onClick={() => void history.refetch()}>Retry</button></p>}
          {history.data && <>
            {history.data.data.length === 0 && <p className="mt-3 text-sm text-slate-500">No statement deliveries yet. Previews and downloads are not deliveries.</p>}
            <ul className="mt-3 divide-y divide-slate-100">
              {history.data.data.map(row => <li key={row.id} className="py-2 text-sm">
                <span className="font-medium">{row.period}</span> · <span>{row.status === 'sent' ? 'Accepted by provider' : row.status}</span> · {row.attempts} attempt(s)
                {row.last_error && <p className="mt-1 text-amber-800">{row.last_error}</p>}
                {row.status === 'failed' && has('invoices.edit') && <button type="button" disabled={retrying !== null || !preview.data?.system_enabled || !preview.data?.customer_enabled} onClick={() => void retryDelivery(row.id, row.attempts)} className="mt-2 rounded border border-amber-300 px-3 py-1 disabled:opacity-50">{retrying === row.id ? 'Queuing…' : 'Queue safe retry'}</button>}
              </li>)}
            </ul>
            {history.data.last_page > 1 && <div className="mt-2 flex items-center gap-3 text-sm">
              <button type="button" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}>Previous</button>
              <span>Page {historyPage} of {history.data.last_page}</span>
              <button type="button" disabled={historyPage >= history.data.last_page} onClick={() => setHistoryPage(p => p + 1)}>Next</button>
            </div>}
          </>}
        </details>
        {downloadError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-red-800">{downloadError}</p>}
        <p className="mb-3 text-xs text-slate-500">PDF pack: statement first, then invoices. Simplified print layout with supported company logos and product photos. External images and SVG are excluded. Downloading does not send email.</p>
        <p className="mb-3 text-sm text-slate-600">Not sent. Includes all outstanding issued invoices, including overdue balances. Uses the saved template selection.</p>
        {preview.isFetching && <p role="status" className="py-6 text-slate-500">Preparing statement…</p>}
        {preview.isError && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          <p>{preview.error instanceof Error ? preview.error.message : 'Could not load the statement.'}</p>
          <button type="button" onClick={() => void preview.refetch()} className="mt-2 underline">Try again</button>
        </div>}
        {preview.data && !preview.isFetching && !preview.isError && <>
          {preview.data.schedule && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Schedule: {preview.data.schedule.next_scheduled_date} ({preview.data.schedule.timezone}).
            {' '}{preview.data.customer_enabled ? 'Customer opted in.' : 'Customer paused.'}
            {!preview.data.system_enabled && ' System-wide sending is off; no automatic emails will be sent.'}
          </p>}
          {has('invoices.edit') && <div className="mb-3">
            <button type="button" disabled={savingActivation} onClick={() => void toggleActivation()} className="border border-amber-300 rounded-md px-3 py-2 text-sm">
              {savingActivation ? 'Saving…' : preview.data.customer_enabled ? 'Pause monthly delivery' : 'Enable monthly delivery for this customer'}
            </button>
            <p className="text-xs text-slate-500 mt-1">Pause delivery before editing its schedule. When sending is enabled, overdue schedules may run this month.</p>
          </div>}
          <p className="mb-3 text-xs text-slate-500">{preview.data.template_name ?? 'Basic preview — no default statement template selected'} · {preview.data.data.rows.length} unpaid invoices</p>
          <iframe title="Customer statement document" sandbox="" referrerPolicy="no-referrer"
            srcDoc={preview.data.html} className="w-full h-[65vh] rounded-lg border border-slate-200 bg-white" />
        </>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" disabled={downloading || !preview.data?.template_name || preview.isFetching || preview.isError} onClick={() => void download()} className="px-4 py-2 rounded-md bg-amber-500 text-white disabled:opacity-50">{downloading ? 'Building PDF…' : 'Download PDF pack'}</button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-md border border-slate-300">Close preview</button>
      </Modal.Footer>
    </Modal>
  </>
}
