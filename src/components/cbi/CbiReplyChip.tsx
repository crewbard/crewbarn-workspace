import { Link } from 'react-router-dom'

/**
 * The answer to "that's wrong, we ...": Saved, Sent to your admin, or Can't
 * (with the reason). Same shape as `verdict` from POST /v1/ai/learning/corrections
 * (API 34.292); the phone app shows the same chip.
 */
export interface CbiReplyVerdict {
  outcome: 'saved' | 'review' | 'refused'
  label: string
  reason: string
  layer: 'platform' | 'company' | 'lessons' | null
  rule_ref: string | null
  overridable: boolean
}

const TONE: Record<CbiReplyVerdict['outcome'], { box: string; dot: string }> = {
  saved: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', dot: 'bg-emerald-500' },
  review: { box: 'border-amber-200 bg-amber-50 text-amber-900', dot: 'bg-amber-500' },
  refused: { box: 'border-rose-200 bg-rose-50 text-rose-900', dot: 'bg-rose-500' },
}

export function CbiReplyChip({ verdict }: { verdict: CbiReplyVerdict }) {
  const tone = TONE[verdict.outcome] ?? TONE.review
  const showRules = verdict.layer === 'company' || verdict.layer === 'platform'
  return (
    <div data-cbi-reply-chip={verdict.outcome} role="status" className={`mt-2 rounded-lg border px-2.5 py-1.5 text-xs ${tone.box}`}>
      <div className="flex items-center gap-1.5 font-semibold">
        <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${tone.dot}`} />
        {verdict.label}
      </div>
      {verdict.reason && <p className="mt-0.5 leading-snug opacity-90">{verdict.reason}</p>}
      {showRules && (
        <Link to="/tool-shed/ai/rules" className="mt-1 inline-block font-semibold underline-offset-2 hover:underline">
          View rules
        </Link>
      )}
    </div>
  )
}
