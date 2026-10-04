import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

/**
 * The report, as a page — /r/{tenantId}/{reportNumber}, no login.
 *
 * Read in thirty seconds by a property manager, a fire marshal or an
 * insurer. So the verdict comes first in words, then what needs fixing with
 * a date against each one, and only then the full list of what was checked.
 *
 * Every decision about what it *says* was made server-side in
 * `ReportViewModel`, which the PDF renders too — this page chooses layout
 * and nothing else. A status word here that the view model did not supply
 * is a place the two can drift apart.
 *
 * Three rules it follows throughout, because of who reads it:
 *  - status is never colour alone; there is always a word.
 *  - an empty section is left out, never printed as "none".
 *  - it prints. Inspectors carry paper, and a page that prints badly gets
 *    photographed instead.
 */

interface Finding {
  title: string | null
  severity: string | null
  chip: string
  fix_by: string | null
  why_it_matters: string | null
  what_to_do: string | null
  /** Where the fix got to. Null when nothing has happened yet. */
  status_word: string | null
}

interface Check {
  prompt: string | null
  status: string | null
  word: string
  notes: string | null
}

/** One line of a whole-property fix list. */
interface BuildingFix {
  title: string
  where: string
  asset_code: string | null
  chip: string
  fix_by: string | null
  overdue: boolean
  status_word: string | null
}

interface BuildingPayload {
  kind: 'building'
  /** How many private items were left out, so nobody reads it as complete. */
  withheld: number
  report: {
    report_number: string | null
    title: string | null
    generated_at: string | null
    verdict: { heading: string; tone: string; sentence: string }
    tallies: { checked: number; in_good_order: number; need_work: number; safety: number }
    fix_list: BuildingFix[]
    assets: { report_number: string | null; asset: { name: string | null; asset_code: string | null } }[]
  }
  servicer: ReportPayload['servicer']
  verify: ReportPayload['verify']
}

interface ReportPayload {
  report: {
    report_number: string | null
    verdict: { heading: string; tone: string; sentence: string }
    counts: { passed: number; to_fix: number; safety: number; not_applicable: number }
    findings: Finding[]
    checks: Check[]
    facts: { label: string; value: string }[]
    signatures: { role: string; name: string; at: string }[]
    summary_notes: string | null
  }
  servicer: {
    name: string | null
    phone: string | null
    license_number: string | null
    website: string | null
  }
  verify: { record_id: string; report_number: string | null }
}

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.crewbarn.com'

/** The verdict's colour. Always paired with the heading's own words. */
const TONE: Record<string, string> = {
  good: 'border-emerald-300 bg-emerald-50',
  warn: 'border-amber-300 bg-amber-50',
  bad: 'border-red-300 bg-red-50',
  neutral: 'border-slate-300 bg-slate-50',
}

/** A safety finding is the one somebody must not scroll past. */
function severityStripe(severity: string | null): string {
  if (severity === 'life_safety') return 'border-l-red-500'
  if (severity === '30_day') return 'border-l-amber-500'
  return 'border-l-slate-300'
}

function checkMark(status: string | null): string {
  if (status === 'pass') return '✓'
  if (status === 'fail') return '✕'
  if (status === 'na') return '–'
  return '?'
}

export function PublicReportPage() {
  const { tenantId, reportNumber } = useParams<{ tenantId: string; reportNumber: string }>()
  const [state, setState] = useState<'loading' | 'ok' | 'private' | 'missing' | 'error'>('loading')
  const [data, setData] = useState<ReportPayload | null>(null)
  const [building, setBuilding] = useState<BuildingPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    void (async () => {
      try {
        const res = await fetch(
          `${API}/v1/r/${encodeURIComponent(tenantId ?? '')}/${encodeURIComponent(reportNumber ?? '')}`,
        )
        if (cancelled) return
        if (res.status === 404) {
          setState('missing')
          return
        }
        if (!res.ok) {
          setState('error')
          return
        }
        const body = (await res.json()) as {
          data?: (ReportPayload & { kind?: string }) | undefined
          private?: boolean
        }
        if (cancelled) return
        if (body.private) {
          setState('private')
          return
        }
        // A number is one document, and the reader does not know which
        // kind they were given — so the page works that out, not them.
        if (body.data?.kind === 'building') {
          setBuilding(body.data as unknown as BuildingPayload)
          setState('ok')
          return
        }
        setData(body.data ?? null)
        setState(body.data ? 'ok' : 'error')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, reportNumber])

  if (state === 'loading') {
    return <Shell><p className="text-slate-500">Loading the report…</p></Shell>
  }

  if (state === 'private') {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">This item is private</h1>
        <p className="mt-2 leading-relaxed text-slate-600">
          The owner keeps this one private. Ask them for a copy of the report.
        </p>
      </Shell>
    )
  }

  if (state === 'missing') {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">No report with that number</h1>
        <p className="mt-2 leading-relaxed text-slate-600">
          Check the number on the paperwork. A report that has not been completed yet does not
          have one.
        </p>
      </Shell>
    )
  }

  if (state === 'ok' && building) {
    return <BuildingReport payload={building} />
  }

  if (state === 'error' || !data) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">Could not load the report</h1>
        <p className="mt-2 leading-relaxed text-slate-600">Try again in a moment.</p>
      </Shell>
    )
  }

  const { report, servicer, verify } = data
  const { counts } = report

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl">
        {/*
          The shop's name at the top, not CrewBarn's. The customer's
          relationship is with them, and a report is the thing they are
          being judged on.
        */}
        <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <p className="text-lg font-semibold text-slate-900">{servicer.name ?? 'Service report'}</p>
            {servicer.license_number && (
              <p className="text-sm text-slate-500">Licence {servicer.license_number}</p>
            )}
          </div>
          {servicer.phone && (
            <a
              href={`tel:${servicer.phone.replace(/[^0-9+]/g, '')}`}
              className="inline-flex min-h-[44px] items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 print:hidden"
            >
              Call {servicer.phone}
            </a>
          )}
        </header>

        <main className="overflow-hidden rounded-xl bg-white shadow-sm print:rounded-none print:shadow-none">
          {/* The verdict, in words, with a sentence saying what it means. */}
          <section className={`border-b border-l-4 px-5 py-5 sm:px-6 ${TONE[report.verdict.tone] ?? TONE.neutral}`}>
            <h1 className="text-2xl font-semibold leading-tight text-slate-900">
              {report.verdict.heading}
            </h1>
            <p className="mt-1.5 leading-relaxed text-slate-700">{report.verdict.sentence}</p>
          </section>

          {/* Tabular figures so the four numbers line up as a row. */}
          <section className="grid grid-cols-2 gap-px border-b bg-slate-200 sm:grid-cols-4">
            <Tile label="Checks passed" value={counts.passed} />
            <Tile label="To fix" value={counts.to_fix} />
            <Tile label="Safety issues" value={counts.safety} />
            <Tile label="Not applicable" value={counts.not_applicable} />
          </section>

          {report.findings.length > 0 && (
            <section className="border-b px-5 py-5 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900">What needs fixing</h2>
              <p className="mt-0.5 text-sm text-slate-500">Most urgent first.</p>

              <ol className="mt-4 space-y-4">
                {report.findings.map((finding, i) => (
                  <li
                    key={i}
                    className={`border-l-4 pl-4 ${severityStripe(finding.severity)}`}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-medium text-slate-900">{finding.title ?? 'Finding'}</h3>
                      {/* Words, not a colour: "Fix now: safety" survives a
                          photocopy and a reader who cannot see the stripe. */}
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {finding.chip}
                        {finding.fix_by ? ` · by ${finding.fix_by}` : ''}
                      </span>
                      {/* Only once something has happened. "Open" against
                          every line on a fresh report says nothing. */}
                      {finding.status_word && (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          {finding.status_word}
                        </span>
                      )}
                    </div>

                    {finding.why_it_matters && (
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        <span className="font-medium text-slate-700">Why it matters: </span>
                        {finding.why_it_matters}
                      </p>
                    )}

                    {finding.what_to_do && (
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        <span className="font-medium text-slate-700">What to do: </span>
                        {finding.what_to_do}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {report.summary_notes && (
            <section className="border-b px-5 py-5 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900">Notes</h2>
              <p className="mt-1.5 leading-relaxed text-slate-700">{report.summary_notes}</p>
            </section>
          )}

          {report.facts.length > 0 && (
            <section className="border-b px-5 py-5 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900">Details</h2>
              <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {report.facts.map((fact) => (
                  <div key={fact.label} className="flex justify-between gap-4 border-b border-dashed border-slate-200 pb-1.5">
                    <dt className="text-sm text-slate-500">{fact.label}</dt>
                    <dd className="text-right text-sm font-medium text-slate-800">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Everything that was checked. A report listing only failures is
              one the reader has to take on trust. */}
          {report.checks.length > 0 && (
            <section className="border-b px-5 py-5 sm:px-6 print:break-before-page">
              <h2 className="text-base font-semibold text-slate-900">Everything we checked</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {report.checks.map((check, i) => (
                  <li key={i} className="flex items-start gap-3 py-2.5">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 w-4 shrink-0 text-center font-semibold ${
                        check.status === 'fail'
                          ? 'text-red-600'
                          : check.status === 'pass'
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {checkMark(check.status)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-800">{check.prompt}</span>
                      {check.notes && (
                        <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
                          {check.notes}
                        </span>
                      )}
                    </span>
                    {/* The word carries the meaning; the mark is decoration. */}
                    <span className="shrink-0 text-xs font-medium text-slate-500">{check.word}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.signatures.length > 0 && (
            <section className="border-b px-5 py-5 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900">Signed</h2>
              <ul className="mt-3 space-y-1.5">
                {report.signatures.map((signature, i) => (
                  <li key={i} className="text-sm text-slate-700">
                    <span className="font-medium">{signature.name}</span>
                    <span className="text-slate-500">
                      {' '}
                      · {signature.role}
                      {signature.at ? ` · ${signature.at}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/*
            The independent check. An AHJ distrusts a digital record because
            anyone can print a QR pointing anywhere — so the number is here
            in type they can read off paper and enter themselves.
          */}
          <section className="px-5 py-5 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900">Check this report is genuine</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              This record comes from {servicer.name ?? 'the servicing company'}&rsquo;s CrewBarn
              account. Verify confirms it has not been changed since it was signed.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {report.report_number && (
                <span className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-800">
                  {report.report_number}
                </span>
              )}
              <a
                href={`/verify/${encodeURIComponent(verify.record_id)}`}
                className="inline-flex min-h-[44px] items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white print:hidden"
              >
                Verify this report
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[44px] items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 print:hidden"
              >
                Print
              </button>
            </div>
          </section>
        </main>

        <p className="mt-4 text-center text-xs text-slate-400">Records by CrewBarn</p>
      </div>
    </div>
  )
}

/**
 * A whole property.
 *
 * The order is the point: one verdict, then how many items are in what
 * state, then ONE fix list across all of them most urgent first. Somebody
 * who reads the first screen and stops should still have the true headline
 * — which is why the verdict is the worst item, not an average.
 */
function BuildingReport({ payload }: { payload: BuildingPayload }) {
  const { report, servicer, withheld } = payload
  const tenantId = window.location.pathname.split('/')[2] ?? ''

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl">
        <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <p className="text-lg font-semibold text-slate-900">{servicer.name ?? 'Service report'}</p>
            {servicer.license_number && (
              <p className="text-sm text-slate-500">Licence {servicer.license_number}</p>
            )}
          </div>
          {servicer.phone && (
            <a
              href={`tel:${servicer.phone.replace(/[^0-9+]/g, '')}`}
              className="inline-flex min-h-[44px] items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 print:hidden"
            >
              Call {servicer.phone}
            </a>
          )}
        </header>

        <main className="overflow-hidden rounded-xl bg-white shadow-sm print:rounded-none print:shadow-none">
          <section className={`border-b border-l-4 px-5 py-5 sm:px-6 ${TONE[report.verdict.tone] ?? TONE.neutral}`}>
            {report.title && (
              <p className="mb-1 text-sm font-medium text-slate-600">{report.title}</p>
            )}
            <h1 className="text-2xl font-semibold leading-tight text-slate-900">
              {report.verdict.heading}
            </h1>
            <p className="mt-1.5 leading-relaxed text-slate-700">{report.verdict.sentence}</p>
          </section>

          <section className="grid grid-cols-2 gap-px border-b bg-slate-200 sm:grid-cols-4">
            <Tile label="Items checked" value={report.tallies.checked} />
            <Tile label="In good order" value={report.tallies.in_good_order} />
            <Tile label="Need work" value={report.tallies.need_work} />
            <Tile label="Safety issues" value={report.tallies.safety} />
          </section>

          {report.fix_list.length > 0 && (
            <section className="border-b px-5 py-5 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900">
                What needs fixing across the property
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">Most urgent first.</p>

              <ol className="mt-4 space-y-3">
                {report.fix_list.map((fix, i) => (
                  <li key={i} className="border-l-4 border-l-slate-200 pl-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {/* Which item, first. On a whole-property list "the
                          closer slams" without a location is not something
                          anybody can act on. */}
                      <span className="font-medium text-slate-900">{fix.where}</span>
                      {fix.asset_code && (
                        <span className="font-mono text-xs text-slate-400">{fix.asset_code}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{fix.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {fix.chip}
                        {fix.fix_by ? ` · by ${fix.fix_by}` : ''}
                      </span>
                      {fix.overdue && (
                        <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          Overdue
                        </span>
                      )}
                      {fix.status_word && (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          {fix.status_word}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* The index. Each item links to its own report, which is where
              the detail lives — this page is the summary. */}
          {report.assets.length > 0 && (
            <section className="border-b px-5 py-5 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900">Items in this report</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {report.assets.map((entry, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 text-sm text-slate-800">{entry.asset.name}</span>
                    {entry.report_number && (
                      <a
                        href={`/r/${encodeURIComponent(tenantId)}/${encodeURIComponent(entry.report_number)}`}
                        className="shrink-0 font-mono text-xs text-slate-500 underline"
                      >
                        {entry.report_number}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {withheld > 0 && (
                /* Said out loud, so nobody reads this as the whole picture
                   when the owner has kept part of it private. */
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  {withheld === 1 ? 'One item is' : `${withheld} items are`} kept private by the
                  owner and {withheld === 1 ? 'is' : 'are'} not shown here.
                </p>
              )}
            </section>
          )}

          <section className="px-5 py-5 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900">Check this report is genuine</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              This record comes from {servicer.name ?? 'the servicing company'}&rsquo;s CrewBarn
              account.
              {report.generated_at ? ` Issued ${report.generated_at}.` : ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {report.report_number && (
                <span className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-800">
                  {report.report_number}
                </span>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[44px] items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 print:hidden"
              >
                Print
              </button>
            </div>
          </section>
        </main>

        <p className="mt-4 text-center text-xs text-slate-400">Records by CrewBarn</p>
      </div>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white px-4 py-3 text-center">
      <div className="text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-xl bg-white px-6 py-8 shadow-sm">{children}</div>
    </div>
  )
}
