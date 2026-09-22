import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, API_URL, getStoredToken, getActingTenant } from '@/lib/api'

/**
 * Per-WO template uploader. The vendor receives the PM's job-specific
 * WO/PO PDF (usually via email) and attaches it to the job here. On
 * completion, the AI-fill pipeline renders the signed copy onto this
 * PDF and stamps the result as the WO's filled_wo_pdf_path.
 *
 * One PDF per WO — re-uploading replaces the existing one. Delete
 * removes both the storage object and the WO's pointer.
 */

interface WoTemplate {
  original_filename: string | null
  uploaded_at: string | null
  uploaded_by_account_id: string | null
}

export function WorkOrderTemplateUpload({ workOrderId }: { workOrderId: string }) {
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['wo-template', workOrderId],
    queryFn: () =>
      apiRequest<{ data: WoTemplate | null }>(`/v1/work-orders/${workOrderId}/template`),
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('template', file)
      const token = getStoredToken()
      const tenant = getActingTenant()
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (tenant) headers['X-Act-As-Tenant'] = tenant
      const res = await fetch(`${API_URL}/v1/work-orders/${workOrderId}/template`, {
        method: 'POST',
        headers,
        body: fd,
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = `Upload failed (${res.status})`
        try {
          msg = JSON.parse(text).message ?? msg
        } catch { /* ignore */ }
        throw new Error(msg)
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wo-template', workOrderId] })
      // useWorkOrder uses workOrderKeys.detail = ['work-orders','detail',id].
      // Invalidate by prefix so both detail + list refetch — picks up the
      // new ai_field_map as soon as the worker writes it.
      qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${workOrderId}/template`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wo-template', workOrderId] })
      // useWorkOrder uses workOrderKeys.detail = ['work-orders','detail',id].
      // Invalidate by prefix so both detail + list refetch — picks up the
      // new ai_field_map as soon as the worker writes it.
      qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })

  const existing = q.data?.data ?? null

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
        Customer's WO / PO template
      </div>
      <p className="text-xs text-slate-500 mb-3 max-w-xl">
        Upload the customer's job-specific WO or PO PDF here. On completion the
        signed copy is rendered onto this PDF — visit timestamps, scope, line
        items, and the on-site signature — and attached to the job.
      </p>

      {upload.isError && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-3">
          {(upload.error as Error).message}
        </div>
      )}

      {existing ? (
        <div className="flex items-center justify-between p-3 rounded border border-amber-300 bg-amber-50 mb-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900 truncate">
              📄 {existing.original_filename}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Uploaded{' '}
              {existing.uploaded_at
                ? new Date(existing.uploaded_at).toLocaleString()
                : '—'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm('Remove this template? Completion will fall back to the generic CrewBarn layout.')) {
                remove.mutate()
              }
            }}
            disabled={remove.isPending}
            className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded disabled:opacity-50 ml-3"
          >
            {remove.isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
      ) : (
        !q.isLoading && (
          <p className="text-xs text-slate-500 italic mb-3">
            No template uploaded. Completion PDF will use the generic CrewBarn layout.
          </p>
        )
      )}

      <label className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={upload.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload.mutate(f)
            e.target.value = ''
          }}
        />
        {upload.isPending
          ? 'Uploading…'
          : existing
            ? '+ Replace PDF'
            : '+ Upload PDF'}
      </label>
    </section>
  )
}
