import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { apiRequest } from '@/lib/api'
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad'

type Section = { key: string; label: string; required: boolean; recommended: boolean; help: string; text: string }
type Starter = { key: string; name: string; sections_version: string; sections: Section[] }
type Sources = { version: string; items: { id: string; kind: string; text: string; quantity?: string }[] }
type Revision = { id: string; revision: number; created_at: string }
type Terms = { accepted: boolean; version: string; points: string[] }
type Delivery = { status: string; customer_email: string | null; delivery_status: string | null; message?: string; resolution?: string | null; resolved_by?: string; resolved_at?: string; resolution_note?: string; has_signed_pdf?: boolean }
const button = 'rounded border px-3 py-2 text-sm disabled:opacity-50'

export function AgreementBuilderModal({ estimateId, onClose, canSaveTemplates = false }: { estimateId: string; onClose: () => void; canSaveTemplates?: boolean }) {
  const base = `/v1/estimates/${encodeURIComponent(estimateId)}`
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
  const [confirmed, setConfirmed] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
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
  useEffect(() => { setSendOpen(false); setSendConfirmed(false); setDelivery(null); setRecipient(''); setRecoveryNote(''); setRecoveryConfirmed(false); setRecoveryAction('received'); setVendorName(''); setVendorConfirmed(false) }, [savedId, viewingSaved])
  const requestRef = useRef<{ payload: string; id: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiRequest<{ data: Starter[] }>('/v1/legal/agreement-starters'),
      apiRequest<{ data: Sources }>(`${base}/agreement-sources`),
      apiRequest<{ data: Revision[] }>(`${base}/agreements`),
      apiRequest<{ data: Terms }>('/v1/legal/contract-terms'),
    ]).then(([catalog, source, history, legal]) => {
      if (cancelled) return
      setStarters(catalog.data); setSources(source.data); setRevisions(history.data); setTerms(legal.data)
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the builder. Close and try again.') })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [base])

  function close() {
    if (!busy && (!dirty || window.confirm('Discard unsaved agreement changes?'))) onClose()
  }
  function change() { setDirty(true); setBody(''); setMessage(''); setViewingSaved(false) }
  function choose(key: string) {
    if (dirty && !window.confirm('Changing templates clears the current term wording. Continue?')) return
    const next = starters.find(s => s.key === key) ?? null
    setTemplateName(next?.key.startsWith('tenant:') ? next.name : '')
    setStarter(next); setSelected(next?.sections.filter(s => s.required || s.recommended).map(s => s.key) ?? [])
    setValues(Object.fromEntries(next?.sections.map(s => [s.key, s.text]) ?? [])); change()
  }
  const payload = { starter_key: starter?.key, sections_version: starter?.sections_version, selected, values,
    ...(sourceIds.length ? { source_ids: sourceIds, source_version: sources.version } : {}) }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Request failed. Your edits are still here.') }
    finally { setBusy(false) }
  }
  async function preview() {
    await run(async () => {
      const result = await apiRequest<{ data: { body: string } }>(`${base}/agreement-preview`, { method: 'POST', body: payload })
      setBody(result.data.body); setViewingSaved(false); setStep(2)
    })
  }
  async function save() {
    const savePayload = { ...payload, base_revision: revisions[0]?.revision ?? 0 }
    const fingerprint = JSON.stringify(savePayload)
    if (requestRef.current?.payload !== fingerprint) requestRef.current = { payload: fingerprint, id: crypto.randomUUID() }
    const requestId = requestRef.current.id
    await run(async () => {
      const result = await apiRequest<{ data: Revision & { body: string } }>(`${base}/agreements`, {
        method: 'POST', body: { ...savePayload, request_id: requestId },
      })
      setRevisions(old => [result.data, ...old.filter(r => r.id !== result.data.id)])
      setBody(result.data.body); setViewingSaved(true); setDirty(false)
      setSavedId(result.data.id)
      setMessage(`Revision ${result.data.revision} saved to this estimate. Nothing was sent or activated.`)
    })
  }

  return <Modal isOpen onClose={close} title="Build service agreement" subtitle="Draft for legal review · stays attached to this estimate" size="xl" disableBackdropClose disableEscapeClose={busy}>
    <Modal.Body>
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
          setMessage('Current sources and revisions loaded. Your wording is preserved. Review the selections and preview again before saving.')
        })}>Reload sources and revisions — keep my wording</button>}
      </div>}
      {message && <p role="status" className="mb-4 rounded bg-emerald-50 p-3">{message}</p>}
      {!terms ? <p role="status">{busy ? 'Loading agreement builder…' : 'Builder could not load. Close and try again.'}</p> : !terms.accepted ? <section className="space-y-4">
        <h3 className="font-semibold">Read before preparing an agreement</h3>
        <ul className="list-disc pl-6 space-y-2">{terms.points.map(point => <li key={point}>{point}</li>)}</ul>
        <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have read and acknowledge these terms.</label>
        <button className={button} disabled={!confirmed || busy} onClick={() => run(async () => {
          const result = await apiRequest<{ data: Terms }>('/v1/legal/contract-terms/accept', { method: 'POST', body: { confirm: true, version: terms.version } })
          setTerms(result.data)
        })}>Acknowledge and continue</button>
      </section> : <>
        <nav aria-label="Agreement steps" className="mb-4 flex flex-wrap gap-2">{['1. Template & scope', '2. Coverage & terms', '3. Read & save'].map((label, i) =>
          <button key={label} className={button} aria-current={step === i ? 'step' : undefined} disabled={busy || (i > 0 && !starter) || (i === 2 && !body)} onClick={() => { if (i === 1 && viewingSaved) { setBody(''); setViewingSaved(false) }; setStep(i) }}>{label}</button>)}</nav>
        <fieldset disabled={busy} className="min-w-0">
          {step === 0 && <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-3"><label className="block font-semibold" htmlFor="agreement-template">Agreement template</label>
              <select id="agreement-template" className="w-full rounded border p-2" value={starter?.key ?? ''} onChange={e => choose(e.target.value)}>
                <option value="">Choose a template</option>{starters.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select><p className="text-sm text-slate-600">Trade starters include optional suggested wording. Fill in the scope, exclusions, term and price. These drafts are not lawyer-approved contracts or complete jurisdiction-specific forms.</p>
              <h3 className="font-semibold">Saved revisions</h3>
              {!revisions.length && <p>No agreement drafts saved yet.</p>}
              {revisions.map(row => <button key={row.id} className={`${button} block`} onClick={() => run(async () => {
                const result = await apiRequest<{ data: { body: string } }>(`${base}/agreements/${row.id}`)
                setBody(result.data.body); setViewingSaved(true); setSavedId(row.id); setStep(2)
              })}>Read revision {row.revision}</button>)}
            </section>
            <section className="space-y-3"><h3 className="font-semibold">Include project details</h3><p className="text-sm text-slate-600">Tick only what belongs in this agreement. Prices and internal notes are excluded.</p>
              {!sources.items.length && <p>No estimate lines or linked public visit findings available.</p>}
              {sources.items.map(row => <label key={row.id} className="flex gap-3 rounded border p-3"><input type="checkbox" checked={sourceIds.includes(row.id)} onChange={e => {
                setSourceIds(old => e.target.checked ? [...old, row.id] : old.filter(id => id !== row.id)); change()
              }} /><span className="break-words">{row.text}{row.quantity && ` · Quantity ${row.quantity}`}<small className="block text-slate-500">{row.kind === 'estimate_line' ? 'Estimate line' : 'Linked visit finding'}</small></span></label>)}
            </section>
          </div>}
          {step === 1 && <>{canSaveTemplates && <section className="mb-4 rounded border p-4">
            <label className="block text-sm font-semibold">Reusable company template name<input className="mt-1 w-full rounded border p-2" maxLength={120} value={templateName} onChange={e => setTemplateName(e.target.value)} /></label>
            <p className="my-2 text-sm text-slate-600">Saves term wording and default tick marks only—not selected estimate details. Remove customer-specific wording before reusing. This does not signify legal approval.</p>
            <button className={button} disabled={!templateName.trim()} onClick={() => run(async () => {
              const result = await apiRequest<{data: Starter}>('/v1/legal/agreement-templates', {method: 'POST', body: {
                ...payload, name: templateName.trim(), base_revision: starter?.key.startsWith('tenant:') && starter.name === templateName.trim() ? Number(starter.sections_version) : 0,
              }})
              setStarters(old => [result.data, ...old.filter(row => row.key !== result.data.key)])
              setStarter(result.data); setBody(''); setViewingSaved(false)
              setMessage('Company template saved. Preview again before saving this estimate agreement.')
            })}>Save as company template</button>
          </section>}<div className="grid gap-4 md:grid-cols-2">{starter?.sections.map(section => <section key={section.key} className="rounded border p-4">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={selected.includes(section.key)} disabled={section.required} onChange={e => {
              setSelected(old => e.target.checked ? [...old, section.key] : old.filter(key => key !== section.key)); change()
            }} />{section.label} {section.required ? '(required)' : section.recommended ? '(recommended)' : ''}</label>
            <p id={`help-${section.key}`} className="my-2 text-sm text-slate-600">{section.help}</p>
            {selected.includes(section.key) && <textarea aria-label={section.label} aria-describedby={`help-${section.key}`} className="w-full rounded border p-2" rows={4} maxLength={10000} value={values[section.key] ?? ''} onChange={e => { setValues(old => ({ ...old, [section.key]: e.target.value })); change() }} />}
          </section>)}</div></>}
          {step === 2 && <><p className="mb-3 text-sm">{viewingSaved ? 'Saved draft — read only.' : 'Review this draft before saving. Saving does not send, sign or activate it.'}</p>
            <iframe title="Agreement document preview" sandbox="" className="h-[55vh] w-full rounded border bg-white" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px/1.6 system-ui;padding:24px;overflow-wrap:anywhere}h2{font-size:20px}</style></head><body>${body}</body></html>`} /></>}
          {step === 2 && viewingSaved && savedId && <section className="mt-4 space-y-3 rounded border p-4">
            <button className={button} onClick={() => run(async () => {
              const result = await apiRequest<{data: Delivery | null}>(`${base}/agreements/${savedId}/delivery`)
              setDelivery(result.data); setSendOpen(true); setSendConfirmed(false)
            })}>{sendOpen ? 'Refresh sending status' : 'Send for customer signature'}</button>
            {sendOpen && (delivery?.delivery_status ? <div role="status">
              <p>Agreement: {delivery.status.replaceAll('_', ' ')} · Email: {delivery.customer_email}</p>
              {delivery.status === 'customer_signed' && <section className="my-3 space-y-3 rounded border p-3">
                <h4 className="font-semibold">Vendor countersignature</h4>
                <p className="text-sm">Review the saved wording above. This signs this revision and archives both signatures; it does not accept the estimate, create a job or send email.</p>
                <label className="block">Your full name<input className="ml-2 rounded border p-2" maxLength={200} value={vendorName} onChange={e => setVendorName(e.target.value)} /></label>
                <SignaturePad key={savedId} ref={signaturePad} hint="Vendor: sign above" />
                <label className="flex gap-2"><input type="checkbox" checked={vendorConfirmed} onChange={e => setVendorConfirmed(e.target.checked)} />I reviewed this saved agreement and am authorized to sign for the company.</label>
                <button className={button} disabled={!vendorConfirmed || !vendorName.trim()} onClick={() => run(async () => {
                  const signature = signaturePad.current?.toDataUrl()
                  if (!signature) throw new Error('Draw your signature before countersigning.')
                  const result = await apiRequest<{data: Delivery}>(`${base}/agreements/${savedId}/countersign`, {
                    method: 'POST', body: { signer_name: vendorName.trim(), signature, confirm: true },
                  })
                  setDelivery(result.data); setVendorConfirmed(false)
                  setMessage('Agreement countersigned and signed PDF archived. Estimate unchanged; no email sent.')
                })}>Countersign and archive</button>
              </section>}
              {delivery.status === 'fully_signed' && delivery.has_signed_pdf && <button className={button} onClick={() => run(async () => {
                const blob = await apiRequest<Blob>(`${base}/agreements/${savedId}/signed-pdf`, { responseType: 'blob' })
                if (blob.type !== 'application/pdf') throw new Error('Signed PDF could not be downloaded.')
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a'); link.href = url; link.download = 'signed-agreement.pdf'
                document.body.appendChild(link); link.click(); link.remove()
                window.setTimeout(() => URL.revokeObjectURL(url), 60000)
              })}>Download signed agreement</button>}
              <p>{delivery.delivery_status === 'accepted' ? 'Email provider accepted the signing request. Inbox delivery is not confirmed.' : 'Sending is in progress or delivery is uncertain. No automatic resend will occur. Check with the recipient or email provider before taking further action.'}</p>
              {delivery.resolution ? <div className="mt-3 rounded border p-3">
                <p>{delivery.resolution === 'received' ? 'Recipient receipt confirmed by staff.' : 'Unsigned signing link revoked. Save a new revision before issuing another request.'}</p>
                <p className="text-sm">Recorded by {delivery.resolved_by} · {delivery.resolved_at}</p>
                <p className="whitespace-pre-wrap">{delivery.resolution_note}</p>
              </div> : ['sent', 'customer_signed', 'fully_signed'].includes(delivery.status) && <div className="mt-3 space-y-3 rounded border p-3">
                <h4 className="font-semibold">Resolve sending status</h4>
                <p className="text-sm">This records your review; it never sends another email. Revoking cannot recall an email already in progress, but its signing link will stop working.</p>
                <label className="block">Action
                  <select className="ml-2 rounded border p-2" value={recoveryAction} onChange={e => { setRecoveryAction(e.target.value); setRecoveryConfirmed(false) }}>
                    <option value="received">Recipient confirmed receipt</option>
                    {delivery.status === 'sent' && <option value="revoked">Revoke unsigned signing link</option>}
                  </select>
                </label>
                <label className="block">Verification / reason
                  <textarea className="mt-1 w-full rounded border p-2" maxLength={2000} value={recoveryNote} onChange={e => { setRecoveryNote(e.target.value); setRecoveryConfirmed(false) }} />
                </label>
                <label className="flex gap-2"><input type="checkbox" checked={recoveryConfirmed} onChange={e => setRecoveryConfirmed(e.target.checked)} />
                  {recoveryAction === 'received' ? 'I verified that this recipient received this signing request.' : 'I understand the unsigned link will stop working. Nothing will be resent.'}
                </label>
                <button className={button} disabled={!recoveryConfirmed || !recoveryNote.trim()} onClick={() => run(async () => {
                  const result = await apiRequest<{data: Delivery}>(`${base}/agreements/${savedId}/delivery/resolve`, {
                    method: 'POST', body: { action: recoveryAction, note: recoveryNote.trim(), confirm: true },
                  })
                  setDelivery(result.data); setRecoveryConfirmed(false)
                  setMessage('Resolution recorded. No email was sent and the estimate was not changed.')
                })}>Record resolution — no email</button>
              </div>}
            </div> : <div className="space-y-3">
              <p>This emails a signing link for saved revision {revisions.find(row => row.id === savedId)?.revision}. It does not accept the estimate, book work, or start billing. Customer signature comes before vendor countersignature.</p>
              <label className="block">Recipient email<input type="email" className="mt-1 w-full rounded border p-2" value={recipient} onChange={e => { setRecipient(e.target.value); setSendConfirmed(false) }} /></label>
              <label className="block">Signing link expires in days<input type="number" min={1} max={365} className="ml-3 rounded border p-2" value={expiryDays} onChange={e => { setExpiryDays(Number(e.target.value)); setSendConfirmed(false) }} /></label>
              <label className="flex gap-2"><input type="checkbox" checked={sendConfirmed} onChange={e => setSendConfirmed(e.target.checked)} />I reviewed this saved revision and recipient, completed any necessary legal review, and authorize this email.</label>
              <button className={`${button} bg-amber-600 text-white`} disabled={!sendConfirmed || !recipient.trim() || !Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 365} onClick={() => run(async () => {
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
    </Modal.Body>
    <Modal.Footer>
      <button className={button} disabled={busy} onClick={close}>Close</button>
      {terms?.accepted && step === 2 && viewingSaved && savedId && <button className={button} disabled={busy} onClick={() => run(async () => {
        const blob = await apiRequest<Blob>(`${base}/agreements/${encodeURIComponent(savedId)}/pdf`, { responseType: 'blob' })
        if (blob.type !== 'application/pdf') throw new Error('The PDF could not be downloaded. Try again.')
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url; link.download = `agreement-draft-r${revisions.find(row => row.id === savedId)?.revision ?? 'saved'}.pdf`
        document.body.appendChild(link); link.click(); link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 60000)
        setMessage('Saved revision downloaded as a draft PDF. Nothing was sent or signed.')
      })}>Download draft PDF</button>}
      {terms?.accepted && step === 0 && <button className={button} disabled={busy || !starter} onClick={() => { if (viewingSaved) setBody(''); setViewingSaved(false); setStep(1) }}>Continue to terms</button>}
      {terms?.accepted && step === 1 && <button className={button} disabled={busy} onClick={preview}>Preview agreement</button>}
      {terms?.accepted && step === 2 && !viewingSaved && <button className={`${button} bg-amber-600 text-white`} disabled={busy || !body} onClick={save}>Save draft to estimate</button>}
      {terms?.accepted && step === 2 && viewingSaved && savedId && <button className={button} disabled={busy} onClick={() => {
        if (dirty && !window.confirm('Replace your unsaved wording with this saved revision?')) return
        run(async () => {
          const result = await apiRequest<{data: {snapshot: {starter_key: string; sections_version: string; sections: {key: string; text: string}[]; sources?: {id: string; text: string}[]}}}>(`${base}/agreements/${savedId}`)
          const snapshot = result.data.snapshot
          const template = starters.find(row => row.key === snapshot.starter_key && row.sections_version === snapshot.sections_version)
          if (!template) throw new Error('This template version is no longer available. The saved draft remains readable and unchanged.')
          setStarter(template); setSelected(snapshot.sections.map(row => row.key)); setValues(Object.fromEntries(snapshot.sections.map(row => [row.key, row.text])))
          // Re-selection is deliberate: never silently replace historical source text with current text.
          setSourceIds([]); setBody(''); setViewingSaved(false); setDirty(true); setStep(0)
          setMessage('Saved wording loaded for a new revision. Re-select current project details; the original draft stays unchanged.')
        })
      }}>Edit as new revision</button>}
    </Modal.Footer>
  </Modal>
}
