import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Magic-link panel for a subbed WO. Embeds in the "Subbed out" banner
 * on WorkOrderDetailPage. Three states:
 *
 *   1. No active link              → "Generate link" button
 *   2. Active link, not yet copied → shows raw URL + Copy / Revoke /
 *      Regenerate, only this turn (raw URL only returned on POST and
 *      held in component state, never re-readable)
 *   3. Active link, already opened by sub → shows prefix hint +
 *      first/last open timestamps + Revoke / Regenerate
 *
 * The raw token is only available the moment it's minted. If the office
 * loses it before sending, they regenerate (which revokes the old one).
 */

interface ActiveLink {
  id: string
  token_prefix: string
  first_opened_at: string | null
  last_opened_at: string | null
  created_at: string | null
}

interface MintedLink extends ActiveLink {
  url: string
  raw_token: string
}

export function SubJobLinkPanel({ workOrderId }: { workOrderId: string }) {
  const qc = useQueryClient()
  const key = ['wo-sub-link', workOrderId] as const

  const q = useQuery<{ data: ActiveLink | null }>({
    queryKey: key,
    queryFn: () => apiRequest(`/v1/work-orders/${workOrderId}/sub-link`),
  })

  // Holds the raw URL freshly minted this turn (so the office can copy
  // it). Cleared on revoke. Never persisted.
  const [fresh, setFresh] = useState<MintedLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mint = useMutation({
    mutationFn: () =>
      apiRequest<{ data: MintedLink }>(`/v1/work-orders/${workOrderId}/sub-link`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      setFresh(res.data)
      setError(null)
      qc.invalidateQueries({ queryKey: key })
    },
    onError: (e: { payload?: { message?: string } } | Error) => {
      setError(
        (e as { payload?: { message?: string } })?.payload?.message ??
          (e as Error).message,
      )
    },
  })

  const revoke = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${workOrderId}/sub-link`, { method: 'DELETE' }),
    onSuccess: () => {
      setFresh(null)
      qc.invalidateQueries({ queryKey: key })
    },
  })

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore — fallback is the visible URL */
    }
  }

  if (q.isLoading) {
    return <div className="text-xs text-slate-500">Loading link…</div>
  }

  const active = q.data?.data

  return (
    <div className="mt-3 bg-white border border-slate-200 rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wide font-bold text-slate-600 mb-2">
        Sub-app job link
      </div>

      {error && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2 py-1 mb-2">
          {error}
        </div>
      )}

      {/* Just-minted — show the raw URL so the office can copy it now. */}
      {fresh && (
        <div className="space-y-2">
          <div className="text-xs text-slate-700">
            Copy this and text/email it to the sub's field tech. They open it, no login.
          </div>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={fresh.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 text-xs font-mono border border-slate-300 rounded px-2 py-2 bg-slate-50"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(fresh.url)}
              className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded px-3 py-2"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="text-[11px] text-slate-500">
            ⚠ This URL is only shown once. Regenerating revokes it.
          </div>
        </div>
      )}

      {/* Existing active link (no fresh URL this turn). */}
      {!fresh && active && (
        <div className="space-y-2">
          <div className="text-xs text-slate-700">
            <span className="font-mono text-slate-500">…/j/{active.token_prefix}…</span>
            {active.first_opened_at ? (
              <span className="ml-2 text-emerald-700">
                · Opened {new Date(active.first_opened_at).toLocaleString()}
              </span>
            ) : (
              <span className="ml-2 text-slate-500">· Not yet opened</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => mint.mutate()}
              disabled={mint.isPending}
              className="text-xs font-semibold border border-slate-300 hover:bg-slate-50 rounded px-3 py-1.5 disabled:opacity-50"
              title="Generates a fresh link and revokes the old one"
            >
              {mint.isPending ? 'Regenerating…' : 'Regenerate'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Revoke this link? The sub will lose access until you issue a new one.')) {
                  revoke.mutate()
                }
              }}
              disabled={revoke.isPending}
              className="text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 rounded px-3 py-1.5 disabled:opacity-50"
            >
              {revoke.isPending ? 'Revoking…' : 'Revoke'}
            </button>
          </div>
          <div className="text-[11px] text-slate-500">
            For security, the full link is only shown when you generate it. Lost it? Regenerate.
          </div>
        </div>
      )}

      {/* No link yet — initial state right after sub-out for non-CrewBarn subs. */}
      {!fresh && !active && (
        <div className="space-y-2">
          <div className="text-xs text-slate-600">
            Generate a magic link to text or email to the sub. No login required on their end.
          </div>
          <button
            type="button"
            onClick={() => mint.mutate()}
            disabled={mint.isPending}
            className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded px-3 py-1.5 disabled:opacity-50"
          >
            {mint.isPending ? 'Generating…' : 'Generate link'}
          </button>
        </div>
      )}
    </div>
  )
}
