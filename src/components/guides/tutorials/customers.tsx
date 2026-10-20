import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/customers'
import { listCustomers } from '@/lib/customers'
import { findVisible, type TutorialNavigate, type TutorialScript } from '../tutorialScript'

/**
 * Customers tutorial: the film's drawings, and the actions that open a
 * customer's tab. Opening a tab only changes the page address, so nothing
 * on the customer is ever changed.
 */

const REVEAL: Record<string, number> = {
  account: 4, types: 3, people: 4, places: 3, page: 4, templates: 4, work: 4, yourturn: 3,
}

const DETAIL = /^\/customers\/(?!new\/?$|search\/?$)[^/]+\/?$/

/** Open one tab of a customer's page: this customer's if one is open, else the first one on the list. */
function openCustomerTab(navigate: TutorialNavigate, tab: string) {
  const path = window.location.pathname
  if (DETAIL.test(path)) {
    navigate(`${path.replace(/\/$/, '')}?tab=${tab}`)
    return
  }
  // Prefer a business customer, so the statement parts have something to show.
  void (async () => {
    try {
      const business = await listCustomers({ customer_type: 'commercial', per_page: 1, sort: 'display_name', direction: 'asc' })
      const first = business.data[0] ?? (await listCustomers({ per_page: 1, sort: 'display_name', direction: 'asc' })).data[0]
      if (first) navigate(`/customers/${first.id}?tab=${tab}`)
      else navigate('/customers')
    } catch {
      navigate('/customers')
    }
  })()
}

/** "Do it for me" on the invoice row: choose a template in the list (never saved). */
function pickTemplate(type: string) {
  const select = findVisible(`[data-tour="customer-template-doc-${type}"]`) as HTMLSelectElement | null
  if (!select || select.disabled) return
  const option = Array.from(select.options).find((o) => o.value && o.value !== select.value)
  if (!option) return
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  setValue?.call(select, option.value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

const TABS = ['overview', 'edit', 'contacts', 'locations', 'jobs', 'estimates', 'invoices', 'assets', 'tasks', 'documents', 'secure-files', 'templates', 'messages', 'activity']

const actions: Record<string, (navigate: TutorialNavigate) => void> = {
  'pick:invoice': () => pickTemplate('invoice'),
}
for (const tab of TABS) actions[`tab:${tab}`] = (navigate) => openCustomerTab(navigate, tab)

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-customers-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

function Visual({ id, shown }: { id: string; shown: number }) {
  switch (id) {
    case 'account':
      return (
        <div className="t-customers-hub">
          <Reveal on={shown >= 1} className="t-customers-hub-center">
            <div className="t-customers-acct">
              <span className="t-customers-avatar">AS</span>
              <div>
                <b>Acme Services</b>
                <div className="t-customers-muted">Commercial · Account #1042</div>
              </div>
            </div>
          </Reveal>
          {[
            { icon: '👥', title: 'People', line: 'Jordan Lee · Sam Ortiz' },
            { icon: '📍', title: 'Places', line: '123 Main St, Springfield' },
            { icon: '🧾', title: 'Work and money', line: 'Jobs, estimates, invoices' },
          ].map((spot, k) => (
            <Reveal key={spot.title} on={shown >= k + 2}>
              <div className="t-customers-card">
                <div className="t-customers-label">{spot.icon} {spot.title}</div>
                <div className="t-customers-line-text">{spot.line}</div>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'types':
      return (
        <div className="t-customers-three">
          {[
            { color: '#3b82f6', type: 'Residential', name: 'Jordan Lee', note: 'First and last name' },
            { color: '#10b981', type: 'Commercial', name: 'Acme Services', note: 'Business name · monthly statement' },
            { color: '#8b5cf6', type: 'Government', name: 'City of Springfield', note: 'Agency name · monthly statement' },
          ].map((row, k) => (
            <Reveal key={row.type} on={shown >= k + 1}>
              <div className="t-customers-card">
                <div className="t-customers-type"><span style={{ background: row.color }} />{row.type}</div>
                <b className="t-customers-name">{row.name}</b>
                <div className="t-customers-muted">{row.note}</div>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'people':
      return (
        <div className="t-customers-stack">
          {[
            { name: 'Jordan Lee', role: 'Main', tone: 'amber', gets: 'Gets “Your tech is on the way”' },
            { name: 'Pat Kim', role: 'Billing', tone: 'soft', gets: 'Gets the invoices' },
            { name: 'Sam Ortiz', role: 'Service', tone: 'sky', gets: 'Called about the visit' },
          ].map((row, k) => (
            <Reveal key={row.name} on={shown >= k + 1}>
              <div className="t-customers-row">
                <span className="t-customers-avatar small">{row.name.split(' ').map((p) => p[0]).join('')}</span>
                <b>{row.name}</b>
                <span className={`t-customers-badge ${row.tone}`}>{row.role}</span>
                <span className="t-customers-muted t-customers-push">{row.gets}</span>
              </div>
            </Reveal>
          ))}
          <Reveal on={shown >= 4}>
            <p className="t-customers-note">Tick the boxes once. CrewBarn sends each thing to the right person.</p>
          </Reveal>
        </div>
      )
    case 'places':
      return (
        <div className="t-customers-three">
          {[
            { nick: 'Main house', addr: '123 Main St, Springfield', badges: ['Primary'] },
            { nick: 'Lake rental', addr: '48 Shore Rd, Springfield', badges: ['Gated'], gate: true },
            { nick: 'Duplex', addr: '9 Elm Ave, Unit B', badges: [] as string[] },
          ].map((loc, k) => (
            <Reveal key={loc.nick} on={shown >= k + 1}>
              <div className="t-customers-card">
                <div className="t-customers-map" aria-hidden="true"><span>📍</span></div>
                <b className="t-customers-name">{loc.nick}</b>
                <div className="t-customers-muted">{loc.addr}</div>
                <div className="t-customers-badges">
                  {loc.badges.map((b) => <span key={b} className={`t-customers-badge ${b === 'Primary' ? 'amber' : 'soft'}`}>{b}</span>)}
                </div>
                {loc.gate && <div className="t-customers-gate">🔒 Gate code ••••</div>}
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'page':
      return (
        <div className="t-customers-mock">
          <Reveal on={shown >= 1}>
            <div className="t-customers-mock-head">
              <span className="t-customers-avatar">AS</span>
              <b>Acme Services</b>
              <span className="t-customers-badge soft">commercial</span>
              <span className="t-customers-btn">+ New job</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-customers-money">
              <div><span>Total billed</span><b>$4,820</b></div>
              <div className="paid"><span>Lifetime paid</span><b>$4,100</b></div>
              <div className="due"><span>Balance due</span><b>$720</b></div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-customers-tabs">
              {['Overview', 'Details', 'Records', 'Files', 'Log'].map((g, k) => (
                <span key={g} className={shown >= 4 && k === 2 ? 'on' : ''}>{g}</span>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-customers-subtabs">Jobs · Estimates · Invoices · Assets · Tasks</div>
          </Reveal>
        </div>
      )
    case 'templates':
      return (
        <div className="t-customers-split">
          <Reveal on={shown >= 1}>
            <div className="t-customers-card">
              <div className="t-customers-label">Everyone else</div>
              <div className="t-customers-paper"><div className="t-customers-paper-band">INVOICE</div><div className="t-customers-bar w80" /><div className="t-customers-bar w60" /></div>
              <div className="t-customers-muted">Your default invoice</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-customers-card">
              <div className="t-customers-label">Acme Services</div>
              <div className="t-customers-paper alt"><div className="t-customers-paper-band">INVOICE · PO 7781</div><div className="t-customers-bar w90" /><div className="t-customers-bar w70" /></div>
              <div className="t-customers-pinned">★ Commercial invoice, just for them</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3} className="t-customers-span">
            <div className="t-customers-overrides">
              {[
                { kind: 'Invoice', pick: 'Commercial invoice ★' },
                { kind: 'Work order', pick: 'Use your default' },
                { kind: 'Statement', pick: 'Monthly statement ★' },
              ].map((row) => (
                <div key={row.kind} className={row.pick.includes('★') ? 'set' : ''}><span>{row.kind}</span><b>{row.pick}</b></div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 4} className="t-customers-span">
            <p className="t-customers-note">Pick one per kind of paperwork, and a text to go with it. Then Save overrides.</p>
          </Reveal>
        </div>
      )
    case 'work':
      return (
        <div className="t-customers-flow">
          <Reveal on={shown >= 1}>
            <div className="t-customers-acct">
              <span className="t-customers-avatar">JL</span>
              <div><b>Jordan Lee</b><div className="t-customers-muted">Residential · 123 Main St</div></div>
            </div>
          </Reveal>
          <div className="t-customers-flow-out">
            {[
              { label: '+ New job', what: 'Water heater install' },
              { label: '+ New Estimate', what: 'HVAC tune-up' },
              { label: '+ New invoice', what: 'Door repair' },
            ].map((item, k) => (
              <Reveal key={item.label} on={shown >= k + 2}>
                <div className="t-customers-row">
                  <span className="t-customers-btn">{item.label}</span>
                  <span aria-hidden="true">→</span>
                  <span className="t-customers-muted">{item.what}</span>
                  <span className="t-customers-badge sky t-customers-push">Customer: Jordan Lee ✓</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-customers-mock">
          <Reveal on={shown >= 1}>
            <div className="t-customers-mock-title">Customers</div>
            <div className="t-customers-list">
              {['Acme Services', 'City of Springfield', 'Jordan Lee'].map((name, k) => (
                <div key={name} className={`t-customers-list-row ${k === 2 && shown >= 2 ? 'lit' : ''}`}>
                  <span className="t-customers-stripe" style={{ background: ['#14b8a6', '#e2e8f0', '#f59e0b'][k] }} />
                  {name}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 2}><div className="t-customers-pointer" aria-hidden="true">👆</div></Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-customers-dock"><span className="t-customers-avatar tiny">CB</span> Your turn: click a customer</div>
          </Reveal>
        </div>
      )
    default:
      return null
  }
}

const css = `
.t-customers-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-customers-in.show { opacity: 1; transform: none; }
.t-customers-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 7px; align-content: start; min-width: 0; }
.t-customers-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-customers-muted { font-size: 12px; color: #64748b; }
.t-customers-note { margin: 4px 0 0; font-size: 12.5px; color: #4d586b; }
.t-customers-name { font-size: 14px; color: #0b1324; }
.t-customers-line-text { font-size: 13px; font-weight: 700; color: #0b1324; }
.t-customers-avatar { width: 34px; height: 34px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 900; color: #fff; background: #0f766e; }
.t-customers-avatar.small { width: 26px; height: 26px; font-size: 10px; background: #334155; }
.t-customers-avatar.tiny { width: 20px; height: 20px; font-size: 8px; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b); }
.t-customers-hub { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
.t-customers-hub-center { grid-column: 1 / -1; display: flex; justify-content: center; }
.t-customers-acct { display: inline-flex; align-items: center; gap: 10px; background: #0b1324; color: #fff; border-radius: 999px; padding: 8px 18px 8px 8px; box-shadow: 0 10px 24px rgba(11,19,36,.25); }
.t-customers-acct .t-customers-muted { color: #fde68a; }
.t-customers-three { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
.t-customers-type { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 800; color: #0b1324; }
.t-customers-type span { width: 11px; height: 11px; border-radius: 50%; }
.t-customers-stack { display: grid; gap: 9px; max-width: 640px; }
.t-customers-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 9px 12px; font-size: 13px; color: #0b1324; }
.t-customers-push { margin-left: auto; }
.t-customers-badge { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; border-radius: 99px; padding: 2px 8px; border: 1px solid transparent; }
.t-customers-badge.amber { background: #f59e0b; color: #fff; }
.t-customers-badge.soft { background: #fffbeb; color: #92400e; border-color: #fde68a; }
.t-customers-badge.sky { background: #f0f9ff; color: #0369a1; border-color: #bae6fd; text-transform: none; letter-spacing: 0; }
.t-customers-badges { display: flex; gap: 5px; min-height: 18px; }
.t-customers-map { height: 54px; border-radius: 10px; background: linear-gradient(135deg, #e0f2fe 25%, #dcfce7 25% 50%, #e0f2fe 50% 75%, #dcfce7 75%); background-size: 22px 22px; display: grid; place-items: center; font-size: 18px; }
.t-customers-gate { font-size: 12px; font-weight: 700; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 4px 8px; }
.t-customers-mock { position: relative; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; padding: 14px; max-width: 680px; margin: 0 auto; min-height: 220px; display: grid; gap: 10px; align-content: start; }
.t-customers-mock-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 15px; color: #0b1324; }
.t-customers-btn { margin-left: auto; background: #f59e0b; color: #fff; font-size: 12px; font-weight: 800; border-radius: 8px; padding: 5px 10px; white-space: nowrap; }
.t-customers-row .t-customers-btn { margin-left: 0; }
.t-customers-money { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.t-customers-money > div { background: #fff; padding: 8px 10px; display: grid; gap: 2px; }
.t-customers-money > div.paid { background: #ecfdf5; } .t-customers-money > div.due { background: #fff1f2; }
.t-customers-money span { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
.t-customers-money b { font-family: ui-monospace, monospace; font-size: 15px; color: #0b1324; }
.t-customers-tabs { display: flex; flex-wrap: wrap; border-bottom: 1px solid #e2e8f0; }
.t-customers-tabs span { padding: 7px 12px; font-size: 13px; font-weight: 700; color: #64748b; border-bottom: 2px solid transparent; transition: all .35s; }
.t-customers-tabs span.on { color: #0b1324; border-color: #f59e0b; background: #fffbeb; }
.t-customers-subtabs { font-size: 12px; font-weight: 700; color: #475569; background: #f8fafc; border-radius: 8px; padding: 6px 10px; }
.t-customers-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 14px; align-items: start; }
.t-customers-span { grid-column: 1 / -1; }
.t-customers-paper { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; display: grid; gap: 6px; padding-bottom: 8px; }
.t-customers-paper-band { background: #64748b; color: #fff; font-size: 10.5px; font-weight: 900; letter-spacing: .1em; padding: 4px 8px; }
.t-customers-paper.alt .t-customers-paper-band { background: #0f766e; }
.t-customers-bar { height: 7px; border-radius: 99px; background: #e2e8f0; margin: 0 8px; }
.t-customers-bar.w90 { width: 85%; } .t-customers-bar.w80 { width: 75%; } .t-customers-bar.w70 { width: 65%; } .t-customers-bar.w60 { width: 55%; }
.t-customers-pinned { font-size: 12px; font-weight: 800; color: #047857; }
.t-customers-overrides { display: grid; gap: 6px; }
.t-customers-overrides > div { display: flex; justify-content: space-between; gap: 10px; background: #fff; border: 1px solid #e3e7ee; border-radius: 10px; padding: 7px 12px; font-size: 13px; color: #334155; }
.t-customers-overrides > div.set { border-color: #a7f3d0; background: #ecfdf5; color: #065f46; }
.t-customers-flow { display: grid; gap: 12px; justify-items: start; }
.t-customers-flow-out { display: grid; gap: 8px; width: 100%; max-width: 640px; }
.t-customers-mock-title { font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 8px; }
.t-customers-list { display: grid; gap: 6px; }
.t-customers-list-row { display: flex; align-items: center; gap: 10px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px 10px 0; overflow: hidden; font-size: 13px; font-weight: 700; color: #0b1324; transition: all .4s; }
.t-customers-list-row.lit { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251,191,36,.35); }
.t-customers-stripe { width: 4px; align-self: stretch; margin: -10px 0; }
.t-customers-pointer { position: absolute; left: 62%; top: 62%; font-size: 26px; animation: t-customers-tap 1.4s ease-in-out infinite; }
.t-customers-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-customers-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes t-customers-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px, 6px) scale(.92); } }
@keyframes t-customers-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@media (max-width: 760px) {
  .t-customers-hub, .t-customers-three, .t-customers-split, .t-customers-money { grid-template-columns: minmax(0,1fr); }
  .t-customers-push { margin-left: 0; }
  .t-customers-dock { position: static; margin-top: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .t-customers-in, .t-customers-tabs span, .t-customers-list-row { transition: none; }
  .t-customers-pointer, .t-customers-dock { animation: none; }
}
`

export const customersScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <Visual id={id} shown={shown} />,
  css,
  actions,
}
