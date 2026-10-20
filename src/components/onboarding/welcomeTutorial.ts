import { ACTIVE_TUTORIAL_SESSION_KEY, START_ACTIVE_TUTORIAL_EVENT, startActiveTutorial, tutorialsShown, type ActiveTutorialRequest } from '@/lib/activeTutorial'

/**
 * "Welcome to CrewBarn": the one film a new shop sees first, which then walks
 * every setup step on /onboarding (the `welcome` active tutorial).
 *
 * It plays by itself once, the first time setup opens in this browser, and
 * never again after it has been started or closed. Unticking "Show tutorials
 * on pages" in Help stops it playing by itself; the Watch the welcome button
 * always works.
 */

export const WELCOME_TUTORIAL_ID = 'welcome'
const STARTED_KEY = 'crewbarn:welcome-tutorial:started'

function alreadyStarted(): boolean {
  try { return localStorage.getItem(STARTED_KEY) === '1' } catch { return true }
}

function markStarted() {
  try { localStorage.setItem(STARTED_KEY, '1') } catch { /* private mode */ }
}

/** Is the welcome tutorial in progress in this tab (it carries on after a reload)? */
export function welcomeInProgress(): boolean {
  try {
    const raw = sessionStorage.getItem(ACTIVE_TUTORIAL_SESSION_KEY)
    return !!raw && (JSON.parse(raw) as { id?: string }).id === WELCOME_TUTORIAL_ID
  } catch {
    return false
  }
}

/** Play the welcome film, then the walk through setup. */
export function startWelcome() {
  markStarted()
  window.setTimeout(() => startActiveTutorial(WELCOME_TUTORIAL_ID), 0)
}

/** The first time setup opens: play it, once. Returns whether it started. */
export function maybeAutoStartWelcome(): boolean {
  if (alreadyStarted() || !tutorialsShown() || welcomeInProgress()) return false
  startWelcome()
  return true
}

/** Call `onStart` whenever the welcome tutorial starts, from anywhere. */
export function onWelcomeStart(onStart: () => void): () => void {
  const listener = (event: Event) => {
    if ((event as CustomEvent<ActiveTutorialRequest>).detail?.id === WELCOME_TUTORIAL_ID) onStart()
  }
  window.addEventListener(START_ACTIVE_TUTORIAL_EVENT, listener)
  return () => window.removeEventListener(START_ACTIVE_TUTORIAL_EVENT, listener)
}
