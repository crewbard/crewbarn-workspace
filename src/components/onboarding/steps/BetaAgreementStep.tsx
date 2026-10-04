/**
 * BetaAgreementStep — one step of the setup checklist.
 *
 * Carried out of StageActionButtons, which had all eight step bodies and
 * every piece of their state in one 1,400-line function. The state was
 * already partitioned — each of these blocks was used by this step and no
 * other — so this is a move, not a rewrite.
 */
import { BetaAgreement } from '@/components/onboarding/BetaAgreement'
import { type StepProps } from '@/components/onboarding/steps/shared'

export function BetaAgreementStep({ onGateSaved }: StepProps) {
    return <BetaAgreement onAccepted={onGateSaved} />
}
