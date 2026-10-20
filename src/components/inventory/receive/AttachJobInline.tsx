import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { setPoFor } from '@/lib/poParts'
import { purchaseOrderKeys } from '@/hooks/usePurchaseOrders'

/**
 * Receive overlay, Products step, Not stocked: which job the part is for.
 * An order that came from a job is already linked (nothing to search);
 * otherwise search jobs (GET /v1/work-orders?q=) and attach the order to
 * the one picked (PATCH /v1/purchase-orders/{po}/for, as the Parts onto the
 * job panel does). Then Done offers Put on Job / Send to the tech's van.
 */
type JobHit = { id: string; work_order_number?: number | string | null; title?: string | null; service_customer?: { display_name?: string | null } | null }

export function AttachJobInline({ poId, linked, canSearch }: {
  poId: string
  /** The job the order is already for, e.g. "Job #2231". */
  linked: string | null
  canSearch: boolean
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<JobHit[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (!open || term.length < 1) return
    let live = true
    const t = setTimeout(() => {
      apiRequest<{ data: JobHit[] }>(`/v1/work-orders?q=${encodeURIComponent(term)}&per_page=8`)
        .then((r) => { if (live) setHits(r.data ?? []) })
        .catch(() => { if (live) setHits([]) })
    }, 200)
    return () => { live = false; clearTimeout(t) }
  }, [q, open])

  if (linked) {
    return (
      <div data-testid="job-linked" className="flex min-h-[48px] items-center gap-2 rounded-xl border border-[var(--bins-accent-line)] bg-[var(--bins-soft)] px-3 text-[13px]">
        <span aria-hidden className="text-[var(--color-success)]">✓</span>
        <span>For <b>{linked}</b>: it goes to that job's tech after receiving.</span>
      </div>
    )
  }
  if (!canSearch) return <p className="text-[12px] text-[var(--bins-muted)]">Ask someone with jobs access to attach it to a job.</p>

  const attach = async (hit: JobHit) => {
    setBusy(true); setError(null)
    try {
      const data = await setPoFor(poId, { job: String(hit.work_order_number ?? hit.id) })
      qc.setQueryData([...purchaseOrderKeys.detail(poId), 'parts'], data)
      void qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(poId), exact: true })
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'It was not attached.')
    } finally { setBusy(false) }
  }

  return (
    <div data-testid="attach-job" className="space-y-2 rounded-xl border border-[var(--bins-border)] px-3 py-2.5">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] w-full rounded-lg border border-dashed border-[var(--bins-accent)] text-[14px] font-bold text-[var(--bins-accent-strong)]">
          Attach to job
        </button>
      ) : (
        <>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job number, customer or address"
            className="min-h-[44px] w-full rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 text-[14px]" />
          <ul className="m-0 list-none space-y-1 p-0">
            {(q.trim() ? hits : []).map((h) => (
              <li key={h.id}>
                <button type="button" disabled={busy} onClick={() => void attach(h)}
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] hover:bg-[var(--bins-soft)]">
                  <b>Job #{h.work_order_number ?? '—'}</b>
                  <span className="truncate text-[var(--bins-muted)]">{[h.service_customer?.display_name, h.title].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p role="alert" className="text-[12.5px] text-[var(--color-destructive)]">{error}</p>}
    </div>
  )
}