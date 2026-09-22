import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { formatPhoneInput } from '@/lib/phone'

/**
 * Tool Shed → General → Company Info.
 *
 * Tenant-level contact info that surfaces on customer-facing documents
 * (emails, estimates, invoices, public pages) via the merge tags
 * {{company.name}}, {{company.phone}}, {{company.email}},
 * {{company.address}}, {{company.website}}.
 *
 *   GET   /v1/tenant-settings/company
 *   PATCH /v1/tenant-settings/company
 */

interface Payload {
  company_name: string | null
  company_phone: string | null
  company_email: string | null
  company_address: string | null
  company_website: string | null
  company_license_number: string | null
  timezone: string | null
  tenant_name: string | null
  cash_flow_manager_account_ids: string[]
}

interface TenantAccountRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string | null
  status: string | null
}

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
]

const inputCls =
  'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

export function SettingsCompanyPage() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['tenant-company'],
    queryFn: () => apiRequest<{ data: Payload }>('/v1/tenant-settings/company'),
  })

  const [form, setForm] = useState<Payload | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (query.data && form === null) {
      setForm(query.data.data)
    }
  }, [query.data, form])

  const save = useMutation({
    mutationFn: (payload: Partial<Payload>) =>
      apiRequest<{ data: Payload }>('/v1/tenant-settings/company', {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: (res) => {
      qc.setQueryData(['tenant-company'], res)
      setForm(res.data)
      setSavedAt(new Date())
    },
  })

  // Tenant-admin roster for the cash-flow-manager picker. MUST be called
  // before the early return below — otherwise this hook is skipped on the
  // first (form === null) render and runs on the next, which throws React
  // #310 "rendered more hooks than during the previous render".
  const accountsQ = useQuery({
    queryKey: ['tenant-accounts'],
    queryFn: () =>
      apiRequest<{ data: TenantAccountRow[] }>('/v1/tenant-accounts'),
  })

  if (!form) {
    return <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-500">Loading…</div>
  }

  const original = query.data?.data
  const dirty =
    !!original &&
    (form.company_name !== original.company_name ||
      form.company_phone !== original.company_phone ||
      form.company_email !== original.company_email ||
      form.company_address !== original.company_address ||
      form.company_website !== original.company_website ||
      form.company_license_number !== original.company_license_number ||
      form.timezone !== original.timezone ||
      JSON.stringify([...(form.cash_flow_manager_account_ids ?? [])].sort()) !==
        JSON.stringify([...(original.cash_flow_manager_account_ids ?? [])].sort()))

  const update = <K extends keyof Payload>(key: K, value: Payload[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const handleSave = () => {
    if (!form) return
    if (!form.timezone?.trim()) {
      window.alert('Choose a tenant timezone before saving.')
      return
    }
    save.mutate({
      company_name: form.company_name?.trim() || null,
      company_phone: form.company_phone?.trim() || null,
      company_email: form.company_email?.trim() || null,
      company_address: form.company_address?.trim() || null,
      company_website: form.company_website?.trim() || null,
      company_license_number: form.company_license_number?.trim() || null,
      timezone: form.timezone.trim(),
      cash_flow_manager_account_ids: form.cash_flow_manager_account_ids ?? [],
    })
  }

  // Anyone with status='active' can be picked; non-admin roles (dispatcher
  // / office / tech) are valid too — the office decides who handles cash.
  const accounts = (accountsQ.data?.data ?? []).filter((a) => a.status === 'active')

  function toggleCashFlowMgr(accountId: string) {
    setForm((f) => {
      if (!f) return f
      const cur = new Set(f.cash_flow_manager_account_ids ?? [])
      if (cur.has(accountId)) cur.delete(accountId)
      else cur.add(accountId)
      return { ...f, cash_flow_manager_account_ids: Array.from(cur) }
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 pb-32 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Company Info</h1>
        <p className="text-sm text-slate-500 mt-1">
          The contact info that appears on customer-facing documents via the{' '}
          <code className="text-[12px] bg-slate-100 px-1 rounded">{'{{company.*}}'}</code>{' '}
          merge tags. Empty fields render as empty strings in templates.
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Company name
          </label>
          <input
            type="text"
            value={form.company_name ?? ''}
            onChange={(e) => update('company_name', e.target.value)}
            placeholder={form.tenant_name ?? 'Your shop name'}
            className={inputCls}
            maxLength={200}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Leave blank to fall back to the tenant name (
            <span className="font-medium">{form.tenant_name ?? '—'}</span>).
            Surfaces as <code>{'{{company.name}}'}</code>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Phone
            </label>
            <input
              type="tel"
              value={form.company_phone ?? ''}
              onChange={(e) => update('company_phone', formatPhoneInput(e.target.value))}
              placeholder="(555) 555-1234"
              className={inputCls}
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={form.company_email ?? ''}
              onChange={(e) => update('company_email', e.target.value)}
              placeholder="hello@yourshop.com"
              className={inputCls}
              maxLength={255}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Address
          </label>
          <textarea
            value={form.company_address ?? ''}
            onChange={(e) => update('company_address', e.target.value)}
            placeholder={'123 Main St\nSpringfield, IL 62701'}
            rows={3}
            maxLength={1000}
            className={inputCls + ' resize-y'}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Free-form — line breaks are preserved when rendered.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Website
          </label>
          <input
            type="url"
            value={form.company_website ?? ''}
            onChange={(e) => update('company_website', e.target.value)}
            placeholder="https://yourshop.com"
            className={inputCls}
            maxLength={255}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Contractor license #
          </label>
          <input
            type="text"
            value={form.company_license_number ?? ''}
            onChange={(e) => update('company_license_number', e.target.value)}
            placeholder="EF20001234"
            className={inputCls}
            maxLength={80}
          />
          <p className="mt-1 text-xs text-slate-500">
            Shown to anyone who scans one of your asset tags. An inspector checking a fire door
            wants to see who services it and under what license — leave it blank and the tag just
            names your company.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Timezone
          </label>
          <input
            type="text"
            list="cb-timezones"
            value={form.timezone ?? ''}
            onChange={(e) => update('timezone', e.target.value)}
            placeholder="America/New_York"
            className={inputCls + ' max-w-md font-mono'}
            maxLength={64}
            required
          />
          <datalist id="cb-timezones">
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          <p className="text-[11px] text-slate-500 mt-1">
            Used as the default for date / time displays when a tenant-wide
            timezone is needed. Service-location timezones override this for jobs in another region.
          </p>
        </div>
      </section>

      {/* Cash flow managers — who can confirm tech-collected payments
          have been turned in. Anyone NOT on this list who tries to
          mark a pending_turnover payment received gets 403. Empty
          list falls back to "any owner/admin" so freshly-provisioned
          tenants aren't deadlocked. */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Cash flow managers</h2>
          <p className="text-xs text-slate-500 mt-1">
            Staff who are allowed to mark tech-collected payments as
            received (i.e., confirm the cash/check landed in the office).
            Pick everyone who physically handles deposits.
          </p>
        </div>
        {accountsQ.isLoading ? (
          <div className="text-xs text-slate-500">Loading staff…</div>
        ) : accounts.length === 0 ? (
          <div className="text-xs text-slate-500 italic">No active staff yet.</div>
        ) : (
          <div className="space-y-1.5">
            {accounts.map((a) => {
              const checked = (form.cash_flow_manager_account_ids ?? []).includes(a.id)
              const name = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email
              return (
                <label
                  key={a.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCashFlowMgr(a.id)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-900">{name}</span>
                  {a.role && (
                    <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                      {a.role}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 ml-1">{a.email}</span>
                </label>
              )
            })}
          </div>
        )}
        {(form.cash_flow_manager_account_ids ?? []).length === 0 && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Nobody picked — falling back to any owner/admin while this list is empty.
          </p>
        )}
      </section>

      {/* Sticky save bar */}
      <div
        className={[
          'sticky bottom-4 mx-auto bg-white border rounded-xl px-5 py-3 shadow-sm flex items-center justify-between',
          dirty ? 'border-amber-200 bg-amber-50' : 'border-slate-200',
        ].join(' ')}
      >
        <div className="text-xs text-slate-500">
          {save.isError ? (
            <span className="text-red-700">{(save.error as Error).message}</span>
          ) : savedAt && !dirty ? (
            <span className="text-emerald-700">✓ Saved {savedAt.toLocaleTimeString()}</span>
          ) : dirty ? (
            'Unsaved changes'
          ) : (
            'Up to date'
          )}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => setForm(query.data?.data ?? form)}
              disabled={save.isPending}
              className="text-sm px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || save.isPending || !form.timezone?.trim()}
            className="text-sm px-4 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-40"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
