import { Link } from 'react-router-dom'
import type { AgreementAiStatus, AiMissing } from './agreementAi'
import type { SendCheck } from './sendChecks'

const button = 'rounded border px-3 py-2 text-sm disabled:opacity-50'

/** What to show instead of AI buttons when the shop's AI isn't ready. */
export function AiSetupNotice({ ai }: { ai: AgreementAiStatus | null }) {
  if (!ai || ai.ready) return null
  const words = ai.reason === 'no_key' ? 'Set up CBI AI to draft for you' : ai.message ?? 'CBI AI is not ready.'
  return ai.setup_url
    ? <Link to={ai.setup_url} className="text-sm font-semibold text-amber-700 underline" data-tour="agreement-ai-setup">{words}</Link>
    : <span className="text-sm text-slate-600">{words}</span>
}

/** "Draft it for me": a notes box, the button, and what the draft could not fill. */
export function AgreementDraftAssistant({ ai, notes, onNotes, drafting, disabled, onDraft, missing, onJump, onDismissMissing }: {
  ai: AgreementAiStatus | null
  notes: string
  onNotes: (v: string) => void
  drafting: boolean
  disabled: boolean
  onDraft: () => void
  missing: AiMissing[]
  onJump: (key: string) => void
  onDismissMissing: () => void
}) {
  return <div data-tour="agreement-draft-ai" className="w-full space-y-2">
    {ai?.ready ? <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-[14rem] flex-1 text-sm font-semibold">Anything special?
        <input className="mt-1 w-full rounded border p-2 text-sm font-normal" maxLength={1000} value={notes} onChange={(e) => onNotes(e.target.value)}
          placeholder="e.g. no parts, 24-hour response, customer gives gate code" /></label>
      <button type="button" className={`${button} bg-amber-600 text-white`} disabled={disabled || drafting} onClick={onDraft} aria-busy={drafting}>
        {drafting ? 'Drafting…' : 'Draft it for me'}</button>
    </div> : <p className="text-sm text-slate-600">Want a first draft of the wording? <AiSetupNotice ai={ai} /></p>}
    {missing.length > 0 && <div role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="flex items-start justify-between gap-2"><p className="font-semibold">Still needed</p>
        <button type="button" className="text-xs underline" onClick={onDismissMissing}>Hide</button></div>
      <ul className="mt-1 space-y-1">{missing.map((m, i) => <li key={`${m.key}-${i}`}>
        {m.key === 'general' ? m.message : <button type="button" className="text-left underline decoration-dotted" onClick={() => onJump(m.key)}>{m.message}</button>}
      </li>)}</ul>
    </div>}
  </div>
}

/** The pre-send list: each item jumps to where it's fixed. */
export function SendChecklist({ checks, onJump, intro }: { checks: SendCheck[]; onJump: (key: string) => void; intro?: string }) {
  if (!checks.length) {
    return <p data-tour="agreement-send-checklist" className="rounded bg-emerald-50 p-3 text-sm text-emerald-900">Ready to send: the visit plan, price, term, exclusions and email are all in place.</p>
  }
  return <div data-tour="agreement-send-checklist" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
    <p className="font-semibold">Before it can be sent</p>
    {intro && <p className="mt-1">{intro}</p>}
    <ul className="mt-1 list-disc space-y-1 pl-5">{checks.map((c) => <li key={`${c.key}-${c.message}`}>
      <button type="button" className="text-left underline decoration-dotted" onClick={() => onJump(c.key)}>{c.message}</button>
    </li>)}</ul>
  </div>
}
