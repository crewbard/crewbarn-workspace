import { useEffect, useMemo, useRef, useState } from 'react'
import { openHelpTopic } from '@/lib/helpTopics'
import {
  SHORTCUTS,
  SHORTCUT_GROUPS,
  checkKeys,
  describeKeys,
  eventChord,
  findConflicts,
  keyCaps,
  normalizeKeys,
  type ShortcutDef,
  type ShortcutPrefs,
} from '@/lib/shortcuts'
import { setRecordingShortcut } from '@/lib/shortcutBus'
import { useShortcutAccess, useShortcutPrefs } from '@/hooks/useShortcuts'
import { Keys } from '@/components/shortcuts/Keys'

/**
 * My account → Keyboard shortcuts (/me/keyboard-shortcuts).
 *
 * Every shortcut, grouped the way Help lists them. Each person can turn
 * them all off, change any key (press the new one), turn one off, or go
 * back to the defaults, and print a cheat sheet. Saved on their account.
 */
export function KeyboardShortcutsPage() {
  const { prefs, keys, save, saving, saveFailed } = useShortcutPrefs()
  const canUse = useShortcutAccess()
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const conflicts = useMemo(() => findConflicts(keys), [keys])
  const changedCount = Object.keys(prefs.bindings).length

  const commit = async (next: ShortcutPrefs, note: string) => {
    setSavedNote(null)
    try {
      await save(next)
      setSavedNote(note)
    } catch {
      // saveFailed shows the message; the change is kept in this browser.
    }
  }

  const setKeys = (def: ShortcutDef, value: string | null) => {
    const bindings = { ...prefs.bindings }
    if (value === null || normalizeKeys(value) === normalizeKeys(def.keys)) delete bindings[def.id]
    else bindings[def.id] = normalizeKeys(value)
    void commit({ ...prefs, bindings }, value === '' ? `${def.label} is off.` : value === null ? `${def.label} is back to ${describeKeys(def.keys)}.` : `${def.label} is now ${describeKeys(value)}.`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div data-tour="kbd-header">
        <h1 className="text-2xl font-bold text-navy-900">Keyboard shortcuts</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Get around CrewBarn without reaching for the mouse. Your keys follow you to any computer you sign in on.
        </p>
      </div>

      <div data-tour="kbd-toggle" className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="flex flex-1 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            role="switch"
            checked={prefs.enabled}
            onChange={(e) => void commit({ ...prefs, enabled: e.target.checked }, e.target.checked ? 'Keyboard shortcuts are on.' : 'Keyboard shortcuts are off.')}
            className="h-5 w-5 rounded border-slate-300 accent-amber-500"
          />
          <span>
            <span className="block text-sm font-semibold text-navy-900">Use keyboard shortcuts</span>
            <span className="block text-xs text-slate-500">Turn this off if keys keep doing things you didn’t mean. The buttons all still work.</span>
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-tour="kbd-print" onClick={() => printCheatSheet(keys, canUse)} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-navy-900 hover:border-amber-300">
            Print cheat sheet
          </button>
          <button
            type="button"
            data-tour="kbd-reset-all"
            disabled={changedCount === 0}
            onClick={() => void commit({ ...prefs, bindings: {} }, 'Every shortcut is back to its usual keys.')}
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-navy-900 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Reset all to the usual keys
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
        {saveFailed ? (
          <span className="text-red-700">That didn’t save to your account. It works on this computer for now; try again in a moment.</span>
        ) : saving ? (
          <span className="text-slate-500">Saving…</span>
        ) : savedNote ? (
          <span className="text-emerald-700">✓ {savedNote}</span>
        ) : null}
      </div>

      <div className={prefs.enabled ? 'space-y-6' : 'space-y-6 opacity-60'}>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.id} data-tour={`kbd-group-${group.id}`} className="rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-base font-semibold text-navy-900">{group.label}</h2>
              <p className="text-xs text-slate-500">{group.blurb}</p>
            </header>
            <ul className="divide-y divide-slate-100">
              {SHORTCUTS.filter((s) => s.group === group.id).map((def) => (
                <ShortcutRow
                  key={def.id}
                  def={def}
                  keys={keys[def.id]}
                  changed={def.id in prefs.bindings}
                  usable={canUse(def)}
                  clashesWith={(conflicts[def.id] ?? []).map((id) => SHORTCUTS.find((s) => s.id === id)?.label ?? id)}
                  recording={recordingId === def.id}
                  onRecord={() => setRecordingId(def.id)}
                  onCancel={() => setRecordingId(null)}
                  onUse={(value) => {
                    setRecordingId(null)
                    setKeys(def, value)
                  }}
                  allKeys={keys}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Shortcuts never fire while you’re typing in a box, except Search everything, Ask CBI and Save.
        Esc closes whatever is open. See them any time in{' '}
        <button type="button" onClick={() => openHelpTopic('keyboard-shortcuts')} className="font-semibold text-amber-700 hover:underline">Help</button>.
      </p>
    </div>
  )
}

function ShortcutRow({
  def,
  keys,
  changed,
  usable,
  clashesWith,
  recording,
  onRecord,
  onCancel,
  onUse,
  allKeys,
}: {
  def: ShortcutDef
  keys: string
  changed: boolean
  usable: boolean
  clashesWith: string[]
  recording: boolean
  onRecord: () => void
  onCancel: () => void
  onUse: (value: string | null) => void
  allKeys: Record<string, string>
}) {
  return (
    <li data-tour="kbd-row" data-shortcut={def.id} className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium ${usable ? 'text-slate-800' : 'text-slate-400'}`}>
            {def.label}
            {!usable && <span className="ml-1.5 text-xs font-normal">Not available to you</span>}
          </div>
          {def.note && <div className="text-xs text-slate-500">{def.note}</div>}
          {clashesWith.length > 0 && (
            <div data-tour="kbd-conflict" className="mt-0.5 text-xs font-medium text-red-700">
              Clashes with {clashesWith.join(', ')}. Only one of them will work.
            </div>
          )}
        </div>
        <Keys keys={keys} />
        {!def.fixed && !recording && (
          <div className="flex items-center gap-1">
            <button type="button" data-tour="kbd-change" onClick={onRecord} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-navy-900 hover:border-amber-300">
              Change
            </button>
            {keys && (
              <button type="button" onClick={() => onUse('')} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:text-navy-900">
                Turn off
              </button>
            )}
            {changed && (
              <button type="button" onClick={() => onUse(null)} className="rounded-md px-2 py-1 text-xs font-semibold text-amber-700 hover:text-amber-800">
                Reset
              </button>
            )}
          </div>
        )}
        {def.fixed && <span className="text-xs text-slate-400">Always on</span>}
      </div>
      {recording && <KeyRecorder def={def} allKeys={allKeys} onCancel={onCancel} onUse={onUse} />}
    </li>
  )
}

/**
 * "Press the new keys." Takes one key, or two pressed one after the other
 * (the second within a second and a bit). Esc cancels.
 */
function KeyRecorder({
  def,
  allKeys,
  onCancel,
  onUse,
}: {
  def: ShortcutDef
  allKeys: Record<string, string>
  onCancel: () => void
  onUse: (value: string) => void
}) {
  const [chords, setChords] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const pressed = useRef<string[]>([])
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setRecordingShortcut(true)
    return () => {
      setRecordingShortcut(false)
      window.clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (done) return
    const onKey = (e: KeyboardEvent) => {
      const chord = eventChord(e)
      if (!chord) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (chord === 'Escape') {
        onCancel()
        return
      }
      if (e.repeat) return
      const next = [...pressed.current, chord].slice(0, 2)
      pressed.current = next
      setChords(next)
      window.clearTimeout(timer.current)
      if (next.length >= 2) setDone(true)
      else timer.current = window.setTimeout(() => setDone(true), 1200)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [done, onCancel])

  const value = chords.join(' ')
  const problem = done ? checkKeys(def, value) : null
  const clashes = done && !problem
    ? Object.entries(findConflicts({ ...allKeys, [def.id]: value }))
      .filter(([id]) => id === def.id)
      .flatMap(([, ids]) => ids)
      .map((id) => SHORTCUTS.find((s) => s.id === id)?.label ?? id)
    : []

  const again = () => {
    pressed.current = []
    setChords([])
    setDone(false)
  }

  return (
    <div data-tour="kbd-recorder" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
      {!done && (
        <p className="text-amber-950">
          {chords.length === 0
            ? <>Press the new keys for <strong>{def.label}</strong>. One key, or two one after the other. Esc to cancel.</>
            : <>Got <strong>{describeKeys(value)}</strong>. Press a second key now, or wait.</>}
        </p>
      )}
      {done && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-950">New keys:</span>
            <span className="inline-flex gap-1">
              {keyCaps(value).map((c, i) => <span key={i} className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-semibold">{c.join(' ')}</span>)}
            </span>
          </div>
          {problem && <p className="text-red-700">{problem}</p>}
          {!problem && clashes.length > 0 && (
            <p className="text-red-700">These are already used by {clashes.join(', ')}. If you use them here, change that one too.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {!problem && (
              <button type="button" onClick={() => onUse(value)} className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600">
                {clashes.length > 0 ? 'Use them anyway' : 'Use these keys'}
              </button>
            )}
            <button type="button" onClick={again} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-navy-900">
              Try again
            </button>
            <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-navy-900">
              Cancel
            </button>
          </div>
        </div>
      )}
      {!done && (
        <button type="button" onClick={onCancel} className="mt-2 rounded-md px-0 text-xs font-semibold text-slate-600 hover:text-navy-900">
          Cancel
        </button>
      )}
    </div>
  )
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** A one-page cheat sheet in its own window, ready to print. */
function printCheatSheet(keys: Record<string, string>, canUse: (def: ShortcutDef) => boolean) {
  const caps = (k: string) => keyCaps(k)
    .map((chord) => chord.map((c) => `<kbd>${escapeHtml(c)}</kbd>`).join(''))
    .join(' <span class="then">then</span> ') || '<span class="off">Off</span>'
  const groups = SHORTCUT_GROUPS.map((g) => {
    const rows = SHORTCUTS.filter((s) => s.group === g.id && canUse(s))
      .map((s) => `<tr><td>${escapeHtml(s.label)}</td><td class="k">${caps(keys[s.id])}</td></tr>`)
      .join('')
    return rows ? `<section><h2>${escapeHtml(g.label)}</h2><p>${escapeHtml(g.blurb)}</p><table>${rows}</table></section>` : ''
  }).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>CrewBarn keyboard shortcuts</title><style>
    body{font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;margin:24px}
    h1{font-size:20px;margin:0 0 4px}h1 span{color:#d97706}.sub{color:#64748b;margin:0 0 16px}
    .grid{columns:2;column-gap:28px}section{break-inside:avoid;margin:0 0 16px}
    h2{font-size:14px;margin:0;border-bottom:2px solid #f59e0b;padding-bottom:2px}section p{color:#64748b;margin:2px 0 6px;font-size:11px}
    table{width:100%;border-collapse:collapse}td{padding:3px 0;border-bottom:1px solid #e2e8f0;vertical-align:middle}td.k{text-align:right;white-space:nowrap}
    kbd{display:inline-block;min-width:16px;padding:1px 5px;margin-left:2px;border:1px solid #94a3b8;border-bottom-width:2px;border-radius:4px;font:600 11px system-ui,sans-serif;text-align:center}
    .then{color:#64748b;font-size:10px}.off{color:#94a3b8;font-style:italic}
    @media print{body{margin:12mm}}
  </style></head><body><h1>Crew<span>Barn</span> keyboard shortcuts</h1>
  <p class="sub">Shortcuts don't fire while you're typing in a box, except Search everything, Ask CBI and Save. Esc closes whatever is open.</p>
  <div class="grid">${groups}</div><script>window.onload=function(){window.focus();window.print()}</script></body></html>`
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}
