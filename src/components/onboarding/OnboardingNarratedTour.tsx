import { useEffect, useRef, useState } from 'react'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { narrate, stopNarration } from '@/lib/narratedSpeech'

const COMPLETED_KEY = 'crewbarn:onboarding:narrated-tour:v1'
const TOUR_STEPS: Array<DriveStep & { narration: string }> = [
  { element: '[data-tour="onboarding-intro"]', popover: { title: 'Welcome to CrewBarn', description: 'This guided setup prepares your tenant for real work. Audio will explain each area while you remain in control.', side: 'right', align: 'start' }, narration: 'Welcome to CrewBarn. This guided setup prepares your new tenant for real work. I will explain each area, but you remain in control of every change.' },
  { element: '[data-tour="onboarding-progress"]', popover: { title: 'Track launch readiness', description: 'Progress updates as required setup stages are completed.', side: 'right', align: 'center' }, narration: 'This progress card shows how close the tenant is to launch. It updates as required onboarding stages are completed.' },
  { element: '[data-tour="onboarding-stages"]', popover: { title: 'Work through each stage', description: 'Open stages can be selected. Locked stages become available after their prerequisites are complete.', side: 'right', align: 'start' }, narration: 'These are the onboarding stages. Select any open stage to review it. Locked stages become available after the required earlier work is complete.' },
  { element: '[data-tour="onboarding-current-stage"]', popover: { title: 'Complete the current stage', description: 'Read the guidance and review the choices before saving anything.', side: 'left', align: 'start' }, narration: 'The current stage explains what to configure and why it matters. Review the choices before saving. CrewBarn will not automatically submit a consequential action during this walkthrough.' },
  { element: '[data-tour="onboarding-stage-navigation"]', popover: { title: 'Move at your own pace', description: 'Use Back and Next to review the setup. Your saved onboarding progress remains available when you return.', side: 'top', align: 'center' }, narration: 'Use Back and Next to review the setup at your own pace. Your saved onboarding progress remains available when you return. This completes the narrated introduction.' },
]

export function OnboardingNarratedTour() {
  const tourRef = useRef<Driver | null>(null)
  const [audioOn, setAudioOn] = useState(true)
  const [hasCompleted, setHasCompleted] = useState(() => window.localStorage.getItem(COMPLETED_KEY) === '1')
  useEffect(() => () => { stopNarration(); tourRef.current?.destroy() }, [])

  function startTour() {
    stopNarration()
    tourRef.current?.destroy()
    const tour = driver({
      animate: true, allowClose: true, overlayClickBehavior: 'close', showProgress: true,
      showButtons: ['next', 'previous', 'close'], nextBtnText: 'Next', prevBtnText: 'Back', doneBtnText: 'Finish', progressText: '{{current}} of {{total}}', steps: TOUR_STEPS,
      onHighlighted: (_element, step) => { if (audioOn && 'narration' in step) void narrate(String(step.narration)) },
      onDeselected: () => stopNarration(),
      onDestroyStarted: () => {
        if (tour.getActiveIndex() === TOUR_STEPS.length - 1) { window.localStorage.setItem(COMPLETED_KEY, '1'); setHasCompleted(true) }
        stopNarration()
        tour.destroy()
      },
    })
    tourRef.current = tour
    tour.drive()
  }

  return <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
    <button type="button" onClick={startTour} className="text-sm font-semibold text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-800">
      {hasCompleted ? 'Replay automated walkthrough with audio' : 'Automated walkthrough with audio'}
    </button>
    <button type="button" onClick={() => setAudioOn((current) => { if (current) stopNarration(); return !current })} aria-pressed={audioOn} className="text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-navy-800">Audio {audioOn ? 'on' : 'off'}</button>
  </div>
}
