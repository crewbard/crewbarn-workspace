import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import {
  createPosting,
  updatePosting,
  setPostingStatus,
  EMPLOYMENT_TYPE_LABEL,
  QUESTION_TYPE_LABEL,
  type ApplicationQuestion,
  type EmploymentType,
  type JobPosting,
  type JobPostingInput,
  type PayEntry,
  type PayType,
  type QuestionType,
  type Requirement,
  PAY_TYPES,
  formatPay,
} from '@/lib/hiring'

/**
 * One editor for the whole posting: the job, the requirements, and the
 * application form. Three sections on one screen rather than a wizard,
 * because a tenant writing a posting goes back and forth — adding a
 * requirement usually suggests a question, and vice versa.
 *
 * The form builder is deliberately plain: a list of questions with a type,
 * a required flag, and options for the pick-one/pick-several types. No
 * conditional logic, no sections. The shops using this hire two people a
 * year; a form they can build in three minutes beats one they could build
 * anything with.
 */

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

const STARTER_QUESTIONS: ApplicationQuestion[] = [
  { key: '', label: 'Years of experience in this trade', type: 'number', required: true, options: null, help: null },
  { key: '', label: 'Do you have a valid driver\'s license?', type: 'boolean', required: true, options: null, help: null },
  { key: '', label: 'When could you start?', type: 'date', required: false, options: null, help: null },
  { key: '', label: 'Tell us about your relevant experience', type: 'longtext', required: false, options: null, help: null },
  { key: '', label: 'Resume', type: 'file', required: false, options: null, help: 'PDF or Word document' },
]

interface Draft {
  title: string
  employment_type: EmploymentType
  description: string
  pay: PayDraft[]
  city: string
  state: string
  zip: string
  requirements: Requirement[]
  form: ApplicationQuestion[]
  license_required: boolean
}

/** Editor-side pay row: amounts as typed text so a half-typed "18." survives. */
interface PayDraft {
  type: PayType
  min: string
  max: string
  percent: string
  description: string
}

const cents = (dollars: string): number | null => {
  const n = parseFloat(dollars)
  return Number.isFinite(n) && dollars.trim() !== '' ? Math.round(n * 100) : null
}
const dollars = (c: number | null): string => (c == null ? '' : (c / 100).toString())

const toPayDraft = (e: PayEntry): PayDraft => ({
  type: e.type,
  min: dollars(e.min_cents),
  max: dollars(e.max_cents),
  percent: e.percent == null ? '' : String(e.percent),
  description: e.description ?? '',
})

const toPayEntry = (d: PayDraft): PayEntry => {
  const def = PAY_TYPES[d.type]
  const pct = parseFloat(d.percent)
  return {
    type: d.type,
    min_cents: def.amount === 'money' ? cents(d.min) : null,
    max_cents: def.amount === 'money' ? cents(d.max) : null,
    percent: def.amount === 'percent' && Number.isFinite(pct) && d.percent.trim() !== '' ? pct : null,
    description: d.description.trim() || null,
  }
}

function toDraft(p: JobPosting | null): Draft {
  return {
    title: p?.title ?? '',
    employment_type: p?.employment_type ?? 'full_time',
    description: p?.description ?? '',
    pay: (p?.pay ?? []).map(toPayDraft),
    city: p?.city ?? '',
    state: p?.state ?? '',
    zip: p?.zip ?? '',
    requirements: p?.requirements ?? [],
    // A new posting starts with a sensible form so the builder isn't a
    // blank page. Every starter can be deleted.
    form: p ? p.form : STARTER_QUESTIONS,
    // Field trades drive: a new posting asks for the license unless the
    // office unticks it.
    license_required: p ? !!p.license_required : true,
  }
}

function toInput(d: Draft): JobPostingInput & { title: string } {
  return {
    title: d.title.trim(),
    employment_type: d.employment_type,
    description: d.description.trim() || null,
    pay: d.pay.map(toPayEntry),
    city: d.city.trim() || null,
    state: d.state || null,
    zip: d.zip.trim() || null,
    requirements: d.requirements.filter((r) => r.text.trim() !== ''),
    form: d.form.filter((q) => q.label.trim() !== ''),
    license_required: d.license_required,
  }
}

export function JobPostingEditor({
  posting,
  onClose,
  onSaved,
}: {
  posting: JobPosting | null
  onClose: () => void
  onSaved: (p: JobPosting) => void
}) {
  const [d, setD] = useState<Draft>(() => toDraft(posting))
  const [error, setError] = useState<string | null>(null)
  const patch = (partial: Partial<Draft>) => setD((prev) => ({ ...prev, ...partial }))
  // A brand-new posting is created on the first save; a second click (after
  // fixing an "add a city and state" error, say) must update it, not create
  // another one.
  const [saved, setSaved] = useState<JobPosting | null>(posting)

  const persist = async () => {
    const input = toInput(d)
    const resp = saved ? await updatePosting(saved.id, input) : await createPosting(input)
    setSaved(resp.data)
    return resp.data
  }

  const save = useMutation({
    mutationFn: persist,
    onSuccess: (p) => onSaved(p),
    onError: (e: Error) => setError(e.message),
  })

  // "Save & open": the posting only shows on the job board once it's open.
  // Saving alone leaves a draft nobody can see — easy to miss.
  const saveAndOpen = useMutation({
    mutationFn: async () => {
      const p = await persist()
      return (await setPostingStatus(p.id, 'open')).data
    },
    onSuccess: (p) => onSaved(p),
    onError: (e: Error) => setError(e.message),
  })

  const busy = save.isPending || saveAndOpen.isPending
  const canSave = d.title.trim() !== '' && !busy
  const isLive = (saved ?? posting)?.status === 'open'

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={posting ? 'Edit posting' : 'New posting'}
      subtitle={posting?.status === 'open' ? 'This posting is live — changes show immediately.' : undefined}
      size="lg"
      disableBackdropClose
    >
      <Modal.Body>
        <div className="space-y-8">
          {/* ---------------- The job ---------------- */}
          <section className="space-y-4">
            <SectionHeading n={1} title="The job" />
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Title" required>
                <input
                  autoFocus
                  value={d.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Automotive Locksmith Technician"
                  className={INPUT}
                />
              </Field>
              <Field label="Type">
                <select
                  value={d.employment_type}
                  onChange={(e) => patch({ employment_type: e.target.value as EmploymentType })}
                  className={INPUT}
                >
                  {(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((t) => (
                    <option key={t} value={t}>{EMPLOYMENT_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_100px_120px]">
              <Field label="City" hint="Job seekers search by this.">
                <input value={d.city} onChange={(e) => patch({ city: e.target.value })} placeholder="Melbourne" className={INPUT} />
              </Field>
              <Field label="State">
                <select value={d.state} onChange={(e) => patch({ state: e.target.value })} className={INPUT}>
                  <option value="">—</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="ZIP">
                <input value={d.zip} onChange={(e) => patch({ zip: e.target.value })} placeholder="32901" className={INPUT} inputMode="numeric" />
              </Field>
            </div>

            {/* Pay is a package, not a range: hourly + parts commission + a
                bonus is the normal shape of a trade job, and the commission is
                usually the part that closes the hire. */}
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pay</span>
                {d.pay.length > 0 && (
                  <span className="truncate text-xs text-slate-500">
                    Shows as: <span className="font-medium text-slate-800">{formatPay({ pay: d.pay.map(toPayEntry) }) ?? '—'}</span>
                  </span>
                )}
              </div>
              {d.pay.length === 0 && (
                <p className="mb-2 text-xs text-slate-400">Optional. Postings with pay get more applicants — add each part of the package.</p>
              )}
              <ul className="space-y-2">
                {d.pay.map((row, i) => (
                  <PayRow
                    key={i}
                    row={row}
                    onChange={(next) => patch({ pay: replaceAt(d.pay, i, next) })}
                    onRemove={() => patch({ pay: removeAt(d.pay, i) })}
                  />
                ))}
              </ul>
              <div className="mt-2">
                <AddButton
                  onClick={() =>
                    patch({
                      pay: [
                        ...d.pay,
                        // Default to the first type not already in the package.
                        { type: nextPayType(d.pay), min: '', max: '', percent: '', description: '' },
                      ],
                    })
                  }
                >
                  Add pay type
                </AddButton>
              </div>
            </div>

            <Field label="Description" hint="What the work is, what a day looks like, what you offer.">
              <textarea
                value={d.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={7}
                className={INPUT}
                placeholder="We're a family-owned locksmith serving Brevard County since 2009. You'll run service calls in a stocked van..."
              />
            </Field>
          </section>

          {/* ---------------- Requirements ---------------- */}
          <section className="space-y-3">
            <SectionHeading
              n={2}
              title="Requirements"
              hint="Listed on the posting. Tick “must confirm” and the applicant has to check a box saying they meet it — quick screening without a question."
            />
            {d.requirements.length === 0 && (
              <p className="text-sm text-slate-500">No requirements yet.</p>
            )}
            <ul className="space-y-2">
              {d.requirements.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input
                    value={r.text}
                    onChange={(e) => patch({ requirements: replaceAt(d.requirements, i, { ...r, text: e.target.value }) })}
                    placeholder="Valid driver's license and clean record"
                    className={INPUT + ' flex-1'}
                  />
                  <label className="flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={r.must_confirm}
                      onChange={(e) => patch({ requirements: replaceAt(d.requirements, i, { ...r, must_confirm: e.target.checked }) })}
                    />
                    Must confirm
                  </label>
                  <RemoveButton onClick={() => patch({ requirements: removeAt(d.requirements, i) })} />
                </li>
              ))}
            </ul>
            <AddButton onClick={() => patch({ requirements: [...d.requirements, { text: '', must_confirm: false }] })}>
              Add requirement
            </AddButton>
            <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <input type="checkbox" checked={d.license_required} onChange={(e) => patch({ license_required: e.target.checked })} className="mt-0.5" />
              <span>
                <span className="font-semibold text-slate-800">Ask for a photo of their driver's license (front and back)</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  They take it with their phone; from a computer they scan a code and use their phone's camera. You'll see both photos on the application.
                </span>
              </span>
            </label>
          </section>

          {/* ---------------- Application form ---------------- */}
          <section className="space-y-3">
            <SectionHeading
              n={3}
              title="Application form"
              hint="Name, email and phone come from the applicant's account automatically. Everything below is yours."
            />
            <ol className="space-y-3">
              {d.form.map((q, i) => (
                <QuestionRow
                  key={i}
                  q={q}
                  index={i}
                  count={d.form.length}
                  onChange={(next) => patch({ form: replaceAt(d.form, i, next) })}
                  onMove={(dir) => patch({ form: move(d.form, i, dir) })}
                  onRemove={() => patch({ form: removeAt(d.form, i) })}
                />
              ))}
            </ol>
            <AddButton
              onClick={() =>
                patch({ form: [...d.form, { key: '', label: '', type: 'text', required: false, options: null, help: null }] })
              }
            >
              Add question
            </AddButton>
          </section>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0 text-sm text-rose-700">{error}</div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => { setError(null); save.mutate() }}
              className={isLive
                ? 'rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50'
                : 'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50'}
            >
              {save.isPending ? 'Saving…' : isLive ? 'Save changes' : saved ? 'Save draft' : 'Save as draft'}
            </button>
            {!isLive && (
              <button
                type="button"
                disabled={!canSave}
                onClick={() => { setError(null); saveAndOpen.mutate() }}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                title="Needs a description, city and state"
              >
                {saveAndOpen.isPending ? 'Opening…' : 'Save & open'}
              </button>
            )}
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  )
}

// ---------------- Pay row ----------------

function nextPayType(existing: PayDraft[]): PayType {
  const used = new Set(existing.map((p) => p.type))
  return (Object.keys(PAY_TYPES) as PayType[]).find((t) => !used.has(t)) ?? 'other'
}

function PayRow({ row, onChange, onRemove }: { row: PayDraft; onChange: (r: PayDraft) => void; onRemove: () => void }) {
  const def = PAY_TYPES[row.type]
  const single = row.type === 'bonus' || row.type === 'other'
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-[170px_1fr_auto]">
        <select
          value={row.type}
          onChange={(e) => onChange({ ...row, type: e.target.value as PayType })}
          className={INPUT}
        >
          {(Object.keys(PAY_TYPES) as PayType[]).map((t) => (
            <option key={t} value={t}>{PAY_TYPES[t].label}</option>
          ))}
        </select>

        {def.amount === 'money' ? (
          <div className="flex items-center gap-2">
            <MoneyInput value={row.min} onChange={(v) => onChange({ ...row, min: v })} placeholder={single ? 'Amount' : 'From'} />
            {!single && (
              <>
                <span className="text-xs text-slate-400">to</span>
                <MoneyInput value={row.max} onChange={(v) => onChange({ ...row, max: v })} placeholder="To" />
              </>
            )}
            {def.unit && <span className="shrink-0 text-sm text-slate-500">{def.unit}</span>}
          </div>
        ) : def.amount === 'percent' ? (
          <div className="flex items-center gap-2">
            <div className="relative w-32">
              <input
                value={row.percent}
                onChange={(e) => onChange({ ...row, percent: e.target.value })}
                inputMode="decimal"
                placeholder="10"
                className={INPUT + ' pr-7'}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
            <span className="text-xs text-slate-400">{def.hint}</span>
          </div>
        ) : (
          <div className="flex items-center text-xs text-slate-400">{def.hint}</div>
        )}

        <RemoveButton onClick={onRemove} />
      </div>
      <input
        value={row.description}
        onChange={(e) => onChange({ ...row, description: e.target.value })}
        placeholder={
          row.type === 'bonus'
            ? 'After 90 days, paid with the first check…'
            : row.type.startsWith('commission')
              ? 'On all parts sold on your own calls…'
              : 'Details (optional)'
        }
        className="mt-2 block w-full rounded-md border border-transparent px-2 py-1 text-xs text-slate-600 placeholder:text-slate-400 hover:border-slate-200 focus:border-amber-400 focus:outline-none"
      />
    </li>
  )
}

// ---------------- Question row ----------------

function QuestionRow({
  q,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  q: ApplicationQuestion
  index: number
  count: number
  onChange: (q: ApplicationQuestion) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const hasOptions = q.type === 'select' || q.type === 'multiselect'

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 flex-col pt-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className={ARROW} aria-label="Move up">▲</button>
          <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} className={ARROW} aria-label="Move down">▼</button>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
            <input
              value={q.label}
              onChange={(e) => onChange({ ...q, label: e.target.value })}
              placeholder="Question"
              className={INPUT}
            />
            <select
              value={q.type}
              onChange={(e) => {
                const type = e.target.value as QuestionType
                const keepOptions = type === 'select' || type === 'multiselect'
                onChange({ ...q, type, options: keepOptions ? (q.options ?? ['']) : null })
              }}
              className={INPUT}
            >
              {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
                <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>

          {hasOptions && (
            <div className="space-y-1.5 rounded-md bg-slate-50 p-2">
              {(q.options ?? []).map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <span className="w-4 text-center text-xs text-slate-400">{q.type === 'select' ? '○' : '☐'}</span>
                  <input
                    value={o}
                    onChange={(e) => onChange({ ...q, options: replaceAt(q.options ?? [], oi, e.target.value) })}
                    placeholder={`Option ${oi + 1}`}
                    className={INPUT + ' py-1 text-sm'}
                  />
                  <RemoveButton onClick={() => onChange({ ...q, options: removeAt(q.options ?? [], oi) })} small />
                </div>
              ))}
              <button
                type="button"
                onClick={() => onChange({ ...q, options: [...(q.options ?? []), ''] })}
                className="text-xs font-semibold text-amber-700 hover:underline"
              >
                + Add option
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <input type="checkbox" checked={q.required} onChange={(e) => onChange({ ...q, required: e.target.checked })} />
              Required
            </label>
            <input
              value={q.help ?? ''}
              onChange={(e) => onChange({ ...q, help: e.target.value || null })}
              placeholder="Help text (optional)"
              className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-xs text-slate-600 placeholder:text-slate-400 hover:border-slate-200 focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>
        <RemoveButton onClick={onRemove} />
      </div>
    </li>
  )
}

// ---------------- Bits ----------------

const INPUT =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'
const ARROW = 'px-1 text-[10px] leading-4 text-slate-400 hover:text-slate-700 disabled:opacity-30'

function SectionHeading({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] text-white">{n}</span>
        {title}
      </h3>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

function MoneyInput({ value, onChange, placeholder = '0.00' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        className={INPUT + ' pl-7'}
      />
    </div>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800"
    >
      + {children}
    </button>
  )
}

function RemoveButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove"
      className={`shrink-0 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 ${small ? 'px-1.5 py-0.5 text-sm' : 'px-2 py-1.5 text-base'}`}
    >
      ×
    </button>
  )
}

function replaceAt<T>(list: T[], i: number, item: T): T[] {
  const next = list.slice()
  next[i] = item
  return next
}
function removeAt<T>(list: T[], i: number): T[] {
  return list.filter((_, idx) => idx !== i)
}
function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = list.slice()
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
