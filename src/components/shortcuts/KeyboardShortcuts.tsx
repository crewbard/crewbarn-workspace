import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import { useShortcutPrefs } from '@/hooks/useShortcuts'
import { openAiHelp } from '@/lib/aiHelp'
import { openCatalogs } from '@/lib/catalogs'
import {
  EMPTY_SEQUENCE,
  SEQUENCE_MS,
  SHORTCUTS,
  chordCaps,
  eventChord,
  firstOpenRoute,
  neighbourId,
  recordIdForPath,
  recordKindForPath,
  shortcutPageName,
  splitKeys,
  stepSequence,
  type Binding,
  type ShortcutDef,
  type SequenceState,
} from '@/lib/shortcuts'
import {
  FOCUS_CBI_EVENT,
  FOCUS_PAGE_SEARCH_EVENT,
  currentRecordHandlers,
  hasPageSearch,
  openPalette,
  recordingShortcut,
  rememberedRecordList,
  setShortcutHost,
} from '@/lib/shortcutBus'

/**
 * The work app's keyboard shortcuts, listening on every page.
 *
 * Mounted once in AppLayout. What each key does comes from lib/shortcuts
 * with this person's own keys on top. It listens before the page does, so
 * the M in G then M opens the dispatch map instead of also switching the
 * Schedule to a month.
 *
 * Never while typing in a box, or with a window open over the page, except
 * the few that are meant to work there (Search everything, CBI, Save).
 * Esc is left to whatever is open; it only cancels a half-typed G or N.
 */

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'number', 'password', 'tel', 'url', 'date', 'datetime-local', 'month', 'time', 'week'])

function isTyping(target: EventTarget | null): boolean {
  const el = (target instanceof Element ? target : null) ?? document.activeElement
  if (!el) return false
  if (el.closest('textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')) return true
  const input = el.closest('input')
  return !!input && TEXT_INPUT_TYPES.has((input.getAttribute('type') ?? '').toLowerCase())
}

function windowOpenOverPage(): boolean {
  return !!document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"], [data-shortcuts-pause]')
}

export function KeyboardShortcuts({ onHelp }: { onHelp: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { hasAny } = usePermissions()
  const { isRouteVisibleInWork } = useModuleVisibility()
  const { prefs, keys } = useShortcutPrefs()

  const [pending, setPending] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const sequence = useRef<SequenceState>(EMPTY_SEQUENCE)
  const pendingTimer = useRef<number | undefined>(undefined)
  const noticeTimer = useRef<number | undefined>(undefined)

  // Everything the key handler reads, current as of the last render.
  const latest = useRef({ prefs, keys, location, hasAny, isRouteVisibleInWork, navigate, onHelp })
  useEffect(() => {
    latest.current = { prefs, keys, location, hasAny, isRouteVisibleInWork, navigate, onHelp }
  })

  useEffect(() => {
    setShortcutHost(true)
    return () => setShortcutHost(false)
  }, [])

  // A new page forgets a half-typed G (the hint goes on its own a moment later).
  useEffect(() => {
    sequence.current = EMPTY_SEQUENCE
  }, [location.pathname])

  useEffect(() => {
    const say = (text: string) => {
      setNotice(text)
      window.clearTimeout(noticeTimer.current)
      noticeTimer.current = window.setTimeout(() => setNotice(null), 2600)
    }
    const clearPending = () => {
      window.clearTimeout(pendingTimer.current)
      setPending([])
    }

    const canOpenRoute = (r: { to: string; anyOf?: string[] }) => {
      const L = latest.current
      return (!r.anyOf || r.anyOf.length === 0 || L.hasAny(r.anyOf)) && L.isRouteVisibleInWork(r.to.split('?')[0])
    }

    const listStep = (step: -1 | 1): string | null => {
      const path = latest.current.location.pathname
      const kind = recordKindForPath(path)
      const id = recordIdForPath(path)
      if (!kind || !id) return null
      const ids = rememberedRecordList(kind)
      if (!ids || !ids.includes(id)) return null
      return neighbourId(ids, id, step) ?? ''
    }

    /** Can this shortcut do anything here and now? Unavailable ones let the key through. */
    const available = (def: ShortcutDef, typing: boolean, overlay: boolean): boolean => {
      if (def.fixed) return false
      if (typing && !def.whileTyping) return false
      if (overlay && !def.overDialogs) return false
      const record = currentRecordHandlers()
      switch (def.command) {
        case 'search': return hasPageSearch()
        case 'edit': return !!record?.edit
        case 'messages': return !!record?.messages
        case 'prev': return listStep(-1) !== null
        case 'next': return listStep(1) !== null
        default: return true
      }
    }

    /** Do it. False when there turned out to be nothing to do, so the key goes on to the page. */
    const run = (def: ShortcutDef): boolean => {
      const L = latest.current
      if (def.routes) {
        const to = firstOpenRoute(def, canOpenRoute)
        if (!to) say(`You don't have access to ${shortcutPageName(def)}.`)
        else L.navigate(to)
        return true
      }
      switch (def.command) {
        case 'palette':
          openPalette()
          return true
        case 'cbi':
          if (!openAiHelp()) say('CBI isn’t set up for your company yet.')
          else window.setTimeout(() => window.dispatchEvent(new CustomEvent(FOCUS_CBI_EVENT)), 0)
          return true
        case 'search':
          window.dispatchEvent(new CustomEvent(FOCUS_PAGE_SEARCH_EVENT))
          return true
        case 'help':
          L.onHelp()
          return true
        case 'catalogs':
          if (def.anyOf && !L.hasAny(def.anyOf)) say('You don\'t have access to the catalogs.')
          else openCatalogs()
          return true
        case 'edit': {
          const fn = currentRecordHandlers()?.edit
          if (!fn) return false
          fn()
          return true
        }
        case 'messages': {
          const fn = currentRecordHandlers()?.messages
          if (!fn) return false
          fn()
          return true
        }
        case 'prev':
        case 'next': {
          const step = def.command === 'prev' ? -1 : 1
          const target = listStep(step)
          if (target === null) return false
          if (target === '') {
            say(step === -1 ? 'That’s the first one in your list.' : 'That’s the last one in your list.')
            return true
          }
          const kind = recordKindForPath(L.location.pathname)
          L.navigate(`/${kind}/${encodeURIComponent(target)}`)
          return true
        }
        case 'save': {
          // The form you're in first (a window's form included), then the page's own save.
          const form = (document.activeElement as HTMLElement | null)?.closest?.('form')
          if (form) {
            form.requestSubmit()
            return true
          }
          const save = currentRecordHandlers()?.save
          if (save) return save() !== false
          return false
        }
        default:
          return false
      }
    }

    const onKey = (e: KeyboardEvent) => {
      const L = latest.current
      if (!L.prefs.enabled || recordingShortcut()) return
      if (e.defaultPrevented || e.isComposing || e.repeat) return
      const chord = eventChord(e)
      if (!chord) return

      if (chord === 'Escape') {
        if (sequence.current.pending.length > 0) {
          sequence.current = EMPTY_SEQUENCE
          clearPending()
        }
        return
      }

      const typing = isTyping(e.target)
      const overlay = windowOpenOverPage()
      const bindings: Binding[] = []
      for (const def of SHORTCUTS) {
        const seq = splitKeys(L.keys[def.id] ?? '')
        if (seq.length === 0 || !available(def, typing, overlay)) continue
        bindings.push({ id: def.id, seq })
      }

      const { state, result } = stepSequence(sequence.current, chord, bindings, Date.now())
      sequence.current = state

      if (result.kind === 'wait') {
        e.preventDefault()
        e.stopImmediatePropagation()
        setPending(result.pending)
        window.clearTimeout(pendingTimer.current)
        pendingTimer.current = window.setTimeout(() => {
          sequence.current = EMPTY_SEQUENCE
          setPending([])
        }, SEQUENCE_MS)
        return
      }
      clearPending()
      if (result.kind !== 'match') return
      const def = SHORTCUTS.find((s) => s.id === result.id)
      if (!def) return
      if (run(def)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.clearTimeout(pendingTimer.current)
      window.clearTimeout(noticeTimer.current)
    }
  }, [])

  if (pending.length === 0 && !notice) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 print:hidden" role="status" aria-live="polite">
      {pending.length > 0 && (
        <div data-tour="shortcut-hint" className="rounded-full bg-slate-900/90 px-3 py-1 text-sm font-semibold text-white shadow-lg">
          {pending.map((c) => chordCaps(c).join(' ')).join(' ')}…
        </div>
      )}
      {notice && (
        <div className="max-w-sm rounded-lg bg-slate-900/90 px-4 py-2 text-center text-sm text-white shadow-lg">
          {notice}
        </div>
      )}
    </div>,
    document.body,
  )
}
