import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { ReportIcon, type IconName } from '@/components/reports/ReportIcon'
import { ReportOverlay } from '@/components/reports/ReportOverlay'
import { SalesTaxOverlay } from '@/components/reports/SalesTaxOverlay'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'

/**
 * Reports front door — the same twenty reports, asked as questions.
 *
 * A list of report names only helps someone who already knows which report
 * answers their question. "A/R aging" and "invoice register" are the names of
 * the tables, not the names of the problems. Nobody sits down wanting an aging
 * bucket; they want to know who owes them money.
 *
 * So the questions are the front door and the report names ride along
 * underneath, still visible — an owner who has learned the names shouldn't be
 * made to re-learn the questions, and a bookkeeper asking for "the A/R aging"
 * needs to be findable by that word too. Both are searchable.
 *
 * Picking one opens it over this page rather than navigating away: reading a
 * report is a lookup, and you almost always want to go straight back and check
 * something else.
 */

type Tone = { fg: string; bg: string }

const TONES: Record<string, Tone> = {
  in: { fg: '#166534', bg: '#E7F5EC' },
  out: { fg: '#86521A', bg: '#FDF3E4' },
  work: { fg: '#1E3A8A', bg: '#E8EDFB' },
  legal: { fg: '#334155', bg: '#EEF2F6' },
}

interface Question {
  id: string
  icon: IconName
  question: string
  answer: string
  /** Opened in the overlay. Ids match the report spec registry. */
  report: string
  /** Also reachable from this card, shown as the reports it is built from. */
  also?: string[]
  /** Sales tax brings its own overlay body — it records the filing payment as
   *  well as reporting the totals, so it isn't a generic spec. */
  ownOverlay?: boolean
  /** Extra words that should match this card in search but aren't shown. */
  keywords?: string
}

interface Group {
  key: keyof typeof TONES
  title: string
  questions: Question[]
}

// Every one of the twenty reports appears exactly once across these cards,
// either as the card's own report or in its "built from" list. A report that
// no question reaches is a report nobody finds.
const GROUPS: Group[] = [
  {
    key: 'in',
    title: 'Money coming in',
    questions: [
      {
        id: 'owed',
        icon: 'clock',
        question: 'Who owes me money?',
        answer: 'Every unpaid invoice, oldest first, with how late it is.',
        report: 'ar-aging',
        also: ['invoice-register', 'unpaid-invoices'],
        keywords: 'receivable ar aging overdue collections chase outstanding balance',
      },
      {
        id: 'paid',
        icon: 'inbox',
        question: 'What got paid this month?',
        answer: 'Every payment, by method and by who collected it.',
        report: 'payment-register',
        keywords: 'cash check card stripe deposit collected received',
      },
      {
        id: 'revenue',
        icon: 'trend',
        question: 'Am I making more than last month?',
        answer: 'Revenue by month, quarter, or year.',
        report: 'revenue-breakdown',
        keywords: 'sales growth trend income turnover',
      },
      {
        id: 'credit',
        icon: 'card',
        question: 'Who has credit on account?',
        answer: 'Unused customer credits and what created them.',
        report: 'customer-credit-register',
        keywords: 'overpayment deposit down payment refund unapplied',
      },
    ],
  },
  {
    key: 'out',
    title: 'Money going out',
    questions: [
      {
        id: 'spend',
        icon: 'outbox',
        question: 'Where did the money go?',
        answer: 'Spending by category, vendor, job, or tech.',
        report: 'expense-register',
        keywords: 'expenses costs reimbursement spending purchases',
      },
      {
        id: 'vendors',
        icon: 'building',
        question: 'What do I owe vendors?',
        answer: 'Open bills and how close they are to due.',
        report: 'ap-aging',
        also: ['vendor-bill-register'],
        keywords: 'payable ap bills suppliers due unpaid',
      },
      {
        id: 'po',
        icon: 'package',
        question: 'What did I order and not get?',
        answer: 'Purchase orders still open, by vendor.',
        report: 'purchase-order-register',
        keywords: 'purchase order po ordered outstanding receiving',
      },
      {
        id: 'subs',
        icon: 'users',
        question: 'What do I owe subs?',
        answer: 'Payouts due, plus who is near the 1099 threshold.',
        report: 'subcontractor-payout',
        also: ['contractor-1099'],
        keywords: 'subcontractor 1099 contractor payout w9 threshold',
      },
    ],
  },
  {
    key: 'work',
    title: 'Is the work profitable',
    questions: [
      {
        id: 'jobs',
        icon: 'chart',
        question: 'Which jobs actually made money?',
        answer: 'Revenue minus parts, labour, and subs, per job.',
        report: 'job-profitability',
        keywords: 'margin profit loss job costing',
      },
      {
        id: 'techs',
        icon: 'toolbox',
        question: 'How is each tech doing?',
        answer: 'Jobs closed, revenue, hours, commission.',
        report: 'tech-performance',
        keywords: 'technician crew productivity commission hours',
      },
      {
        id: 'inventory',
        icon: 'tag',
        question: 'What is my inventory worth?',
        answer: 'Valuation now, plus what moved and what it cost.',
        report: 'inventory-valuation',
        also: ['inventory-movement', 'inventory-spend'],
        keywords: 'stock parts warehouse van valuation count',
      },
    ],
  },
  {
    key: 'legal',
    title: 'Staying legal',
    questions: [
      {
        id: 'salestax',
        icon: 'scales',
        question: 'How much sales tax do I owe?',
        answer: 'Collected by period, with the filing packet.',
        report: 'sales-tax',
        ownOverlay: true,
        keywords: 'sales tax filing dor state county surtax remit',
      },
      {
        id: 'bank',
        icon: 'bank',
        question: 'Does the bank match my books?',
        answer: 'Deposits versus recorded payments, and anything not yet posted.',
        report: 'bank-reconciliation',
        also: ['posting-audit'],
        keywords: 'reconcile statement deposit match ledger posting unposted',
      },
      {
        id: 'audit',
        icon: 'clipboard',
        question: 'Who changed what?',
        answer: 'Every financial edit, who made it, and when.',
        report: 'financial-audit',
        keywords: 'audit trail void write-off refund cancelled history',
      },
    ],
  },
]

/** The preset API speaks report_key + filters, not report/from/to. */
interface ApiPreset {
  id: string
  name?: string
  report_key?: string
  filters?: Record<string, unknown> | null
}

export function ReportQuestionsPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [openReport, setOpenReport] = useState<string | null>(null)
  const [params] = useSearchParams()

  // This path used to BE the workspace. A saved link carrying a report or a
  // preset still means "open that", so forward it instead of dropping someone
  // on a question list and losing what they asked for.
  const deepLink = params.get('report') || params.get('preset')

  const presets = useQuery({
    queryKey: ['reports', 'presets'],
    queryFn: () => apiRequest<{ data: ApiPreset[] }>('/v1/reports/presets'),
  })

  const term = search.trim().toLowerCase()
  const groups = useMemo(() => {
    if (!term) return GROUPS
    return GROUPS.map((g) => ({
      ...g,
      questions: g.questions.filter((q) =>
        [q.question, q.answer, q.report, ...(q.also ?? []), q.keywords ?? '']
          .join(' ')
          .toLowerCase()
          .includes(term),
      ),
    })).filter((g) => g.questions.length > 0)
  }, [term])

  const hits = groups.reduce((n, g) => n + g.questions.length, 0)

  // After every hook, so the hook order never changes between renders.
  if (deepLink) {
    return <Navigate to={`/accounting/reports/browse?${params.toString()}`} replace />
  }

  const open = (q: Question) => {
    setOpenReport(q.report)
  }

  return (
    <div className={easy ? 'w-full min-w-0 px-4 py-6 sm:px-6 2xl:px-8' : 'mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 2xl:px-8'}>
      {easy ? <EasyPageHeading title="Reports" description="What do you want to know? Search a question or report name, then open it to review the numbers and available exports." /> : <>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B4762A]">Reports</p>
      <h1 className="mt-1.5 text-[30px] font-bold leading-tight text-[#0A1220]">
        What do you want to know?
      </h1>
      <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-slate-600">
        Same twenty reports underneath — asked as questions instead of listed by name. Pick one and
        the answer comes first; the table you&rsquo;d export is below it.
      </p>
      </>}

      <div className="relative mt-5 max-w-[1120px]">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search reports"
          placeholder={'Ask — "who owes me", "tax", "which techs", "inventory"…'}
          className="w-full rounded-[13px] border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-[14px] text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
      </div>

      {presets.data?.data && presets.data.data.length > 0 && !term && (
        <section className="mt-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Pinned — your saved views
          </h2>
          <div className="mt-2.5 flex flex-wrap gap-3">
            {presets.data.data.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  p.report_key
                    ? setOpenReport(p.report_key)
                    : navigate(`/accounting/reports/browse?preset=${encodeURIComponent(p.id)}&layout=browser`)
                }
                className="flex items-center gap-2.5 rounded-[13px] border border-amber-200 bg-[#FFFBF4] px-4 py-3 text-left hover:border-amber-300"
              >
                <span className="text-[#B4762A]" aria-hidden="true">
                  <ReportIcon name="tag" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-[#0A1220]">
                    {p.name || 'Saved view'}
                  </span>
                  <span className="block truncate font-mono text-[11.5px] text-slate-500">
                    {p.report_key ?? 'report'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {hits === 0 && (
        <p className="mt-8 text-[14px] text-slate-500">
          Nothing matches “{search}”. Try a word from the question, or a report name like{' '}
          <span className="font-mono text-[12.5px]">ar-aging</span>.
        </p>
      )}

      {groups.map((group) => {
        const tone = TONES[group.key]
        return (
          <section key={group.key} className="mt-7">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {group.title}
            </h2>
            <div className="mt-2.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              {group.questions.map((q) => (
                <div
                  key={q.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(q)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      open(q)
                    }
                  }}
                  className="flex cursor-pointer flex-col rounded-[15px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      <ReportIcon name={q.icon} />
                    </span>
                    <h3 className="pt-1.5 text-[15.5px] font-bold leading-snug text-[#0A1220]">
                      {q.question}
                    </h3>
                  </div>
                  <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-slate-600">
                    {q.answer}
                  </p>
                  {/* The report names stay visible: someone who knows them
                      shouldn't have to translate back through a question. */}
                  <div className="mt-3 flex flex-wrap gap-x-1.5 gap-y-1">
                    {[q.report, ...(q.also ?? [])].map((r, i) => (
                      <span key={r} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-[11px] text-slate-300">+</span>}
                        {q.ownOverlay && i === 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenReport(r)
                            }}
                            className="font-mono text-[11.5px] text-slate-400 underline decoration-slate-200 underline-offset-2 hover:text-amber-700 hover:decoration-amber-300"
                          >
                            {r}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenReport(r)
                            }}
                            className="font-mono text-[11.5px] text-slate-400 underline decoration-slate-200 underline-offset-2 hover:text-amber-700 hover:decoration-amber-300"
                          >
                            {r}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {/* The full workspace still exists — every filter and grouping the
          overlay doesn't surface lives there, so it stays one click away. */}
      <p className="mt-8 text-[12.5px] text-slate-500">
        Need the filters?{' '}
        <Link to="/accounting/reports/browse" className="font-semibold text-[#B4762A] hover:underline">
          Open the full reports workspace
        </Link>
      </p>

      {openReport === 'sales-tax' ? (
        <SalesTaxOverlay onClose={() => setOpenReport(null)} />
      ) : (
        openReport && <ReportOverlay reportId={openReport} onClose={() => setOpenReport(null)} />
      )}
    </div>
  )
}
