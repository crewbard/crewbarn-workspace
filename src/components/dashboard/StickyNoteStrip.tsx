import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTeamNotes, useCreateTeamNote, useDeleteTeamNote } from '@/hooks/useTeamNotes'
import type { TeamNote } from '@/hooks/useTeamNotes'
import { useTenantAccounts } from '@/hooks/useTenantAccounts'

// ── Color maps ────────────────────────────────────────────────────────

const BG: Record<string, string> = {
  yellow: 'bg-yellow-50 border-yellow-200',
  blue:   'bg-sky-50 border-sky-200',
  green:  'bg-emerald-50 border-emerald-200',
  pink:   'bg-pink-50 border-pink-200',
}
const DOT: Record<string, string> = {
  yellow: 'bg-amber-400',
  blue:   'bg-sky-500',
  green:  'bg-emerald-500',
  pink:   'bg-pink-500',
}
const DOT_BTN: Record<string, string> = {
  yellow: 'bg-yellow-100 border-yellow-300 hover:border-amber-400',
  blue:   'bg-sky-100 border-sky-300 hover:border-sky-500',
  green:  'bg-emerald-100 border-emerald-300 hover:border-emerald-500',
  pink:   'bg-pink-100 border-pink-300 hover:border-pink-500',
}

// ── Sticky notes strip ────────────────────────────────────────────────

export function StickyNoteStrip() {
  const { data: notes = [] } = useTeamNotes()
  const del = useDeleteTeamNote()
  const [showForm, setShowForm] = useState(false)
  const [preview, setPreview] = useState<{ note: TeamNote; rect: DOMRect } | null>(null)

  return (
    <>
      <section className="isolate overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold text-navy-900">Sticky notes</h2>
          <span className="text-xs text-slate-400">Team to-dos pinned to Today&apos;s Ops</span>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {notes.length}
          </span>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Add note
          </button>
        </header>
        {notes.length === 0 ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full px-4 py-6 text-center text-sm text-slate-500 hover:bg-slate-50"
          >
            No sticky notes yet. Add one for the team.
          </button>
        ) : (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 pb-4">
            {notes.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                onPreview={(note, rect) => setPreview({ note, rect })}
                onPreviewEnd={() => setPreview(null)}
                onDismiss={() => {
                  if (preview?.note.id === n.id) setPreview(null)
                  del.mutate(n.id)
                }}
              />
            ))}
          </div>
        )}

      </section>
      {preview && createPortal(
        <div
          className={`pointer-events-none fixed z-40 flex h-56 w-56 flex-col rounded-lg border p-4 shadow-xl ${BG[preview.note.color] ?? BG.yellow}`}
          style={{
            left: Math.min(Math.max(8, preview.rect.left), window.innerWidth - 232),
            top: preview.rect.bottom + 8,
          }}
          role="tooltip"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[preview.note.color] ?? DOT.yellow}`} />
            <span className="truncate text-xs font-semibold text-slate-500">
              {preview.note.author?.name ?? 'Team note'}
            </span>
          </div>
          <p className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
            {preview.note.content}
          </p>
        </div>,
        document.body,
      )}
      {showForm && <StickyNoteModal onClose={() => setShowForm(false)} />}
    </>
  )
}
function NoteCard({ note: n, onDismiss, onPreview, onPreviewEnd }: {
  note: TeamNote
  onDismiss: () => void
  onPreview: (note: TeamNote, rect: DOMRect) => void
  onPreviewEnd: () => void
}) {
  const targets = n.target_account_ids
  const acks = n.acknowledged_by ?? []
  const bg = BG[n.color] ?? BG.yellow
  const initials = (n.author?.name ?? 'Team')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div
      className="relative flex-shrink-0 focus:outline-none"
      tabIndex={0}
      onMouseEnter={(event) => onPreview(n, event.currentTarget.getBoundingClientRect())}
      onMouseLeave={onPreviewEnd}
      onFocus={(event) => onPreview(n, event.currentTarget.getBoundingClientRect())}
      onBlur={onPreviewEnd}
    >
      {/* Mobile app: match the Home screen Team Notes row. */}
      <div className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm md:hidden">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{n.author?.name ?? 'Team note'}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-slate-600">{n.content}</p>
          {acks.length > 0 && (
            <p className="mt-1 truncate text-[11px] font-medium text-emerald-700">
              Read by {acks.map((a) => a.name).join(', ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 px-1 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
        >
          Done
        </button>
      </div>
      {/* Uniform sticky-note size; the clamp fills the card and overflow-hidden
          + the hover-card handle anything longer. */}
      <div
        className={`relative hidden h-40 w-44 flex-col overflow-hidden rounded-lg border p-3 shadow-sm md:flex ${bg}`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[n.color] ?? DOT.yellow}`} />
          <button
            type="button"
            aria-label="Mark done — archive this note"
            onClick={onDismiss}
            className="px-1 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-emerald-700"
          >
            Done
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <p className="text-slate-800 text-[13px] leading-snug break-words line-clamp-4 overflow-hidden">
            {n.content}
          </p>
        </div>
        <div className="mt-2 shrink-0">
          {acks.length > 0 && (
            <div
              className="mb-0.5 text-[10px] font-semibold leading-tight text-emerald-600 truncate"
              title={`Read by ${acks.map((a) => a.name).join(', ')}`}
            >
              ✓ {acks.map((a) => a.name).join(', ')}
            </div>
          )}
          <div className="flex items-center justify-between gap-1">
            {n.author ? (
              <span className="text-[11px] text-slate-400 truncate">{n.author.name}</span>
            ) : (
              <span />
            )}
            {targets && targets.length > 0 && (
              <span
                className="text-[11px] text-slate-500 font-medium shrink-0"
                title={`Shown to ${targets.length} ${targets.length === 1 ? 'person' : 'people'}`}
              >
                → {targets.length}
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Context menu (right-click / long-press) ───────────────────────────

export function StickyNoteContextMenu({
  pos,
  onClose,
}: {
  pos: { x: number; y: number }
  onClose: () => void
}) {
  const [showForm, setShowForm] = useState(false)

  if (showForm) {
    return <StickyNoteModal onClose={onClose} />
  }

  const safeX = Math.min(pos.x, window.innerWidth - 200)
  const safeY = Math.min(pos.y, window.innerHeight - 80)

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />
      <div
        className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]"
        style={{ left: safeX, top: safeY }}
      >
        <button
          type="button"
          className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
          onClick={() => setShowForm(true)}
        >
          <span>📌</span>
          <span>Add sticky note</span>
        </button>
      </div>
    </>
  )
}

// ── Note creation modal ───────────────────────────────────────────────

function StickyNoteModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState('')
  const [color, setColor] = useState<TeamNote['color']>('yellow')
  const [expiry, setExpiry] = useState('')
  const [targetMode, setTargetMode] = useState<'all' | 'specific'>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saveError, setSaveError] = useState('')

  const create = useCreateTeamNote()
  const staffQ = useTenantAccounts('', 50)
  const staff = staffQ.data ?? []

  function todayPlus(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  function toggleId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function handleSave() {
    if (!content.trim()) return
    if (targetMode === 'specific' && selectedIds.length === 0) {
      setSaveError('Pick at least one crew member, or switch to All crew.')
      return
    }
    setSaveError('')
    try {
      await create.mutateAsync({
        content: content.trim(),
        color,
        ...(expiry ? { pinned_until: expiry } : {}),
        ...(targetMode === 'specific' ? { target_account_ids: selectedIds } : {}),
      })
      onClose()
    } catch {
      setSaveError('Could not save — make sure the backend is deployed and migrated.')
    }
  }

  const COLORS: Array<{ key: TeamNote['color']; label: string }> = [
    { key: 'yellow', label: 'Yellow' },
    { key: 'blue',   label: 'Blue'   },
    { key: 'green',  label: 'Green'  },
    { key: 'pink',   label: 'Pink'   },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-5 w-[22rem]">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">📌 Team sticky note</h3>

        {/* Message */}
        <textarea
          autoFocus
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What does your crew need to know?"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
          maxLength={1000}
        />

        {/* Color + expiry row */}
        <div className="flex items-center gap-2 mt-2">
          {COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              title={c.label}
              onClick={() => setColor(c.key)}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${DOT_BTN[c.key]} ${color === c.key ? 'scale-125 !border-slate-500' : ''}`}
            />
          ))}
          <div className="flex-1" />
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="text-xs rounded border border-slate-200 px-2 py-1 text-slate-600 bg-white"
          >
            <option value="">No expiry</option>
            <option value={todayPlus(0)}>Expires today</option>
            <option value={todayPlus(3)}>3 days</option>
            <option value={todayPlus(7)}>1 week</option>
          </select>
        </div>

        {/* Crew targeting */}
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Show to
          </div>
          <div className="flex gap-3 mb-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="radio"
                name="target"
                value="all"
                checked={targetMode === 'all'}
                onChange={() => { setTargetMode('all'); setSelectedIds([]) }}
                className="accent-amber-500"
              />
              All crew
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="radio"
                name="target"
                value="specific"
                checked={targetMode === 'specific'}
                onChange={() => setTargetMode('specific')}
                className="accent-amber-500"
              />
              Specific people
            </label>
          </div>

          {targetMode === 'specific' && (
            <div className="border border-slate-200 rounded-lg overflow-y-auto max-h-36">
              {staffQ.isLoading ? (
                <p className="text-xs text-slate-400 p-2">Loading staff…</p>
              ) : staff.length === 0 ? (
                <p className="text-xs text-slate-400 p-2">No staff accounts found.</p>
              ) : (
                staff.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleId(s.id)}
                      className="accent-amber-500"
                    />
                    <span className="text-slate-800 truncate">{s.name || s.email}</span>
                    <span className="ml-auto text-[10px] text-slate-400 shrink-0">{s.role ?? ''}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {saveError && (
          <p className="mt-2 text-xs text-red-600">{saveError}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!content.trim() || create.isPending}
            className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {create.isPending ? 'Saving…' : 'Pin to board'}
          </button>
        </div>
      </div>
    </>
  )
}
