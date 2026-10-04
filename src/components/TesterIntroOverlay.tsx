import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import {
  useAcknowledgeTesterIntro,
  useTesterProgress,
} from '@/hooks/useTester'

/**
 * First-login overlay for tester accounts: the agreement, then the tour.
 *
 * Panel 1 is the beta deal and has to be accepted — it cannot be dismissed by
 * clicking outside or pressing Esc, and acknowledging is what records it
 * server-side. The three panels after it are the explanation: what CrewBarn
 * is end to end, what is in the box, and where security stands. Those are
 * informational, so the overlay can be closed from any of them; the
 * agreement is already recorded by then and never shows again.
 *
 * The security panel says what is true and no more. CrewBarn has no SOC 2
 * report, and saying so plainly is better than the hedging that usually
 * fills this space — every specific under it was checked against the running
 * configuration rather than written from memory.
 */

interface Panel {
  eyebrow: string
  title: string
  body: React.ReactNode
}

const ARC: Array<[string, string]> = [
  ['Set up your shop', 'Company details, your trade, your people, what you charge. About twenty minutes, and the walkthrough asks in plain English.'],
  ['A customer calls', 'The call, text or web request lands in Messages. Turn it into a job in one step — CrewBarn already has the customer if they have been before.'],
  ['Book it and send it out', 'Put it on the schedule, assign a tech, and they get it on the phone app with the address, the history and the photos.'],
  ['Do the work', 'The tech clocks in, takes photos, adds the parts used and gets a signature on the phone. It all lands on the job while they are still on site.'],
  ['Invoice and get paid', 'The invoice builds itself from the job. Send it by email or text, and the customer pays by card or bank transfer from the link — the money goes to your account, never through CrewBarn.'],
  ['See where you stand', 'Accounting shows what is owed, what came in and what it cost you. The cost model turns your overheads into the rate you should be charging.'],
]

const TOOLS: Array<[string, string]> = [
  ['Work', 'Jobs, estimates, scheduling, dispatch, tasks, recurring work, inspections and assets'],
  ['Money', 'Invoices, payments by card and bank transfer, expenses, purchase orders, accounting and reports'],
  ['People', 'Staff and crews, time clock, payroll, time off, hiring, and a portal where your crew see their own week'],
  ['Parts', 'Inventory across vans and shelves, stock counts, low-stock alerts, suppliers and purchase orders'],
  ['Customers', 'Customer records, service locations, documents, a customer portal, and a marketplace listing'],
  ['Talking to people', 'Calls, texts and email in one inbox, templates, automatic reminders and job updates'],
  ['Your shopfront', 'A website CrewBarn builds and hosts, your own domain, and a branded app for your customers'],
  ['CBI', 'Ask questions in plain English and get answers from your own data — it can also draft jobs from a call'],
]

export function TesterIntroOverlay() {
  const { account } = useAuth()
  const navigate = useNavigate()
  const isTester = account?.role === 'tester'
  const [panel, setPanel] = useState(0)

  const { data, isLoading } = useTesterProgress(isTester)
  const ack = useAcknowledgeTesterIntro()

  if (!isTester || isLoading || !data) return null
  if (data.data.intro_acknowledged && panel === 0) return null

  const panels: Panel[] = [
    {
      eyebrow: 'Welcome — quick read',
      title: 'How testing CrewBarn works',
      body: (
        <>
          <p>
            You are set up as a <strong>beta tester</strong>: your workspace is real, it is yours, and it is free for
            life. Run your shop on it — and tell me what is confusing, broken or weird along the way. The one thing
            Google needs from you: keep the phone app installed and use it for 14 days.
          </p>
          <p>
            Nothing here is a demo. The customers you add are your customers, the invoices you send are real invoices,
            and the money goes to your account.
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            Found something wrong? The <strong>?</strong> in the top bar opens help and takes feedback. A one-liner is
            worth more than a polished bug report — send it while it is annoying you.
          </p>
        </>
      ),
    },
    {
      eyebrow: 'What CrewBarn is',
      title: 'From setting up to getting paid',
      body: (
        <ol className="space-y-3">
          {ARC.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <span>
                <strong className="block text-slate-900">{title}</strong>
                <span className="text-slate-600">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      eyebrow: 'What is in the box',
      title: 'Everything you get',
      body: (
        <>
          <p className="text-slate-600">
            All of it is included — there are no tiers where the useful parts are locked away.
          </p>
          <dl className="mt-3 space-y-2.5">
            {TOOLS.map(([name, what]) => (
              <div key={name}>
                <dt className="text-sm font-bold text-slate-900">{name}</dt>
                <dd className="text-sm leading-relaxed text-slate-600">{what}</dd>
              </div>
            ))}
          </dl>
        </>
      ),
    },
    {
      eyebrow: 'Where security stands',
      title: 'Built to the standard, without the certificate',
      body: (
        <>
          <p>
            <strong>CrewBarn is not SOC 2 certified.</strong> That is an audit costing tens of thousands a year, and a
            company this size has not done it. It is worth saying plainly rather than implying otherwise — but the
            controls a SOC 2 audit looks for are what CrewBarn was built with:
          </p>
          <ul className="mt-3 space-y-2 text-slate-600">
            <li>
              <strong className="text-slate-900">Your data is separated at the database itself.</strong> Every table
              carries a rule the database enforces, so one company's rows cannot be read from another's session even if
              the application asks wrongly. It is checked by a command that fails the build rather than by good
              intentions.
            </li>
            <li>
              <strong className="text-slate-900">Two-factor on every sign-in.</strong> Not just for admins, and not
              optional — a password alone does not get anybody in.
            </li>
            <li>
              <strong className="text-slate-900">Sensitive documents are encrypted with keys we cannot read.</strong>{' '}
              Things like a tax ID or a signed contract are encrypted with keys held in Google Cloud KMS, so a copy of
              the database on its own is not enough to open them.
            </li>
            <li>
              <strong className="text-slate-900">The database is private and encrypted in transit.</strong> It is not
              reachable from the internet, and connections to it require TLS.
            </li>
            <li>
              <strong className="text-slate-900">Card numbers never reach CrewBarn.</strong> Payments go straight to
              your processor. CrewBarn stores what was paid, not how to charge the card again.
            </li>
          </ul>
          <p className="mt-3 text-slate-600">
            What that does not mean: no outside auditor has signed any of this off, and there is no third-party
            penetration test to point at yet. If your insurer or a commercial customer asks for a SOC 2 report, the
            honest answer today is that there is not one.
          </p>
        </>
      ),
    },
  ]

  const current = panels[panel]
  const last = panel === panels.length - 1
  const accepted = data.data.intro_acknowledged

  const accept = async () => {
    if (!accepted) {
      await ack.mutateAsync()
    }
    setPanel(1)
  }

  const finish = () => {
    setPanel(0)
    navigate('/onboarding')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="px-6 pb-2 pt-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">{current.eyebrow}</div>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{current.title}</h2>
        </div>

        <div className="space-y-3 px-6 py-4 text-sm leading-relaxed text-slate-700">{current.body}</div>

        <div className="flex items-center gap-2 border-t border-slate-200 px-6 py-4">
          {panel > 0 && (
            <button
              type="button"
              onClick={() => setPanel((p) => p - 1)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          )}

          {panel === 0 ? (
            <button
              type="button"
              onClick={() => void accept()}
              disabled={ack.isPending}
              className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {ack.isPending ? 'One moment…' : accepted ? 'Continue' : 'I agree — show me CrewBarn'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (last ? finish() : setPanel((p) => p + 1))}
              className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
            >
              {last ? 'Start setting up' : 'Next'}
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400">
            {panel + 1} of {panels.length}
          </span>
        </div>
      </div>
    </div>
  )
}
