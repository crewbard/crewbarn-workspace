import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/accounting'
import type { TutorialScript } from '../tutorialScript'

/**
 * The Accounting tutorial: a short film about the Money desk, cash custody,
 * card matching, money out, bank matching, the books and reports, then a walk
 * through the real pages. Examples are generic so they fit any trade.
 */

const REVEAL: Record<string, number> = {
  desk: 4, custody: 4, cards: 4, out: 4, bank: 4, books: 4, answers: 4, yourturn: 3,
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-accounting-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

const DESK_ROWS = [
  { icon: '📥', tone: 'green', title: 'Money in hand', sub: 'Jordan Lee · cash · WO-1042', amount: '$185.00', action: 'Check in' },
  { icon: '✉️', tone: 'amber', title: 'Finished but not billed', sub: 'Acme Services · water heater swap', amount: '$1,240.00', action: 'Send' },
  { icon: '⏱', tone: 'rose', title: 'Late', sub: 'Sam Rivera · lawn service · 12 days', amount: '$95.00', action: 'Remind' },
  { icon: '🧾', tone: 'blue', title: 'Spending to approve', sub: 'Fuel receipt · Jordan Lee', amount: '$64.20', action: 'Approve' },
  { icon: '🏦', tone: 'purple', title: 'Bank deposits to match', sub: 'Deposit · matches 3 payments', amount: '$1,520.00', action: 'Review' },
]

function Visual({ id, shown }: { id: string; shown: number }) {
  switch (id) {
    case 'desk':
      return (
        <div className="t-accounting-card wide">
          <Reveal on={shown >= 1}>
            <div className="t-accounting-head">
              <div><span className="t-accounting-label">Money desk</span><b>5 things need you</b></div>
              <span className="t-accounting-chip">This month</span>
            </div>
          </Reveal>
          {DESK_ROWS.map((row, k) => (
            <Reveal key={row.title} on={shown >= (k < 2 ? 2 : 3)}>
              <div className={`t-accounting-queue ${shown >= 4 && k === 0 ? 'done' : ''}`}>
                <span className={`t-accounting-icon ${row.tone}`} aria-hidden="true">{row.icon}</span>
                <span className="t-accounting-grow"><b>{row.title}</b><span className="t-accounting-muted">{row.sub}</span></span>
                <span className="t-accounting-num">{row.amount}</span>
                <span className="t-accounting-btn">{shown >= 4 && k === 0 ? '✓' : row.action}</span>
              </div>
            </Reveal>
          ))}
          <Reveal on={shown >= 4}>
            <div className="t-accounting-progress">
              <span>Cleared this visit · 1 of 5</span>
              <div className="t-accounting-bar"><span style={{ width: '20%' }} /></div>
            </div>
          </Reveal>
        </div>
      )
    case 'custody':
      return (
        <div className="t-accounting-chain">
          {[
            { label: 'Tech till', title: 'Jordan Lee', lines: ['Cash $185.00', 'Check #2231 $95.00'], tone: 'amber' },
            { label: 'Office drawer', title: '$280.00 on hand', lines: ['Counted in · matches', 'JOB · JOB'], tone: 'green' },
            { label: 'Deposit', title: 'Deposit #12', lines: ['2 items · $280.00', 'Walked to the bank'], tone: 'blue' },
            { label: 'Bank statement', title: 'DEPOSIT 280.00', lines: ['One line', 'Easy to match'], tone: 'purple' },
          ].map((box, k) => (
            <div key={box.label} className="t-accounting-chain-step">
              {k > 0 && <Reveal on={shown >= k + 1}><span className="t-accounting-arrow" aria-hidden="true">→</span></Reveal>}
              <Reveal on={shown >= k + 1}>
                <div className={`t-accounting-card t-accounting-box ${box.tone}`}>
                  <span className="t-accounting-label">{box.label}</span>
                  <b>{box.title}</b>
                  {box.lines.map((line) => <span key={line} className="t-accounting-muted">{line}</span>)}
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      )
    case 'cards':
      return (
        <div className="t-accounting-split">
          <div className="t-accounting-card">
            <span className="t-accounting-label">Card transactions</span>
            {[
              { when: 'Oct 2 · 9:14', amt: '$240.00', card: 'Visa •••• 4242', state: 'Matched' },
              { when: 'Oct 2 · 13:40', amt: '$89.00', card: 'Mastercard •••• 1881', state: 'Matched' },
            ].map((row) => (
              <Reveal key={row.when} on={shown >= 1}>
                <div className="t-accounting-txn">
                  <span><b>{row.amt}</b><span className="t-accounting-muted">{row.when} · {row.card}</span></span>
                  <span className="t-accounting-pill green">✓ {row.state}</span>
                </div>
              </Reveal>
            ))}
            <Reveal on={shown >= 2}>
              <div className={`t-accounting-txn ${shown >= 2 && shown < 4 ? 'hot' : ''}`}>
                <span><b>$310.00</b><span className="t-accounting-muted">Oct 3 · 16:05 · Visa •••• 0077</span></span>
                <span className={`t-accounting-pill ${shown >= 4 ? 'green' : 'amber'}`}>{shown >= 4 ? '✓ Matched' : 'Needs matching'}</span>
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 3}>
            <div className="t-accounting-card">
              <span className="t-accounting-label">Attach $310.00 to</span>
              <div className="t-accounting-suggest">
                <span><b>#1077</b> Acme Services<span className="t-accounting-muted">$310.00 due · HVAC tune-up</span></span>
                <span className="t-accounting-pill green">exact</span>
              </div>
              <div className="t-accounting-suggest dim">
                <span><b>#1069</b> Jordan Lee<span className="t-accounting-muted">$300.00 due · $10.00 over → credit</span></span>
              </div>
            </div>
          </Reveal>
        </div>
      )
    case 'out':
      return (
        <div className="t-accounting-split">
          <Reveal on={shown >= 1}>
            <div className="t-accounting-card">
              <span className="t-accounting-label">Receipt</span>
              <b>Fuel · $64.20</b>
              <span className="t-accounting-muted">Jordan Lee · Truck 1</span>
              <div className="t-accounting-steps">
                <span className="t-accounting-pill amber on">Pending</span>
                <span className="t-accounting-arrow small" aria-hidden="true">→</span>
                <span className={`t-accounting-pill blue ${shown >= 2 ? 'on' : ''}`}>Approved</span>
                <span className="t-accounting-arrow small" aria-hidden="true">→</span>
                <span className={`t-accounting-pill green ${shown >= 2 ? 'on' : ''}`}>Reimbursed</span>
              </div>
            </div>
          </Reveal>
          <div className="t-accounting-stack">
            <Reveal on={shown >= 3}>
              <div className="t-accounting-card">
                <div className="t-accounting-head"><b>Acme Supply · Bill 8812</b><span className="t-accounting-pill amber">Open</span></div>
                <span className="t-accounting-muted">Due Oct 30 · Net 30 · door closers, filters</span>
                <div className="t-accounting-money3"><span>Total<b>$1,240</b></span><span>Paid<b>$400</b></span><span>Balance<b>$840</b></span></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-accounting-card">
                <span className="t-accounting-label">AP aging</span>
                {[['Current', 70], ['1–30 days', 35], ['31–60 days', 12]].map(([label, w]) => (
                  <div key={label} className="t-accounting-aging"><span>{label}</span><div className="t-accounting-bar"><span style={{ width: `${w}%` }} /></div></div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'bank':
      return (
        <div className="t-accounting-card wide">
          <div className="t-accounting-tr head"><span>Statement row</span><span>Suggestion</span><span>Sure</span></div>
          {[
            { row: 'DEPOSIT · +$280.00', match: 'Deposit #12 · 2 payments', pct: '98%' },
            { row: 'ACME SUPPLY · −$400.00', match: 'Bill 8812 · Acme Supply', pct: '91%' },
            { row: 'SHELL OIL · −$64.20', match: 'Fuel receipt · Jordan Lee', pct: '88%' },
          ].map((r, k) => (
            <Reveal key={r.row} on={shown >= (k === 0 ? 1 : 2)}>
              <div className="t-accounting-tr">
                <span><b>{r.row}</b></span>
                <span className={`t-accounting-match ${shown >= 3 ? 'done' : ''}`}>{shown >= 3 ? '✓ ' : ''}{r.match}</span>
                <span className="t-accounting-num green">{r.pct}</span>
              </div>
            </Reveal>
          ))}
          <Reveal on={shown >= 4}>
            <div className="t-accounting-recon">
              <span>Statement ending <b>$8,412.55</b></span>
              <span>Difference <b className="t-accounting-zero">$0.00</b></span>
              <span className="t-accounting-btn dark">Close ✓</span>
            </div>
          </Reveal>
        </div>
      )
    case 'books':
      return (
        <div className="t-accounting-split">
          <div className="t-accounting-stack">
            <Reveal on={shown >= 1}>
              <div className="t-accounting-card">
                <span className="t-accounting-label">Invoice #1077 sent</span>
                <b>Acme Services · $310.00</b>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-accounting-card">
                <span className="t-accounting-label">Journal entry</span>
                <div className="t-accounting-je"><span>1200 Accounts receivable</span><span>Dr $310.00</span></div>
                <div className="t-accounting-je"><span>4000 Service revenue</span><span>Cr $310.00</span></div>
              </div>
            </Reveal>
          </div>
          <div className="t-accounting-stack">
            <Reveal on={shown >= 3}>
              <div className="t-accounting-card">
                <span className="t-accounting-label">Trial balance</span>
                <div className="t-accounting-je"><span>Debits</span><span>$48,210.00</span></div>
                <div className="t-accounting-je"><span>Credits</span><span>$48,210.00</span></div>
                <span className="t-accounting-pill green">Balanced</span>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-accounting-card">
                <span className="t-accounting-label">Accounting periods</span>
                <div className="t-accounting-je"><span>September</span><span className="t-accounting-pill rose">🔒 Closed</span></div>
                <div className="t-accounting-je"><span>October</span><span className="t-accounting-pill green">Open</span></div>
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'answers':
      return (
        <div className="t-accounting-split">
          <div className="t-accounting-stack">
            {['Who owes me money?', 'How much sales tax do I owe?'].map((q, k) => (
              <Reveal key={q} on={shown >= k + 1}>
                <div className={`t-accounting-card t-accounting-q ${shown >= 3 && k === 1 ? 'hot' : ''}`}><b>{q}</b></div>
              </Reveal>
            ))}
          </div>
          <div className="t-accounting-stack">
            <Reveal on={shown >= 3}>
              <div className="t-accounting-card">
                <span className="t-accounting-label">Last month</span>
                <b className="t-accounting-big">$1,862.40 collected</b>
                <div className="t-accounting-je"><span>State tax</span><span>$1,490.00</span></div>
                <div className="t-accounting-je"><span>County tax</span><span>$372.40</span></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-accounting-exports">
                {['PDF', 'Spreadsheet', 'Xero journal CSV'].map((x) => <span key={x} className="t-accounting-chip">⬇ {x}</span>)}
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-accounting-mock">
          <div className="t-accounting-mock-bar"><span /><span /><span /></div>
          <div className="t-accounting-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-accounting-mock-head">Accounting tools</div>
              <div className="t-accounting-mock-chips">
                {['Invoices', 'Cash register', 'Card transactions', 'Expense register', 'Bank match', 'General ledger', 'Reports'].map((c) => (
                  <span key={c} className={c === 'Cash register' && shown >= 2 ? 'lit' : ''}>{c}</span>
                ))}
              </div>
              <div className="t-accounting-mock-rows"><span /><span /><span /></div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-accounting-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-accounting-dock"><span className="t-accounting-dock-avatar">CB</span> Your turn: open the Cash register</div>
            </Reveal>
          </div>
        </div>
      )
    default:
      return null
  }
}

const CSS = `
.t-accounting-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-accounting-in.show { opacity: 1; transform: none; }
.t-accounting-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 14px; align-items: start; }
.t-accounting-stack { display: grid; gap: 10px; }
.t-accounting-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 6px; align-content: start; font-size: 13px; color: #0b1324; transition: box-shadow .35s, border-color .35s; }
.t-accounting-card.wide { max-width: 720px; margin: 0 auto; width: 100%; }
.t-accounting-card.hot, .t-accounting-txn.hot { border-color: #f59e0b; box-shadow: 0 0 0 3px #fde68a; }
.t-accounting-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; display: block; }
.t-accounting-muted { color: #64748b; font-size: 12px; display: block; font-weight: 500; }
.t-accounting-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.t-accounting-head b { font-size: 15px; display: block; }
.t-accounting-chip { font-size: 11.5px; font-weight: 700; color: #334155; background: #f1f5f9; border-radius: 8px; padding: 4px 9px; white-space: nowrap; }
.t-accounting-queue { display: flex; align-items: center; gap: 10px; border-top: 1px solid #f1f5f9; padding: 8px 0; transition: opacity .4s; }
.t-accounting-queue.done { opacity: .55; }
.t-accounting-grow { flex: 1; min-width: 0; }
.t-accounting-grow b { display: block; font-size: 13px; }
.t-accounting-icon { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; flex: none; font-size: 14px; }
.t-accounting-icon.green { background: #e7f5ec; } .t-accounting-icon.amber { background: #fdf3e4; } .t-accounting-icon.rose { background: #fbe8ed; } .t-accounting-icon.blue { background: #e9f1f7; } .t-accounting-icon.purple { background: #f0e9fb; }
.t-accounting-num { font-variant-numeric: tabular-nums; font-weight: 800; white-space: nowrap; }
.t-accounting-num.green { color: #047857; text-align: right; display: block; }
.t-accounting-btn { font-size: 11.5px; font-weight: 800; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 9px; white-space: nowrap; color: #334155; }
.t-accounting-btn.dark { background: #0f1a2e; color: #fff; border-color: #0f1a2e; }
.t-accounting-progress { display: grid; gap: 6px; margin-top: 6px; font-size: 12px; font-weight: 700; color: #334155; }
.t-accounting-bar { height: 7px; border-radius: 99px; background: #f1f5f9; overflow: hidden; }
.t-accounting-bar span { display: block; height: 100%; background: #e8902c; border-radius: 99px; transition: width .6s; }
.t-accounting-chain { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; align-items: stretch; }
.t-accounting-chain-step { display: flex; align-items: center; gap: 6px; min-width: 0; }
.t-accounting-chain-step > .t-accounting-in:last-child { flex: 1; min-width: 0; }
.t-accounting-box { border-top-width: 4px; }
.t-accounting-box.amber { border-top-color: #e8902c; } .t-accounting-box.green { border-top-color: #16a34a; } .t-accounting-box.blue { border-top-color: #2563eb; } .t-accounting-box.purple { border-top-color: #7c3aed; }
.t-accounting-arrow { font-size: 20px; font-weight: 900; color: #f59e0b; display: block; }
.t-accounting-arrow.small { font-size: 13px; display: inline; }
.t-accounting-txn, .t-accounting-suggest { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid #eef2f6; border-radius: 10px; padding: 7px 9px; transition: box-shadow .35s, border-color .35s; }
.t-accounting-txn b, .t-accounting-suggest b { font-variant-numeric: tabular-nums; }
.t-accounting-suggest.dim { opacity: .6; }
.t-accounting-pill { font-size: 10.5px; font-weight: 800; border-radius: 99px; padding: 2px 8px; white-space: nowrap; background: #f1f5f9; color: #475569; justify-self: start; }
.t-accounting-pill.green { background: #ecfdf5; color: #047857; } .t-accounting-pill.amber { background: #fffbeb; color: #b45309; } .t-accounting-pill.blue { background: #eff6ff; color: #1d4ed8; } .t-accounting-pill.rose { background: #fff1f2; color: #be123c; }
.t-accounting-steps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.t-accounting-steps .t-accounting-pill { opacity: .35; transition: opacity .4s; }
.t-accounting-steps .t-accounting-pill.on { opacity: 1; }
.t-accounting-money3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px; }
.t-accounting-money3 span { border: 1px solid #eef2f6; border-radius: 8px; padding: 5px 7px; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; }
.t-accounting-money3 b { display: block; font-size: 13px; color: #0b1324; text-transform: none; }
.t-accounting-aging { display: grid; grid-template-columns: 82px minmax(0,1fr); gap: 8px; align-items: center; font-size: 12px; }
.t-accounting-tr { display: grid; grid-template-columns: 1.2fr 1.4fr .5fr; gap: 10px; align-items: center; padding: 8px 2px; border-top: 1px solid #f1f5f9; font-size: 12.5px; }
.t-accounting-tr.head { border-top: 0; font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
.t-accounting-match { color: #334155; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 3px 8px; transition: all .4s; }
.t-accounting-match.done { color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; }
.t-accounting-recon { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 8px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12.5px; color: #334155; }
.t-accounting-zero { color: #047857; }
.t-accounting-je { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; font-variant-numeric: tabular-nums; border-top: 1px solid #f1f5f9; padding-top: 5px; }
.t-accounting-q { font-size: 14px; }
.t-accounting-big { font-size: 18px; }
.t-accounting-exports { display: flex; flex-wrap: wrap; gap: 6px; }
.t-accounting-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-accounting-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-accounting-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-accounting-mock-body { position: relative; padding: 14px; min-height: 210px; }
.t-accounting-mock-head { font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 10px; }
.t-accounting-mock-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.t-accounting-mock-chips span { font-size: 12px; font-weight: 700; color: #14532d; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 9px; transition: all .4s; }
.t-accounting-mock-chips span.lit { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(251,191,36,.45); background: #fffbeb; }
.t-accounting-mock-rows { display: grid; gap: 7px; }
.t-accounting-mock-rows span { height: 22px; border-radius: 8px; background: #f1f5f9; }
.t-accounting-pointer { position: absolute; left: 30%; top: 30%; font-size: 26px; animation: t-accounting-tap 1.4s ease-in-out infinite; }
.t-accounting-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-accounting-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.t-accounting-dock-avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }
@keyframes t-accounting-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-10px, 6px) scale(.92); } }
@keyframes t-accounting-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@media (max-width: 760px) {
  .t-accounting-split, .t-accounting-chain { grid-template-columns: minmax(0,1fr); }
  .t-accounting-chain-step { flex-direction: column; align-items: stretch; }
  .t-accounting-chain-step .t-accounting-arrow { transform: rotate(90deg); text-align: center; }
  .t-accounting-queue .t-accounting-btn { display: none; }
  .t-accounting-tr { grid-template-columns: 1fr 1fr; }
  .t-accounting-tr > :nth-child(3) { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .t-accounting-in, .t-accounting-card, .t-accounting-queue, .t-accounting-match, .t-accounting-bar span, .t-accounting-steps .t-accounting-pill, .t-accounting-mock-chips span { transition: none !important; }
  .t-accounting-pointer, .t-accounting-dock { animation: none !important; }
}
`

/**
 * Closes a window the page itself shows (the vendor form) with Escape, which
 * its own window listens for. Nothing is saved by closing it.
 */
function pressEscape() {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  document.dispatchEvent(event)
}

/** Opens the New Vendor form from the Vendors page header. Opening saves nothing. */
function openNewVendor() {
  const header = document.querySelector('[data-tour="vendors-header"]')
  const button = Array.from(header?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    .find((b) => /new vendor/i.test(b.textContent ?? ''))
  button?.click()
}

export const accountingScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <Visual id={id} shown={shown} />,
  css: CSS,
  actions: {
    esc: () => pressEscape(),
    newVendor: () => openNewVendor(),
  },
}
