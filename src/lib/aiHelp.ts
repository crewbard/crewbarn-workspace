/**
 * aiHelp — a tiny bridge so the floating AI Help bubble (and anything
 * else) can open the existing AI chat panel that lives inside
 * HeaderAiInput, optionally seeding it with a first message that
 * auto-sends. Mirrors the deleteConfirmHandler pattern.
 *
 * HeaderAiInput registers the opener on mount (only when AI is enabled).
 * Callers use openAiHelp(seed?) — if no opener is registered (AI off),
 * it's a no-op.
 */

// seedDisplay (optional) is the clean text shown in the chat as the user's
// bubble, while seedPrompt is the full instruction actually sent to the AI -
// so internal directives ("call lookup_how_to... do NOT guess") never leak
// into the visible conversation.
type AiHelpOpener = (seedPrompt?: string, seedDisplay?: string) => void

let opener: AiHelpOpener | null = null

export function setAiHelpOpener(fn: AiHelpOpener | null): void {
  opener = fn
}

export function openAiHelp(seedPrompt?: string, seedDisplay?: string): boolean {
  if (!opener) return false
  opener(seedPrompt, seedDisplay)
  return true
}

// ---- "Help me with this page" seed ----
// Shared by the floating CBI launcher AND the in-panel quick action so the
// page-help prompt lives in one place. `prompt` is the hidden directive that
// drives the lookup_how_to tool; `display` is the clean question the user sees.

export function pageHelpSeed(pathname: string): { prompt: string; display: string } {
  const { name, path } = describePage(pathname)
  return {
    prompt:
      `I'm on the "${name}" page in CrewBarn. Call the lookup_how_to tool with the ` +
      `query "${path}" to find what this page is for and its main task, then answer with detailed, ` +
      `numbered step-by-step instructions and the link. If lookup_how_to has no entry for this page, ` +
      `tell me you don't have specifics for it yet and point me to the closest ` +
      `area — do NOT guess or invent what the page does.`,
    display: `How does the ${name} page work?`,
  }
}

/**
 * Friendly page name from a path. Covers the top-level sections; falls back to
 * a title-cased last segment. The AI also has the how-to catalog server-side,
 * so this only needs to orient the conversation.
 */
export function describePage(pathname: string): { name: string; path: string } {
  const exact: Record<string, string> = {
    '/': 'Dashboard',
    '/jobs': 'Jobs',
    '/jobs/new': 'New Job',
    '/estimates': 'Estimates',
    '/estimates/new': 'New Estimate',
    '/customers': 'Customers',
    '/customers/new': 'New Customer',
    '/schedule': 'Schedule',
    '/dispatch': 'Dispatch',
    '/accounting': 'Accounting',
    '/reports': 'Reports',
    '/reports/sales-tax': 'Sales Tax Report',
    '/inventory': 'Inventory',
    '/assets': 'Assets',
    '/vendors': 'Vendors',
    '/purchase-orders': 'Purchase Orders',
    '/warranties': 'Warranties',
    '/custom-documents': 'Templates & Forms',
    '/communications': 'Messages',
  }
  if (exact[pathname]) return { name: exact[pathname], path: pathname }

  const seg = pathname.split('/').filter(Boolean)
  if (seg[0] === 'customers' && seg[1]) return { name: 'Customer detail', path: pathname }
  if (seg[0] === 'jobs' && seg[1]) return { name: 'Job detail', path: pathname }
  if (seg[0] === 'estimates' && seg[1]) return { name: 'Estimate detail', path: pathname }
  if (seg[0] === 'invoices' && seg[1]) return { name: 'Invoice detail', path: pathname }
  if (seg[0] === 'tool-shed') return { name: 'Tool Shed (settings)', path: pathname }
  if (seg[0] === 'catalog') return { name: 'Catalog', path: pathname }

  const label = seg.length
    ? seg[seg.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'this'
  return { name: label, path: pathname }
}

// ---- CBI read-back (text-to-speech) preference (localStorage) ----
// Off by default; when on, the CBI panel speaks each answer aloud.

const READBACK_KEY = 'crewbarn.cbi.readback'
const READBACK_VOICE_KEY = 'crewbarn.cbi.readbackVoice'
const READBACK_SPEED_KEY = 'crewbarn.cbi.readbackSpeed'
const READBACK_EVENT = 'crewbarn:cbiReadback'

export type ReadbackVoice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar'
export type ReadbackSpeed = 0.75 | 1 | 1.25 | 1.5

const READBACK_VOICES: ReadbackVoice[] = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar']
const READBACK_SPEEDS: ReadbackSpeed[] = [0.75, 1, 1.25, 1.5]

export function getReadbackEnabled(): boolean {
  try {
    return localStorage.getItem(READBACK_KEY) === 'on'
  } catch {
    return false
  }
}

export function setReadbackEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(READBACK_KEY, enabled ? 'on' : 'off')
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(READBACK_EVENT, { detail: enabled }))
}

export function getReadbackVoice(): ReadbackVoice {
  try {
    const voice = localStorage.getItem(READBACK_VOICE_KEY) as ReadbackVoice | null
    return voice && READBACK_VOICES.includes(voice) ? voice : 'marin'
  } catch {
    return 'marin'
  }
}

export function setReadbackVoice(voice: ReadbackVoice): void {
  try {
    localStorage.setItem(READBACK_VOICE_KEY, voice)
  } catch {
    /* private mode */
  }
}

export function getReadbackSpeed(): ReadbackSpeed {
  try {
    const speed = Number(localStorage.getItem(READBACK_SPEED_KEY)) as ReadbackSpeed
    return READBACK_SPEEDS.includes(speed) ? speed : 1
  } catch {
    return 1
  }
}

export function setReadbackSpeed(speed: ReadbackSpeed): void {
  try {
    localStorage.setItem(READBACK_SPEED_KEY, String(speed))
  } catch {
    /* private mode */
  }
}

// ---- Per-user "show AI Help bubble" preference (localStorage) ----

const STORAGE_KEY = 'crewbarn.aiHelpBubble.enabled'
const EVENT = 'crewbarn:aiHelpBubble'

export function getAiHelpEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setAiHelpEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    /* private mode */
  }
  // Notify listeners in the same tab (storage event only fires cross-tab).
  window.dispatchEvent(new CustomEvent(EVENT, { detail: enabled }))
}

export function onAiHelpEnabledChange(cb: (enabled: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as boolean)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

// ---- Chat-panel open state ----
// So the floating bubble can hide itself while the chat panel is open
// (otherwise the bubble overlaps the panel's send button). HeaderAiInput
// publishes this; AiHelpBubble subscribes.

const PANEL_EVENT = 'crewbarn:aiHelpPanel'
let panelOpen = false

export function setAiHelpPanelOpen(open: boolean): void {
  panelOpen = open
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: open }))
}

export function getAiHelpPanelOpen(): boolean {
  return panelOpen
}

export function onAiHelpPanelOpenChange(cb: (open: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as boolean)
  window.addEventListener(PANEL_EVENT, handler)
  return () => window.removeEventListener(PANEL_EVENT, handler)
}

// ---- Incoming-call toast state ----
// So the floating AI Help bubble steps aside while an incoming-call toast
// occupies the bottom-right corner — otherwise the two stack on top of each
// other. IncomingCallToasts publishes this; AiHelpBubble subscribes.

const CALL_TOAST_EVENT = 'crewbarn:callToast'
let callToastOpen = false

export function setCallToastOpen(open: boolean): void {
  callToastOpen = open
  window.dispatchEvent(new CustomEvent(CALL_TOAST_EVENT, { detail: open }))
}

export function getCallToastOpen(): boolean {
  return callToastOpen
}

export function onCallToastOpenChange(cb: (open: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as boolean)
  window.addEventListener(CALL_TOAST_EVENT, handler)
  return () => window.removeEventListener(CALL_TOAST_EVENT, handler)
}
