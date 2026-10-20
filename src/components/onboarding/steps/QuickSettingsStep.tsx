/**
 * QuickSettingsStep — the automations step of the setup checklist.
 *
 * Yes or no to each thing CrewBarn can do by itself (reminders, follow-ups,
 * review requests, missed-call texts, GPS check-in...). One save switches
 * them on or off; the server marks the step done once every question has an
 * answer. The same cards stay on Connect's Automations page.
 */
import { QuickSettingsCards } from '@/components/quickSettings/QuickSettingsCards'
import { type StepProps } from '@/components/onboarding/steps/shared'

export function QuickSettingsStep({ onGateSaved }: StepProps) {
  return (
    <div className="space-y-4">
      <div data-tour="onboarding-quick-settings-intro" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Yes or no. Anything a customer receives starts unanswered; the team ones have a suggestion filled in.
        Change any answer later on the Automations page, where you can also fine-tune the timing and wording.
      </div>
      <QuickSettingsCards mode="onboarding" onSaved={onGateSaved} />
    </div>
  )
}
