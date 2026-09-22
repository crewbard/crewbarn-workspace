import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, ApiError, apiRequest, getStoredToken } from '@/lib/api'
import { BetaAgreement } from '@/components/onboarding/BetaAgreement'
import type { Account } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import {
  useApplySeedPack,
  useCompleteOnboardingStep,
  useInviteOnboardingStaff,
  useOnboardingStatus,
  useOnboardingStaff,
  useSeedOnboardingCompanyAssets,
  useSeedOnboardingInventoryStock,
  useSeedPacks,
} from '@/hooks/useOnboarding'
import { buildOnboardingStages, firstOpenStage } from '@/components/onboarding/onboardingStages'
import { HostedNumberSection } from '@/components/comms/HostedNumberSection'
import type { CompleteOnboardingStepPayload, InviteOnboardingStaffResponse, OnboardingStatus } from '@/types/onboarding'
import { AI_PROVIDER_LABELS, aiModelOptionsFor, isKnownAiModel, type AiProvider } from '@/lib/aiModels'
import {
  COMPANY_ASSET_CATEGORIES,
  COMPANY_ASSET_CATEGORY_LABELS,
  type CompanyAssetCategory,
} from '@/types/companyAsset'

interface OnboardingOverlayProps {
  open: boolean
  onClose?: () => void
  startAtFirst?: boolean
}

interface OnboardingAssetDraft {
  selected: boolean
  name: string
  category: CompanyAssetCategory
  capabilities: string[]
  notes: string
  source_seed_key: string | null
}

interface OnboardingStockDraft {
  selected: boolean
  name: string
  category: string
  sku: string
  quantity: number
  reorder_threshold: number | null
  reorder_quantity: number | null
  notes: string
  source_seed_key: string | null
}

interface BrandPayload {
  logo_url: string | null
  brand_primary_color: string | null
}

const BRAND_COLOR_PRESETS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#0f172a']

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
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                CrewBarn setup
              </div>
              <h2 className="mt-2 text-3xl font-bold text-navy-950">
                {onboarding ? `Launch ${onboarding.tenant.name}` : 'Launch the shop'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                One focused path: connect AI, seed the trade, confirm tools, invite the crew,
                then go live with fewer blank screens.
              </p>

              {onboarding && (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                    <span>Setup progress</span>
                    <span>{onboarding.progress_percent}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-amber-100">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${onboarding.progress_percent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-2">
                {stages.map((stage, index) => (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => setActiveKey(stage.key)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                      stage.key === activeStage?.key
                        ? 'border-amber-300 bg-amber-50 text-navy-950 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {stage.eyebrow}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          stage.complete
                            ? 'bg-emerald-100 text-emerald-700'
                            : stage.locked
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {stage.complete ? 'Done' : stage.locked ? 'Locked' : index + 1}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-navy-950">{stage.title}</div>
                  </button>
                ))}
              </div>
            </aside>

            <main className="max-h-[calc(100vh-3rem)] min-h-[640px] overflow-y-auto bg-slate-50 p-6">
              <div className="flex items-center justify-between gap-3">
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
                  <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      {activeStage.eyebrow}
                    </div>
                    <h3 className="mt-2 text-3xl font-bold text-navy-900">{activeStage.title}</h3>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
                      {activeStage.detail}
                    </p>

                    <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                      {activeStage.bullets.map((bullet) => (
                        <div key={bullet} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-sm font-semibold text-navy-900">{bullet}</div>
                        </div>
                      ))}
                    </div>

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

                  <div className="flex items-center justify-between">
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
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StageActionButtons({
  stageKey,
  complete,
  locked,
  saving,
  onboarding,
  onManualSetup,
  onMarkStep,
  onGateSaved,
}: {
  stageKey: string
  complete: boolean
  locked: boolean
  saving: boolean
  onboarding: OnboardingStatus
  onManualSetup: () => void
  onMarkStep: (payload?: CompleteOnboardingStepPayload) => void
  onGateSaved?: () => void
}) {
  const qc = useQueryClient()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const seedCompanyAssets = useSeedOnboardingCompanyAssets()
  const seedInventoryStock = useSeedOnboardingInventoryStock()
  const staffQuery = useOnboardingStaff(stageKey === 'staff')
  const inviteStaff = useInviteOnboardingStaff()
  const { role_slug: actorRoleSlug } = usePermissions()
  const [aiProvider, setAiProvider] = useState<AiProvider>('anthropic')
  const [aiKey, setAiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [useCustomAiModel, setUseCustomAiModel] = useState(false)
  const [transcriptionKey, setTranscriptionKey] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [ownershipMode, setOwnershipMode] = useState<'byo' | 'crewbarn_managed'>('byo')
  const [r2AccountId, setR2AccountId] = useState('')
  const [r2Bucket, setR2Bucket] = useState('')
  const [r2Endpoint, setR2Endpoint] = useState('')
  const [r2AccessKeyId, setR2AccessKeyId] = useState('')
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('')
  const [r2PublicBaseUrl, setR2PublicBaseUrl] = useState('')
  const [googleMapsKey, setGoogleMapsKey] = useState('')
  const [mapsDomain, setMapsDomain] = useState('')
  const [ownershipError, setOwnershipError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState(onboarding.company.company_name || onboarding.tenant.name || '')
  const [companyPhone, setCompanyPhone] = useState(onboarding.company.company_phone || '')
  const [companyEmail, setCompanyEmail] = useState(onboarding.company.company_email || '')
  const [companyAddress, setCompanyAddress] = useState(onboarding.company.company_address || '')
  const [companyWebsite, setCompanyWebsite] = useState(onboarding.company.company_website || '')
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [brandColor, setBrandColor] = useState('')
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [assetDrafts, setAssetDrafts] = useState<OnboardingAssetDraft[]>([])
  const [assetError, setAssetError] = useState<string | null>(null)
  const [stockDrafts, setStockDrafts] = useState<OnboardingStockDraft[]>([])
  const [stockError, setStockError] = useState<string | null>(null)
  const [staffFirstName, setStaffFirstName] = useState('')
  const [staffLastName, setStaffLastName] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffRoleSlug, setStaffRoleSlug] = useState('')
  const [staffError, setStaffError] = useState<string | null>(null)
  const [lastInvite, setLastInvite] = useState<InviteOnboardingStaffResponse | null>(null)
  const [hostedNumberReady, setHostedNumberReady] = useState(false)
  const assetRecommendations = useMemo(
    () => onboarding.company_asset_recommendations ?? [],
    [onboarding.company_asset_recommendations],
  )
  const stockRecommendations = useMemo(
    () => onboarding.inventory_stock_recommendations ?? [],
    [onboarding.inventory_stock_recommendations],
  )
  const intelligenceSource = onboarding.seed_intelligence?.source ?? 'curated'
  const intelligenceLabel =
    intelligenceSource === 'ai'
      ? 'AI-tailored'
      : intelligenceSource === 'curated'
        ? 'Curated trade research'
        : 'Starter pack'
  const aiModelOptions = aiModelOptionsFor(aiProvider)
  const staffRoles = (staffQuery.data?.roles ?? []).filter(
    (role) => actorRoleSlug === 'owner' || role.role_slug !== 'owner',
  )
  const staffMembers = staffQuery.data?.data ?? []
  const aiModelSelectValue =
    useCustomAiModel ? '__custom' : !aiModel ? '__default' : isKnownAiModel(aiProvider, aiModel) ? aiModel : '__custom'
  const brandQuery = useQuery({
    queryKey: ['tenant-brand'],
    queryFn: () => apiRequest<{ data: BrandPayload }>('/v1/tenant-settings/brand'),
    enabled: stageKey === 'company_profile',
  })
  const savedBrand = brandQuery.data?.data
  const savedBrandColor = savedBrand?.brand_primary_color ?? ''
  const logoUrl = savedBrand?.logo_url ?? null
  const previewColor = brandColor || savedBrandColor || '#f59e0b'
  const colorInputValue = /^#[0-9a-fA-F]{6}$/.test(previewColor) ? previewColor : '#f59e0b'
  const colorDirty = !!brandColor && brandColor.toLowerCase() !== savedBrandColor.toLowerCase()
  const saveBrandColor = useMutation({
    mutationFn: (next: string | null) =>
      apiRequest<{ data: BrandPayload }>('/v1/tenant-settings/brand', {
        method: 'PATCH',
        body: { brand_primary_color: next },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-brand'] }),
  })
  const deleteLogo = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { logo_url: null } }>('/v1/tenant-settings/brand/logo', {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-brand'] }),
  })

  function handleAiProviderChange(nextProvider: AiProvider) {
    setAiProvider(nextProvider)
    setUseCustomAiModel(false)
    setAiModel((current) => (current && isKnownAiModel(nextProvider, current) ? current : ''))
  }

  const recommendationKey = useMemo(
    () => assetRecommendations.map((asset) => `${asset.source_seed_key}:${asset.name}`).join('|'),
    [assetRecommendations],
  )
  const stockRecommendationKey = useMemo(
    () => stockRecommendations.map((item) => `${item.source_seed_key}:${item.name}`).join('|'),
    [stockRecommendations],
  )

  useEffect(() => {
    if (stageKey !== 'company_assets') return
    setAssetDrafts(
      assetRecommendations.map((asset) => ({
        selected: true,
        name: asset.name,
        category: asset.category,
        capabilities: asset.capabilities,
        notes: asset.notes || '',
        source_seed_key: asset.source_seed_key,
      })),
    )
    setAssetError(null)
  }, [recommendationKey, stageKey, assetRecommendations])

  useEffect(() => {
    if (stageKey !== 'inventory_layout') return
    setStockDrafts(
      stockRecommendations.map((item) => ({
        selected: true,
        name: item.name,
        category: item.category,
        sku: item.sku || '',
        quantity: Number(item.recommended_quantity ?? 0),
        reorder_threshold: item.reorder_threshold,
        reorder_quantity: item.reorder_quantity,
        notes: item.notes || '',
        source_seed_key: item.source_seed_key,
      })),
    )
    setStockError(null)
  }, [stockRecommendationKey, stageKey, stockRecommendations])

  useEffect(() => {
    if (stageKey !== 'staff' || staffRoleSlug || staffRoles.length === 0) return
    const preferredRole =
      staffRoles.find((role) => role.role_slug === 'tech') ??
      staffRoles.find((role) => role.role_slug === 'dispatcher') ??
      staffRoles[0]
    setStaffRoleSlug(preferredRole.role_slug)
  }, [stageKey, staffRoleSlug, staffRoles])

  useEffect(() => {
    if (stageKey !== 'company_profile') return
    setBrandColor((current) => current || savedBrandColor || '#f59e0b')
  }, [stageKey, savedBrandColor])

  if (stageKey === 'beta_agreement') {
    return <BetaAgreement onAccepted={onGateSaved} />
  }

  if (locked) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Complete the earlier gate before this step can write setup data.
      </div>
    )
  }

  if (stageKey === 'ai_setup') {
    function saveAiGate() {
      if (!aiProvider) {
        setAiError('Choose an AI provider first.')
        return
      }
      if (!aiKey.trim()) {
        setAiError('Paste the tenant AI API key before saving this gate.')
        return
      }
      setAiError(null)
      onMarkStep({
        choice: 'ai_configured',
        ai_provider: aiProvider,
        ai_api_key: aiKey.trim(),
        ai_model: aiModel.trim() || null,
        transcription_openai_api_key: transcriptionKey.trim() || undefined,
      })
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-navy-900">
            AI provider
            <select
              value={aiProvider}
              onChange={(event) => handleAiProviderChange(event.target.value as AiProvider)}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-900"
            >
              {Object.entries(AI_PROVIDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-navy-900">
            Model
            <select
              value={aiModelSelectValue}
              onChange={(event) => {
                if (event.target.value === '__default') {
                  setUseCustomAiModel(false)
                  setAiModel('')
                } else if (event.target.value === '__custom') {
                  setUseCustomAiModel(true)
                  setAiModel('')
                } else {
                  setUseCustomAiModel(false)
                  setAiModel(event.target.value)
                }
              }}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-900"
            >
              <option value="__default">Use provider default</option>
              {aiModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.note ? ` - ${option.note}` : ''}
                </option>
              ))}
              <option value="__custom">Custom model or deployment...</option>
            </select>
          </label>
        </div>

        {useCustomAiModel && (
          <label className="mt-4 block text-sm font-semibold text-navy-900">
            Custom model or deployment
            <input
              type="text"
              value={aiModel}
              onChange={(event) => setAiModel(event.target.value)}
              placeholder={aiProvider === 'azure' ? 'Your Azure deployment name' : 'Paste the exact model id'}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-navy-900"
            />
          </label>
        )}

        <label className="mt-4 block text-sm font-semibold text-navy-900">
          Tenant AI API key
          <input
            type="password"
            value={aiKey}
            onChange={(event) => setAiKey(event.target.value)}
            placeholder={aiProvider === 'anthropic' ? 'sk-ant-...' : aiProvider === 'google' ? 'AIza...' : 'Paste API key'}
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-navy-900"
            autoComplete="new-password"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-navy-900">
          OpenAI transcription key optional
          <input
            type="password"
            value={transcriptionKey}
            onChange={(event) => setTranscriptionKey(event.target.value)}
            placeholder="Only needed for call recording transcripts when main AI is not OpenAI"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-navy-900"
            autoComplete="new-password"
          />
        </label>

        {aiError && <p className="mt-3 text-sm font-semibold text-red-700">{aiError}</p>}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveAiGate}
            disabled={saving}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {saving ? 'Saving...' : 'Save AI setup'}
          </button>
          <button
            type="button"
            onClick={onManualSetup}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:border-amber-300 disabled:opacity-50"
          >
            Continue manually
          </button>
        </div>
      </div>
    )
  }

  if (stageKey === 'data_ownership') {
    const computedR2Endpoint = r2Endpoint.trim() || (r2AccountId.trim() ? `https://${r2AccountId.trim()}.r2.cloudflarestorage.com` : '')
    const crewbarnAppReferrer = typeof window === 'undefined' ? 'https://app.crewbarn.com/*' : `${window.location.origin}/*`
    const normalizedMapsDomain = normalizeDomainForReferrer(mapsDomain)
    const customerDomainReferrers = normalizedMapsDomain
      ? [`https://${normalizedMapsDomain}/*`, `https://*.${normalizedMapsDomain}/*`]
      : []

    function saveDataOwnership() {
      setOwnershipError(null)

      if (ownershipMode === 'crewbarn_managed') {
        onMarkStep({
          choice: 'crewbarn_managed',
          storage_mode: 'crewbarn_managed',
          storage_provider: 'crewbarn',
          maps_mode: 'crewbarn_managed',
        })
        return
      }

      if (!r2AccountId.trim() || !r2Bucket.trim() || !r2AccessKeyId.trim() || !r2SecretAccessKey.trim()) {
        setOwnershipError('Add the Cloudflare R2 account ID, bucket, access key ID, and secret before saving BYO storage.')
        return
      }

      if (!googleMapsKey.trim()) {
        setOwnershipError('Add your Google Maps API key before saving BYO maps.')
        return
      }

      onMarkStep({
        choice: 'byo_recommended',
        storage_mode: 'byo',
        storage_provider: 'cloudflare_r2',
        maps_mode: 'byo',
        cloudflare_r2_account_id: r2AccountId.trim(),
        cloudflare_r2_bucket: r2Bucket.trim(),
        cloudflare_r2_endpoint: computedR2Endpoint,
        cloudflare_r2_access_key_id: r2AccessKeyId.trim(),
        cloudflare_r2_secret_access_key: r2SecretAccessKey.trim(),
        cloudflare_r2_public_base_url: r2PublicBaseUrl.trim() || undefined,
        google_maps_api_key: googleMapsKey.trim(),
      })
    }

    return (
      <div className="space-y-5">
        {complete && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            This gate is saved. You can still update the ownership path and save again.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setOwnershipMode('byo')}
            disabled={saving}
            className={`rounded-xl border p-4 text-left disabled:opacity-50 ${
              ownershipMode === 'byo' ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-slate-300 bg-white hover:border-amber-300'
            }`}
          >
            <span className="block text-sm font-bold text-navy-950">BYO: tenant owns the accounts</span>
            <span className="mt-1 block text-sm text-slate-700">
              Recommended. You own Cloudflare R2, Google Maps, provider free tiers, and provider bills.
            </span>
          </button>
          {!onboarding.beta_agreement?.byo_only && (
          <button
            type="button"
            onClick={() => setOwnershipMode('crewbarn_managed')}
            disabled={saving}
            className={`rounded-xl border p-4 text-left disabled:opacity-50 ${
              ownershipMode === 'crewbarn_managed'
                ? 'border-amber-400 bg-amber-50 shadow-sm'
                : 'border-slate-300 bg-white hover:border-amber-300'
            }`}
          >
            <span className="block text-sm font-bold text-navy-950">CrewBarn-managed</span>
            <span className="mt-1 block text-sm text-slate-700">
              Fastest launch. CrewBarn manages storage and maps, with usage visible before going live.
            </span>
          </button>
          )}
        </div>

        {onboarding.beta_agreement?.byo_only && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Beta accounts bring their own keys — that's the free-for-life deal. Storage (Cloudflare R2) and maps (Google) run under your own accounts; CrewBarn never bills you for them.
          </p>
        )}
        {ownershipMode === 'byo' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-bold text-navy-950">Cloudflare R2 storage</h4>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                <li>1. Sign in to your Cloudflare account, open R2 Object Storage, and create a bucket for CrewBarn files.</li>
                <li>2. Create a scoped R2 API token or access key with Object Read and Write for that bucket.</li>
                <li>3. Copy the Account ID, bucket name, access key ID, and secret into CrewBarn.</li>
              </ol>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold text-navy-900">
                  Account ID
                  <input
                    name="crewbarn-r2-account-id"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={r2AccountId}
                    onChange={(event) => setR2AccountId(event.target.value)}
                    placeholder="Cloudflare account id"
                    className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
                  />
                </label>
                <label className="text-sm font-semibold text-navy-900">
                  Bucket
                  <input
                    name="crewbarn-r2-bucket"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={r2Bucket}
                    onChange={(event) => setR2Bucket(event.target.value)}
                    placeholder="crewbarn-key-en-lock"
                    className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-sm font-semibold text-navy-900 md:col-span-2">
                  S3 endpoint
                  <input
                    name="crewbarn-r2-s3-endpoint"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={r2Endpoint}
                    onChange={(event) => setR2Endpoint(event.target.value)}
                    placeholder={computedR2Endpoint || 'https://<account_id>.r2.cloudflarestorage.com'}
                    className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
                  />
                </label>
                <label className="text-sm font-semibold text-navy-900">
                  Access key ID
                  <input
                    type="password"
                    name="crewbarn-r2-access-key-id"
                    value={r2AccessKeyId}
                    onChange={(event) => setR2AccessKeyId(event.target.value)}
                    placeholder="Paste R2 access key ID"
                    className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                </label>
                <label className="text-sm font-semibold text-navy-900">
                  Secret access key
                  <input
                    type="password"
                    name="crewbarn-r2-secret-access-key"
                    value={r2SecretAccessKey}
                    onChange={(event) => setR2SecretAccessKey(event.target.value)}
                    placeholder="Paste R2 secret"
                    className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                </label>
                <label className="text-sm font-semibold text-navy-900 md:col-span-2">
                  Public/custom domain URL optional
                  <input
                    name="crewbarn-r2-public-base-url"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={r2PublicBaseUrl}
                    onChange={(event) => setR2PublicBaseUrl(event.target.value)}
                    placeholder="https://media.example.com"
                    className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-bold text-navy-950">Google Maps</h4>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                <li>1. Open Google Cloud Console, create or select your company project, and turn on billing.</li>
                <li>2. Enable Maps JavaScript API, Places API (New), and Geocoding API.</li>
                <li>3. Create an API key and restrict it by website. Copy each website restriction below into Google.</li>
                <li>4. Restrict the same key to only Maps JavaScript API, Places API (New), and Geocoding API, then paste it here.</li>
              </ol>
              <div className="mt-4 space-y-3">
                <CopyValueBox label="CrewBarn app domain" value={crewbarnAppReferrer} />
                <label className="block text-sm font-semibold text-navy-900">
                  Your customer-facing domain
                  <input
                    name="crewbarn-google-maps-domain"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={mapsDomain}
                    onChange={(event) => setMapsDomain(event.target.value)}
                    placeholder="example.com"
                    className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
                  />
                </label>
                {customerDomainReferrers.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <CopyValueBox label="Your main domain" value={customerDomainReferrers[0]} />
                    <CopyValueBox label="Your subdomains" value={customerDomainReferrers[1]} />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
                    Enter your domain to generate the exact main-domain and wildcard-subdomain values to copy.
                  </div>
                )}
              </div>
              <label className="mt-4 block text-sm font-semibold text-navy-900">
                Google Maps API key
                <input
                  type="password"
                  name="crewbarn-google-maps-api-key"
                  value={googleMapsKey}
                  onChange={(event) => setGoogleMapsKey(event.target.value)}
                  placeholder="AIza..."
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <h4 className="text-sm font-bold text-navy-950">Phone and message providers</h4>
              <p className="mt-2">
                Step 7 will collect your email, Twilio, and Net2Phone details. Use your own Twilio or Net2Phone account
                so SMS, call logs, recordings, and provider billing stay under your ownership.
              </p>
              <p className="mt-2">
                Once your AI helper is connected, it can guide you through each provider setup step and explain which
                value to paste into CrewBarn.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            CrewBarn will manage storage and Google Maps for your shop for now. Storage will be priced by stored size,
            and maps will be priced by usage. You can switch to BYO later without changing your setup path.
          </div>
        )}

        {ownershipError && <p className="text-sm font-semibold text-red-700">{ownershipError}</p>}

        <button
          type="button"
          onClick={saveDataOwnership}
          disabled={saving}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {saving ? 'Saving...' : ownershipMode === 'byo' ? 'Save BYO ownership' : 'Save CrewBarn-managed'}
        </button>
      </div>
    )
  }

  if (stageKey === 'company_profile') {
    async function uploadLogo(file: File) {
      setLogoUploadError(null)
      setLogoUploading(true)
      try {
        const form = new FormData()
        form.append('file', file)
        const token = getStoredToken()
        const response = await fetch(`${API_URL}/v1/tenant-settings/brand/logo`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.message ?? `Logo upload failed (${response.status})`)
        }
        await qc.invalidateQueries({ queryKey: ['tenant-brand'] })
      } catch (error) {
        setLogoUploadError(error instanceof Error ? error.message : String(error))
      } finally {
        setLogoUploading(false)
        if (logoInputRef.current) logoInputRef.current.value = ''
      }
    }

    function completeCompanyProfile() {
      onMarkStep({
        choice: 'company_profile_saved',
        company_name: companyName.trim(),
        company_phone: companyPhone.trim(),
        company_email: companyEmail.trim(),
        company_address: companyAddress.trim(),
        company_website: companyWebsite.trim() || undefined,
      })
    }

    function saveCompanyProfile() {
      if (!companyName.trim()) {
        setCompanyError('Add your company name before saving this gate.')
        return
      }
      if (!companyPhone.trim()) {
        setCompanyError('Add your company phone before saving this gate.')
        return
      }
      if (!companyEmail.trim()) {
        setCompanyError('Add your company email before saving this gate.')
        return
      }
      if (!companyAddress.trim()) {
        setCompanyError('Add your business address before saving this gate.')
        return
      }
      if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
        setCompanyError('Use a valid brand color like #f59e0b.')
        return
      }
      setCompanyError(null)
      if (colorDirty) {
        saveBrandColor.mutate(brandColor.toLowerCase(), {
          onSuccess: completeCompanyProfile,
          onError: (error) => setCompanyError(error instanceof Error ? error.message : String(error)),
        })
        return
      }
      completeCompanyProfile()
    }

    return (
      <div className="space-y-5">
        {complete && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            This company profile is saved. You can still update it and save again.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-navy-900 md:col-span-2">
              Company name
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Your public company name"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-navy-900">
              Main phone
              <input
                value={companyPhone}
                onChange={(event) => setCompanyPhone(event.target.value)}
                placeholder="(321) 224-5625"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-navy-900">
              Main email
              <input
                type="email"
                value={companyEmail}
                onChange={(event) => setCompanyEmail(event.target.value)}
                placeholder="office@example.com"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-navy-900">
              Website optional
              <input
                value={companyWebsite}
                onChange={(event) => setCompanyWebsite(event.target.value)}
                placeholder="https://example.com"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-navy-900 md:col-span-2">
              Business address
              <input
                value={companyAddress}
                onChange={(event) => setCompanyAddress(event.target.value)}
                placeholder="Street, city, state, zip"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </label>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            This is the identity customers see on estimates, invoices, emails, portal pages, and marketplace listings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-bold text-navy-950">Logo and brand colors</div>
                <p className="mt-1 text-sm text-slate-600">
                  These feed the premade invoice, estimate, contract, email, and portal templates.
                </p>
              </div>

              <div>
                <div className="flex min-h-44 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-5">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Company logo" className="max-h-36 max-w-full object-contain" />
                  ) : (
                    <span className="text-sm text-slate-400">No logo uploaded</span>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) uploadLogo(file)
                  }}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="rounded-lg bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {logoUploading ? 'Uploading...' : logoUrl ? 'Replace logo' : 'Upload logo'}
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => deleteLogo.mutate()}
                      disabled={deleteLogo.isPending}
                      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {logoUploadError && <p className="mt-2 text-sm font-semibold text-red-700">{logoUploadError}</p>}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="text-sm font-semibold text-navy-900">
                  Company color
                  <div className="mt-2 grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
                    <div className="relative h-14 w-14 overflow-hidden rounded-full border border-slate-300 shadow-sm">
                      <input
                        type="color"
                        value={colorInputValue}
                        onChange={(event) => setBrandColor(event.target.value)}
                        title="Choose custom color"
                        className="absolute -inset-2 h-20 w-20 cursor-pointer border-0 bg-transparent p-0"
                      />
                    </div>
                    <input
                      value={brandColor || savedBrandColor}
                      onChange={(event) => setBrandColor(event.target.value)}
                      placeholder="#f59e0b"
                      maxLength={7}
                      className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
                    />
                  </div>
                </label>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-4">
                  {BRAND_COLOR_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      title={hex}
                      onClick={() => setBrandColor(hex)}
                      className={`h-10 rounded-lg border-2 ${
                        previewColor.toLowerCase() === hex.toLowerCase()
                          ? 'border-navy-900 ring-2 ring-slate-200'
                          : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected color</div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: previewColor }} />
                    <span className="font-mono text-sm font-semibold text-navy-900">{previewColor}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-bold text-navy-950">Premade document preview</div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="p-4" style={{ borderTop: `5px solid ${previewColor}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="mb-2 max-h-10 max-w-32 object-contain" />
                    ) : (
                      <div className="mb-2 h-10 w-24 rounded bg-slate-100" />
                    )}
                    <div className="text-sm font-black text-navy-950">{companyName || onboarding.tenant.name}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{companyPhone || 'Main phone'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-navy-950">INVOICE</div>
                    <div className="font-mono text-xs font-bold" style={{ color: previewColor }}>INV-2026-0001</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="font-bold uppercase text-slate-500">Bill to</div>
                    <div className="mt-1 font-semibold text-navy-950">Customer</div>
                  </div>
                  <div className="rounded-lg border p-2" style={{ borderColor: `${previewColor}55`, backgroundColor: `${previewColor}12` }}>
                    <div className="font-bold uppercase text-slate-500">Service</div>
                    <div className="mt-1 font-semibold text-navy-950">Job location</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 rounded bg-slate-100" />
                  <div className="h-2 w-2/3 rounded bg-slate-100" />
                  <div className="ml-auto mt-3 h-8 w-32 rounded" style={{ backgroundColor: previewColor }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {companyError && <p className="text-sm font-semibold text-red-700">{companyError}</p>}

        <button
          type="button"
          onClick={saveCompanyProfile}
          disabled={saving || saveBrandColor.isPending || logoUploading}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {saving || saveBrandColor.isPending ? 'Saving...' : 'Save company profile'}
        </button>
      </div>
    )
  }

  if (stageKey === 'company_assets') {
    const selectedCount = assetDrafts.filter((asset) => asset.selected && asset.name.trim()).length
    const assetSaving = saving || seedCompanyAssets.isPending

    function updateAssetDraft(index: number, patch: Partial<OnboardingAssetDraft>) {
      setAssetDrafts((current) =>
        current.map((asset, currentIndex) => (currentIndex === index ? { ...asset, ...patch } : asset)),
      )
    }

    function saveCompanyAssets() {
      const assets = assetDrafts
        .filter((asset) => asset.selected && asset.name.trim())
        .map((asset) => ({
          name: asset.name.trim(),
          category: asset.category,
          capabilities: asset.capabilities,
          notes: asset.notes.trim() || null,
          source_seed_key: asset.source_seed_key,
        }))

      if (assets.length === 0) {
        setAssetError('Select at least one tool, vehicle, software subscription, or kit to create.')
        return
      }

      setAssetError(null)
      seedCompanyAssets.mutate(assets, {
        onSuccess: () => onGateSaved?.(),
        onError: (err) => {
          setAssetError(err instanceof Error ? err.message : String(err))
        },
      })
    }

    return (
      <div className="space-y-5">
        {complete && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            Company assets are seeded. You can still add more tools here or review them in Company Assets.
          </div>
        )}

        {assetDrafts.length > 0 ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-base font-bold text-navy-950">Starter company assets</h4>
                  <p className="mt-1 text-sm text-slate-600">
                    These are {intelligenceLabel.toLowerCase()} recommendations for the selected trade. Edit names now; assignments and serial numbers can be confirmed later.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                    {intelligenceLabel}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    {selectedCount} selected
                  </span>
                </div>
              </div>
            </div>

            {assetDrafts.map((asset, index) => (
              <div key={`${asset.source_seed_key ?? asset.name}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)_180px] lg:items-start">
                  <label className="flex items-center gap-2 pt-3 text-sm font-semibold text-navy-900">
                    <input
                      type="checkbox"
                      checked={asset.selected}
                      onChange={(event) => updateAssetDraft(index, { selected: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                    />
                    Use
                  </label>
                  <label className="text-sm font-semibold text-navy-900">
                    Asset name
                    <input
                      value={asset.name}
                      onChange={(event) => updateAssetDraft(index, { name: event.target.value })}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-sm font-semibold text-navy-900">
                    Category
                    <select
                      value={asset.category}
                      onChange={(event) => updateAssetDraft(index, { category: event.target.value as CompanyAssetCategory })}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    >
                      {COMPANY_ASSET_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {COMPANY_ASSET_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {asset.capabilities.map((capability) => (
                    <span key={capability} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {capability.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <label className="mt-3 block text-sm font-semibold text-navy-900">
                  Notes
                  <textarea
                    value={asset.notes}
                    onChange={(event) => updateAssetDraft(index, { notes: event.target.value })}
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700">
            No starter asset recommendations were found for this trade yet. You can skip this gate or add company assets manually later.
          </div>
        )}

        {(assetError || seedCompanyAssets.error) && (
          <p className="text-sm font-semibold text-red-700">
            {assetError || (seedCompanyAssets.error as Error | null)?.message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveCompanyAssets}
            disabled={assetSaving || selectedCount === 0}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {assetSaving ? 'Creating assets...' : complete ? 'Add selected assets' : 'Create selected assets'}
          </button>
          <button
            type="button"
            onClick={() => onMarkStep({ choice: 'skip_company_assets' })}
            disabled={assetSaving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:border-amber-300 disabled:opacity-50"
          >
            Skip for now
          </button>
          <Link
            to="/company-assets"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:border-amber-300"
          >
            Open Company Assets
          </Link>
        </div>
      </div>
    )
  }

  if (stageKey === 'inventory_layout') {
    const selectedCount = stockDrafts.filter((item) => item.selected && item.name.trim()).length
    const stockSaving = saving || seedInventoryStock.isPending

    function updateStockDraft(index: number, patch: Partial<OnboardingStockDraft>) {
      setStockDrafts((current) =>
        current.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)),
      )
    }

    function saveInventoryStock() {
      const items = stockDrafts
        .filter((item) => item.selected && item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          category: item.category.trim() || 'Parts',
          sku: item.sku.trim() || null,
          quantity: Math.max(0, Number(item.quantity) || 0),
          reorder_threshold: item.reorder_threshold === null ? null : Math.max(0, Number(item.reorder_threshold) || 0),
          reorder_quantity: item.reorder_quantity === null ? null : Math.max(0, Number(item.reorder_quantity) || 0),
          notes: item.notes.trim() || null,
          source_seed_key: item.source_seed_key,
        }))

      if (items.length === 0) {
        setStockError('Select at least one stock item or skip this gate for now.')
        return
      }

      setStockError(null)
      seedInventoryStock.mutate(items, {
        onSuccess: () => onGateSaved?.(),
        onError: (err) => {
          setStockError(err instanceof Error ? err.message : String(err))
        },
      })
    }

    return (
      <div className="space-y-5">
        {complete && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            Starter stock is saved. You can still add or update counts here before launch.
          </div>
        )}

        {stockDrafts.length > 0 ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-base font-bold text-navy-950">Recommended starter stock</h4>
                  <p className="mt-1 text-sm text-slate-600">
                    CrewBarn uses {intelligenceLabel.toLowerCase()} to suggest common stocked items. Keep the items this shop carries, adjust counts, and review supplier pricing later.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                    {intelligenceLabel}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    {selectedCount} selected
                  </span>
                </div>
              </div>
            </div>

            {stockDrafts.map((item, index) => (
              <div key={`${item.source_seed_key ?? item.name}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)_150px_140px] lg:items-start">
                  <label className="flex items-center gap-2 pt-3 text-sm font-semibold text-navy-900">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(event) => updateStockDraft(index, { selected: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                    />
                    Use
                  </label>
                  <label className="text-sm font-semibold text-navy-900">
                    Stock item
                    <input
                      value={item.name}
                      onChange={(event) => updateStockDraft(index, { name: event.target.value })}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-sm font-semibold text-navy-900">
                    SKU
                    <input
                      value={item.sku}
                      onChange={(event) => updateStockDraft(index, { sku: event.target.value })}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm"
                    />
                  </label>
                  <label className="text-sm font-semibold text-navy-900">
                    On hand
                    <input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(event) => updateStockDraft(index, { quantity: Number(event.target.value) })}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="text-sm font-semibold text-navy-900">
                    Category
                    <input
                      value={item.category}
                      onChange={(event) => updateStockDraft(index, { category: event.target.value })}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-sm font-semibold text-navy-900">
                    Reorder at
                    <input
                      type="number"
                      min={0}
                      value={item.reorder_threshold ?? ''}
                      onChange={(event) =>
                        updateStockDraft(index, {
                          reorder_threshold: event.target.value === '' ? null : Number(event.target.value),
                        })
                      }
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-sm font-semibold text-navy-900">
                    Reorder qty
                    <input
                      type="number"
                      min={0}
                      value={item.reorder_quantity ?? ''}
                      onChange={(event) =>
                        updateStockDraft(index, {
                          reorder_quantity: event.target.value === '' ? null : Number(event.target.value),
                        })
                      }
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                  </label>
                </div>
                {item.notes && <p className="mt-3 text-sm text-slate-600">{item.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700">
            No starter stock recommendations were found for this trade yet. You can skip this gate or create stock manually later.
          </div>
        )}

        {(stockError || seedInventoryStock.error) && (
          <p className="text-sm font-semibold text-red-700">
            {stockError || (seedInventoryStock.error as Error | null)?.message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveInventoryStock}
            disabled={stockSaving || selectedCount === 0}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {stockSaving ? 'Creating stock...' : complete ? 'Update selected stock' : 'Create selected stock'}
          </button>
          <button
            type="button"
            onClick={() => onMarkStep({ choice: 'skip_inventory_stock' })}
            disabled={stockSaving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:border-amber-300 disabled:opacity-50"
          >
            Skip stock for now
          </button>
          <Link
            to="/inventory"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:border-amber-300"
          >
            Open Inventory
          </Link>
        </div>
      </div>
    )
  }

  if (stageKey === 'staff') {
    const staffSaving = saving || inviteStaff.isPending

    function inviteCrewMember() {
      const firstName = staffFirstName.trim()
      const lastName = staffLastName.trim()
      const email = staffEmail.trim()

      if (!firstName) {
        setStaffError('Enter the crew member first name.')
        return
      }
      if (!email || !email.includes('@')) {
        setStaffError('Enter a valid email address for the invite.')
        return
      }
      if (!staffRoleSlug) {
        setStaffError('Choose a role before sending the invite.')
        return
      }

      setStaffError(null)
      setLastInvite(null)
      inviteStaff.mutate(
        {
          first_name: firstName,
          last_name: lastName || null,
          email,
          role_slug: staffRoleSlug,
        },
        {
          onSuccess: (resp) => {
            setLastInvite(resp)
            setStaffFirstName('')
            setStaffLastName('')
            setStaffEmail('')
          },
          onError: (err) => {
            setStaffError(err instanceof Error ? err.message : String(err))
          },
        },
      )
    }

    return (
      <div className="space-y-5">
        {complete && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            Crew setup is started. You can keep inviting people here before launch.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-base font-bold text-navy-950">Invite a crew member</h4>
              <p className="mt-1 text-sm text-slate-600">
                Pick the role now so CrewBarn knows what this person can see on their first login.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {staffMembers.length} current user{staffMembers.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold text-navy-900">
              First name
              <input
                value={staffFirstName}
                onChange={(event) => setStaffFirstName(event.target.value)}
                placeholder="First name"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-navy-900">
              Last name
              <input
                value={staffLastName}
                onChange={(event) => setStaffLastName(event.target.value)}
                placeholder="Last name"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-navy-900">
              Email
              <input
                type="email"
                value={staffEmail}
                onChange={(event) => setStaffEmail(event.target.value)}
                placeholder="crew@example.com"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-navy-900">
              Role
              <select
                value={staffRoleSlug}
                onChange={(event) => setStaffRoleSlug(event.target.value)}
                disabled={staffQuery.isLoading || staffRoles.length === 0}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-900 disabled:bg-slate-100"
              >
                <option value="">Choose role</option>
                {staffRoles.map((role) => (
                  <option key={role.role_slug} value={role.role_slug}>
                    {role.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {staffRoleSlug && (
            <p className="mt-3 text-sm text-slate-600">
              {staffRoles.find((role) => role.role_slug === staffRoleSlug)?.description ||
                'This role controls the user permissions and the setup tour they see later.'}
            </p>
          )}
        </div>

        {staffMembers.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-base font-bold text-navy-950">Current crew access</h4>
            <div className="mt-3 divide-y divide-slate-100">
              {staffMembers.slice(0, 6).map((member) => (
                <div key={member.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-navy-950">{member.name || member.email}</div>
                    <div className="text-sm text-slate-500">{member.email}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {staffRoles.find((role) => role.role_slug === member.role_slug)?.display_name ?? member.role_slug}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                      {member.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {lastInvite && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-semibold text-emerald-800">
              Invite created for {lastInvite.data.email}.
              {!lastInvite.invite.email_sent && ' Email did not send, so use the invite link below.'}
            </div>
            {!lastInvite.invite.email_sent && lastInvite.invite.email_error && (
              <p className="text-sm text-emerald-900">{lastInvite.invite.email_error}</p>
            )}
            <CopyValueBox label="Invite link" value={lastInvite.invite.accept_url} />
          </div>
        )}

        {(staffError || staffQuery.error || inviteStaff.error) && (
          <p className="text-sm font-semibold text-red-700">
            {staffError || (staffQuery.error as Error | null)?.message || (inviteStaff.error as Error | null)?.message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={inviteCrewMember}
            disabled={staffSaving || staffQuery.isLoading || staffRoles.length === 0}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {staffSaving ? 'Sending invite...' : 'Invite crew member'}
          </button>
          <button
            type="button"
            onClick={() => onMarkStep({ choice: 'skip_staff_invite' })}
            disabled={staffSaving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:border-amber-300 disabled:opacity-50"
          >
            Skip crew invite for now
          </button>
          <Link
            to="/tool-shed/staff"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:border-amber-300"
          >
            Open Staff & Crews
          </Link>
        </div>
      </div>
    )
  }

  if (complete) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
        This gate is saved for this tenant.
      </div>
    )
  }

  if (stageKey === 'communications') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Choose one CrewBarn number for technicians to call and text customers from the mobile app.
          Calls and messages are recorded on the customer and job timeline. Normal outbound US texting
          starts after the number's required 10DLC registration is approved.
        </div>
        {!onboarding.beta_agreement?.byo_only && (
          <HostedNumberSection
            activeProvider="twilio_hosted"
            onActiveChange={setHostedNumberReady}
          />
        )}
        <div className="flex flex-wrap gap-3">
          {!onboarding.beta_agreement?.byo_only && (
          <button
            type="button"
            onClick={() => onMarkStep({
              choice: 'crewbarn_mobile_number',
              email_mode: 'decide_later',
              sms_mode: 'crewbarn_managed',
            })}
            disabled={saving || !hostedNumberReady}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {saving ? 'Saving...' : 'Use this number'}
          </button>
          )}
          <button
            type="button"
            onClick={() => onMarkStep({
              choice: 'configure_later',
              email_mode: 'decide_later',
              sms_mode: 'decide_later',
            })}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:border-amber-300 disabled:opacity-50"
          >
            Choose a number later
          </button>
        </div>
      </div>
    )
  }

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

function normalizeDomainForReferrer(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^\*\./, '')
    .replace(/^\./, '')
    .toLowerCase()
}

function CopyValueBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-slate-50 px-2 py-2 font-mono text-xs text-navy-900">
          {value}
        </code>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(value)}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-navy-800 hover:border-amber-300"
        >
          Copy
        </button>
      </div>
    </div>
  )
}
