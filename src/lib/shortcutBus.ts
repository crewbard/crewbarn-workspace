/**
 * What the keyboard shortcuts talk to, kept apart from React.
 *
 * The listener (components/shortcuts/KeyboardShortcuts) is mounted once in
 * the work app. Pages tell it what E, M and Save mean on them, lists tell
 * it which records [ and ] step through, and the older single-key
 * listeners ("/", "?", Alt C) ask it whether it is in charge before acting
 * on their own, so a key someone moved or turned off stays moved or off.
 * On Connect it is not mounted, and those older listeners work as before.
 */

import type { RecordKind } from '@/lib/shortcuts'

export const OPEN_PALETTE_EVENT = 'cb:open-palette'
export const FOCUS_PAGE_SEARCH_EVENT = 'cb:focus-page-search'
export const FOCUS_CBI_EVENT = 'cb:focus-cbi'

// ------------------------------------------------------------ who is in charge

let host = false
let recording = false

export function setShortcutHost(on: boolean): void {
  host = on
}

/** True in the work app: the shortcut listener decides what a key does. */
export function shortcutHostActive(): boolean {
  return host
}

/** While someone is pressing a new key on the Keyboard shortcuts page, nothing else reacts. */
export function setRecordingShortcut(on: boolean): void {
  recording = on
}

export function recordingShortcut(): boolean {
  return recording
}

export function openPalette(): void {
  window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))
}

// ------------------------------------------------------------ this page's search box

let pageSearches = 0

/** A page search box counts itself in while it is on screen, so "/" only acts when there is one. */
export function addPageSearch(): () => void {
  pageSearches += 1
  return () => {
    pageSearches = Math.max(0, pageSearches - 1)
  }
}

export function hasPageSearch(): boolean {
  return pageSearches > 0
}

// ------------------------------------------------------------ the record on screen

export interface RecordHandlers {
  /** E: whatever editing means on this record. */
  edit?: () => void
  /** M: its messages. */
  messages?: () => void
  /** Ctrl/⌘ Enter when no form has the focus. Return false when there was nothing to save. */
  save?: () => boolean | void
}

const records: Array<{ token: object; handlers: () => RecordHandlers }> = []

/**
 * A page and a form on it can each say what they handle (the page E and M,
 * its edit form Save). For each key the newest registration that handles
 * it wins. The returned function takes the registration back out.
 */
export function pushRecordHandlers(handlers: () => RecordHandlers): () => void {
  const token = {}
  records.push({ token, handlers })
  return () => {
    const at = records.findIndex((r) => r.token === token)
    if (at >= 0) records.splice(at, 1)
  }
}

export function currentRecordHandlers(): RecordHandlers | null {
  if (records.length === 0) return null
  const out: RecordHandlers = {}
  for (let i = records.length - 1; i >= 0; i--) {
    const h = records[i].handlers()
    out.edit ??= h.edit
    out.messages ??= h.messages
    out.save ??= h.save
  }
  return out
}

// ------------------------------------------------------------ the list you came from

const LIST_KEY = (kind: RecordKind) => `cb.shortcuts.list.${kind}`
const KEEP = 500

/** The records a list is showing, in order, for [ and ] on the record pages. Per tab. */
export function rememberRecordList(kind: RecordKind, ids: string[]): void {
  if (ids.length === 0) return
  try {
    window.sessionStorage.setItem(LIST_KEY(kind), JSON.stringify(ids.slice(0, KEEP)))
  } catch {
    // Private mode or full: [ and ] just won't have a list.
  }
}

export function rememberedRecordList(kind: RecordKind): string[] | null {
  try {
    const raw = window.sessionStorage.getItem(LIST_KEY(kind))
    const ids = raw ? JSON.parse(raw) : null
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : null
  } catch {
    return null
  }
}
