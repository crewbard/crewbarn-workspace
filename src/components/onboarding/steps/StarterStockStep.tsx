import { useEffect, useMemo, useState } from 'react'
import { useSeedOnboardingInventoryStock } from '@/hooks/useOnboarding'
import { SeedField, SeedPicker } from '@/components/onboarding/steps/SeedPicker'
import { seedIntelligenceLabel, type StepProps } from '@/components/onboarding/steps/shared'

/**
 * What you keep on the shelf.
 *
 * The twin of the tools step, and now literally so: both are SeedPicker, so
 * the two cannot drift into different tables with different words for an
 * empty list again.
 *
 * The payload is unchanged, including the quirks that matter — category
 * falling back to "Parts", the reorder numbers staying null rather than
 * becoming zero, and quantities floored at zero.
 */

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

export function StarterStockStep({ complete, onGateSaved, onboarding, saving }: StepProps) {
  const seedInventoryStock = useSeedOnboardingInventoryStock()
  const [stockDrafts, setStockDrafts] = useState<OnboardingStockDraft[]>([])
  const [stockError, setStockError] = useState<string | null>(null)

  const stockRecommendations = useMemo(
    () => onboarding.inventory_stock_recommendations ?? [],
    [onboarding.inventory_stock_recommendations],
  )
  const stockRecommendationKey = useMemo(
    () => stockRecommendations.map((item) => `${item.source_seed_key}:${item.name}`).join('|'),
    [stockRecommendations],
  )

  useEffect(() => {
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
  }, [stockRecommendationKey, stockRecommendations])

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
      setStockError('Nothing is ticked. Tick at least one, or use Skip for now at the bottom — stock can wait.')
      return
    }

    setStockError(null)
    seedInventoryStock.mutate(items, {
      onSuccess: () => onGateSaved?.(),
      onError: (err) => setStockError(err instanceof Error ? err.message : String(err)),
    })
  }

  return (
    <div className="space-y-5">
      {complete && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
          <span className="font-bold">Saved.</span> It is all in Inventory now, where you can count it properly later.
        </p>
      )}

      <p className="text-[15px] leading-relaxed text-slate-600">
        Rough numbers are fine — nobody expects a stock take on day one. What this buys you is a tech being able to
        add a part to a job without typing its name from scratch.
      </p>

      <SeedPicker
        rows={stockDrafts}
        onChange={updateStockDraft}
        intelligenceLabel={seedIntelligenceLabel(onboarding)}
        countNoun="item"
        emptyHint="No suggestions came back for your trade. You can add stock yourself under Inventory once you are in."
        detail={(row, patch) => (
          <>
            <SeedField
              label="How many you have"
              type="number"
              value={row.quantity}
              onChange={(v) => patch({ quantity: Number(v) })}
            />
            <SeedField label="Part number" value={row.sku} onChange={(v) => patch({ sku: v })} placeholder="Optional" />
            <SeedField
              label="Tell me when it drops to"
              type="number"
              value={row.reorder_threshold ?? ''}
              onChange={(v) => patch({ reorder_threshold: v === '' ? null : Number(v) })}
            />
            <SeedField
              label="Then order this many"
              type="number"
              value={row.reorder_quantity ?? ''}
              onChange={(v) => patch({ reorder_quantity: v === '' ? null : Number(v) })}
            />
          </>
        )}
      />

      {stockError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">
          {stockError}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={saveInventoryStock}
          disabled={stockSaving}
          className="rounded-lg bg-amber-500 px-5 py-3 text-base font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {stockSaving ? 'Saving…' : 'Add these and carry on'}
        </button>
      </div>
    </div>
  )
}
