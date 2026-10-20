import { useEffect, useState } from 'react'
import '@/components/inventory/bins/bins.css'
import { FilterChip } from '@/components/ui/FilterChip'
import { DraftBadge, fitErrors } from '@/components/fitment/FitsSection'
import { SuggestedFits } from '@/components/fitment/SuggestedFits'
import {
  useFitmentProfile, useResetFitmentProfile, useSaveFitmentProfile, useTakeFitmentUpdate,
  type FitmentField, type FitmentFieldType, type FitmentProfile, type FitmentSubject,
} from '@/lib/fitment'

/**
 * Product catalog → Fitment: the company's fitment profile. It starts as the
 * trade's draft (marked Draft), which already works; the first save makes the
 * company's own copy, which re-seeding never touches. From here: change
 * subjects and fields, use the draft as it is, turn fitment off, take a newer
 * draft's fields, or go back to the trade draft.
 */

const input = 'w-full rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2 py-1.5 text-sm text-[var(--bins-text)] placeholder:text-[var(--bins-muted)] focus:border-[var(--bins-accent)] focus:outline-none disabled:opacity-70'
const ghostBtn = 'rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 py-1.5 text-sm font-medium text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)] disabled:cursor-not-allowed disabled:opacity-60'
const primaryBtn = 'rounded-md bg-[var(--bins-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60'

const TYPE_LABELS: Record<FitmentFieldType, string> = {
  text: 'Text',
  number: 'Number',
  year_range: 'Years',
  choice: 'Pick from a list',
  code: 'Code (keyway, series)',
  dimensions: 'Size (16x7)',
}

const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f_$1').slice(0, 40) || 'field'

function uniqueKey(base: string, taken: string[]) {
  let key = base
  let n = 2
  while (taken.includes(key)) key = `${base}_${n++}`.slice(0, 40)
  return key
}

export const FITMENT_NOTICE_KEY = 'crewbarn.fitment.notice.dismissed'

/** One-time notice on the Product catalog while the company is on its trade's draft. */
export function FitmentNotice({ onReview }: { onReview: () => void }) {
  const { data } = useFitmentProfile()
  const [dismissed, setDismissed] = useState(() => typeof localStorage !== 'undefined' && localStorage.getItem(FITMENT_NOTICE_KEY) === '1')
  if (!data || dismissed || data.status !== 'draft' || data.profile.subjects.length === 0) return null
  const trades = data.based_on.map((b) => b.label).join(' + ')
  const subjects = data.profile.subjects.map((s) => s.label).join(', ')
  return (
    <div data-fitment-notice="" className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] px-4 py-3">
      <DraftBadge />
      <p className="min-w-0 flex-1 text-sm text-[var(--bins-text)]">
        <strong>New: Fits.</strong> Your {trades} fitment draft is ready. Record what each part fits ({subjects}), then filter the catalog by it. It works now; change the fields any time.
      </p>
      <div className="flex gap-2">
        <button type="button" className={primaryBtn} onClick={onReview}>Review fields</button>
        <button
          type="button"
          className={ghostBtn}
          onClick={() => { localStorage.setItem(FITMENT_NOTICE_KEY, '1'); setDismissed(true) }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

function FieldRow({ field, canEdit, onChange, onRemove }: {
  field: FitmentField
  canEdit: boolean
  onChange: (f: FitmentField) => void
  onRemove: () => void
}) {
  const [choices, setChoices] = useState((field.choices ?? []).join(', '))
  useEffect(() => setChoices((field.choices ?? []).join(', ')), [field.choices])
  return (
    <div data-profile-field={field.key} className="grid gap-2 rounded-lg border border-[var(--bins-border)] p-2 sm:grid-cols-[1.2fr_1fr_auto]">
      <input aria-label="Field name" className={input} value={field.label} disabled={!canEdit} onChange={(e) => onChange({ ...field, label: e.target.value })} />
      <select
        aria-label="Type"
        className={input}
        value={field.type}
        disabled={!canEdit}
        onChange={(e) => {
          const type = e.target.value as FitmentFieldType
          onChange({ ...field, type, choices: type === 'choice' ? field.choices ?? [] : undefined })
        }}
      >
        {(Object.keys(TYPE_LABELS) as FitmentFieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
      </select>
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--bins-text-2)]">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={!!field.required} disabled={!canEdit} onChange={(e) => onChange({ ...field, required: e.target.checked })} /> Needed
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={!!field.filter} disabled={!canEdit} onChange={(e) => onChange({ ...field, filter: e.target.checked })} /> Filter
        </label>
        {canEdit && (
          <button type="button" className="text-xs font-medium text-[var(--color-danger)] hover:underline" onClick={onRemove}>Remove</button>
        )}
      </div>
      {field.type === 'choice' && (
        <input
          aria-label="Choices"
          className={`${input} sm:col-span-3`}
          value={choices}
          disabled={!canEdit}
          placeholder="Choices, separated by commas"
          onChange={(e) => setChoices(e.target.value)}
          onBlur={() => onChange({ ...field, choices: choices.split(',').map((c) => c.trim()).filter(Boolean) })}
        />
      )}
    </div>
  )
}

function SubjectEditor({ subject, canEdit, onChange, onRemove, canRemove }: {
  subject: FitmentSubject
  canEdit: boolean
  onChange: (s: FitmentSubject) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const setField = (i: number, f: FitmentField) => {
    // A field added here takes its key from its name ("Engine" → engine) until it is saved.
    if (f.isNew && f.label.trim()) {
      f = { ...f, key: uniqueKey(slug(f.label), subject.fields.filter((_, j) => j !== i).map((x) => x.key)) }
    }
    onChange({ ...subject, fields: subject.fields.map((x, j) => (j === i ? f : x)) })
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-[11px] text-[var(--bins-muted)]">Name</span>
          <input className={input} value={subject.label} disabled={!canEdit} onChange={(e) => onChange({ ...subject, label: e.target.value })} />
        </label>
        {canEdit && canRemove && (
          <button type="button" className={`${ghostBtn} self-end`} onClick={onRemove}>Remove {subject.label}</button>
        )}
      </div>
      {(subject.categories?.length ?? 0) > 0 && (
        <p className="text-xs text-[var(--bins-text-2)]">
          New fits on products in {subject.categories!.join(', ')} start as {subject.label}.
        </p>
      )}
      {subject.card?.hide_keys && (
        <p className="text-xs text-[var(--bins-text-2)]">The vehicle card opens on the parts that fit; key sections are hidden for this trade.</p>
      )}
      <div className="space-y-2">
        {subject.fields.map((f, i) => (
          <FieldRow
            key={i}
            field={f}
            canEdit={canEdit}
            onChange={(next) => setField(i, next)}
            onRemove={() => onChange({
              ...subject,
              fields: subject.fields.filter((_, j) => j !== i),
              // A detection rule keyed to the removed field goes with it.
              detect: (subject.detect ?? []).filter((r) => r.field !== f.key),
            })}
          />
        ))}
      </div>
      {canEdit && (
        <button
          type="button"
          data-profile-add-field=""
          className={ghostBtn}
          onClick={() => onChange({
            ...subject,
            fields: [...subject.fields, { key: uniqueKey('field', subject.fields.map((f) => f.key)), label: 'New field', type: 'text', required: false, filter: false, isNew: true }],
          })}
        >
          + Add a field
        </button>
      )}
    </div>
  )
}

export function FitmentProfilePanel({ canEdit, onClose }: { canEdit: boolean; onClose: () => void }) {
  const { data, isLoading } = useFitmentProfile()
  const save = useSaveFitmentProfile()
  const reset = useResetFitmentProfile()
  const takeUpdate = useTakeFitmentUpdate()
  const [draft, setDraft] = useState<FitmentProfile | null>(null)
  const [tab, setTab] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    if (data) setDraft(structuredClone(data.profile))
  }, [data])

  const profile = draft ?? data?.profile
  const subjects = profile?.subjects ?? []
  const current = subjects.find((s) => s.key === tab) ?? subjects[0]
  const dirty = !!data && !!draft && JSON.stringify(draft) !== JSON.stringify(data.profile)
  const errors = fitErrors(save.error)
  const trades = data?.based_on.map((b) => b.label).join(' + ') ?? ''

  const setSubject = (key: string, next: FitmentSubject) =>
    setDraft((d) => (d ? { ...d, subjects: d.subjects.map((s) => (s.key === key ? next : s)) } : d))

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[color-mix(in_srgb,var(--bins-dark)_50%,transparent)] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div data-bins-ui="" data-fitment-panel="" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[var(--bins-surface)] shadow-xl">
        <div className="flex items-center gap-2 border-b border-[var(--bins-border-soft)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--bins-text)]">Fitment</h2>
          {data?.status === 'draft' && <DraftBadge />}
          {data?.status === 'active' && (
            <span className="rounded-full border border-[var(--bins-border)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--bins-text-2)]">In use</span>
          )}
          {data?.status === 'off' && (
            <span className="rounded-full border border-[var(--bins-border)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--bins-muted)]">Off</span>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-xl text-[var(--bins-muted)] hover:text-[var(--bins-text)]">×</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {isLoading || !profile ? (
            <div className="h-24 animate-pulse rounded-lg bg-[var(--bins-softer)]" />
          ) : (
            <>
              <p className="text-sm text-[var(--bins-text-2)]">
                What your parts fit, and the fields each one takes. {data?.own
                  ? `Your own copy, started from the ${trades} draft.`
                  : `This is the ${trades} draft. It works now: add fits to products and filter by them. Saving a change makes it yours, and updates to the draft never overwrite it.`}
              </p>

              {data?.update_available && canEdit && (
                <div data-fitment-update="" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] px-3 py-2 text-sm text-[var(--bins-text)]">
                  <span className="flex-1">An updated {trades} draft has new subjects or fields. Taking them adds to yours; nothing you wrote changes.</span>
                  <button type="button" className={primaryBtn} disabled={takeUpdate.isPending} onClick={() => takeUpdate.mutate()}>
                    {takeUpdate.isPending ? 'Adding…' : 'Take the new fields'}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {subjects.map((s) => (
                  <FilterChip key={s.key} chip={`subject-${s.key}`} active={current?.key === s.key} label={s.label} count={s.fields.length} onClick={() => setTab(s.key)} />
                ))}
                {canEdit && subjects.length < 10 && (
                  <button
                    type="button"
                    data-profile-add-subject=""
                    className="text-[13px] font-medium text-[var(--bins-accent-ink)] hover:underline"
                    onClick={() => {
                      const key = uniqueKey(slug('Equipment'), subjects.map((s) => s.key))
                      setDraft((d) => d ? {
                        ...d,
                        subjects: [...d.subjects, {
                          key,
                          label: 'Equipment',
                          title: '{brand} {model}',
                          fields: [
                            { key: 'brand', label: 'Brand', type: 'text', required: true, filter: true },
                            { key: 'model', label: 'Model', type: 'text', required: true, filter: true, prefix: true },
                          ],
                          detect: [{ kind: 'known_model', field: 'model' }],
                        }],
                      } : d)
                      setTab(key)
                    }}
                  >
                    + Add a subject
                  </button>
                )}
              </div>

              {current && (
                <SubjectEditor
                  key={current.key}
                  subject={current}
                  canEdit={canEdit}
                  canRemove={subjects.length > 1}
                  onChange={(next) => setSubject(current.key, next)}
                  onRemove={() => {
                    setDraft((d) => (d ? { ...d, subjects: d.subjects.filter((s) => s.key !== current.key) } : d))
                    setTab(null)
                  }}
                />
              )}

              {data?.status !== 'off' && <SuggestedFits canEdit={canEdit} />}

              {save.isError && (
                <p className="text-sm text-[var(--color-danger)]">
                  {Object.keys(errors).length ? Object.values(errors).join(' ') : save.error instanceof Error ? save.error.message : 'Could not save.'}
                </p>
              )}
            </>
          )}
        </div>

        {canEdit && data && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--bins-border-soft)] bg-[var(--bins-softer)] px-6 py-4">
            {data.own && (confirmReset ? (
              <>
                <span className="text-sm text-[var(--bins-text-2)]">Go back to the {trades} draft? Your changes to the fields go; fits on products stay.</span>
                <button type="button" className={ghostBtn} onClick={() => setConfirmReset(false)}>Keep mine</button>
                <button type="button" className={ghostBtn} disabled={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: () => setConfirmReset(false) })}>Go back</button>
              </>
            ) : (
              <button type="button" data-profile-reset="" className={ghostBtn} onClick={() => setConfirmReset(true)}>Go back to the trade draft</button>
            ))}
            <span className="mr-auto" />
            {data.status === 'off' ? (
              <button type="button" className={ghostBtn} disabled={save.isPending} onClick={() => save.mutate({ status: 'draft' })}>Turn fitment on</button>
            ) : (
              <button type="button" data-profile-off="" className={ghostBtn} disabled={save.isPending} onClick={() => save.mutate({ status: 'off' })}>Turn fitment off</button>
            )}
            {data.status === 'draft' && !dirty && (
              <button type="button" data-profile-use="" className={primaryBtn} disabled={save.isPending} onClick={() => save.mutate({ status: 'active' })}>Use as is</button>
            )}
            {dirty && draft && (
              <button
                type="button"
                data-profile-save=""
                className={primaryBtn}
                disabled={save.isPending}
                onClick={() => save.mutate({ profile: draft, status: data.status === 'draft' ? 'active' : data.status })}
              >
                {save.isPending ? 'Saving…' : 'Save fields'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
