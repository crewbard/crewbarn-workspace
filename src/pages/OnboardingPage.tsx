import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '@/lib/api'
import type { Account } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import {
  useApplySeedPack,
  useCompleteOnboardingStep,
  useOnboardingStatus,
  useSeedPackPreview,
  useSeedPacks,
} from '@/hooks/useOnboarding'
import { OnboardingOverlay, StageActionButtons } from '@/components/onboarding/OnboardingOverlay'
import {
  buildOnboardingStages,
  firstOpenStage,
  type OnboardingStage,
} from '@/components/onboarding/onboardingStages'
import type { CompleteOnboardingStepPayload, OnboardingSeedPackSummary } from '@/types/onboarding'

export function OnboardingPage() {
  const { account } = useAuth()
  const statusQuery = useOnboardingStatus()
  const packsQuery = useSeedPacks()
  const onboarding = statusQuery.data?.data
  const stages = useMemo(() => (onboarding ? buildOnboardingStages(onboarding) : []), [onboarding])
  const packs = packsQuery.data?.data ?? onboarding?.seed_packs ?? []
  // Trades are the front door: the owner picks a trade, which resolves to the
  // seed pack that gets applied. Falls back to the raw pack picker if no trades
  // are configured (e.g. before the trades migration runs).
  const trades = onboarding?.trades ?? []
  const useTradeMode = trades.length > 0
  const initialVertical = onboarding?.seed_state.vertical || onboarding?.tenant.vertical || 'generic'
  const [selectedVertical, setSelectedVertical] = useState(initialVertical)
  const [selectedTradeSlug, setSelectedTradeSlug] = useState('')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(true)
  const [manualMode, setManualMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tradeLockConfirmed, setTradeLockConfirmed] = useState(false)
  const previewQuery = useSeedPackPreview(selectedVertical)
  const applySeed = useApplySeedPack()
  const completeStep = useCompleteOnboardingStep()

  useEffect(() => {
    if (!onboarding) return
    const tradeList = onboarding.trades ?? []
    const seedVertical = onboarding.seed_state.vertical || onboarding.tenant.vertical || 'generic'
    if (tradeList.length > 0) {
      const slug =
        onboarding.seed_state.trade ||
        tradeList.find((t) => t.pack_key === seedVertical)?.slug ||
        tradeList[0]?.slug ||
        ''
      setSelectedTradeSlug(slug)
      const tr = tradeList.find((t) => t.slug === slug)
      setSelectedVertical(tr?.pack_key ?? seedVertical)
    } else {
      setSelectedVertical(seedVertical)
    }
    setTradeLockConfirmed(Boolean(onboarding.seed_state.locked_at))
  }, [onboarding])

  useEffect(() => {
    if (!onboarding?.tenant.id) return
    setManualMode(window.localStorage.getItem(`crewbarn:onboarding:manual:${onboarding.tenant.id}`) === '1')
  }, [onboarding?.tenant.id])

  useEffect(() => {
    if (stages.length === 0) return
    setActiveKey((current) => current ?? firstOpenStage(stages).key)
  }, [stages])

  const activeStage = stages.find((stage) => stage.key === activeKey) ?? stages[0]
  const activeIndex = activeStage ? stages.findIndex((stage) => stage.key === activeStage.key) : -1
  const activePack = useMemo(
    () => packs.find((pack) => pack.key === selectedVertical) ?? packs[0],
    [packs, selectedVertical],
  )
  const selectedTrade = trades.find((t) => t.slug === selectedTradeSlug)
  const preview = previewQuery.data?.data
  const betaLocked = !!onboarding && onboarding.beta_agreement.required && !onboarding.beta_agreement.accepted
  const unavailable = onboardingUnavailableCopy(statusQuery.error, account)

  function handleManualMode() {
    if (onboarding?.tenant.id) {
      window.localStorage.setItem(`crewbarn:onboarding:manual:${onboarding.tenant.id}`, '1')
    }
    setManualMode(true)
    markStep({ choice: 'manual' })
  }

  function advance() {
    const next = stages[activeIndex + 1] ?? stages[activeIndex]
    if (next) setActiveKey(next.key)
  }

  function markStep(payload: CompleteOnboardingStepPayload = { choice: 'confirmed' }) {
    if (!activeStage || activeStage.locked || activeStage.key === 'beta_agreement' || activeStage.key === 'trade_seed') {
      return
    }
    setError(null)
    completeStep.mutate(
      { step: activeStage.key, payload },
      {
        onSuccess: () => advance(),
        onError: (err) => {
          setError(err instanceof Error ? err.message : String(err))
        },
      },
    )
  }

  function handleApplySeed() {
    if (!selectedVertical) return
    setError(null)
    applySeed.mutate({ vertical: selectedVertical, trade: useTradeMode ? selectedTradeSlug : null, confirmTradeLock: tradeLockConfirmed }, {
      onSuccess: () => advance(),
      onError: (err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err),
        )
      },
    })
  }

  if (statusQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="mt-6 h-[520px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    )
  }

  if (!onboarding || !activeStage) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold text-navy-900">{unavailable.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{unavailable.message}</p>
        {unavailable.actionPath && (
          <Link
            to={unavailable.actionPath}
            className="mt-5 inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            {unavailable.actionLabel}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <OnboardingOverlay open={overlayOpen} onClose={() => setOverlayOpen(false)} startAtFirst />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-7">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                AI-first onboarding
              </div>
              <h1 className="mt-2 text-4xl font-bold tracking-normal text-navy-900">
                Set up {onboarding.tenant.name} without the empty-screen grind
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">
                CrewBarn walks the owner through one decision at a time. Connect AI or go manual,
                seed the trade, confirm tools and inventory, invite the crew, then review before launch.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setOverlayOpen(true)}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Open guided setup
                </button>
                <button
                  type="button"
                  onClick={() => setActiveKey(firstOpenStage(stages).key)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:border-amber-300"
                >
                  Continue current gate
                </button>
              </div>
            </div>
            <div className="border-t border-slate-200 bg-navy-950 p-7 text-white lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Launch readiness</span>
                <span>{onboarding.progress_percent}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${onboarding.progress_percent}%` }}
                />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Tools" value={onboarding.counts.company_assets ?? 0} />
                <Metric label="Staff" value={onboarding.counts.staff_accounts ?? 0} />
                <Metric label="Locations" value={onboarding.counts.inventory_locations ?? 0} />
                <Metric label="Catalog" value={onboarding.counts.catalog_items ?? 0} />
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {stages.map((stage, index) => (
              <button
                key={stage.key}
                type="button"
                onClick={() => setActiveKey(stage.key)}
                className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition ${
                  stage.key === activeStage.key
                    ? 'border-amber-300 ring-2 ring-amber-100'
                    : 'border-slate-200 hover:border-amber-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {stage.eyebrow}
                    </div>
                    <div className="mt-1 text-base font-bold text-navy-900">{stage.title}</div>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{stage.summary}</p>
                  </div>
                  <StatusPill stage={stage} index={index + 1} />
                </div>
              </button>
            ))}
          </aside>

          <main className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    {activeStage.eyebrow}
                  </div>
                  <h2 className="mt-2 text-3xl font-bold text-navy-900">{activeStage.title}</h2>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">
                    {activeStage.detail}
                  </p>
                </div>
                <StatusPill stage={activeStage} index={activeIndex + 1} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                {activeStage.bullets.map((bullet) => (
                  <div key={bullet} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-navy-900">{bullet}</div>
                  </div>
                ))}
              </div>

              <div className="mt-7">
                {activeStage.key === 'trade_seed' ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    Use the trade seed preview below. Applying the seed writes real starter data into this tenant.
                  </div>
                ) : (
                  <StageActionButtons
                    stageKey={activeStage.key}
                    complete={activeStage.complete}
                    locked={activeStage.locked}
                    saving={completeStep.isPending}
                    onboarding={onboarding}
                    onManualSetup={handleManualMode}
                    onMarkStep={markStep}
                    onGateSaved={advance}
                  />
                )}
              </div>
              {error && activeStage.key !== 'trade_seed' && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {manualMode && activeStage.key === 'ai_setup' && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Manual setup is active for this browser. AI can still be connected later.
                </div>
              )}

              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={activeIndex <= 0}
                  onClick={() => setActiveKey(stages[Math.max(0, activeIndex - 1)]?.key ?? activeStage.key)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= stages.length - 1}
                  onClick={() => setActiveKey(stages[Math.min(stages.length - 1, activeIndex + 1)]?.key ?? activeStage.key)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </section>

            {activeStage.key === 'trade_seed' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-navy-900">Trade seed preview</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Pick the starting point, review what gets created, then apply it.
                    </p>
                  </div>
                  {onboarding.seed_state.applied_at && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Seed applied
                    </span>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {useTradeMode ? 'Trade' : 'Trade pack'}
                    </label>
                    <select
                      value={useTradeMode ? selectedTradeSlug : selectedVertical}
                      onChange={(e) => {
                        if (useTradeMode) {
                          const slug = e.target.value
                          setSelectedTradeSlug(slug)
                          const tr = trades.find((t) => t.slug === slug)
                          setSelectedVertical(tr?.pack_key ?? 'generic')
                        } else {
                          setSelectedVertical(e.target.value)
                        }
                        if (!onboarding.seed_state.locked_at) {
                          setTradeLockConfirmed(false)
                        }
                      }}
                      disabled={Boolean(onboarding.seed_state.locked_at)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      {useTradeMode
                        ? trades.map((t) => (
                            <option key={t.slug} value={t.slug}>
                              {t.icon ? `${t.icon} ` : ''}
                              {t.name}
                            </option>
                          ))
                        : packs.map((pack) => (
                            <option key={pack.key} value={pack.key}>
                              {pack.label}
                            </option>
                          ))}
                    </select>
                    {useTradeMode && selectedTrade && (
                      <p className="text-xs text-slate-500">
                        Applies the{' '}
                        <span className="font-semibold text-navy-800">{selectedTrade.pack_label}</span> seed pack
                        {selectedTrade.linked
                          ? '.'
                          : ' — this trade isn’t linked to a pack yet, so the generic starter is used. Link it in Admin → Trades.'}
                      </p>
                    )}
                    {activePack && <PackSummary pack={activePack} />}
                    <button
                      type="button"
                      onClick={handleApplySeed}
                      disabled={betaLocked || applySeed.isPending || !selectedVertical || !tradeLockConfirmed}
                      className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {applySeed.isPending ? 'Applying seed...' : 'Apply selected seed'}
                    </button>
                    {!onboarding.seed_state.locked_at && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-sm font-bold text-amber-950">Are you sure?</div>
                        <p className="mt-1 text-sm leading-6 text-amber-900">
                          Your primary trade cannot be changed after setup. This choice controls CrewBarn&apos;s trade-specific setup, templates, inventory, automations, and AI matching behavior.
                        </p>
                        <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-950">
                          <input
                            type="checkbox"
                            checked={tradeLockConfirmed}
                            onChange={(event) => setTradeLockConfirmed(event.target.checked)}
                            disabled={applySeed.isPending}
                            className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span>I understand this trade will be locked after setup.</span>
                        </label>
                      </div>
                    )}
                    {onboarding.seed_state.locked_at && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                        Primary trade locked {new Date(onboarding.seed_state.locked_at).toLocaleString()}.
                      </div>
                    )}
                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {error}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {preview?.label ?? activePack?.label ?? 'Preview'}
                      </div>
                      {previewQuery.isFetching && <span className="text-xs text-slate-500">Loading...</span>}
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                      <PreviewList title="Job types" rows={preview?.job_types} />
                      <PreviewList title="Service categories" rows={preview?.service_categories} />
                      <PreviewList title="Products" rows={preview?.product_items} />
                      <PreviewList title="Inventory locations" rows={preview?.inventory_locations} />
                      <PreviewList title="Asset types" rows={preview?.asset_types} />
                      <PreviewList title="Custom fields" rows={preview?.custom_fields} />
                    </div>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function onboardingUnavailableCopy(
  error: unknown,
  account: Account | null,
): { title: string; message: string; actionPath?: string; actionLabel?: string } {
  if (error instanceof ApiError) {
    if (error.code === 'no_acting_tenant') {
      if (account?.is_platform_admin) {
        return {
          title: 'Choose a tenant to onboard',
          message: 'Use the CrewBarn admin tenant banner, then reopen onboarding for that shop.',
          actionPath: '/admin/tenants',
          actionLabel: 'Open tenants',
        }
      }

      return {
        title: 'Tenant link missing',
        message: error.message || 'This account is not linked to an active tenant. Contact your CrewBarn administrator.',
      }
    }

    return {
      title: 'Onboarding could not load',
      message: error.message || `Request failed with status ${error.status}.`,
    }
  }

  if (account?.tenant) {
    return {
      title: 'Onboarding could not load',
      message: `CrewBarn could not load onboarding for ${account.tenant.name}. Refresh the page or check the API logs if this keeps happening.`,
    }
  }

  return {
    title: 'Tenant link missing',
    message: 'This login is not linked to a shop account yet. Contact your CrewBarn administrator.',
  }
}

function StatusPill({ stage, index }: { stage: OnboardingStage; index: number }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
        stage.complete
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : stage.locked
            ? 'border-slate-200 bg-slate-50 text-slate-500'
            : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      {stage.complete ? 'Done' : stage.locked ? 'Locked' : `Step ${index}`}
    </span>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-300">{label}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  )
}

function PackSummary({ pack }: { pack: OnboardingSeedPackSummary }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-navy-900">{pack.label}</div>
      <p className="mt-1 text-xs leading-5 text-slate-600">{pack.description}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniCount label="Job types" value={pack.counts.job_types} />
        <MiniCount label="Assets" value={pack.counts.asset_types} />
        <MiniCount label="Catalog" value={pack.counts.service_items + pack.counts.product_items} />
        <MiniCount label="Fields" value={pack.counts.custom_fields} />
      </div>
    </div>
  )
}

function PreviewList({ title, rows }: { title: string; rows?: Array<Record<string, unknown>> }) {
  const names = (rows ?? []).slice(0, 8).map((row) => String(row.name ?? row.label ?? row.key ?? 'Seed item'))
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</div>
      <ul className="mt-2 space-y-1">
        {names.length > 0 ? (
          names.map((name) => (
            <li key={name} className="rounded border border-slate-100 bg-white px-2 py-1 text-sm text-slate-700">
              {name}
            </li>
          ))
        ) : (
          <li className="text-sm text-slate-400">No starter rows.</li>
        )}
      </ul>
    </div>
  )
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-navy-900">{value}</div>
    </div>
  )
}
