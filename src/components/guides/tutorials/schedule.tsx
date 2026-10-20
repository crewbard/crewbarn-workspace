import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/schedule'
import type { TutorialScript } from '../tutorialScript'

/**
 * The drawn scenes for the Schedule & Dispatch tutorial film. Each scene
 * builds up piece by piece (`shown` counts the pieces on screen) while the
 * narrator reads it. Examples are generic so they fit any trade.
 */

type SceneId = 'path' | 'queue' | 'drop' | 'checks' | 'lanes' | 'dispatch' | 'field' | 'yourturn'

const REVEAL: Record<SceneId, number> = {
  path: 5, queue: 3, drop: 4, checks: 5, lanes: 4, dispatch: 4, field: 4, yourturn: 3,
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-schedule-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

const TRIP = [
  { icon: '📋', label: 'Waiting', note: 'To Schedule' },
  { icon: '📅', label: 'Booked', note: 'Tue 10:00 AM' },
  { icon: '👷', label: 'Tech', note: 'Sam Rivera' },
  { icon: '🚐', label: 'On the way', note: 'Start travel' },
  { icon: '✅', label: 'Done', note: 'Checked out' },
]

const QUEUE = [
  { customer: 'Jordan Lee', job: 'Water heater leaking', addr: '123 Main St, Springfield', tag: 'Emergency' },
  { customer: 'Acme Services', job: 'HVAC tune-up', addr: '48 Oak Ave', tag: 'No tech' },
  { customer: 'Casey Brooks', job: 'Back door won’t latch', addr: '9 Elm Ct', tag: '' },
  { customer: 'Riverside Apartments', job: 'Lawn service', addr: '200 River Rd', tag: 'Estimate' },
]

const CHECKS = [
  'Sam already has a job at 10:00',
  'Alex has approved time off',
  'Missing service address',
  'Outside 7 AM to 7 PM',
  'Route looks tight: 18 miles, 20 min gap',
]

function Card({ customer, time, tone = 'blue', est }: { customer: string; time: string; tone?: 'blue' | 'green' | 'amber' | 'slate'; est?: boolean }) {
  return (
    <div className={`t-schedule-job ${tone} ${est ? 'est' : ''}`}>
      <b>{est && <span className="t-schedule-est">EST</span>}{customer}</b>
      <span>{time}</span>
    </div>
  )
}

function SchedFilmVisual({ id, shown }: { id: SceneId; shown: number }) {
  switch (id) {
    case 'path':
      return (
        <div className="t-schedule-trip">
          {TRIP.map((step, k) => (
            <Reveal key={step.label} on={shown >= k + 1} className="t-schedule-trip-step">
              <div className={`t-schedule-trip-dot ${shown === k + 1 ? 'hot' : ''}`}>{step.icon}</div>
              <div className="t-schedule-trip-label">{step.label}</div>
              <div className="t-schedule-trip-note">{step.note}</div>
            </Reveal>
          ))}
        </div>
      )
    case 'queue':
      return (
        <div className="t-schedule-panel narrow">
          <div className="t-schedule-label">To Schedule</div>
          <Reveal on={shown >= 1}>
            <div className="t-schedule-search">Search customer / address…</div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-schedule-chips">
              {['All', 'Emergency', 'Today', 'Estimates', 'No tech'].map((chip) => (
                <span key={chip} className={`t-schedule-chip ${chip === 'Emergency' && shown >= 3 ? 'on' : ''}`}>{chip}</span>
              ))}
            </div>
          </Reveal>
          <div className="t-schedule-rows">
            {QUEUE.map((row, k) => (
              <Reveal key={row.customer} on={shown >= 1 && (shown < 3 || k === 0)}>
                <div className="t-schedule-row">
                  <b>{row.customer}</b>
                  <span>{row.job}</span>
                  <small>📍 {row.addr}</small>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      )
    case 'drop':
      return (
        <div className="t-schedule-split">
          <div className="t-schedule-panel">
            <div className="t-schedule-label">To Schedule</div>
            <Reveal on={shown >= 1}>
              <div className={`t-schedule-row ${shown >= 2 ? 'lifted' : ''}`}>
                <b>Acme Services</b>
                <span>HVAC tune-up</span>
              </div>
            </Reveal>
          </div>
          <div className="t-schedule-week">
            {['Mon', 'Tue', 'Wed'].map((day) => (
              <div key={day} className="t-schedule-day">
                <div className="t-schedule-day-head">{day}</div>
                {day === 'Mon' && <Card customer="Jordan Lee" time="8:00 AM · Sam" />}
                {day === 'Tue' && shown >= 2 && shown < 4 && <div className="t-schedule-drop">Drop here: Tue, 10:00 AM</div>}
                {day === 'Tue' && shown >= 4 && <Card customer="Acme Services" time="10:00 AM · Alex" tone="green" />}
              </div>
            ))}
            <Reveal on={shown >= 3 && shown < 4} className="t-schedule-modal-wrap">
              <div className="t-schedule-modal">
                <b>Assign a tech?</b>
                <span>This job has no tech yet.</span>
                <div className="t-schedule-modal-list"><span>Sam Rivera</span><span className="pick">Alex Kim</span></div>
                <small>Keep unassigned →</small>
              </div>
            </Reveal>
            <Reveal on={shown >= 4} className="t-schedule-stamp-wrap">
              <span className="t-schedule-stamp">Stage: Scheduled ✓</span>
            </Reveal>
          </div>
        </div>
      )
    case 'checks':
      return (
        <div className="t-schedule-split">
          <div className="t-schedule-stack">
            {CHECKS.map((line, k) => (
              <Reveal key={line} on={shown >= k + 1}>
                <div className="t-schedule-warn"><span aria-hidden="true">⚠</span>{line}</div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 5}>
            <div className="t-schedule-confirm">
              <div className="t-schedule-label">Before it books</div>
              <p>Here’s what looks off. Schedule anyway?</p>
              <div className="t-schedule-buttons"><span className="ghost">Cancel</span><span className="solid">OK</span></div>
            </div>
          </Reveal>
        </div>
      )
    case 'lanes':
      return (
        <div className="t-schedule-lanes">
          {[
            { name: 'Sam Rivera', meta: '2 jobs · 3h', jobs: [{ c: 'Jordan Lee', t: '8:00 AM' }, { c: 'Casey Brooks', t: '1:00 PM' }] },
            { name: 'Alex Kim', meta: '1 job · 2h', jobs: [{ c: 'Acme Services', t: '10:00 AM' }] },
            { name: 'Unassigned', meta: 'Drop work here', jobs: [{ c: 'Riverside Apts', t: '11:00 AM' }] },
          ].map((lane, k) => (
            <Reveal key={lane.name} on={shown >= k + 1} className="t-schedule-lane-wrap">
              <div className={`t-schedule-lane ${k === 2 ? 'muted' : ''}`}>
                <div className="t-schedule-lane-head"><b>{lane.name}</b><span>{lane.meta}</span></div>
                <div className="t-schedule-lane-body">
                  {lane.jobs.map((job) => <Card key={job.c} customer={job.c} time={job.t} tone={k === 2 ? 'slate' : 'blue'} />)}
                  {k === 1 && shown >= 4 && <div className="t-schedule-ghost ok">✓ Open</div>}
                  {k === 0 && shown >= 4 && <div className="t-schedule-ghost bad">⚠ Conflict</div>}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'dispatch':
      return (
        <div className="t-schedule-split wide">
          <div className="t-schedule-stack">
            <Reveal on={shown >= 3}>
              <div className="t-schedule-label">Unassigned today</div>
              <div className="t-schedule-row amber">
                <b>Door repair</b>
                <span>Casey Brooks · 9 Elm Ct</span>
                <small className="t-schedule-link">Suggest a tech →</small>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-schedule-rank">
                {[
                  { n: 1, name: 'Alex Kim', why: 'Free now · 6 min drive' },
                  { n: 2, name: 'Sam Rivera', why: 'Free at 2:00 PM · 14 min drive' },
                  { n: 3, name: 'Pat Morgan', why: 'Free at 4:00 PM · 25 min drive' },
                ].map((s) => (
                  <div key={s.n} className={`t-schedule-rank-row ${s.n === 1 ? 'best' : ''}`}>
                    <span className="t-schedule-rank-n">{s.n}</span>
                    <div><b>{s.name}</b><small>{s.why}</small></div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 1}>
            <div className="t-schedule-map">
              <span className="t-schedule-road r1" /><span className="t-schedule-road r2" />
              <span className="t-schedule-pin p1" /><span className="t-schedule-pin p2" /><span className="t-schedule-pin p3 late" />
              {shown >= 2 && (
                <>
                  <span className="t-schedule-tech a">AK<em>Alex</em></span>
                  <span className="t-schedule-tech b">SR<em>Sam</em></span>
                  <span className="t-schedule-tech c stale">PM<em>Pat</em></span>
                </>
              )}
            </div>
          </Reveal>
        </div>
      )
    case 'field':
      return (
        <div className="t-schedule-flow">
          <Reveal on={shown >= 1}>
            <div className="t-schedule-flow-row">
              <span className="t-schedule-btn">▶ Start travel</span>
              <span aria-hidden="true">→</span>
              <span className="t-schedule-stage amber">On the way</span>
              <span className="t-schedule-bubble">Hi Jordan, Sam is on the way.</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-schedule-flow-row">
              <span className="t-schedule-btn">📍 Check in</span>
              <span aria-hidden="true">→</span>
              <span className="t-schedule-stage green">On site</span>
              <span className="t-schedule-note">GPS can do it for them</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-schedule-flow-row">
              <span className="t-schedule-btn">✓ Check out</span>
              <span aria-hidden="true">→</span>
              <span className="t-schedule-stage navy">Completed</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-schedule-review">
              <div className="t-schedule-label">Field review</div>
              <div className="t-schedule-review-row"><span className="t-schedule-tag rose">Left site</span>HVAC tune-up · Acme Services</div>
              <div className="t-schedule-review-row"><span className="t-schedule-tag red">No check-in</span>Lawn service · Riverside Apts</div>
            </div>
          </Reveal>
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-schedule-mock">
          <div className="t-schedule-mock-bar"><span /><span /><span /></div>
          <div className="t-schedule-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-schedule-mock-grid">
                <div className="t-schedule-mock-side">
                  <b>To Schedule</b>
                  <div className={`t-schedule-mock-row ${shown >= 2 ? 'lit' : ''}`}>Acme Services</div>
                  <div className="t-schedule-mock-row">Jordan Lee</div>
                </div>
                <div className="t-schedule-mock-cal">
                  {['Mon', 'Tue', 'Wed', 'Thu'].map((d) => <div key={d}>{d}</div>)}
                </div>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-schedule-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-schedule-dock">CB · Your turn: click the job</div>
            </Reveal>
          </div>
        </div>
      )
  }
}

const CSS = `
.t-schedule-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-schedule-in.show { opacity: 1; transform: none; }
.t-schedule-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
.t-schedule-trip { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; position: relative; }
.t-schedule-trip-step { display: grid; justify-items: center; gap: 6px; text-align: center; }
.t-schedule-trip-dot { width: 56px; height: 56px; border-radius: 50%; background: #fff; border: 2px solid #e2e8f0; display: grid; place-items: center; font-size: 24px; box-shadow: 0 8px 20px rgba(11,19,36,.08); transition: border-color .35s, box-shadow .35s; }
.t-schedule-trip-dot.hot { border-color: #f59e0b; box-shadow: 0 0 0 4px #fde68a; }
.t-schedule-trip-label { font-weight: 800; font-size: 13px; color: #0b1324; }
.t-schedule-trip-note { font-size: 11.5px; color: #64748b; }
.t-schedule-panel { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px; box-shadow: 0 8px 20px rgba(11,19,36,.06); }
.t-schedule-panel.narrow { max-width: 380px; margin: 0 auto; }
.t-schedule-search { border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 9px; font-size: 12px; color: #94a3b8; }
.t-schedule-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.t-schedule-chip { font-size: 11px; border: 1px solid #e2e8f0; border-radius: 99px; padding: 2px 9px; color: #64748b; background: #fff; transition: all .35s; }
.t-schedule-chip.on { border-color: #f59e0b; background: #fef3c7; color: #92400e; font-weight: 700; }
.t-schedule-rows { display: grid; gap: 0; margin-top: 8px; }
.t-schedule-row { display: grid; gap: 1px; border-top: 1px solid #f1f5f9; padding: 7px 4px; font-size: 12px; color: #475569; transition: transform .4s, box-shadow .4s, background .4s; border-radius: 8px; }
.t-schedule-row b { color: #0b1324; font-size: 12.5px; }
.t-schedule-row small { color: #94a3b8; font-size: 11px; }
.t-schedule-row.lifted { transform: translate(18px, -6px) rotate(-2deg); background: #fff; box-shadow: 0 14px 30px rgba(15,23,42,.24); border: 1px solid #f59e0b; }
.t-schedule-row.amber { border: 1px solid #fcd34d; background: #fffbeb; padding: 8px 10px; }
.t-schedule-link { color: #b45309 !important; font-weight: 700; }
.t-schedule-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.6fr); gap: 16px; align-items: start; }
.t-schedule-split.wide { grid-template-columns: minmax(0,1fr) minmax(0,1.3fr); }
.t-schedule-week { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px; background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 8px; min-height: 200px; }
.t-schedule-day { display: grid; align-content: start; gap: 6px; border-right: 1px dashed #e2e8f0; padding-right: 6px; min-height: 180px; }
.t-schedule-day:last-child { border-right: 0; }
.t-schedule-day-head { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; text-align: center; }
.t-schedule-job { border-radius: 5px; padding: 5px 7px; font-size: 11.5px; display: grid; gap: 1px; border: 1px solid; border-left-width: 4px; animation: t-schedule-fade .4s ease both; }
.t-schedule-job b { color: #0b1324; display: flex; gap: 4px; align-items: center; }
.t-schedule-job span { color: #475569; font-size: 10.5px; }
.t-schedule-job.blue { background: #eff6ff; border-color: #bfdbfe; border-left-color: #3b82f6; }
.t-schedule-job.green { background: #ecfdf5; border-color: #a7f3d0; border-left-color: #10b981; }
.t-schedule-job.amber { background: #fffbeb; border-color: #fde68a; border-left-color: #f59e0b; }
.t-schedule-job.slate { background: #f8fafc; border-color: #e2e8f0; border-left-color: #94a3b8; }
.t-schedule-job.est { border-style: dashed; }
.t-schedule-est { font-size: 8.5px; font-weight: 900; background: #0b1324; color: #fff; border-radius: 3px; padding: 0 3px; }
.t-schedule-drop { border: 1px solid #fbbf24; background: #fef3c7; color: #92400e; font-size: 10.5px; font-weight: 700; border-radius: 6px; padding: 4px 6px; margin-top: 30px; animation: t-schedule-fade .4s ease both; }
.t-schedule-modal-wrap { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(15,23,42,.18); border-radius: 14px; }
.t-schedule-modal { background: #fff; border-radius: 12px; padding: 12px 14px; display: grid; gap: 6px; width: 210px; box-shadow: 0 14px 30px rgba(15,23,42,.25); font-size: 12px; color: #475569; }
.t-schedule-modal b { color: #0b1324; font-size: 13.5px; }
.t-schedule-modal-list { display: grid; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.t-schedule-modal-list span { padding: 5px 8px; border-top: 1px solid #f1f5f9; }
.t-schedule-modal-list span:first-child { border-top: 0; }
.t-schedule-modal-list .pick { background: #fef3c7; color: #92400e; font-weight: 700; }
.t-schedule-modal small { text-align: right; font-weight: 700; color: #334155; }
.t-schedule-stamp-wrap { position: absolute; right: 10px; bottom: 10px; }
.t-schedule-stamp { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 11.5px; font-weight: 800; border-radius: 99px; padding: 3px 10px; }
.t-schedule-stack { display: grid; gap: 8px; }
.t-schedule-warn { display: flex; gap: 8px; align-items: center; background: #fff; border: 1px solid #fde68a; border-radius: 10px; padding: 8px 10px; font-size: 13px; color: #78350f; }
.t-schedule-warn span { color: #d97706; font-weight: 900; }
.t-schedule-confirm { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 14px; box-shadow: 0 10px 24px rgba(11,19,36,.1); }
.t-schedule-confirm p { margin: 0 0 12px; font-size: 14px; color: #0b1324; font-weight: 700; }
.t-schedule-buttons { display: flex; gap: 8px; justify-content: flex-end; }
.t-schedule-buttons span { font-size: 12px; font-weight: 800; border-radius: 8px; padding: 5px 14px; }
.t-schedule-buttons .ghost { border: 1px solid #cbd5e1; color: #334155; }
.t-schedule-buttons .solid { background: #0b1324; color: #fde68a; }
.t-schedule-lanes { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
.t-schedule-lane { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; overflow: hidden; min-height: 190px; }
.t-schedule-lane.muted { background: #f8fafc; }
.t-schedule-lane-head { display: grid; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
.t-schedule-lane-head b { color: #0b1324; }
.t-schedule-lane.muted .t-schedule-lane-head b { font-style: italic; color: #64748b; }
.t-schedule-lane-head span { color: #64748b; font-size: 11px; }
.t-schedule-lane-body { display: grid; gap: 6px; padding: 8px; }
.t-schedule-ghost { border: 2px solid; border-radius: 6px; padding: 8px 6px; font-size: 11px; font-weight: 800; animation: t-schedule-fade .4s ease both; }
.t-schedule-ghost.ok { border-color: #10b981; background: rgba(16,185,129,.15); color: #047857; }
.t-schedule-ghost.bad { border-color: #ef4444; background: rgba(239,68,68,.15); color: #b91c1c; }
.t-schedule-map { position: relative; height: 230px; border-radius: 14px; overflow: hidden; background: linear-gradient(135deg, #e7efe4, #dfe9f3); border: 1px solid #e3e7ee; }
.t-schedule-road { position: absolute; background: #fff; opacity: .9; }
.t-schedule-road.r1 { left: 0; right: 0; top: 46%; height: 10px; transform: rotate(-8deg); }
.t-schedule-road.r2 { top: 0; bottom: 0; left: 58%; width: 10px; transform: rotate(12deg); }
.t-schedule-pin { position: absolute; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
.t-schedule-pin.p1 { left: 20%; top: 24%; background: #3b82f6; }
.t-schedule-pin.p2 { left: 72%; top: 66%; background: #10b981; }
.t-schedule-pin.p3 { left: 44%; top: 78%; background: #f59e0b; }
.t-schedule-pin.late::after { content: '!'; position: absolute; left: 50%; top: -20px; transform: translateX(-50%); width: 16px; height: 16px; background: #dc2626; color: #fff; font-size: 11px; font-weight: 900; display: grid; place-items: center; border-radius: 4px; }
.t-schedule-tech { position: absolute; width: 36px; height: 36px; border-radius: 50%; background: #f59e0b; color: #fff; font-weight: 800; font-size: 12px; display: grid; place-items: center; border: 3px solid #f59e0b; box-shadow: 0 2px 8px rgba(0,0,0,.3); animation: t-schedule-fade .4s ease both; }
.t-schedule-tech em { position: absolute; top: calc(100% + 3px); left: 50%; transform: translateX(-50%); font-style: normal; font-size: 10px; background: #fff; color: #0b1324; border-radius: 6px; padding: 0 5px; white-space: nowrap; }
.t-schedule-tech.a { left: 28%; top: 36%; }
.t-schedule-tech.b { left: 64%; top: 18%; }
.t-schedule-tech.c { left: 78%; top: 44%; }
.t-schedule-tech.stale { opacity: .55; }
.t-schedule-rank { display: grid; gap: 6px; }
.t-schedule-rank-row { display: flex; gap: 8px; align-items: center; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 8px; background: #fff; font-size: 12px; }
.t-schedule-rank-row div { display: grid; }
.t-schedule-rank-row small { color: #64748b; font-size: 11px; }
.t-schedule-rank-row.best { border-color: #6ee7b7; background: #ecfdf5; }
.t-schedule-rank-n { width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 800; display: grid; place-items: center; flex: none; }
.t-schedule-rank-row.best .t-schedule-rank-n { background: #10b981; color: #fff; }
.t-schedule-flow { display: grid; gap: 10px; max-width: 620px; margin: 0 auto; }
.t-schedule-flow-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 9px 12px; font-size: 13px; }
.t-schedule-btn { background: #0b1324; color: #fff; font-weight: 800; font-size: 12px; border-radius: 9px; padding: 5px 10px; }
.t-schedule-stage { font-weight: 800; font-size: 12px; border-radius: 8px; padding: 3px 9px; border: 1px solid; }
.t-schedule-stage.amber { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
.t-schedule-stage.green { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.t-schedule-stage.navy { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; }
.t-schedule-bubble { background: #e5e7eb; color: #0f172a; font-size: 12px; border-radius: 16px 16px 16px 5px; padding: 6px 10px; }
.t-schedule-note { font-size: 12px; color: #64748b; }
.t-schedule-review { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; display: grid; gap: 6px; }
.t-schedule-review-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #334155; }
.t-schedule-tag { font-size: 10.5px; font-weight: 700; border-radius: 5px; padding: 1px 6px; }
.t-schedule-tag.rose { background: #ffe4e6; color: #be123c; }
.t-schedule-tag.red { background: #fee2e2; color: #b91c1c; }
.t-schedule-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-schedule-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-schedule-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-schedule-mock-body { position: relative; padding: 14px; min-height: 210px; }
.t-schedule-mock-grid { display: grid; grid-template-columns: 150px minmax(0,1fr); gap: 10px; }
.t-schedule-mock-side { display: grid; align-content: start; gap: 6px; font-size: 12px; }
.t-schedule-mock-side b { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; }
.t-schedule-mock-row { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; font-weight: 700; transition: all .4s; }
.t-schedule-mock-row.lit { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251,191,36,.35); }
.t-schedule-mock-cal { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 6px; }
.t-schedule-mock-cal div { border: 1px dashed #e2e8f0; border-radius: 8px; min-height: 150px; font-size: 11px; font-weight: 800; color: #94a3b8; text-align: center; padding-top: 6px; }
.t-schedule-pointer { position: absolute; left: 22%; top: 34%; font-size: 26px; animation: t-schedule-tap 1.4s ease-in-out infinite; }
.t-schedule-dock { position: absolute; right: 12px; bottom: 12px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-schedule-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes t-schedule-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(14px, 8px) scale(.92); } }
@keyframes t-schedule-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes t-schedule-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .t-schedule-in, .t-schedule-row, .t-schedule-trip-dot, .t-schedule-chip, .t-schedule-mock-row { transition: none !important; }
  .t-schedule-job, .t-schedule-drop, .t-schedule-ghost, .t-schedule-tech, .t-schedule-pointer, .t-schedule-dock { animation: none !important; }
  .t-schedule-row.lifted { transform: none; }
}
@media (max-width: 760px) {
  .t-schedule-split, .t-schedule-split.wide { grid-template-columns: minmax(0,1fr); }
  .t-schedule-trip { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .t-schedule-lanes { grid-template-columns: minmax(0,1fr); }
  .t-schedule-lane { min-height: 0; }
  .t-schedule-mock-grid { grid-template-columns: minmax(0,1fr); }
  .t-schedule-mock-cal div { min-height: 60px; }
  .t-schedule-map { height: 190px; }
}
`

export const scheduleScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <SchedFilmVisual id={id as SceneId} shown={shown} />,
  css: CSS,
}
