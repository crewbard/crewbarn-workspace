import { CONNECT_URL } from '@/lib/workspaceScope'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiRequest } from '@/lib/api'
export { useCloudflareDomain } from '@/hooks/useCloudflareDomain'

/**
 * Connect Cloudflare once, and CrewBarn does the rest.
 *
 * The setup step was asking people to make an R2 bucket, make an API token,
 * and copy four values across by hand — when CrewBarn already has a flow that
 * does exactly that from one pasted token. provisionR2() creates the bucket
 * and fills in the endpoint, the access key and the secret itself.
 *
 * The same connection is worth more than the bucket, which is the part the
 * old screen never said: one token also gives the website builder a real web
 * address on your own domain, and lets you host CrewBarn itself on your own
 * domain later. Three jobs, one token.
 *
 * Typing the four values in by hand still works and is still here, folded
 * away — some shops have an existing bucket, and some IT departments will not
 * hand out a token with this much reach.
 */

interface Zone {
  id: string
  name: string
  account_id: string
  account_name?: string
}

interface CloudflareStatus {
  connected: boolean
  zone_id: string | null
  zone_name: string | null
  account_id: string | null
  zones: Zone[]
  r2_bucket: string | null
  connect_url: string
}

const KEY = ['settings', 'cloudflare']

export function ConnectCloudflare({ onProvisioned }: { onProvisioned: () => void }) {
  const qc = useQueryClient()
  const [zoneId, setZoneId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const status = useQuery({
    queryKey: KEY,
    queryFn: () => apiRequest<{ data: CloudflareStatus }>('/v1/settings/cloudflare'),
  })
  const s = status.data?.data


  const setup = useMutation({
    mutationFn: (zone: Zone) =>
      apiRequest<{ data: { r2: { bucket: string; note: string | null } | null } }>('/v1/settings/cloudflare/setup', {
        method: 'POST',
        body: {
          zone_id: zone.id,
          zone_name: zone.name,
          account_id: zone.account_id,
          enable_r2: true,
        },
      }),
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: KEY })
      onProvisioned()
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'That did not finish. Nothing was changed.'),
  })

  const zones = s?.zones ?? []
  const chosen = zones.find((z) => z.id === (zoneId || s?.zone_id)) ?? zones[0]

  if (status.isLoading) return <p className="text-sm text-slate-500">Loading…</p>

  // Already done — say so and get out of the way.
  if (s?.r2_bucket) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-base font-bold text-navy-900">Your Cloudflare storage</p><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Configured ✓</span></div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Connected bucket: <span className="break-all font-mono">{s.r2_bucket}</span> in your own Cloudflare account.
          Review your storage settings before changing where uploads are saved.
        </p>
        <a href={`${CONNECT_URL}/tool-shed/cloudflare`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-amber-800 hover:underline">Manage Cloudflare connection ↗</a>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-[15px] font-bold text-navy-900">Let CrewBarn set it up for you</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Paste one Cloudflare token and CrewBarn makes the bucket, works out the addresses and fills in the keys. The
        same token also gives your website its own web address, and lets you run CrewBarn on your own domain later.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">
          {error}
        </p>
      )}

      {!s?.connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Start on Connect Cloudflare to review all required permissions, create your token, and connect your account. Return here when finished.</p>
          <a href={`${CONNECT_URL}/tool-shed/cloudflare`} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">Open Connect Cloudflare ↗</a>
          <button type="button" onClick={() => status.refetch()} disabled={status.isFetching} className="ml-3 text-sm font-semibold text-amber-800">Check connection again</button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            Cloudflare is connected.
          </p>
          {zones.length === 0 ? (
            <p className="text-sm leading-relaxed text-slate-600">
              That token cannot see any domains. Storage can still be set up, but a domain is what gives your website
              its own address.
            </p>
          ) : (
            <label className="block">
              <span className="text-sm font-bold text-navy-900">Which of your domains</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">
                Used for your website address later. The storage bucket is the same whichever you pick.
              </span>
              <select
                value={chosen?.id ?? ''}
                onChange={(e) => setZoneId(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => chosen && setup.mutate(chosen)}
            disabled={setup.isPending || !chosen}
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {setup.isPending ? 'Setting it up…' : 'Set up my storage'}
          </button>
          {setup.data?.data?.r2?.note && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              {setup.data.data.r2.note}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Has Cloudflare already provisioned storage? Used to skip the manual boxes. */
export function useCloudflareStorageReady(): boolean {
  const status = useQuery({
    queryKey: KEY,
    queryFn: () => apiRequest<{ data: CloudflareStatus }>('/v1/settings/cloudflare'),
  })
  return Boolean(status.data?.data?.r2_bucket)
}
