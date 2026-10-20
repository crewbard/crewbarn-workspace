import type { ReactNode } from 'react'
import type { useNavigate } from 'react-router-dom'
import type { TourCondition, TourContext, TutorialData, TutorialLiveStep } from '@/lib/tutorials/types'

export type TutorialNavigate = ReturnType<typeof useNavigate>

/**
 * Everything the player needs for one tutorial: its words and steps (data),
 * how its film scenes are drawn, and any `open` / `doIt` actions of its own
 * beyond the built-in `goto:`, `click:` and `first:`.
 */
export interface TutorialScript {
  data: TutorialData
  /** How many pieces each film scene builds up in, by scene id. */
  reveal: Record<string, number>
  Visual: (props: { id: string; shown: number }) => ReactNode
  /** CSS for the film's drawings (class names prefixed per tutorial). */
  css: string
  actions?: Record<string, (navigate: TutorialNavigate) => void>
}

/** First element matching the selector that is actually on screen. */
export function findVisible(selector: string): HTMLElement | null {
  let all: NodeListOf<HTMLElement>
  try { all = document.querySelectorAll<HTMLElement>(selector) } catch { return null }
  for (const el of Array.from(all)) {
    const box = el.getBoundingClientRect()
    if (box.width > 0 && box.height > 0) return el
  }
  return null
}

/**
 * Whether a tab, view button or opener is already on: pressed or selected
 * (aria-pressed / aria-selected), opened (aria-expanded), or the summary of
 * an open <details>. A step's `click` is only pressed when it isn't.
 */
export function isAlreadyOn(el: HTMLElement): boolean {
  if (el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-expanded') === 'true') return true
  const details = el.tagName === 'SUMMARY' ? el.parentElement : null
  return details instanceof HTMLDetailsElement && details.open
}

/** The page as it is right now, for a step's `when`. */
export function tourContext(): TourContext {
  return {
    path: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    find: findVisible,
    text: (selector: string) => findVisible(selector)?.textContent?.trim() ?? '',
  }
}

/** A `when`: a selector on screen, `!selector` not on screen, or a function of the page. */
export function conditionHolds(condition: TourCondition | undefined, page: TourContext): boolean {
  if (condition == null) return true
  try {
    if (typeof condition === 'function') return !!condition(page)
    const negate = condition.startsWith('!')
    const found = !!page.find(negate ? condition.slice(1) : condition)
    return negate ? !found : found
  } catch {
    return false
  }
}

/** What a step says and lights up, given what is on screen. */
export interface ResolvedStep {
  title: string
  say: string
  selector?: string
}

/**
 * The step as it plays on this page right now: null when its `when` doesn't
 * hold, or when it only has words for variants and none of them match.
 */
export function resolveStep(step: TutorialLiveStep, page: TourContext = tourContext()): ResolvedStep | null {
  if (!conditionHolds(step.when, page)) return null
  const variant = step.variants?.find((v) => conditionHolds(v.when, page))
  const say = (variant?.say ?? step.say).trim()
  if (!say) return null
  return { title: variant?.title ?? step.title, say, selector: variant?.selector ?? step.selector }
}

/**
 * Whether a step will play, as far as the page can tell now. Steps for
 * another page are counted (they can't be checked from here); a part that
 * isn't on screen counts when the step opens it or waits for it.
 */
export function stepWillPlay(step: TutorialLiveStep, page: TourContext = tourContext()): boolean {
  if (step.intro) return false
  if (step.route && !new RegExp(step.route).test(page.path)) return true
  const resolved = resolveStep(step, page)
  if (!resolved) return false
  if (!resolved.selector) return true
  return !!page.find(resolved.selector) || !!step.click || !!step.open || step.waitMs != null
}
