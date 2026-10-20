import { asPicture } from '@/lib/rasterizeIfSvg'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { apiRequest } from '@/lib/api'
import { createAsset } from '@/lib/assets'
import { uploadAssetPhoto } from '@/lib/assetPhotos'
import { usePermissions } from '@/hooks/usePermissions'
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad'
import {
  DEFAULT_PRICING, DEFAULT_TERM, EXTRA_WORDS, MONTHS, PERIOD_WORDS,
  coverageFromPayload, coveragePayload, coverageProblems, coverageSections, rhythmFromCadence,
  type CoveragePayload, type CoverageRow, type CoverageState, type GeneratedKey, type OnSign, type Pricing, type Rhythm, type Term,
} from '@/components/agreements/coverageTable'
import {
  REWRITE_STYLES, agreementAiStatus, draftAgreement, rewriteSection, saveCoveragePatterns, summarizeAgreement,
  type AgreementAiStatus, type AiMissing, type CoveragePattern, type RewriteStyle,
} from '@/components/agreements/agreementAi'
import { AgreementDraftAssistant, AiSetupNotice, SendChecklist } from '@/components/agreements/AgreementDraftAssistant'
import { sendChecks, type CheckSection } from '@/components/agreements/sendChecks'

type Section = { key: string; label: string; required: boolean; recommended: boolean; help: string; text: string }
type Starter = { key: string; name: string; sections_version: string; sections: Section[] }
type Sources = { version: string; items: { id: string; kind: string; text: string; quantity?: string }[] }
type Revision = { id: string; revision: number; created_at: string }
type Terms = { accepted: boolean; version: string; points: string[]; reaccept_required?: boolean }
type PlanInfo = { contract_id: string; title: string; status: string; visit_booking: OnSign; suggested: number }
type Delivery = { status: string; customer_email: string | null; delivery_status: string | null; message?: string; resolution?: string | null; resolved_by?: string; resolved_at?: string; resolution_note?: string; has_signed_pdf?: boolean; plan?: PlanInfo | null }

export type AgreementSourceType = 'estimate' | 'location' | 'asset' | 'customer' | 'plan_request'
export type AgreementSourceRef = { type: AgreementSourceType; id: string }

type Equipment = {
  key: string; asset_id: string | null; request_asset_id: string | null; name: string; tag: string | null
  asset_type_id?: string | null; type_name: string | null; make_model: string | null; serial_number: string | null; location_id: string
  tasks: string[]; cadence: string | null; plans: { contract_id: string; title: string; status: string }[]; listed_by_customer?: boolean
}
type CoverageOptions = {
  source: { type: AgreementSourceType; id: string; label: string }
  customer: { id: string; name: string | null; email?: string | null }
  locations: { id: string; label: string; address: string | null }[]
  focus_location_ids: string[]
  equipment: Equipment[]
  ticked: string[]
  offered: string[]
  default_rhythm: Rhythm | null
  asset_types: { id: string; name: string }[]
  /** The company's usual coverage per equipment type id. */
  patterns?: Record<string, CoveragePattern>
}

/**
 * Everything the builder knows, as one object. This is what the stage-2
 * "Draft it for me" endpoint receives: the source, the customer and
 * properties, the covered equipment with its coverage table, the chosen
 * template, and the current wording of each section.
 */
export interface AgreementBuilderState {
  source: AgreementSourceRef
  customer: { id: string; name: string | null } | null
  locations: { id: string; label: string; address: string | null }[]
  template: { key: string; name: string; sections_version: string } | null
  sections: { key: string; label: string; help: string; included: boolean; text: string }[]
  coverage: CoveragePayload | null
  estimate_source_ids: string[]
}

/** What a "Draft it for me" tool gets to work with (stage 2). */
export interface AgreementDraftToolsContext {
  state: AgreementBuilderState
  /** The one place section wording is set. */
  setSectionText: (key: string, text: string) => void
  busy: boolean
}

const button = 'rounded border px-3 py-2 text-sm disabled:opacity-50'
const input = 'rounded border p-2 text-sm'
const STEPS = ['1. Template & equipment', '2. Coverage & price', '3. Wording', '4. Read & save']
const GENERATED: GeneratedKey[] = ['covered', 'visits', 'payment', 'term']
const NO_EXTRAS = { parts: false, after_hours: false, emergency: false }

export function AgreementBuilderModal({ estimateId, source: sourceProp, onClose, canSaveTemplates = false, renderDraftTools }: {
  /** Kept for existing callers; same as source={{ type: 'estimate', id }}. */
  estimateId?: string
  source?: AgreementSourceRef
  onClose: () => void
  canSaveTemplates?: boolean
  /** Stage 2: renders in the toolbar above the sections (e.g. "Draft it for me"). */
  renderDraftTools?: (ctx: AgreementDraftToolsContext) => ReactNode
}) {
  const source: AgreementSourceRef = sourceProp ?? { type: 'estimate', id: estimateId ?? '' }
  const isEstimate = source.type === 'estimate'
  const base = isEstimate
    ? `/v1/estimates/${encodeURIComponent(source.id)}`
    : `/v1/agreement-builder/${source.type}/${encodeURIComponent(source.id)}`
  const optionsUrl = `/v1/agreement-builder/${source.type}/${encodeURIComponent(source.id)}/coverage-options`
  const { has } = usePermissions()
  const canAddEquipment = has('assets.edit')

  const [starters, setStarters] = useState<Starter[]>([])
  const [sources, setSources] = useState<Sources>({ version: '', items: [] })
  const [terms, setTerms] = useState<Terms | null>(null)
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [starter, setStarter] = useState<Starter | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [sourceIds, setSourceIds] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const [body, setBody] = useState('')
  const [viewingSaved, setViewingSaved] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  // Typed, like the other agreement pages: a box gets clicked past unread.
  const [typedAck, setTypedAck] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [savedHasCoverage, setSavedHasCoverage] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [sendOpen, setSendOpen] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [expiryDays, setExpiryDays] = useState(30)
  const [sendConfirmed, setSendConfirmed] = useState(false)
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [recoveryAction, setRecoveryAction] = useState('received')
  const signaturePad = useRef<SignaturePadHandle>(null)
  const [vendorName, setVendorName] = useState('')
  const [vendorConfirmed, setVendorConfirmed] = useState(false)
  const [recoveryNote, setRecoveryNote] = useState('')
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false)
  const sendRequestRef = useRef<{ payload: string; id: string } | null>(null)
  useEffect(() => { setSendOpen(false); setSendConfirmed(false); setDelivery(null); setRecipient(''); setSavedDraft(null); setRecoveryNote(''); setRecoveryConfirmed(false); setRecoveryAction('received'); setVendorName(''); setVendorConfirmed(false) }, [savedId, viewingSaved])
  const requestRef = useRef<{ payload: string; id: string } | null>(null)

  // ---- Equipment and the coverage table ----
  const [options, setOptions] = useState<CoverageOptions | null>(null)
  const [places, setPlaces] = useState<string[]>([])
  const [ticked, setTicked] = useState<string[]>([])
  const [rowEdits, setRowEdits] = useState<Record<string, CoverageRow>>({})
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING)
  const [term, setTerm] = useState<Term>(DEFAULT_TERM)
  const [onSign, setOnSign] = useState<OnSign>('suggest')
  const [quickAdd, setQuickAdd] = useState(false)
  // The wording last written from the table, so a later refresh only
  // replaces text the person has not changed by hand.
  const generatedRef = useRef<Partial<Record<GeneratedKey, string>>>({})

  // ---- AI help (the shop's own CBI AI key) and the pre-send list ----
  const [ai, setAi] = useState<AgreementAiStatus | null>(null)
  const [aiNotes, setAiNotes] = useState('')
  const [aiWorking, setAiWorking] = useState<string | null>(null)
  const [aiMissing, setAiMissing] = useState<AiMissing[]>([])
  // The wording before the last AI change, per section (one step of undo).
  const [aiUndo, setAiUndo] = useState<Record<string, string>>({})
  // The wording AI last wrote, so it doesn't count as "edited by hand".
  const aiTextRef = useRef<Record<string, string>>({})
  const [summary, setSummary] = useState('')
  const [summaryStale, setSummaryStale] = useState(false)
  const [savedDraft, setSavedDraft] = useState<{ sections: CheckSection[]; coverage: CoveragePayload | null } | null>(null)
  useEffect(() => { let live = true; agreementAiStatus().then(s => { if (live) setAi(s) }); return () => { live = false } }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiRequest<{ data: Starter[] }>('/v1/legal/agreement-starters'),
      apiRequest<{ data: Sources }>(`${base}/agreement-sources`),
      apiRequest<{ data: Revision[] }>(`${base}/agreements`),
      apiRequest<{ data: Terms }>('/v1/legal/contract-terms'),
      apiRequest<{ data: CoverageOptions }>(optionsUrl),
    ]).then(([catalog, source, history, legal, coverage]) => {
      if (cancelled) return
      setStarters(catalog.data); setSources(source.data); setRevisions(history.data)
      // Wording changed since it was acknowledged → read it again, same as the settings page.
      setTerms(legal.data.reaccept_required ? { ...legal.data, accepted: false } : legal.data)
      setOptions(coverage.data)
      setTicked(coverage.data.ticked)
      const start = new Set(coverage.data.focus_location_ids)
      coverage.data.equipment.filter((e) => coverage.data.ticked.includes(e.key)).forEach((e) => start.add(e.location_id))
      setPlaces([...start])
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the builder. Close and try again.') })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [base, optionsUrl])

  const equipment = useMemo(() => options?.equipment ?? [], [options])
  const placeName = (id: string) => options?.locations.find((l) => l.id === id)?.label ?? 'the property'
  const rows: CoverageRow[] = useMemo(() => ticked
    .map((key): CoverageRow | null => {
      if (rowEdits[key]) return rowEdits[key]
      const e = equipment.find((item) => item.key === key)
      // The company's saved coverage for this type of equipment comes first.
      const pattern = e?.asset_type_id ? options?.patterns?.[e.asset_type_id] : undefined
      return e ? {
        key: e.key, asset_id: e.asset_id, request_asset_id: e.request_asset_id, name: e.name, location_id: e.location_id,
        tasks: pattern?.tasks || e.tasks.join('\n'), rhythm: pattern?.rhythm ?? rhythmFromCadence(e.cadence, options?.default_rhythm),
        included: pattern?.included ?? NO_EXTRAS, extras_note: '', price: '',
      } : null
    })
    .filter((row): row is CoverageRow => row !== null), [ticked, rowEdits, equipment, options])
  const coverageState: CoverageState = { rows, pricing, term, on_sign: onSign }
  const coverage = coveragePayload(coverageState)
  const problems = coverageProblems(coverageState)

  function close() {
    if (!busy && (!dirty || window.confirm('Discard unsaved agreement changes?'))) onClose()
  }
  function change() { setDirty(true); setBody(''); setMessage(''); setViewingSaved(false) }

  /** The one place a section's wording is set (typing, the table, or a drafting tool). */
  function setSectionText(key: string, text: string) {
    setValues(old => ({ ...old, [key]: text }))
    if (text.trim()) setSelected(old => old.includes(key) ? old : [...old, key])
    change()
  }

  function choose(key: string) {
    if (dirty && !window.confirm('Changing templates clears the current term wording. Continue?')) return
    const next = starters.find(s => s.key === key) ?? null
    setTemplateName(next?.key.startsWith('tenant:') ? next.name : '')
    setStarter(next); setSelected(next?.sections.filter(s => s.required || s.recommended).map(s => s.key) ?? [])
    setValues(Object.fromEntries(next?.sections.map(s => [s.key, s.text]) ?? []))
    generatedRef.current = {}; aiTextRef.current = {}; setAiUndo({}); setAiMissing([])
    change()
  }
  function editRow(key: string, patch: Partial<CoverageRow>) {
    const current = rows.find((row) => row.key === key)
    if (!current) return
    setRowEdits(old => ({ ...old, [key]: { ...current, ...patch } })); change()
  }
  function tick(key: string, on: boolean) {
    setTicked(old => on ? (old.includes(key) ? old : [...old, key]) : old.filter(k => k !== key)); change()
  }
  function togglePlace(id: string, on: boolean) {
    setPlaces(old => on ? [...old, id] : old.filter(p => p !== id))
    const here = equipment.filter(e => e.location_id === id).map(e => e.key)
    setTicked(old => on ? [...new Set([...old, ...here])] : old.filter(k => !here.includes(k))); change()
  }

  /**
   * Write "What is covered", "Visit schedule", "Price and payment" and
   * "Agreement term" from the table. Wording someone changed by hand is
   * kept unless `force` (the rewrite button) says otherwise.
   */
  function writeFromTable(force: boolean): number {
    if (!starter || !rows.length) return 0
    const text = coverageSections(coverageState, placeName)
    let kept = 0
    for (const key of GENERATED) {
      if (!starter.sections.some(s => s.key === key)) continue
      const current = values[key] ?? ''
      const original = starter.sections.find(s => s.key === key)?.text ?? ''
      const untouched = !current.trim() || current === original || current === generatedRef.current[key]
      if (force || untouched) {
        generatedRef.current[key] = text[key]
        setSectionText(key, text[key])
      } else kept++
    }
    return kept
  }

  /** The builder's whole state as one object (stage 2 sends this to the drafting endpoint). */
  const builderState: AgreementBuilderState = {
    source,
    customer: options?.customer ?? null,
    locations: (options?.locations ?? []).filter(l => places.includes(l.id) || rows.some(r => r.location_id === l.id)),
    template: starter ? { key: starter.key, name: starter.name, sections_version: starter.sections_version } : null,
    sections: (starter?.sections ?? []).map(s => ({ key: s.key, label: s.label, help: s.help, included: selected.includes(s.key), text: values[s.key] ?? '' })),
    coverage,
    estimate_source_ids: sourceIds,
  }

  const payload = { starter_key: starter?.key, sections_version: starter?.sections_version, selected, values,
    ...(coverage ? { coverage } : {}),
    ...(summary.trim() ? { summary: summary.trim() } : {}),
    ...(sourceIds.length ? { source_ids: sourceIds, source_version: sources.version } : {}) }
  const builderChecks = sendChecks(builderState.sections, coverage, recipient.trim() || options?.customer.email)
  const savedChecks = savedDraft ? sendChecks(savedDraft.sections, savedDraft.coverage, recipient) : []

  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Request failed. Your edits are still here.') }
    finally { setBusy(false) }
  }
  async function preview() {
    await run(async () => {
      const result = await apiRequest<{ data: { body: string } }>(`${base}/agreement-preview`, { method: 'POST', body: payload })
      setBody(result.data.body); setViewingSaved(false); setStep(3); setSummaryStale(false)
    })
  }

  // ---- AI help ----
  /** Changed by hand: not empty, not the template's words, not the table's, not AI's last words. */
  function handEdited(key: string): boolean {
    const current = (values[key] ?? '').trim()
    if (!current) return false
    const original = (starter?.sections.find(s => s.key === key)?.text ?? '').trim()
    return current !== original && current !== (generatedRef.current[key as GeneratedKey] ?? '').trim() && current !== (aiTextRef.current[key] ?? '').trim()
  }
  function applyAi(key: string, text: string) {
    setAiUndo(old => ({ ...old, [key]: values[key] ?? '' }))
    aiTextRef.current[key] = text
    setSectionText(key, text)
  }
  async function draftForMe() {
    setAiWorking('draft')
    await run(async () => {
      const result = await draftAgreement(builderState, aiNotes)
      const keys = Object.keys(result.sections)
      const edited = keys.filter(handEdited)
      const apply = edited.length && !window.confirm(`Replace your wording in ${edited.length} ${edited.length === 1 ? 'section' : 'sections'}?`)
        ? keys.filter(k => !edited.includes(k)) : keys
      apply.forEach(k => applyAi(k, result.sections[k]))
      setAiMissing(result.missing)
      const kept = keys.length - apply.length
      setMessage(apply.length
        ? `Drafted ${apply.length} ${apply.length === 1 ? 'section' : 'sections'}${kept ? `, and kept your own wording in ${kept}` : ''}. Read them over and change anything that isn't right.`
        : kept ? 'Your own wording was kept. Nothing was replaced.' : 'Nothing new to draft: every included section is already written.')
    })
    setAiWorking(null)
  }
  async function rewrite(key: string, style: RewriteStyle) {
    const text = values[key] ?? ''
    if (!text.trim()) return
    setAiWorking(`${style}:${key}`)
    await run(async () => {
      applyAi(key, await rewriteSection(builderState, key, text, style, aiNotes))
      setMessage(`${starter?.sections.find(s => s.key === key)?.label ?? 'That section'} was reworded. Undo puts your last version back.`)
    })
    setAiWorking(null)
  }
  function undoAi(key: string) {
    const previous = aiUndo[key]
    if (previous === undefined) return
    setSectionText(key, previous)
    setAiUndo(old => { const next = { ...old }; delete next[key]; return next })
  }
  async function writeSummary() {
    setAiWorking('summary')
    await run(async () => {
      const text = await summarizeAgreement(builderState)
      setSummary(text)
      const result = await apiRequest<{ data: { body: string } }>(`${base}/agreement-preview`, { method: 'POST', body: { ...payload, summary: text } })
      setBody(result.data.body); setViewingSaved(false); setSummaryStale(false); setDirty(true)
    })
    setAiWorking(null)
  }

  /** Take someone to where a checklist or "still needed" item is fixed. */
  function jumpTo(key: string) {
    let target = 2
    let selector = ''
    if (key.startsWith('section:')) {
      const section = key.slice(8)
      selector = `#agreement-section-${section}`
      if (starter?.sections.some(s => s.key === section) && !selected.includes(section)) setSelected(old => [...old, section])
    } else if (key.startsWith('item:')) { target = 1; selector = `[data-coverage-index="${key.slice(5)}"]` }
    else if (key === 'price') { target = 1; selector = '[data-tour="agreement-pricing"]' }
    else if (key === 'term') { target = 1; selector = '[data-tour="agreement-term"]' }
    else if (key === 'visits' || key === 'items') { target = 1; selector = '[data-tour="agreement-coverage-row"]' }
    else if (key === 'email') {
      if (sendOpen) { document.getElementById('agreement-recipient')?.focus(); return }
      setMessage('Add the customer\'s email address when you send it, or save one on the customer.'); return
    } else return
    if (viewingSaved) { setBody(''); setViewingSaved(false) }
    setStep(target)
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(selector)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus?.()
    }, 80)
  }
  async function save() {
    const savePayload = { ...payload, base_revision: revisions[0]?.revision ?? 0 }
    const fingerprint = JSON.stringify(savePayload)
    if (requestRef.current?.payload !== fingerprint) requestRef.current = { payload: fingerprint, id: crypto.randomUUID() }
    const requestId = requestRef.current.id
    await run(async () => {
      const result = await apiRequest<{ data: Revision & { body: string; coverage?: CoveragePayload | null } }>(`${base}/agreements`, {
        method: 'POST', body: { ...savePayload, request_id: requestId },
      })
      setRevisions(old => [result.data, ...old.filter(r => r.id !== result.data.id)])
      setBody(result.data.body); setViewingSaved(true); setDirty(false)
      setSavedId(result.data.id); setSavedHasCoverage(!!result.data.coverage)
      setMessage(`Revision ${result.data.revision} saved to ${options?.source.label ?? 'this record'}. Nothing was sent or started yet.`)
    })
  }
  function continueToWording() {
    if (problems.length) { setError(problems[0]); return }
    const kept = writeFromTable(false)
    if (viewingSaved) setBody('')
    setViewingSaved(false); setStep(2)
    if (kept) setMessage('Some sections you changed by hand were kept. Use "Rewrite from the coverage table" to replace them.')
  }

  const offered = new Set(options?.offered ?? [])
  const shown = equipment.filter(e => places.includes(e.location_id) || ticked.includes(e.key))
  const mainList = shown.filter(e => !offered.has(e.key) || ticked.includes(e.key))
  const alsoList = shown.filter(e => offered.has(e.key) && !ticked.includes(e.key))
  const signedWords = savedHasCoverage || coverage
    ? 'When it is signed, the service plan starts from the coverage table and its visits are booked or suggested as you chose.'
    : `It does not ${isEstimate ? 'accept the estimate, ' : ''}book work, or start billing.`

  return <Modal isOpen onClose={close} title="Build service agreement" subtitle={`Draft for legal review · stays attached to ${options?.source.label ?? (isEstimate ? 'this estimate' : 'this record')}`} size="xl" disableBackdropClose disableEscapeClose={busy}>
    <Modal.Body>
      <div data-tour="agreement-builder" data-agreement-source={source.type}>
      {error && <div className="mb-4 rounded bg-red-50 p-3 text-red-800"><p role="alert">{error}</p>
        {terms?.accepted && <button className={button} disabled={busy} onClick={() => run(async () => {
          const [freshSources, history, catalog] = await Promise.all([apiRequest<{data: Sources}>(`${base}/agreement-sources`), apiRequest<{data: Revision[]}>(`${base}/agreements`), apiRequest<{data: Starter[]}>('/v1/legal/agreement-starters')])
          setSources(freshSources.data); setRevisions(history.data)
          setStarters(catalog.data)
          if (starter) {
            const current = catalog.data.find(row => row.key === starter.key)
            if (!current) throw new Error('This template is no longer available. Your wording is retained; choose another template to continue.')
            setStarter(current)
            setSelected(old => current.sections.filter(section => section.required || old.includes(section.key)).map(section => section.key))
            setValues(old => Object.fromEntries(current.sections.map(section => [section.key, old[section.key] ?? section.text])))
          }
          setSourceIds(ids => ids.filter(id => freshSources.data.items.some(row => row.id === id)))
          setBody(''); setViewingSaved(false); setStep(0)
          setMessage('Current details and revisions loaded. Your wording is kept. Check your choices and preview again before saving.')
        })}>Reload details and revisions, keep my wording</button>}
      </div>}
      {message && <p role="status" className="mb-4 rounded bg-emerald-50 p-3">{message}</p>}
      {!terms ? <p role="status">{busy ? 'Loading agreement builder…' : 'Builder could not load. Close and try again.'}</p> : !terms.accepted ? <section data-tour="agreement-ack" className="space-y-4">
        <h3 className="font-semibold">Read before preparing an agreement</h3>
        {terms.reaccept_required && <p className="font-semibold">This wording has changed since you last read it. Please read it again.</p>}
        <ul className="list-disc pl-6 space-y-2">{terms.points.map(point => <li key={point}>{point}</li>)}</ul>
        <label className="block text-sm font-semibold" htmlFor="agreement-ack">Type <span className="font-mono">I understand</span> to continue</label>
        <input id="agreement-ack" className="w-56 rounded border p-2" value={typedAck} onChange={e => setTypedAck(e.target.value)} placeholder="I understand" />
        <button className={button} disabled={typedAck.trim().toLowerCase() !== 'i understand' || busy} onClick={() => run(async () => {
          const result = await apiRequest<{ data: Terms }>('/v1/legal/contract-terms/accept', { method: 'POST', body: { confirm: true, version: terms.version } })
          setTerms(result.data)
        })}>Record this and continue</button>
      </section> : <>
        <nav aria-label="Agreement steps" data-tour="agreement-steps" className="mb-4 flex flex-wrap gap-2">{STEPS.map((label, i) =>
          <button key={label} className={button} aria-current={step === i ? 'step' : undefined} disabled={busy || (i > 0 && !starter) || (i === 3 && !body)} onClick={() => {
            if (i === 2 && step < 2) { continueToWording(); return }
            if ((i === 1 || i === 2) && viewingSaved) { setBody(''); setViewingSaved(false) }
            setStep(i)
          }}>{label}</button>)}</nav>
        <fieldset disabled={busy} className="min-w-0">
          {step === 0 && <div className="grid gap-6 md:grid-cols-2">
            <section data-tour="agreement-template" className="space-y-3"><label className="block font-semibold" htmlFor="agreement-template">Agreement template</label>
              <select id="agreement-template" className="w-full rounded border p-2" value={starter?.key ?? ''} onChange={e => choose(e.target.value)}>
                <option value="">Choose a template</option>{starters.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select><p className="text-sm text-slate-600">Trade starters include optional suggested wording. Fill in the scope, exclusions, term and price. These drafts are not lawyer-approved contracts or complete forms for your state or country.</p>
              <h3 className="font-semibold">Saved revisions</h3>
              {!revisions.length && <p>No agreement drafts saved yet.</p>}
              {revisions.map(row => <button key={row.id} className={`${button} block`} onClick={() => run(async () => {
                const result = await apiRequest<{ data: { body: string; coverage?: CoveragePayload | null } }>(`${base}/agreements/${row.id}`)
                setBody(result.data.body); setViewingSaved(true); setSavedId(row.id); setSavedHasCoverage(!!result.data.coverage); setStep(3)
              })}>Read revision {row.revision}</button>)}
              {isEstimate && <div className="space-y-3 pt-2"><h3 className="font-semibold">Include project details</h3><p className="text-sm text-slate-600">Tick only what belongs in this agreement. Prices and internal notes are left out.</p>
                {!sources.items.length && <p className="text-sm">No estimate lines or linked visit findings to add.</p>}
                {sources.items.map(row => <label key={row.id} className="flex gap-3 rounded border p-3"><input type="checkbox" checked={sourceIds.includes(row.id)} onChange={e => {
                  setSourceIds(old => e.target.checked ? [...old, row.id] : old.filter(id => id !== row.id)); change()
                }} /><span className="break-words">{row.text}{row.quantity && ` · Quantity ${row.quantity}`}<small className="block text-slate-500">{row.kind === 'estimate_line' ? 'Estimate line' : 'Linked visit finding'}</small></span></label>)}
              </div>}
            </section>
            <section data-tour="agreement-equipment" className="space-y-3">
              <h3 className="font-semibold">Equipment to cover{options?.customer.name ? ` for ${options.customer.name}` : ''}</h3>
              {options && options.locations.length > 0 && <div data-tour="agreement-properties">
                <p className="text-sm text-slate-600">{source.type === 'customer' ? 'Pick the properties first. Everything at a property is ticked when you pick it.' : 'Properties in this agreement. Add another to see its equipment.'}</p>
                <div className="mt-2 flex flex-wrap gap-2">{options.locations.map(l => <label key={l.id} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${places.includes(l.id) ? 'border-amber-500 bg-amber-50' : ''}`}>
                  <input type="checkbox" checked={places.includes(l.id)} onChange={e => togglePlace(l.id, e.target.checked)} />{l.label}</label>)}</div>
              </div>}
              {options && !options.locations.length && <p className="text-sm">This customer has no properties yet. Add one on the customer page first.</p>}
              {places.length > 0 && !mainList.length && <p className="text-sm text-slate-600">No equipment on file at {places.length === 1 ? 'this property' : 'these properties'} yet.</p>}
              <ul className="space-y-2">{mainList.map(e => <EquipmentRow key={e.key} e={e} checked={ticked.includes(e.key)} placeName={places.length > 1 ? placeName(e.location_id) : null} onChange={on => tick(e.key, on)} />)}</ul>
              {alsoList.length > 0 && <div data-tour="agreement-also-cover"><h4 className="mt-3 text-sm font-semibold">Also cover?</h4><p className="text-xs text-slate-600">Other equipment at the same property.</p>
                <ul className="mt-2 space-y-2">{alsoList.map(e => <EquipmentRow key={e.key} e={e} checked={false} placeName={null} onChange={on => tick(e.key, on)} />)}</ul></div>}
              {canAddEquipment && options && options.locations.length > 0 && (quickAdd
                ? <QuickAddEquipment options={options} defaultLocation={places[0] ?? options.locations[0].id} onCancel={() => setQuickAdd(false)} onAdded={e => {
                    setOptions(o => o ? { ...o, equipment: [...o.equipment, e] } : o)
                    setPlaces(old => old.includes(e.location_id) ? old : [...old, e.location_id])
                    setTicked(old => [...old, e.key]); setQuickAdd(false); change()
                    setMessage(`${e.name} was added to the customer's equipment and ticked.`)
                  }} />
                : <button type="button" data-tour="agreement-add-equipment" className={button} onClick={() => setQuickAdd(true)}>+ Add equipment to cover</button>)}
              <p className="text-xs text-slate-600">{ticked.length ? `${ticked.length} ticked.` : 'Nothing ticked: the agreement will not set up a service plan.'}</p>
            </section>
          </div>}

          {step === 1 && <div data-tour="agreement-coverage" className="space-y-5">
            {!rows.length ? <p className="rounded border p-4">No equipment is ticked, so there is no coverage table. Go back to tick equipment, or continue to write the agreement without a service plan.</p> : <>
              <section data-tour="agreement-pricing" tabIndex={-1} className="flex flex-wrap items-end gap-4 rounded border p-4">
                <div><span className="block text-sm font-semibold">Pricing</span>
                  <div className="mt-1 flex gap-2" role="group" aria-label="Pricing">
                    {(['per_item', 'flat'] as const).map(mode => <button key={mode} type="button" className={`${button} ${pricing.mode === mode ? 'border-amber-500 bg-amber-50 font-semibold' : ''}`} aria-pressed={pricing.mode === mode} onClick={() => { setPricing(p => ({ ...p, mode })); change() }}>{mode === 'per_item' ? 'Price each item' : 'One price for everything'}</button>)}
                  </div></div>
                <label className="text-sm font-semibold">Price is
                  <select className={`ml-2 ${input}`} value={pricing.period} onChange={e => { setPricing(p => ({ ...p, period: e.target.value as Pricing['period'] })); change() }}>
                    {(Object.keys(PERIOD_WORDS) as Pricing['period'][]).map(p => <option key={p} value={p}>{PERIOD_WORDS[p]}</option>)}
                  </select></label>
                {pricing.mode === 'flat' && <label className="text-sm font-semibold">Price for everything ($)
                  <input className={`ml-2 w-28 ${input}`} inputMode="decimal" value={pricing.flat} onChange={e => { setPricing(p => ({ ...p, flat: e.target.value })); change() }} placeholder="0.00" /></label>}
              </section>

              <div className="space-y-3">{rows.map((row, i) => <section key={row.key} className="rounded border p-4" data-tour="agreement-coverage-row" data-coverage-index={i} tabIndex={-1}>
                <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="font-semibold">{row.name}</h4><span className="text-xs text-slate-500">{placeName(row.location_id)}</span></div>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <label className="block text-sm font-semibold">What is done each visit
                    <textarea className={`mt-1 w-full ${input}`} rows={3} maxLength={4000} value={row.tasks} placeholder="One task per line" onChange={e => editRow(row.key, { tasks: e.target.value })} /></label>
                  <div className="space-y-3">
                    <RhythmPicker rhythm={row.rhythm} onChange={rhythm => editRow(row.key, { rhythm })} />
                    <div><span className="block text-sm font-semibold">Included in the price</span>
                      <div className="mt-1 flex flex-wrap gap-3">{(Object.keys(EXTRA_WORDS) as (keyof CoverageRow['included'])[]).map(k => <label key={k} className="flex items-center gap-1 text-sm">
                        <input type="checkbox" checked={row.included[k]} onChange={e => editRow(row.key, { included: { ...row.included, [k]: e.target.checked } })} />{EXTRA_WORDS[k]}</label>)}</div>
                      <input className={`mt-2 w-full ${input}`} maxLength={1000} value={row.extras_note} placeholder="Note on extras (optional)" onChange={e => editRow(row.key, { extras_note: e.target.value })} /></div>
                    {pricing.mode === 'per_item' && <label className="block text-sm font-semibold">Price ({PERIOD_WORDS[pricing.period]}, $)
                      <input className={`ml-2 w-28 ${input}`} inputMode="decimal" value={row.price} placeholder="0.00" onChange={e => editRow(row.key, { price: e.target.value })} /></label>}
                  </div>
                </div>
              </section>)}</div>

              <section data-tour="agreement-term" tabIndex={-1} className="flex flex-wrap items-end gap-4 rounded border p-4">
                <label className="text-sm font-semibold">Starts<input type="date" className={`ml-2 ${input}`} value={term.starts_on} onChange={e => { setTerm(t => ({ ...t, starts_on: e.target.value })); change() }} /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={term.until_cancelled} onChange={e => { setTerm(t => ({ ...t, until_cancelled: e.target.checked })); change() }} />Until cancelled</label>
                {!term.until_cancelled && <label className="text-sm font-semibold">Ends<input type="date" className={`ml-2 ${input}`} value={term.ends_on} onChange={e => { setTerm(t => ({ ...t, ends_on: e.target.value })); change() }} /></label>}
                <label className="text-sm font-semibold">Notice to cancel (days)<input className={`ml-2 w-20 ${input}`} inputMode="numeric" value={term.notice_days} onChange={e => { setTerm(t => ({ ...t, notice_days: e.target.value })); change() }} /></label>
                <p className="w-full text-xs text-slate-600">Leave the start empty to start on the day it is signed.</p>
              </section>

              <fieldset data-tour="agreement-on-sign" className="rounded border p-4"><legend className="px-1 text-sm font-semibold">When it's signed</legend>
                <label className="flex gap-2 text-sm"><input type="radio" name="agreement-on-sign" checked={onSign === 'book'} onChange={() => { setOnSign('book'); change() }} />
                  <span><strong>Book the visits on the schedule.</strong> The service plan starts and visits are booked as they come due.</span></label>
                <label className="mt-2 flex gap-2 text-sm"><input type="radio" name="agreement-on-sign" checked={onSign === 'suggest'} onChange={() => { setOnSign('suggest'); change() }} />
                  <span><strong>Suggest the visits for the office to confirm.</strong> The plan starts and the visits wait on its Confirm visits list.</span></label>
              </fieldset>
              {problems.length > 0 && <ul className="rounded bg-amber-50 p-3 text-sm text-amber-900">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
            </>}
          </div>}

          {step === 2 && <>
            {/* Toolbar above the sections. Stage 2's "Draft it for me" renders here (renderDraftTools). */}
            <div data-tour="agreement-draft-toolbar" className="mb-4 flex flex-wrap items-center gap-2 rounded border border-dashed p-3">
              {rows.length > 0 && <button type="button" className={button} onClick={() => { writeFromTable(true); setMessage('What is covered, the visit schedule, the price and the term were rewritten from the coverage table.') }}>Rewrite from the coverage table</button>}
              {renderDraftTools?.({ state: builderState, setSectionText, busy })}
              <span className="text-xs text-slate-600">{rows.length ? 'Covered equipment, visits, price and term are written from your coverage table. Change the words as you like.' : 'Word each section for this agreement.'}</span>
              <AgreementDraftAssistant ai={ai} notes={aiNotes} onNotes={setAiNotes} drafting={aiWorking === 'draft'} disabled={busy}
                onDraft={draftForMe} missing={aiMissing} onJump={jumpTo} onDismissMissing={() => setAiMissing([])} />
            </div>
            {canSaveTemplates && <section className="mb-4 rounded border p-4">
              <label className="block text-sm font-semibold">Reusable company template name<input className="mt-1 w-full rounded border p-2" maxLength={120} value={templateName} onChange={e => setTemplateName(e.target.value)} /></label>
              <p className="my-2 text-sm text-slate-600">Saves the term wording and which sections are ticked, not this customer's details or equipment. It also keeps what is done, how often and what is included for each type of equipment here, so the next agreement for that equipment starts filled in. Remove customer-specific wording before reusing. Saving a template is not legal approval.</p>
              <button className={button} disabled={!templateName.trim()} onClick={() => run(async () => {
                const result = await apiRequest<{data: Starter}>('/v1/legal/agreement-templates', {method: 'POST', body: {
                  starter_key: payload.starter_key, sections_version: payload.sections_version, selected, values,
                  name: templateName.trim(), base_revision: starter?.key.startsWith('tenant:') && starter.name === templateName.trim() ? Number(starter.sections_version) : 0,
                }})
                setStarters(old => [result.data, ...old.filter(row => row.key !== result.data.key)])
                setStarter(result.data); setBody(''); setViewingSaved(false)
                // Also keep this coverage for each type of equipment, so the next agreement starts with it.
                const byType = new Map<string, { asset_type_id: string } & CoveragePattern>()
                for (const row of rows) {
                  const typeId = equipment.find(e => e.key === row.key)?.asset_type_id
                  if (typeId && !byType.has(typeId)) byType.set(typeId, { asset_type_id: typeId, tasks: row.tasks, rhythm: row.rhythm, included: row.included })
                }
                let types = 0
                if (byType.size) {
                  try {
                    types = await saveCoveragePatterns([...byType.values()])
                    setOptions(o => o ? { ...o, patterns: { ...(o.patterns ?? {}), ...Object.fromEntries([...byType.values()].map(({ asset_type_id, ...p }) => [asset_type_id, p])) } } : o)
                  } catch { types = 0 }
                }
                setMessage(`Company template saved${types ? `, with the usual coverage for ${types} ${types === 1 ? 'type' : 'types'} of equipment` : ''}. Preview again before saving this agreement.`)
              })}>Save as company template</button>
            </section>}
            <div data-tour="agreement-sections" className="grid gap-4 md:grid-cols-2">{starter?.sections.map(section => <section key={section.key} className="rounded border p-4">
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={selected.includes(section.key)} disabled={section.required} onChange={e => {
                setSelected(old => e.target.checked ? [...old, section.key] : old.filter(key => key !== section.key)); change()
              }} />{section.label} {section.required ? '(required)' : section.recommended ? '(recommended)' : ''}</label>
              <p id={`help-${section.key}`} className="my-2 text-sm text-slate-600">{section.help}</p>
              {selected.includes(section.key) && ai?.ready && <div data-tour="agreement-section-ai" className="mb-2 flex flex-wrap gap-1">
                {REWRITE_STYLES.map(({ style, label }) => <button key={style} type="button" className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                  disabled={busy || !(values[section.key] ?? '').trim()} onClick={() => rewrite(section.key, style)}>
                  {aiWorking === `${style}:${section.key}` ? 'Working…' : label}</button>)}
                {aiUndo[section.key] !== undefined && <button type="button" className="rounded border border-amber-400 px-2 py-1 text-xs" disabled={busy} onClick={() => undoAi(section.key)}>Undo</button>}
              </div>}
              {selected.includes(section.key) && <textarea id={`agreement-section-${section.key}`} aria-label={section.label} aria-describedby={`help-${section.key}`} className="w-full rounded border p-2" rows={GENERATED.includes(section.key as GeneratedKey) && rows.length ? 7 : 4} maxLength={10000} value={values[section.key] ?? ''} onChange={e => setSectionText(section.key, e.target.value)} />}
            </section>)}</div>
            <div className="mt-4"><SendChecklist checks={builderChecks} onJump={jumpTo} intro="You can preview and save now. These need fixing before it goes to the customer." /></div></>}
          {step === 3 && !viewingSaved && body && <section data-tour="agreement-summary" className="mb-4 space-y-2 rounded border p-4">
            <h3 className="font-semibold">In short: what the customer is agreeing to</h3>
            <p className="text-sm text-slate-600">Three plain sentences shown above the agreement and in the signing email. Optional.</p>
            <textarea id="agreement-summary" aria-label="In short: what the customer is agreeing to" className="w-full rounded border p-2 text-sm" rows={3} maxLength={1200} value={summary}
              onChange={e => { setSummary(e.target.value); setSummaryStale(true); setDirty(true) }} placeholder="We look after your equipment on a set schedule. The price covers… It runs until…" />
            <div className="flex flex-wrap items-center gap-2">
              {ai?.ready
                ? <button type="button" className={button} disabled={busy} onClick={writeSummary}>{aiWorking === 'summary' ? 'Writing…' : summary.trim() ? 'Write it again' : 'Write it for me'}</button>
                : <AiSetupNotice ai={ai} />}
              {summaryStale && <button type="button" className={button} disabled={busy} onClick={() => preview()}>Update the preview</button>}
            </div>
          </section>}
          {step === 3 && <><p className="mb-3 text-sm">{viewingSaved ? 'Saved draft, read only.' : 'Review this draft before saving. Saving does not send, sign or start anything.'}</p>
            <iframe title="Agreement document preview" sandbox="" className="h-[55vh] w-full rounded border bg-white" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px/1.6 system-ui;padding:24px;overflow-wrap:anywhere}h2{font-size:20px}</style></head><body>${body}</body></html>`} /></>}
          {step === 3 && viewingSaved && savedId && <section className="mt-4 space-y-3 rounded border p-4">
            <button className={button} onClick={() => run(async () => {
              const [result, saved] = await Promise.all([
                apiRequest<{data: Delivery | null}>(`${base}/agreements/${savedId}/delivery`),
                apiRequest<{data: {coverage?: CoveragePayload | null; snapshot: {sections: {key: string; label: string; text: string}[]}}}>(`${base}/agreements/${savedId}`),
              ])
              setSavedDraft({ sections: saved.data.snapshot.sections.map(row => ({ ...row, included: true })), coverage: saved.data.coverage ?? null })
              if (!recipient.trim() && options?.customer.email) setRecipient(options.customer.email)
              setDelivery(result.data); setSendOpen(true); setSendConfirmed(false)
            })}>{sendOpen ? 'Refresh sending status' : 'Send for customer signature'}</button>
            {sendOpen && (delivery?.delivery_status ? <div role="status">
              <p>Agreement: {delivery.status.replaceAll('_', ' ')} · Email: {delivery.customer_email}</p>
              {delivery.plan && <p data-tour="agreement-plan-started" className="my-2 rounded bg-emerald-50 p-3 text-sm">
                Service plan started: <Link className="font-semibold underline" to={`/maintenance-contracts/${delivery.plan.contract_id}`}>{delivery.plan.title}</Link>.
                {delivery.plan.visit_booking === 'suggest'
                  ? ` ${delivery.plan.suggested} suggested ${delivery.plan.suggested === 1 ? 'visit is' : 'visits are'} waiting for you to confirm.`
                  : ' Its visits are booked as they come due.'}
              </p>}
              {delivery.status === 'customer_signed' && <section className="my-3 space-y-3 rounded border p-3">
                <h4 className="font-semibold">Your countersignature</h4>
                <p className="text-sm">Review the saved wording above. This signs this revision and keeps both signatures. {savedHasCoverage ? 'The service plan starts from the coverage table if it has not already.' : `It does not ${isEstimate ? 'accept the estimate, ' : ''}create a job or send email.`}</p>
                <label className="block">Your full name<input className="ml-2 rounded border p-2" maxLength={200} value={vendorName} onChange={e => setVendorName(e.target.value)} /></label>
                <SignaturePad key={savedId} ref={signaturePad} hint="Sign above" />
                <label className="flex gap-2"><input type="checkbox" checked={vendorConfirmed} onChange={e => setVendorConfirmed(e.target.checked)} />I reviewed this saved agreement and am allowed to sign for the company.</label>
                <button className={button} disabled={!vendorConfirmed || !vendorName.trim()} onClick={() => run(async () => {
                  const signature = signaturePad.current?.toDataUrl()
                  if (!signature) throw new Error('Draw your signature before countersigning.')
                  const result = await apiRequest<{data: Delivery}>(`${base}/agreements/${savedId}/countersign`, {
                    method: 'POST', body: { signer_name: vendorName.trim(), signature, confirm: true },
                  })
                  setDelivery(result.data); setVendorConfirmed(false)
                  setMessage(result.data.plan ? 'Agreement countersigned and the signed copy kept. The service plan is running.' : `Agreement countersigned and the signed copy kept. ${isEstimate ? 'Estimate unchanged; ' : ''}no email sent.`)
                })}>Countersign and keep the signed copy</button>
              </section>}
              {delivery.status === 'fully_signed' && delivery.has_signed_pdf && <button className={button} onClick={() => run(async () => {
                const blob = await apiRequest<Blob>(`${base}/agreements/${savedId}/signed-pdf`, { responseType: 'blob' })
                if (blob.type !== 'application/pdf') throw new Error('Signed PDF could not be downloaded.')
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a'); link.href = url; link.download = 'signed-agreement.pdf'
                document.body.appendChild(link); link.click(); link.remove()
                window.setTimeout(() => URL.revokeObjectURL(url), 60000)
              })}>Download signed agreement</button>}
              <p>{delivery.delivery_status === 'accepted' ? 'The email provider accepted the signing request. That does not confirm it reached the inbox.' : 'Sending is in progress or delivery is uncertain. Nothing will be resent automatically. Check with the recipient or the email provider before doing anything else.'}</p>
              {delivery.resolution ? <div className="mt-3 rounded border p-3">
                <p>{delivery.resolution === 'received' ? 'Staff confirmed the recipient got it.' : 'Unsigned signing link revoked. Save a new revision before sending another.'}</p>
                <p className="text-sm">Recorded by {delivery.resolved_by} · {delivery.resolved_at}</p>
                <p className="whitespace-pre-wrap">{delivery.resolution_note}</p>
              </div> : ['sent', 'customer_signed', 'fully_signed'].includes(delivery.status) && <div className="mt-3 space-y-3 rounded border p-3">
                <h4 className="font-semibold">Resolve sending status</h4>
                <p className="text-sm">This records what you checked; it never sends another email. Revoking cannot recall an email already sent, but its signing link will stop working.</p>
                <label className="block">Action
                  <select className="ml-2 rounded border p-2" value={recoveryAction} onChange={e => { setRecoveryAction(e.target.value); setRecoveryConfirmed(false) }}>
                    <option value="received">Recipient confirmed they got it</option>
                    {delivery.status === 'sent' && <option value="revoked">Revoke unsigned signing link</option>}
                  </select>
                </label>
                <label className="block">How you checked, or why
                  <textarea className="mt-1 w-full rounded border p-2" maxLength={2000} value={recoveryNote} onChange={e => { setRecoveryNote(e.target.value); setRecoveryConfirmed(false) }} />
                </label>
                <label className="flex gap-2"><input type="checkbox" checked={recoveryConfirmed} onChange={e => setRecoveryConfirmed(e.target.checked)} />
                  {recoveryAction === 'received' ? 'I checked that this recipient got this signing request.' : 'I understand the unsigned link will stop working. Nothing will be resent.'}
                </label>
                <button className={button} disabled={!recoveryConfirmed || !recoveryNote.trim()} onClick={() => run(async () => {
                  const result = await apiRequest<{data: Delivery}>(`${base}/agreements/${savedId}/delivery/resolve`, {
                    method: 'POST', body: { action: recoveryAction, note: recoveryNote.trim(), confirm: true },
                  })
                  setDelivery(result.data); setRecoveryConfirmed(false)
                  setMessage('Recorded. No email was sent.')
                })}>Record it, no email</button>
              </div>}
            </div> : <div className="space-y-3">
              <p>This emails a signing link for saved revision {revisions.find(row => row.id === savedId)?.revision}. {signedWords} The customer signs first, then you countersign.</p>
              <SendChecklist checks={savedChecks} onJump={jumpTo} intro="Fix these, then save a new revision and send that one." />
              <label className="block">Recipient email<input id="agreement-recipient" type="email" className="mt-1 w-full rounded border p-2" value={recipient} onChange={e => { setRecipient(e.target.value); setSendConfirmed(false) }} /></label>
              <label className="block">Signing link expires in days<input type="number" min={1} max={365} className="ml-3 rounded border p-2" value={expiryDays} onChange={e => { setExpiryDays(Number(e.target.value)); setSendConfirmed(false) }} /></label>
              <label className="flex gap-2"><input type="checkbox" checked={sendConfirmed} onChange={e => setSendConfirmed(e.target.checked)} />I reviewed this saved revision and recipient, completed any legal review we need, and want this email sent.</label>
              <button className={`${button} bg-amber-600 text-white`} disabled={!sendConfirmed || !recipient.trim() || !savedDraft || savedChecks.length > 0 || !Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 365} onClick={() => run(async () => {
                const payload = { customer_email: recipient.trim(), expires_in_days: expiryDays, confirm: true }
                const fingerprint = JSON.stringify([savedId, payload])
                if (sendRequestRef.current?.payload !== fingerprint) sendRequestRef.current = { payload: fingerprint, id: crypto.randomUUID() }
                const result = await apiRequest<{data: Delivery}>(`${base}/agreements/${savedId}/send`, { method: 'POST', body: { ...payload, request_id: sendRequestRef.current.id } })
                setDelivery(result.data); setSendConfirmed(false); setMessage(result.data.message ?? 'Sending status updated.')
              })}>Email signing link now</button>
            </div>)}
          </section>}
        </fieldset>
      </>}
      </div>
    </Modal.Body>
    <Modal.Footer>
      <button className={button} data-tour="agreement-close" disabled={busy} onClick={close}>Close</button>
      {terms?.accepted && step === 3 && viewingSaved && savedId && <button className={button} disabled={busy} onClick={() => run(async () => {
        const blob = await apiRequest<Blob>(`${base}/agreements/${encodeURIComponent(savedId)}/pdf`, { responseType: 'blob' })
        if (blob.type !== 'application/pdf') throw new Error('The PDF could not be downloaded. Try again.')
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url; link.download = `agreement-draft-r${revisions.find(row => row.id === savedId)?.revision ?? 'saved'}.pdf`
        document.body.appendChild(link); link.click(); link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 60000)
        setMessage('Saved revision downloaded as a draft PDF. Nothing was sent or signed.')
      })}>Download draft PDF</button>}
      {terms?.accepted && step === 0 && <button className={button} disabled={busy || !starter} onClick={() => { if (viewingSaved) setBody(''); setViewingSaved(false); setStep(1) }}>Continue to coverage</button>}
      {terms?.accepted && step === 1 && <button className={button} disabled={busy || problems.length > 0} onClick={continueToWording}>Continue to wording</button>}
      {terms?.accepted && step === 2 && <button className={button} disabled={busy} onClick={() => preview()}>Preview agreement</button>}
      {terms?.accepted && step === 3 && !viewingSaved && <button className={`${button} bg-amber-600 text-white`} disabled={busy || !body || summaryStale} title={summaryStale ? 'Update the preview first' : undefined} onClick={save}>Save draft</button>}
      {terms?.accepted && step === 3 && viewingSaved && savedId && <button className={button} disabled={busy} onClick={() => {
        if (dirty && !window.confirm('Replace your unsaved wording with this saved revision?')) return
        run(async () => {
          const result = await apiRequest<{data: {coverage?: CoveragePayload | null; summary?: string | null; snapshot: {starter_key: string; sections_version: string; sections: {key: string; text: string}[]; sources?: {id: string; text: string}[]}}}>(`${base}/agreements/${savedId}`)
          const snapshot = result.data.snapshot
          const template = starters.find(row => row.key === snapshot.starter_key && row.sections_version === snapshot.sections_version)
          if (!template) throw new Error('This template version is no longer available. The saved draft can still be read and is unchanged.')
          setStarter(template); setSelected(snapshot.sections.map(row => row.key)); setValues(Object.fromEntries(snapshot.sections.map(row => [row.key, row.text])))
          generatedRef.current = {}; aiTextRef.current = {}; setAiUndo({}); setAiMissing([])
          setSummary(result.data.summary ?? ''); setSummaryStale(false)
          const saved = result.data.coverage
          if (saved) {
            // The table comes back too, so the plan made at signing matches what was saved.
            const restored = coverageFromPayload(saved)
            const keyed: CoverageRow[] = restored.rows.map(row => ({ ...row, key: row.asset_id ? `asset:${row.asset_id}` : `request:${row.request_asset_id}` }))
            setTicked(keyed.map(row => row.key)); setRowEdits(Object.fromEntries(keyed.map(row => [row.key, row])))
            setPlaces(old => [...new Set([...old, ...keyed.map(row => row.location_id)])])
            setPricing(restored.pricing); setTerm(restored.term); setOnSign(restored.on_sign)
          }
          // Re-selection is deliberate: never silently replace historical source text with current text.
          setSourceIds([]); setBody(''); setViewingSaved(false); setDirty(true); setStep(0)
          setMessage(`Saved wording loaded for a new revision.${isEstimate ? ' Re-select the current estimate details.' : ''} The original draft stays unchanged.`)
        })
      }}>Edit as new revision</button>}
    </Modal.Footer>
  </Modal>
}

function EquipmentRow({ e, checked, placeName, onChange }: { e: Equipment; checked: boolean; placeName: string | null; onChange: (on: boolean) => void }) {
  const detail = [e.type_name, e.make_model, e.serial_number ? `Serial ${e.serial_number}` : null, placeName].filter(Boolean).join(' · ')
  return <li><label className="flex gap-3 rounded border p-3">
    <input type="checkbox" checked={checked} onChange={ev => onChange(ev.target.checked)} />
    <span className="min-w-0 break-words"><span className="font-medium">{e.name}</span>{e.tag && <span className="text-slate-500"> ({e.tag})</span>}
      {detail && <small className="block text-slate-500">{detail}</small>}
      {e.listed_by_customer && <small className="block text-slate-500">Listed by the customer. Added to their equipment when you save.</small>}
      {e.plans.length > 0 && <small className="block text-emerald-700">Already covered by {e.plans.map(p => p.title).join(', ')}</small>}
    </span></label></li>
}

function RhythmPicker({ rhythm, onChange }: { rhythm: Rhythm; onChange: (r: Rhythm) => void }) {
  return <div><span className="block text-sm font-semibold">How often</span>
    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
      <select className={input} value={rhythm.mode} aria-label="How often" onChange={e => onChange(e.target.value === 'months' ? { mode: 'months', months: [] } : { mode: 'interval', count: 3, unit: 'month' })}>
        <option value="interval">Every</option><option value="months">In set months</option>
      </select>
      {rhythm.mode === 'interval' && <>
        <input className={`w-16 ${input}`} type="number" min={1} max={52} value={rhythm.count} onChange={e => onChange({ ...rhythm, count: Number(e.target.value) })} aria-label="How many" />
        <select className={input} value={rhythm.unit} aria-label="Weeks or months" onChange={e => onChange({ ...rhythm, unit: e.target.value as 'week' | 'month' })}>
          <option value="week">weeks</option><option value="month">months</option>
        </select></>}
    </div>
    {rhythm.mode === 'months' && <div className="mt-2 flex flex-wrap gap-1">{MONTHS.map((name, i) => {
      const m = i + 1; const on = rhythm.months.includes(m)
      return <button key={name} type="button" aria-pressed={on} className={`rounded border px-2 py-1 text-xs ${on ? 'border-amber-500 bg-amber-50 font-semibold' : ''}`}
        onClick={() => onChange({ mode: 'months', months: on ? rhythm.months.filter(x => x !== m) : [...rhythm.months, m].sort((a, b) => a - b) })}>{name.slice(0, 3)}</button>
    })}</div>}
  </div>
}

/** Quick add: creates the real equipment on the customer, at the property, then ticks it. */
function QuickAddEquipment({ options, defaultLocation, onAdded, onCancel }: { options: CoverageOptions; defaultLocation: string; onAdded: (e: Equipment) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState(options.asset_types[0]?.id ?? '')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [locationId, setLocationId] = useState(defaultLocation)
  const [where, setWhere] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')
  const typeName = options.asset_types.find(t => t.id === typeId)?.name ?? null

  async function add() {
    setSaving(true); setProblem('')
    try {
      const asset = await createAsset({
        name: name.trim(), asset_type_id: typeId, customer_service_location_id: locationId,
        manufacturer: make.trim() || null, model: model.trim() || null, serial_number: serial.trim() || null,
        notes: where.trim() ? `Location: ${where.trim()}` : null,
      })
      let photoFailed = false
      if (photo) {
        try { await uploadAssetPhoto(asset.id, photo) } catch { photoFailed = true }
      }
      onAdded({ key: `asset:${asset.id}`, asset_id: asset.id, request_asset_id: null, name: asset.name, tag: null, type_name: typeName,
        make_model: [make.trim(), model.trim()].filter(Boolean).join(' ') || null, serial_number: serial.trim() || null,
        location_id: locationId, tasks: [], cadence: null, plans: [] })
      if (photoFailed) window.alert('The equipment was added, but the photo did not upload. Add it from the equipment page.')
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'The equipment could not be added.')
    } finally { setSaving(false) }
  }

  return <div data-tour="agreement-add-equipment" className="space-y-2 rounded border p-3">
    <h4 className="text-sm font-semibold">Add equipment to cover</h4>
    {!options.asset_types.length && <p className="text-sm">Set up an equipment type first, then add equipment here.</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-sm">Name<input className={`mt-1 w-full ${input}`} maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="What you call it" /></label>
      <label className="text-sm">Type<select className={`mt-1 w-full ${input}`} value={typeId} onChange={e => setTypeId(e.target.value)}>{options.asset_types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="text-sm">Make<input className={`mt-1 w-full ${input}`} maxLength={100} value={make} onChange={e => setMake(e.target.value)} /></label>
      <label className="text-sm">Model<input className={`mt-1 w-full ${input}`} maxLength={100} value={model} onChange={e => setModel(e.target.value)} /></label>
      <label className="text-sm">Serial<input className={`mt-1 w-full ${input}`} maxLength={100} value={serial} onChange={e => setSerial(e.target.value)} /></label>
      <label className="text-sm">Property<select className={`mt-1 w-full ${input}`} value={locationId} onChange={e => setLocationId(e.target.value)}>{options.locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
      <label className="text-sm">Where it is<input className={`mt-1 w-full ${input}`} maxLength={200} value={where} onChange={e => setWhere(e.target.value)} placeholder="Roof, basement, back door…" /></label>
      <label className="text-sm">Photo<input className="mt-1 block w-full text-sm" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) void asPicture(f).then(setPhoto); else setPhoto(null) }} /></label>
    </div>
    {problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}
    <div className="flex gap-2">
      <button type="button" className={`${button} bg-amber-600 text-white`} disabled={saving || !name.trim() || !typeId || !locationId} onClick={add}>{saving ? 'Adding…' : 'Add and tick it'}</button>
      <button type="button" className={button} disabled={saving} onClick={onCancel}>Cancel</button>
    </div>
  </div>
}
