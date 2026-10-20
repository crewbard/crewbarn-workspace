import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/getting-around'
import type { TutorialScript } from '../tutorialScript'

/**
 * The Getting around tutorial: a short film about the main menu, section
 * tabs, Tool Shed and the top bar, then a walk through the person's own
 * menu in whichever layout they use.
 *
 * Nothing in the walk saves or changes a setting. The + menu and the
 * account menu are closed with an outside click, Tool Shed is closed with
 * its own button, and the layout is only pointed at, never switched.
 */

type SceneId = 'map' | 'menu' | 'layouts' | 'tabs' | 'toolshed' | 'tools' | 'yourturn'

const REVEAL: Record<SceneId, number> = {
  map: 4, menu: 4, layouts: 6, tabs: 3, toolshed: 4, tools: 4, yourturn: 3,
}

/**
 * Close the + menu or the account menu. Both close on a press anywhere
 * outside them (the press on Do it for me already counts), so this only
 * nudges the same outside press once more in case one is still open.
 */
function closeMenu() {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-getting-around-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

const MAIN = ['Dashboard', 'Jobs', 'Tasks', 'Estimates', 'Customers', 'Schedule', 'Dispatch', 'Accounting']
const SHORT = ['Dashboard', 'Jobs', 'Schedule', 'Customers']

/** A tiny app window used by the layouts scene. */
function MiniFrame({ kind, label, on }: { kind: 'top' | 'side' | 'rail' | 'easy' | 'phone'; label: string; on: boolean }) {
  return (
    <Reveal on={on}>
      <div className={`t-getting-around-frame ${kind}`}>
        {kind === 'top' && (
          <>
            <div className="t-getting-around-fbar">
              <b>CB</b>
              {SHORT.map((x) => <span key={x} className={x === 'Jobs' ? 'lit' : ''}>{x}</span>)}
            </div>
            <div className="t-getting-around-fsub"><i /><i /><i /></div>
            <div className="t-getting-around-fpage"><i /><i className="short" /></div>
          </>
        )}
        {kind === 'side' && (
          <div className="t-getting-around-frow">
            <div className="t-getting-around-fside">
              <b>CB</b>
              {SHORT.map((x) => <span key={x} className={x === 'Jobs' ? 'lit' : ''}>{x}</span>)}
            </div>
            <div className="t-getting-around-fmain">
              <div className="t-getting-around-fslim" />
              <div className="t-getting-around-fpage"><i /><i className="short" /></div>
            </div>
          </div>
        )}
        {kind === 'rail' && (
          <div className="t-getting-around-frow">
            <div className="t-getting-around-frail">
              <em>⌂</em>
              {['Work', 'Comms', 'Money', 'Files', 'Setup'].map((x) => <span key={x} className={x === 'Work' ? 'on' : ''}>{x}</span>)}
            </div>
            <div className="t-getting-around-fpanel">
              {['Dashboard', 'Schedule', 'Jobs', 'Customers'].map((x) => <span key={x} className={x === 'Jobs' ? 'lit' : ''}>{x}</span>)}
            </div>
            <div className="t-getting-around-fmain">
              <div className="t-getting-around-fslim" />
              <div className="t-getting-around-fpage"><i /><i className="short" /></div>
            </div>
          </div>
        )}
        {kind === 'easy' && (
          <div className="t-getting-around-frow">
            <div className="t-getting-around-fside">
              <b>CB</b>
              {['Dashboard', 'Jobs', 'Parts', 'Customers'].map((x) => <span key={x} className={x === 'Jobs' ? 'lit' : ''}>{x}</span>)}
            </div>
            <div className="t-getting-around-fmain">
              <div className="t-getting-around-fslim" />
              <div className="t-getting-around-ftabs"><span className="on">All jobs</span><span>New job</span><span>Warranties</span></div>
              <div className="t-getting-around-fpage"><i /><i className="short" /></div>
            </div>
          </div>
        )}
        {kind === 'phone' && (
          <div className="t-getting-around-fphone">
            <div className="t-getting-around-fphone-bar"><span>☰</span><b>CB</b></div>
            <div className="t-getting-around-fdrawer">
              {SHORT.map((x) => <span key={x} className={x === 'Jobs' ? 'lit' : ''}>{x}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="t-getting-around-flabel">{label}</div>
    </Reveal>
  )
}

function GettingAroundFilmVisual({ id, shown }: { id: SceneId; shown: number }) {
  switch (id) {
    case 'map':
      return (
        <div className="t-getting-around-map">
          {[
            { icon: '☰', title: 'Main menu', line: 'Your everyday places: Jobs, Schedule, Customers…' },
            { icon: '▭', title: 'Section tabs', line: 'Pages inside Accounting, Jobs and more' },
            { icon: '🔧', title: 'Tool Shed', line: 'How your shop runs, and the way to Connect' },
            { icon: '＋', title: 'Top bar tools', line: 'Messages, search, + new, Help, your menu' },
          ].map((card, k) => (
            <Reveal key={card.title} on={shown >= k + 1}>
              <div className="t-getting-around-card">
                <span className="t-getting-around-icon" aria-hidden="true">{card.icon}</span>
                <div>
                  <b>{card.title}</b>
                  <div className="t-getting-around-muted">{card.line}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'menu':
      return (
        <div>
          <Reveal on={shown >= 1}>
            <div className="t-getting-around-bar">
              <b className="t-getting-around-brand">Crew<span>Barn</span> <em>· Acme Services</em></b>
              {MAIN.map((x, k) => (
                <span
                  key={x}
                  className={`t-getting-around-nav ${shown >= (k < 4 ? 2 : 3) ? 'show' : ''} ${shown >= 4 && x === 'Jobs' ? 'lit' : ''}`}
                >
                  {x}
                </span>
              ))}
              <span className={`t-getting-around-nav ${shown >= 3 ? 'show' : ''}`}>Tool Shed ▾</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-getting-around-callout">
              <span className="t-getting-around-chip amber">Jobs</span>
              <span className="t-getting-around-arrow" aria-hidden="true">→</span>
              <span>Every job, from the first call to paid: HVAC tune-up, water heater, door repair, lawn service.</span>
            </div>
          </Reveal>
        </div>
      )
    case 'layouts':
      return (
        <div>
          <div className="t-getting-around-layouts">
            <MiniFrame kind="top" label="Top bar" on={shown >= 1} />
            <MiniFrame kind="side" label="Side bar" on={shown >= 2} />
            <MiniFrame kind="rail" label="Rail" on={shown >= 3} />
            <MiniFrame kind="easy" label="Easy" on={shown >= 4} />
            <MiniFrame kind="phone" label="Phone" on={shown >= 5} />
          </div>
          <Reveal on={shown >= 6}>
            <div className="t-getting-around-same">Same menu. Different place. <span className="t-getting-around-chip amber">Jobs</span> is in every one.</div>
          </Reveal>
        </div>
      )
    case 'tabs':
      return (
        <div className="t-getting-around-window">
          <Reveal on={shown >= 1}>
            <div className="t-getting-around-bar">
              <b className="t-getting-around-brand">Crew<span>Barn</span></b>
              {['Jobs', 'Customers', 'Schedule', 'Accounting'].map((x) => (
                <span key={x} className={`t-getting-around-nav show ${x === 'Accounting' ? 'active' : ''}`}>{x}</span>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-getting-around-sub">
              {['Money desk', 'Cash register', 'Purchase orders', 'Payroll', 'Sales tax', 'Reports'].map((x, k) => (
                <span key={x} className={k === 0 ? 'on' : ''}>{x}</span>
              ))}
              <span className={`t-getting-around-more ${shown >= 3 ? 'lit' : ''}`}>More ▾</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-getting-around-dropdown right">
              {['Overview & charts', 'Invoices', 'Credits', 'Expenses', 'Vendor bills', 'Bank match', 'Ledger', 'Sync maps'].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </Reveal>
        </div>
      )
    case 'toolshed':
      return (
        <div className="t-getting-around-window">
          <Reveal on={shown >= 1}>
            <div className="t-getting-around-bar">
              <b className="t-getting-around-brand">Crew<span>Barn</span></b>
              {['Jobs', 'Schedule', 'Accounting'].map((x) => <span key={x} className="t-getting-around-nav show">{x}</span>)}
              <span className="t-getting-around-nav show lit">Tool Shed ▴</span>
            </div>
          </Reveal>
          <div className="t-getting-around-shed">
            <Reveal on={shown >= 3} className="t-getting-around-span">
              <div className="t-getting-around-connect">
                <div>
                  <b>Business settings</b>
                  <div className="t-getting-around-muted">Manage your company, team, and connections in CrewBarn Connect.</div>
                </div>
                <span className="t-getting-around-btn">Open Connect ↗</span>
              </div>
            </Reveal>
            {[
              ['Create & Send', 'Templates, automations, imports'],
              ['Inventory & Assets', 'Stock, catalogs, vendors'],
              ['Customers & Workflow', 'Job types, statuses, tags'],
              ['Team & Access', 'Staff, roles, time off'],
              ['Connections', 'Phone, email, maps, AI'],
              ['Business Controls', 'Pricing, taxes, billing'],
            ].map(([title, line]) => (
              <Reveal key={title} on={shown >= 2}>
                <div className="t-getting-around-group">
                  <div className="t-getting-around-label">{title}</div>
                  <div className="t-getting-around-muted">{line}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 4}>
            <div className="t-getting-around-callout">
              <span className="t-getting-around-chip sky">Open Connect ↗</span>
              <span className="t-getting-around-arrow" aria-hidden="true">→</span>
              <span>connect.crewbarn.com: your company, team, money and connections, in a new tab.</span>
            </div>
          </Reveal>
        </div>
      )
    case 'tools':
      return (
        <div className="t-getting-around-window">
          <div className="t-getting-around-bar">
            <b className="t-getting-around-brand">Crew<span>Barn</span></b>
            <span className="t-getting-around-grow" />
            <Reveal on={shown >= 1} className="t-getting-around-inline">
              <span className="t-getting-around-tb">Messages</span>
              <span className="t-getting-around-tb">Calls<em>2</em></span>
              <span className="t-getting-around-tb">Intake<em>1</em></span>
            </Reveal>
            <Reveal on={shown >= 2} className="t-getting-around-inline">
              <span className="t-getting-around-cbi">Ask CBI…</span>
              <span className="t-getting-around-ic">🔍</span>
              <span className="t-getting-around-ic">📖</span>
            </Reveal>
            <Reveal on={shown >= 3} className="t-getting-around-inline">
              <span className="t-getting-around-plus">+</span>
            </Reveal>
            <Reveal on={shown >= 4} className="t-getting-around-inline">
              <span className="t-getting-around-ic">🔔</span>
              <span className="t-getting-around-tut">🎓</span>
              <span className="t-getting-around-ic">?</span>
              <span className="t-getting-around-avatar">JL</span>
            </Reveal>
          </div>
          <div className="t-getting-around-drops">
            <Reveal on={shown >= 3}>
              <div className="t-getting-around-dropdown">
                <div className="t-getting-around-label">Create</div>
                {['New Job', 'New Task', 'New Estimate', 'New Service Agreement', 'New Customer', 'New Asset'].map((x) => <span key={x}>{x}</span>)}
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-getting-around-dropdown">
                <div className="t-getting-around-who">jordan@acmeservices.com<span>Owner</span></div>
                {['Bugs & Ideas', 'My time off', 'My account', 'Help'].map((x) => <span key={x}>{x}</span>)}
                <div className="t-getting-around-label">Layout preview</div>
                <span>All layouts</span>
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-getting-around-window tall">
          <div className="t-getting-around-frow big">
            <div className="t-getting-around-fside big">
              <b>Crew<span>Barn</span></b>
              {MAIN.slice(0, 6).map((x) => <span key={x} className={shown >= 2 && x === 'Jobs' ? 'lit' : ''}>{x}</span>)}
            </div>
            <div className="t-getting-around-fmain">
              <Reveal on={shown >= 1}>
                <div className="t-getting-around-welcome">Welcome back, Jordan.</div>
                <div className="t-getting-around-fpage"><i /><i /><i className="short" /></div>
              </Reveal>
            </div>
          </div>
          <Reveal on={shown >= 2}><div className="t-getting-around-pointer" aria-hidden="true">👆</div></Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-getting-around-dock"><span className="t-getting-around-avatar small">CB</span> Your turn: click Jobs</div>
          </Reveal>
        </div>
      )
  }
}

const CSS = `
.t-getting-around-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-getting-around-in.show { opacity: 1; transform: none; }
.t-getting-around-inline { display: inline-flex; align-items: center; gap: 6px; }
.t-getting-around-span { grid-column: 1 / -1; }
.t-getting-around-grow { flex: 1; }
.t-getting-around-muted { font-size: 12px; color: #64748b; }
.t-getting-around-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-getting-around-chip { display: inline-flex; align-items: center; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 800; }
.t-getting-around-chip.amber { background: #fef3c7; color: #b45309; }
.t-getting-around-chip.sky { background: #dbeafe; color: #1d4ed8; }
.t-getting-around-arrow { font-weight: 900; color: #f59e0b; }
.t-getting-around-btn { border: 1px solid #fcd34d; color: #92400e; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 700; background: #fff; white-space: nowrap; }

.t-getting-around-map { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; max-width: 640px; margin: 0 auto; }
.t-getting-around-card { display: flex; gap: 12px; align-items: center; background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 14px; box-shadow: 0 6px 16px rgba(11,19,36,.06); color: #0b1324; font-size: 14px; }
.t-getting-around-icon { width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center; border-radius: 10px; background: #0f1a2e; color: #fbbf24; font-size: 18px; font-weight: 900; }

.t-getting-around-window { position: relative; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #f8fafc; max-width: 720px; margin: 0 auto; }
.t-getting-around-window.tall { min-height: 250px; }
.t-getting-around-bar { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; background: #0f1a2e; color: #fff; border-radius: 12px; padding: 9px 12px; }
.t-getting-around-window .t-getting-around-bar { border-radius: 0; }
.t-getting-around-brand { font-size: 14px; margin-right: 8px; white-space: nowrap; }
.t-getting-around-brand span { color: #fbbf24; }
.t-getting-around-brand em { font-style: normal; font-weight: 600; color: rgba(255,255,255,.65); font-size: 12px; }
.t-getting-around-nav { position: relative; font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,.72); padding: 4px 7px; border-radius: 6px; opacity: 0; transition: opacity .4s, box-shadow .35s, background .35s; }
.t-getting-around-nav.show { opacity: 1; }
.t-getting-around-nav.active { color: #fff; box-shadow: inset 0 -3px 0 #fbbf24; border-radius: 0; }
.t-getting-around-nav.lit { color: #0b1324; background: #fbbf24; }
.t-getting-around-callout { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px auto 0; max-width: 560px; background: #fff; border: 1px solid #fde68a; border-radius: 12px; padding: 10px 12px; font-size: 13px; color: #0b1324; }
.t-getting-around-window .t-getting-around-callout { margin: 10px; }

.t-getting-around-layouts { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; }
.t-getting-around-frame { height: 120px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #f1f5f9; display: flex; flex-direction: column; font-size: 8.5px; font-weight: 700; }
.t-getting-around-flabel { margin-top: 6px; text-align: center; font-size: 12px; font-weight: 800; color: #0b1324; }
.t-getting-around-fbar { display: flex; align-items: center; gap: 3px; background: #0f1a2e; color: rgba(255,255,255,.75); padding: 5px; flex-wrap: wrap; }
.t-getting-around-fbar b, .t-getting-around-fside b { color: #fbbf24; font-size: 9px; }
.t-getting-around-fbar span, .t-getting-around-fside span, .t-getting-around-fpanel span, .t-getting-around-fdrawer span { padding: 1px 3px; border-radius: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t-getting-around-frame .lit { background: #fbbf24; color: #0b1324; box-shadow: 0 0 0 2px rgba(251,191,36,.35); }
.t-getting-around-fsub { display: flex; gap: 4px; padding: 4px 6px; background: #fff; border-bottom: 1px solid #e2e8f0; }
.t-getting-around-fsub i { height: 4px; width: 16px; border-radius: 3px; background: #cbd5e1; }
.t-getting-around-fpage { flex: 1; padding: 6px; display: grid; gap: 4px; align-content: start; }
.t-getting-around-fpage i { height: 6px; border-radius: 3px; background: #cbd5e1; }
.t-getting-around-fpage i.short { width: 60%; }
.t-getting-around-frow { display: flex; flex: 1; min-height: 0; }
.t-getting-around-fside { width: 42%; background: #0f1a2e; color: rgba(255,255,255,.75); padding: 5px 4px; display: flex; flex-direction: column; gap: 2px; }
.t-getting-around-fmain { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.t-getting-around-fslim { height: 12px; background: #0f1a2e; }
.t-getting-around-frail { width: 26%; background: #0f1a2e; color: rgba(255,255,255,.6); display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; font-size: 7px; }
.t-getting-around-frail em { font-style: normal; width: 13px; height: 13px; display: grid; place-items: center; border-radius: 4px; background: #e8902c; color: #0f1a2e; font-size: 8px; }
.t-getting-around-frail span.on { color: #fff; background: rgba(255,255,255,.15); border-radius: 3px; padding: 0 2px; }
.t-getting-around-fpanel { width: 34%; background: #fff; border-right: 1px solid #e2e8f0; padding: 5px 3px; display: flex; flex-direction: column; gap: 2px; color: #475569; }
.t-getting-around-ftabs { display: flex; gap: 3px; padding: 3px 4px; background: #fff; border-bottom: 1px solid #e2e8f0; color: #64748b; }
.t-getting-around-ftabs span.on { color: #0b1324; box-shadow: inset 0 -2px 0 #f59e0b; }
.t-getting-around-fphone { position: relative; width: 58%; margin: 0 auto; flex: 1; border: 2px solid #0f1a2e; border-bottom: 0; border-radius: 10px 10px 0 0; margin-top: 6px; overflow: hidden; background: #f8fafc; }
.t-getting-around-fphone-bar { display: flex; align-items: center; gap: 5px; background: #0f1a2e; color: #fff; padding: 3px 5px; }
.t-getting-around-fphone-bar b { color: #fbbf24; }
.t-getting-around-fdrawer { position: absolute; left: 0; top: 16px; bottom: 0; width: 78%; background: #fff; box-shadow: 4px 0 10px rgba(11,19,36,.2); display: flex; flex-direction: column; gap: 2px; padding: 4px; color: #334155; animation: t-getting-around-slide .6s ease both; }
.t-getting-around-same { margin: 14px auto 0; max-width: 440px; text-align: center; background: #0f1a2e; color: #fff; border-radius: 12px; padding: 10px 14px; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }

.t-getting-around-sub { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12.5px; color: #64748b; }
.t-getting-around-sub span.on { color: #0b1324; font-weight: 800; }
.t-getting-around-more { border-radius: 6px; padding: 2px 6px; transition: box-shadow .35s; }
.t-getting-around-more.lit { color: #0b1324; box-shadow: 0 0 0 3px rgba(251,191,36,.55); }
.t-getting-around-dropdown { display: grid; gap: 2px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px; box-shadow: 0 10px 24px rgba(11,19,36,.12); font-size: 12.5px; color: #334155; min-width: 170px; }
.t-getting-around-dropdown span { padding: 3px 6px; border-radius: 5px; }
.t-getting-around-dropdown.right { grid-template-columns: repeat(2, minmax(0,1fr)); max-width: 340px; margin: 8px 12px 12px auto; }

.t-getting-around-shed { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; padding: 10px; }
.t-getting-around-group { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; display: grid; gap: 3px; }
.t-getting-around-connect { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #fff; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #0b1324; }

.t-getting-around-tb { position: relative; font-size: 12px; font-weight: 700; color: rgba(255,255,255,.82); padding: 4px 5px; }
.t-getting-around-tb em { font-style: normal; margin-left: 4px; background: #f59e0b; color: #fff; border-radius: 99px; padding: 0 5px; font-size: 10px; }
.t-getting-around-cbi { border: 1px solid rgba(255,255,255,.25); border-radius: 99px; padding: 3px 10px; font-size: 11.5px; color: rgba(255,255,255,.7); }
.t-getting-around-ic { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: rgba(255,255,255,.08); font-size: 12px; font-weight: 800; }
.t-getting-around-plus { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: #f59e0b; font-weight: 900; }
.t-getting-around-tut { border-radius: 99px; background: #fbbf24; color: #0b1324; font-size: 11px; font-weight: 900; padding: 3px 8px; box-shadow: 0 0 0 3px rgba(251,191,36,.35); }
.t-getting-around-avatar { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 10px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }
.t-getting-around-avatar.small { width: 22px; height: 22px; font-size: 9px; }
.t-getting-around-drops { display: flex; justify-content: flex-end; gap: 10px; padding: 10px; flex-wrap: wrap; }
.t-getting-around-who { font-size: 12px; font-weight: 700; color: #0b1324; display: grid; padding: 2px 6px 6px; border-bottom: 1px solid #f1f5f9; margin-bottom: 2px; }
.t-getting-around-who span { font-weight: 500; color: #64748b; font-size: 11px; }

.t-getting-around-frow.big { min-height: 250px; }
.t-getting-around-fside.big { width: 170px; font-size: 13px; gap: 4px; padding: 12px 10px; }
.t-getting-around-fside.big b { color: #fff; font-size: 14px; margin-bottom: 6px; }
.t-getting-around-fside.big b span { color: #fbbf24; }
.t-getting-around-fside.big span { padding: 4px 8px; border-radius: 6px; transition: background .35s; }
.t-getting-around-fside.big span.lit { background: #fbbf24; color: #0b1324; box-shadow: 0 0 0 4px rgba(251,191,36,.35); }
.t-getting-around-welcome { padding: 14px 14px 4px; font-size: 18px; font-weight: 800; color: #0b1324; }
.t-getting-around-pointer { position: absolute; left: 120px; top: 70px; font-size: 26px; animation: t-getting-around-tap 1.4s ease-in-out infinite; }
.t-getting-around-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-getting-around-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }

@keyframes t-getting-around-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(10px, -12px) scale(.92); } }
@keyframes t-getting-around-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes t-getting-around-slide { from { transform: translateX(-100%); } to { transform: none; } }
@media (max-width: 760px) {
  .t-getting-around-map { grid-template-columns: minmax(0,1fr); }
  .t-getting-around-layouts { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .t-getting-around-shed { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .t-getting-around-dropdown.right { grid-template-columns: minmax(0,1fr); }
  .t-getting-around-drops { justify-content: flex-start; }
  .t-getting-around-fside.big { width: 120px; }
}
@media (prefers-reduced-motion: reduce) {
  .t-getting-around-in, .t-getting-around-in.show, .t-getting-around-nav, .t-getting-around-pointer,
  .t-getting-around-dock, .t-getting-around-fdrawer, .t-getting-around-more, .t-getting-around-fside.big span { animation: none !important; transition: none !important; }
}
`

export const gettingAroundScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <GettingAroundFilmVisual id={id as SceneId} shown={shown} />,
  css: CSS,
  actions: {
    'menu:close': closeMenu,
  },
}
