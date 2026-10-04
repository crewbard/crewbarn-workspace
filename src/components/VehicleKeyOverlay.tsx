import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'
import { PERM, usePermissions } from '@/hooks/usePermissions'

/**
 * Everything about one vehicle, on one card.
 *
 * Opens from a vehicle named in a job description or a call
 * transcript. The office is on the phone, so the card leads with the
 * answer that decides the job — which route it goes down and whether
 * a programmer is needed at all — and puts the part numbers under it.
 *
 * **Editable, because catalogues are wrong sometimes.** The person who
 * finds out is the tech at the car. Any field with a pencil can be
 * corrected, the correction is live for this shop immediately, and it
 * can be sent for review to go platform-wide. A corrected value never
 * looks catalogue-printed: it says who changed it and what it said
 * before.
 *
 * Tenant side only. There is no portal route to this and there should
 * not be — it carries what the shop pays, what it owns and where its
 * stock sits.
 *
 * **Part numbers, not suppliers.** The card gives the number and
 * stops. Every shop buys from somebody different, so there is nothing
 * here that leaves CrewBarn for a distributor's site.
 */

type Correction = {
  was: string | null
  scope: 'shop' | 'platform'
  status: string
  reason: string | null
  correction_id: string
}

type Candidate = {
  id: string
  subject: string
  make?: string
  model?: string | null
  years?: string | null
  blank?: string | null
  blank_transponder?: string | null
  key_type?: string | null
  transponder?: string | null
  chip?: string | null
  onboard_code?: string | null
  service_key?: string | null
  code_series?: string | null
  lock_apps?: string | null
  oem_part?: string | null
  notes?: string | null
  cloneable?: string | null
  lishi?: string[]
  added_by_shop?: boolean
  /** Rows this shop invented, with the titles it chose. */
  custom_rows?: { field: string; label: string; value: string | null; scope?: string; status?: string }[]
  /** This shop's own name for a row the book already has. */
  row_labels?: Record<string, string>
  scope?: string
  status?: string
  programming_tools?: string[]
  cloning_tools?: string[]
  routes?: {
    options: {
      route: string
      label: string
      needs: string
      warn?: string | null
      procedure_known?: boolean
      from_catalogue?: boolean
      vats_resistance?: unknown
    }[]
    decided_by_keys_in_hand: boolean
    keys_in_hand: number | null
  }
  corrected?: Record<string, Correction>
}

type OemPart = {
  id: string
  subject: string
  kind: string
  model: string
  years: string | null
  oem_parts: string[]
  fcc_ids: string[]
  supplier_part: string | null
  description: string | null
  service_key_blanks: string[]
  non_remote_chipped: string[]
  source: string
  corrected?: Record<string, Correction>
}

type LockPart = {
  id: string
  subject: string
  component: string
  part: string
  model: string
  year: number | null
  is_range: boolean
  see_note: boolean
  source: string
  corrected?: Record<string, Correction>
}

type Tool = {
  name: string
  held_by: { tech_id: string; tech: string; asset: string }[]
  in_shop: boolean
  owned: boolean
}

type ShelfRow = StockRow & {
  /** The label carries the year, so this is about this vehicle. */
  names_year: boolean
  names_make: boolean
}

type StockRow = {
  catalog_item_id: string
  name: string
  sku: string | null
  image: string | null
  total_available: number
  in_stock: boolean
  locations: {
    location: string | null
    location_type: string | null
    bin: string | null
    qty_available: number
    qty_on_hand: number
    tech: string | null
  }[]
}

type Cylinder = {
  source: string
  profile: string | null
  keying_kits: string[]
  category: string
  model: string
  years: string | null
  parts: string[]
  other_parts: string[]
  dealer_only: boolean
  other_supplier: string | null
  discontinued: boolean
  parts_not_available: boolean
  no_cylinder: boolean
  cross_reference: boolean
  detail: string | null
  catalog_year: number | null
}

/** The guide's verdict on its own row, against the library's Lishi line. */
type GuideVerdict = 'agrees' | 'library_silent' | 'same_family' | 'differs'

type LishiGuideRow = {
  model: string
  years: string
  category: 'auto' | 'moto'
  keyway: string
  lishi: string | null
  eez_reader: string | null
  accu_reader: string | null
  tryout_keys: string | null
  page: number | null
  library: GuideVerdict | null
}

type Card = {
  vehicle: { make?: string; model?: string; year?: number; category?: string }
  key: {
    candidates: Candidate[]
    match_count: number
    year_outside_range: boolean
    decider: string | null
    keys_question: string | null
    nothing?: string
    why?: string
  }
  oem_parts: OemPart[]
  lock_parts: LockPart[]
  cylinders: Cylinder[]
  cylinders_predate_vehicle?: boolean
  tools: Tool[]
  stock: StockRow[]
  shelf?: ShelfRow[]
  /** Null when the guide is not loaded on this server. */
  lishi_guide?: { rows: LishiGuideRow[]; matched_on: string; source: string } | null
  recommended_tech: {
    tech: string
    has_tools: string[]
    has_parts: string[]
    why: string
    complete: boolean
  } | null
  library_loaded?: boolean
  library_database?: string | null
  parts_matched_on?: { oem: string; lock: string }
  editable_fields: Record<string, string[]>
  library_version: string | null
}

const ROUTE_TONE: Record<string, string> = {
  cut_only: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  onboard: 'bg-sky-50 border-sky-200 text-sky-900',
  scan_tool: 'bg-amber-50 border-amber-200 text-amber-900',
  vats_resistance: 'bg-violet-50 border-violet-200 text-violet-900',
}

function label(field: string): string {
  return field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  return String(value)
}

/**
 * One field, with the pencil that corrects it.
 *
 * A corrected value is never shown as if the catalogue printed it:
 * the badge says whether it is this shop's or platform-wide, and the
 * old value stays visible underneath.
 */
function Field({
  subject,
  subjectId,
  field,
  label: ownLabel,
  value,
  correction,
  editable,
  onSaved,
}: {
  subject: string
  subjectId: string
  field: string
  /** This shop's own name for the row, when it has given it one. */
  label?: string
  value: unknown
  correction?: Correction
  editable: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(Array.isArray(value) ? value.join(', ') : (value ?? '') as string)
  const [reason, setReason] = useState('')
  const [propose, setPropose] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () =>
      apiRequest('/v1/vehicle-keys/corrections', {
        method: 'POST',
        body: {
          subject,
          subject_id: subjectId,
          field,
          value: draft.trim() === '' ? null : draft,
          was: Array.isArray(value) ? value.join(', ') : (value ?? null),
          reason: reason || null,
          propose_to_platform: propose,
        },
      }),
    onSuccess: () => {
      setEditing(false)
      setError(null)
      onSaved()
    },
    onError: (e: ApiError | Error) => {
      const detail = (e as ApiError)?.details as { message?: string } | undefined
      setError(detail?.message ?? (e as Error).message ?? 'Could not save that correction.')
    },
  })

  if (editing) {
    return (
      <div className="py-1.5">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          {ownLabel || label(field)}
        </div>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-1 w-full px-2 py-1 text-sm border border-sky-400 rounded font-mono"
          placeholder="Leave empty to say the book is wrong and show nothing"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full px-2 py-1 text-xs border border-slate-300 rounded"
          placeholder="Why? (helps whoever reviews it)"
        />
        <label className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-600">
          <input type="checkbox" checked={propose} onChange={(e) => setPropose(e.target.checked)} />
          Wrong for everybody, not just us — send it for review
        </label>
        {error && <div className="mt-1 text-[11px] text-red-700">{error}</div>}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="px-2.5 py-1 text-xs rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null) }}
            className="px-2.5 py-1 text-xs rounded border border-slate-300 text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-1 group">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide min-w-[7.5rem]">
          {ownLabel || label(field)}
        </span>
        <span className="text-sm text-slate-900 font-mono break-all">{show(value)}</span>
        {correction && (
          <span
            className={
              'text-[10px] px-1.5 py-0.5 rounded-full border ' +
              (correction.scope === 'platform'
                ? 'bg-violet-50 border-violet-200 text-violet-800'
                : 'bg-amber-50 border-amber-200 text-amber-800')
            }
            title={correction.reason ?? undefined}
          >
            {correction.scope === 'platform' ? 'corrected platform-wide' : 'corrected by us'}
          </span>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 text-[11px] text-sky-700 hover:underline"
          >
            edit
          </button>
        )}
      </div>
      {correction?.was && (
        <div className="text-[11px] text-slate-400 ml-[8.25rem]">
          the book says <span className="line-through font-mono">{correction.was}</span>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count?: number
  empty?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-slate-200 pt-3">
      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
        {title}
        {count !== undefined && count > 0 && (
          <span className="ml-1.5 text-slate-400 font-normal normal-case">({count})</span>
        )}
      </h3>
      {/* An empty section says so. A missing heading reads like nobody checked. */}
      {count === 0 && empty ? (
        <p className="text-xs text-slate-500 italic">{empty}</p>
      ) : (
        children
      )}
    </section>
  )
}

const VERDICT: Record<GuideVerdict, { label: string; tone: string }> = {
  agrees: { label: 'matches the library', tone: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  library_silent: { label: 'library has none', tone: 'bg-sky-50 border-sky-200 text-sky-800' },
  same_family: { label: 'library lists a variant', tone: 'bg-amber-50 border-amber-200 text-amber-800' },
  differs: { label: 'library says otherwise', tone: 'bg-amber-50 border-amber-200 text-amber-900' },
}

/**
 * What the Lishi guide prints for this vehicle, beside the library.
 *
 * A second witness, not a correction. Each row says whether the
 * library agrees, and where it does not, both answers are on screen
 * and the lock in the tech's hand decides -- neither printed source
 * is assumed to be the right one.
 */
function LishiGuideSection({
  guide,
  libraryPicks,
  make,
}: {
  guide: NonNullable<Card['lishi_guide']>
  libraryPicks: string[]
  make: string
}) {
  return (
    <Section
      title="Lishi guide"
      count={guide.rows.length}
      empty="The guide has no row for this vehicle."
    >
      {/* "Every Ducati" is a different claim from "this bike", so it says which. */}
      {guide.matched_on === 'make' && (
        <p className="mb-1.5 text-[11px] text-slate-500">
          No row for this model — this is what the guide says for {make} as a whole.
        </p>
      )}
      <ul className="space-y-2">
        {guide.rows.map((row, i) => (
          <li key={`${row.model}-${row.years}-${i}`} className="rounded border border-slate-200 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-slate-600">
                {row.model} · {row.years}
              </span>
              {row.page !== null && (
                <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">p. {row.page}</span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-900">
                {row.lishi ?? 'No pick listed'}
              </span>
              {row.library && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${VERDICT[row.library].tone}`}>
                  {VERDICT[row.library].label}
                </span>
              )}
            </div>
            {(row.library === 'differs' || row.library === 'same_family') && libraryPicks.length > 0 && (
              <p className="mt-1 text-[11px] text-amber-900">
                Library: <span className="font-mono">{libraryPicks.join(', ')}</span>. Check on the lock.
              </p>
            )}
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
              <dt className="text-slate-500">Keyway</dt>
              <dd className="font-mono text-slate-800">{row.keyway}</dd>
              {row.eez_reader && (
                <>
                  <dt className="text-slate-500">EEZ reader</dt>
                  <dd className="font-mono text-slate-800">{row.eez_reader}</dd>
                </>
              )}
              {row.accu_reader && (
                <>
                  <dt className="text-slate-500">Accu-Reader</dt>
                  <dd className="font-mono text-slate-800">{row.accu_reader}</dd>
                </>
              )}
              {row.tryout_keys && (
                <>
                  <dt className="text-slate-500">Try-out keys</dt>
                  <dd className="font-mono text-slate-800">{row.tryout_keys}</dd>
                </>
              )}
            </dl>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-slate-400">{guide.source}, as printed.</p>
    </Section>
  )
}

/**
 * Write down a vehicle the book does not carry.
 *
 * The vehicle nobody has a page for is the one a shop most wants to
 * record, and until this existed the card was a dead end on exactly
 * that vehicle: nothing to show, and no pencil either, because the
 * pencil only appears beside a field that already has a value.
 *
 * Several fields at once, because a blank is no use without knowing
 * whether it is a transponder.
 */
function AddEntry({
  make,
  model,
  year,
  onSaved,
}: {
  make: string
  model?: string | null
  year?: number | null
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [propose, setPropose] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /*
   * Every row the card can show, in the order it shows them. It offered
   * seven of eleven before, so a shop could read a blank transponder
   * number or a Lishi match and had no way to write one.
   */
  const WRITABLE: { key: string; label: string; placeholder: string }[] = [
    { key: 'blank', label: 'Blank', placeholder: 'OEM-164-R8287' },
    { key: 'blank_transponder', label: 'Blank transponder', placeholder: 'OEM# 95440-S9330' },
    { key: 'key_type', label: 'Key type', placeholder: 'Proximity / smart key' },
    { key: 'transponder', label: 'Transponder', placeholder: 'Yes / No / Optional' },
    { key: 'chip', label: 'Chip', placeholder: 'Philips 49' },
    { key: 'code_series', label: 'Code series', placeholder: '30,001-31,544' },
    { key: 'lock_apps', label: 'Lock apps', placeholder: 'All' },
    { key: 'onboard_code', label: 'On-board code', placeholder: 'C' },
    { key: 'service_key', label: 'Service key', placeholder: 'Metal key to cut first' },
    { key: 'oem_part', label: 'OEM part', placeholder: '95440-S9330' },
    { key: 'cloneable', label: 'Cloneable', placeholder: 'Yes / No' },
    { key: 'programming_tools', label: 'Programming tools', placeholder: 'Autel, Xhorse, Smart Pro' },
    { key: 'cloning_tools', label: 'Cloning tools', placeholder: 'What clones it' },
    { key: 'lishi', label: 'Lishi', placeholder: 'KIA2018, KY14' },
    { key: 'notes', label: 'Notes', placeholder: 'What the next person needs to know' },
  ]

  const save = useMutation({
    mutationFn: () =>
      apiRequest('/v1/vehicle-keys/entries', {
        method: 'POST',
        body: {
          make,
          model: model || null,
          year_start: year ?? null,
          year_end: year ?? null,
          fields: {
            ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim() !== '')),
            ...extraFields,
          },
          reason: reason || null,
          propose_to_platform: propose,
        },
      }),
    onSuccess: () => {
      setOpen(false)
      setFields({})
      setExtra([])
      setError(null)
      onSaved()
    },
    onError: (e: ApiError | Error) => {
      const detail = (e as ApiError)?.details as { message?: string } | undefined
      setError(detail?.message ?? (e as Error).message ?? 'Could not save that.')
    },
  })

  /*
   * Rows this shop is inventing. Stored as "custom:<Title>", which is why
   * a title is as editable as its value -- it IS the field name.
   */
  const [extra, setExtra] = useState<{ label: string; value: string }[]>([])

  const extraFields = Object.fromEntries(
    extra
      .filter((row) => row.label.trim() !== '' && row.value.trim() !== '')
      .map((row) => [`custom:${row.label.trim()}`, row.value]),
  )

  const anything =
    Object.values(fields).some((v) => v.trim() !== '') || Object.keys(extraFields).length > 0

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-sky-400 hover:text-sky-700"
      >
        + Write down what this one takes
      </button>
    )
  }

  return (
    <div className="rounded border border-sky-300 bg-sky-50/50 p-3">
      <div className="text-xs font-semibold text-slate-700 mb-2">
        What this {[year, make, model].filter(Boolean).join(' ')} takes
      </div>

      <div className="space-y-1.5">
        {WRITABLE.map((f) => (
          <label key={f.key} className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide min-w-[7.5rem]">
              {f.label}
            </span>
            <input
              value={fields[f.key] ?? ''}
              onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded font-mono"
            />
          </label>
        ))}

        {/*
          Rows of the shop's own. The title is as editable as the value
          because the title IS the field -- it is stored as the name of
          the row, so a shop can record something the book never had a
          column for.
        */}
        {extra.map((row, i) => (
          <div key={i} className="flex items-baseline gap-2">
            <input
              value={row.label}
              onChange={(e) =>
                setExtra((p) => p.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
              }
              placeholder="Row title"
              maxLength={41}
              className="min-w-[7.5rem] max-w-[7.5rem] rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
            />
            <input
              value={row.value}
              onChange={(e) =>
                setExtra((p) => p.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
              }
              placeholder="What it says"
              className="flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
            />
            <button
              type="button"
              aria-label="Remove this row"
              onClick={() => setExtra((p) => p.filter((_, j) => j !== i))}
              className="shrink-0 px-1 text-slate-400 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setExtra((p) => [...p, { label: '', value: '' }])}
          className="self-start text-xs font-medium text-sky-700 hover:text-sky-900"
        >
          + Add a row of your own
        </button>
      </div>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Where this came from (helps whoever reviews it)"
        className="mt-2 w-full px-2 py-1 text-xs border border-slate-300 rounded"
      />

      <label className="flex items-center gap-2 mt-2 text-[11px] text-slate-600">
        <input type="checkbox" checked={propose} onChange={(e) => setPropose(e.target.checked)} />
        Every shop should have this, not just us — send it for review
      </label>

      {error && <div className="mt-1 text-[11px] text-red-700">{error}</div>}

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          disabled={save.isPending || !anything}
          onClick={() => save.mutate()}
          className="px-2.5 py-1 text-xs rounded bg-slate-900 text-white disabled:opacity-40"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="px-2.5 py-1 text-xs rounded border border-slate-300 text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function VehicleKeyOverlay({
  make,
  model,
  year,
  keysInHand,
  category,
  onClose,
}: {
  make: string
  model?: string | null
  year?: number | null
  keysInHand?: number | null
  category?: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()

  /*
   * Correcting the library is an edit, and the route refuses one from
   * anybody without this. Asked once here and passed down, so a tech
   * who cannot save is not offered a pencil that fails.
   */
  const { has } = usePermissions()
  const mayCorrect = has(PERM.CATALOG_EDIT)

  // Which option is on screen. Reset whenever the vehicle changes,
  // or a two-option truck opens showing the second one's answer.
  const [tab, setTab] = useState(0)

  const params = new URLSearchParams({ make })
  if (model) params.set('model', model)
  if (year) params.set('year', String(year))
  if (keysInHand !== null && keysInHand !== undefined) params.set('keys_in_hand', String(keysInHand))
  if (category) params.set('category', category)

  const queryKey = ['vehicle-key-overlay', make, model, year, keysInHand, category]
  const cardQ = useQuery({
    queryKey,
    queryFn: () => apiRequest<Card>(`/v1/vehicle-keys/overlay?${params.toString()}`),
  })

  const card = cardQ.data
  const refresh = () => qc.invalidateQueries({ queryKey })

  /*
   * Adjusted during render rather than in an effect. An effect paints
   * the old tab once and then corrects itself, so opening a second
   * vehicle flashes the first one's answer -- on a card whose whole
   * job is "which of these is your truck", that is the one flicker
   * that can be read as the answer.
   */
  const [shownVehicle, setShownVehicle] = useState(`${make}|${model}|${year}`)
  if (shownVehicle !== `${make}|${model}|${year}`) {
    setShownVehicle(`${make}|${model}|${year}`)
    setTab(0)
  }
  const editableFor = (subject: string) =>
    mayCorrect ? (card?.editable_fields?.[subject] ?? []) : []

  const title = [year, make, model].filter(Boolean).join(' ')

  /*
   * Into the body, not into the sentence this opened from. A job
   * description renders inside a <p>, and a <div> is not allowed
   * there -- the browser closes the paragraph early and reparents
   * everything after it, which loses the rest of the note.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        /*
         * Down the right, so whatever this was opened from stays
         * visible beside it. A centred dialog covers the transcript
         * you are reading it against, which is the one thing a
         * reference must not do.
         */
        className="fixed inset-y-0 right-0 z-50 flex w-[min(35rem,100vw)] flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title || make}</h2>
            {card?.library_version && (
              <p className="text-[11px] text-slate-400">Key library {card.library_version}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-2xl text-slate-500 leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {cardQ.isLoading && <div className="text-sm text-slate-500">Looking it up…</div>}

          {cardQ.isError && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
              Could not load the key reference for this vehicle.
            </div>
          )}

          {card && (
            <>
              {/* The question that decides whether a tech is sent at all. */}
              {card.key.keys_question && (
                <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm text-amber-900">
                  {card.key.keys_question}
                </div>
              )}

              {card.key.year_outside_range && (
                <p className="text-sm font-semibold text-red-700">
                  No match
                  {(card.shelf ?? []).length > 0 && (
                    <span className="font-normal text-slate-600"> in the book — your shelf has these</span>
                  )}
                </p>
              )}

              {/*
                What the shop bought for this vehicle, which the book cannot
                know about. An item labelled with the year is not a nearest
                guess -- somebody chose it for this truck.
              */}
              {(card.shelf ?? []).length > 0 && (
                <div className="rounded border border-slate-200">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    On your shelf for this vehicle
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {(card.shelf ?? []).map((item) => (
                      <li key={item.catalog_item_id} className="flex items-center gap-2.5 px-3 py-2">
                        {item.image && (
                          <img
                            src={item.image}
                            alt=""
                            loading="lazy"
                            className="h-8 w-8 shrink-0 rounded border border-slate-200 object-cover"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm text-slate-900">{item.name}</span>
                          {item.sku && <span className="block text-xs text-slate-500">{item.sku}</span>}
                        </span>
                        {item.names_year && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            this year
                          </span>
                        )}
                        <span
                          className={
                            'ml-auto shrink-0 text-sm tabular-nums ' +
                            (item.in_stock ? 'font-semibold text-slate-900' : 'text-slate-400')
                          }
                        >
                          {item.in_stock ? item.total_available : 'none'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/*
                An empty library and an uncovered vehicle look identical
                on screen unless they are told apart, and they need
                completely different things done about them.
              */}
              {card.library_loaded === false ? (
                <div className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded p-4">
                  <p className="font-semibold">The key library is not loaded on this server.</p>
                  <p className="mt-1">
                    Every section below will be empty until it is, and nothing here is a
                    statement about this vehicle. Run the reference seeders against this
                    database:
                  </p>
                  <code className="mt-2 block text-[11px] font-mono bg-white/60 rounded px-2 py-1">
                    crewbarn:seed-vehicle-keys · crewbarn:seed-oem-parts ·
                    crewbarn:seed-lock-parts · crewbarn:seed-asp-locks ·
                    crewbarn:seed-lishi-guide
                  </code>
                  {card.library_database && (
                    <p className="mt-2 text-[11px]">
                      This server is reading <code className="font-mono">{card.library_database}</code>.
                      Run them against that one — not whichever database you were last in.
                    </p>
                  )}
                </div>
              ) : card.key.candidates.length === 0 ? (
                <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded p-4">
                  {card.key.nothing ?? card.key.why ?? 'Nothing in the library for this vehicle.'}
                  {' '}Route it to somebody with the vehicle details rather than guessing a blank.
                </div>
              ) : null}

              {/*
                Offered whether or not the book had anything. The
                vehicle nobody has a page for is the one most worth
                writing down, and that is exactly where the card used
                to end.
              */}
              {mayCorrect && (
                <AddEntry
                  make={make}
                  model={model}
                  year={year ?? null}
                  onSaved={refresh}
                />
              )}

              {/*
                Two answers to one question, and only one of them is
                this vehicle. Stacked, somebody reads the wrong one;
                as tabs it is a choice, and the question that settles
                it sits right underneath.
              */}
              {card.key.candidates.length > 1 && (
                <div className="border-b border-slate-200">
                  <div className="-mb-px flex flex-wrap gap-1">
                    {card.key.candidates.map((candidate, i) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setTab(i)}
                        className={
                          'border-b-2 px-3 py-1.5 text-sm font-medium ' +
                          (tab === i
                            ? 'border-sky-600 text-sky-700'
                            : 'border-transparent text-slate-500 hover:text-slate-800')
                        }
                      >
                        {candidate.key_type || candidate.model || `Option ${i + 1}`}
                        {candidate.added_by_shop && ' ·'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {card.key.decider && card.key.candidates.length > 1 && (
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">More than one fits. </span>
                  {card.key.decider}
                </p>
              )}

              {card.key.candidates.filter((_, i) => card.key.candidates.length === 1 || i === tab).map((candidate) => (
                <div key={candidate.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {candidate.model ?? candidate.make}
                    </span>
                    {/* Never let something somebody typed read as printed. */}
                    {candidate.added_by_shop && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800">
                        {candidate.scope === 'platform' ? 'added, platform-wide' : 'added by us'}
                        {candidate.status === 'proposed' && ' · in review'}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">{candidate.years}</span>
                  </div>

                  {/* The route is the answer. Everything else is detail. */}
                  {candidate.routes?.options.map((option) => (
                    <div
                      key={option.route}
                      className={`rounded border px-3 py-2 mb-2 text-sm ${
                        ROUTE_TONE[option.route] ?? 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="font-semibold">{option.label}</div>
                      <div className="text-[12px] mt-0.5">{option.needs}</div>
                      {option.warn && (
                        <div className="text-[12px] mt-1 font-medium">⚠ {option.warn}</div>
                      )}
                      {option.procedure_known === false && (
                        <div className="text-[11px] mt-1 italic opacity-80">
                          The book gives the letter but not the steps. Confirm the procedure
                          before promising an on-site fix.
                        </div>
                      )}
                      {option.from_catalogue === false && (
                        <div className="text-[11px] mt-1 italic opacity-80">
                          No tool named in the book for this one — any scan tool that covers
                          the vehicle should do it.
                        </div>
                      )}
                    </div>
                  ))}

                  {/*
                    Any photo the shop has of a part this option names.
                    Recognising the blank by sight is faster than
                    reading the number off the card and comparing.
                  */}
                  {(() => {
                    const numbers = [candidate.blank, candidate.blank_transponder, candidate.oem_part]
                      .filter(Boolean)
                      .map((n) => String(n).toLowerCase())
                    const shot = (card.stock ?? []).find(
                      (s) => s.image && numbers.some((n) => (s.sku ?? '').toLowerCase() === n),
                    )
                    return shot ? (
                      <img
                        src={shot.image!}
                        alt={shot.name}
                        loading="lazy"
                        className="float-right ml-3 mb-2 h-24 w-24 rounded border border-slate-200 object-cover"
                      />
                    ) : null
                  })()}

                  <div className="divide-y divide-slate-100">
                    {['blank', 'blank_transponder', 'key_type', 'transponder', 'chip',
                      'code_series', 'lock_apps', 'onboard_code', 'service_key', 'oem_part',
                      'cloneable', 'programming_tools', 'cloning_tools', 'lishi',
                      'notes'].map((field) => {
                      const value = (candidate as Record<string, unknown>)[field]
                      if ((value === null || value === undefined || value === '') && !candidate.corrected?.[field]) {
                        return null
                      }
                      return (
                        <Field
                          key={field}
                          subject={candidate.subject}
                          subjectId={candidate.id}
                          field={field}
                          // This shop's name for the row, when it gave it one.
                          label={candidate.row_labels?.[field]}
                          value={value}
                          correction={candidate.corrected?.[field]}
                          editable={editableFor(candidate.subject).includes(field)}
                          onSaved={refresh}
                        />
                      )
                    })}

                    {/*
                      Rows this shop wrote, under the book's. Kept visibly
                      separate: what a catalogue prints and what a shop
                      worked out are different kinds of fact, and the card
                      has said which is which since it was built.
                    */}
                    {(candidate.custom_rows ?? []).map((row) => (
                      <div key={row.field} className="flex items-baseline gap-2 py-1">
                        <span className="min-w-[7.5rem] text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                          {row.label}
                        </span>
                        <span className="flex-1 font-mono text-sm text-slate-900">{row.value}</span>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-sky-600">
                          yours
                        </span>
                      </div>
                    ))}
                  </div>

                  {(candidate.lishi?.length ?? 0) > 0 && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Lishi matches are suggested from the keyway — verify on the lock.
                    </p>
                  )}
                </div>
              ))}

              {card.lishi_guide && (
                <LishiGuideSection
                  guide={card.lishi_guide}
                  make={make}
                  libraryPicks={[
                    ...new Set(card.key.candidates.flatMap((c) => c.lishi ?? [])),
                  ]}
                />
              )}

              <Section
                title="Who to send"
                count={card.recommended_tech ? 1 : 0}
                empty="Nobody on the books is carrying the tools or the parts for this one."
              >
                {card.recommended_tech && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                    <div className="text-sm font-semibold text-emerald-900">
                      {card.recommended_tech.tech}
                      {!card.recommended_tech.complete && (
                        <span className="ml-2 text-[11px] font-normal text-emerald-800">
                          — not everything, but the closest
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-emerald-800">{card.recommended_tech.why}</div>
                    <div className="text-[11px] text-emerald-700 mt-1 italic">
                      A suggestion from tools and stock only — it does not know who is closest
                      or already out.
                    </div>
                  </div>
                )}
              </Section>

              <Section
                title="Tools"
                count={card.tools.length}
                empty="The book names no tool for this vehicle."
              >
                {/*
                  Whose list this is. The book names its own publisher's
                  tools and says nothing about the rest -- Autel and
                  Xhorse do most of these cars -- so a tool missing from
                  here is not a tool that cannot do the job.
                */}
                <p className="text-[11px] text-slate-500 mb-1.5">
                  What the book names. Other programmers — Autel, Xhorse and the rest —
                  cover many of these too; check your tool's own coverage. Edit the
                  tool fields above to record what actually works.
                </p>
                <ul className="space-y-1">
                  {card.tools.map((tool) => (
                    <li key={tool.name} className="text-sm flex items-baseline gap-2">
                      <span className="font-medium text-slate-800">{tool.name}</span>
                      {tool.held_by.length > 0 ? (
                        <span className="text-[12px] text-slate-600">
                          {tool.held_by.map((h) => h.tech).join(', ')}
                        </span>
                      ) : tool.in_shop ? (
                        <span className="text-[12px] text-slate-600">in the shop</span>
                      ) : (
                        <span className="text-[12px] text-red-700">nobody has one</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>

              <Section
                title="Fob and remote numbers"
                count={card.oem_parts.length}
                empty="No OEM fob or remote numbers on file for this vehicle."
              >
                {/*
                  The book spells some models differently -- "F-150"
                  against "F-150 Lightning". When nothing matched the
                  model, this is everything for the make and year, and
                  it has to say so rather than look like an answer.
                */}
                {card.parts_matched_on?.oem === 'make' && card.oem_parts.length > 0 && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
                    Nothing matched that model name, so this is every fob the book has for this
                    make and year. Check the model column before ordering.
                  </p>
                )}
                <div className="space-y-2">
                  {card.oem_parts.map((part) => (
                    <div key={part.id} className="border border-slate-200 rounded p-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          {part.description || part.kind.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {part.model} {part.years}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100 mt-1">
                        {['oem_parts', 'fcc_ids', 'supplier_part', 'non_remote_chipped',
                          'service_key_blanks'].map((field) => {
                          const value = (part as unknown as Record<string, unknown>)[field]
                          const empty = value === null || value === undefined || value === ''
                            || (Array.isArray(value) && value.length === 0)
                          if (empty && !part.corrected?.[field]) return null
                          return (
                            <Field
                              key={field}
                              subject={part.subject}
                              subjectId={part.id}
                              field={field}
                              value={value}
                              correction={part.corrected?.[field]}
                              editable={editableFor(part.subject).includes(field)}
                              onSaved={refresh}
                            />
                          )
                        })}
                      </div>
                      {part.non_remote_chipped.length > 0 && (
                        <p className="text-[11px] text-slate-500 mt-1.5">
                          A chipped key starts it without the buttons — the cheaper answer when
                          the fob price lands badly.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Lock parts"
                count={card.lock_parts.length}
                empty="No ignition, cylinder or pinning kit numbers on file for this vehicle."
              >
                {card.parts_matched_on?.lock === 'make' && card.lock_parts.length > 0 && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
                    Nothing matched that model name, so this is every part the book has for this
                    make and year. Check the model column before ordering.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-x-4">
                  {card.lock_parts.map((part) => (
                    <div key={part.id} className="flex items-baseline gap-2 py-0.5 text-sm">
                      <span className="text-[11px] text-slate-500 min-w-[7rem]">
                        {part.component}
                      </span>
                      <span className="font-mono text-slate-900">{part.part}</span>
                      {part.is_range && (
                        <span className="text-[10px] text-slate-400">a set, as printed</span>
                      )}
                      {part.see_note && (
                        <span className="text-[10px] text-amber-700">see the page</span>
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Cylinders, handles and switches"
                count={card.cylinders?.length ?? 0}
                empty={
                  card.cylinders_predate_vehicle
                    ? 'The lock catalogue was printed before this vehicle was built, so it has nothing to say about it.'
                    : 'The lock catalogue has nothing for this vehicle.'
                }
              >
                <div className="space-y-1.5">
                  {(card.cylinders ?? []).map((cyl, i) => (
                    <div key={i} className="border border-slate-200 rounded px-2.5 py-2">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                          {cyl.category.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {cyl.model} {cyl.years}
                        </span>
                        {cyl.parts.map((part) => (
                          <span key={part} className="font-mono text-sm text-slate-900">{part}</span>
                        ))}

                        {/*
                          The keyway, and the kit that holds its
                          tumblers. A shop buys the kit once and uses
                          it for years, so it belongs beside the part
                          rather than in a note.
                        */}
                        {cyl.profile && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700">
                            keyway {cyl.profile}
                          </span>
                        )}
                        {cyl.keying_kits.map((kit) => (
                          <span
                            key={kit}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800"
                          >
                            keying kit {kit}
                          </span>
                        ))}

                        {/*
                          The rows with no part number are the point as
                          much as the ones with it. Whether the dealer
                          has it decides whether the job can be taken.
                        */}
                        {cyl.dealer_only && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-800">
                            dealer only
                          </span>
                        )}
                        {cyl.other_supplier && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800">
                            from {cyl.other_supplier}
                          </span>
                        )}
                        {cyl.discontinued && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                            discontinued
                          </span>
                        )}
                        {cyl.parts_not_available && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700">
                            not available
                          </span>
                        )}
                        {cyl.no_cylinder && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700">
                            no cylinder
                          </span>
                        )}
                      </div>
                      {cyl.detail && (
                        <p className="text-[11px] text-slate-600 mt-1">{cyl.detail}</p>
                      )}
                    </div>
                  ))}
                </div>
                {(card.cylinders ?? []).some((c) => c.catalog_year) && (
                  <p className="text-[11px] text-slate-400 mt-2">
                    Some of these come from the {(card.cylinders ?? []).find((c) => c.catalog_year)?.catalog_year}{' '}
                    catalogue, which is authoritative for vehicles of its era and silent about
                    anything newer. The rest are from the supplier's current pages.
                  </p>
                )}
              </Section>

              <Section
                title="On the shelf"
                count={card.stock.length}
                empty="None of these part numbers match anything in inventory."
              >
                <ul className="space-y-1.5">
                  {card.stock.map((item) => (
                    <li key={item.catalog_item_id} className="text-sm">
                      <div className="flex items-baseline gap-2">
                        {item.image && (
                          <img
                            src={item.image}
                            alt=""
                            loading="lazy"
                            className="h-8 w-8 shrink-0 self-center rounded border border-slate-200 object-cover"
                          />
                        )}
                        <span className={item.in_stock ? 'text-slate-900' : 'text-slate-400'}>
                          {item.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">{item.sku}</span>
                        <span
                          className={
                            'text-[11px] ' + (item.in_stock ? 'text-emerald-700' : 'text-red-700')
                          }
                        >
                          {item.in_stock ? `${item.total_available} available` : 'none'}
                        </span>
                      </div>
                      {/*
                        Every location, zeros included. A van that is
                        out is the thing dispatch needs to see, and
                        hiding it makes "nobody has any" look the same
                        as "the shop has two".
                      */}
                      {item.locations.map((loc, i) => (
                        <div
                          key={i}
                          className={
                            'text-[11px] ml-3 flex items-baseline gap-1.5 ' +
                            (loc.qty_available > 0 ? 'text-slate-600' : 'text-slate-400')
                          }
                        >
                          <span
                            className={
                              'font-mono tabular-nums ' +
                              (loc.qty_available > 0 ? 'text-slate-900' : 'text-slate-400')
                            }
                          >
                            {loc.qty_available}
                          </span>
                          <span>{loc.location ?? 'unknown location'}</span>
                          {loc.bin && <span>· {loc.bin}</span>}
                          {loc.tech && <span>· {loc.tech}</span>}
                          {loc.qty_available === 0 && <span className="italic">none here</span>}
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </Section>

            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * A vehicle the page already knows, as a link to its key reference.
 *
 * Where a screen holds the year, make and model as separate fields —
 * an intake draft, an asset record — this links from those directly
 * rather than re-reading them out of a sentence. The detector exists
 * for prose; it should not be asked to re-derive what is already
 * structured, because it can only be less certain than the fields it
 * would be parsing.
 *
 * Renders nothing when there is no make. A link to a lookup that
 * cannot run is worse than plain text.
 */
export function VehicleKeyLink({
  make,
  model,
  year,
  label,
  className,
}: {
  make?: string | null
  model?: string | null
  year?: number | string | null
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const text = label ?? [year, make, model].filter(Boolean).join(' ')

  if (!make || !text) {
    return <>{text || null}</>
  }

  const parsedYear = year ? Number(String(year).slice(0, 4)) : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'text-sky-700 underline decoration-dotted underline-offset-2 hover:decoration-solid text-left'
        }
        title="Keys, parts and tools for this vehicle"
      >
        {text}
      </button>
      {open && (
        <VehicleKeyOverlay
          make={make}
          model={model ?? null}
          year={Number.isFinite(parsedYear) ? parsedYear : null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
