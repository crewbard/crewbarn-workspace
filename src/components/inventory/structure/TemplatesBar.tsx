/**
 * The company's saved shapes, next to the built-in ones. Each one can be
 * opened in the builder to adjust, or built straight into the picked place
 * in one click. Saving and deleting are here too.
 */
import { useEffect, useState } from 'react'
import type { StructureTemplate } from '@/lib/structureTemplates'

export function TemplateCards({
  templates, loading, placeName, canBuild, busyId, onOpen, onBuild, onDelete,
}: {
  templates: StructureTemplate[]
  loading: boolean
  placeName: string | null
  canBuild: boolean
  busyId: string | null
  onOpen: (t: StructureTemplate) => void
  onBuild: (t: StructureTemplate) => void
  onDelete: (t: StructureTemplate) => void
}) {
  if (loading) return <p className="text-[12px] text-slate-400">Loading your saved shapes…</p>
  if (templates.length === 0) {
    return <p className="text-[12px] text-slate-500">No saved shapes yet. Build one below and press <b>Save as a shape</b>, or save a rack you already have.</p>
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((t) => (
        <div key={t.id} className="flex flex-col gap-1.5 rounded-[10px] border border-slate-200 bg-white p-2.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-bold text-slate-800">{t.name}</div>
              <div className="truncate text-[11px] text-slate-500">
                {t.node_count.toLocaleString('en-US')} places · {t.source === 'location' ? 'a whole location' : t.source === 'place' ? 'saved from a rack' : 'from the builder'}
                {t.description ? ` · ${t.description}` : ''}
              </div>
            </div>
            <button type="button" onClick={() => onDelete(t)} aria-label={`Delete the saved shape ${t.name}`} title="Delete this saved shape"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onOpen(t)}
              className="h-9 flex-1 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">Open to adjust</button>
            <button type="button" onClick={() => onBuild(t)} disabled={!canBuild || busyId !== null}
              title={canBuild ? `Create it in ${placeName} now` : 'Pick a place at the top first'}
              className="h-9 flex-1 truncate rounded-lg bg-amber-500 px-2 text-[12px] font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500">
              {busyId === t.id ? 'Building…' : canBuild ? `Build in ${placeName}` : 'Pick a place first'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SaveShapeDialog({
  title, intro, defaultName, busy, error, onSave, onClose,
}: {
  title: string
  intro: string
  defaultName: string
  busy: boolean
  error: string | null
  onSave: (name: string, description: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(defaultName)
  // Escape closes it wherever the focus is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])
  const [description, setDescription] = useState('')
  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-900/50 sm:items-center" role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <form className="w-full max-w-[440px] rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
        onSubmit={(e) => { e.preventDefault(); if (name.trim() && !busy) onSave(name.trim(), description.trim()) }}>
        <h2 className="text-[17px] font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-[13px] text-slate-600">{intro}</p>
        <label className="mt-4 block text-[13px] font-semibold text-slate-700">
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Standard service truck"
            className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3 text-[16px] focus:border-amber-500 focus:outline-none" />
        </label>
        <label className="mt-3 block text-[13px] font-semibold text-slate-700">
          Note <span className="font-normal text-slate-400">(optional)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={240} placeholder="What it's for"
            className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-[14px] focus:border-amber-500 focus:outline-none" />
        </label>
        {error && <p className="mt-3 rounded bg-red-50 px-2 py-1.5 text-[12.5px] text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-lg px-4 text-[14px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()}
            className="h-11 rounded-lg bg-amber-500 px-5 text-[14px] font-bold text-white hover:bg-amber-600 disabled:bg-slate-300">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
