import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/jobs'
import { findVisible, type TutorialNavigate, type TutorialScript } from '../tutorialScript'

/**
 * The Jobs tutorial: a short film about a job's life, then a walk through the
 * Jobs board, the New Job form, the job page and where jobs connect.
 *
 * Nothing in the walk saves. The job page steps open an existing job just to
 * look (the first one on the board), and the form steps stop before Create.
 */

type SceneId = 'flow' | 'board' | 'create' | 'extras' | 'dispatch' | 'page' | 'closeout' | 'yourturn'

const REVEAL: Record<SceneId, number> = {
  flow: 6, board: 4, create: 4, extras: 5, dispatch: 4, page: 4, closeout: 4, yourturn: 3,
}

const JOB_PAGE = /^\/jobs\/(?!new\/?$)[^/]+\/?$/
const LIST_PAGE = /^\/jobs\/?$/

/**
 * Open a job just for looking: stay put on a job page, otherwise go to the
 * board (with no filters) and open the first job on it. If the board is in
 * Files view, nothing is open to click, so switch it to Cards first.
 */
function openAJob(navigate: TutorialNavigate) {
  if (JOB_PAGE.test(window.location.pathname)) return
  const clickFirst = () => {
    const row = findVisible('[data-tour="jobs-row"]')
    if (!row) return false
    row.click()
    return true
  }
  const onCleanList = LIST_PAGE.test(window.location.pathname) && !window.location.search
  if (onCleanList && clickFirst()) return
  if (!onCleanList) navigate('/jobs')
  let tries = 0
  const timer = window.setInterval(() => {
    tries += 1
    if (clickFirst() || tries > 30 || !LIST_PAGE.test(window.location.pathname)) {
      window.clearInterval(timer)
      return
    }
    if (tries === 8) findVisible('[data-tour="jobs-view-cards"][aria-pressed="false"]')?.click()
  }, 200)
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-jobs-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

function Pill({ tone, children }: { tone: 'amber' | 'sky' | 'green' | 'gray' | 'rose' | 'violet'; children: ReactNode }) {
  return <span className={`t-jobs-pill ${tone}`}>{children}</span>
}

const FLOW: Array<{ icon: string; label: string; tone: 'gray' | 'sky' | 'violet' | 'amber' | 'green' }> = [
  { icon: '📞', label: 'Request', tone: 'gray' },
  { icon: '📝', label: 'Job created', tone: 'sky' },
  { icon: '📅', label: 'Scheduled', tone: 'violet' },
  { icon: '🚐', label: 'On site', tone: 'amber' },
  { icon: '✅', label: 'Complete', tone: 'green' },
  { icon: '💵', label: 'Paid', tone: 'green' },
]

function JobCardMock({ number, title, who, when, tech, total, status, tone, next, paid, lit }: {
  number: string; title: string; who: string; when: string; tech: string; total: string
  status: string; tone: 'amber' | 'sky' | 'green' | 'violet'; next?: string; paid?: boolean; lit?: 'next' | 'stamp'
}) {
  return (
    <div className="t-jobs-card">
      <div className="t-jobs-row-between">
        <span className="t-jobs-mono">{number}</span>
        <span className="t-jobs-row-gap">
          <span className={`t-jobs-stamp ${paid ? 'paid' : ''} ${lit === 'stamp' ? 'lit' : ''}`}>{paid ? 'PAID' : 'UNPAID'}</span>
          <Pill tone={tone}>{status}</Pill>
        </span>
      </div>
      <div className="t-jobs-card-title">{title}</div>
      <div className="t-jobs-muted">{who}</div>
      <div className="t-jobs-card-foot">
        <div className="t-jobs-muted"><div>{when}</div><div>{tech}</div></div>
        <b className="t-jobs-mono dark">{total}</b>
      </div>
      {next && <span className={`t-jobs-next ${lit === 'next' ? 'lit' : ''}`}>→ {next}</span>}
    </div>
  )
}

function JobsFilmVisual({ id, shown }: { id: SceneId; shown: number }) {
  switch (id) {
    case 'flow':
      return (
        <div>
          <div className="t-jobs-flow">
            {FLOW.map((step, k) => (
              <Reveal key={step.label} on={shown >= k + 1} className="t-jobs-flow-step">
                <div className={`t-jobs-flow-dot ${step.tone}`} aria-hidden="true">{step.icon}</div>
                <div className="t-jobs-flow-label">{step.label}</div>
                {k < FLOW.length - 1 && <span className="t-jobs-flow-arrow" aria-hidden="true">→</span>}
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 2}>
            <div className="t-jobs-ticket">
              <span className="t-jobs-mono">#1042</span>
              <b>Water heater check</b>
              <span className="t-jobs-muted">Jordan Lee · 123 Main St, Springfield</span>
            </div>
          </Reveal>
        </div>
      )
    case 'board':
      return (
        <div className="t-jobs-board">
          <Reveal on={shown >= 1}>
            <div className="t-jobs-tabs">
              {[['All', 24], ['Needs scheduling', 3], ['Scheduled', 8], ['On site', 2], ['Complete', 5]].map(([label, n], k) => (
                <span key={label} className={`t-jobs-tab ${k === 0 ? 'on' : ''}`}>{label}<em>{n}</em></span>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-jobs-cards">
              <JobCardMock number="#1042" title="Water heater check" who="Jordan Lee · 123 Main St" when="Tue, May 12, 9:00 AM" tech="No assigned tech" total="$240.00" status="Scheduled" tone="violet" next="Assign tech" lit={shown >= 3 ? 'next' : undefined} />
              <JobCardMock number="#1039" title="Front door repair" who="Pat Morgan · 48 Oak Ave" when="Mon, May 11, 1:30 PM" tech="Sam Rivera" total="$385.50" status="Complete" tone="green" paid lit={shown >= 4 ? 'stamp' : undefined} />
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <p className="t-jobs-note">The chip says what it needs next. The stamp says whether it’s paid.</p>
          </Reveal>
        </div>
      )
    case 'create':
      return (
        <div className="t-jobs-form">
          <Reveal on={shown >= 1}>
            <div className="t-jobs-block">
              <div className="t-jobs-label">Customer &amp; Location</div>
              <div className="t-jobs-input">Jordan Lee</div>
              <div className="t-jobs-loc">📍 123 Main St, Springfield <span className="t-jobs-tag">Primary</span></div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-jobs-block">
              <div className="t-jobs-label">Job Basics</div>
              <div className="t-jobs-input">Water heater check</div>
              <div className="t-jobs-grid3">
                <div className="t-jobs-input small">Plumbing ★</div>
                <div className={`t-jobs-input small ${shown >= 3 ? 'auto' : ''}`}>{shown >= 3 ? 'Scheduled ✓' : 'Status'}</div>
                <div className="t-jobs-input small">Normal</div>
              </div>
              {shown >= 3 && <div className="t-jobs-hint">Status picked for you</div>}
            </div>
          </Reveal>
          <Reveal on={shown >= 4} className="t-jobs-span">
            <div className="t-jobs-block row">
              <div>
                <div className="t-jobs-label">Job schedule</div>
                <div className="t-jobs-input">Today · 10:30 AM to 12:30 PM</div>
              </div>
              <div className="t-jobs-toggle"><span className="on">Scheduled</span><span>Unscheduled</span></div>
              <div>
                <div className="t-jobs-label">Lead tech</div>
                <div className="t-jobs-input">Sam Rivera</div>
              </div>
            </div>
          </Reveal>
        </div>
      )
    case 'extras':
      return (
        <div>
          <div className="t-jobs-tiles">
            {[
              { icon: '🧾', title: 'Line items', line: 'Labor, parts, fees' },
              { icon: '✍️', title: 'Signable document', line: 'Signed before check-in' },
              { icon: '☑️', title: 'Inspection checklist', line: 'Worked on site' },
              { icon: '📄', title: 'Customer’s WO / PO', line: 'Read in by CBI' },
            ].map((tile, k) => (
              <Reveal key={tile.title} on={shown >= k + 1}>
                <div className="t-jobs-tile">
                  <span className="t-jobs-tile-icon" aria-hidden="true">{tile.icon}</span>
                  <b>{tile.title}</b>
                  <span className="t-jobs-muted">{tile.line}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 5}>
            <div className="t-jobs-rules">
              <span className="t-jobs-label">From the customer’s account</span>
              <span className="t-jobs-rule">✓ GPS check-in</span>
              <span className="t-jobs-rule">✓ Signature</span>
              <span className="t-jobs-rule">✓ 2 photos</span>
            </div>
          </Reveal>
        </div>
      )
    case 'dispatch':
      return (
        <div className="t-jobs-dispatch">
          <Reveal on={shown >= 1}>
            <div className="t-jobs-side">
              <div className="t-jobs-label">To Schedule</div>
              <div className={`t-jobs-mini ${shown >= 2 ? 'moving' : ''}`}>Gate repair<span>Lee Park</span></div>
              <div className="t-jobs-mini">Lawn service<span>Pat Morgan</span></div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-jobs-cal">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, k) => (
                <div key={day} className="t-jobs-cal-day">
                  <span>{day}</span>
                  {k === 0 && <div className="t-jobs-cal-ev sky">HVAC tune-up</div>}
                  {k === 2 && shown >= 2 && <div className="t-jobs-cal-ev amber drop">Gate repair</div>}
                  {k === 3 && <div className="t-jobs-cal-ev violet">Water heater</div>}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-jobs-phone">
              <div className="t-jobs-phone-head">Sam’s phone</div>
              {['Start travel', 'Check in', 'Check out'].map((label, k) => (
                <div key={label} className={`t-jobs-phone-btn ${shown >= 4 && k === 1 ? 'lit' : ''}`}>{label}</div>
              ))}
              {shown >= 4 && <div className="t-jobs-phone-status">Job is now <b>On site</b></div>}
            </div>
          </Reveal>
        </div>
      )
    case 'page':
      return (
        <div className="t-jobs-mock">
          <div className="t-jobs-mock-bar"><span /><span /><span /></div>
          <div className="t-jobs-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-jobs-row-between wrap">
                <div>
                  <div className="t-jobs-row-gap"><span className="t-jobs-mono">#1042</span><Pill tone="amber">Scheduled</Pill></div>
                  <div className="t-jobs-page-title">Water heater check</div>
                  <div className="t-jobs-muted">Plumbing · Normal · <span className="t-jobs-auto">● Automations on</span></div>
                </div>
                <Reveal on={shown >= 2}>
                  <div className="t-jobs-row-gap wrap">
                    <span className="t-jobs-btn">💬 Messages</span>
                    <span className="t-jobs-btn amber">Sub this out</span>
                    <span className="t-jobs-btn green">Take down payment</span>
                  </div>
                </Reveal>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-jobs-tabs page">
                {['Overview', 'Field', 'Expense', 'Messages', 'Notes', 'Log'].map((label, k) => (
                  <span key={label} className={`t-jobs-tab ${k === 0 ? 'on' : ''}`}>{label}</span>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-jobs-block">
                <div className="t-jobs-label">Quick edit</div>
                <div className="t-jobs-grid3">
                  <div className="t-jobs-input small">Status: Scheduled</div>
                  <div className="t-jobs-input small">Lead tech: Sam Rivera</div>
                  <div className="t-jobs-input small">Date: May 12</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'closeout':
      return (
        <div>
          <div className="t-jobs-close">
            <Reveal on={shown >= 1}>
              <div className="t-jobs-card">
                <div className="t-jobs-label">Status</div>
                <div className="t-jobs-input auto">Complete ✓</div>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-jobs-invoice">
                <div className="t-jobs-invoice-band">INVOICE #2087</div>
                <div className="t-jobs-invoice-line"><span>Water heater check</span><span>$180.00</span></div>
                <div className="t-jobs-invoice-line"><span>Drain valve</span><span>$60.00</span></div>
                <div className="t-jobs-invoice-line total"><span>Total</span><span>$240.00</span></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-jobs-card">
                <div className="t-jobs-label">Receive payment</div>
                <div className="t-jobs-input">Card · $240.00</div>
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 4}>
            <div className="t-jobs-badges">
              <span className="t-jobs-badge amber">Not invoiced</span>
              <span aria-hidden="true">→</span>
              <span className="t-jobs-badge sky">Invoiced · $240.00 due</span>
              <span aria-hidden="true">→</span>
              <span className="t-jobs-badge green">Paid</span>
            </div>
          </Reveal>
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-jobs-mock">
          <div className="t-jobs-mock-bar"><span /><span /><span /></div>
          <div className="t-jobs-mock-body tall">
            <Reveal on={shown >= 1}>
              <div className="t-jobs-row-between">
                <div className="t-jobs-page-title">Jobs</div>
                <span className={`t-jobs-btn solid ${shown >= 2 ? 'lit' : ''}`}>+ New Job</span>
              </div>
              <div className="t-jobs-mock-grid">
                {['Water heater check', 'Front door repair', 'HVAC tune-up', 'Lawn service'].map((title) => (
                  <div key={title} className="t-jobs-mock-card">{title}</div>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-jobs-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-jobs-dock"><span className="t-jobs-avatar">CB</span> Your turn: click New Job</div>
            </Reveal>
          </div>
        </div>
      )
  }
}

const CSS = `
.t-jobs-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-jobs-in.show { opacity: 1; transform: none; }
.t-jobs-span { grid-column: 1 / -1; }
.t-jobs-muted { font-size: 12px; color: #64748b; }
.t-jobs-mono { font-family: ui-monospace, monospace; font-size: 11px; color: #64748b; }
.t-jobs-mono.dark { color: #0b1324; font-size: 13px; }
.t-jobs-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-jobs-note { margin: 10px 0 0; font-size: 12.5px; color: #4d586b; }
.t-jobs-row-between { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.t-jobs-row-gap { display: inline-flex; align-items: center; gap: 6px; }
.t-jobs-row-between.wrap, .t-jobs-row-gap.wrap { flex-wrap: wrap; }
.t-jobs-pill { display: inline-flex; align-items: center; border-radius: 6px; padding: 2px 8px; font-size: 11.5px; font-weight: 700; }
.t-jobs-pill.amber { background: #fef3c7; color: #92400e; }
.t-jobs-pill.sky { background: #e0f2fe; color: #075985; }
.t-jobs-pill.green { background: #d1fae5; color: #065f46; }
.t-jobs-pill.gray { background: #f1f5f9; color: #475569; }
.t-jobs-pill.rose { background: #ffe4e6; color: #9f1239; }
.t-jobs-pill.violet { background: #ede9fe; color: #5b21b6; }

.t-jobs-flow { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 8px; align-items: start; }
.t-jobs-flow-step { position: relative; display: grid; justify-items: center; gap: 6px; text-align: center; }
.t-jobs-flow-dot { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; font-size: 24px; border: 2px solid; background: #fff; box-shadow: 0 8px 18px rgba(11,19,36,.08); }
.t-jobs-flow-dot.gray { border-color: #cbd5e1; } .t-jobs-flow-dot.sky { border-color: #7dd3fc; }
.t-jobs-flow-dot.violet { border-color: #c4b5fd; } .t-jobs-flow-dot.amber { border-color: #fbbf24; }
.t-jobs-flow-dot.green { border-color: #6ee7b7; }
.t-jobs-flow-label { font-size: 12.5px; font-weight: 800; color: #0b1324; }
.t-jobs-flow-arrow { position: absolute; right: -9px; top: 16px; color: #94a3b8; font-weight: 900; }
.t-jobs-ticket { margin: 22px auto 0; max-width: 420px; display: grid; gap: 2px; background: #fff; border: 1px solid #e3e7ee; border-left: 4px solid #f59e0b; border-radius: 12px; padding: 10px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); font-size: 14px; color: #0b1324; }

.t-jobs-board { display: grid; gap: 10px; }
.t-jobs-tabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 1px solid #e2e8f0; }
.t-jobs-tabs.page { margin-top: 12px; }
.t-jobs-tab { padding: 6px 10px; font-size: 12.5px; font-weight: 700; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.t-jobs-tab.on { color: #0b1324; border-color: #f59e0b; }
.t-jobs-tab em { font-style: normal; margin-left: 5px; color: #94a3b8; font-weight: 600; }
.t-jobs-cards { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.t-jobs-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 4px; align-content: start; }
.t-jobs-card-title { font-weight: 800; color: #0b1324; font-size: 14px; }
.t-jobs-card-foot { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #f1f5f9; padding-top: 8px; margin-top: 4px; }
.t-jobs-stamp { border: 2px solid #e11d48; color: #be123c; background: #fff1f2; font-size: 10px; font-weight: 900; border-radius: 3px; padding: 1px 6px; transition: box-shadow .35s; }
.t-jobs-stamp.paid { border-color: #059669; color: #047857; background: #ecfdf5; }
.t-jobs-stamp.lit { box-shadow: 0 0 0 4px #fde68a; }
.t-jobs-next { justify-self: start; margin-top: 4px; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 2px 7px; transition: box-shadow .35s; }
.t-jobs-next.lit { box-shadow: 0 0 0 4px #fde68a; }

.t-jobs-form { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; }
.t-jobs-block { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 12px; display: grid; gap: 8px; box-shadow: 0 6px 16px rgba(11,19,36,.05); }
.t-jobs-block.row { grid-template-columns: minmax(0,1.3fr) auto minmax(0,1fr); align-items: end; }
.t-jobs-input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 10px; font-size: 13px; color: #0b1324; background: #fff; transition: all .35s; }
.t-jobs-input.small { font-size: 12px; padding: 6px 8px; }
.t-jobs-input.auto { border-color: #34d399; background: #ecfdf5; color: #065f46; font-weight: 700; }
.t-jobs-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px; }
.t-jobs-hint { font-size: 11.5px; color: #047857; font-weight: 700; }
.t-jobs-loc { font-size: 12.5px; color: #334155; display: flex; align-items: center; gap: 6px; }
.t-jobs-tag { font-size: 10.5px; background: #f1f5f9; border-radius: 5px; padding: 1px 6px; color: #475569; }
.t-jobs-toggle { display: inline-flex; border: 1px solid #cbd5e1; background: #f1f5f9; border-radius: 9px; padding: 3px; font-size: 12px; font-weight: 700; }
.t-jobs-toggle span { padding: 4px 9px; border-radius: 6px; color: #64748b; }
.t-jobs-toggle span.on { background: #fff; color: #b45309; box-shadow: 0 1px 3px rgba(0,0,0,.08); }

.t-jobs-tiles { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
.t-jobs-tile { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 12px; display: grid; gap: 4px; font-size: 13px; color: #0b1324; box-shadow: 0 6px 16px rgba(11,19,36,.05); }
.t-jobs-tile-icon { font-size: 22px; }
.t-jobs-rules { margin-top: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 10px 12px; }
.t-jobs-rule { font-size: 12.5px; font-weight: 800; color: #065f46; background: #fff; border-radius: 99px; padding: 3px 10px; }

.t-jobs-dispatch { display: grid; grid-template-columns: 170px minmax(0,1fr) 170px; gap: 12px; align-items: start; }
.t-jobs-side { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px; display: grid; gap: 6px; }
.t-jobs-mini { border: 1px solid #e2e8f0; border-radius: 9px; padding: 6px 8px; font-size: 12px; font-weight: 700; color: #0b1324; display: grid; transition: all .4s; }
.t-jobs-mini span { font-weight: 500; color: #64748b; font-size: 11px; }
.t-jobs-mini.moving { opacity: .4; border-style: dashed; }
.t-jobs-cal { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 4px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 8px; min-height: 160px; }
.t-jobs-cal-day { border-left: 1px solid #f1f5f9; padding: 2px 4px; display: grid; align-content: start; gap: 4px; font-size: 11px; color: #64748b; font-weight: 700; }
.t-jobs-cal-ev { border-radius: 6px; padding: 4px 5px; font-size: 10.5px; font-weight: 800; color: #0b1324; }
.t-jobs-cal-ev.sky { background: #e0f2fe; } .t-jobs-cal-ev.amber { background: #fde68a; } .t-jobs-cal-ev.violet { background: #ede9fe; }
.t-jobs-cal-ev.drop { animation: t-jobs-drop .6s cubic-bezier(.2,.9,.3,1.2) both; box-shadow: 0 0 0 3px #fbbf24; }
.t-jobs-phone { background: #0b1324; color: #fff; border-radius: 22px; padding: 12px 10px; display: grid; gap: 6px; box-shadow: 0 10px 24px rgba(11,19,36,.25); }
.t-jobs-phone-head { font-size: 11px; font-weight: 800; color: #fde68a; text-align: center; }
.t-jobs-phone-btn { border: 1px solid rgba(255,255,255,.2); border-radius: 10px; padding: 7px; font-size: 12px; font-weight: 700; text-align: center; transition: all .35s; }
.t-jobs-phone-btn.lit { background: #f59e0b; color: #0b1324; border-color: #f59e0b; }
.t-jobs-phone-status { font-size: 11.5px; text-align: center; color: #cbd5e1; animation: t-jobs-fade .4s ease both; }
.t-jobs-phone-status b { color: #6ee7b7; }

.t-jobs-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 680px; margin: 0 auto; }
.t-jobs-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-jobs-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-jobs-mock-body { position: relative; padding: 14px; }
.t-jobs-mock-body.tall { min-height: 210px; }
.t-jobs-page-title { font-weight: 900; font-size: 17px; color: #0b1324; margin: 2px 0; }
.t-jobs-auto { color: #047857; font-weight: 700; }
.t-jobs-btn { display: inline-block; border: 1px solid #cbd5e1; border-radius: 8px; padding: 5px 9px; font-size: 12px; font-weight: 700; color: #334155; background: #fff; transition: all .35s; }
.t-jobs-btn.amber { border-color: #fbbf24; color: #92400e; }
.t-jobs-btn.green { border-color: #059669; background: #059669; color: #fff; }
.t-jobs-btn.solid { background: #d97706; border-color: #d97706; color: #fff; }
.t-jobs-btn.lit { box-shadow: 0 0 0 4px rgba(251,191,36,.45); }
.t-jobs-mock-grid { margin-top: 10px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
.t-jobs-mock-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12.5px; font-weight: 700; color: #0b1324; }
.t-jobs-pointer { position: absolute; right: 18%; top: 22%; font-size: 26px; animation: t-jobs-tap 1.4s ease-in-out infinite; }
.t-jobs-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-jobs-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.t-jobs-avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }

.t-jobs-close { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr); gap: 12px; align-items: center; }
.t-jobs-invoice { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 18px rgba(11,19,36,.08); padding-bottom: 8px; display: grid; gap: 4px; }
.t-jobs-invoice-band { background: #0b1324; color: #fde68a; font-size: 11px; font-weight: 900; letter-spacing: .1em; padding: 6px 10px; }
.t-jobs-invoice-line { display: flex; justify-content: space-between; padding: 0 10px; font-size: 12px; color: #334155; }
.t-jobs-invoice-line.total { border-top: 1px solid #e2e8f0; padding-top: 4px; font-weight: 800; color: #0b1324; }
.t-jobs-badges { margin-top: 16px; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; color: #94a3b8; font-weight: 900; }
.t-jobs-badge { border: 1px solid; border-radius: 99px; padding: 4px 11px; font-size: 12.5px; font-weight: 800; }
.t-jobs-badge.amber { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
.t-jobs-badge.sky { background: #f0f9ff; color: #075985; border-color: #7dd3fc; }
.t-jobs-badge.green { background: #ecfdf5; color: #065f46; border-color: #6ee7b7; }

@keyframes t-jobs-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(12px, -14px) scale(.92); } }
@keyframes t-jobs-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes t-jobs-drop { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: none; } }
@keyframes t-jobs-fade { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 760px) {
  .t-jobs-flow { grid-template-columns: repeat(3, minmax(0,1fr)); row-gap: 14px; }
  .t-jobs-flow-arrow { display: none; }
  .t-jobs-cards, .t-jobs-form, .t-jobs-close, .t-jobs-dispatch { grid-template-columns: minmax(0,1fr); }
  .t-jobs-block.row { grid-template-columns: minmax(0,1fr); }
  .t-jobs-tiles { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .t-jobs-in, .t-jobs-in.show, .t-jobs-cal-ev.drop, .t-jobs-pointer, .t-jobs-dock, .t-jobs-phone-status,
  .t-jobs-stamp, .t-jobs-next, .t-jobs-input, .t-jobs-mini, .t-jobs-phone-btn, .t-jobs-btn { animation: none !important; transition: none !important; }
}
`

export const jobsScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <JobsFilmVisual id={id as SceneId} shown={shown} />,
  css: CSS,
  actions: {
    'job:open': openAJob,
  },
}
