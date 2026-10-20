import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/invoices'
import { findVisible, type TutorialNavigate, type TutorialScript } from '../tutorialScript'

/**
 * Invoices and getting paid. The film is drawn here; the words and steps
 * live in lib/tutorials/invoices.ts.
 *
 * The walk-through only opens things: an invoice, its View / Print window,
 * the payment windows. It never records, sends or cancels anything.
 */

type SceneId = 'flow' | 'make' | 'states' | 'send' | 'pay' | 'partial' | 'where' | 'yourturn'

const REVEAL: Record<SceneId, number> = {
  flow: 4, make: 3, states: 6, send: 3, pay: 4, partial: 3, where: 5, yourturn: 3,
}

// ---------- actions ----------

const CARD = '[data-tour="invoice-card"]'
const OPEN_CARD = '[data-tour="invoice-card"][data-open="true"]'
const CLOSE_PREVIEW = '[data-tour="invoice-print-toolbar"] button[aria-label="Close"]'
const onList = () => /^\/accounting\/invoices\/?$/.test(window.location.pathname)
const onDetail = () => /^\/invoices\/[^/]+\/?$/.test(window.location.pathname)

/** Wait (a little) for something to show up, then use it. */
function when(selector: string, ms: number, use: (el: HTMLElement) => void) {
  const end = Date.now() + ms
  const tick = () => {
    const el = findVisible(selector)
    if (el) { use(el); return }
    if (Date.now() < end) window.setTimeout(tick, 150)
  }
  tick()
}

/**
 * Open an invoice to look at: one that still has a balance when there is
 * one (so the payment steps have something to show), otherwise the first.
 */
function openInvoice(navigate: TutorialNavigate, then?: () => void) {
  if (onDetail()) { then?.(); return }
  if (!onList()) navigate('/accounting/invoices')
  when('[data-tour="invoices-view"]', 6000, () => {
    findVisible('[data-tour="invoices-view-cards"][aria-pressed="false"]')?.click()
    when(CARD, 6000, () => {
      ;(findVisible(OPEN_CARD) ?? findVisible(CARD))?.click()
      if (then) when('[data-tour="invoice-actions"]', 6000, then)
    })
  })
}

export const invoicesScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <InvoicesFilmVisual id={id as SceneId} shown={shown} />,
  css: CSS(),
  actions: {
    // An invoice, with its View / Print window closed.
    'invoice:open': (navigate) => {
      findVisible(CLOSE_PREVIEW)?.click()
      openInvoice(navigate)
    },
    // An invoice with its View / Print window open.
    'invoice:preview': (navigate) => {
      openInvoice(navigate, () => {
        if (!findVisible('[data-tour="invoice-print-toolbar"]')) findVisible('[data-tour="invoice-print"]')?.click()
      })
    },
  },
}

// ---------- film ----------

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-invoices-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

type Tone = 'draft' | 'sent' | 'partial' | 'overdue' | 'paid' | 'void'

function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`t-invoices-tag ${tone}`}>{children}</span>
}

function InvoicesFilmVisual({ id, shown }: { id: SceneId; shown: number }) {
  switch (id) {
    case 'flow':
      return (
        <div className="t-invoices-flow">
          {[
            { icon: '🔧', title: 'Work done', line: 'Water heater swap · Jordan Lee', tag: null },
            { icon: '🧾', title: 'Invoice made', line: 'INV-1042 · $640.00', tag: <Tag tone="draft">Draft</Tag> },
            { icon: '✉', title: 'Sent', line: 'Due in 14 days', tag: <Tag tone="sent">Sent</Tag> },
            { icon: '✓', title: 'Paid', line: 'Check #2210 · $640.00', tag: <Tag tone="paid">Paid</Tag> },
          ].map((s, k) => (
            <Reveal key={s.title} on={shown >= k + 1} className="t-invoices-flow-step">
              <div className={`t-invoices-card ${shown >= 4 && k === 3 ? 'won' : ''}`}>
                <div className="t-invoices-flow-icon" aria-hidden="true">{s.icon}</div>
                <b>{s.title}</b>
                <span className="t-invoices-muted">{s.line}</span>
                {s.tag}
              </div>
              {k < 3 && <span className="t-invoices-arrow" aria-hidden="true">→</span>}
            </Reveal>
          ))}
        </div>
      )
    case 'make':
      return (
        <div className="t-invoices-three">
          <Reveal on={shown >= 1}>
            <div className="t-invoices-card">
              <div className="t-invoices-label">From a job</div>
              <div className="t-invoices-mini">
                <div className="t-invoices-mini-row"><span>HVAC tune-up</span><Tag tone="paid">Complete</Tag></div>
                <div className="t-invoices-btn green">View invoice</div>
              </div>
              <span className="t-invoices-muted">Made for you when the job is complete</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-invoices-card">
              <div className="t-invoices-label">From a contract</div>
              <div className="t-invoices-mini">
                <div className="t-invoices-mini-row"><span>Lawn service plan</span><b>$120 / mo</b></div>
                <div className="t-invoices-periods">
                  {['Jan', 'Feb', 'Mar'].map((m, k) => <span key={m} className={k < 2 ? 'on' : ''}>{m}</span>)}
                </div>
              </div>
              <span className="t-invoices-muted">One invoice each billing period</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-invoices-card">
              <div className="t-invoices-label">New, from the customer</div>
              <div className="t-invoices-mini">
                <div className="t-invoices-mini-row"><span>Door closer</span><b>$85.00</b></div>
                <div className="t-invoices-mini-row"><span>Labor</span><b>$60.00</b></div>
                <div className="t-invoices-btn green">Create + take payment</div>
              </div>
              <span className="t-invoices-muted">Counter sales and one-offs</span>
            </div>
          </Reveal>
        </div>
      )
    case 'states':
      return (
        <div className="t-invoices-legend">
          {[
            { tone: 'draft' as const, label: 'Draft', text: 'Made, not sent yet' },
            { tone: 'sent' as const, label: 'Sent', text: 'With the customer, not due yet' },
            { tone: 'partial' as const, label: 'Partial', text: 'Some paid, the rest still owing' },
            { tone: 'overdue' as const, label: 'Overdue', text: 'Past the due date, still owing' },
            { tone: 'paid' as const, label: 'Paid', text: 'Settled in full' },
            { tone: 'void' as const, label: 'Void', text: 'Cancelled. Can’t be sent or paid' },
          ].map((row, k) => (
            <Reveal key={row.label} on={shown >= k + 1}>
              <div className={`t-invoices-legend-row ${row.tone}`}>
                <Tag tone={row.tone}>{row.label}</Tag>
                <span>{row.text}</span>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'send':
      return (
        <div className="t-invoices-three">
          <Reveal on={shown >= 1}>
            <div className="t-invoices-card">
              <div className="t-invoices-label">✉ Email</div>
              <div className="t-invoices-mail">
                <b>Invoice INV-1042 from Acme Services</b>
                <div className="t-invoices-line w90" /><div className="t-invoices-line w70" />
                <div className="t-invoices-mini-row"><span>Balance due</span><b>$640.00</b></div>
              </div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-invoices-card">
              <div className="t-invoices-label">💬 Text</div>
              <div className="t-invoices-bubble">Invoice INV-1042 from us. View &amp; pay online: <u>pay.example.com/…</u></div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-invoices-card">
              <div className="t-invoices-label">⏰ If it isn’t paid</div>
              <div className="t-invoices-timeline">
                <span className="due">Due</span>
                <span>+7 days · friendly reminder</span>
                <span>+30 days · firmer reminder</span>
              </div>
            </div>
          </Reveal>
        </div>
      )
    case 'pay':
      return (
        <div className="t-invoices-split">
          <Reveal on={shown >= 1}>
            <div className="t-invoices-check">
              <div className="t-invoices-check-top"><span>Jordan Lee</span><span>#2210</span></div>
              <div className="t-invoices-check-amt">$650.00</div>
              <div className="t-invoices-check-pay">Pay to Acme Services</div>
            </div>
          </Reveal>
          <div className="t-invoices-stack">
            <Reveal on={shown >= 2}>
              <div className="t-invoices-card">
                <div className="t-invoices-label">Apply payment to</div>
                <div className="t-invoices-alloc"><span>☑ INV-1042 · water heater</span><b>$400.00</b></div>
                <div className="t-invoices-alloc"><span>☑ INV-1051 · lawn service</span><b>$200.00</b></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-invoices-pair">
                <div className="t-invoices-tip">Tip to Sam <b>$20.00</b></div>
                <div className="t-invoices-credit">Credit <b>$30.00</b></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-invoices-total"><span>Total received</span><b>$650.00 ✓</b></div>
            </Reveal>
          </div>
        </div>
      )
    case 'partial':
      return (
        <div className="t-invoices-split">
          <Reveal on={shown >= 1}>
            <div className="t-invoices-card">
              <div className="t-invoices-mini-row"><span className="t-invoices-mono">INV-1060</span><Tag tone={shown >= 2 ? 'partial' : 'sent'}>{shown >= 2 ? 'Partial' : 'Sent'}</Tag></div>
              <b>Door repair · 123 Main St, Springfield</b>
              <div className="t-invoices-money">
                <div><span>Total</span><b>$400.00</b></div>
                <div><span>Balance</span><b className="owing">{shown >= 2 ? '$250.00' : '$400.00'}</b></div>
              </div>
              {shown >= 2 && <div className="t-invoices-note">Paid $150.00 today. The rest stays owing.</div>}
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-invoices-card">
              <div className="t-invoices-label">Paid too much, or paid ahead?</div>
              <div className="t-invoices-credit big">Customer credit <b>$75.00</b></div>
              <span className="t-invoices-arrow down" aria-hidden="true">↓</span>
              <div className="t-invoices-mini-row"><span>Next invoice</span><b>−$75.00</b></div>
            </div>
          </Reveal>
        </div>
      )
    case 'where':
      return (
        <div className="t-invoices-hub">
          <Reveal on={shown >= 1} className="t-invoices-hub-center">
            <div className="t-invoices-hub-core">🧾 Invoices</div>
          </Reveal>
          {[
            { icon: '🔧', title: 'On the job', line: 'View invoice, Receive payment' },
            { icon: '👤', title: 'The customer’s account', line: 'Balance due, credits, statement' },
            { icon: '📋', title: 'Money desk', line: 'Not billed, late, deposits to match' },
            { icon: '📊', title: 'Reports and bank match', line: 'Who owes you, deposits matched' },
          ].map((spot, k) => (
            <Reveal key={spot.title} on={shown >= k + 2}>
              <div className="t-invoices-card">
                <b>{spot.icon} {spot.title}</b>
                <span className="t-invoices-muted">{spot.line}</span>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-invoices-mock">
          <div className="t-invoices-mock-bar"><span /><span /><span /></div>
          <div className="t-invoices-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-invoices-mock-head">Invoices</div>
              <div className="t-invoices-mock-grid">
                {[
                  { n: 'INV-1042', c: 'Jordan Lee', tone: 'overdue' as const, l: 'Overdue' },
                  { n: 'INV-1051', c: 'Acme Lawn Co', tone: 'sent' as const, l: 'Sent' },
                  { n: 'INV-1060', c: 'Sam Rivera', tone: 'partial' as const, l: 'Partial' },
                  { n: 'INV-1063', c: 'Pat Morgan', tone: 'paid' as const, l: 'Paid' },
                ].map((m, k) => (
                  <div key={m.n} className={`t-invoices-mock-card ${k === 0 && shown >= 2 ? 'lit' : ''}`}>
                    <span className="t-invoices-mono">{m.n}</span>
                    <b>{m.c}</b>
                    <Tag tone={m.tone}>{m.l}</Tag>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-invoices-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-invoices-dock"><span className="t-invoices-avatar">CB</span> Your turn: open an invoice</div>
            </Reveal>
          </div>
        </div>
      )
  }
}

function CSS() {
  return `
.t-invoices-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-invoices-in.show { opacity: 1; transform: none; }
.t-invoices-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 8px; align-content: start; font-size: 13px; color: #0b1324; transition: box-shadow .35s, border-color .35s; }
.t-invoices-card.won { border-color: #34d399; box-shadow: 0 0 0 3px #d1fae5; }
.t-invoices-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-invoices-muted { font-size: 12px; color: #64748b; }
.t-invoices-mono { font-family: ui-monospace, monospace; font-size: 11.5px; color: #64748b; }
.t-invoices-tag { display: inline-flex; align-items: center; justify-self: start; border-radius: 6px; padding: 2px 8px; font-size: 11.5px; font-weight: 800; border: 1px solid transparent; }
.t-invoices-tag.draft { background: #f1f5f9; color: #334155; border-color: #e2e8f0; }
.t-invoices-tag.sent { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
.t-invoices-tag.partial { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.t-invoices-tag.overdue { background: #ffe4e6; color: #be123c; border-color: #fecdd3; }
.t-invoices-tag.paid { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
.t-invoices-tag.void { background: #f1f5f9; color: #94a3b8; border-color: #e2e8f0; text-decoration: line-through; }
.t-invoices-flow { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; align-items: stretch; }
.t-invoices-flow-step { display: flex; align-items: center; gap: 6px; }
.t-invoices-flow-step > .t-invoices-card { flex: 1; min-height: 132px; }
.t-invoices-flow-icon { width: 30px; height: 30px; border-radius: 9px; background: #0b1324; color: #fde68a; display: grid; place-items: center; font-size: 15px; }
.t-invoices-arrow { color: #f59e0b; font-weight: 900; font-size: 18px; flex: none; }
.t-invoices-arrow.down { justify-self: center; }
.t-invoices-three { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
.t-invoices-mini { border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px; display: grid; gap: 7px; }
.t-invoices-mini-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12.5px; }
.t-invoices-btn { justify-self: start; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 800; color: #fff; }
.t-invoices-btn.green { background: #059669; }
.t-invoices-btn.amber { background: #f59e0b; color: #0b1324; }
.t-invoices-periods { display: flex; gap: 6px; }
.t-invoices-periods span { flex: 1; text-align: center; border-radius: 7px; padding: 4px 0; font-size: 11.5px; font-weight: 700; border: 1px dashed #cbd5e1; color: #94a3b8; }
.t-invoices-periods span.on { border-style: solid; border-color: #a7f3d0; background: #ecfdf5; color: #065f46; }
.t-invoices-legend { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; max-width: 640px; }
.t-invoices-legend-row { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e3e7ee; border-left-width: 5px; border-radius: 12px; padding: 10px 12px; font-size: 13.5px; color: #334155; }
.t-invoices-legend-row .t-invoices-tag { min-width: 72px; justify-content: center; }
.t-invoices-legend-row.draft { border-left-color: #94a3b8; }
.t-invoices-legend-row.sent { border-left-color: #3b82f6; }
.t-invoices-legend-row.partial { border-left-color: #f59e0b; }
.t-invoices-legend-row.overdue { border-left-color: #f43f5e; }
.t-invoices-legend-row.paid { border-left-color: #10b981; }
.t-invoices-legend-row.void { border-left-color: #cbd5e1; }
.t-invoices-mail { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; display: grid; gap: 7px; font-size: 12.5px; }
.t-invoices-line { height: 7px; border-radius: 99px; background: #e2e8f0; }
.t-invoices-line.w90 { width: 90%; } .t-invoices-line.w70 { width: 70%; }
.t-invoices-bubble { background: #e5e7eb; color: #0f172a; font-size: 13px; line-height: 1.4; border-radius: 18px 18px 18px 6px; padding: 9px 12px; }
.t-invoices-timeline { display: grid; gap: 6px; border-left: 2px solid #fde68a; padding-left: 10px; font-size: 12.5px; color: #334155; }
.t-invoices-timeline .due { font-weight: 800; color: #be123c; }
.t-invoices-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; align-items: start; }
.t-invoices-stack { display: grid; gap: 10px; }
.t-invoices-check { background: linear-gradient(135deg,#ecfdf5,#f0f9ff); border: 1px solid #a7f3d0; border-radius: 12px; padding: 14px 16px; display: grid; gap: 10px; font-size: 12.5px; color: #0b1324; box-shadow: 0 8px 20px rgba(11,19,36,.08); }
.t-invoices-check-top { display: flex; justify-content: space-between; font-weight: 700; }
.t-invoices-check-amt { font-family: ui-monospace, monospace; font-size: 26px; font-weight: 900; }
.t-invoices-check-pay { border-top: 1.5px solid #0b1324; padding-top: 4px; color: #475569; }
.t-invoices-alloc { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; }
.t-invoices-alloc b, .t-invoices-total b, .t-invoices-money b { font-family: ui-monospace, monospace; }
.t-invoices-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.t-invoices-tip { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 10px; padding: 8px 10px; font-size: 12.5px; display: flex; justify-content: space-between; gap: 6px; }
.t-invoices-credit { background: #f0f9ff; border: 1px solid #bae6fd; color: #075985; border-radius: 10px; padding: 8px 10px; font-size: 12.5px; display: flex; justify-content: space-between; gap: 6px; }
.t-invoices-credit.big { font-size: 14px; }
.t-invoices-total { display: flex; justify-content: space-between; background: #0b1324; color: #fff; border-radius: 10px; padding: 10px 12px; font-size: 13.5px; font-weight: 800; }
.t-invoices-total b { color: #6ee7b7; }
.t-invoices-money { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.t-invoices-money > div { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 9px; padding: 8px; display: grid; gap: 2px; }
.t-invoices-money span { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
.t-invoices-money b { font-size: 16px; }
.t-invoices-money b.owing { color: #e11d48; }
.t-invoices-note { font-size: 12px; color: #92400e; background: #fffbeb; border-radius: 8px; padding: 6px 9px; animation: t-invoices-fade .4s ease both; }
.t-invoices-hub { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.t-invoices-hub-center { grid-column: 1 / -1; display: flex; justify-content: center; }
.t-invoices-hub-core { background: #0b1324; color: #fde68a; font-weight: 900; font-size: 15px; border-radius: 999px; padding: 10px 18px; box-shadow: 0 10px 24px rgba(11,19,36,.25); }
.t-invoices-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-invoices-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-invoices-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-invoices-mock-body { position: relative; padding: 14px; min-height: 220px; }
.t-invoices-mock-head { font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 10px; }
.t-invoices-mock-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
.t-invoices-mock-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; font-size: 12.5px; display: grid; gap: 4px; transition: all .4s; }
.t-invoices-mock-card.lit { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251,191,36,.35); }
.t-invoices-pointer { position: absolute; left: 34%; top: 42%; font-size: 26px; animation: t-invoices-tap 1.4s ease-in-out infinite; }
.t-invoices-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-invoices-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.t-invoices-avatar { width: 22px; height: 22px; border-radius: 50%; background: #f59e0b; color: #0b1324; font-size: 9px; font-weight: 900; display: grid; place-items: center; }
@keyframes t-invoices-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px, 6px) scale(.92); } }
@keyframes t-invoices-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes t-invoices-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .t-invoices-in, .t-invoices-card, .t-invoices-mock-card { transition: none; }
  .t-invoices-pointer, .t-invoices-dock, .t-invoices-note { animation: none; }
}
@media (max-width: 760px) {
  .t-invoices-flow, .t-invoices-three, .t-invoices-split, .t-invoices-legend { grid-template-columns: minmax(0,1fr); }
  .t-invoices-flow-step > .t-invoices-card { min-height: 0; }
  .t-invoices-arrow { display: none; }
  .t-invoices-hub, .t-invoices-mock-grid { grid-template-columns: minmax(0,1fr); }
}
`
}
