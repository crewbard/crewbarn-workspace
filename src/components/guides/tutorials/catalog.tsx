import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/catalog'
import type { TutorialScript } from '../tutorialScript'

/**
 * Catalog & pricing tutorial: the film's drawings. Each scene builds up piece
 * by piece (`shown` counts the pieces on screen) while the narrator reads it.
 * Examples mix trades so they fit any business.
 */

type SceneId = 'two' | 'price' | 'tax' | 'stock' | 'warranty' | 'rate' | 'lines' | 'yourturn'

const REVEAL: Record<SceneId, number> = {
  two: 3, price: 4, tax: 4, stock: 4, warranty: 5, rate: 4, lines: 3, yourturn: 3,
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`t-catalog-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

const SERVICES = [
  { name: 'HVAC tune-up', unit: 'visit', price: '$129.00' },
  { name: 'Door repair labor', unit: 'hour', price: '$95.00' },
  { name: 'Lawn service, small yard', unit: 'visit', price: '$55.00' },
]

const PRODUCTS = [
  { name: '40-gal gas water heater', unit: 'each', price: '$899.00' },
  { name: '1/2" brass ball valve', unit: 'each', price: '$14.50' },
  { name: 'Air filter 16x25', unit: 'each', price: '$12.00' },
]

function CatalogVisual({ id, shown }: { id: SceneId; shown: number }) {
  switch (id) {
    case 'two':
      return (
        <div className="t-catalog-split">
          <Reveal on={shown >= 1}>
            <div className="t-catalog-card">
              <div className="t-catalog-label">🛠 Services · the work</div>
              {SERVICES.map((s) => (
                <div key={s.name} className="t-catalog-row">
                  <span>{s.name}</span>
                  <span className="t-catalog-unit">/ {s.unit}</span>
                  <b>{s.price}</b>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-catalog-card">
              <div className="t-catalog-label">📦 Products · the things</div>
              {PRODUCTS.map((p) => (
                <div key={p.name} className="t-catalog-row">
                  <span>{p.name}</span>
                  <span className="t-catalog-unit">/ {p.unit}</span>
                  <b>{p.price}</b>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 3} className="t-catalog-span">
            <p className="t-catalog-note">Each one has a name, a price, the unit it’s sold by, and a tax class.</p>
          </Reveal>
        </div>
      )
    case 'price':
      return (
        <div className="t-catalog-split">
          <div className="t-catalog-stack">
            <Reveal on={shown >= 1}>
              <div className="t-catalog-money">
                <span>Customer price</span><b>$899.00</b>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-catalog-money muted">
                <span>Your cost</span><b>$610.00</b>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-catalog-bar" aria-hidden="true">
                <span className="cost" style={{ width: '68%' }} />
                <span className="margin" style={{ width: '32%' }} />
              </div>
              <div className="t-catalog-note">$289 margin, about 32%. Customers never see your cost.</div>
            </Reveal>
          </div>
          <Reveal on={shown >= 4}>
            <div className="t-catalog-card">
              <div className="t-catalog-label">No price set?</div>
              <div className="t-catalog-sum">
                <span className="t-catalog-pill">Cost $40.00</span>
                <span aria-hidden="true">+</span>
                <span className="t-catalog-pill">25% markup</span>
                <span aria-hidden="true">=</span>
                <span className="t-catalog-pill on">$50.00</span>
              </div>
              <div className="t-catalog-note">CrewBarn suggests a price from your markup.</div>
            </div>
          </Reveal>
        </div>
      )
    case 'tax':
      return (
        <div className="t-catalog-split">
          <div className="t-catalog-stack">
            <Reveal on={shown >= 1}>
              <div className="t-catalog-part">
                <span><b>State</b><small>Remit to: State Dept of Revenue</small></span>
                <b className="mono">6.000%</b>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-catalog-part">
                <span><b>County</b><small>Remit to: Springfield County</small></span>
                <b className="mono">1.000%</b>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-catalog-part total">
                <span><b>Sales tax, Springfield County</b></span>
                <b className="mono">7.000%</b>
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 4}>
            <div className="t-catalog-card">
              <div className="t-catalog-label">Your tax classes</div>
              <div className="t-catalog-row"><span><span className="t-catalog-star">★</span> Sales tax, Springfield County</span><b>7.000%</b></div>
              <div className="t-catalog-row"><span><span className="t-catalog-star off">☆</span> Labor, not taxed</span><b>0.000%</b></div>
              <div className="t-catalog-note">The star is your default for new invoice lines.</div>
            </div>
          </Reveal>
        </div>
      )
    case 'stock':
      return (
        <div className="t-catalog-split">
          <div className="t-catalog-stack">
            <Reveal on={shown >= 1}>
              <div className="t-catalog-card">
                <div className="t-catalog-label">Air filter 16x25</div>
                <div className="t-catalog-gauge" aria-hidden="true">
                  <span className={`fill ${shown >= 3 ? 'low' : ''}`} style={{ width: shown >= 3 ? '30%' : '80%' }} />
                  {shown >= 2 && <span className="mark" style={{ left: '40%' }} />}
                </div>
                <div className="t-catalog-row plain">
                  <span>On hand</span>
                  <b className={shown >= 3 ? 'red' : ''}>{shown >= 3 ? '3 each' : '8 each'}</b>
                </div>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-catalog-note">Reorder threshold: 4. Reorder quantity: 12.</div>
            </Reveal>
          </div>
          <Reveal on={shown >= 4}>
            <div className="t-catalog-card">
              <div className="t-catalog-label">Needs ordered</div>
              <div className="t-catalog-row"><span>☑ Air filter 16x25</span><b>12</b></div>
              <div className="t-catalog-row"><span>☐ 1/2" brass ball valve</span><b>20</b></div>
              <div className="t-catalog-cta">Create PO from selected</div>
            </div>
          </Reveal>
        </div>
      )
    case 'warranty':
      return (
        <div className="t-catalog-split">
          <Reveal on={shown >= 1}>
            <div className="t-catalog-card">
              <div className="t-catalog-label">Invoice · Jordan Lee</div>
              <div className="t-catalog-row"><span>40-gal gas water heater</span><b>$899.00</b></div>
              <div className="t-catalog-row"><span>Install labor, 3 hours</span><b>$285.00</b></div>
              <div className="t-catalog-note">123 Main St, Springfield</div>
            </div>
          </Reveal>
          <div className="t-catalog-stack">
            {[
              { label: 'Manufacturer', days: '365 days' },
              { label: 'Company', days: '90 days' },
              { label: 'Labor', days: '180 days' },
            ].map((w, k) => (
              <Reveal key={w.label} on={shown >= k + 2}>
                <div className="t-catalog-cover"><span>🛡 {w.label}</span><b>{w.days}</b></div>
              </Reveal>
            ))}
            {shown >= 5 && <div className="t-catalog-cover ext"><span>+ Extended labor, sold for $99</span><b>+365 days</b></div>}
          </div>
        </div>
      )
    case 'rate':
      return (
        <div className="t-catalog-split">
          <div className="t-catalog-stack">
            <Reveal on={shown >= 1}>
              <div className="t-catalog-money"><span>Monthly overhead</span><b>$18,000</b></div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className="t-catalog-money muted"><span>÷ Billable hours a month</span><b>120</b></div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-catalog-sum">
                <span className="t-catalog-pill">Break-even $150 / hr</span>
                <span aria-hidden="true">→</span>
                <span className="t-catalog-pill on">Target $250 / hr</span>
              </div>
              <div className="t-catalog-note">With a 40% margin on top.</div>
            </Reveal>
          </div>
          <Reveal on={shown >= 4}>
            <div className="t-catalog-card">
              <div className="t-catalog-label">Discounts</div>
              <div className="t-catalog-row"><span>Senior / Veteran</span><b className="t-catalog-off">10% off</b></div>
              <div className="t-catalog-row"><span>Spring special · SPRING25</span><b className="t-catalog-off">$25 off</b></div>
            </div>
          </Reveal>
        </div>
      )
    case 'lines':
      return (
        <div className="t-catalog-split">
          <Reveal on={shown >= 1}>
            <div className="t-catalog-card">
              <div className="t-catalog-label">Estimate · Acme Services</div>
              <div className="t-catalog-row muted"><span>No line items yet</span></div>
              <div className="t-catalog-btns">
                <span className={`t-catalog-btn ${shown >= 2 ? 'lit' : ''}`}>+ Search catalog</span>
                <span className="t-catalog-btn">+ Add discount</span>
              </div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="t-catalog-card">
              <div className="t-catalog-label">Add from catalog</div>
              <div className={`t-catalog-row pick ${shown >= 3 ? 'on' : ''}`}><span>HVAC tune-up</span><b>$129.00</b></div>
              <div className="t-catalog-row"><span>Air filter 16x25</span><b>$12.00</b></div>
              {shown >= 3 && (
                <div className="t-catalog-filled">
                  <span>HVAC tune-up · 1 visit</span>
                  <span>$129.00 · Sales tax 7%</span>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      )
    case 'yourturn':
      return (
        <div className="t-catalog-mock">
          <div className="t-catalog-mock-bar"><span /><span /><span /></div>
          <div className="t-catalog-mock-body">
            <Reveal on={shown >= 1}>
              <div className="t-catalog-mock-head">
                <span>Service Catalog</span>
                <span className={`t-catalog-mock-new ${shown >= 2 ? 'lit' : ''}`}>+ New Service</span>
              </div>
              {SERVICES.map((s) => (
                <div key={s.name} className="t-catalog-row"><span>{s.name}</span><b>{s.price}</b></div>
              ))}
            </Reveal>
            <Reveal on={shown >= 2}><div className="t-catalog-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="t-catalog-dock"><span className="cbat-avatar small">CB</span> Your turn: click New Service</div>
            </Reveal>
          </div>
        </div>
      )
  }
}

const CSS = `
.t-catalog-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.t-catalog-in.show { opacity: 1; transform: none; }
.t-catalog-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; align-items: start; }
.t-catalog-span { grid-column: 1 / -1; }
.t-catalog-stack { display: grid; gap: 10px; }
.t-catalog-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 7px; align-content: start; }
.t-catalog-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.t-catalog-row { display: flex; align-items: baseline; gap: 8px; font-size: 13px; color: #0b1324; border-top: 1px solid #f1f5f9; padding-top: 6px; transition: background .35s, box-shadow .35s; border-radius: 6px; }
.t-catalog-row > span:first-child { flex: 1; min-width: 0; }
.t-catalog-row b { font-family: ui-monospace, monospace; font-size: 12.5px; }
.t-catalog-row b.red { color: #b91c1c; }
.t-catalog-row.plain { border-top: 0; }
.t-catalog-row.muted { color: #94a3b8; font-style: italic; }
.t-catalog-row.pick.on { background: #fffbeb; box-shadow: 0 0 0 2px #fbbf24; padding: 6px; }
.t-catalog-unit { font-size: 11px; color: #94a3b8; }
.t-catalog-note { margin: 4px 0 0; font-size: 12.5px; color: #4d586b; }
.t-catalog-money { display: flex; justify-content: space-between; align-items: baseline; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 14px; font-size: 13px; color: #334155; }
.t-catalog-money b { font-size: 20px; color: #0b1324; font-family: ui-monospace, monospace; }
.t-catalog-money.muted b { color: #64748b; }
.t-catalog-bar { display: flex; height: 14px; border-radius: 99px; overflow: hidden; background: #e2e8f0; }
.t-catalog-bar .cost { background: #94a3b8; }
.t-catalog-bar .margin { background: #10b981; }
.t-catalog-sum { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-weight: 800; color: #64748b; }
.t-catalog-pill { font-size: 12.5px; font-weight: 800; border-radius: 99px; padding: 5px 11px; border: 1px solid #cbd5e1; background: #fff; color: #334155; }
.t-catalog-pill.on { border-color: #6ee7b7; background: #ecfdf5; color: #065f46; }
.t-catalog-part { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 9px 12px; font-size: 13px; }
.t-catalog-part > span { display: grid; gap: 2px; }
.t-catalog-part small { font-size: 11px; color: #64748b; }
.t-catalog-part .mono { font-family: ui-monospace, monospace; }
.t-catalog-part.total { border-color: #fbbf24; background: #fffbeb; }
.t-catalog-star { color: #f59e0b; margin-right: 4px; }
.t-catalog-star.off { color: #cbd5e1; }
.t-catalog-gauge { position: relative; height: 16px; border-radius: 99px; background: #f1f5f9; overflow: visible; }
.t-catalog-gauge .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: #10b981; transition: width .6s, background .4s; }
.t-catalog-gauge .fill.low { background: #ef4444; }
.t-catalog-gauge .mark { position: absolute; top: -4px; bottom: -4px; width: 2px; background: #0b1324; }
.t-catalog-cta { justify-self: start; margin-top: 4px; font-size: 12px; font-weight: 800; color: #fff; background: #f59e0b; border-radius: 8px; padding: 5px 10px; }
.t-catalog-cover { display: flex; justify-content: space-between; gap: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 12px; padding: 9px 12px; font-size: 13px; font-weight: 700; }
.t-catalog-cover.ext { background: #fffbeb; border-color: #fcd34d; color: #92400e; animation: t-catalog-fade .4s ease both; }
.t-catalog-off { color: #92400e; background: #fef3c7; border-radius: 6px; padding: 1px 6px; }
.t-catalog-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.t-catalog-btn { font-size: 12px; font-weight: 700; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 9px; color: #334155; transition: all .35s; }
.t-catalog-btn.lit { border-color: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,.35); }
.t-catalog-filled { display: grid; gap: 2px; margin-top: 6px; border: 1px solid #a7f3d0; background: #ecfdf5; color: #065f46; border-radius: 10px; padding: 8px 10px; font-size: 12.5px; font-weight: 700; animation: t-catalog-fade .4s ease both; }
.t-catalog-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.t-catalog-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.t-catalog-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.t-catalog-mock-body { position: relative; padding: 14px; min-height: 210px; display: grid; gap: 6px; align-content: start; }
.t-catalog-mock-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 6px; }
.t-catalog-mock-new { font-size: 12px; font-weight: 700; color: #fff; background: #f59e0b; border-radius: 8px; padding: 5px 10px; transition: box-shadow .4s; }
.t-catalog-mock-new.lit { box-shadow: 0 0 0 4px rgba(251,191,36,.45); }
.t-catalog-pointer { position: absolute; right: 18%; top: 22%; font-size: 26px; animation: t-catalog-tap 1.4s ease-in-out infinite; }
.t-catalog-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: t-catalog-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes t-catalog-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(10px, -14px) scale(.92); } }
@keyframes t-catalog-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes t-catalog-fade { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 760px) {
  .t-catalog-split { grid-template-columns: minmax(0,1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .t-catalog-in, .t-catalog-gauge .fill, .t-catalog-row, .t-catalog-btn, .t-catalog-mock-new { transition: none; }
  .t-catalog-pointer, .t-catalog-dock, .t-catalog-filled, .t-catalog-cover.ext { animation: none; }
}
`

export const catalogScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <CatalogVisual id={id as SceneId} shown={shown} />,
  css: CSS,
}
