import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/workflow'
import type { TutorialScript } from '../tutorialScript'

/**
 * The drawn scenes for the Jobs & workflow tutorial film. Each scene builds
 * up piece by piece (`shown` counts the pieces on screen) while the narrator
 * reads it. Examples are generic so they fit any trade.
 */

const REVEAL: Record<string, number> = {
  stages: 5, types: 4, sentences: 4, groups: 5, build: 6, reminders: 5, watch: 4, yourturn: 3,
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-workflow-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

function Toggle({ on }: { on: boolean }) {
  return <span className={`t-workflow-switch ${on ? 'on' : ''}`} aria-hidden="true"><span /></span>
}

const LANES = [
  { label: 'Not started', jobs: ['Scheduled'], tone: 'slate' },
  { label: 'Working', jobs: ['On the way', 'On site'], tone: 'amber' },
  { label: 'Waiting', jobs: ['Needs parts'], tone: 'rose' },
  { label: 'Done', jobs: ['Complete'], tone: 'green' },
]

const GROUPS = [
  { icon: '⏰', name: 'Before the job', line: 'Reminders, so nobody wonders', on: 3 },
  { icon: '⚡', name: 'When a job’s status changes', line: 'Every time a job moves there', on: 4 },
  { icon: '📍', name: 'On the job (uses GPS)', line: 'Check-ins and late alerts', on: 2 },
  { icon: '💵', name: 'After the job and getting paid', line: 'Thanks, reviews, invoice nudges', on: 2 },
  { icon: '💛', name: 'Bring customers back', line: 'Only to customers who opted in', on: 1 },
]

function Visual({ id, shown }: { id: string; shown: number }) {
  switch (id) {
    case 'stages':
      return (
        <div>
          <div className="t-workflow-lanes">
            {LANES.map((lane, k) => (
              <Reveal key={lane.label} on={shown >= k + 1}>
                <div className={`t-workflow-lane ${lane.tone}`}>
                  <div className="t-workflow-lane-head"><span className="t-workflow-num">{k + 1}</span>{lane.label}</div>
                  {lane.jobs.map((s) => (
                    <div key={s} className={`t-workflow-status ${shown >= 5 && s === 'On site' ? 'hot' : ''}`}>{s}</div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 5}>
            <div className="t-workflow-moves">
              <span className="t-workflow-app">📱 Start travel</span><span aria-hidden="true">→</span><b>On the way</b>
              <span className="t-workflow-app">📍 Check in</span><span aria-hidden="true">→</span><b>On site</b>
              <span className="t-workflow-app">✅ Check out</span><span aria-hidden="true">→</span><b>Complete</b>
            </div>
          </Reveal>
        </div>
      )
    case 'types':
      return (
        <div className="t-workflow-split">
          <Reveal on={shown >= 1}>
            <div className="t-workflow-card">
              <div className="t-workflow-label">Job types</div>
              {[
                { name: 'HVAC tune-up', color: '#0ea5e9', on: true },
                { name: 'Water heater install', color: '#f59e0b', on: false },
                { name: 'Door repair', color: '#8b5cf6', on: false },
                { name: 'Lawn service', color: '#10b981', on: false },
              ].map((type) => (
                <div key={type.name} className={`t-workflow-type ${shown >= 2 && type.on ? 'picked' : ''}`}>
                  <span className="t-workflow-dot" style={{ background: type.color }} />{type.name}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-workflow-card">
              <div className="t-workflow-label">New job · Jordan Lee</div>
              <div className="t-workflow-field"><span>Type</span><b>HVAC tune-up</b></div>
              <div className={`t-workflow-field ${shown >= 3 ? 'filled' : ''}`}><span>Status</span>{shown >= 3 ? <b>Scheduled</b> : <i>…</i>}</div>
              <div className={`t-workflow-field ${shown >= 4 ? 'filled' : ''}`}><span>Duration</span>{shown >= 4 ? <b>90 min</b> : <i>…</i>}</div>
              {shown >= 4 && <div className="t-workflow-note">Filled in from the job type</div>}
            </div>
          </Reveal>
        </div>
      )
    case 'sentences':
      return (
        <div className="t-workflow-stack">
          {[
            { who: '👤', parts: ['', '2 hrs before', ' a job, ', 'text', ' the customer'], on: true },
            { who: '👤', parts: ['When you finish a job, wait ', '1 hour', ', then ', 'text', ' the customer asking for a review'], on: false },
            { who: '🏢', parts: ['When a customer pays, ', 'email', ' the office'], on: true },
          ].map((row, k) => (
            <Reveal key={k} on={shown >= k + 1}>
              <div className="t-workflow-row">
                <span className="t-workflow-who" aria-hidden="true">{row.who}</span>
                <span className="t-workflow-sentence">
                  {row.parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
                </span>
                <Toggle on={row.on || (k === 1 && shown >= 4)} />
              </div>
            </Reveal>
          ))}
          <Reveal on={shown >= 4}>
            <div className="t-workflow-flash">✓ Turned on. CrewBarn will take it from here. <u>Undo</u></div>
          </Reveal>
        </div>
      )
    case 'groups':
      return (
        <div className="t-workflow-stack">
          {GROUPS.map((group, k) => (
            <Reveal key={group.name} on={shown >= k + 1}>
              <div className="t-workflow-group">
                <span className="t-workflow-group-icon" aria-hidden="true">{group.icon}</span>
                <span className="t-workflow-group-text"><b>{group.name}</b><span>{group.line}</span></span>
                <span className="t-workflow-count">{group.on} on</span>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'build': {
      const tokens = ['you finish a job', '1 hour', 'text', 'the customer', 'the friendly default']
      const glue = ['When ', ', wait ', ', then ', ' ', ' using ', '.']
      return (
        <div className="t-workflow-split">
          <div className="t-workflow-card">
            <div className="t-workflow-label">Build your own</div>
            <p className="t-workflow-big">
              {tokens.map((token, k) => (
                <span key={token}>
                  {glue[k]}
                  <mark className={shown >= k + 1 ? 'set' : ''}>{shown >= k + 1 ? token : '_____'}</mark>
                </span>
              ))}
              {glue[5]}
            </p>
          </div>
          <Reveal on={shown >= 6}>
            <div className="t-workflow-card">
              <div className="t-workflow-label">Preview</div>
              <div className="t-workflow-bubble">Hi Jordan, thanks for choosing Acme Services today. Would you leave us a quick review?</div>
              <div className="t-workflow-note">Sends 1 hour later</div>
            </div>
          </Reveal>
        </div>
      )
    }
    case 'reminders':
      return (
        <div className="t-workflow-timeline">
          <Reveal on={shown >= 1} className="t-workflow-axis-wrap">
            <div className="t-workflow-axis">
              <span className="t-workflow-late" />
              <span className="t-workflow-start" />
            </div>
            <div className="t-workflow-ticks">
              <span style={{ left: '3%' }}>1 day before</span>
              <span style={{ left: '34%' }}>1 hour</span>
              <span style={{ left: '56%' }} className="strong">Job starts</span>
              <span style={{ left: '90%' }}>+30 min</span>
            </div>
          </Reveal>
          <div className="t-workflow-pins top">
            <Reveal on={shown >= 2}><span className="t-workflow-pin customer" style={{ left: '3%' }}>Before start<small>1 day · 💬</small></span></Reveal>
            <Reveal on={shown >= 3}><span className="t-workflow-pin customer" style={{ left: '46%' }}>On the way<small>20 min · 💬 📍</small></span></Reveal>
          </div>
          <div className="t-workflow-pins bottom">
            <Reveal on={shown >= 4}><span className="t-workflow-pin tech" style={{ left: '30%' }}>Before start<small>1 hr · 📱</small></span></Reveal>
            <Reveal on={shown >= 5}><span className="t-workflow-pin tech" style={{ left: '74%' }}>If it hasn’t started<small>15 min · 📱</small></span></Reveal>
          </div>
          <div className="t-workflow-lanes-key"><span className="c">Customer</span><span className="t">Tech</span></div>
        </div>
      )
    case 'watch':
      return (
        <div className="t-workflow-split">
          <div className="t-workflow-stack">
            <Reveal on={shown >= 1}>
              <div className="t-workflow-row">
                <span className="t-workflow-sentence"><b>Reminders before an appointment</b><br /><small>Every reminder, one switch</small></span>
                <Toggle on />
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-workflow-row">
                <span className="t-workflow-sentence"><b>When a job counts as stalled</b><br /><small>After this many days untouched</small></span>
                <span className="t-workflow-stepper"><span>−</span><b>7</b><span>+</span></span>
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 3}>
            <div className="t-workflow-card">
              <div className="t-workflow-label">Needs attention</div>
              <div className="t-workflow-job">
                <span><b>Door repair</b><small>123 Main St, Springfield · no update in 9 days</small></span>
                <span className="t-workflow-badge">⏳ Dormant</span>
              </div>
              {shown >= 4 && <div className="t-workflow-note">Flagged for the office to chase. Nothing is sent to the customer.</div>}
            </div>
          </Reveal>
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-workflow-mock">
          <div className="t-workflow-mock-bar"><span /><span /><span /></div>
          <div className="t-workflow-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-workflow-mock-head">Automations</div>
              {['2 hrs before a job, text the customer', 'When you finish a job, text the customer', 'When a customer pays, email the office'].map((line, k) => (
                <div key={line} className={`t-workflow-mock-row ${k === 1 && shown >= 2 ? 'lit' : ''}`}>{line}<Toggle on={k !== 1} /></div>
              ))}
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-workflow-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-workflow-dock"><span className="t-workflow-avatar">CB</span> Your turn: click the sentence</div>
            </Reveal>
          </div>
        </div>
      )
    default:
      return null
  }
}

const CSS = `
.t-workflow-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-workflow-in.show { opacity: 1; transform: none; }
.t-workflow-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 8px; align-content: start; }
.t-workflow-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-workflow-note { font-size: 12.5px; color: #4d586b; animation: t-workflow-fade .4s ease both; }
.t-workflow-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; align-items: start; }
.t-workflow-stack { display: grid; gap: 9px; }
.t-workflow-lanes { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
.t-workflow-lane { background: #fff; border: 1px solid #e3e7ee; border-top: 4px solid #94a3b8; border-radius: 12px; padding: 10px; display: grid; gap: 6px; }
.t-workflow-lane.amber { border-top-color: #f59e0b; } .t-workflow-lane.rose { border-top-color: #f43f5e; } .t-workflow-lane.green { border-top-color: #10b981; }
.t-workflow-lane-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: #0b1324; }
.t-workflow-num { width: 20px; height: 20px; border-radius: 50%; background: #0b1324; color: #fde68a; font-size: 10.5px; font-weight: 800; display: grid; place-items: center; flex: none; }
.t-workflow-status { border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 9px; font-size: 12px; font-weight: 700; color: #334155; transition: box-shadow .35s, border-color .35s; }
.t-workflow-status.hot { border-color: #f59e0b; box-shadow: 0 0 0 3px #fde68a; }
.t-workflow-moves { margin-top: 14px; display: grid; grid-template-columns: auto auto 1fr; gap: 6px 10px; align-items: center; font-size: 13px; color: #0b1324; max-width: 380px; }
.t-workflow-app { background: #0b1324; color: #fff; font-weight: 800; font-size: 12px; border-radius: 9px; padding: 4px 10px; }
.t-workflow-type { display: flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 10px; font-size: 13px; font-weight: 700; color: #0b1324; transition: all .35s; }
.t-workflow-type.picked { border-color: #f59e0b; box-shadow: 0 0 0 3px #fde68a; }
.t-workflow-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.t-workflow-field { display: flex; gap: 10px; align-items: center; border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 10px; font-size: 13px; color: #0b1324; transition: all .35s; }
.t-workflow-field span { width: 64px; flex: none; color: #64748b; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; }
.t-workflow-field i { color: #94a3b8; }
.t-workflow-field.filled { border-color: #6ee7b7; background: #ecfdf5; }
.t-workflow-row { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; }
.t-workflow-who { width: 32px; height: 32px; border-radius: 10px; background: #f1f5f9; display: grid; place-items: center; flex: none; }
.t-workflow-sentence { flex: 1; min-width: 0; font-size: 14px; line-height: 1.5; color: #0b1324; }
.t-workflow-sentence small { color: #64748b; font-size: 12px; }
.t-workflow-sentence mark, .t-workflow-big mark { background: #fffbeb; color: #92400e; font-weight: 800; border-radius: 6px; padding: 1px 5px; }
.t-workflow-switch { width: 40px; height: 22px; border-radius: 99px; background: #cbd5e1; position: relative; flex: none; transition: background .35s; }
.t-workflow-switch span { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .35s; }
.t-workflow-switch.on { background: #10b981; }
.t-workflow-switch.on span { transform: translateX(18px); }
.t-workflow-flash { border: 1px solid #a7f3d0; background: #ecfdf5; color: #065f46; border-radius: 12px; padding: 9px 12px; font-size: 13px; font-weight: 700; }
.t-workflow-group { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 9px 12px; }
.t-workflow-group-icon { width: 34px; height: 34px; border-radius: 10px; background: #f1f5f9; display: grid; place-items: center; flex: none; }
.t-workflow-group-text { flex: 1; min-width: 0; display: grid; font-size: 14px; color: #0b1324; }
.t-workflow-group-text span { font-size: 12px; color: #64748b; }
.t-workflow-count { font-size: 12px; font-weight: 800; color: #475569; background: #f1f5f9; border-radius: 99px; padding: 3px 9px; flex: none; }
.t-workflow-big { margin: 0; font-size: 20px; line-height: 1.7; color: #0b1324; }
.t-workflow-big mark { color: #94a3b8; background: #f8fafc; transition: all .35s; }
.t-workflow-big mark.set { color: #92400e; background: #fef3c7; }
.t-workflow-bubble { background: #e5e7eb; color: #0f172a; font-size: 13px; line-height: 1.45; border-radius: 18px 18px 18px 6px; padding: 9px 12px; }
.t-workflow-timeline { position: relative; background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; height: 250px; overflow: hidden; }
.t-workflow-axis-wrap { position: absolute; left: 14px; right: 14px; top: 112px; }
.t-workflow-axis { position: relative; height: 4px; background: #e2e8f0; border-radius: 4px; }
.t-workflow-late { position: absolute; left: 56%; right: 0; top: 0; bottom: 0; background: #fecdd3; border-radius: 0 4px 4px 0; }
.t-workflow-start { position: absolute; left: 56%; top: -14px; width: 2px; height: 32px; background: #0b1324; }
.t-workflow-ticks { position: relative; height: 18px; margin-top: 12px; }
.t-workflow-ticks span { position: absolute; transform: translateX(-10%); font-size: 11px; color: #64748b; white-space: nowrap; }
.t-workflow-ticks span.strong { color: #0b1324; font-weight: 800; transform: translateX(-50%); }
.t-workflow-pins { position: absolute; left: 14px; right: 14px; height: 60px; }
.t-workflow-pins.top { top: 26px; } .t-workflow-pins.bottom { top: 160px; }
.t-workflow-pin { position: absolute; display: grid; width: 118px; border-radius: 10px; padding: 6px 8px; font-size: 12px; font-weight: 800; border: 1px solid; }
.t-workflow-pin small { font-weight: 600; font-size: 11px; opacity: .8; }
.t-workflow-pin.customer { background: #fffbeb; border-color: #fcd34d; color: #78350f; }
.t-workflow-pin.tech { background: #eff6ff; border-color: #93c5fd; color: #1e3a8a; }
.t-workflow-lanes-key { position: absolute; right: 12px; top: 8px; display: flex; gap: 10px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #64748b; }
.t-workflow-lanes-key .c::before, .t-workflow-lanes-key .t::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; background: #f59e0b; }
.t-workflow-lanes-key .t::before { background: #3b82f6; }
.t-workflow-stepper { display: inline-flex; align-items: center; gap: 8px; flex: none; }
.t-workflow-stepper span { width: 26px; height: 26px; border: 1px solid #cbd5e1; border-radius: 8px; display: grid; place-items: center; font-weight: 800; color: #0b1324; }
.t-workflow-stepper b { font-size: 20px; color: #0b1324; min-width: 22px; text-align: center; }
.t-workflow-job { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid #fecaca; background: #fff1f2; border-radius: 10px; padding: 8px 10px; }
.t-workflow-job > span:first-child { display: grid; font-size: 13px; color: #0b1324; min-width: 0; }
.t-workflow-job small { font-size: 11.5px; color: #64748b; }
.t-workflow-badge { background: #ef4444; color: #fff; font-size: 11px; font-weight: 800; border-radius: 99px; padding: 3px 9px; flex: none; }
.t-workflow-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-workflow-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-workflow-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-workflow-mock-body { position: relative; padding: 14px; min-height: 210px; }
.t-workflow-mock-head { font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 10px; }
.t-workflow-mock-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; font-size: 12.5px; font-weight: 700; color: #0b1324; transition: all .4s; }
.t-workflow-mock-row.lit { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251,191,36,.35); }
.t-workflow-pointer { position: absolute; left: 62%; top: 48%; font-size: 26px; animation: t-workflow-tap 1.4s ease-in-out infinite; }
.t-workflow-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-workflow-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.t-workflow-avatar { width: 22px; height: 22px; border-radius: 50%; background: #fbbf24; color: #0b1324; font-size: 9px; font-weight: 900; display: grid; place-items: center; }
@keyframes t-workflow-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px, 6px) scale(.92); } }
@keyframes t-workflow-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes t-workflow-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .t-workflow-in, .t-workflow-switch, .t-workflow-switch span, .t-workflow-status, .t-workflow-type, .t-workflow-field, .t-workflow-big mark, .t-workflow-mock-row { transition: none; }
  .t-workflow-pointer, .t-workflow-dock, .t-workflow-note { animation: none; }
}
@media (max-width: 760px) {
  .t-workflow-split { grid-template-columns: minmax(0,1fr); }
  .t-workflow-lanes { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .t-workflow-big { font-size: 17px; }
  .t-workflow-pin { width: 96px; font-size: 11px; }
  .t-workflow-ticks span { font-size: 10px; }
}
`

export const workflowScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <Visual id={id} shown={shown} />,
  css: CSS,
}
