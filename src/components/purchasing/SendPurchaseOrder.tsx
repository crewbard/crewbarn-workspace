import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { IconFileDownload, IconSend } from '@tabler/icons-react'
import '@/components/inventory/bins/bins.css'
import { ApiError } from '@/lib/api'
import { downloadPurchaseOrderPdf, sendPurchaseOrder } from '@/lib/purchaseOrders'
import { purchaseOrderKeys, useSupplierCopy } from '@/hooks/usePurchaseOrders'
import { downloadBlob } from '@/lib/extractedDocumentPdf'
import type { SupplierCopy } from '@/types/purchaseOrder'

/**
 * Send the PO to the vendor: one button opens a sheet with the vendor's
 * email filled in, optional cc and a note. Nothing goes out until Send is
 * pressed. Lines with no vendor part number are flagged and need a tick.
 * Also: download the supplier copy as a PDF, and the send log.
 */
export function SendPurchaseOrder({ poId, canSend }: { poId: string; canSend: boolean }) {
  const copy = useSupplierCopy(poId)
  const [open, setOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const d = copy.data
  const sent = d?.send?.sent_at

  const pdf = async () => {
    if (!d) return
    setPdfBusy(true)
    try {
      downloadBlob(await downloadPurchaseOrderPdf(poId), `PO-${d.po_number}.pdf`)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => void pdf()} disabled={!d || pdfBusy} data-bins-ui="" data-tour="po-pdf"
        className="inline-flex items-center gap-1 rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 py-1.5 text-sm font-medium text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)] disabled:opacity-50">
        <IconFileDownload size={15} /> {pdfBusy ? 'Making PDF…' : 'PDF'}
      </button>
      {canSend && (
        <button type="button" onClick={() => setOpen(true)} disabled={!d} data-bins-ui="" data-tour="po-send"
          title={d?.send?.blocker ?? undefined}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--bins-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:opacity-50">
          <IconSend size={15} /> {sent ? 'Send again' : 'Send to vendor'}
        </button>
      )}
      {open && d && <SendSheet poId={poId} copy={d} onClose={() => setOpen(false)} />}
    </>
  )
}

function SendSheet({ poId, copy, onClose }: { poId: string; copy: SupplierCopy; onClose: () => void }) {
  const qc = useQueryClient()
  const vendor = copy.supplier?.name ?? 'the vendor'
  const onFile = copy.send.to
  const [to, setTo] = useState(onFile ?? '')
  const [cc, setCc] = useState('')
  const [message, setMessage] = useState('')
  const [confirmMissing, setConfirmMissing] = useState(false)
  const [saveEmail, setSaveEmail] = useState(!onFile)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const missing = copy.missing_part_numbers
  const blocker = copy.send.blocker
  const ccList = cc.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
  const canSend = !blocker && to.trim() !== '' && (missing === 0 || confirmMissing) && !busy && ccList.length <= 5

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await sendPurchaseOrder(poId, {
        to: to.trim(),
        cc: ccList,
        message: message.trim() || undefined,
        confirm_missing: confirmMissing,
        save_email_to_vendor: !onFile && saveEmail,
      })
      setDone(r.message ?? `Sent to ${to.trim()}.`)
      void qc.invalidateQueries({ queryKey: purchaseOrderKeys.all })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The email did not go out.')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full rounded border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 py-2 text-sm text-[var(--bins-text)]'
  return (
    <div data-bins-ui="" className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--bins-dark)_45%,transparent)] p-4" role="dialog" aria-modal="true" aria-label="Send purchase order">
      <div data-tour="po-send-sheet" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--bins-surface)] p-5 text-[var(--bins-text)] shadow-xl">
        <h2 className="text-lg font-semibold">Send PO {copy.po_number} to {vendor}</h2>
        <p className="mt-1 text-sm text-[var(--bins-text-2)]">They get an email with the supplier copy as a PDF: their part numbers, no bins, no internal SKUs, no notes.</p>
        {done ? (
          <>
            <p role="status" className="mt-4 rounded-md border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] px-3 py-2 text-sm">{done}</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className="rounded-md bg-[var(--bins-accent)] px-4 py-2 text-sm font-semibold text-[var(--bins-surface)]">Done</button>
            </div>
          </>
        ) : (
          <>
            {blocker && <p role="alert" className="mt-3 rounded-md border border-[var(--color-warning)] px-3 py-2 text-sm">{blocker}</p>}
            <label className="mt-4 block text-xs font-medium text-[var(--bins-text-2)]">To
              <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder={`${vendor}'s email`} className={field + ' mt-1'} />
            </label>
            {!onFile && (
              <label className="mt-1 flex items-center gap-2 text-xs text-[var(--bins-text-2)]">
                <input type="checkbox" checked={saveEmail} onChange={(e) => setSaveEmail(e.target.checked)} />
                Save this email on {vendor}
              </label>
            )}
            <label className="mt-3 block text-xs font-medium text-[var(--bins-text-2)]">Cc (optional, up to 5)
              <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="name@shop.com" className={field + ' mt-1'} />
            </label>
            <label className="mt-3 block text-xs font-medium text-[var(--bins-text-2)]">Note (optional)
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} placeholder="Please ship by Friday." className={field + ' mt-1'} />
            </label>
            {missing > 0 && (
              <label data-tour="po-send-missing" className="mt-3 flex items-start gap-2 rounded-md border border-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--bins-surface))] px-3 py-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={confirmMissing} onChange={(e) => setConfirmMissing(e.target.checked)} />
                <span>{missing === 1 ? '1 line has' : `${missing} lines have`} no {vendor} part number, so they only see the description. Send anyway.</span>
              </label>
            )}
            {copy.status === 'draft' && <p className="mt-3 text-xs text-[var(--bins-muted)]">Sending marks this draft as ordered.</p>}
            {error && <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[var(--bins-text-2)]">Cancel</button>
              <button type="button" onClick={() => void send()} disabled={!canSend}
                className="rounded-md bg-[var(--bins-accent)] px-4 py-2 text-sm font-semibold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:opacity-50">
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Who it went to and when, newest first. */
export function PurchaseOrderSendLog({ poId }: { poId: string }) {
  const copy = useSupplierCopy(poId)
  const log = copy.data?.send?.log ?? []
  if (log.length === 0) return null
  const label = { sent: 'Sent', send_failed: 'Did not send', pdf_downloaded: 'PDF downloaded' } as Record<string, string>
  return (
    <div data-bins-ui="" data-tour="po-send-log" className="mb-4 rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--bins-muted)]">Sent to the vendor</div>
      <ul className="mt-1 list-none space-y-0.5 p-0 text-sm text-[var(--bins-text-2)]">
        {log.map((e, i) => (
          <li key={i}>
            <span className={e.kind === 'send_failed' ? 'font-medium text-[var(--color-danger)]' : 'font-medium text-[var(--bins-text)]'}>{label[e.kind] ?? e.kind}</span>
            {e.to && <> to {e.to}</>}{e.cc.length > 0 && <> (cc {e.cc.join(', ')})</>}
            {e.at && <> · {new Date(e.at).toLocaleString()}</>}{e.by && <> · {e.by}</>}
            {e.error && <> · {e.error}</>}
          </li>
        ))}
      </ul>
    </div>
  )
}