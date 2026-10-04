import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '@/lib/api'
import type { Account } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useApplySeedPack, useCompleteOnboardingStep, useOnboardingStatus, useSeedPacks } from '@/hooks/useOnboarding'
import { buildOnboardingStages, firstOpenStage } from '@/components/onboarding/onboardingStages'
import { OnboardingNarratedTour } from '@/components/onboarding/OnboardingNarratedTour'
import { AiSetupStep } from '@/components/onboarding/steps/AiSetupStep'
import { BetaAgreementStep } from '@/components/onboarding/steps/BetaAgreementStep'
import { CommunicationsStep } from '@/components/onboarding/steps/CommunicationsStep'
import { CompanyProfileStep } from '@/components/onboarding/steps/CompanyProfileStep'
import { CompanyToolsStep } from '@/components/onboarding/steps/CompanyToolsStep'
import { CrewStep } from '@/components/onboarding/steps/CrewStep'
import { DataOwnershipStep } from '@/components/onboarding/steps/DataOwnershipStep'
import { StarterStockStep } from '@/components/onboarding/steps/StarterStockStep'
import type { StepProps } from '@/components/onboarding/steps/shared'
import type { CompleteOnboardingStepPayload } from '@/types/onboarding'

interface OnboardingOverlayProps {
  open: boolean
  onClose?: () => void
  startAtFirst?: boolean
}





export function OnboardingOverlay({ open, onClose, startAtFirst = false }: OnboardingOverlayProps) {
  const { account } = useAuth()
  const statusQuery = useOnboardingStatus(open)
  const packsQuery = useSeedPacks(open)
  const completeStep = useCompleteOnboardingStep()
  const applySeed = useApplySeedPack()
  const onboarding = statusQuery.data?.data
  const stages = useMemo(() => (onboarding ? buildOnboardingStages(onboarding) : []), [onboarding])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [selectedVertical, setSelectedVertical] = useState('generic')
  const [tradeLockConfirmed, setTradeLockConfirmed] = useState(false)

  useEffect(() => {
    if (!open || stages.length === 0) return
    const preferred = startAtFirst ? stages[0] : firstOpenStage(stages)
    setActiveKey((current) => {
      if (current && stages.some((stage) => stage.key === current)) return current
      return preferred.key
    })
  }, [open, stages, startAtFirst])

  useEffect(() => {
    if (!onboarding) return
    setSelectedVertical(onboarding.seed_state.vertical || onboarding.tenant.vertical || 'generic')
    setTradeLockConfirmed(Boolean(onboarding.seed_state.locked_at))
  }, [onboarding])

  if (!open) return null

  const activeStage = stages.find((stage) => stage.key === activeKey) ?? stages[0]
  const activeIndex = activeStage ? stages.findIndex((stage) => stage.key === activeStage.key) : -1
  const doneCount = stages.filter((stage) => stage.complete).length
  const tenantId = onboarding?.tenant.id
  const unavailable = onboardingUnavailableCopy(statusQuery.error, account)
  const packs = packsQuery.data?.data ?? onboarding?.seed_packs ?? []
  const isSaving = completeStep.isPending || applySeed.isPending

  function advance() {
    const next = stages[activeIndex + 1] ?? stages[activeIndex]
    if (next) setActiveKey(next.key)
  }

  function markStep(payload: CompleteOnboardingStepPayload = { choice: 'confirmed' }) {
    if (!activeStage || activeStage.locked || activeStage.key === 'beta_agreement' || activeStage.key === 'trade_seed') {
      return
    }
    completeStep.mutate(
      { step: activeStage.key, payload },
      {
        onSuccess: () => advance(),
      },
    )
  }

  function handleManualSetup() {
    if (tenantId) {
      window.localStorage.setItem(`crewbarn:onboarding:manual:${tenantId}`, '1')
    }
    markStep({ choice: 'manual' })
  }

  function handleApplySeed() {
    const vertical = selectedVertical || onboarding?.tenant.vertical || 'generic'
    applySeed.mutate({ vertical, confirmTradeLock: tradeLockConfirmed }, {
      onSuccess: () => advance(),
    })
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-navy-950/45 px-4 py-6 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center">
        <div className="max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="max-h-[calc(100vh-3rem)] overflow-y-auto border-r border-slate-200 bg-white p-6">
              <div data-tour="onboarding-intro">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                CrewBarn setup
              </div>
              <h2 className="mt-2 text-3xl font-bold text-navy-950">
                {onboarding ? `Launch ${onboarding.tenant.name}` : 'Launch the shop'}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                A short list, in order. Stop whenever you like and pick it up later — nothing here
                goes out to a customer until the last step.
              </p>
              <OnboardingNarratedTour />

              </div>
              {onboarding && (
                <div data-tour="onboarding-progress" className="mt-6">
                  {/* "25%" on its own tells you nothing you can act on. How many
                      are left does. */}
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-bold text-navy-900">
                      {doneCount === stages.length
                        ? 'All done'
                        : doneCount === 0
                          ? `${stages.length} steps`
                          : `${doneCount} of ${stages.length} done`}
                    </span>
                    {doneCount > 0 && doneCount < stages.length && (
                      <span className="text-xs text-slate-500">{stages.length - doneCount} to go</span>
                    )}
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round((doneCount / Math.max(1, stages.length)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/*
                A list, not twelve boxes.

                Every step used to be a bordered card carrying its own name
                ("Step 1") AND a number badge counting its position in the
                whole list — which includes the agreement row, so every badge
                sat one higher than the name beside it. Twelve near-identical
                boxes, each contradicting itself. The state now lives in one
                place, the dot, and the row says what the step is.
              */}
              <ol data-tour="onboarding-stages" className="mt-6 -mx-2">
                {stages.map((stage) => {
                  const current = stage.key === activeStage?.key
                  return (
                    <li key={stage.key}>
                      <button
                        type="button"
                        onClick={() => setActiveKey(stage.key)}
                        aria-current={current ? 'step' : undefined}
                        className={`flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                          current
                            ? 'bg-amber-50 shadow-[inset_3px_0_0_var(--accent-500,#E8902C)]'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            stage.complete
                              ? 'bg-emerald-500 text-white'
                              : stage.locked
                                ? 'border-[1.5px] border-slate-200 bg-slate-100 text-slate-400'
                                : current
                                  ? 'border-[5px] border-amber-500 bg-white'
                                  : 'border-[1.5px] border-slate-300 bg-white'
                          }`}
                        >
                          {stage.complete ? '✓' : ''}
                        </span>
                        <span className="min-w-0 grow">
                          <span
                            className={`block text-sm font-semibold ${
                              stage.complete ? 'text-slate-500' : stage.locked ? 'text-slate-400' : 'text-navy-950'
                            }`}
                          >
                            {stage.title}
                          </span>
                          {stage.locked && (
                            <span className="mt-0.5 block text-xs text-slate-400">
                              Opens once the steps above are done
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </aside>

            <main className="max-h-[calc(100vh-3rem)] min-h-[640px] overflow-y-auto bg-slate-50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {onboarding && (
                  <button
                    type="button"
                    onClick={() => setActiveKey(stages[0]?.key ?? activeStage?.key ?? null)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-navy-700 hover:border-amber-300 hover:text-amber-700"
                  >
                    Start over
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-navy-700 hover:border-amber-300 hover:text-amber-700"
                >
                  Close
                </button>
              </div>

              {statusQuery.isLoading ? (
                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8">
                  <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
                  <div className="mt-6 h-64 animate-pulse rounded-xl bg-slate-100" />
                </div>
              ) : !onboarding || !activeStage ? (
                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8">
                  <h3 className="text-xl font-bold text-navy-900">{unavailable.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{unavailable.message}</p>
                  {unavailable.actionPath && (
                    <Link
                      to={unavailable.actionPath}
                      onClick={onClose}
                      className="mt-5 inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      {unavailable.actionLabel}
                    </Link>
                  )}
                </div>
              ) : (
                <div className="mt-8 space-y-5">
                  <section data-tour="onboarding-current-stage" className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      {activeStage.eyebrow}
                    </div>
                    <h3 className="mt-2 text-3xl font-bold text-navy-900">{activeStage.title}</h3>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
                      {activeStage.detail}
                    </p>

                    {/*
                      These are facts about the step, not choices. As three
                      bordered boxes in a row they read as buttons, and the
                      first thing somebody does on a setup screen is press the
                      thing that looks pressable. A ticked list says "here is
                      what is true" and nothing else.
                    */}
                    <ul className="mt-5 space-y-2">
                      {activeStage.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2.5">
                          <span
                            aria-hidden
                            className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700"
                          >
                            ✓
                          </span>
                          <span className="text-[15px] leading-relaxed text-slate-700">{bullet}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7">
                      {activeStage.key === 'trade_seed' ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <label className="text-sm font-semibold text-navy-900" htmlFor="overlay-seed-pack">
                            Trade starter pack
                          </label>
                          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                            <select
                              id="overlay-seed-pack"
                              value={selectedVertical}
                              onChange={(event) => {
                                setSelectedVertical(event.target.value)
                                if (!onboarding.seed_state.locked_at) {
                                  setTradeLockConfirmed(false)
                                }
                              }}
                              disabled={activeStage.locked || activeStage.complete || isSaving}
                              className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-900"
                            >
                              {packs.map((pack) => (
                                <option key={pack.key} value={pack.key}>
                                  {pack.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleApplySeed}
                              disabled={activeStage.locked || activeStage.complete || isSaving || !tradeLockConfirmed}
                              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
                            >
                              {activeStage.complete ? 'Seed applied' : isSaving ? 'Applying...' : 'Apply seed'}
                            </button>
                          </div>
                          {!activeStage.complete && (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                              <div className="text-sm font-bold text-amber-950">Are you sure?</div>
                              <p className="mt-1 text-sm leading-6 text-amber-900">
                                Your primary trade cannot be changed after setup. This choice controls CrewBarn&apos;s trade-specific setup, templates, inventory, automations, and AI matching behavior.
                              </p>
                              <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-950">
                                <input
                                  type="checkbox"
                                  checked={tradeLockConfirmed}
                                  onChange={(event) => setTradeLockConfirmed(event.target.checked)}
                                  disabled={activeStage.locked || isSaving}
                                  className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                />
                                <span>I understand this trade will be locked after setup.</span>
                              </label>
                            </div>
                          )}
                          <p className="mt-3 text-sm text-slate-600">
                            This writes starter statuses, job types, catalog rows, locations, and fields for this tenant.
                          </p>
                          {onboarding.seed_state.locked_at && (
                            <p className="mt-2 text-sm font-semibold text-emerald-700">
                              Primary trade locked {new Date(onboarding.seed_state.locked_at).toLocaleString()}.
                            </p>
                          )}
                        </div>
                      ) : (
                        <StageActionButtons
                          stageKey={activeStage.key}
                          complete={activeStage.complete}
                          locked={activeStage.locked}
                          saving={isSaving}
                          onboarding={onboarding}
                          onManualSetup={handleManualSetup}
                          onMarkStep={markStep}
                          onGateSaved={advance}
                        />
                      )}
                      {(completeStep.error || applySeed.error) && (
                        <p className="mt-3 text-sm font-semibold text-red-700">
                          {(completeStep.error as Error | null)?.message ||
                            (applySeed.error as Error | null)?.message ||
                            'Onboarding could not save this step.'}
                        </p>
                      )}
                    </div>
                  </section>

                  {/*
                    Moving about, not doing the step.

                    These were two bordered buttons the same size and weight as
                    the step's own Save, which made four things competing to be
                    pressed and no way to tell which one finishes the step.
                    "Next" in particular looked like the way forward when it
                    only skips — the step's own amber button is what saves. So
                    they are quiet text now: still there, still reachable by
                    keyboard, no longer shouting over the thing that matters.
                  */}
                  <div data-tour="onboarding-stage-navigation" className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      disabled={activeIndex <= 0}
                      onClick={() => setActiveKey(stages[Math.max(0, activeIndex - 1)]?.key ?? activeStage.key)}
                      className="text-sm font-semibold text-slate-500 hover:text-navy-900 disabled:pointer-events-none disabled:opacity-0"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      disabled={activeIndex >= stages.length - 1}
                      onClick={() => setActiveKey(stages[Math.min(stages.length - 1, activeIndex + 1)]?.key ?? activeStage.key)}
                      className="text-sm font-semibold text-slate-500 hover:text-navy-900 disabled:pointer-events-none disabled:opacity-0"
                    >
                      Skip for now →
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}


/**
 * Which step to show.
 *
 * This was a 1,400-line function holding all eight step bodies and every
 * piece of their state — thirty useState calls, four effects and six queries,
 * all mounted whatever step you were on. Each step is its own component now,
 * so a step's state exists only while that step is on screen, and the next
 * one to be rebuilt can be rebuilt on its own.
 *
 * Four steps have no body of their own — the trade pack, the pricebook,
 * automations and the final review all send you to a real page and come back.
 * They fall through to the confirm button, which is what they always did.
 */
export function StageActionButtons(props: StepProps & { stageKey: string }) {
  const { stageKey, complete, locked, saving, onMarkStep } = props

  if (stageKey === 'beta_agreement') return <BetaAgreementStep {...props} />

  // Ordered guards, not decoration. In the old function these sat BETWEEN the
  // branches, and where they sat is what they mean: `locked` came after the
  // agreement, so it covers every step but that one, and `complete` came after
  // staff, so it covers only communications and the steps with no body of
  // their own. Moving either one would quietly change which steps it governs.
  if (locked) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600">
        Finish the steps above first — this one opens as soon as they are done.
      </div>
    )
  }

  if (stageKey === 'ai_setup') return <AiSetupStep {...props} />
  if (stageKey === 'data_ownership') return <DataOwnershipStep {...props} />
  if (stageKey === 'company_profile') return <CompanyProfileStep {...props} />
  if (stageKey === 'company_assets') return <CompanyToolsStep {...props} />
  if (stageKey === 'inventory_layout') return <StarterStockStep {...props} />
  if (stageKey === 'staff') return <CrewStep {...props} />

  if (complete) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
        <span className="font-bold">This one is done.</span> You can come back and change it whenever you like.
      </div>
    )
  }

  if (stageKey === 'communications') return <CommunicationsStep {...props} />

  return (
    <button
      type="button"
      onClick={() => onMarkStep({ choice: 'confirmed_for_now' })}
      disabled={saving}
      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
    >
      {saving ? 'Saving...' : 'Confirm this setup gate'}
    </button>
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


