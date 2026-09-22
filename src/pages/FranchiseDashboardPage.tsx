import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, ApiError, setFranchiseActAs } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import { useFranchiseFeature } from '@/hooks/useFranchiseFeature'

/**
 * Franchise Dashboard (FR-3) — the franchisor's network roll-up. Visible only
 * when the tenant's franchise feature is enabled (the nav tab is gated the same
 * way). Network totals + a card per franchise; "Add franchise" for
 * franchises.manage holders. Drill-in (open a franchise) lands in FR-4.
 */
interface FranchiseRow {
  id: string
  name: string
  slug: string
  status: string
  vertical: string | null
  jobs_total: number
  jobs_mtd: number
  customers_total: number
  revenue_cents: number
  revenue_mtd_cents: number
}
interface Rollup {
  franchises: FranchiseRow[]
  totals: {
    franchise_count: number
    active_count: number
    jobs_total: number
    jobs_mtd: number
    customers_total: number
    revenue_cents: number
    revenue_mtd_cents: number
  }
}

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function FranchiseDashboardPage() {
  const { has } = usePermissions()
  const franchise = useFranchiseFeature()
  const canManage = has('franchises.manage')
  const [addOpen, setAddOpen] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['franchises-rollup'],
    queryFn: () => apiRequest<{ data: Rollup }>('/v1/franchises/roll-up'),
    staleTime: 60_000,
  })

  if (!franchise.enabled) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-semibold text-navy-900">Franchise</h1>
        <p className="text-sm text-slate-600 mt-2">
          The franchise feature isn&apos;t enabled for your account. Contact CrewBarn to turn it on.
        </p>
      </div>
    )
  }

  const totals = data?.data.totals
  const franchises = data?.data.franchises ?? []

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-navy-900">Franchise Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            Your whole network at a glance — sales, jobs, and progress across every franchise.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors shrink-0"
          >
            + Add franchise
          </button>
        )}
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Failed to load franchises.{error instanceof Error ? ` ${error.message}` : ''}
        </div>
      )}

      {/* Network totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Franchises" value={totals ? `${totals.active_count}/${totals.franchise_count}` : '—'} sub="active / total" loading={isLoading} />
        <StatCard label="Revenue (MTD)" value={totals ? usd(totals.revenue_mtd_cents) : '—'} sub={totals ? `${usd(totals.revenue_cents)} all-time` : ''} loading={isLoading} />
        <StatCard label="Jobs (MTD)" value={totals ? String(totals.jobs_mtd) : '—'} sub={totals ? `${totals.jobs_total} all-time` : ''} loading={isLoading} />
        <StatCard label="Customers" value={totals ? String(totals.customers_total) : '—'} sub="across network" loading={isLoading} />
      </div>

      {/* Per-franchise cards */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-navy-900">Franchises</h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-16 bg-slate-100 rounded" />
            <div className="h-16 bg-slate-100 rounded" />
          </div>
        ) : franchises.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No franchises yet.{canManage ? ' Click “Add franchise” to create your first.' : ''}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {franchises.map((f) => (
              <div key={f.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-navy-900 truncate">{f.name}</span>
                    <StatusPill status={f.status} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {f.vertical ?? '—'} · {f.slug}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right shrink-0">
                  <Metric label="MTD sales" value={usd(f.revenue_mtd_cents)} />
                  <Metric label="Jobs (MTD)" value={String(f.jobs_mtd)} />
                  <Metric label="Customers" value={String(f.customers_total)} />
                  {canManage && <RequestAccessButton franchiseId={f.id} />}
                  <button
                    type="button"
                    onClick={() => {
                      setFranchiseActAs({ id: f.id, name: f.name })
                      window.location.assign('/')
                    }}
                    className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 font-medium text-navy-900"
                  >
                    Open →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Royalties (Layer 3) — what each franchise owes the franchisor */}
      <RoyaltiesSection canManage={canManage} />

      {addOpen && <AddFranchiseModal onClose={() => setAddOpen(false)} />}
    </div>
  )
}

interface FeeSchedule {
  id: string
  franchise_tenant_id: string | null
  base_cents: number
  percentage: string | number
  basis: 'gross_sales' | 'collected'
}
interface RoyaltyRow {
  id: string
  name: string
  configured: boolean
  basis: string | null
  basis_amount_cents: number
  base_cents: number
  percentage: number
  royalty_cents: number
}
interface RoyaltyStatement {
  period: string
  has_default: boolean
  franchises: RoyaltyRow[]
  total_royalty_cents: number
}

function RoyaltiesSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()

  const feesQ = useQuery({
    queryKey: ['franchise-fees'],
    queryFn: () => apiRequest<{ data: FeeSchedule[] }>('/v1/franchises/fees'),
    staleTime: 60_000,
  })
  const royaltyQ = useQuery({
    queryKey: ['franchise-royalties'],
    queryFn: () => apiRequest<{ data: RoyaltyStatement }>('/v1/franchises/royalties'),
    staleTime: 60_000,
  })

  const def = feesQ.data?.data.find((s) => s.franchise_tenant_id === null)
  const [base, setBase] = useState('')
  const [pct, setPct] = useState('')
  const [basis, setBasis] = useState<'gross_sales' | 'collected'>('gross_sales')
  const [seeded, setSeeded] = useState(false)
  if (def && !seeded) {
    setSeeded(true)
    setBase((def.base_cents / 100).toString())
    setPct(String(def.percentage))
    setBasis(def.basis)
  }

  const save = useMutation({
    mutationFn: () =>
      apiRequest('/v1/franchises/fees', {
        method: 'PATCH',
        body: {
          base_cents: Math.round((parseFloat(base) || 0) * 100),
          percentage: parseFloat(pct) || 0,
          basis,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchise-fees'] })
      queryClient.invalidateQueries({ queryKey: ['franchise-royalties'] })
    },
  })

  const stmt = royaltyQ.data?.data

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-navy-900">Royalties</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Fees you charge your franchises{stmt ? ` · ${stmt.period}` : ''}. Computed; collect off-platform.
          </p>
        </div>
        {stmt && (
          <div className="text-right">
            <div className="text-lg font-bold text-navy-900">{usd(stmt.total_royalty_cents)}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">owed this period</div>
          </div>
        )}
      </div>

      {canManage && (
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            Base fee ($)
            <input value={base} onChange={(e) => setBase(e.target.value.replace(/[^0-9.]/g, ''))} className="mt-1 block w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="0" />
          </label>
          <label className="text-xs text-slate-600">
            Royalty %
            <input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ''))} className="mt-1 block w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="0" />
          </label>
          <label className="text-xs text-slate-600">
            On
            <select value={basis} onChange={(e) => setBasis(e.target.value as 'gross_sales' | 'collected')} className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="gross_sales">Gross sales (invoiced)</option>
              <option value="collected">Collected (paid)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-4 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-sm font-medium"
          >
            {save.isPending ? 'Saving…' : 'Save default'}
          </button>
          {save.isSuccess && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
        </div>
      )}

      {royaltyQ.isLoading ? (
        <div className="p-6 animate-pulse"><div className="h-12 bg-slate-100 rounded" /></div>
      ) : !stmt || stmt.franchises.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">No franchises to bill yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th className="px-6 py-2 font-semibold">Franchise</th>
              <th className="px-6 py-2 font-semibold text-right">Sales</th>
              <th className="px-6 py-2 font-semibold text-right">Fee</th>
              <th className="px-6 py-2 font-semibold text-right">Owed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {stmt.franchises.map((r) => (
              <tr key={r.id}>
                <td className="px-6 py-2 text-navy-900">{r.name}</td>
                <td className="px-6 py-2 text-right text-slate-600">{r.configured ? usd(r.basis_amount_cents) : '—'}</td>
                <td className="px-6 py-2 text-right text-slate-600">
                  {r.configured ? `${usd(r.base_cents)} + ${r.percentage}%` : <span className="text-amber-600">no fee set</span>}
                </td>
                <td className="px-6 py-2 text-right font-medium text-navy-900">{r.configured ? usd(r.royalty_cents) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function RequestAccessButton({ franchiseId }: { franchiseId: string }) {
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/franchises/${franchiseId}/support-requests`, { method: 'POST' }),
  })
  if (mutation.isSuccess) {
    return <span className="text-xs text-emerald-600 font-medium px-2">Request sent ✓</span>
  }
  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      title="Ask this franchise to grant you temporary support access (edit)"
      className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50 font-medium text-slate-700"
    >
      {mutation.isPending ? 'Requesting…' : 'Request access'}
    </button>
  )
}

function StatCard({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">{label}</div>
      <div className={`text-2xl font-bold text-navy-900 mt-1 ${loading ? 'opacity-40' : ''}`}>{value}</div>
      {sub ? <div className="text-xs text-slate-500 mt-0.5">{sub}</div> : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-navy-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'trial'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600'
  return <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${cls}`}>{status}</span>
}

function AddFranchiseModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    slug: '',
    owner_email: '',
    owner_first_name: '',
    owner_last_name: '',
    owner_phone: '',
  })
  const [done, setDone] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // Auto-suggest a slug from the name if the user hasn't typed one.
  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setForm((f) => ({
      ...f,
      name,
      slug: f.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    }))
  }

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { tenant: { name: string }; invitation_email_sent: boolean } }>('/v1/franchises', {
        method: 'POST',
        body: {
          name: form.name,
          slug: form.slug,
          owner: {
            email: form.owner_email,
            first_name: form.owner_first_name || null,
            last_name: form.owner_last_name || null,
            phone: form.owner_phone || null,
          },
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['franchises-rollup'] })
      setDone(
        res.data.invitation_email_sent
          ? `Franchise created — an invite was emailed to ${form.owner_email}.`
          : `Franchise created. (Invite email didn't send — you can resend it from the franchise.)`,
      )
    },
  })

  const canSave = form.name.trim() && /^[a-z0-9_-]+$/.test(form.slug) && form.owner_email.trim()
  const err = mutation.isError
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : 'Failed to create franchise.'
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-navy-900">Add franchise</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-emerald-700">{done}</p>
            <p className="text-xs text-slate-500">
              The franchise inherits your trade and its name is locked to what you entered.
            </p>
            <button type="button" onClick={onClose} className="w-full px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium">
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <Field label="Franchise name" hint="Locked once created — this is the brand name the franchise operates under.">
              <input value={form.name} onChange={onNameChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none" placeholder="e.g. Key-En-Lock — Orange County" />
            </Field>
            <Field label="URL slug" hint="Lowercase letters, numbers, dashes.">
              <input value={form.slug} onChange={set('slug')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none" placeholder="ken-orange-county" />
            </Field>
            <div className="border-t border-slate-100 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Franchise owner</div>
              <Field label="Owner email">
                <input value={form.owner_email} onChange={set('owner_email')} type="email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none" placeholder="owner@example.com" />
              </Field>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="First name"><input value={form.owner_first_name} onChange={set('owner_first_name')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none" /></Field>
                <Field label="Last name"><input value={form.owner_last_name} onChange={set('owner_last_name')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none" /></Field>
              </div>
              <Field label="Phone" className="mt-3"><input value={form.owner_phone} onChange={set('owner_phone')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none" /></Field>
            </div>

            {err && <p className="text-sm text-red-700">{err}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button
                type="button"
                disabled={!canSave || mutation.isPending}
                onClick={() => mutation.mutate()}
                className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-sm font-medium"
              >
                {mutation.isPending ? 'Creating…' : 'Create + invite owner'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  )
}
