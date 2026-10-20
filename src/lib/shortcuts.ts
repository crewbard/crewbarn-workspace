/**
 * Keyboard shortcuts: every one the work app has, in one list.
 *
 * Help, the Keyboard shortcuts page, the printed cheat sheet and the
 * listener that acts on a key press all read this list, so what a page
 * says a key does and what the key does cannot drift apart.
 *
 * How keys are written:
 *
 *   "Mod+K"     Ctrl K on Windows and Linux, ⌘K on a Mac
 *   "Alt+Space" Alt (⌥ on a Mac) and the space bar
 *   "G J"       G, let go, then J (a sequence; the second key within
 *               SEQUENCE_MS of the first)
 *   "?"  "/"    the character itself, wherever it sits on this keyboard
 *
 * Letters and digits are matched by the key's place (KeyboardEvent.code),
 * so G J works the same on a French or German keyboard, and with Alt held
 * on a Mac (where the letter typed is a symbol). Punctuation is matched by
 * the character it types, because that is what is printed on the key.
 *
 * Kept free of imports so the unit tests can load it on its own.
 */

export type ShortcutGroup = 'open' | 'goto' | 'new' | 'record'

export const SHORTCUT_GROUPS: Array<{ id: ShortcutGroup; label: string; blurb: string }> = [
  { id: 'open', label: 'Open fast', blurb: 'Search, CBI, Help and the catalogs, from any page.' },
  { id: 'goto', label: 'Go to', blurb: 'Press G, let go, then the letter.' },
  { id: 'new', label: 'New', blurb: 'Press N, let go, then the letter.' },
  { id: 'record', label: 'On a record', blurb: 'On a job, estimate, customer or invoice.' },
]

export type ShortcutCommand =
  | 'palette' | 'cbi' | 'search' | 'help' | 'catalogs' | 'close'
  | 'edit' | 'messages' | 'prev' | 'next' | 'save'

export interface ShortcutRoute {
  /** Where it goes. */
  to: string
  /** The person needs any one of these. None: everyone signed in. */
  anyOf?: string[]
}

export interface ShortcutDef {
  id: string
  group: ShortcutGroup
  /** What it does, in a few words. */
  label: string
  /** The keys it ships with. */
  keys: string
  /** A page: the first of these the person may open. */
  routes?: ShortcutRoute[]
  /** Anything that isn't a page. */
  command?: ShortcutCommand
  /** Needed for a command (any one of). */
  anyOf?: string[]
  /** The page's name, for "You don't have access to …". */
  page?: string
  /** Also works while typing in a box (these all need Ctrl, ⌘ or Alt). */
  whileTyping?: boolean
  /** Also works with a window open over the page. */
  overDialogs?: boolean
  /** Shown in the list, but can't be changed or turned off. */
  fixed?: boolean
  /** A little more, shown under the label. */
  note?: string
}

export const SHORTCUTS: ShortcutDef[] = [
  // Open fast
  { id: 'palette', group: 'open', label: 'Search everything', keys: 'Mod+K', command: 'palette', whileTyping: true, overDialogs: true, note: 'Jobs, customers, estimates, invoices, pages and settings. Or ask CBI.' },
  { id: 'cbi', group: 'open', label: 'Ask CBI anything', keys: 'Alt+Space', command: 'cbi', whileTyping: true, overDialogs: true },
  { id: 'search', group: 'open', label: 'Jump to this page’s search box', keys: '/', command: 'search' },
  { id: 'help', group: 'open', label: 'Help, and this list', keys: '?', command: 'help' },
  { id: 'catalogs', group: 'open', label: 'Open the catalogs', keys: 'Alt+C', command: 'catalogs', anyOf: ['catalog.view'], whileTyping: true },
  { id: 'close', group: 'open', label: 'Close what’s open', keys: 'Escape', command: 'close', fixed: true },

  // Go to
  { id: 'go-dashboard', group: 'goto', label: 'Dashboard', keys: 'G D', routes: [{ to: '/' }] },
  { id: 'go-jobs', group: 'goto', label: 'Jobs', keys: 'G J', routes: [{ to: '/jobs', anyOf: ['jobs.view'] }] },
  { id: 'go-schedule', group: 'goto', label: 'Schedule', keys: 'G S', routes: [{ to: '/schedule', anyOf: ['jobs.view'] }] },
  { id: 'go-dispatch', group: 'goto', label: 'Dispatch map', keys: 'G M', routes: [{ to: '/dispatch', anyOf: ['jobs.view'] }], page: 'Dispatch' },
  { id: 'go-customers', group: 'goto', label: 'Customers', keys: 'G C', routes: [{ to: '/customers', anyOf: ['customers.view'] }] },
  { id: 'go-estimates', group: 'goto', label: 'Estimates', keys: 'G E', routes: [{ to: '/estimates', anyOf: ['jobs.view'] }] },
  { id: 'go-invoices', group: 'goto', label: 'Invoices', keys: 'G I', routes: [{ to: '/accounting/invoices', anyOf: ['invoices.view'] }] },
  { id: 'go-tasks', group: 'goto', label: 'Tasks and daily duties', keys: 'G T', routes: [{ to: '/tasks', anyOf: ['tasks.view', 'jobs.view', 'customers.view'] }], page: 'Tasks' },
  { id: 'go-parts', group: 'goto', label: 'Parts', keys: 'G P', routes: [{ to: '/inventory', anyOf: ['inventory.view'] }, { to: '/order-parts', anyOf: ['inventory.order', 'inventory.edit', 'jobs.edit'] }], note: 'Your parts and stock, or Order parts if that is the one you can open.' },
  { id: 'go-catalogs', group: 'goto', label: 'Catalogs', keys: 'G B', routes: [{ to: '/catalogs', anyOf: ['catalog.view'] }] },
  { id: 'go-accounting', group: 'goto', label: 'Accounting (Money desk)', keys: 'G A', routes: [{ to: '/accounting', anyOf: ['invoices.view'] }], page: 'Accounting' },
  { id: 'go-messages', group: 'goto', label: 'Messages', keys: 'G X', routes: [{ to: '/communications', anyOf: ['customers.view'] }] },
  { id: 'go-calls', group: 'goto', label: 'Calls', keys: 'G L', routes: [{ to: '/calls', anyOf: ['calls.view'] }] },
  { id: 'go-intake', group: 'goto', label: 'Intake queue', keys: 'G K', routes: [{ to: '/intake', anyOf: ['customers.view'] }] },
  { id: 'go-toolshed', group: 'goto', label: 'Tool Shed', keys: 'G O', routes: [{ to: '/tool-shed', anyOf: ['settings.view'] }] },

  // New
  { id: 'new-job', group: 'new', label: 'New job', keys: 'N J', routes: [{ to: '/jobs/new', anyOf: ['jobs.edit'] }], page: 'new jobs' },
  { id: 'new-estimate', group: 'new', label: 'New estimate', keys: 'N E', routes: [{ to: '/estimates/new', anyOf: ['jobs.edit'] }], page: 'new estimates' },
  { id: 'new-customer', group: 'new', label: 'New customer', keys: 'N C', routes: [{ to: '/customers/new', anyOf: ['customers.edit'] }], page: 'new customers' },
  { id: 'new-task', group: 'new', label: 'New to-do', keys: 'N T', routes: [{ to: '/tasks?new=1', anyOf: ['tasks.edit'] }], page: 'new to-dos' },
  { id: 'new-po', group: 'new', label: 'New purchase order', keys: 'N P', routes: [{ to: '/purchase-orders/new', anyOf: ['inventory.edit'] }], page: 'new purchase orders' },
  { id: 'new-agreement', group: 'new', label: 'New service agreement', keys: 'N A', routes: [{ to: '/maintenance-contracts/new', anyOf: ['contracts.edit'] }], page: 'new service agreements' },

  // On a record
  { id: 'record-edit', group: 'record', label: 'Edit it', keys: 'E', command: 'edit' },
  { id: 'record-messages', group: 'record', label: 'Its messages', keys: 'M', command: 'messages' },
  { id: 'record-prev', group: 'record', label: 'Previous one in your list', keys: '[', command: 'prev', note: 'The list you opened it from.' },
  { id: 'record-next', group: 'record', label: 'Next one in your list', keys: ']', command: 'next', note: 'The list you opened it from.' },
  { id: 'record-save', group: 'record', label: 'Save', keys: 'Mod+Enter', command: 'save', whileTyping: true, overDialogs: true, note: 'On any page or form with a save.' },
]

/** How long after G (or N) the second key still counts. */
export const SEQUENCE_MS = 1200

export function shortcutById(id: string): ShortcutDef | undefined {
  return SHORTCUTS.find((s) => s.id === id)
}

// ------------------------------------------------------------ keys

const MODS = ['Mod', 'Ctrl', 'Alt', 'Shift', 'Meta'] as const
type Mod = (typeof MODS)[number]

const NAMED = new Set([
  'Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
])

const IGNORED = new Set(['Control', 'Meta', 'Alt', 'Shift', 'AltGraph', 'CapsLock', 'Dead', 'Unidentified', 'Process', 'OS', 'Fn'])

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const p = nav.userAgentData?.platform || nav.platform || ''
  return /Mac|iPhone|iPad|iPod/i.test(p)
}

/** The bits of a KeyboardEvent this file reads. */
export interface KeyLike {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  getModifierState?: (key: string) => boolean
}

/** Letters, digits and named keys: Shift counts for these. For "?" it's already in the character. */
function shiftMatters(token: string): boolean {
  return /^[A-Z0-9]$/.test(token) || NAMED.has(token)
}

/**
 * The chord a key press makes, written the way bindings are ("Mod+K",
 * "G", "?"), or null for a modifier pressed on its own.
 */
export function eventChord(e: KeyLike, mac = isMacPlatform()): string | null {
  if (!e.key || IGNORED.has(e.key)) return null
  const altGrHeld = !!e.getModifierState?.('AltGraph') || (!mac && e.ctrlKey && e.altKey)
  let token: string
  const letter = /^Key([A-Z])$/.exec(e.code || '')
  // The number row types punctuation on some keyboards ("[" is AltGr 8 on a
  // German one, "&" is the 1 key on a French one): then the character is the key.
  const digit = /^Digit([0-9])$/.exec(e.code || '')
  const digitTypesChar = !!digit && e.key.length === 1 && !/[0-9]/.test(e.key) && (altGrHeld || (!e.ctrlKey && !e.metaKey && !e.altKey))
  if (letter) token = letter[1]
  else if (digit && !digitTypesChar) token = digit[1]
  else if (e.code === 'Space' || e.key === ' ') token = 'Space'
  else if (e.key === 'Esc') token = 'Escape'
  else if (NAMED.has(e.key)) token = e.key
  else if (e.key.length === 1) token = e.key.toUpperCase()
  else return null

  const symbol = !shiftMatters(token)
  // AltGr (Ctrl and Alt together on Windows) types the character on many
  // keyboards — "[" on a German one. The character is the key, not a chord.
  const altGr = symbol && altGrHeld

  const mods: Mod[] = []
  if (mac) {
    if (e.metaKey) mods.push('Mod')
    if (e.ctrlKey) mods.push('Ctrl')
  } else {
    if (e.ctrlKey && !altGr) mods.push('Mod')
    if (e.metaKey) mods.push('Meta')
  }
  if (e.altKey && !altGr) mods.push('Alt')
  if (e.shiftKey && !symbol) mods.push('Shift')
  return joinChord(mods, token)
}

function joinChord(mods: Iterable<string>, token: string): string {
  const set = new Set(mods)
  return [...MODS.filter((m) => set.has(m)), token].join('+')
}

/** A chord's modifiers and key. "Mod++" works: the key is what's left. */
export function parseChord(chord: string): { mods: Set<Mod>; token: string } {
  const mods = new Set<Mod>()
  let rest = chord.trim()
  for (;;) {
    const m = /^(Mod|Ctrl|Control|Cmd|Command|Alt|Option|Shift|Meta)\+(.+)$/i.exec(rest)
    if (!m) break
    const name = m[1].toLowerCase()
    mods.add(name === 'mod' || name === 'cmd' || name === 'command' ? 'Mod'
      : name === 'ctrl' || name === 'control' ? 'Ctrl'
      : name === 'alt' || name === 'option' ? 'Alt'
      : name === 'shift' ? 'Shift' : 'Meta')
    rest = m[2]
  }
  let token = rest
  if (/^esc$/i.test(token)) token = 'Escape'
  else if (/^space$/i.test(token)) token = 'Space'
  else if (/^return$/i.test(token)) token = 'Enter'
  else if (token.length === 1) token = token.toUpperCase()
  else {
    const named = [...NAMED].find((n) => n.toLowerCase() === token.toLowerCase())
    if (named) token = named
  }
  return { mods, token }
}

export function normalizeChord(chord: string): string {
  const { mods, token } = parseChord(chord)
  return joinChord(mods, token)
}

export function splitKeys(keys: string): string[] {
  return (keys || '').trim().split(/\s+/).filter(Boolean)
}

/** "g j" -> "G J"; "mod+k" -> "Mod+K"; "" stays "" (turned off). */
export function normalizeKeys(keys: string): string {
  return splitKeys(keys).map(normalizeChord).join(' ')
}

const MAC_MOD: Record<string, string> = { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘' }
const PC_MOD: Record<string, string> = { Mod: 'Ctrl', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win' }
const TOKEN_LABEL: Record<string, string> = {
  Escape: 'Esc', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  PageUp: 'Page Up', PageDown: 'Page Down',
}

/** One chord as the keys printed on a keyboard: ["Ctrl", "K"] or ["⌘", "K"]. */
export function chordCaps(chord: string, mac = isMacPlatform()): string[] {
  const { mods, token } = parseChord(chord)
  const names = mac ? MAC_MOD : PC_MOD
  const caps = MODS.filter((m) => mods.has(m)).map((m) => names[m])
  caps.push(TOKEN_LABEL[token] ?? (token === 'Enter' && mac ? 'Return' : token))
  return caps
}

/** A whole binding as key caps, one group per chord. */
export function keyCaps(keys: string, mac = isMacPlatform()): string[][] {
  return splitKeys(keys).map((c) => chordCaps(c, mac))
}

/** Plain words: "Ctrl K", "G then J", "⌘K". */
export function describeKeys(keys: string, mac = isMacPlatform()): string {
  const chords = keyCaps(keys, mac)
  if (chords.length === 0) return 'Off'
  return chords.map((c) => c.join(mac ? '' : ' ')).join(' then ')
}

// ------------------------------------------------------------ what a person chose

export interface ShortcutPrefs {
  /** All shortcuts on or off. */
  enabled: boolean
  /** Only the ones changed from the defaults. "" = that one is off. */
  bindings: Record<string, string>
}

export const DEFAULT_PREFS: ShortcutPrefs = { enabled: true, bindings: {} }

/** Tidy what came back from the server or this browser. Unknown ids and junk are dropped. */
export function cleanPrefs(raw: unknown): ShortcutPrefs {
  if (!raw || typeof raw !== 'object') return { enabled: true, bindings: {} }
  const r = raw as { enabled?: unknown; bindings?: unknown }
  const bindings: Record<string, string> = {}
  if (r.bindings && typeof r.bindings === 'object' && !Array.isArray(r.bindings)) {
    for (const [id, keys] of Object.entries(r.bindings as Record<string, unknown>)) {
      const def = shortcutById(id)
      if (!def || def.fixed || typeof keys !== 'string') continue
      const k = normalizeKeys(keys)
      if (k !== normalizeKeys(def.keys)) bindings[id] = k
    }
  }
  return { enabled: r.enabled !== false, bindings }
}

/** Every shortcut's keys as they are now: the defaults with the person's changes on top. */
export function effectiveKeys(prefs: ShortcutPrefs): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of SHORTCUTS) {
    const own = s.fixed ? undefined : prefs.bindings[s.id]
    out[s.id] = normalizeKeys(own !== undefined ? own : s.keys)
  }
  return out
}

// ------------------------------------------------------------ conflicts and rules

function startsWith(seq: string[], prefix: string[]): boolean {
  return prefix.length <= seq.length && prefix.every((c, i) => seq[i] === c)
}

/**
 * Which shortcuts can't both work: the same keys, or one is the start of
 * the other (E, and E then X, would never get to the X).
 */
export function findConflicts(keys: Record<string, string>): Record<string, string[]> {
  const ids = Object.keys(keys).filter((id) => splitKeys(keys[id]).length > 0)
  const out: Record<string, string[]> = {}
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = splitKeys(keys[ids[i]])
      const b = splitKeys(keys[ids[j]])
      if (startsWith(a, b) || startsWith(b, a)) {
        (out[ids[i]] ??= []).push(ids[j])
        ;(out[ids[j]] ??= []).push(ids[i])
      }
    }
  }
  return out
}

/** What the browser or the computer already uses. Taking these breaks something people rely on. */
export const RESERVED_CHORDS: string[] = [
  'Mod+T', 'Mod+W', 'Mod+N', 'Mod+Q', 'Mod+R', 'Mod+L', 'Mod+P', 'Mod+F', 'Mod+G', 'Mod+H', 'Mod+M',
  'Mod+C', 'Mod+V', 'Mod+X', 'Mod+A', 'Mod+Z', 'Mod+Y', 'Mod+S', 'Mod+O', 'Mod+D', 'Mod+J', 'Mod+U', 'Mod+E',
  'Mod+Shift+T', 'Mod+Shift+N', 'Mod+Shift+W', 'Mod+Shift+Z', 'Mod+Shift+I', 'Mod+Shift+J', 'Mod+Shift+B', 'Mod+Shift+Delete',
  'Mod+Tab', 'Mod+Shift+Tab', 'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Alt+Tab', 'Alt+F4', 'Mod+=', 'Mod+-', 'Mod+0',
  'Alt+ArrowLeft', 'Alt+ArrowRight', 'Mod+ArrowLeft', 'Mod+ArrowRight', 'Mod+[', 'Mod+]',
  'Mod+1', 'Mod+2', 'Mod+3', 'Mod+4', 'Mod+5', 'Mod+6', 'Mod+7', 'Mod+8', 'Mod+9',
  'F1', 'F3', 'F5', 'F6', 'F7', 'F11', 'F12', 'Mod+F5', 'Shift+F5',
  'Tab', 'Shift+Tab', 'Escape', 'Enter', 'Shift+Enter', 'Space', 'Backspace', 'Delete',
].map(normalizeChord)

function hasModifier(chord: string): boolean {
  const { mods } = parseChord(chord)
  return mods.has('Mod') || mods.has('Ctrl') || mods.has('Alt') || mods.has('Meta')
}

/**
 * Whether these keys may be used for this shortcut: a sentence for the
 * person when they can't, null when they can. "" (off) is always allowed.
 */
export function checkKeys(def: ShortcutDef, keys: string, mac = isMacPlatform()): string | null {
  const chords = splitKeys(normalizeKeys(keys))
  if (chords.length === 0) return null
  if (def.fixed) return 'This one can’t be changed.'
  if (chords.length > 2) return 'Use one key, or two pressed one after the other.'
  for (const c of chords) {
    if (RESERVED_CHORDS.includes(c)) {
      return `${describeKeys(c, mac)} is already used by your browser or computer. Pick another.`
    }
  }
  if (def.whileTyping && !hasModifier(chords[0])) {
    return `This one also works while you type, so it needs ${mac ? '⌘, ⌃ or ⌥' : 'Ctrl or Alt'} with it.`
  }
  if ((def.group === 'goto' || def.group === 'new') && chords.length === 1 && !hasModifier(chords[0])) {
    return 'Opening a page needs two keys, like G then J, or a key with Ctrl or Alt, so one stray key never takes you away.'
  }
  return null
}

// ------------------------------------------------------------ sequences

export interface Binding {
  id: string
  /** Normalized chords, in order. */
  seq: string[]
}

export interface SequenceState {
  /** Chords pressed so far that start a longer shortcut. */
  pending: string[]
  /** When the last one was pressed (ms). */
  at: number
}

export type SequenceResult =
  | { kind: 'match'; id: string }
  | { kind: 'wait'; pending: string[] }
  | { kind: 'none' }

export const EMPTY_SEQUENCE: SequenceState = { pending: [], at: 0 }

export function toBindings(keys: Record<string, string>): Binding[] {
  return Object.entries(keys)
    .map(([id, k]) => ({ id, seq: splitKeys(k) }))
    .filter((b) => b.seq.length > 0)
}

/**
 * One key press through the sequence matcher. Pure: give it back the
 * state it returned last time. It waits for the next key when what has
 * been pressed starts a longer shortcut. A key that doesn't continue the
 * sequence starts over from that key, so G, a stray key, then G J still
 * works, and a wait longer than timeoutMs forgets the first key.
 */
export function stepSequence(
  state: SequenceState,
  chord: string,
  bindings: Binding[],
  now: number,
  timeoutMs = SEQUENCE_MS,
): { state: SequenceState; result: SequenceResult } {
  const fresh = state.pending.length > 0 && now - state.at <= timeoutMs ? state.pending : []
  const look = (pressed: string[]) => ({
    pressed,
    exact: bindings.find((b) => b.seq.length === pressed.length && startsWith(b.seq, pressed)),
    longer: bindings.some((b) => b.seq.length > pressed.length && startsWith(b.seq, pressed)),
  })

  let r = look([...fresh, chord])
  if (!r.exact && !r.longer && fresh.length > 0) r = look([chord])
  if (r.exact) return { state: EMPTY_SEQUENCE, result: { kind: 'match', id: r.exact.id } }
  if (r.longer) return { state: { pending: r.pressed, at: now }, result: { kind: 'wait', pending: r.pressed } }
  return { state: EMPTY_SEQUENCE, result: { kind: 'none' } }
}

// ------------------------------------------------------------ pages and records

/** "You don't have access to Accounting": the name for a page shortcut. */
export function shortcutPageName(def: ShortcutDef): string {
  return def.page ?? def.label
}

/** The first route this person may open, or null. */
export function firstOpenRoute(def: ShortcutDef, canOpen: (route: ShortcutRoute) => boolean): string | null {
  for (const r of def.routes ?? []) if (canOpen(r)) return r.to
  return null
}

export type RecordKind = 'jobs' | 'estimates' | 'customers' | 'invoices'

/** The kind of record a page shows, for E, M, [ and ]: "jobs" for /jobs/abc. */
export function recordKindForPath(path: string): RecordKind | null {
  const m = /^\/(jobs|estimates|customers|invoices)\/([^/?#]+)\/?$/.exec(path)
  if (!m || m[2] === 'new' || m[2] === 'search') return null
  return m[1] as RecordKind
}

export function recordIdForPath(path: string): string | null {
  if (!recordKindForPath(path)) return null
  return decodeURIComponent(/^\/[^/]+\/([^/?#]+)/.exec(path)?.[1] ?? '')
}

/** The id before or after this one in a remembered list: null at either end, or when it isn't in it. */
export function neighbourId(ids: string[], current: string, step: -1 | 1): string | null {
  const at = ids.indexOf(current)
  if (at < 0) return null
  return ids[at + step] ?? null
}
