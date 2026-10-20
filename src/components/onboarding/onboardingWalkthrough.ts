import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import bundled from '../../generated/onboarding-workflow.json'
import type { KeyTourFinale, KeyTourStep } from '@/components/onboarding/OnboardingKeyTour'

export type WelcomeScene = {
  id: string
  label: string
  icon: string
  title: string
  sub: string
  flow?: string[]
  points?: { title: string; detail: string }[]
  compare?: { name: string; tag: string; items: string[] }[]
  foot?: string
  /** Where this lives in CrewBarn, shown under the headline. */
  where?: string
  /** One version per trade pack key (locksmith, hvac, ...), picked from the company's trade. */
  trades?: Record<string, { title: string; sub: string; points: { title: string; detail: string }[]; narration: string }>
  narration: string
}
export type WorkflowStep = { id: string; shortTitle: string; title: string; description: string; narration?: string; color: string }
/** The roadmap recap: a map of the whole setup, played chapter by chapter. */
export type RoadmapData = {
  nodes: Array<{ id: string; label: string; x: number; y: number; kind?: 'decision' | 'terminal' }>
  edges: Array<{ from: string; to: string; label?: string }>
  chapters: Array<{ id: string; label: string; range: [number, number]; nodes: string[]; narration: string; done?: boolean; zoomOutAt?: number }>
}
export type Walkthrough = {
  version: number
  title: string
  intro: string
  welcome: WelcomeScene[]
  setupLines?: Record<string, string>
  roadmap?: RoadmapData
  pageTour: KeyTourStep[]
  finale: KeyTourFinale
  steps: WorkflowStep[]
  narration?: { clips?: Record<string, string> }
}
type WalkthroughResponse = { data: Walkthrough; source: 'crewbarn-r2' | 'bundled' }

/** The copy that ships with the app — the tour works even if the API is down. */
export const BUNDLED_WALKTHROUGH = bundled as unknown as Walkthrough

let pending: Promise<WalkthroughResponse> | null = null

function load(): Promise<WalkthroughResponse> {
  pending ??= Promise.race([
    apiRequest<WalkthroughResponse>('/v1/onboarding/walkthrough'),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Walkthrough refresh timed out')), 4000)
    }),
  ]).catch((error) => {
    pending = null
    throw error
  })
  return pending
}

/** Merge the live copy over the bundled one so a stale R2 file can't drop the page tour. */
export function useOnboardingWalkthrough(enabled = true) {
  const [state, setState] = useState<{ walkthrough: Walkthrough; source: WalkthroughResponse['source'] }>({ walkthrough: BUNDLED_WALKTHROUGH, source: 'bundled' })
  useEffect(() => {
    if (!enabled) return
    let alive = true
    load().then((response) => {
      if (!alive || !response?.data) return
      const live = response.data
      setState({
        source: response.source,
        walkthrough: {
          ...BUNDLED_WALKTHROUGH,
          ...live,
          welcome: live.welcome?.length ? live.welcome : BUNDLED_WALKTHROUGH.welcome,
          setupLines: { ...BUNDLED_WALKTHROUGH.setupLines, ...live.setupLines },
          roadmap: live.roadmap?.chapters?.length ? live.roadmap : BUNDLED_WALKTHROUGH.roadmap,
          pageTour: live.pageTour?.length ? live.pageTour : BUNDLED_WALKTHROUGH.pageTour,
          finale: live.finale ?? BUNDLED_WALKTHROUGH.finale,
          steps: live.steps?.length ? live.steps : BUNDLED_WALKTHROUGH.steps,
        },
      })
    }).catch(() => { /* keep the bundled copy */ })
    return () => { alive = false }
  }, [enabled])
  return state
}
