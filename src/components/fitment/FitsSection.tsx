import { useEffect, useMemo, useState } from 'react'
import '@/components/inventory/bins/bins.css'
import { ApiError } from '@/lib/api'
import { VehicleKeyOverlay } from '@/components/VehicleKeyOverlay'
import { FitsCard } from './FitsCard'
import {
  askedFromFit, fitDetails, fitTitle, useFitmentProfile, useFitmentValues, useItemFitments, useSaveItemFitments, yearsToText,
  type CatalogItemFit, type FitDraft, type FitmentField, type FitmentSubject,
} from '@/lib/fitment'

/**
 * Fits: what a product fits, in the product overlay (view, with Edit fits for
 * catalog.edit) and in the product's Edit form. One list and one editor, both
 * shaped by the company's fitment profile. Theme colours are the bins.css
 * roles; every piece sits inside [data-bins-ui].
 */

const head = 'text-xs font-medium uppercase tracking-wide text-[var(--bins-muted)]'
const fieldBox = 'rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2 py-1.5 text-sm text-[var(--bins-text)] placeholder:text-[var(--bins-muted)] focus:border-[var(--bins-accent)] focus:outline-none'
const input = `w-full ${fieldBox}`
const ghostBtn = 'rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2.5 py-1 text-xs font-medium text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)] disabled:cursor-not-allowed disabled:opacity-60'
const primaryBtn = 'rounded-md bg-[var(--bins-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60'

/** "Draft": the company is working with its trade's starter fields. */
export function DraftBadge({ title }: { title?: string }) {
  return (
    <span
      data-fitment-draft=""
      title={title ?? "Your trade's starter fields. They work now; change them in Fitment."}
      className="rounded-full border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--bins-accent-ink)]"
    >
      Draft
    </span>
  )
}

/** The read-only list, grouped by subject. */
export function FitsList({ fits, subjects, openable = true }: {
  fits: CatalogItemFit[]
  subjects: FitmentSubject[]
  /** Each line opens what else fits it: the vehicle card for a vehicle, the fits card for anything else. */
  openable?: boolean
}) {
  const bySubject = new Map(subjects.map((s) => [s.key, s]))
  const [opened, setOpened] = useState<{ subject: FitmentSubject; attrs: Record<string, unknown> } | null>(null)
  const groups = new Map<string, CatalogItemFit[]>()
  for (const fit of fits) groups.set(fit.subject, [...(groups.get(fit.subject) ?? []), fit])
  return (
    <div className="space-y-2">
      {[...groups.entries()].map(([key, rows]) => {
        const subject = bySubject.get(key)
        return (
          <div key={key} className="rounded-lg border border-[var(--bins-border)] px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--bins-muted)]">{subject?.label ?? key}</div>
            <ul className="mt-1 space-y-1">
              {rows.map((fit) => {
                const details = fitDetails(subject, fit.attrs)
                return (
                  <li key={fit.id} data-fit-row="" className="text-sm">
                    <span className="font-medium text-[var(--bins-text)]">{fitTitle(subject, fit.attrs)}</span>
                    {details && <span className="text-[var(--bins-text-2)]"> · {details}</span>}
                    {fit.note && <div className="text-xs text-[var(--bins-muted)]">{fit.note}</div>}
                    {openable && subject && (
                      <div><button type="button" data-fit-open="" onClick={() => setOpened({ subject, attrs: fit.attrs })}
                        className="mt-0.5 text-xs font-medium text-[var(--accent-700)] underline decoration-[var(--accent-300)] decoration-dotted underline-offset-2 hover:decoration-solid">
                        {subject.key === 'vehicle' ? 'Open the vehicle card' : 'What else fits this'}
                      </button></div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      {opened && opened.subject.key === 'vehicle' && typeof opened.attrs.make === 'string' && (
        <VehicleKeyOverlay
          make={opened.attrs.make}
          model={typeof opened.attrs.model === 'string' ? opened.attrs.model : null}
          year={yearOf(opened.attrs.years)}
          onClose={() => setOpened(null)}
        />
      )}
      {opened && opened.subject.key !== 'vehicle' && (
        <FitsCard subject={opened.subject} asked={askedFromFit(opened.subject, opened.attrs)} onClose={() => setOpened(null)} />
      )}
    </div>
  )
}

/** The first year of a fit's range, for opening the vehicle card on it. */
function yearOf(v: unknown): number | null {
  if (v == null || typeof v !== 'object') return null
  const { from, to } = v as { from?: number | null; to?: number | null }
  return from ?? to ?? null
}

/** One field of one fit. Text fields suggest the company's own values (and, for vehicles, the key library). */
function FieldInput({ subject, field, value, attrs, onChange }: {
  subject: FitmentSubject
  field: FitmentField
  value: unknown
  attrs: Record<string, unknown>
  onChange: (v: unknown) => void
}) {
  const [focused, setFocused] = useState(false)
  const text = field.type === 'year_range' ? yearsToText(value) : value == null ? '' : String(value)
  const narrow = useMemo(() => {
    const out: Record<string, string> = {}
    if (field.key === 'model' && typeof attrs.make === 'string') out.make = attrs.make
    if (field.key === 'model' && typeof attrs.brand === 'string') out.brand = attrs.brand
    return out
  }, [field.key, attrs.make, attrs.brand])
  const suggest = useFitmentValues(subject.key, field.key, text, narrow, focused && ['text', 'code', 'dimensions'].includes(field.type))
  const listId = `fit-${subject.key}-${field.key}`
  const label = `${field.label}${field.required ? ' *' : ''}${field.unit ? ` (${field.unit})` : ''}`

  if (field.type === 'choice') {
    return (
      <label className="block">
        <span className="text-[11px] text-[var(--bins-muted)]">{label}</span>
        <select data-fit-field={field.key} className={input} value={text} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {(field.choices ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
    )
  }
  const placeholder = field.type === 'year_range' ? 'e.g. 2015-2020'
    : field.type === 'dimensions' ? 'e.g. 16x7'
      : field.prefix ? 'or a series, e.g. 4TTR4036*' : ''
  return (
    <label className="block">
      <span className="text-[11px] text-[var(--bins-muted)]">{label}</span>
      <input
        data-fit-field={field.key}
        className={input}
        value={text}
        inputMode={field.type === 'number' || field.type === 'year_range' ? 'numeric' : undefined}
        placeholder={placeholder}
        list={suggest.data?.length ? listId : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
      />
      {suggest.data && suggest.data.length > 0 && (
        <datalist id={listId}>
          {suggest.data.map((s) => <option key={s.value} value={s.value} />)}
        </datalist>
      )}
    </label>
  )
}

/** Add, change and remove fits. Controlled: the overlay and the Edit form each own the list and save it. */
export function FitsEditor({ subjects, value, onChange, defaultSubject, errors }: {
  subjects: FitmentSubject[]
  value: FitDraft[]
  onChange: (next: FitDraft[]) => void
  defaultSubject?: string | null
  errors?: Record<string, string>
}) {
  const bySubject = new Map(subjects.map((s) => [s.key, s]))
  const first = (defaultSubject && bySubject.has(defaultSubject) ? defaultSubject : subjects[0]?.key) ?? ''
  const set = (i: number, patch: Partial<FitDraft>) => onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  return (
    <div className="space-y-2" data-fits-editor="">
      {value.map((fit, i) => {
        const subject = bySubject.get(fit.subject)
        const rowErrors = Object.entries(errors ?? {}).filter(([k]) => k.startsWith(`fitments.${i}.`)).map(([, m]) => m)
        return (
          <div key={fit.id ?? `new-${i}`} className="rounded-lg border border-[var(--bins-border)] bg-[var(--bins-softer)] p-3">
            <div className="flex items-center gap-2">
              {subjects.length > 1 ? (
                <select
                  aria-label="Fits a"
                  className={fieldBox}
                  value={fit.subject}
                  onChange={(e) => set(i, { subject: e.target.value, attrs: {} })}
                >
                  {subjects.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              ) : (
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--bins-muted)]">{subject?.label}</span>
              )}
              <button type="button" className={`${ghostBtn} ml-auto`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
            {subject && (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {subject.fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    subject={subject}
                    field={field}
                    value={fit.attrs[field.key]}
                    attrs={fit.attrs}
                    onChange={(v) => set(i, { attrs: { ...fit.attrs, [field.key]: v } })}
                  />
                ))}
                <label className="block sm:col-span-3">
                  <span className="text-[11px] text-[var(--bins-muted)]">Note</span>
                  <input className={input} value={fit.note ?? ''} placeholder="Optional" onChange={(e) => set(i, { note: e.target.value })} />
                </label>
              </div>
            )}
            {rowErrors.length > 0 && (
              <p className="mt-2 text-xs text-[var(--color-danger)]">{rowErrors.join(' ')}</p>
            )}
          </div>
        )
      })}
      {first && (
        <button type="button" data-fit-add="" className={ghostBtn} onClick={() => onChange([...value, { subject: first, attrs: {}, note: null }])}>
          + Add a fit
        </button>
      )}
    </div>
  )
}

/** The saved fits as editor rows (years back to {from, to}). */
export function fitsToDrafts(fits: CatalogItemFit[]): FitDraft[] {
  return fits.map((f) => ({ id: f.id, subject: f.subject, attrs: { ...f.attrs }, note: f.note }))
}

/** Field errors from a 422, by "fitments.0.attrs.make". */
export function fitErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  const raw = (error.details && typeof error.details === 'object' ? error.details : {}) as Record<string, string[] | string>
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join(' ') : String(v)]))
}

/**
 * The product's fits for its Edit form: loads them once, keeps the edits,
 * and saves them with the rest of the form.
 */
export function useFitsDraft(itemId: string) {
  const profile = useFitmentProfile()
  const fits = useItemFitments(itemId)
  const save = useSaveItemFitments(itemId)
  const [drafts, setDrafts] = useState<FitDraft[] | null>(null)
  useEffect(() => {
    if (fits.data && drafts === null) setDrafts(fitsToDrafts(fits.data.data))
  }, [fits.data, drafts])
  const initial = useMemo(() => JSON.stringify(fitsToDrafts(fits.data?.data ?? [])), [fits.data])
  const dirty = drafts !== null && JSON.stringify(drafts) !== initial
  const on = !!profile.data && profile.data.status !== 'off' && profile.data.profile.subjects.length > 0
  return {
    on,
    profile: profile.data,
    drafts: drafts ?? [],
    setDrafts: (next: FitDraft[]) => setDrafts(next),
    defaultSubject: fits.data?.default_subject ?? null,
    dirty,
    save: () => save.mutateAsync(drafts ?? []),
    saving: save.isPending,
    errors: fitErrors(save.error),
    error: save.error,
  }
}

/** Fits in the product overlay: the list, and Edit fits for catalog.edit. */
export function FitsSection({ itemId, canEdit }: { itemId: string; canEdit: boolean }) {
  const profile = useFitmentProfile()
  const fits = useItemFitments(itemId)
  const save = useSaveItemFitments(itemId)
  const [editing, setEditing] = useState<FitDraft[] | null>(null)
  const p = profile.data
  if (!p || p.status === 'off' || p.profile.subjects.length === 0) return null
  const subjects = p.profile.subjects
  const rows = fits.data?.data ?? []
  const errors = fitErrors(save.error)

  return (
    <div data-bins-ui="" data-tour="prod-fits" data-fits-section="">
      <div className="flex items-center gap-2">
        <h3 className={head}>Fits</h3>
        {p.status === 'draft' && <DraftBadge />}
        {canEdit && editing === null && (
          <button type="button" data-fit-edit="" className={`${ghostBtn} ml-auto`} onClick={() => { save.reset(); setEditing(fitsToDrafts(rows)) }}>
            {rows.length ? 'Edit fits' : 'Add fits'}
          </button>
        )}
      </div>
      <div className="mt-2">
        {editing !== null ? (
          <>
            <FitsEditor subjects={subjects} value={editing} onChange={setEditing} defaultSubject={fits.data?.default_subject} errors={errors} />
            {save.isError && Object.keys(errors).length === 0 && (
              <p className="mt-2 text-xs text-[var(--color-danger)]">{save.error instanceof Error ? save.error.message : 'Could not save the fits.'}</p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={ghostBtn} onClick={() => setEditing(null)}>Cancel</button>
              <button
                type="button"
                data-fit-save=""
                className={primaryBtn}
                disabled={save.isPending}
                onClick={() => save.mutate(editing, { onSuccess: () => setEditing(null) })}
              >
                {save.isPending ? 'Saving…' : 'Save fits'}
              </button>
            </div>
          </>
        ) : fits.isLoading ? (
          <div className="h-10 animate-pulse rounded-lg bg-[var(--bins-softer)]" />
        ) : rows.length ? (
          <FitsList fits={rows} subjects={subjects} />
        ) : (
          <p className="text-sm text-[var(--bins-text-2)]">
            Nothing recorded yet. Add what this fits ({subjects.map((s) => s.label.toLowerCase()).join(', ')}) and the catalog's Fits filter finds it.
          </p>
        )}
      </div>
    </div>
  )
}
