import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

interface WarrantySettings {
  warranty_expiring_soon_days: number
  warranty_claim_policy: 'unlimited' | 'one_per_warranty'
}

/**
 * Settings → Warranty. Tenant-wide warranty policy that drives:
 *   - WarrantyApplier behavior on invoice send (labor rule)
 *   - Dashboard "expiring soon" panel threshold
 *   - Claim handling on void/claim actions
 *
 * Per-item overrides live on the catalog item (manufacturer / company /
 * labor days). This page covers the FALLBACK rules.
 */
export function SettingsWarrantyPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'warranty'],
    queryFn: () => apiRequest<{ data: WarrantySettings }>('/v1/settings/warranty'),
  })

  const save = useMutation({
    mutationFn: (patch: Partial<WarrantySettings>) =>
      apiRequest<{ data: WarrantySettings }>('/v1/settings/warranty', {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'warranty'] }),
  })

  const s = data?.data
  const [expiringSoonDays, setExpiringSoonDays] = useState('30')
  const [claimPolicy, setClaimPolicy] = useState<WarrantySettings['warranty_claim_policy']>('unlimited')
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (!s) return
    setExpiringSoonDays(String(s.warranty_expiring_soon_days))
    setClaimPolicy(s.warranty_claim_policy)
  }, [s])

  function handleSave() {
    save.mutate(
      {
        warranty_expiring_soon_days: Math.max(0, parseInt(expiringSoonDays, 10) || 0),
        warranty_claim_policy: claimPolicy,
      },
      { onSuccess: () => setSavedAt(new Date()) },
    )
  }

  const inputCls =
    'w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-navy-900">Warranty policy</h1>
      <p className="text-sm text-slate-600 mt-1">
        Tenant-wide warranty rules. Per-item warranty days live on each catalog
        item; this page covers the fallback behavior and platform-wide thresholds.
      </p>

      {isLoading || !s ? (
        <p className="text-sm text-slate-500 mt-6">Loading…</p>
      ) : (
        <div className="mt-6 space-y-5">
          {/* Claim policy */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Claim policy</h2>
            <p className="text-xs text-slate-500 mb-3">
              What happens after a customer files a warranty claim.
            </p>
            <div className="space-y-2">
              <Option
                value="unlimited"
                current={claimPolicy}
                onChange={setClaimPolicy}
                title="Unlimited claims"
                hint="Customer can file multiple claims; the warranty stays active until expiry."
              />
              <Option
                value="one_per_warranty"
                current={claimPolicy}
                onChange={setClaimPolicy}
                title="One claim per warranty"
                hint="Filing a claim voids further coverage on that warranty record."
              />
            </div>
          </section>

          {/* Expiring soon threshold */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Expiring soon threshold</h2>
            <p className="text-xs text-slate-500 mb-3">
              How many days out to flag warranties as "expiring soon" — drives the dashboard panel + alerts.
            </p>
            <input
              type="number"
              min="0"
              max="365"
              className={inputCls + ' w-32'}
              value={expiringSoonDays}
              onChange={(e) => setExpiringSoonDays(e.target.value)}
            />
            <span className="text-xs text-slate-500 ml-2">days</span>
          </section>

          <div className="flex items-center justify-between sticky bottom-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 shadow-sm">
            <div className="text-xs text-slate-500">
              {savedAt && `Saved ${savedAt.toLocaleTimeString()}`}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={save.isPending}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Save warranty settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Option<T extends string>({
  value,
  current,
  onChange,
  title,
  hint,
}: {
  value: T
  current: T
  onChange: (v: T) => void
  title: string
  hint: string
}) {
  const active = value === current
  return (
    <label
      className={`flex items-start gap-3 cursor-pointer border rounded-md px-3 py-2 ${
        active ? 'border-amber-400 bg-amber-50/60' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <input
        type="radio"
        checked={active}
        onChange={() => onChange(value)}
        className="mt-1 text-amber-600 focus:ring-amber-500"
      />
      <div className="text-sm">
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
    </label>
  )
}
