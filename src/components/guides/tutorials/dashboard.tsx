import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/dashboard'
import type { TutorialScript } from '../tutorialScript'

/**
 * The Dashboard tutorial: a short film about the home page, then a walk
 * through its four views, where each number leads, and the top bar.
 *
 * Nothing in the walk saves. The sticky note form is closed with Cancel, the
 * custom board's Customize is opened and closed with Done without adding or
 * removing a block, and buttons that change records are only pointed at.
 */

type SceneId = 'home' | 'numbers' | 'lists' | 'money' | 'dispatch' | 'custom' | 'topbar' | 'yourturn'

const REVEAL: Record<SceneId, number> = {
  home: 5, numbers: 6, lists: 4, money: 3, dispatch: 3, custom: 4, topbar: 4, yourturn: 3,
}

/**
 * Close the + menu. A click anywhere outside it closes it on its own (the
 * press on Do it for me already did), so this only nudges the same
 * outside-click once more in case it is still open.
 */
function closeMenu() {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-dashboard-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

const VIEWS = [
  { title: 'Your day', line: 'Jobs, calls, what needs attention' },
  { title: 'Money overview', line: 'Cash flow and balances owed' },
  { title: 'Dispatch', line: 'Crew and scheduling' },
  { title: 'Your custom board', line: 'The blocks you keep close' },
]

const TILES: Array<{ label: string; value: string; sub: string; tone: string; link?: string }> = [
  { label: 'Jobs today', value: '6', sub: '2 done · 4 remaining', tone: '' },
  { label: 'Unscheduled', value: '3', sub: 'Oldest needs a date', tone: 'red', link: 'Schedule now →' },
  { label: 'Unanswered calls', value: '2', sub: '1 no customer match', tone: 'sky', link: 'Open calls →' },
  { label: 'Ready to invoice', value: '4', sub: '$1,860 waiting to bill', tone: 'amber', link: 'Send invoices →' },
  { label: 'AI Intake', value: '1', sub: 'New leads to review', tone: 'violet', link: 'Review queue →' },
]

function DashboardFilmVisual({ id, shown }: { id: SceneId; shown: number }) {
  switch (id) {
    case 'home':
      return (
        <div className="t-dashboard-mock">
          <div className="t-dashboard-mock-bar"><span /><span /><span /></div>
          <div className="t-dashboard-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-dashboard-hero">
                <div>
                  <div className="t-dashboard-kick">Your workday · CrewBarn</div>
                  <div className="t-dashboard-hero-title">Welcome back, Jordan.</div>
                </div>
                <span className="t-dashboard-btn amber">+ New job</span>
              </div>
            </Reveal>
            <div className="t-dashboard-views">
              {VIEWS.map((v, k) => (
                <Reveal key={v.title} on={shown >= k + 2}>
                  <div className={`t-dashboard-view ${k === 0 ? 'on' : ''}`}>
                    <b>{v.title}</b>
                    <span className="t-dashboard-muted">{v.line}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      )
    case 'numbers':
      return (
        <div>
          <div className="t-dashboard-tiles">
            {TILES.map((tile, k) => (
              <Reveal key={tile.label} on={shown >= k + 1}>
                <div className={`t-dashboard-tile ${shown >= 6 && k === 1 ? 'lit' : ''}`}>
                  <div className="t-dashboard-muted">{tile.label}</div>
                  <div className={`t-dashboard-big ${tile.tone}`}>{tile.value}</div>
                  <div className="t-dashboard-small">{tile.sub}</div>
                  {tile.link && <div className="t-dashboard-link">{tile.link}</div>}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 6}>
            <div className="t-dashboard-door">
              <span className="t-dashboard-chip red">Unscheduled · 3</span>
              <span className="t-dashboard-arrow" aria-hidden="true">→</span>
              <span className="t-dashboard-page">📅 Schedule · To Schedule</span>
            </div>
          </Reveal>
        </div>
      )
    case 'lists':
      return (
        <div className="t-dashboard-lists">
          <Reveal on={shown >= 1} className="t-dashboard-span">
            <div className="t-dashboard-panel">
              <div className="t-dashboard-label">Sticky notes</div>
              <div className="t-dashboard-notes">
                <div className="t-dashboard-note yellow">Van 2 is in the shop until Friday.</div>
                <div className="t-dashboard-note blue">Restock filters for HVAC tune-ups.</div>
                <div className="t-dashboard-note green">Lawn crew starts at 7 tomorrow.</div>
              </div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2} className="t-dashboard-span">
            <div className="t-dashboard-panel">
              <div className="t-dashboard-label">Crew right now</div>
              {[
                { who: 'Sam Rivera', state: 'ON SITE', tone: 'green', job: 'Water heater check · 123 Main St' },
                { who: 'Lee Park', state: 'DRIVING', tone: 'sky', job: 'Next: Door repair, 1:30 pm' },
                { who: 'Pat Morgan', state: 'IDLE', tone: 'amber', job: 'Available for assignment' },
              ].map((row) => (
                <div key={row.who} className={`t-dashboard-crew ${row.tone}`}>
                  <b>{row.who}</b>
                  <span className={`t-dashboard-chip ${row.tone}`}>{row.state}</span>
                  <span className="t-dashboard-muted">{row.job}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-dashboard-panel">
              <div className="t-dashboard-label">Today’s schedule</div>
              {[['8:00 am', 'HVAC tune-up', 'green'], ['10:30 am', 'Water heater check', 'amber'], ['1:30 pm', 'Front door repair', 'gray']].map(([time, title, tone]) => (
                <div key={title} className="t-dashboard-row">
                  <span className={`t-dashboard-bar ${tone}`} />
                  <span className="t-dashboard-small">{time}</span>
                  <span>{title}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-dashboard-panel">
              <div className="t-dashboard-label">Needs attention</div>
              {[['red', 'Past their time', '2'], ['amber', 'Needs parts', '1'], ['sky', 'Estimates pending reply', '3']].map(([tone, label, n]) => (
                <div key={label} className="t-dashboard-row">
                  <span className={`t-dashboard-dot ${tone}`} />
                  <span className="t-dashboard-grow">{label}</span>
                  <b>{n}</b>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      )
    case 'money':
      return (
        <div className="t-dashboard-money">
          <Reveal on={shown >= 1}>
            <div className="t-dashboard-panel center">
              <div className="t-dashboard-label">Revenue</div>
              <div className="t-dashboard-gauge" aria-hidden="true"><span /></div>
              <div className="t-dashboard-pair"><span>Invoiced <b>$12,400</b></span><span>Collected <b>$9,800</b></span></div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-dashboard-panel">
              <div className="t-dashboard-label">Money in / out</div>
              <div className="t-dashboard-chart">
                {[[60, 30], [75, 40], [50, 25], [90, 35]].map(([a, b], k) => (
                  <div key={k} className="t-dashboard-bars">
                    <span className="in" style={{ height: `${a}%` }} />
                    <span className="out" style={{ height: `${b}%` }} />
                  </div>
                ))}
              </div>
              <div className="t-dashboard-net">Net +$5,600</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-dashboard-panel">
              <div className="t-dashboard-label">Receivables · Aging</div>
              <div className="t-dashboard-chart">
                {[['Not due', 80, '#15803d'], ['1–30', 45, '#ca8a04'], ['31–60', 25, '#E8902C'], ['61–90', 12, '#dc2626'], ['90+', 8, '#991b1b']].map(([label, h, color]) => (
                  <div key={label as string} className="t-dashboard-bars one">
                    <span style={{ height: `${h}%`, background: color as string }} />
                    <em>{label}</em>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      )
    case 'dispatch':
      return (
        <div className="t-dashboard-dispatch">
          <Reveal on={shown >= 1}>
            <div className="t-dashboard-panel">
              <div className="t-dashboard-hours">{['7a', '9a', '11a', '1p', '3p', '5p', '7p'].map((h) => <span key={h}>{h}</span>)}</div>
              {[
                { who: 'Sam R.', blocks: [[8, 18, 'done'], [30, 20, 'onsite'], [60, 15, 'later']] },
                { who: 'Lee P.', blocks: [[12, 22, 'done'], [45, 18, 'later']] },
                { who: 'Pat M.', blocks: [[20, 25, 'onsite'], [70, 20, 'later']] },
              ].map((lane) => (
                <div key={lane.who} className="t-dashboard-lane">
                  <span className="t-dashboard-lane-who">{lane.who}</span>
                  <div className="t-dashboard-lane-track">
                    {shown >= 2 && lane.blocks.map(([left, width, kind], k) => (
                      <span key={k} className={`t-dashboard-block ${kind}`} style={{ left: `${left}%`, width: `${width}%` }} />
                    ))}
                    {shown >= 2 && <span className="t-dashboard-now" style={{ left: '38%' }} />}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-dashboard-panel">
              <div className="t-dashboard-label">Unscheduled <span className="t-dashboard-chip red">2</span></div>
              <div className="t-dashboard-mini">Gate repair<span>Lee Park · Suggest a tech →</span></div>
              <div className="t-dashboard-mini">Lawn service<span>Pat Morgan · Suggest a tech →</span></div>
            </div>
          </Reveal>
        </div>
      )
    case 'custom':
      return (
        <div>
          <Reveal on={shown >= 2}>
            <div className="t-dashboard-tray">
              <span className="t-dashboard-label">Add a block</span>
              {['Inspections due', 'Warranties expiring', 'Estimates waiting'].map((b) => (
                <span key={b} className="t-dashboard-add">+ {b}</span>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 1}>
            <div className="t-dashboard-grid">
              {['Company metrics', 'Revenue', 'Needs attention', 'Techs on the map', 'Quick actions', 'Team messages'].map((b, k) => (
                <div key={b} className={`t-dashboard-wblock ${shown >= 2 ? 'edit' : ''} ${shown >= 3 && k === 4 ? 'moving' : ''} ${shown >= 4 && k === 5 ? 'leaving' : ''}`}>
                  {shown >= 2 && <span className="t-dashboard-handles"><i>⠿</i><i className={shown >= 4 && k === 5 ? 'lit' : ''}>✕</i></span>}
                  <b>{b}</b>
                  <span className="t-dashboard-line" /><span className="t-dashboard-line short" />
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      )
    case 'topbar':
      return (
        <div>
          <div className="t-dashboard-topbar">
            <b className="t-dashboard-brand">CrewBarn</b>
            <span className="t-dashboard-grow" />
            <Reveal on={shown >= 1} className="t-dashboard-inline">
              <span className="t-dashboard-tb">Messages</span>
              <span className="t-dashboard-tb">Calls<em>2</em></span>
              <span className="t-dashboard-tb">Intake<em>1</em></span>
            </Reveal>
            <Reveal on={shown >= 2} className="t-dashboard-inline">
              <span className="t-dashboard-icon">🔍</span>
              <span className="t-dashboard-icon">📖</span>
              <span className="t-dashboard-plus">+</span>
            </Reveal>
            <Reveal on={shown >= 3} className="t-dashboard-inline">
              <span className="t-dashboard-icon">🔔</span>
              <span className="t-dashboard-tut">🎓</span>
              <span className="t-dashboard-icon">?</span>
            </Reveal>
          </div>
          <Reveal on={shown >= 4}>
            <div className="t-dashboard-help">
              <div className="t-dashboard-label">Help</div>
              <div className="t-dashboard-help-btn">▶ Take the tutorial</div>
              <label className="t-dashboard-tick"><span className="t-dashboard-box">✓</span><b>Show tutorials on pages</b></label>
            </div>
          </Reveal>
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-dashboard-mock">
          <div className="t-dashboard-mock-bar"><span /><span /><span /></div>
          <div className="t-dashboard-mock-body tall">
            <Reveal on={shown >= 1}>
              <div className="t-dashboard-hero-title dark">Welcome back, Jordan.</div>
              <div className="t-dashboard-tabs">
                {['Today’s Ops', 'Cash Flow', 'Dispatch', 'Custom'].map((label, k) => (
                  <span key={label} className={`t-dashboard-tab ${k === 0 ? 'on' : ''} ${shown >= 2 && k === 1 ? 'lit' : ''}`}>{label}</span>
                ))}
              </div>
              <div className="t-dashboard-mock-grid">
                {['Jobs today', 'Unscheduled', 'Unanswered calls', 'Ready to invoice'].map((label) => (
                  <div key={label} className="t-dashboard-mock-card">{label}</div>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-dashboard-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-dashboard-dock"><span className="t-dashboard-avatar">CB</span> Your turn: click any view</div>
            </Reveal>
          </div>
        </div>
      )
  }
}

const CSS = `
.t-dashboard-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-dashboard-in.show { opacity: 1; transform: none; }
.t-dashboard-inline { display: inline-flex; align-items: center; gap: 6px; }
.t-dashboard-span { grid-column: 1 / -1; }
.t-dashboard-grow { flex: 1; }
.t-dashboard-muted { font-size: 12px; color: #64748b; }
.t-dashboard-small { font-size: 11px; color: #64748b; }
.t-dashboard-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; display: flex; align-items: center; gap: 6px; }
.t-dashboard-chip { display: inline-flex; align-items: center; border-radius: 6px; padding: 2px 7px; font-size: 10.5px; font-weight: 800; letter-spacing: 0; }
.t-dashboard-chip.green { background: #d1fae5; color: #047857; }
.t-dashboard-chip.sky { background: #dbeafe; color: #1d4ed8; }
.t-dashboard-chip.amber { background: #fef3c7; color: #b45309; }
.t-dashboard-chip.red { background: #fee2e2; color: #b91c1c; }
.t-dashboard-btn { display: inline-block; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 800; }
.t-dashboard-btn.amber { background: #fbbf24; color: #0b1324; }
.t-dashboard-panel { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; display: grid; gap: 6px; box-shadow: 0 6px 16px rgba(11,19,36,.05); align-content: start; }
.t-dashboard-panel.center { justify-items: center; text-align: center; }

.t-dashboard-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #f8fafc; max-width: 700px; margin: 0 auto; }
.t-dashboard-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-dashboard-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-dashboard-mock-body { position: relative; padding: 14px; display: grid; gap: 12px; }
.t-dashboard-mock-body.tall { min-height: 220px; }
.t-dashboard-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; background: #0f1a2e; color: #fff; border-radius: 14px; padding: 16px; }
.t-dashboard-kick { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.75); }
.t-dashboard-hero-title { font-size: 20px; font-weight: 800; margin-top: 4px; }
.t-dashboard-hero-title.dark { color: #0b1324; font-size: 17px; margin: 0; }
.t-dashboard-views { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; }
.t-dashboard-view { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; display: grid; gap: 3px; font-size: 13px; color: #0b1324; min-height: 64px; }
.t-dashboard-view.on { border-color: #065f46; background: #ecfdf5; box-shadow: 0 0 0 1px #065f46; }

.t-dashboard-tiles { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 8px; }
.t-dashboard-tile { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px; box-shadow: 0 6px 16px rgba(11,19,36,.05); transition: box-shadow .35s; min-height: 108px; }
.t-dashboard-tile.lit { box-shadow: 0 0 0 4px #fde68a; }
.t-dashboard-big { font-size: 28px; font-weight: 900; color: #0b1324; line-height: 1.15; }
.t-dashboard-big.red { color: #dc2626; } .t-dashboard-big.sky { color: #0284c7; }
.t-dashboard-big.amber { color: #d97706; } .t-dashboard-big.violet { color: #7c3aed; }
.t-dashboard-link { margin-top: 4px; font-size: 11px; font-weight: 700; color: #b45309; }
.t-dashboard-door { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; }
.t-dashboard-arrow { color: #94a3b8; font-weight: 900; font-size: 18px; }
.t-dashboard-page { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; font-size: 13px; font-weight: 800; color: #0b1324; box-shadow: 0 8px 18px rgba(11,19,36,.08); }

.t-dashboard-lists { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 10px; }
.t-dashboard-notes { display: flex; gap: 8px; }
.t-dashboard-note { flex: 1; min-height: 52px; border-radius: 8px; padding: 8px; font-size: 12px; color: #1e293b; border: 1px solid; }
.t-dashboard-note.yellow { background: #fef9c3; border-color: #fde047; }
.t-dashboard-note.blue { background: #e0f2fe; border-color: #7dd3fc; }
.t-dashboard-note.green { background: #dcfce7; border-color: #86efac; }
.t-dashboard-crew { display: grid; grid-template-columns: 100px 76px minmax(0,1fr); align-items: center; gap: 8px; border-left: 4px solid #cbd5e1; padding: 4px 8px; font-size: 12.5px; color: #0b1324; }
.t-dashboard-crew.green { border-color: #10b981; } .t-dashboard-crew.sky { border-color: #3b82f6; } .t-dashboard-crew.amber { border-color: #f59e0b; }
.t-dashboard-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #0b1324; }
.t-dashboard-bar { width: 5px; height: 22px; border-radius: 4px; }
.t-dashboard-bar.green { background: #10b981; } .t-dashboard-bar.amber { background: #f59e0b; } .t-dashboard-bar.gray { background: #94a3b8; }
.t-dashboard-dot { width: 9px; height: 9px; border-radius: 50%; }
.t-dashboard-dot.red { background: #ef4444; } .t-dashboard-dot.amber { background: #f59e0b; } .t-dashboard-dot.sky { background: #0ea5e9; }

.t-dashboard-money { display: grid; grid-template-columns: minmax(0,.8fr) minmax(0,1fr) minmax(0,1.1fr); gap: 10px; }
.t-dashboard-gauge { width: 120px; height: 60px; border-radius: 120px 120px 0 0; background: conic-gradient(from 270deg at 50% 100%, #0ea5e9 0deg 140deg, #e2e8f0 140deg 180deg, transparent 180deg); position: relative; }
.t-dashboard-gauge span { position: absolute; left: 22px; right: 22px; bottom: 0; top: 22px; background: #fff; border-radius: 80px 80px 0 0; }
.t-dashboard-pair { display: grid; gap: 2px; font-size: 12px; color: #475569; }
.t-dashboard-chart { display: flex; align-items: flex-end; gap: 6px; height: 96px; border-bottom: 1px solid #e2e8f0; }
.t-dashboard-bars { flex: 1; height: 100%; display: flex; align-items: flex-end; gap: 2px; position: relative; }
.t-dashboard-bars span { flex: 1; border-radius: 3px 3px 0 0; }
.t-dashboard-bars .in { background: #059669; } .t-dashboard-bars .out { background: #dc2626; }
.t-dashboard-bars.one em { position: absolute; bottom: -16px; left: 0; right: 0; text-align: center; font-size: 9.5px; font-style: normal; color: #64748b; }
.t-dashboard-net { margin-top: 4px; font-size: 12.5px; font-weight: 800; color: #047857; }

.t-dashboard-dispatch { display: grid; grid-template-columns: minmax(0,1fr) 190px; gap: 10px; align-items: start; }
.t-dashboard-hours { display: flex; justify-content: space-between; padding-left: 64px; font-size: 10px; color: #94a3b8; font-weight: 700; }
.t-dashboard-lane { display: grid; grid-template-columns: 56px minmax(0,1fr); align-items: center; gap: 8px; }
.t-dashboard-lane-who { font-size: 12px; font-weight: 800; color: #0b1324; }
.t-dashboard-lane-track { position: relative; height: 28px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; }
.t-dashboard-block { position: absolute; top: 4px; bottom: 4px; border-radius: 4px; border-left: 3px solid; animation: t-dashboard-fade .4s ease both; }
.t-dashboard-block.done { background: #a7f3d0; border-color: #10b981; }
.t-dashboard-block.onsite { background: #fef3c7; border-color: #f59e0b; }
.t-dashboard-block.later { background: #f1f5f9; border-color: #94a3b8; }
.t-dashboard-now { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #f59e0b; }
.t-dashboard-mini { border: 1px solid #fde68a; background: #fffbeb; border-radius: 9px; padding: 6px 8px; font-size: 12px; font-weight: 700; color: #0b1324; display: grid; }
.t-dashboard-mini span { font-weight: 600; color: #b45309; font-size: 10.5px; }

.t-dashboard-tray { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border: 1px dashed #cbd5e1; background: #f8fafc; border-radius: 12px; padding: 10px; margin-bottom: 10px; }
.t-dashboard-add { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 4px 9px; font-size: 12px; font-weight: 700; color: #1e293b; }
.t-dashboard-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
.t-dashboard-wblock { position: relative; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 12px; display: grid; gap: 6px; font-size: 13px; color: #0b1324; min-height: 74px; transition: all .45s; }
.t-dashboard-wblock.edit { box-shadow: 0 0 0 2px rgba(252,211,77,.6); }
.t-dashboard-wblock.moving { transform: translate(-30px, -14px) rotate(-2deg); box-shadow: 0 14px 28px rgba(11,19,36,.18), 0 0 0 2px #fbbf24; }
.t-dashboard-wblock.leaving { opacity: .35; transform: scale(.92); }
.t-dashboard-handles { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; }
.t-dashboard-handles i { font-style: normal; width: 20px; height: 20px; display: grid; place-items: center; border: 1px solid #cbd5e1; border-radius: 5px; background: #fff; font-size: 11px; color: #64748b; }
.t-dashboard-handles i.lit { color: #dc2626; border-color: #fca5a5; box-shadow: 0 0 0 3px #fee2e2; }
.t-dashboard-line { height: 6px; border-radius: 4px; background: #e2e8f0; }
.t-dashboard-line.short { width: 60%; }

.t-dashboard-topbar { display: flex; align-items: center; gap: 8px; background: #0f1a2e; color: #fff; border-radius: 12px; padding: 10px 12px; flex-wrap: wrap; }
.t-dashboard-brand { font-size: 14px; }
.t-dashboard-tb { position: relative; font-size: 12.5px; font-weight: 700; color: rgba(255,255,255,.8); padding: 4px 6px; }
.t-dashboard-tb em { font-style: normal; margin-left: 4px; background: #f59e0b; color: #fff; border-radius: 99px; padding: 0 5px; font-size: 10px; }
.t-dashboard-icon { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; background: rgba(255,255,255,.08); font-size: 13px; font-weight: 800; }
.t-dashboard-plus { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: #f59e0b; font-weight: 900; }
.t-dashboard-tut { border-radius: 99px; background: #fbbf24; color: #0b1324; font-size: 11.5px; font-weight: 900; padding: 4px 10px; box-shadow: 0 0 0 4px rgba(251,191,36,.35); }
.t-dashboard-help { margin: 14px auto 0; max-width: 360px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px; display: grid; gap: 8px; }
.t-dashboard-help-btn { background: #f59e0b; color: #fff; border-radius: 9px; padding: 7px; text-align: center; font-size: 12.5px; font-weight: 800; }
.t-dashboard-tick { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #0b1324; }
.t-dashboard-box { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 4px; background: #d97706; color: #fff; font-size: 11px; font-weight: 900; }

.t-dashboard-tabs { display: flex; flex-wrap: wrap; gap: 14px; border-bottom: 1px solid #e2e8f0; }
.t-dashboard-tab { padding: 6px 2px; font-size: 12.5px; font-weight: 700; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: box-shadow .35s; border-radius: 4px 4px 0 0; }
.t-dashboard-tab.on { color: #0b1324; border-color: #f59e0b; }
.t-dashboard-tab.lit { box-shadow: 0 0 0 4px rgba(251,191,36,.45); }
.t-dashboard-mock-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; }
.t-dashboard-mock-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12px; font-weight: 700; color: #0b1324; }
.t-dashboard-pointer { position: absolute; left: 30%; top: 24%; font-size: 26px; animation: t-dashboard-tap 1.4s ease-in-out infinite; }
.t-dashboard-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-dashboard-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.t-dashboard-avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }

@keyframes t-dashboard-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(12px, -14px) scale(.92); } }
@keyframes t-dashboard-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes t-dashboard-fade { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 760px) {
  .t-dashboard-views, .t-dashboard-mock-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .t-dashboard-tiles { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .t-dashboard-lists, .t-dashboard-money, .t-dashboard-dispatch { grid-template-columns: minmax(0,1fr); }
  .t-dashboard-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .t-dashboard-crew { grid-template-columns: minmax(0,1fr) auto; }
  .t-dashboard-crew .t-dashboard-muted { grid-column: 1 / -1; }
  .t-dashboard-notes { flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  .t-dashboard-in, .t-dashboard-in.show, .t-dashboard-pointer, .t-dashboard-dock, .t-dashboard-block,
  .t-dashboard-tile, .t-dashboard-wblock, .t-dashboard-tab { animation: none !important; transition: none !important; }
  .t-dashboard-wblock.moving { transform: none; }
}
`

export const dashboardScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <DashboardFilmVisual id={id as SceneId} shown={shown} />,
  css: CSS,
  actions: {
    'menu:close': closeMenu,
  },
}
