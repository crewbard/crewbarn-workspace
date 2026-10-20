import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/inventory'
import type { TutorialScript } from '../tutorialScript'

/**
 * The Inventory tutorial: a short film about where stock lives, how it is
 * counted, moved, labelled, reordered and received, then a walk through the
 * real pages. Examples are generic so they fit any trade.
 */

const REVEAL: Record<string, number> = {
  places: 4, counts: 4, moves: 4, labels: 4, reorder: 4, receive: 4, explain: 4, yourturn: 3,
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-inventory-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

/** A little QR square, drawn rather than encoded: it only has to read as one. */
function Qr({ big = false }: { big?: boolean }) {
  return <span className={`t-inventory-qr ${big ? 'big' : ''}`} aria-hidden="true" />
}

function Visual({ id, shown }: { id: string; shown: number }) {
  switch (id) {
    case 'places':
      return (
        <div className="t-inventory-split">
          <Reveal on={shown >= 1}>
            <div className="t-inventory-card">
              <div className="t-inventory-place-head">
                <span className="t-inventory-badge blue">Warehouse</span>
                <b>Main Warehouse</b>
              </div>
              <Reveal on={shown >= 2}>
                <div className="t-inventory-tree">
                  <div className="t-inventory-node d0">Rack <code>R1</code></div>
                  <div className="t-inventory-node d1">Shelf <code>S2</code></div>
                  <div className={`t-inventory-node d2 ${shown >= 4 ? 'hot' : ''}`}>
                    Bin <code>BIN-04</code>
                    {shown >= 4 && <span className="t-inventory-count">Air filter 16x25 · 12</span>}
                  </div>
                </div>
              </Reveal>
            </div>
          </Reveal>
          <Reveal on={shown >= 1}>
            <div className="t-inventory-card">
              <div className="t-inventory-place-head">
                <span className="t-inventory-badge amber">Truck</span>
                <b>Truck 1</b>
                <span className="t-inventory-muted">Jordan Lee</span>
              </div>
              <Reveal on={shown >= 3}>
                <div className="t-inventory-tree">
                  <div className="t-inventory-node d0">Cabinet <code>C1</code></div>
                  <div className="t-inventory-node d1">Drawer <code>D2</code></div>
                  <div className={`t-inventory-node d2 ${shown >= 4 ? 'hot' : ''}`}>
                    Bin <code>BIN-02</code>
                    {shown >= 4 && <span className="t-inventory-count">Door closer · 3</span>}
                  </div>
                </div>
              </Reveal>
            </div>
          </Reveal>
        </div>
      )
    case 'counts':
      return (
        <div className="t-inventory-table">
          <div className="t-inventory-tr head">
            <span>Item</span><span>Where</span>
            <Reveal on={shown >= 2}><span>On hand</span></Reveal>
            <Reveal on={shown >= 4}><span>Keep at least</span></Reveal>
            <Reveal on={shown >= 3}><span>Held for jobs</span></Reveal>
            <Reveal on={shown >= 3}><span>Free to use</span></Reveal>
          </div>
          {[
            { item: 'Water heater element', where: 'Truck 1 › Drawer D2', on: 3, par: 5, res: 1 },
            { item: 'Sprinkler head', where: 'Main Warehouse › BIN-11', on: 24, par: 20, res: 4 },
            { item: 'Capacitor 45/5', where: 'Truck 2 › Bin 03', on: 6, par: null, res: 0 },
          ].map((row) => (
            <Reveal key={row.item} on={shown >= 1}>
              <div className="t-inventory-tr">
                <span><b>{row.item}</b></span>
                <span className="t-inventory-muted">📍 {row.where}</span>
                <Reveal on={shown >= 2}><span className="t-inventory-num">{row.on}</span></Reveal>
                <Reveal on={shown >= 4}>
                  <span className="t-inventory-num">
                    {row.par == null ? '—' : row.par}
                    {row.par != null && row.on < row.par && <span className="t-inventory-short">short {row.par - row.on}</span>}
                  </span>
                </Reveal>
                <Reveal on={shown >= 3}><span className="t-inventory-num muted">{row.res}</span></Reveal>
                <Reveal on={shown >= 3}><span className="t-inventory-num green">{row.on - row.res}</span></Reveal>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'moves':
      return (
        <div className="t-inventory-ledger">
          {[
            { kind: 'Receive', tone: 'green', what: 'Air filter 16x25 · 10', path: '→ Main Warehouse › BIN-04', who: 'Sam Rivera' },
            { kind: 'Transfer', tone: 'blue', what: 'Door closer · 2', path: 'Main Warehouse → Truck 1', who: 'Jordan Lee' },
            { kind: 'Install', tone: 'purple', what: 'Water heater element · 1', path: 'Truck 1 → Job #1042', who: 'Jordan Lee' },
          ].map((row, k) => (
            <Reveal key={row.kind} on={shown >= k + 1}>
              <div className="t-inventory-move">
                <span className={`t-inventory-kind ${row.tone}`}>{row.kind}</span>
                <span className="t-inventory-move-what"><b>{row.what}</b><span className="t-inventory-muted">{row.path}</span></span>
                <span className="t-inventory-who"><span className="t-inventory-face">{row.who.split(' ').map((w) => w[0]).join('')}</span>{row.who}</span>
              </div>
            </Reveal>
          ))}
          <Reveal on={shown >= 4}>
            <div className="t-inventory-lock">🔒 Never edited. A mistake is fixed with a new movement.</div>
          </Reveal>
        </div>
      )
    case 'labels':
      return (
        <div className="t-inventory-split">
          <div className="t-inventory-stack">
            <Reveal on={shown >= 1}>
              <div className="t-inventory-sticker wide">
                <Qr big />
                <div><b>BIN-04</b><span className="t-inventory-muted">Main Warehouse › R1 › S2</span></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-inventory-stickers">
                {['A1', 'A2', 'A3'].map((code) => (
                  <div key={code} className={`t-inventory-sticker ${shown >= 4 && code === 'A2' ? 'hot' : ''}`}>
                    <Qr />
                    <div><b>Door closer</b><span className="t-inventory-muted">unit {code}</span></div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
          <div className="t-inventory-stack">
            <Reveal on={shown >= 3}>
              <div className="t-inventory-phone">
                <div className="t-inventory-phone-bar">📷 Scan</div>
                <div className="t-inventory-phone-view"><Qr big /></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-inventory-result">
                <b>Door closer · unit A2</b>
                <span>📍 Main Warehouse › BIN-04</span>
              </div>
            </Reveal>
          </div>
        </div>
      )
    case 'reorder':
      return (
        <div className="t-inventory-flow">
          <Reveal on={shown >= 1}>
            <div className="t-inventory-card">
              <div className="t-inventory-label">Sprinkler head</div>
              <div className="t-inventory-gauge"><span style={{ width: '30%' }} /></div>
              <div className="t-inventory-muted">On hand <b className="t-inventory-red">3</b> · reorder at 5</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}><span className="t-inventory-arrow" aria-hidden="true">→</span></Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-inventory-card">
              <div className="t-inventory-label">Needs ordered</div>
              {['Sprinkler head · 10', 'PVC elbow 3/4 in · 25', 'Air filter 16x25 · 12'].map((line, k) => (
                <div key={line} className="t-inventory-tick"><span className={`t-inventory-box ${k < 2 ? 'on' : ''}`}>{k < 2 ? '✓' : ''}</span>{line}</div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 3}><span className="t-inventory-arrow" aria-hidden="true">→</span></Reveal>
          <Reveal on={shown >= 3}>
            <div className="t-inventory-card">
              <div className="t-inventory-po-head"><b>PO-0042</b><span className="t-inventory-badge slate">Draft</span></div>
              <div className="t-inventory-muted">Acme Supply</div>
              <Reveal on={shown >= 4}>
                <div className="t-inventory-poline">Sprinkler head <span>10</span></div>
                <div className="t-inventory-poline">PVC elbow 3/4 in <span>25</span></div>
              </Reveal>
            </div>
          </Reveal>
        </div>
      )
    case 'receive':
      return (
        <div className="t-inventory-card wide">
          <div className="t-inventory-po-head">
            <b>PO-0042 · Acme Supply</b>
            <Reveal on={shown >= 3}><span className="t-inventory-badge amber">Partially received</span></Reveal>
          </div>
          <div className="t-inventory-tr head four"><span>Line</span><span>Ordered</span><span>Receive now</span><span>Goes to</span></div>
          {[
            { line: 'Capacitor 45/5', ordered: 6, now: 6, to: 'Truck 2 › Bin 03' },
            { line: 'PVC elbow 3/4 in', ordered: 25, now: 10, to: 'Main Warehouse › BIN-08' },
          ].map((row, k) => (
            <Reveal key={row.line} on={shown >= k + 1}>
              <div className="t-inventory-tr four">
                <span><b>{row.line}</b></span>
                <span className="t-inventory-num">{row.ordered}</span>
                <span className="t-inventory-num"><span className="t-inventory-input">{row.now}</span></span>
                <span className="t-inventory-muted">→ {row.to}</span>
              </div>
            </Reveal>
          ))}
          <Reveal on={shown >= 4}>
            <div className="t-inventory-serials">
              <span>Serials made:</span>
              {['CAP-0001', 'CAP-0002', 'CAP-0003', '…', 'CAP-0006'].map((s) => <code key={s}>{s}</code>)}
            </div>
          </Reveal>
        </div>
      )
    case 'explain':
      return (
        <div className="t-inventory-split">
          <Reveal on={shown >= 1}>
            <div className="t-inventory-card">
              <div className="t-inventory-label">Pending</div>
              <b>Water heater element</b>
              <div className="t-inventory-muted">Used 1 on Job #1042 · the count said 0</div>
              <div className="t-inventory-muted">Truck 1 · Jordan Lee</div>
              <Reveal on={shown >= 2}>
                <div className="t-inventory-actions">
                  <span className="t-inventory-btn green">Retroactive receive</span>
                  <span className="t-inventory-btn red">Write off</span>
                </div>
              </Reveal>
            </div>
          </Reveal>
          <div className="t-inventory-stack">
            <Reveal on={shown >= 3}>
              <div className="t-inventory-card">
                <div className="t-inventory-label">Note</div>
                <div className="t-inventory-note">There was a spare in the truck from last week.</div>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className="t-inventory-resolved">✓ Resolved – Received · the why stays with the row</div>
            </Reveal>
          </div>
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-inventory-mock">
          <div className="t-inventory-mock-bar"><span /><span /><span /></div>
          <div className="t-inventory-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-inventory-mock-head">Inventory</div>
              <div className="t-inventory-mock-tabs">
                {['Locations', 'Bins', 'Stock Levels', 'Units', 'Movements'].map((tab) => (
                  <span key={tab} className={tab === 'Bins' && shown >= 2 ? 'lit' : ''}>{tab}</span>
                ))}
              </div>
              <div className="t-inventory-mock-rows"><span /><span /><span /></div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-inventory-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-inventory-dock"><span className="t-inventory-dock-avatar">CB</span> Your turn: open Bins</div>
            </Reveal>
          </div>
        </div>
      )
    default:
      return null
  }
}

const CSS = `
.t-inventory-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-inventory-in.show { opacity: 1; transform: none; }
.t-inventory-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 14px; align-items: start; }
.t-inventory-stack { display: grid; gap: 10px; }
.t-inventory-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 7px; align-content: start; font-size: 13px; color: #0b1324; }
.t-inventory-card.wide { max-width: 720px; }
.t-inventory-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-inventory-muted { color: #64748b; font-size: 12px; display: block; }
.t-inventory-badge { font-size: 10.5px; font-weight: 800; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
.t-inventory-badge.blue { background: #eff6ff; color: #1d4ed8; }
.t-inventory-badge.amber { background: #fffbeb; color: #b45309; }
.t-inventory-badge.slate { background: #f1f5f9; color: #334155; }
.t-inventory-place-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.t-inventory-place-head .t-inventory-muted { display: inline; }
.t-inventory-tree { display: grid; gap: 5px; margin-top: 4px; }
.t-inventory-node { border: 1px solid #e2e8f0; border-radius: 9px; padding: 6px 9px; font-size: 12.5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; transition: box-shadow .35s, border-color .35s; }
.t-inventory-node code { font-family: ui-monospace, monospace; font-size: 11px; color: #64748b; }
.t-inventory-node.d1 { margin-left: 16px; } .t-inventory-node.d2 { margin-left: 32px; }
.t-inventory-node.hot { border-color: #f59e0b; box-shadow: 0 0 0 3px #fde68a; }
.t-inventory-count { margin-left: auto; background: #ecfdf5; color: #065f46; border-radius: 6px; padding: 1px 7px; font-size: 11px; font-weight: 700; animation: t-inventory-fade .4s ease both; }
.t-inventory-table { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 20px rgba(11,19,36,.06); }
.t-inventory-tr { display: grid; grid-template-columns: 1.4fr 1.6fr .8fr 1fr .8fr .8fr; gap: 8px; align-items: center; padding: 9px 12px; border-top: 1px solid #f1f5f9; font-size: 12.5px; color: #0b1324; }
.t-inventory-tr.four { grid-template-columns: 1.4fr .7fr .9fr 1.6fr; }
.t-inventory-tr.head { background: #f8fafc; border-top: 0; font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
.t-inventory-num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; display: block; }
.t-inventory-num.muted { color: #94a3b8; } .t-inventory-num.green { color: #047857; }
.t-inventory-short { margin-left: 6px; background: #fef3c7; color: #92400e; border-radius: 5px; padding: 1px 5px; font-size: 10.5px; font-weight: 800; }
.t-inventory-ledger { display: grid; gap: 9px; max-width: 680px; }
.t-inventory-move { display: grid; grid-template-columns: 88px minmax(0,1fr) auto; gap: 10px; align-items: center; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 9px 12px; font-size: 13px; color: #0b1324; }
.t-inventory-move-what { display: grid; gap: 1px; min-width: 0; }
.t-inventory-kind { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; border-radius: 6px; padding: 3px 7px; text-align: center; }
.t-inventory-kind.green { background: #ecfdf5; color: #047857; } .t-inventory-kind.blue { background: #eff6ff; color: #1d4ed8; } .t-inventory-kind.purple { background: #faf5ff; color: #7e22ce; }
.t-inventory-who { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; white-space: nowrap; }
.t-inventory-face { width: 22px; height: 22px; border-radius: 50%; background: #0b1324; color: #fde68a; font-size: 9.5px; font-weight: 900; display: grid; place-items: center; }
.t-inventory-lock { margin-top: 4px; font-size: 13px; font-weight: 700; color: #334155; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 9px 12px; }
.t-inventory-qr { width: 34px; height: 34px; flex: none; border-radius: 4px; border: 2px solid #0b1324; background: repeating-conic-gradient(#0b1324 0% 25%, #fff 0% 50%) 50% / 8px 8px; }
.t-inventory-qr.big { width: 52px; height: 52px; background-size: 10px 10px; }
.t-inventory-sticker { display: flex; align-items: center; gap: 9px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; box-shadow: 0 6px 14px rgba(11,19,36,.07); font-size: 12.5px; color: #0b1324; transition: box-shadow .35s, border-color .35s; }
.t-inventory-sticker b { display: block; }
.t-inventory-sticker.hot { border-color: #f59e0b; box-shadow: 0 0 0 3px #fde68a; }
.t-inventory-stickers { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
.t-inventory-phone { width: 170px; justify-self: center; border: 3px solid #0b1324; border-radius: 22px; overflow: hidden; background: #0b1324; }
.t-inventory-phone-bar { color: #fde68a; font-size: 11px; font-weight: 800; padding: 6px 10px; }
.t-inventory-phone-view { background: #1e293b; height: 110px; display: grid; place-items: center; position: relative; }
.t-inventory-phone-view::after { content: ""; position: absolute; left: 18%; right: 18%; top: 50%; height: 2px; background: #f59e0b; box-shadow: 0 0 8px #f59e0b; animation: t-inventory-scan 1.6s ease-in-out infinite; }
.t-inventory-result { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 12px; padding: 9px 12px; display: grid; gap: 2px; font-size: 13px; }
.t-inventory-flow { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1.2fr) auto minmax(0,1fr); gap: 10px; align-items: center; }
.t-inventory-arrow { font-size: 22px; font-weight: 900; color: #f59e0b; display: block; text-align: center; }
.t-inventory-gauge { height: 8px; border-radius: 99px; background: #fee2e2; overflow: hidden; }
.t-inventory-gauge span { display: block; height: 100%; background: #ef4444; border-radius: 99px; }
.t-inventory-red { color: #b91c1c; }
.t-inventory-tick { display: flex; align-items: center; gap: 7px; font-size: 12.5px; }
.t-inventory-box { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid #cbd5e1; display: grid; place-items: center; font-size: 10px; font-weight: 900; color: #fff; flex: none; }
.t-inventory-box.on { background: #f59e0b; border-color: #f59e0b; }
.t-inventory-po-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.t-inventory-poline { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; border-top: 1px solid #f1f5f9; padding-top: 5px; margin-top: 5px; }
.t-inventory-input { display: inline-block; min-width: 38px; border: 1.5px solid #34d399; border-radius: 6px; padding: 1px 6px; background: #f0fdf4; }
.t-inventory-serials { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 6px; font-size: 12px; color: #334155; font-weight: 700; }
.t-inventory-serials code { font-family: ui-monospace, monospace; font-size: 11px; background: #eff6ff; color: #1d4ed8; border-radius: 5px; padding: 1px 6px; }
.t-inventory-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.t-inventory-btn { font-size: 11.5px; font-weight: 800; color: #fff; border-radius: 7px; padding: 4px 9px; }
.t-inventory-btn.green { background: #059669; } .t-inventory-btn.red { background: #dc2626; }
.t-inventory-note { font-size: 13px; color: #334155; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 9px; font-style: italic; }
.t-inventory-resolved { font-size: 13px; font-weight: 800; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 9px 12px; }
.t-inventory-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-inventory-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-inventory-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-inventory-mock-body { position: relative; padding: 14px; min-height: 210px; }
.t-inventory-mock-head { font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 10px; }
.t-inventory-mock-tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px; }
.t-inventory-mock-tabs span { font-size: 12px; font-weight: 700; color: #64748b; padding: 6px 9px; border-bottom: 2px solid transparent; transition: all .4s; }
.t-inventory-mock-tabs span.lit { color: #b45309; border-bottom-color: #f59e0b; box-shadow: 0 0 0 3px rgba(251,191,36,.35); border-radius: 6px 6px 0 0; }
.t-inventory-mock-rows { display: grid; gap: 7px; }
.t-inventory-mock-rows span { height: 22px; border-radius: 8px; background: #f1f5f9; }
.t-inventory-pointer { position: absolute; left: 22%; top: 34%; font-size: 26px; animation: t-inventory-tap 1.4s ease-in-out infinite; }
.t-inventory-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-inventory-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.t-inventory-dock-avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }
@keyframes t-inventory-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-10px, 6px) scale(.92); } }
@keyframes t-inventory-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes t-inventory-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes t-inventory-scan { 0%,100% { transform: translateY(-30px); } 50% { transform: translateY(30px); } }
@media (max-width: 760px) {
  .t-inventory-split, .t-inventory-flow { grid-template-columns: minmax(0,1fr); }
  .t-inventory-arrow { transform: rotate(90deg); }
  .t-inventory-tr { grid-template-columns: 1.3fr 1fr .7fr .7fr; }
  .t-inventory-tr > :nth-child(4), .t-inventory-tr > :nth-child(5) { display: none; }
  .t-inventory-tr.four { grid-template-columns: 1.3fr .6fr .8fr; }
  .t-inventory-tr.four > :nth-child(4) { display: none; }
  .t-inventory-move { grid-template-columns: 76px minmax(0,1fr); }
  .t-inventory-who { grid-column: 2; }
  .t-inventory-stickers { grid-template-columns: minmax(0,1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .t-inventory-in, .t-inventory-node, .t-inventory-sticker, .t-inventory-mock-tabs span { transition: none !important; }
  .t-inventory-count, .t-inventory-pointer, .t-inventory-dock, .t-inventory-phone-view::after { animation: none !important; }
}
`

/**
 * Closes a dialog the page itself shows (the transfer window) with Escape,
 * which its own window listens for. Nothing is saved by closing it.
 */
function pressEscape() {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  document.dispatchEvent(event)
}

export const inventoryScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <Visual id={id} shown={shown} />,
  css: CSS,
  actions: {
    esc: () => pressEscape(),
  },
}
