import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { OnboardingSetupGuide } from '@/components/onboarding/setupGuide/OnboardingSetupGuide'
import { OnboardingWorkflowTour } from '@/components/onboarding/OnboardingWorkflowTour'
import { useAuth } from '@/hooks/useAuth'
import { stopLine } from '@/lib/tourVoice'
import { maybeAutoStartWelcome, startWelcome } from '@/components/onboarding/welcomeTutorial'

const COMPLETED_KEY = 'crewbarn:onboarding:narrated-tour:v2'
const AUDIO_KEY = 'crewbarn:onboarding:tour-audio'

function readFlag(key: string, fallback: string) {
  try { return window.localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writeFlag(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* private mode */ }
}

/**
 * The film buttons inside guided setup.
 *
 * "What is CrewBarn?" and "Watch the roadmap" used to be two separate films
 * here, and the first played by itself on a new shop's first visit. They are
 * one now: the Welcome to CrewBarn tutorial, which explains CrewBarn, ends on
 * the road through setup, and then walks every step with you. It plays by
 * itself once (welcomeTutorial.ts). The roadmap film on its own is still
 * reachable from Help.
 */
export function OnboardingNarratedTour() {
  const location = useLocation()
  const { account } = useAuth()
  const [audioOn, setAudioOn] = useState(() => readFlag(AUDIO_KEY, 'on') === 'on')
  const [hasCompleted, setHasCompleted] = useState(() => readFlag(COMPLETED_KEY, '0') === '1')
  const [tourOpen, setTourOpen] = useState(false)
  const [showWorkflowTour, setShowWorkflowTour] = useState(false)
  const handledLaunch = useRef(false)
  // A new shop's first visit: the welcome film, once (not the old intro).
  useEffect(() => {
    if (!account) return
    maybeAutoStartWelcome()
  }, [account])
  useEffect(() => {
    if (handledLaunch.current) return
    const requested = (location.state as { onboardingTour?: string } | null)?.onboardingTour
    if (!requested) return
    handledLaunch.current = true
    if (requested === 'intro' || requested === 'welcome') startWelcome()
    if (requested === 'workflow') setShowWorkflowTour(true)
  }, [location.state])
  useEffect(() => {
    const launch = (event: Event) => {
      const requested = (event as CustomEvent<{ tour?: string }>).detail?.tour
      if (requested === 'intro' || requested === 'welcome') startWelcome()
      if (requested === 'workflow') setShowWorkflowTour(true)
      if (requested === 'setup') setTourOpen(true)
    }
    window.addEventListener('crewbarn:onboarding-tour', launch)
    return () => window.removeEventListener('crewbarn:onboarding-tour', launch)
  }, [])
  useEffect(() => () => stopLine(), [])

  function toggleAudio() {
    setAudioOn((current) => {
      if (current) stopLine()
      writeFlag(AUDIO_KEY, current ? 'off' : 'on')
      return !current
    })
  }

  return <>
    <div data-tour="onboarding-tour-buttons" className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setTourOpen(true)} className="rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600">
        ▶ {hasCompleted ? 'Replay guided setup' : 'Open guided setup'}
      </button>
      <button type="button" data-tour="onboarding-overlay-welcome" onClick={startWelcome} className="px-1.5 py-2 text-sm font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-navy-900">Watch the welcome</button>
      <button type="button" onClick={toggleAudio} aria-pressed={audioOn} className="px-1.5 py-2 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-navy-800">Voice {audioOn ? 'on' : 'off'}</button>
    </div>
    <OnboardingSetupGuide
      open={tourOpen}
      audioOn={audioOn}
      onToggleAudio={toggleAudio}
      onClose={(finished) => {
        setTourOpen(false)
        if (finished) { writeFlag(COMPLETED_KEY, '1'); setHasCompleted(true) }
      }}
    />
    <OnboardingWorkflowTour open={showWorkflowTour} audioOn={audioOn} onClose={() => setShowWorkflowTour(false)} onSetup={() => { setShowWorkflowTour(false); setTourOpen(true) }} />
  </>
}
