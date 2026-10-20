import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/team'
import { findVisible, type TutorialNavigate, type TutorialScript } from '../tutorialScript'

/**
 * "Your team" tutorial: the film's drawings, and the few actions that open a
 * form the walk-through points inside. Each scene builds up piece by piece
 * (`shown` counts the pieces on screen) while the narrator reads it.
 * Examples mix trades so they fit any business. Nothing here saves.
 */

type SceneId = 'everyone' | 'three' | 'roles' | 'pay' | 'time' | 'payroll' | 'where' | 'yourturn'

const REVEAL: Record<SceneId, number> = {
  everyone: 4, three: 4, roles: 4, pay: 5, time: 4, payroll: 5, where: 5, yourturn: 3,
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-team-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

function Avatar({ initials, tone = 'amber' }: { initials: string; tone?: 'amber' | 'slate' | 'sky' | 'green' }) {
  return <span className={`t-team-avatar ${tone}`}>{initials}</span>
}

const PEOPLE: Array<{ initials: string; name: string; role: string; badges: Array<{ label: string; kind: 'tech' | 'crew' | 'portal' | 'invite' }>; tone: 'amber' | 'slate' | 'sky' | 'green' }> = [
  { initials: 'JL', name: 'Jordan Lee', role: 'Technician', badges: [{ label: 'Field technician', kind: 'tech' }], tone: 'amber' },
  { initials: 'SP', name: 'Sam Patel', role: 'Dispatcher', badges: [], tone: 'sky' },
  { initials: 'RM', name: 'Riley Moore', role: 'Helper', badges: [{ label: 'No app login', kind: 'crew' }, { label: 'Field technician', kind: 'tech' }], tone: 'slate' },
  { initials: 'AC', name: 'Alex Chen', role: 'Office', badges: [{ label: 'Invite sent', kind: 'invite' }], tone: 'green' },
]

function TeamVisual({ id, shown }: { id: SceneId; shown: number }) {
  switch (id) {
    case 'everyone':
      return (
        <div className="t-team-roster">
          <div className="t-team-roster-head">
            <span>Staff &amp; crews</span>
            <span className="t-team-add">+ Add someone</span>
          </div>
          {PEOPLE.map((p, k) => (
            <Reveal key={p.name} on={shown >= k + 1}>
              <div className="t-team-person">
                <Avatar initials={p.initials} tone={p.tone} />
                <div className="t-team-person-main">
                  <div className="t-team-person-line">
                    <b>{p.name}</b>
                    <span className="t-team-muted">{p.role}</span>
                    {p.badges.map((b) => <span key={b.label} className={`t-team-badge ${b.kind}`}>{b.label}</span>)}
                  </div>
                  <div className="t-team-line w60" />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'three':
      return (
        <div className="t-team-split">
          <Reveal on={shown >= 1}>
            <div className="t-team-card">
              <div className="t-team-person plain">
                <Avatar initials="JL" />
                <div><b>Jordan Lee</b><div className="t-team-muted">HVAC and water heaters</div></div>
              </div>
            </div>
          </Reveal>
          <div className="t-team-stack">
            {[
              { label: 'App access', detail: 'Can they sign in?', on: true },
              { label: 'Role: Technician', detail: 'What can they see and change?', on: true },
              { label: 'Works as a technician', detail: 'Do they show up for field work?', on: true },
            ].map((row, k) => (
              <Reveal key={row.label} on={shown >= k + 2}>
                <div className="t-team-switch">
                  <span className={`t-team-toggle ${row.on ? 'on' : ''}`} aria-hidden="true"><span /></span>
                  <span><b>{row.label}</b><span className="t-team-muted block">{row.detail}</span></span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      )
    case 'roles':
      return (
        <div className="t-team-split">
          <Reveal on={shown >= 1}>
            <div className="t-team-card">
              <div className="t-team-label">Role · Dispatcher</div>
              {[
                ['Customers', 'Edit'],
                ['Jobs', 'Edit'],
                ['Invoices & payments', 'No access'],
                ['Inventory', 'View'],
              ].map(([area, level]) => (
                <div key={area} className="t-team-area">
                  <span>{area}</span>
                  <span className={`t-team-level ${level === 'Edit' ? 'edit' : level === 'View' ? 'view' : 'off'}`}>{level}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <div className="t-team-stack">
            <Reveal on={shown >= 2}>
              <div className="t-team-card">
                <div className="t-team-label">Everyone on it changes with it</div>
                <div className="t-team-faces">
                  <Avatar initials="SP" tone="sky" /><Avatar initials="MK" tone="green" /><Avatar initials="TB" tone="slate" />
                  <span className="t-team-muted">3 people</span>
                </div>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-team-card exception">
                <div className="t-team-label">Just for Sam</div>
                <div className="t-team-area"><span>Invoices & payments</span><span className="t-team-level view">View</span></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <p className="t-team-note">🔒 Owner always keeps full access.</p>
            </Reveal>
          </div>
        </div>
      )
    case 'pay':
      return (
        <div className="t-team-split">
          <div className="t-team-stack">
            {[
              'By the hour',
              'A salary',
              'A share of the work',
              'An hourly rate plus a share',
            ].map((label, k) => (
              <Reveal key={label} on={shown >= k + 1}>
                <div className={`t-team-radio ${k === 3 && shown >= 4 ? 'picked' : ''}`}>
                  <span className="t-team-dot" aria-hidden="true" />{label}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 5}>
            <div className="t-team-week">
              <div className="t-team-label amber">What a week like this would cost you</div>
              <div className="t-team-money"><span>Their time · 40 h × $28.00</span><b>$1,120.00</b></div>
              <div className="t-team-money"><span>Their cut · 8% of $3,400.00 paid</span><b>$272.00</b></div>
              <div className="t-team-money total"><span>That week costs you</span><b>$1,392.00</b></div>
            </div>
          </Reveal>
        </div>
      )
    case 'time':
      return (
        <div className="t-team-split">
          <Reveal on={shown >= 1}>
            <div className="t-team-card">
              <div className="t-team-label">Timesheet · Jordan Lee</div>
              <div className="t-team-clock"><span>📍 Arrived · 123 Main St, Springfield</span><b>8:02 AM</b></div>
              <div className="t-team-clock"><span>🚐 Left the jobsite</span><b>11:40 AM</b></div>
              <div className="t-team-clock total"><span>Water heater swap</span><b>3h 38m</b></div>
            </div>
          </Reveal>
          <div className="t-team-stack">
            <Reveal on={shown >= 2}>
              <div className="t-team-request">
                <div><b>Riley Moore</b> <span className="t-team-muted">Vacation</span></div>
                <div className="t-team-muted">Jun 9 → Jun 13 · All day</div>
                <div className="t-team-chips">
                  <span className={`t-team-status ${shown >= 3 ? 'approved' : 'pending'}`}>{shown >= 3 ? '✓ Approved' : 'Pending'}</span>
                </div>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-team-cal">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => (
                  <div key={d} className="t-team-cal-day"><span>{d}</span><em>Riley off</em></div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'payroll':
      return (
        <div className="t-team-flow">
          {[
            { icon: '💵', label: 'Pay rules' },
            { icon: '⏱', label: 'Clocked hours' },
            { icon: '🧾', label: 'Finished jobs' },
            { icon: '🏖', label: 'Paid leave' },
          ].map((item, k) => (
            <Reveal key={item.label} on={shown >= k + 1}>
              <div className="t-team-input">{item.icon} {item.label}</div>
            </Reveal>
          ))}
          <Reveal on={shown >= 5} className="t-team-span">
            <div className="t-team-card">
              <div className="t-team-label">Check before posting · this month</div>
              <div className="t-team-pay-row head"><span>Who</span><span>Wage</span><span>Commission</span><span>Total</span></div>
              <div className="t-team-pay-row"><span>Jordan Lee</span><span>$4,480.00</span><span>$1,088.00</span><b>$5,568.00</b></div>
              <div className="t-team-pay-row"><span>Riley Moore</span><span>$2,560.00</span><span>$0.00</span><b>$2,560.00</b></div>
            </div>
          </Reveal>
        </div>
      )
    case 'where':
      return (
        <div className="t-team-hub">
          <Reveal on={shown >= 1} className="t-team-hub-center">
            <div className="t-team-hub-core">👥 Your team</div>
          </Reveal>
          {[
            { icon: '🧰', title: 'Lead tech on a job', line: 'Lawn service · Lead tech: Jordan Lee' },
            { icon: '🗺', title: 'Dispatch', line: 'Each technician on the board' },
            { icon: '📅', title: 'The schedule', line: 'Approved time off on the days it covers' },
            { icon: '🏠', title: 'Employee portal', line: 'Today’s jobs, tasks, time off, messages' },
          ].map((spot, k) => (
            <Reveal key={spot.title} on={shown >= k + 2}>
              <div className="t-team-card">
                <div className="t-team-spot-title">{spot.icon} {spot.title}</div>
                <div className="t-team-note">{spot.line}</div>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-team-mock">
          <div className="t-team-mock-bar"><span /><span /><span /></div>
          <div className="t-team-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-team-mock-head">
                <span>Staff &amp; crews</span>
                <span className={`t-team-add ${shown >= 2 ? 'lit' : ''}`}>+ Add someone</span>
              </div>
              {PEOPLE.slice(0, 3).map((p) => (
                <div key={p.name} className="t-team-mock-row"><Avatar initials={p.initials} tone={p.tone} /> {p.name}</div>
              ))}
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-team-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-team-mini-dock"><span className="t-team-avatar small">CB</span> Your turn: click Add someone</div>
            </Reveal>
          </div>
        </div>
      )
  }
}

const CSS = `
.t-team-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-team-in.show { opacity: 1; transform: none; }
.t-team-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 8px; align-content: start; }
.t-team-card.exception { border-color: #fcd34d; box-shadow: 0 0 0 3px #fef3c7; }
.t-team-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-team-label.amber { color: #92400e; }
.t-team-muted { color: #64748b; font-size: 12px; }
.t-team-muted.block, .t-team-switch .block { display: block; }
.t-team-note { margin: 0; font-size: 12.5px; color: #4d586b; }
.t-team-line { height: 7px; border-radius: 99px; background: #e2e8f0; margin-top: 6px; }
.t-team-line.w60 { width: 60%; }
.t-team-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; align-items: start; }
.t-team-span { grid-column: 1 / -1; }
.t-team-stack { display: grid; gap: 8px; }
.t-team-avatar { width: 34px; height: 34px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; color: #0b1324; background: #fde68a; }
.t-team-avatar.slate { background: #e2e8f0; } .t-team-avatar.sky { background: #bae6fd; } .t-team-avatar.green { background: #bbf7d0; }
.t-team-avatar.small { width: 22px; height: 22px; font-size: 9px; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }
.t-team-roster { display: grid; gap: 8px; max-width: 640px; }
.t-team-roster-head, .t-team-mock-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 900; font-size: 16px; color: #0b1324; }
.t-team-add { font-size: 12px; font-weight: 800; color: #fff; background: #f59e0b; border-radius: 8px; padding: 5px 10px; transition: box-shadow .35s; }
.t-team-add.lit { box-shadow: 0 0 0 4px rgba(251,191,36,.45); }
.t-team-person { display: flex; align-items: flex-start; gap: 10px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; }
.t-team-person.plain { border: 0; padding: 0; }
.t-team-person-main { min-width: 0; flex: 1; }
.t-team-person-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13.5px; color: #0b1324; }
.t-team-badge { font-size: 11px; font-weight: 700; border-radius: 99px; padding: 2px 8px; }
.t-team-badge.tech { background: #ecfdf5; color: #065f46; }
.t-team-badge.crew { background: #f1f5f9; color: #475569; }
.t-team-badge.portal { background: #f0f9ff; color: #0369a1; }
.t-team-badge.invite { background: #fffbeb; color: #92400e; }
.t-team-switch { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; font-size: 13.5px; color: #0b1324; }
.t-team-toggle { width: 34px; height: 20px; flex: none; border-radius: 99px; background: #cbd5e1; position: relative; transition: background .35s; }
.t-team-toggle span { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .35s; }
.t-team-toggle.on { background: #f59e0b; }
.t-team-toggle.on span { transform: translateX(14px); }
.t-team-area { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; color: #0b1324; border-top: 1px solid #f1f5f9; padding-top: 6px; }
.t-team-level { font-size: 11.5px; font-weight: 800; border-radius: 7px; padding: 2px 8px; }
.t-team-level.edit { background: #ecfdf5; color: #047857; }
.t-team-level.view { background: #eff6ff; color: #1d4ed8; }
.t-team-level.off { background: #f1f5f9; color: #64748b; }
.t-team-faces { display: flex; align-items: center; gap: 6px; }
.t-team-radio { display: flex; align-items: center; gap: 10px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; font-size: 13.5px; font-weight: 700; color: #0b1324; transition: border-color .35s, background .35s; }
.t-team-radio.picked { border-color: #f59e0b; background: #fffbeb; }
.t-team-dot { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #cbd5e1; flex: none; }
.t-team-radio.picked .t-team-dot { border-color: #f59e0b; box-shadow: inset 0 0 0 3px #fff; background: #f59e0b; }
.t-team-week { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 14px; padding: 14px; display: grid; gap: 8px; }
.t-team-money { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; color: #334155; }
.t-team-money b { font-variant-numeric: tabular-nums; }
.t-team-money.total { border-top: 1px solid #fcd34d; padding-top: 8px; color: #78350f; font-weight: 800; }
.t-team-clock { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; color: #334155; }
.t-team-clock.total { border-top: 1px solid #e2e8f0; padding-top: 6px; font-weight: 700; color: #0b1324; }
.t-team-request { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; display: grid; gap: 4px; font-size: 13px; }
.t-team-chips { margin-top: 4px; }
.t-team-status { font-size: 11px; font-weight: 800; border-radius: 99px; padding: 3px 9px; border: 1px solid; transition: all .35s; }
.t-team-status.pending { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
.t-team-status.approved { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.t-team-cal { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 4px; }
.t-team-cal-day { background: #fff; border: 1px solid #e3e7ee; border-radius: 8px; padding: 6px 4px; font-size: 11px; font-weight: 700; color: #475569; display: grid; gap: 4px; text-align: center; }
.t-team-cal-day em { font-style: normal; font-size: 10px; background: #fef3c7; color: #92400e; border-radius: 5px; padding: 2px 0; }
.t-team-flow { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
.t-team-input { background: #0b1324; color: #fde68a; border-radius: 12px; padding: 10px; font-size: 13px; font-weight: 800; text-align: center; }
.t-team-pay-row { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 8px; font-size: 12.5px; color: #334155; font-variant-numeric: tabular-nums; }
.t-team-pay-row.head { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
.t-team-hub { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.t-team-hub-center { grid-column: 1 / -1; display: flex; justify-content: center; }
.t-team-hub-core { background: #0b1324; color: #fde68a; font-weight: 900; font-size: 15px; border-radius: 999px; padding: 10px 18px; box-shadow: 0 10px 24px rgba(11,19,36,.25); }
.t-team-spot-title { font-size: 14px; font-weight: 800; color: #0b1324; }
.t-team-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-team-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-team-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-team-mock-body { position: relative; padding: 14px; min-height: 210px; display: grid; gap: 8px; }
.t-team-mock-row { display: flex; align-items: center; gap: 10px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; font-size: 13px; font-weight: 700; margin-top: 8px; }
.t-team-pointer { position: absolute; right: 8%; top: 18%; font-size: 26px; animation: t-team-tap 1.4s ease-in-out infinite; }
.t-team-mini-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-team-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes t-team-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-6px, -10px) scale(.92); } }
@keyframes t-team-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@media (max-width: 760px) {
  .t-team-split, .t-team-hub { grid-template-columns: minmax(0,1fr); }
  .t-team-flow { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .t-team-pay-row { grid-template-columns: 1.2fr 1fr 1fr 1fr; font-size: 11.5px; }
}
@media (prefers-reduced-motion: reduce) {
  .t-team-in, .t-team-toggle, .t-team-toggle span, .t-team-radio, .t-team-status, .t-team-add { transition: none; }
  .t-team-pointer, .t-team-mini-dock { animation: none; }
}
`

// ---------- actions: open the form a step points inside ----------

/** Run `fn` on the selector once it's on screen (gives up after `ms`). */
function whenVisible(selector: string, fn: (el: HTMLElement) => void, ms = 5000) {
  const end = Date.now() + ms
  const tick = () => {
    const el = findVisible(selector)
    if (el) { fn(el); return }
    if (Date.now() < end) window.setTimeout(tick, 150)
  }
  tick()
}

const on = (path: string) => window.location.pathname.replace(/\/$/, '') === path
const tour = (id: string) => `[data-tour=${JSON.stringify(id)}]`

/** Be on Staff & crews, on its Staff tab, with no window open over it. */
function staffList(navigate: TutorialNavigate, then: () => void) {
  findVisible(tour('staff-add-cancel'))?.click()
  findVisible(tour('staff-invite-cancel'))?.click()
  if (!on('/tool-shed/staff')) navigate('/tool-shed/staff')
  whenVisible(tour('staff-tab-staff'), (tab) => {
    if (tab.getAttribute('aria-selected') !== 'true') tab.click()
    then()
  })
}

/** Open the first person's settings, just for looking. */
function openPerson(navigate: TutorialNavigate) {
  if (findVisible(tour('staff-edit-modal'))) return
  staffList(navigate, () => whenVisible(tour('staff-person-name'), (name) => name.click()))
}

/** Open a blank Invite staff form (choosing Employee if asked). */
function openInvite(navigate: TutorialNavigate) {
  if (findVisible(tour('staff-invite-modal'))) return
  // Cancel only asks first when pay was changed, and pay is never changed here.
  findVisible(tour('staff-edit-cancel'))?.click()
  staffList(navigate, () =>
    whenVisible(tour('staff-add'), (add) => {
      add.click()
      whenVisible(tour('staff-add-employee'), (employee) => employee.click(), 1500)
    }),
  )
}

function openNewRole(navigate: TutorialNavigate) {
  if (findVisible(tour('roles-new'))) return
  if (!on('/tool-shed/roles')) navigate('/tool-shed/roles')
  whenVisible(tour('roles-new-button'), (button) => button.click())
}

function openTimeOffRequest(navigate: TutorialNavigate) {
  if (findVisible(tour('time-off-form-type'))) return
  if (!on('/tool-shed/time-off')) navigate('/tool-shed/time-off')
  whenVisible(tour('time-off-new'), (button) => button.click())
}

export const teamScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <TeamVisual id={id as SceneId} shown={shown} />,
  css: CSS,
  actions: {
    'team:person': openPerson,
    'team:invite': openInvite,
    'team:role-new': openNewRole,
    'team:timeoff-new': openTimeOffRequest,
  },
}
