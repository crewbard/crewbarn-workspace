import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { AttachmentOverlay } from '@/components/ui/AttachmentOverlay'
import { useTheme } from '@/hooks/useTheme'

/**
 * Signed Doc tab on the staff WO detail page. Renders every signature
 * captured for the WO across all visits — most recent first. Each
 * signature shows the signer, role, visit it was tied to, capture time,
 * and the PNG itself (click to lightbox). No write actions here; the
 * signature is captured by the field tech in the sub-app or the
 * tenant tech in the main mobile flow.
 */

interface SignatureRow {
  id: string
  visit_id: string
  signer_name: string
  signer_role: string | null
  signature_image_path: string
  url: string | null
  captured_at: string | null
  captured_lat: number | string | null
  captured_lng: number | string | null
}

export function WorkOrderSignaturesPanel({ workOrderId }: { workOrderId: string }) {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [overlay, setOverlay] = useState<{ url: string; filename: string } | null>(null)

  const q = useQuery<{ data: SignatureRow[] }>({
    queryKey: ['wo-signatures', workOrderId],
    queryFn: () => apiRequest(`/v1/work-orders/${workOrderId}/signatures`),
  })

  const rows = q.data?.data ?? []

  if (q.isLoading) {
    return <div className="text-sm text-slate-500">Loading signatures…</div>
  }
  if (q.isError) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">Signatures could not be loaded.
      <button type="button" disabled={q.isFetching} onClick={() => void q.refetch()} className="ml-2 underline disabled:opacity-50">Retry</button>
    </div>
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
        No signatures captured yet. Captured on-site by the tech via the sub-app or
        main mobile flow.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {easy && <header className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Captured signatures ({rows.length})</h2>
        <p className="mt-1 text-sm text-slate-600">Review the signer, capture time, and recorded location. Select a signature image to enlarge it. New signatures are captured in the field workflow.</p>
      </header>}
      {rows.map((s) => (
        <div
          key={s.id}
          className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-start gap-4"
        >
          <button
            type="button"
            onClick={() =>
              s.url && setOverlay({ url: s.url, filename: `Signature — ${s.signer_name}` })
            }
            className="shrink-0 w-40 h-24 border border-slate-200 rounded bg-white overflow-hidden flex items-center justify-center"
            disabled={!s.url}
          >
            {s.url ? (
              <img
                src={s.url}
                alt={`Signature by ${s.signer_name}`}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
              />
            ) : (
              <span className="text-3xl text-slate-300">✍️</span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="break-words text-sm font-semibold text-slate-900">{s.signer_name}</div>
            {s.signer_role && (
              <div className="text-xs text-slate-500">{s.signer_role}</div>
            )}
            <div className="text-xs text-slate-500 mt-1">
              {s.captured_at ? new Date(s.captured_at).toLocaleString() : '—'}
              {s.captured_lat != null && s.captured_lng != null && (
                <>
                  {' · '}
                  <a
                    href={`https://maps.google.com/?q=${s.captured_lat},${s.captured_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-700 hover:underline"
                  >
                    GPS
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {overlay && (
        <AttachmentOverlay
          url={overlay.url}
          filename={overlay.filename}
          kind="image"
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
