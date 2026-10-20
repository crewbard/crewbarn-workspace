import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/contracts'
import { findVisible, type TutorialNavigate, type TutorialScript } from '../tutorialScript'

/**
 * Service agreements tutorial: the film's drawings, and one action of its
 * own. Examples are generic so they fit any trade.
 */

type SceneId = 'idea' | 'services' | 'year' | 'money' | 'sign' | 'running' | 'where' | 'yourturn'

const REVEAL: Record<SceneId, number> = {
  idea: 4, services: 3, year: 4, money: 4, sign: 4, running: 4, where: 7, yourturn: 3,
}

/**
 * Opens the first agreement on the list, just for looking. From another
 * page it goes to the list first and waits for the cards to load.
 */
function openFirstContract(navigate: TutorialNavigate) {
  const onList = /^\/maintenance-contracts\/?$/.test(window.location.pathname)
  if (!onList) navigate('/maintenance-contracts')
  const end = Date.now() + 5000
  const attempt = () => {
    const tab = findVisible('[data-tour="contracts-tab-agreements"]')
    if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click()
    const row = findVisible('[data-tour="contracts-row"]')
    if (row) { row.click(); return }
    if (Date.now() < end) window.setTimeout(attempt, 200)
  }
  window.setTimeout(attempt, onList ? 0 : 300)
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-contracts-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function Visual({ id, shown }: { id: string; shown: number }) {
  switch (id as SceneId) {
    case 'idea':
      return (
        <div className="t-contracts-flow">
          <Reveal on={shown >= 1}>
            <div className="t-contracts-card">
              <div className="t-contracts-label">Service agreement</div>
              <div className="t-contracts-big">Quarterly service plan</div>
              <div className="t-contracts-muted">Jordan Lee · 123 Main St, Springfield</div>
              <div className="t-contracts-row"><span>HVAC tune-up</span><b>Every 3 months</b></div>
              <div className="t-contracts-fee">$120.00 <span>every month</span></div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2} className="t-contracts-arrow"><span aria-hidden="true">→</span></Reveal>
          <div className="t-contracts-stack">
            <Reveal on={shown >= 2}><div className="t-contracts-out"><span>📅</span> Visit dates placed</div></Reveal>
            <Reveal on={shown >= 3}><div className="t-contracts-out"><span>🧰</span> Each visit becomes a job</div></Reveal>
            <Reveal on={shown >= 4}><div className="t-contracts-out"><span>🧾</span> An invoice every period</div></Reveal>
          </div>
        </div>
      )
    case 'services':
      return (
        <div className="t-contracts-col">
          <Reveal on={shown >= 1}>
            <div className="t-contracts-banner">Acme Services · one agreement for Jordan Lee</div>
          </Reveal>
          <div className="t-contracts-split">
            <Reveal on={shown >= 2}>
              <div className="t-contracts-card">
                <div className="t-contracts-label">Service 1</div>
                <div className="t-contracts-big">HVAC tune-up</div>
                <div className="t-contracts-muted">Books: Maintenance visit</div>
                <div className="t-contracts-pill">Normally · Every 3 months (quarterly)</div>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-contracts-card">
                <div className="t-contracts-label">Service 2</div>
                <div className="t-contracts-big">Lawn service</div>
                <div className="t-contracts-muted">Books: Lawn visit</div>
                <div className="t-contracts-pill">Normally · Every week</div>
                <div className="t-contracts-pill season">But from Nov to Mar · Every 2 weeks</div>
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 3}>
            <p className="t-contracts-so"><b>So:</b> Lawn service — every 2 weeks from November to March, and every week the rest of the year.</p>
          </Reveal>
        </div>
      )
    case 'year': {
      // Lawn service: weekly April to October, every two weeks November to March.
      const weekly = [3, 4, 5, 6, 7, 8, 9]
      return (
        <div className="t-contracts-col">
          <Reveal on={shown >= 1}>
            <div className="t-contracts-months">
              <span className="t-contracts-rowname" />
              {MONTHS.map((m, k) => <span key={k} className="t-contracts-month">{m}</span>)}
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-contracts-months">
              <span className="t-contracts-rowname">Every week</span>
              {MONTHS.map((_, k) => <span key={k} className={`t-contracts-cell ${weekly.includes(k) ? 'a' : ''}`} />)}
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-contracts-months">
              <span className="t-contracts-rowname">Every 2 weeks</span>
              {MONTHS.map((_, k) => <span key={k} className={`t-contracts-cell ${!weekly.includes(k) ? 'b' : ''}`} />)}
            </div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-contracts-check">✓ Every month is covered. No gaps, no overlaps.</div>
          </Reveal>
        </div>
      )
    }
    case 'money':
      return (
        <div className="t-contracts-split">
          <div className="t-contracts-col">
            <Reveal on={shown >= 1}>
              <div className="t-contracts-card">
                <div className="t-contracts-label">Fee</div>
                <div className="t-contracts-fee">$120.00 <span>billed every month</span></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-contracts-note">The visits are covered by the fee. They’re never invoiced one by one.</div>
            </Reveal>
          </div>
          <Reveal on={shown >= 3}>
            <div className="t-contracts-card">
              <div className="t-contracts-label">What Jordan Lee agrees to</div>
              <div className="t-contracts-tiles">
                <div><b>4</b><span>jobs in the first year</span></div>
                <div><b>$1,440.00</b><span>billed in the first year</span></div>
              </div>
              {shown >= 4 && (
                <div className="t-contracts-visits">
                  <div className="t-contracts-label">First visits</div>
                  {[['3 Feb', 'HVAC tune-up'], ['3 May', 'HVAC tune-up'], ['3 Aug', 'HVAC tune-up']].map(([d, s]) => (
                    <div key={d} className="t-contracts-visit"><b>{d}</b><span>{s}</span></div>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </div>
      )
    case 'sign':
      return (
        <div className="t-contracts-col">
          <div className="t-contracts-steps">
            {[
              { label: 'Not started', tone: 'grey' },
              { label: 'Waiting to be signed', tone: 'amber' },
              { label: 'Running', tone: 'green' },
            ].map((s, k) => (
              <Reveal key={s.label} on={shown >= k + 1} className="t-contracts-stepwrap">
                <span className={`t-contracts-status ${s.tone}`}>{s.label}</span>
                {k < 2 && <span className="t-contracts-chev" aria-hidden="true">→</span>}
              </Reveal>
            ))}
          </div>
          <div className="t-contracts-split">
            <Reveal on={shown >= 2}>
              <div className="t-contracts-page">
                <div className="t-contracts-band">SERVICE AGREEMENT</div>
                <div className="t-contracts-line w90" /><div className="t-contracts-line w70" /><div className="t-contracts-line w80" />
                <div className="t-contracts-sign">✍ Jordan Lee</div>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-contracts-card">
                <div className="t-contracts-out"><span>✉</span> Send to sign: a link by email</div>
                <div className="t-contracts-out"><span>🖊</span> They signed on paper</div>
                <div className="t-contracts-muted">Either way, it starts running and places its visits.</div>
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'running':
      return (
        <div className="t-contracts-timeline">
          <Reveal on={shown >= 1}>
            <div className="t-contracts-tl"><span className="t-contracts-dot">1</span><div><b>Visit dates placed</b><div className="t-contracts-muted">Feb 3 · May 3 · Aug 3 · Nov 3</div></div></div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-contracts-tl"><span className="t-contracts-dot">2</span><div><b>14 days before each one</b><div className="t-contracts-muted">It goes on the board as a job</div></div></div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-contracts-job">
              <div className="t-contracts-label">Job · HVAC tune-up</div>
              <div className="t-contracts-covered">Covered by Quarterly service plan</div>
              <div className="t-contracts-muted">The fee already pays for this visit.</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-contracts-tl"><span className="t-contracts-dot">3</span><div><b>Each billing period</b><div className="t-contracts-muted">One invoice for the fee: $120.00</div></div></div>
          </Reveal>
        </div>
      )
    case 'where':
      return (
        <div className="t-contracts-hub">
          <Reveal on={shown >= 1} className="t-contracts-hub-center">
            <div className="t-contracts-core">📋 Service agreements</div>
          </Reveal>
          {[
            { icon: '🧰', title: 'Jobs board', line: 'Each visit, as a real job' },
            { icon: '✅', title: 'The job itself', line: 'Covered by, so nobody collects twice' },
            { icon: '🧾', title: 'Invoices', line: 'One per billing period' },
            { icon: '🏠', title: 'The customer’s record', line: 'Start one from a property' },
            { icon: '⏰', title: 'Renewal reminders', line: 'To whoever looks after it' },
            { icon: '🙋', title: 'Plan requests', line: 'Customers ask from their portal' },
          ].map((spot, k) => (
            <Reveal key={spot.title} on={shown >= k + 2}>
              <div className="t-contracts-card">
                <div className="t-contracts-spot">{spot.icon} {spot.title}</div>
                <div className="t-contracts-muted">{spot.line}</div>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-contracts-mock">
          <div className="t-contracts-mock-bar"><span /><span /><span /></div>
          <div className="t-contracts-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-contracts-mock-head">
                <span>Service agreements</span>
                <span className={`t-contracts-mock-new ${shown >= 2 ? 'lit' : ''}`}>+ New service agreement</span>
              </div>
              <div className="t-contracts-mock-grid">
                {['Quarterly service plan', 'Weekly lawn care', 'Annual water heater check', 'Door repair plan'].map((m) => (
                  <div key={m} className="t-contracts-mock-card">{m}</div>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-contracts-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-contracts-dock"><span className="t-contracts-avatar">CB</span> Your turn: start a new one</div>
            </Reveal>
          </div>
        </div>
      )
  }
  return null
}

const CSS = `
.t-contracts-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-contracts-in.show { opacity: 1; transform: none; }
.t-contracts-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 7px; align-content: start; }
.t-contracts-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-contracts-big { font-size: 16px; font-weight: 900; color: #0b1324; }
.t-contracts-muted { font-size: 12.5px; color: #64748b; }
.t-contracts-row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 9px; }
.t-contracts-fee { font-size: 20px; font-weight: 900; color: #0b1324; }
.t-contracts-fee span { font-size: 12.5px; font-weight: 600; color: #64748b; }
.t-contracts-flow { display: grid; grid-template-columns: minmax(0,1.2fr) auto minmax(0,1fr); gap: 14px; align-items: center; }
.t-contracts-arrow { font-size: 28px; color: #f59e0b; font-weight: 900; }
.t-contracts-stack, .t-contracts-col { display: grid; gap: 10px; }
.t-contracts-out { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; font-size: 13.5px; font-weight: 700; color: #0b1324; }
.t-contracts-banner { display: inline-block; background: #0b1324; color: #fde68a; font-weight: 800; font-size: 13px; border-radius: 999px; padding: 7px 14px; }
.t-contracts-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 14px; align-items: start; }
.t-contracts-pill { font-size: 12px; font-weight: 700; border-radius: 9px; padding: 5px 9px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.t-contracts-pill.season { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
.t-contracts-so { margin: 0; font-size: 13.5px; color: #334155; border-top: 1px solid #e2e8f0; padding-top: 8px; }
.t-contracts-months { display: grid; grid-template-columns: 96px repeat(12, minmax(0,1fr)); gap: 4px; align-items: center; }
.t-contracts-rowname { font-size: 12px; font-weight: 700; color: #334155; }
.t-contracts-month { text-align: center; font-size: 11px; font-weight: 800; color: #64748b; }
.t-contracts-cell { height: 22px; border-radius: 6px; background: #f1f5f9; transition: background .4s; }
.t-contracts-cell.a { background: #0f766e; }
.t-contracts-cell.b { background: #b45309; }
.t-contracts-check { font-size: 13.5px; font-weight: 800; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 8px 12px; }
.t-contracts-note { font-size: 13px; color: #334155; background: #fff7e6; border: 1px solid #fde68a; border-radius: 12px; padding: 10px 12px; }
.t-contracts-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.t-contracts-tiles div { background: #f8fafc; border-radius: 10px; padding: 8px 10px; display: grid; }
.t-contracts-tiles b { font-size: 18px; color: #0b1324; }
.t-contracts-tiles span { font-size: 11.5px; color: #64748b; }
.t-contracts-visits { display: grid; gap: 4px; border-top: 1px solid #e2e8f0; padding-top: 8px; animation: t-contracts-fade .4s ease both; }
.t-contracts-visit { display: flex; gap: 10px; font-size: 13px; color: #334155; }
.t-contracts-visit b { width: 48px; color: #0b1324; }
.t-contracts-steps { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.t-contracts-stepwrap { display: flex; align-items: center; gap: 8px; }
.t-contracts-status { font-size: 12.5px; font-weight: 800; border-radius: 999px; padding: 5px 11px; }
.t-contracts-status.grey { background: #f1f5f9; color: #475569; }
.t-contracts-status.amber { background: #fffbeb; color: #b45309; }
.t-contracts-status.green { background: #ecfdf5; color: #047857; }
.t-contracts-chev { color: #94a3b8; font-weight: 900; }
.t-contracts-page { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 0 10px; display: grid; gap: 6px; box-shadow: 0 6px 16px rgba(11,19,36,.08); overflow: hidden; }
.t-contracts-band { height: 22px; background: #0f766e; color: #fff; font-size: 11px; font-weight: 900; letter-spacing: .1em; display: flex; align-items: center; padding: 0 10px; }
.t-contracts-line { height: 7px; border-radius: 99px; background: #e2e8f0; margin: 0 10px; }
.t-contracts-line.w90 { width: 85%; } .t-contracts-line.w80 { width: 75%; } .t-contracts-line.w70 { width: 65%; }
.t-contracts-sign { margin: 8px 10px 0; border-top: 1.5px solid #0b1324; padding-top: 3px; font-size: 11px; color: #475569; width: 60%; }
.t-contracts-timeline { display: grid; gap: 10px; max-width: 560px; }
.t-contracts-tl { display: flex; gap: 10px; align-items: flex-start; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; font-size: 13.5px; color: #0b1324; }
.t-contracts-dot { width: 22px; height: 22px; border-radius: 50%; background: #0b1324; color: #fde68a; font-size: 11px; font-weight: 800; display: grid; place-items: center; flex: none; }
.t-contracts-job { margin-left: 32px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; display: grid; gap: 5px; }
.t-contracts-covered { font-size: 13px; font-weight: 800; color: #065f46; background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 5px 9px; }
.t-contracts-hub { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
.t-contracts-hub-center { grid-column: 1 / -1; display: flex; justify-content: center; }
.t-contracts-core { background: #0b1324; color: #fde68a; font-weight: 900; font-size: 15px; border-radius: 999px; padding: 10px 18px; box-shadow: 0 10px 24px rgba(11,19,36,.25); }
.t-contracts-spot { font-size: 13.5px; font-weight: 800; color: #0b1324; }
.t-contracts-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-contracts-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-contracts-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-contracts-mock-body { position: relative; padding: 14px; min-height: 210px; }
.t-contracts-mock-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 10px; }
.t-contracts-mock-new { font-size: 12px; font-weight: 800; color: #fff; background: #f59e0b; border-radius: 8px; padding: 5px 9px; transition: box-shadow .4s; }
.t-contracts-mock-new.lit { box-shadow: 0 0 0 4px rgba(251,191,36,.45); }
.t-contracts-mock-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
.t-contracts-mock-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12.5px; font-weight: 700; }
.t-contracts-pointer { position: absolute; right: 18%; top: 22%; font-size: 26px; animation: t-contracts-tap 1.4s ease-in-out infinite; }
.t-contracts-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-contracts-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.t-contracts-avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }
@keyframes t-contracts-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(6px, -8px) scale(.92); } }
@keyframes t-contracts-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes t-contracts-fade { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 760px) {
  .t-contracts-flow, .t-contracts-split, .t-contracts-hub { grid-template-columns: minmax(0,1fr); }
  .t-contracts-arrow { transform: rotate(90deg); justify-self: center; }
  .t-contracts-months { grid-template-columns: 64px repeat(12, minmax(0,1fr)); gap: 2px; }
  .t-contracts-rowname { font-size: 10.5px; }
}
@media (prefers-reduced-motion: reduce) {
  .t-contracts-in, .t-contracts-cell, .t-contracts-mock-new { transition: none; }
  .t-contracts-pointer, .t-contracts-dock, .t-contracts-visits { animation: none; }
}
`

export const contractsScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual,
  css: CSS,
  actions: {
    'contracts:first': openFirstContract,
  },
}
