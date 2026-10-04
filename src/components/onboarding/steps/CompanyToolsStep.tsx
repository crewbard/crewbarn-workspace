import { useEffect, useMemo, useState } from 'react'
import { useSeedOnboardingCompanyAssets } from '@/hooks/useOnboarding'
import {
  COMPANY_ASSET_CATEGORIES,
  COMPANY_ASSET_CATEGORY_LABELS,
  type CompanyAssetCategory,
} from '@/types/companyAsset'
import { SeedField, SeedPicker } from '@/components/onboarding/steps/SeedPicker'
import { seedIntelligenceLabel, type StepProps } from '@/components/onboarding/steps/shared'

/**
 * Your tools, trucks and software.
 *
 * Rebuilt on SeedPicker, which the starter-stock step also uses — they ask
 * the same question and had drifted into two different tables with two
 * different words for an empty list.
 *
 * What the step sends is unchanged: the ticked rows, trimmed, with notes
 * nulled when blank, through the same seed mutation.
 */

interface OnboardingAssetDraft {
  selected: boolean
  name: string
  category: CompanyAssetCategory
  capabilities: string[]
  notes: string
  source_seed_key: string | null
}

export function CompanyToolsStep({ complete, onGateSaved, onboarding, saving }: StepProps) {
  const seedCompanyAssets = useSeedOnboardingCompanyAssets()
  const [assetDrafts, setAssetDrafts] = useState<OnboardingAssetDraft[]>([])
  const [assetError, setAssetError] = useState<string | null>(null)

  const assetRecommendations = useMemo(
    () => onboarding.company_asset_recommendations ?? [],
    [onboarding.company_asset_recommendations],
  )
  const recommendationKey = useMemo(
    () => assetRecommendations.map((asset) => `${asset.source_seed_key}:${asset.name}`).join('|'),
    [assetRecommendations],
  )

  useEffect(() => {
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
  }, [recommendationKey, assetRecommendations])

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
      setAssetError('Nothing is ticked. Tick at least one, or use Skip for now at the bottom.')
      return
    }

    setAssetError(null)
    seedCompanyAssets.mutate(assets, {
      onSuccess: () => onGateSaved?.(),
      onError: (err) => setAssetError(err instanceof Error ? err.message : String(err)),
    })
  }

  return (
    <div className="space-y-5">
      {complete && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
          <span className="font-bold">Saved.</span> Your tools are in Company Tools, where you can add more any time.
        </p>
      )}

      <p className="text-[15px] leading-relaxed text-slate-600">
        Later this is how CrewBarn works out which van can take which job — a truck with the right programmer in it
        beats one without.
      </p>

      <SeedPicker
        rows={assetDrafts}
        onChange={updateAssetDraft}
        intelligenceLabel={seedIntelligenceLabel(onboarding)}
        countNoun="tool"
        emptyHint="No suggestions came back for your trade. You can add your tools and trucks yourself under Company Tools once you are in."
        detail={(row, patch) => (
          <>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">What it is</span>
              <select
                value={row.category}
                onChange={(event) => patch({ category: event.target.value as CompanyAssetCategory })}
                className="mt-1 min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                {COMPANY_ASSET_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {COMPANY_ASSET_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <SeedField
              label="Notes"
              value={row.notes}
              onChange={(v) => patch({ notes: v })}
              placeholder="Serial, who has it, anything"
            />
          </>
        )}
      />

      {assetError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">
          {assetError}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={saveCompanyAssets}
          disabled={assetSaving}
          className="rounded-lg bg-amber-500 px-5 py-3 text-base font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {assetSaving ? 'Saving…' : 'Add these and carry on'}
        </button>
      </div>
    </div>
  )
}
