import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/estimates'
import { findVisible, type TutorialNavigate, type TutorialScript } from '../tutorialScript'

/**
 * The Estimates tutorial: drawn film scenes, plus two ways to land on a real
 * estimate for looking (never changing): the first one on the list, or the
 * first approved one for the convert part.
 */

const REVEAL: Record<string, number> = {
  journey: 4, build: 4, visit: 3, send: 4, follow: 4, convert: 3, where: 5, yourturn: 3,
}

const ROW = '[data-tour="estimates-row"]'
const APPROVED_ROW = '[data-tour="estimates-row"][data-estimate-status="approved"]'
const APPROVED_TAB = '[data-tour="estimates-tabs"] button:nth-child(4)'

/** Go to the list (if needed) and open an estimate from it, just to look. */
function openEstimate(navigate: TutorialNavigate, approvedOnly: boolean) {
  const path = window.location.pathname.replace(/\/$/, '')
  if (path !== '/estimates') navigate('/estimates')
  const started = Date.now()
  let filtered = false
  const tryOpen = () => {
    const row = findVisible(approvedOnly ? APPROVED_ROW : ROW)
    if (row) { row.click(); return }
    // No approved one on this page: show just the approved ones.
    if (approvedOnly && !filtered && Date.now() - started > 1200) {
      const approvedTab = findVisible(APPROVED_TAB)
      if (approvedTab) { approvedTab.click(); filtered = true }
    }
    if (Date.now() - started < 5000) window.setTimeout(tryOpen, 200)
  }
  window.setTimeout(tryOpen, 250)
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-estimates-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

function Status({ kind, children }: { kind: 'draft' | 'sent' | 'approved' | 'job' | 'expired'; children: ReactNode }) {
  return <span className={`t-estimates-status ${kind}`}>{children}</span>
}

function EstimatesFilmVisual({ id, shown }: { id: string; shown: number }) {
  switch (id) {
    case 'journey':
      return (
        <div className="t-estimates-road">
          {[
            { kind: 'draft' as const, label: 'Draft', line: 'You write it' },
            { kind: 'sent' as const, label: 'Sent', line: 'Waiting on them' },
            { kind: 'approved' as const, label: 'Approved', line: 'They said yes' },
            { kind: 'job' as const, label: 'Job', line: 'Booked and done' },
          ].map((stop, k) => (
            <Reveal key={stop.label} on={shown >= k + 1} className="t-estimates-stop-wrap">
              <div className="t-estimates-stop">
                <Status kind={stop.kind}>{stop.label}</Status>
                <span className="t-estimates-note">{stop.line}</span>
              </div>
              {k < 3 && <span className="t-estimates-arrow" aria-hidden="true">→</span>}
            </Reveal>
          ))}
        </div>
      )
    case 'build':
      return (
        <div className="t-estimates-sheet">
          <Reveal on={shown >= 1}>
            <div className="t-estimates-sheet-head">
              <div>
                <div className="t-estimates-label">Estimate · Draft</div>
                <b>Water heater replacement</b>
                <div className="t-estimates-note">Jordan Lee · 123 Main St, Springfield</div>
              </div>
              <Status kind="draft">Draft</Status>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-estimates-line"><span>50 gal water heater</span><em>Product</em><span>1 × $1,150.00</span><b>$1,150.00</b></div>
            <div className="t-estimates-line"><span>Install and haul away</span><em>Service</em><span>1 × $420.00</span><b>$420.00</b></div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-estimates-line"><span>Trip charge</span><em>Fee</em><span>1 × $59.00</span><b>$59.00</b></div>
            <div className="t-estimates-line discount"><span>Spring discount</span><em>10%</em><span /><b>−$162.90</b></div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-estimates-totals">
              <span>Subtotal <b>$1,629.00</b></span>
              <span>Discount <b>−$162.90</b></span>
              <span>Tax <b>$95.30</b></span>
              <span className="grand">Total <b>$1,561.40</b></span>
            </div>
          </Reveal>
        </div>
      )
    case 'visit':
      return (
        <div className="t-estimates-split">
          <Reveal on={shown >= 1}>
            <div className="t-estimates-card">
              <div className="t-estimates-label">📞 Phone quote</div>
              <b>Lawn service, every two weeks</b>
              <div className="t-estimates-pill off">Unscheduled</div>
              <div className="t-estimates-note">Price it while they’re on the line.</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-estimates-card">
              <div className="t-estimates-label">🔎 Walkthrough first</div>
              <b>Back door repair</b>
              <div className="t-estimates-pill on">Tue · 9:00–11:00 AM</div>
              <div className="t-estimates-note">A two-hour window to start, changed any time.</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3} className="t-estimates-span">
            <div className="t-estimates-board">
              <span className="t-estimates-board-day">Tuesday</span>
              <span className="t-estimates-board-job">HVAC tune-up · Sam</span>
              <span className="t-estimates-board-job assess">Assessment · Back door repair</span>
              <span className="t-estimates-board-job">Water heater · Alex</span>
            </div>
          </Reveal>
        </div>
      )
    case 'send':
      return (
        <div className="t-estimates-flow">
          <Reveal on={shown >= 1}>
            <div className="t-estimates-bubble">Your estimate EST-1042 for $1,561.40 is ready to review. Review and respond: <u>portal link</u></div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-estimates-portal">
              <div className="t-estimates-label">Customer portal</div>
              <b>Water heater replacement</b>
              <div className="t-estimates-note">3 lines · Total $1,561.40</div>
              <div className="t-estimates-sign">✍ Jordan Lee</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-estimates-approve">Approve</div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-estimates-card center">
              <Status kind="approved">Approved ✓</Status>
              <span className="t-estimates-note">Shows up on your side right away</span>
            </div>
          </Reveal>
        </div>
      )
    case 'follow':
      return (
        <div className="t-estimates-split">
          <div className="t-estimates-stack">
            {[
              { kind: 'draft' as const, label: 'Draft', title: 'Gutter cleaning', next: 'Send', tone: 'sky' },
              { kind: 'sent' as const, label: 'Sent', title: 'Furnace replacement', next: 'Follow up', tone: 'amber' },
              { kind: 'approved' as const, label: 'Approved', title: 'Garage door springs', next: 'Convert', tone: 'emerald' },
            ].map((row, k) => (
              <Reveal key={row.title} on={shown >= k + 1}>
                <div className="t-estimates-row">
                  <Status kind={row.kind}>{row.label}</Status>
                  <span className="t-estimates-row-title">{row.title}</span>
                  <span className={`t-estimates-next ${row.tone}`}>→ {row.next}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 4}>
            <div className="t-estimates-tiles">
              <div className="t-estimates-tile dormant"><span>Dormant</span><b>2</b><small>Sent, no answer, untouched 14+ days</small></div>
              <div className="t-estimates-tile"><span>Expired</span><b>1</b><small>Closed on its own after the date</small></div>
              <div className="t-estimates-tile requote"><span>🔁 Re-quote</span><small>Same lines, fresh draft</small></div>
            </div>
          </Reveal>
        </div>
      )
    case 'convert':
      return (
        <div className="t-estimates-convert">
          <Reveal on={shown >= 1}>
            <div className="t-estimates-card">
              <Status kind="approved">Approved</Status>
              <b>Garage door springs</b>
              <div className="t-estimates-note">2 lines · $640.00</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2} className="t-estimates-convert-mid">
            <span className="t-estimates-arrow big" aria-hidden="true">→</span>
            <span className="t-estimates-pill on">Convert to Job</span>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-estimates-card">
              <Status kind="job">Job #2318</Status>
              <b>Garage door springs</b>
              <div className="t-estimates-note">Thu 8–10 AM · Lead tech Sam</div>
              <div className="t-estimates-note">Lines copied over</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3} className="t-estimates-span">
            <div className="t-estimates-invoice">🧾 Then you invoice the job, like any other</div>
          </Reveal>
        </div>
      )
    case 'where':
      return (
        <div className="t-estimates-hub">
          <Reveal on={shown >= 1} className="t-estimates-hub-center">
            <div className="t-estimates-hub-core">🧮 Estimates</div>
          </Reveal>
          {[
            { icon: '📅', title: 'Schedule', line: 'Pending approval, walkthroughs to book' },
            { icon: '🗺', title: 'Dispatch board', line: 'Walkthroughs show as Assessments' },
            { icon: '👤', title: 'A customer’s account', line: 'Their Estimates tab, + New Estimate' },
            { icon: '🛒', title: 'Orders and requests', line: 'Portal orders, marketplace requests' },
          ].map((spot, k) => (
            <Reveal key={spot.title} on={shown >= k + 2}>
              <div className="t-estimates-card">
                <b>{spot.icon} {spot.title}</b>
                <div className="t-estimates-note">{spot.line}</div>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-estimates-mock">
          <div className="t-estimates-mock-bar"><span /><span /><span /></div>
          <div className="t-estimates-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-estimates-mock-head">Estimates <span className={`t-estimates-mock-new ${shown >= 2 ? 'lit' : ''}`}>+ New</span></div>
              <div className="t-estimates-mock-grid">
                {['Draft · Gutter cleaning', 'Sent · Furnace replacement', 'Approved · Garage door springs', 'Expired · Lawn service'].map((m) => (
                  <div key={m} className="t-estimates-mock-card">{m}</div>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-estimates-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-estimates-mini-dock"><span className="t-estimates-avatar">CB</span> Your turn: click New</div>
            </Reveal>
          </div>
        </div>
      )
    default:
      return null
  }
}

const CSS = `
.t-estimates-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-estimates-in.show { opacity: 1; transform: none; }
.t-estimates-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-estimates-note { font-size: 12.5px; color: #4d586b; }
.t-estimates-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 7px; align-content: start; font-size: 13.5px; color: #0b1324; }
.t-estimates-card.center { justify-items: center; text-align: center; }
.t-estimates-status { display: inline-flex; width: fit-content; align-items: center; border-radius: 8px; padding: 4px 10px; font-size: 12.5px; font-weight: 800; border: 1px solid; }
.t-estimates-status.draft { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
.t-estimates-status.sent { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
.t-estimates-status.approved { background: #d1fae5; color: #065f46; border-color: #6ee7b7; }
.t-estimates-status.job { background: #0b1324; color: #fde68a; border-color: #0b1324; }
.t-estimates-status.expired { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
.t-estimates-road { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; align-items: center; }
.t-estimates-stop-wrap { display: flex; align-items: center; gap: 8px; }
.t-estimates-stop { flex: 1; background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 16px 12px; display: grid; gap: 8px; justify-items: center; text-align: center; box-shadow: 0 8px 20px rgba(11,19,36,.06); }
.t-estimates-arrow { font-size: 20px; font-weight: 900; color: #f59e0b; }
.t-estimates-arrow.big { font-size: 30px; }
.t-estimates-sheet { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 14px; display: grid; gap: 8px; max-width: 680px; box-shadow: 0 8px 20px rgba(11,19,36,.06); }
.t-estimates-sheet-head { display: flex; justify-content: space-between; align-items: start; gap: 10px; font-size: 15px; color: #0b1324; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; }
.t-estimates-line { display: grid; grid-template-columns: minmax(0,2.2fr) 70px minmax(0,1.2fr) 90px; gap: 8px; align-items: center; font-size: 12.5px; color: #0b1324; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 9px; margin-top: 6px; }
.t-estimates-line em { font-style: normal; font-size: 11px; font-weight: 700; color: #64748b; background: #f1f5f9; border-radius: 6px; padding: 2px 6px; text-align: center; }
.t-estimates-line b { text-align: right; font-variant-numeric: tabular-nums; }
.t-estimates-line.discount { border-color: #fecdd3; background: #fff1f2; color: #be123c; }
.t-estimates-totals { display: grid; justify-items: end; gap: 3px; font-size: 13px; color: #475569; padding-top: 6px; border-top: 1px solid #e2e8f0; }
.t-estimates-totals b { display: inline-block; min-width: 90px; text-align: right; color: #0b1324; font-variant-numeric: tabular-nums; }
.t-estimates-totals .grand { font-size: 15px; font-weight: 800; color: #0b1324; }
.t-estimates-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 14px; align-items: start; }
.t-estimates-span { grid-column: 1 / -1; }
.t-estimates-pill { width: fit-content; font-size: 12px; font-weight: 800; border-radius: 99px; padding: 4px 10px; border: 1px solid; }
.t-estimates-pill.on { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
.t-estimates-pill.off { background: #f8fafc; border-color: #cbd5e1; color: #475569; border-style: dashed; }
.t-estimates-board { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; background: #0b1324; border-radius: 12px; padding: 10px 12px; }
.t-estimates-board-day { color: #fde68a; font-weight: 900; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; margin-right: 4px; }
.t-estimates-board-job { font-size: 12px; font-weight: 700; color: #e2e8f0; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 5px 9px; }
.t-estimates-board-job.assess { background: #e0f2fe; color: #075985; border-color: #7dd3fc; }
.t-estimates-flow { display: grid; grid-template-columns: minmax(0,1.3fr) minmax(0,1.2fr) auto minmax(0,1fr); gap: 12px; align-items: center; }
.t-estimates-bubble { background: #e5e7eb; color: #0f172a; font-size: 13px; line-height: 1.45; border-radius: 18px 18px 18px 6px; padding: 10px 12px; }
.t-estimates-bubble u { color: #1d4ed8; }
.t-estimates-portal { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; display: grid; gap: 6px; font-size: 13.5px; color: #0b1324; box-shadow: 0 6px 16px rgba(11,19,36,.08); }
.t-estimates-sign { border-top: 1.5px solid #0b1324; padding-top: 3px; font-size: 12px; color: #334155; font-style: italic; width: 75%; }
.t-estimates-approve { background: #059669; color: #fff; font-weight: 900; font-size: 14px; border-radius: 10px; padding: 10px 16px; box-shadow: 0 0 0 4px #d1fae5; }
.t-estimates-stack { display: grid; gap: 8px; }
.t-estimates-row { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 9px 11px; font-size: 13px; }
.t-estimates-row-title { flex: 1; min-width: 0; font-weight: 700; color: #0b1324; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-estimates-next { font-size: 11px; font-weight: 800; border-radius: 6px; padding: 3px 7px; white-space: nowrap; }
.t-estimates-next.sky { background: #e0f2fe; color: #0369a1; }
.t-estimates-next.amber { background: #fef3c7; color: #92400e; }
.t-estimates-next.emerald { background: #d1fae5; color: #047857; }
.t-estimates-tiles { display: grid; gap: 8px; }
.t-estimates-tile { display: grid; gap: 2px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 9px 12px; font-size: 12px; color: #475569; }
.t-estimates-tile span { font-weight: 800; color: #0b1324; font-size: 12.5px; }
.t-estimates-tile b { font-size: 20px; color: #0b1324; }
.t-estimates-tile.dormant { border-color: #fcd34d; background: #fffbeb; }
.t-estimates-tile.requote { border-style: dashed; }
.t-estimates-convert { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); gap: 14px; align-items: center; }
.t-estimates-convert-mid { display: grid; justify-items: center; gap: 6px; }
.t-estimates-invoice { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-weight: 800; font-size: 13.5px; border-radius: 12px; padding: 10px 14px; text-align: center; }
.t-estimates-hub { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.t-estimates-hub-center { grid-column: 1 / -1; display: flex; justify-content: center; }
.t-estimates-hub-core { background: #0b1324; color: #fde68a; font-weight: 900; font-size: 15px; border-radius: 999px; padding: 10px 18px; box-shadow: 0 10px 24px rgba(11,19,36,.25); }
.t-estimates-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-estimates-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-estimates-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-estimates-mock-body { position: relative; padding: 14px; min-height: 210px; }
.t-estimates-mock-head { display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 10px; }
.t-estimates-mock-new { font-size: 12px; font-weight: 800; color: #fff; background: #d97706; border-radius: 8px; padding: 5px 10px; transition: box-shadow .4s; }
.t-estimates-mock-new.lit { box-shadow: 0 0 0 4px rgba(251,191,36,.45); }
.t-estimates-mock-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
.t-estimates-mock-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12.5px; font-weight: 700; color: #0b1324; }
.t-estimates-pointer { position: absolute; right: 18px; top: 34px; font-size: 26px; animation: t-estimates-tap 1.4s ease-in-out infinite; }
.t-estimates-mini-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-estimates-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.t-estimates-avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }
@keyframes t-estimates-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-10px, -8px) scale(.92); } }
@keyframes t-estimates-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@media (max-width: 760px) {
  .t-estimates-road { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .t-estimates-split, .t-estimates-flow, .t-estimates-convert, .t-estimates-hub { grid-template-columns: minmax(0,1fr); }
  .t-estimates-line { grid-template-columns: minmax(0,1fr) auto; }
  .t-estimates-line > :nth-child(2), .t-estimates-line > :nth-child(3) { display: none; }
  .t-estimates-arrow { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .t-estimates-in, .t-estimates-pointer, .t-estimates-mini-dock, .t-estimates-mock-new { animation: none !important; transition: none !important; }
}
`

export const estimatesScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <EstimatesFilmVisual id={id} shown={shown} />,
  css: CSS,
  actions: {
    'estimate:first': (navigate) => openEstimate(navigate, false),
    'estimate:approved': (navigate) => openEstimate(navigate, true),
  },
}
