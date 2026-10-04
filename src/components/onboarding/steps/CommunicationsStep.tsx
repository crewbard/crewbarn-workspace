/**
 * CommunicationsStep — one step of the setup checklist.
 *
 * Carried out of StageActionButtons, which had all eight step bodies and
 * every piece of their state in one 1,400-line function. The state was
 * already partitioned — each of these blocks was used by this step and no
 * other — so this is a move, not a rewrite.
 */
import { useState } from 'react'
import { HostedNumberSection } from '@/components/comms/HostedNumberSection'
import { type StepProps } from '@/components/onboarding/steps/shared'

export function CommunicationsStep({ onMarkStep, onboarding, saving }: StepProps) {
  const [hostedNumberReady, setHostedNumberReady] = useState(false)

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
