import type { CompleteOnboardingStepPayload, OnboardingStatus } from '@/types/onboarding'

/**
 * What every step of the setup checklist is given.
 *
 * Deliberately small. A step that needs more than this needs its own query,
 * not another prop threaded through the overlay — which is how the old single
 * function ended up holding thirty pieces of unrelated state.
 */
export interface StepProps {
  onboarding: OnboardingStatus
  complete: boolean
  locked: boolean
  saving: boolean
  onManualSetup: () => void
  onMarkStep: (payload?: CompleteOnboardingStepPayload) => void
  onGateSaved: () => void
}

/** Where a step's suggestions came from, in words. Used by two steps. */
export function seedIntelligenceLabel(onboarding: OnboardingStatus): string {
  const source = onboarding.seed_intelligence?.source ?? 'curated'
  return source === 'ai' ? 'AI-tailored' : source === 'curated' ? 'Curated trade research' : 'Starter pack'
}

export function CopyValueBox({ label, value }: { label: string; value: string }) {
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
