import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { acknowledgeTesterIntro } from '@/lib/tester'

/**
 * The beta tester agreement — the deal behind "free CrewBarn for life".
 * Accepting records the time on the tester's progress row (that's what
 * unlocks the rest of setup) and is what Admin → Testers shows.
 */

export const BETA_AGREEMENT_VERSION = '2026-09-21'

const TERMS: { title: string; body: string }[] = [
  {
    title: 'What you\u2019re getting',
    body: 'A CrewBarn workspace for your company, free of charge, for as long as CrewBarn exists \u2014 the office web app, the crew phone app, the customer portal, estimates, invoicing, scheduling and dispatch. No trial clock, no card.',
  },
  {
    title: 'What we\u2019re asking',
    body: 'Install the CrewBarn Android app when Google emails you the test link, keep it installed and use it for at least 14 days, and tell us what breaks or what\u2019s confusing. That\u2019s it. A shop that stops using the app before the 14 days are up may lose the free-for-life offer, but never its data.',
  },
  {
    title: 'Bring your own keys',
    body: 'Phone, text, email, maps, payments and AI run through providers you connect under your own accounts (Net2Phone, Twilio, Resend, Google, Stripe, GoDaddy, OpenAI/Anthropic and the like). Those providers bill you directly; CrewBarn never adds a charge on top. Nothing you connect is shared with other companies.',
  },
  {
    title: 'It\u2019s a beta',
    body: 'Things will change and some things will break. We fix fast and you\u2019ll see a \u201cwhat\u2019s new\u201d card each time. We may reset seeded sample data during the beta; we will not delete customers, jobs, invoices or files you created.',
  },
  {
    title: 'Your data',
    body: 'Your customers, jobs, photos and documents are yours. They\u2019re stored per company with database-level isolation, and you can export them from Tool Shed → Data Export any time. We look at your account only to support you or to fix a bug you reported.',
  },
  {
    title: 'No warranty, plain and simple',
    body: 'CrewBarn is provided as-is during the beta. Keep your own records the way you do today until you trust it. We\u2019re not liable for lost business from a bug, an outage, or a provider you connected going down.',
  },
  {
    title: 'Leaving',
    body: 'You can stop any time: export your data, disable your logins, done. We can end a beta account for abuse, for using it to copy the product, or for never actually using it \u2014 with notice, and never by deleting your data without giving you an export first.',
  },
]

export function BetaAgreement({ onAccepted, compact = false }: { onAccepted?: () => void; compact?: boolean }) {
  const qc = useQueryClient()
  const [read, setRead] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const accept = useMutation({
    mutationFn: () => acknowledgeTesterIntro(),
    onSuccess: async () => {
      setErr(null)
      await qc.invalidateQueries({ queryKey: ['onboarding'] })
      await qc.invalidateQueries({ queryKey: ['tester'] })
      onAccepted?.()
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Could not record your acceptance — try again.'),
  })

  return (
    <div className="space-y-4">
      <div className={`space-y-3 rounded-xl border border-slate-200 bg-white p-4 ${compact ? 'max-h-72 overflow-y-auto' : ''}`}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">CrewBarn beta agreement · {BETA_AGREEMENT_VERSION}</div>
        {TERMS.map((t) => (
          <div key={t.title}>
            <div className="text-sm font-bold text-navy-900">{t.title}</div>
            <p className="mt-0.5 text-sm leading-6 text-slate-700">{t.body}</p>
          </div>
        ))}
      </div>
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
        <span>I’ve read the agreement and I accept it on behalf of my company.</span>
      </label>
      <button type="button" onClick={() => accept.mutate()} disabled={!read || accept.isPending} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">
        {accept.isPending ? 'Saving\u2026' : 'Accept and unlock setup'}
      </button>
    </div>
  )
}
