import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/messages'
import { listCustomers } from '@/lib/customers'
import { listWorkOrders } from '@/lib/workOrders'
import { findVisible, type TutorialNavigate, type TutorialScript } from '../tutorialScript'

/**
 * The Messages tutorial: a short film about the inbox, replying, linking,
 * calls and the Intake queue, then a walk through the real pages. The actions
 * below only open things to look at (a conversation, a customer's or a job's
 * Messages tab). Nothing is sent, linked, assigned or saved.
 */

const REVEAL: Record<string, number> = {
  inbox: 4, queues: 4, thread: 4, link: 4, calls: 4, intake: 4, where: 4, yourturn: 3,
}

const COMMS = /^\/communications\/?$/
const CUSTOMER = /^\/customers\/(?!new\/?$|search\/?$)[^/]+\/?$/
const JOB = /^\/jobs\/(?!new\/?$)[^/]+\/?$/

/**
 * Open a conversation on Messages for looking at: optionally switch to a view
 * first (Calls), then click the first row, unfolding "Earlier this week" when
 * today is empty. Opening a thread only shows it.
 */
function openThread(navigate: TutorialNavigate, view?: string) {
  const here = COMMS.test(window.location.pathname)
  if (!here) navigate('/communications')
  let tries = 0
  let viewReady = !view
  const tick = () => {
    tries += 1
    if (tries > 40) return
    if (!viewReady) {
      const button = findVisible(`[data-tour="comms-view-${view}"]`)
      if (!button) { window.setTimeout(tick, 200); return }
      if (button.getAttribute('aria-pressed') !== 'true') button.click()
      viewReady = true
      window.setTimeout(tick, 600)
      return
    }
    const row = findVisible('[data-tour="comms-row"]')
    if (row) { row.click(); return }
    const earlier = findVisible('[data-tour="comms-earlier"]')
    if (earlier && earlier.getAttribute('aria-expanded') !== 'true') {
      earlier.click()
      window.setTimeout(tick, 300)
      return
    }
    window.setTimeout(tick, 250)
  }
  window.setTimeout(tick, here ? 0 : 500)
}

/** This customer's Messages tab if one is open, else the first customer's. */
function openCustomerMessages(navigate: TutorialNavigate) {
  const path = window.location.pathname
  if (CUSTOMER.test(path)) { navigate(`${path.replace(/\/$/, '')}?tab=messages`); return }
  void (async () => {
    try {
      const first = (await listCustomers({ per_page: 1, sort: 'display_name', direction: 'asc' })).data[0]
      navigate(first ? `/customers/${first.id}?tab=messages` : '/customers')
    } catch {
      navigate('/customers')
    }
  })()
}

/** This job's Messages tab if one is open, else the most recent job's. */
function openJobMessages(navigate: TutorialNavigate) {
  const path = window.location.pathname
  if (JOB.test(path)) { navigate(`${path.replace(/\/$/, '')}?tab=messages`); return }
  void (async () => {
    try {
      const first = (await listWorkOrders({ per_page: 1 })).data[0]
      navigate(first ? `/jobs/${first.id}?tab=messages` : '/jobs')
    } catch {
      navigate('/jobs')
    }
  })()
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-messages-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

function Face({ name, tone = 'navy' }: { name: string; tone?: 'navy' | 'amber' | 'slate' }) {
  return <span className={`t-messages-face ${tone}`} aria-hidden="true">{name.split(' ').map((w) => w[0]).join('')}</span>
}

function Kind({ kind }: { kind: 'Text' | 'Call' | 'Email' | 'Voicemail' }) {
  return <span className={`t-messages-kind ${kind.toLowerCase()}`}>{kind}</span>
}

function Visual({ id, shown }: { id: string; shown: number }) {
  switch (id) {
    case 'inbox':
      return (
        <div className="t-messages-split">
          <div className="t-messages-stack">
            {[
              { k: 'Text' as const, who: 'Jordan Lee', what: 'Can you come Thursday instead?' },
              { k: 'Call' as const, who: '(555) 201-4410', what: 'Water heater is leaking in the garage' },
              { k: 'Email' as const, who: 'Acme Property Mgmt', what: 'Re: Quarterly HVAC tune-ups' },
            ].map((row, k) => (
              <Reveal key={row.who} on={shown >= k + 1}>
                <div className="t-messages-row">
                  <Face name={row.who.startsWith('(') ? '?' : row.who} tone={row.who.startsWith('(') ? 'slate' : 'navy'} />
                  <div className="t-messages-row-main">
                    <div className="t-messages-row-top"><b>{row.who}</b><Kind kind={row.k} /></div>
                    <span className="t-messages-muted">{row.what}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 4}>
            <div className="t-messages-card">
              <div className="t-messages-label">Next door</div>
              <div className="t-messages-tabs">
                <span className="lit">Messages</span><span>Calls</span><span>Intake queue</span>
              </div>
              <div className="t-messages-muted">Calls nobody has picked up yet, and new requests waiting as drafts.</div>
            </div>
          </Reveal>
        </div>
      )
    case 'queues':
      return (
        <div className="t-messages-split rail">
          <Reveal on={shown >= 1}>
            <div className="t-messages-card">
              <div className="t-messages-rail-item active">Inbox · this week</div>
              <Reveal on={shown >= 2}>
                <div className="t-messages-label">My queue</div>
                {[['Needs action', 3], ['Unread', 5], ['Unknown callers', 2], ['Assigned to me', 1]].map(([label, n]) => (
                  <div key={label} className="t-messages-rail-item">{label}<span className="t-messages-count">{n}</span></div>
                ))}
              </Reveal>
            </div>
          </Reveal>
          <div className="t-messages-stack">
            <Reveal on={shown >= 1}>
              <div className="t-messages-band dark">Today <span className="t-messages-pill amber">4 open</span></div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-messages-band">▸ Earlier this week <span className="t-messages-pill">12</span></div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-messages-archive">
                <b>Sunday night → Archive</b>
                <span className="t-messages-muted">Every message still stays on its customer and job.</span>
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'thread':
      return (
        <div className="t-messages-phone-wrap">
          <div className="t-messages-thread">
            <Reveal on={shown >= 1}>
              <div className="t-messages-bubble in">Hi, the AC is blowing warm air again. Any chance today?</div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-messages-bubble out">Jordan can be there at 2pm. Does that work?</div>
              <div className="t-messages-read">Read by Sam Rivera</div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-messages-bubble in photo"><span className="t-messages-photo" aria-hidden="true" />Here’s the unit</div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-messages-email">
                <div className="t-messages-row-top"><b>Your invoice from Acme Services</b><span className="t-messages-pill green">Opened</span></div>
                <span className="t-messages-muted">You → jordan@example.com</span>
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 2}>
            <div className="t-messages-replybox"><span>Type a reply…</span><span className="t-messages-send">Send</span></div>
          </Reveal>
        </div>
      )
    case 'link':
      return (
        <div className="t-messages-flow">
          <Reveal on={shown >= 1}>
            <div className="t-messages-card">
              <div className="t-messages-row-top"><b>(555) 201-4410</b><span className="t-messages-pill">unknown</span></div>
              <span className="t-messages-btn amber">+ Link to customer</span>
              <Reveal on={shown >= 2}>
                <div className="t-messages-picked">✓ Taylor Brooks · number saved</div>
              </Reveal>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}><span className="t-messages-arrow" aria-hidden="true">→</span></Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-messages-card">
              <span className="t-messages-btn amber">+ Link to job</span>
              <div className="t-messages-job">#1042 · Door repair, back entrance</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 4}><span className="t-messages-arrow" aria-hidden="true">→</span></Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-messages-card">
              <div className="t-messages-label">Job #1042 · Messages</div>
              <div className="t-messages-muted">The thread lives on the job now, out of the inbox.</div>
            </div>
          </Reveal>
        </div>
      )
    case 'calls':
      return (
        <div className="t-messages-card wide">
          <Reveal on={shown >= 1}>
            <div className="t-messages-row-top"><b>📞 Inbound call</b><span className="t-messages-muted">10:42 AM · 3:18</span></div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-messages-label">What they need</div>
            <div className="t-messages-summary">Water heater leaking in the garage, wants someone out today.</div>
            <div className="t-messages-chips">
              <span><small>Service</small>Water heater repair</span>
              <span className="hot"><small>Urgency</small>Today</span>
              <span><small>Area</small>Springfield</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-messages-turns">
              <div className="t-messages-turn customer"><small>Customer</small>It’s pooling under the tank.</div>
              <div className="t-messages-turn office"><small>Dispatch</small>We can have someone there by one.</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className="t-messages-actions">
              <span className="t-messages-btn solid">Create job from this call</span>
              <span className="t-messages-btn">▶ Play recording</span>
              <span className="t-messages-btn">Read transcript</span>
            </div>
          </Reveal>
        </div>
      )
    case 'intake':
      return (
        <div className="t-messages-split">
          <Reveal on={shown >= 1}>
            <div className="t-messages-card">
              <div className="t-messages-label">Intake line · text</div>
              <div className="t-messages-bubble in small">Hi, this is Casey at 123 Main St. Our lawn sprinklers won’t shut off.</div>
            </div>
          </Reveal>
          <div className="t-messages-stack">
            <Reveal on={shown >= 2}>
              <div className="t-messages-card">
                <div className="t-messages-row-top"><b>Casey Morgan</b><span className="t-messages-pill amber">pending</span></div>
                <div className="t-messages-field"><small>Address</small>123 Main St, Springfield</div>
                <div className="t-messages-field"><small>Job</small>Sprinkler system won’t shut off</div>
                <div className="t-messages-field"><small>Phone</small><i>Not captured</i></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-messages-note">You check it and fix what’s off.</div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-messages-actions">
                <span className="t-messages-btn">Dismiss</span>
                <span className="t-messages-btn solid">Create job</span>
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'where':
      return (
        <div className="t-messages-grid">
          {[
            { head: 'Customer · Messages', body: 'General · Job #1042 · Job #1077' },
            { head: 'Job · Messages', body: 'Just the threads for this job' },
            { head: '🔔 New message', body: 'Jordan Lee: Thursday works!' },
            { head: 'Tool Shed · Communication', body: 'Phone · Texting · Transcription · Email' },
          ].map((card, k) => (
            <Reveal key={card.head} on={shown >= k + 1}>
              <div className="t-messages-card">
                <b>{card.head}</b>
                <span className="t-messages-muted">{card.body}</span>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-messages-mock">
          <div className="t-messages-mock-bar"><span /><span /><span /></div>
          <div className="t-messages-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-messages-mock-cols">
                <div className="t-messages-mock-rail">
                  <b>Messages</b>
                  {['Inbox · this week', 'Needs action', 'Unread', 'Texts', 'Calls'].map((v) => (
                    <span key={v} className={v === 'Calls' && shown >= 2 ? 'lit' : ''}>{v}</span>
                  ))}
                </div>
                <div className="t-messages-mock-rows"><span /><span /><span /><span /></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-messages-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-messages-dock"><span className="t-messages-dock-avatar">CB</span> Your turn: open a conversation</div>
            </Reveal>
          </div>
        </div>
      )
    default:
      return null
  }
}

const CSS = `
.t-messages-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-messages-in.show { opacity: 1; transform: none; }
.t-messages-split { display: grid; grid-template-columns: minmax(0,1.2fr) minmax(0,1fr); gap: 14px; align-items: start; }
.t-messages-split.rail { grid-template-columns: minmax(0,.9fr) minmax(0,1.2fr); }
.t-messages-stack { display: grid; gap: 9px; }
.t-messages-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 7px; align-content: start; font-size: 13px; color: #0b1324; }
.t-messages-card.wide { max-width: 640px; margin: 0 auto; }
.t-messages-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-messages-muted { color: #64748b; font-size: 12px; display: block; }
.t-messages-row { display: flex; gap: 10px; align-items: center; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 9px 12px; font-size: 13px; color: #0b1324; box-shadow: 0 6px 14px rgba(11,19,36,.05); }
.t-messages-row-main { min-width: 0; display: grid; gap: 2px; }
.t-messages-row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.t-messages-face { width: 30px; height: 30px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 10.5px; font-weight: 900; }
.t-messages-face.navy { background: #0b1324; color: #fde68a; }
.t-messages-face.slate { background: #f1f5f9; color: #94a3b8; }
.t-messages-kind { font-size: 9.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; border-radius: 999px; padding: 1px 7px; border: 1px solid; }
.t-messages-kind.text { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.t-messages-kind.call, .t-messages-kind.voicemail { background: #fdf2f8; color: #be185d; border-color: #fbcfe8; }
.t-messages-kind.email { background: #eef2ff; color: #4338ca; border-color: #c7d2fe; }
.t-messages-tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid #e2e8f0; }
.t-messages-tabs span { font-size: 12px; font-weight: 700; color: #64748b; padding: 6px 8px; border-bottom: 2px solid transparent; }
.t-messages-tabs span.lit { color: #0b1324; border-bottom-color: #f59e0b; }
.t-messages-rail-item { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; padding: 6px 9px; border-radius: 8px; color: #334155; }
.t-messages-rail-item.active { background: #f59e0b; color: #fff; font-weight: 700; }
.t-messages-count { background: #e2e8f0; color: #475569; border-radius: 999px; font-size: 10.5px; font-weight: 800; padding: 1px 7px; }
.t-messages-band { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
.t-messages-band.dark { background: #0f172a; color: #fff; border-color: #0f172a; }
.t-messages-pill { font-size: 10.5px; font-weight: 800; border-radius: 999px; padding: 1px 8px; background: #e2e8f0; color: #475569; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.t-messages-pill.amber { background: #f59e0b; color: #fff; }
.t-messages-pill.green { background: #d1fae5; color: #065f46; }
.t-messages-archive { border: 1px dashed #cbd5e1; border-radius: 12px; padding: 10px 12px; background: #fff; display: grid; gap: 3px; font-size: 13px; color: #0b1324; }
.t-messages-phone-wrap { max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #f8fafc; }
.t-messages-thread { padding: 14px; display: grid; gap: 8px; min-height: 180px; align-content: start; }
.t-messages-bubble { max-width: 78%; border-radius: 16px; padding: 8px 12px; font-size: 13px; line-height: 1.4; width: fit-content; }
.t-messages-bubble.in { background: #fff; border: 1px solid #e2e8f0; color: #1e293b; border-bottom-left-radius: 4px; }
.t-messages-bubble.out { margin-left: auto; background: #f59e0b; color: #fff; border-bottom-right-radius: 4px; }
.t-messages-bubble.small { max-width: 100%; }
.t-messages-bubble.photo { display: flex; align-items: center; gap: 8px; }
.t-messages-photo { width: 44px; height: 34px; border-radius: 6px; background: linear-gradient(135deg, #cbd5e1, #94a3b8); flex: none; }
.t-messages-read { text-align: right; font-size: 11px; color: #94a3b8; margin-top: 2px; }
.t-messages-email { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 8px 12px; font-size: 13px; color: #0b1324; display: grid; gap: 2px; }
.t-messages-replybox { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-top: 1px solid #e2e8f0; background: #fff; padding: 10px 12px; font-size: 13px; color: #94a3b8; }
.t-messages-send { background: #f59e0b; color: #fff; font-weight: 700; border-radius: 8px; padding: 5px 12px; }
.t-messages-flow { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr); gap: 10px; align-items: center; }
.t-messages-arrow { font-size: 22px; font-weight: 900; color: #f59e0b; display: block; text-align: center; }
.t-messages-btn { display: inline-block; width: fit-content; font-size: 12px; font-weight: 700; border-radius: 8px; padding: 5px 10px; border: 1px solid #cbd5e1; color: #334155; background: #fff; }
.t-messages-btn.amber { border-color: #fcd34d; background: #fffbeb; color: #92400e; }
.t-messages-btn.solid { border-color: #f59e0b; background: #f59e0b; color: #fff; }
.t-messages-picked { font-size: 12.5px; font-weight: 700; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9px; padding: 6px 9px; }
.t-messages-job { font-size: 12.5px; font-weight: 700; color: #065f46; border: 1px solid #6ee7b7; background: #ecfdf5; border-radius: 999px; padding: 3px 10px; width: fit-content; }
.t-messages-summary { font-size: 13.5px; color: #334155; }
.t-messages-chips { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 7px; }
.t-messages-chips span { border: 1px solid #e2e8f0; border-radius: 9px; padding: 6px 9px; font-weight: 700; font-size: 12.5px; display: grid; gap: 1px; }
.t-messages-chips span.hot { color: #dc2626; }
.t-messages-chips small, .t-messages-turn small, .t-messages-field small { font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8; }
.t-messages-turns { display: grid; gap: 6px; margin-top: 4px; }
.t-messages-turn { width: fit-content; max-width: 80%; border-radius: 12px; border: 1px solid; padding: 6px 10px; font-size: 12.5px; display: grid; gap: 1px; }
.t-messages-turn.customer { border-color: #bae6fd; background: #f0f9ff; }
.t-messages-turn.office { margin-left: auto; border-color: #fde68a; background: #fffbeb; }
.t-messages-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.t-messages-field { display: grid; grid-template-columns: 70px minmax(0,1fr); gap: 6px; align-items: baseline; font-size: 12.5px; }
.t-messages-field i { color: #94a3b8; }
.t-messages-note { font-size: 13px; font-weight: 700; color: #334155; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 8px 12px; }
.t-messages-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; max-width: 640px; margin: 0 auto; }
.t-messages-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-messages-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-messages-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-messages-mock-body { position: relative; padding: 14px; min-height: 210px; }
.t-messages-mock-cols { display: grid; grid-template-columns: 150px minmax(0,1fr); gap: 12px; }
.t-messages-mock-rail { display: grid; gap: 4px; align-content: start; font-size: 12px; color: #64748b; }
.t-messages-mock-rail b { color: #0b1324; font-size: 15px; margin-bottom: 4px; }
.t-messages-mock-rail span { padding: 4px 7px; border-radius: 6px; transition: all .4s; }
.t-messages-mock-rail span.lit { background: #f59e0b; color: #fff; font-weight: 700; box-shadow: 0 0 0 3px rgba(251,191,36,.35); }
.t-messages-mock-rows { display: grid; gap: 7px; align-content: start; }
.t-messages-mock-rows span { height: 30px; border-radius: 8px; background: #f1f5f9; }
.t-messages-pointer { position: absolute; left: 24%; top: 58%; font-size: 26px; animation: t-messages-tap 1.4s ease-in-out infinite; }
.t-messages-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-messages-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.t-messages-dock-avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }
@keyframes t-messages-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-10px, 6px) scale(.92); } }
@keyframes t-messages-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@media (max-width: 760px) {
  .t-messages-split, .t-messages-split.rail, .t-messages-flow, .t-messages-grid { grid-template-columns: minmax(0,1fr); }
  .t-messages-arrow { transform: rotate(90deg); }
  .t-messages-chips { grid-template-columns: minmax(0,1fr); }
  .t-messages-mock-cols { grid-template-columns: minmax(0,1fr); }
  .t-messages-mock-rows { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .t-messages-in, .t-messages-mock-rail span { transition: none !important; }
  .t-messages-pointer, .t-messages-dock { animation: none !important; }
}
`

export const messagesScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <Visual id={id} shown={shown} />,
  css: CSS,
  actions: {
    'comms:first': (navigate) => openThread(navigate),
    'comms:first-call': (navigate) => openThread(navigate, 'calls'),
    'customer:messages': (navigate) => openCustomerMessages(navigate),
    'job:messages': (navigate) => openJobMessages(navigate),
  },
}
