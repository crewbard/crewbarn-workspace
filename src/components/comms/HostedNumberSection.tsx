import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  buyHostedNumber,
  getHostedNumbers,
  releaseHostedNumber,
  searchHostedNumbers,
  type HostedNumberSearchResult,
} from '@/lib/hostedNumbers'
import type { CommsProvider } from '@/types/communicationSettings'
import { useAuth } from '@/hooks/useAuth'

const QUERY_KEY = ['tenant-settings', 'communication', 'hosted-numbers'] as const

interface HostedNumberSectionProps {
  activeProvider?: CommsProvider | null
  onActiveChange?: (active: boolean) => void
}

export function HostedNumberSection({ activeProvider, onActiveChange }: HostedNumberSectionProps) {
  const { account } = useAuth()
  // Beta / free-for-life: numbers come from the tenant's own Twilio or Net2Phone, never bought through CrewBarn.
  if (account?.tenant?.byo_only) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Beta accounts bring their own numbers — connect your own Twilio or Net2Phone account instead. CrewBarn never bills you for a number.
      </div>
    )
  }
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getHostedNumbers,
  })
  const [areaCode, setAreaCode] = useState('')
  const [results, setResults] = useState<HostedNumberSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [releaseConfirm, setReleaseConfirm] = useState('')

  const searchMutation = useMutation({
    mutationFn: searchHostedNumbers,
    onSuccess: (fresh) => {
      setResults(fresh)
      setSearchError(null)
    },
    onError: (e) => {
      setSearchError(e instanceof ApiError ? e.message : 'Number search failed.')
    },
  })

  const buyMutation = useMutation({
    mutationFn: buyHostedNumber,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['tenant-settings', 'communication'] })
      setResults([])
      setAreaCode('')
    },
  })

  const releaseMutation = useMutation({
    mutationFn: releaseHostedNumber,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['tenant-settings', 'communication'] })
      setReleaseConfirm('')
    },
  })

  const active = data?.numbers.find((n) => n.status === 'active') ?? null
  const monthly = data ? currency(data.monthly_fee_cents) : '$0.00'

  useEffect(() => {
    onActiveChange?.(active !== null)
  }, [active, onActiveChange])

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-base font-semibold text-navy-900">Optional CrewBarn mobile number</h2>
            <p className="text-sm text-slate-500 mt-1">
              Buy a separate Twilio number for mobile calling only when the tenant does not want to
              verify its existing public number. Net2Phone can remain selected for office service.
            </p>
          </div>
          {active && (
            <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
              Active
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {isLoading && <p className="text-sm text-slate-500">Loading hosted number status…</p>}
        {isError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            Failed to load hosted number status.
            {error instanceof Error ? ` ${error.message}` : ''}
          </div>
        )}

        {data && !data.enabled && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            Hosted number buying is not configured on this CrewBarn environment yet. Add
            HOSTED_TWILIO_* credentials to the API environment before tenants can buy numbers.
          </div>
        )}

        {active && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant number</p>
            <p className="mt-1 text-2xl font-semibold text-navy-900">{active.phone_number}</p>
            <p className="text-sm text-slate-600">
              {monthly}/month number fee. 10DLC status: {active.ten_dlc_status ?? 'not started'}.
            </p>
            <p className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              Billing for this hosted number continues until it is released here or ported out.
              The office provider selection does not disable this mobile number.
            </p>
            {!data?.test_mode && active.ten_dlc_status !== 'approved' && (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Outbound customer SMS is blocked until 10DLC is approved for this tenant number.
              </p>
            )}
            {data?.test_mode && active.ten_dlc_status !== 'approved' && (
              <p className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Hosted Twilio test mode is on. SMS can be tested before 10DLC approval.
              </p>
            )}
            {activeProvider && activeProvider !== 'twilio_hosted' && (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Office calls, messages, recordings, and customer replies stay with the selected
                office provider. This CrewBarn number is available for mobile app calls.
              </p>
            )}
            <div className="mt-4 rounded-lg border border-red-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-red-800">Cancel hosted number billing</p>
              <p className="mt-1 text-sm text-slate-600">
                Use this only after the tenant has moved to BYO, ported out, or no longer needs
                this number. Releasing removes it from Twilio and stops future number billing, but
                the number may not be recoverable.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={releaseConfirm}
                  onChange={(e) => setReleaseConfirm(e.target.value)}
                  placeholder="Type RELEASE"
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:max-w-44"
                />
                <button
                  type="button"
                  onClick={() => active && releaseMutation.mutate(active.id)}
                  disabled={releaseConfirm !== 'RELEASE' || releaseMutation.isPending}
                  className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium"
                >
                  {releaseMutation.isPending ? 'Releasing...' : 'Cancel and release'}
                </button>
              </div>
              {releaseMutation.isError && (
                <p className="mt-2 text-sm text-red-700">
                  {releaseMutation.error instanceof ApiError
                    ? releaseMutation.error.message
                    : 'Could not release this number.'}
                </p>
              )}
            </div>
          </div>
        )}

        {!active && data?.enabled && (
          <>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Search by area code to buy an optional mobile caller-ID number. If the tenant keeps its
              existing Net2Phone or BYO number, verify that number above instead and skip this fee.
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <label htmlFor="hosted_area_code" className="text-sm font-medium text-navy-900 sm:pt-2">
                Area code
              </label>
              <div className="flex gap-2">
                <input
                  id="hosted_area_code"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value)}
                  placeholder="321"
                  className="block w-32 rounded-md border border-slate-300 px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  maxLength={3}
                  inputMode="numeric"
                />
                <button
                  type="button"
                  onClick={() => searchMutation.mutate(areaCode)}
                  disabled={searchMutation.isPending || areaCode.replace(/\D/g, '').length !== 3}
                  className="px-4 py-2 rounded-md bg-navy-900 hover:bg-navy-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium"
                >
                  {searchMutation.isPending ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>

            {searchError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {searchError}
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((n) => (
                  <div
                    key={n.phone_number}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-semibold text-navy-900">{n.phone_number}</p>
                      <p className="text-sm text-slate-500">
                        {[n.locality, n.region].filter(Boolean).join(', ') || n.friendly_name || 'US local number'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => buyMutation.mutate(n.phone_number)}
                      disabled={buyMutation.isPending || !data.provisioning_enabled}
                      className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium"
                    >
                      {buyMutation.isPending ? 'Buying…' : `Buy for ${monthly}/mo`}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {data && !data.provisioning_enabled && results.length > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                Search is available, but buying is disabled until HOSTED_TWILIO_PROVISIONING_ENABLED=true.
              </div>
            )}

            {buyMutation.isError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {buyMutation.error instanceof ApiError
                  ? buyMutation.error.message
                  : 'Could not buy this number.'}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function currency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}
