import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { OfficeNotification } from '@/hooks/useOfficeNotifications'

/**
 * A customer tapped "Share my location" in the portal or their app. Show it
 * on a map right here — the office is deciding who to send, not reading
 * coordinates — with the way to the job (when they have one open) or the
 * customer, and directions for the tech.
 */
export function LocationSharedOverlay({ n, onClose }: { n: OfficeNotification; onClose: () => void }) {
  const navigate = useNavigate()
  const meta = (n.meta ?? {}) as { latitude?: number; longitude?: number; work_order_id?: string | null; customer_id?: string | null; maps_url?: string }
  const lat = Number(meta.latitude)
  const lng = Number(meta.longitude)
  const ok = Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const go = (path: string) => { onClose(); navigate(path) }
  // Plain-English "where": the body minus any trailing map link older rows carried.
  const where = (n.body ?? '').replace(/\s*·\s*Map:\s*https?:\/\/\S+$/i, '').trim()

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-[2px] sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label="Shared location">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Shared location</div>
            <h2 className="truncate text-lg font-bold text-navy-900">{n.title}</h2>
            {where ? <p className="mt-0.5 text-sm text-slate-600">{where}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">Close</button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100">
          {ok ? (
            <iframe
              title="Map"
              src={`https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
              className="h-[52vh] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">No coordinates came with this one.</div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-xs text-slate-500">{ok ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : ''}</div>
          <div className="flex flex-wrap gap-2">
            {ok && (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100">Directions ↗</a>
            )}
            {meta.customer_id && (
              <button type="button" onClick={() => go(`/customers/${meta.customer_id}`)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100">Open customer</button>
            )}
            {meta.work_order_id ? (
              <button type="button" onClick={() => go(`/jobs/${meta.work_order_id}`)} className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-600">Open job</button>
            ) : (
              <button type="button" onClick={() => go(meta.customer_id ? `/jobs/new?customer_id=${encodeURIComponent(meta.customer_id)}` : '/jobs/new')} className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-600">Create job</button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
