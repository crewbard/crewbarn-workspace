import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { ReferenceCardFiles } from '@/components/ReferenceCardFiles'
import {
  LIMITS,
  nextKey,
  tabsOf,
  type Draft,
  type DraftSection,
  type ReferenceCardSection,
} from '@/lib/referenceCards'

/**
 * Writing a card, and the tabs it is laid out in.
 *
 * Its own component rather than part of the library page, because a
 * card opens from wherever its words appear -- a job description, a
 * note, a transcript -- and that is where somebody notices it is
 * wrong. Sending them to a settings screen to fix it is the same
 * mistake as sending a tech back to the office to correct a part
 * number.
 */

export function ReferenceCardEditor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const qc = useQueryClient()
  const [d, setD] = useState<Draft>(draft)
  const [triggerText, setTriggerText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState(false)

  /*
   * A tab is a name on each section, not a box holding them, so the
   * tabs that exist are whatever names the sections carry. One
   * consequence worth knowing while building: a tab with no sections
   * has nowhere to be stored, so adding a tab adds its first section
   * at the same time.
   */
  const tabs = useMemo(() => tabsOf(d.sections), [d.sections])
  const [tab, setTab] = useState<string>('')

  const visible = d.sections.filter((s) => s.tab === tab)

  const setSection = (key: string, patch: Partial<DraftSection>) =>
    setD((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    }))

  const addSection = () =>
    setD((p) => ({
      ...p,
      sections: [...p.sections, { key: nextKey(), heading: '', body: '', tab }],
    }))

  const removeSection = (key: string) =>
    setD((p) => ({ ...p, sections: p.sections.filter((s) => s.key !== key) }))

  /** Swap a section with its neighbour inside the same tab. */
  const move = (key: string, by: -1 | 1) =>
    setD((p) => {
      const sameTab = p.sections.filter((s) => s.tab === tab)
      const at = sameTab.findIndex((s) => s.key === key)
      const to = at + by
      if (at < 0 || to < 0 || to >= sameTab.length) return p

      const a = p.sections.indexOf(sameTab[at])
      const b = p.sections.indexOf(sameTab[to])
      const next = [...p.sections]
      ;[next[a], next[b]] = [next[b], next[a]]
      return { ...p, sections: next }
    })

  /*
   * Naming a tab, inline. `naming` is the tab being renamed, or the
   * empty string while a new one is being added, or null when
   * neither is happening.
   */
  const [naming, setNaming] = useState<string | null>(null)
  const [tabName, setTabName] = useState('')

  const startAddingTab = () => {
    setNaming('')
    setTabName('')
  }

  const startRenamingTab = (from: string) => {
    setNaming(from)
    setTabName(from)
  }

  const commitTabName = () => {
    const name = tabName.trim()
    const from = naming

    setNaming(null)
    setTabName('')

    if (from === null || name === '' || name === from) return

    if (name.length > LIMITS.tab) {
      setError(`A tab name is at most ${LIMITS.tab} characters.`)
      return
    }

    // Renaming an existing tab moves every section that carries it.
    if (from !== '') {
      setD((p) => ({
        ...p,
        sections: p.sections.map((s) => (s.tab === from ? { ...s, tab: name } : s)),
      }))
      setTab(name)
      return
    }

    // A tab is a name on a section, so a tab with no sections has
    // nowhere to live. Adding one adds its first section too.
    if (!tabs.includes(name)) {
      setD((p) => ({
        ...p,
        sections: [...p.sections, { key: nextKey(), heading: '', body: '', tab: name }],
      }))
    }

    setTab(name)
  }

  /** The tab goes; its sections do not. They come back untabbed. */
  const dropTab = (name: string) => {
    setD((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.tab === name ? { ...s, tab: '' } : s)),
    }))
    setTab('')
  }

  const addTrigger = () => {
    const word = triggerText.trim()
    setTriggerText('')

    if (word === '') return

    if (word.length < LIMITS.minTrigger) {
      setError(
        `"${word}" is too short. Under ${LIMITS.minTrigger} characters a word opens the card on half the page.`,
      )
      return
    }

    if (word.length > LIMITS.trigger) {
      setError(`A word is at most ${LIMITS.trigger} characters.`)
      return
    }

    if (d.triggers.some((t) => t.toLowerCase() === word.toLowerCase())) return

    if (d.triggers.length >= LIMITS.triggers) {
      setError(`${LIMITS.triggers} words is the most one card can open on.`)
      return
    }

    setError(null)
    setD((p) => ({ ...p, triggers: [...p.triggers, word] }))
  }

  const save = useMutation({
    mutationFn: async () => {
      const sections: ReferenceCardSection[] = d.sections.map((s) => ({
        heading: s.heading.trim(),
        body: s.body.trim() === '' ? null : s.body,
        tab: s.tab.trim() === '' ? null : s.tab.trim(),
      }))

      const body = {
        title: d.title.trim(),
        triggers: d.triggers,
        sections,
        propose_to_platform: d.propose,
      }

      return d.id === null
        ? apiRequest<{ card: { id: string } }>('/v1/reference-cards', { method: 'POST', body })
        : apiRequest<{ card: { id: string } }>(`/v1/reference-cards/${d.id}`, { method: 'PUT', body })
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['reference-cards'] })
      if (d.id) void qc.invalidateQueries({ queryKey: ['reference-card', d.id] })
      // The words that open cards have changed, so every piece of text
      // on screen is now answering from a stale list.
      void qc.invalidateQueries({ queryKey: ['text-references'] })

      /*
       * A new card stays open, now as itself, so its manual can go on
       * straight away. Closing it sent people looking for where files are
       * added -- the answer was "open it again", which nobody guesses.
       */
      if (d.id === null && res?.card?.id) {
        setD((p) => ({ ...p, id: res.card.id }))
        setJustCreated(true)
        setError(null)
        return
      }

      onClose()
    },
    onError: (e) => setError((e as ApiError)?.message ?? 'That did not save.'),
  })

  const retire = useMutation({
    mutationFn: () => apiRequest(`/v1/reference-cards/${d.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reference-cards'] })
      void qc.invalidateQueries({ queryKey: ['text-references'] })
      onClose()
    },
    onError: (e) => setError((e as ApiError)?.message ?? 'That did not retire.'),
  })

  const problems: string[] = []
  if (d.title.trim() === '') problems.push('a title')
  if (d.triggers.length === 0) problems.push('at least one word that opens it')
  if (d.sections.length === 0) problems.push('at least one section')
  if (d.sections.some((s) => s.heading.trim() === '')) problems.push('a heading on every section')
  if (d.sections.length > LIMITS.sections) problems.push(`no more than ${LIMITS.sections} sections`)

  // Into the body: this can open from a card that opened from a
  // sentence, and a dialog inside a <p> breaks the paragraph.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 py-8">
      <div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between gap-3 rounded-t-2xl border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            {d.id === null ? 'New reference card' : 'Edit reference card'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {error && (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          )}

          {justCreated && (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Saved. Add a manual or catalogue under Files below, or close when you are done.
            </p>
          )}

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title
            </span>
            <input
              value={d.title}
              maxLength={LIMITS.title}
              onChange={(e) => setD((p) => ({ ...p, title: e.target.value }))}
              placeholder="What this card is about"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Words that open it
            </span>
            <p className="mt-0.5 text-xs text-slate-500">
              Spelling is forgiving: write it once and HU-101 finds HU101, SmartKey
              finds smart key. It is not fuzzy past that, and a word never opens a
              card from inside a longer word.
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.triggers.map((word) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-900"
                >
                  {word}
                  <button
                    type="button"
                    aria-label={`Remove ${word}`}
                    onClick={() =>
                      setD((p) => ({ ...p, triggers: p.triggers.filter((t) => t !== word) }))
                    }
                    className="text-sky-500 hover:text-sky-800"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                value={triggerText}
                maxLength={LIMITS.trigger}
                onChange={(e) => setTriggerText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addTrigger()
                  }
                }}
                placeholder="Add a word, then Enter"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <Button size="sm" variant="secondary" type="button" onClick={addTrigger}>
                Add
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3 border-b border-slate-200">
              <div className="-mb-px flex flex-wrap items-center gap-1">
                <TabButton
                  active={tab === ''}
                  onClick={() => setTab('')}
                  label={tabs.length > 0 ? 'Always shown' : 'Sections'}
                />
                {tabs.map((name) => (
                  <TabButton
                    key={name}
                    active={tab === name}
                    onClick={() => setTab(name)}
                    label={name}
                  />
                ))}
                {naming === null ? (
                  <button
                    type="button"
                    onClick={startAddingTab}
                    className="px-2 py-1.5 text-sm font-medium text-sky-700 hover:text-sky-900"
                  >
                    + Add tab
                  </button>
                ) : (
                  <input
                    autoFocus
                    value={tabName}
                    maxLength={LIMITS.tab}
                    aria-label={naming === '' ? 'Name the new tab' : `Rename ${naming}`}
                    placeholder="Tab name"
                    onChange={(e) => setTabName(e.target.value)}
                    onBlur={commitTabName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitTabName()
                      }
                      if (e.key === 'Escape') {
                        setNaming(null)
                        setTabName('')
                      }
                    }}
                    className="mb-1 w-36 rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                )}
              </div>

              {tab !== '' && (
                <div className="flex shrink-0 items-center gap-2 pb-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => startRenamingTab(tab)}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => dropTab(tab)}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    Remove tab
                  </button>
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {tab === ''
                ? tabs.length > 0
                  ? 'These sections sit above the tabs and stay on screen whichever tab is open.'
                  : 'A card with no tabs shows its sections one after another. Add a tab when it gets long enough to scroll past the thing somebody wanted.'
                : `Shown when someone picks ${tab}. Removing the tab keeps its sections — they move up to “Always shown”.`}
            </p>

            <div className="mt-3 space-y-3">
              {visible.length === 0 && (
                <p className="rounded border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                  Nothing here yet.
                </p>
              )}

              {visible.map((section, i) => (
                <div key={section.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={section.heading}
                      maxLength={LIMITS.heading}
                      onChange={(e) => setSection(section.key, { heading: e.target.value })}
                      placeholder="Heading"
                      className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm font-medium"
                    />

                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => move(section.key, -1)}
                      className="rounded px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === visible.length - 1}
                      onClick={() => move(section.key, 1)}
                      className="rounded px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(section.key)}
                      className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>

                  <textarea
                    value={section.body}
                    maxLength={LIMITS.body}
                    rows={3}
                    onChange={(e) => setSection(section.key, { body: e.target.value })}
                    placeholder="What somebody needs to know"
                    className="mt-2 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                  />

                  {tabs.length > 0 && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      Tab
                      <select
                        value={section.tab}
                        onChange={(e) => setSection(section.key, { tab: e.target.value })}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="">Always shown</option>
                        {tabs.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              ))}

              <Button size="sm" variant="secondary" type="button" onClick={addSection}>
                + Add section
              </Button>
            </div>
          </div>

          {d.id === null ? (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Files</span>
              <p className="mt-0.5 text-xs text-slate-500">
                Manuals and catalogues go here. Save the card and the button to add one appears.
              </p>
            </div>
          ) : (
            <ReferenceCardFiles cardId={d.id} />
          )}

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={d.propose}
              onChange={(e) => setD((p) => ({ ...p, propose: e.target.checked }))}
              className="mt-0.5"
            />
            <span>
              Offer this to every CrewBarn shop. We review it before it reaches
              anyone else, and your own copy keeps working whichever way that goes.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <div>
            {d.id !== null && (
              <button
                type="button"
                onClick={() => retire.mutate()}
                disabled={retire.isPending}
                className="text-sm text-slate-500 hover:text-red-700"
              >
                Retire this card
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {problems.length > 0 && (
              <span className="text-xs text-slate-500">Still needs {problems.join(', ')}.</span>
            )}
            <Button size="sm" variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="button"
              loading={save.isPending}
              disabled={problems.length > 0 || save.isPending}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'border-b-2 px-3 py-1.5 text-sm font-medium ' +
        (active
          ? 'border-sky-600 text-sky-700'
          : 'border-transparent text-slate-500 hover:text-slate-800')
      }
    >
      {label}
    </button>
  )
}
