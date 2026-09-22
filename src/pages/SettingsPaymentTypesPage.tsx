import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'

/**
 * Tool Shed → Payment types. Which payment methods the web + mobile payment
 * forms offer: toggle built-ins off, add custom types (Zelle, Venmo, house
 * account, …). Flow-driven methods (Stripe charge, Tap to Pay, credit
 * application) always arrive through their own flows and aren't listed here.
 */

interface BuiltIn {
  value: string
  label: string
  disabled: boolean
}

interface CustomMethod {
  value?: string
  label: string
}

interface Config {
  built_ins: BuiltIn[]
  custom: CustomMethod[]
}

export function SettingsPaymentTypesPage() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['payment-method-settings'],
    queryFn: () => apiRequest<{ data: Config }>('/v1/settings/payment-methods'),
  })

  const [draft, setDraft] = useState<Config | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const cfg = draft ?? q.data?.data ?? null

  const save = useMutation({
    mutationFn: (c: Config) =>
      apiRequest<{ data: Config }>('/v1/settings/payment-methods', {
        method: 'PUT',
        body: {
          disabled: c.built_ins.filter((b) => b.disabled).map((b) => b.value),
          custom: c.custom,
        },
      }),
    onSuccess: (res) => {
      setDraft(null)
      qc.setQueryData(['payment-method-settings'], res)
      qc.invalidateQueries({ queryKey: ['payment-methods'] })
    },
  })

  const mutate = (fn: (c: Config) => Config) => {
    if (!cfg) return
    setDraft(fn(structuredClone(cfg)))
  }

  const addCustom = () => {
    const label = newLabel.trim()
    if (!label) return
    mutate((c) => ({ ...c, custom: [...c.custom, { label }] }))
    setNewLabel('')
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-5">
        <Link to="/tool-shed" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline mb-1">
          ← Tool Shed
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Payment types</h1>
        <p className="text-sm text-slate-500 mt-1">
          What the payment forms offer — on the web and in the crew app. Turn off types you never
          take; add the ones you do (Zelle, Venmo, house account…).
        </p>
        <p className="text-sm text-slate-500 mt-1">
          These are for recording a payment by hand. Card processors, bank transfers customers can
          pay from the portal, and the watched bank account live under{' '}
          <Link to="/tool-shed/payments" className="font-semibold text-amber-700 hover:underline">Payments</Link>.
        </p>
      </div>

      {q.isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      {cfg && (
        <>
          <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Built-in types</h2>
            <ul className="divide-y divide-slate-100">
              {cfg.built_ins.map((b) => (
                <li key={b.value} className="flex items-center justify-between py-2.5">
                  <span className={`text-sm ${b.disabled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {b.label}
                    {b.value === 'ach' && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        recorded by hand or matched from your bank feed — customer-facing setup is under Payments
                      </span>
                    )}
                    {(b.value === 'card_manual' || b.value === 'godaddy') && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        hidden in the crew app once a card processor is connected
                      </span>
                    )}
                  </span>
                  {b.value === 'other' ? (
                    <span className="text-xs text-slate-400">always on</span>
                  ) : (
                    <button
                      onClick={() =>
                        mutate((c) => ({
                          ...c,
                          built_ins: c.built_ins.map((x) =>
                            x.value === b.value ? { ...x, disabled: !x.disabled } : x,
                          ),
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        b.disabled ? 'bg-slate-200' : 'bg-emerald-500'
                      }`}
                      aria-label={`Toggle ${b.label}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          b.disabled ? 'translate-x-1' : 'translate-x-6'
                        }`}
                      />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Custom types</h2>
            {cfg.custom.length === 0 && (
              <p className="text-sm text-slate-400 mb-3">None yet — add the ways your customers actually pay.</p>
            )}
            <ul className="divide-y divide-slate-100 mb-3">
              {cfg.custom.map((c, i) => (
                <li key={`${c.value ?? c.label}-${i}`} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-800">{c.label}</span>
                  <button
                    onClick={() => mutate((cf) => ({ ...cf, custom: cf.custom.filter((_, j) => j !== i) }))}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                placeholder="e.g. Zelle"
                maxLength={40}
                className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm"
              />
              <button
                onClick={addCustom}
                disabled={!newLabel.trim()}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                + Add
              </button>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              onClick={() => cfg && save.mutate(cfg)}
              disabled={!draft || save.isPending}
              className="px-4 py-2 text-sm font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
            >
              {save.isPending ? 'Saving…' : 'Save changes'}
            </button>
            {draft && !save.isPending && (
              <button onClick={() => setDraft(null)} className="text-sm text-slate-500 hover:underline">
                Discard
              </button>
            )}
            {save.isError && <span className="text-sm text-red-600">Could not save — try again.</span>}
          </div>
        </>
      )}
    </div>
  )
}
