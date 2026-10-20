import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/business-setup'
import type { TutorialScript } from '../tutorialScript'

/**
 * The "Setting up your business" tutorial: the film's drawings, and the
 * script the player walks. Every class is prefixed `t-business-setup-` so it
 * never clashes with another tutorial. Examples are generic, for any trade.
 */

const P = 't-business-setup-'
const c = (...names: string[]) => names.filter(Boolean).map((n) => P + n).join(' ')

const REVEAL: Record<string, number> = {
  areas: 4, identity: 4, reach: 4, email: 3, paid: 4, types: 4, app: 3, yourturn: 3,
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`${c('in')} ${on ? c('show') : ''} ${className}`}>{children}</div>
}

function Visual({ id, shown }: { id: string; shown: number }) {
  switch (id) {
    case 'areas':
      return (
        <div className={c('connect')}>
          <Reveal on={shown >= 1}>
            <div className={c('rail')}>
              <div className={c('rail-brand')}>Crew<b>Barn</b> <span>Connect</span></div>
              {['Home', 'Your business', 'Customers & sites', 'Money', 'Connections'].map((a, k) => (
                <div key={a} className={c('rail-item', k === 1 && shown >= 2 ? 'on' : '')}>
                  {a}{a === 'Money' && <span className={c('dot')} aria-hidden="true" />}
                </div>
              ))}
            </div>
          </Reveal>
          <div className={c('areas')}>
            {[
              { name: 'Your business', items: ['Company info', 'Brand & logo', 'Customer app'] },
              { name: 'Money', items: ['Payments', 'Where card payments go', 'Payment types'] },
              { name: 'Connections', items: ['Phone, SMS & email', 'Where your email comes from'] },
            ].map((area, k) => (
              <Reveal key={area.name} on={shown >= k + 2}>
                <div className={c('card')}>
                  <div className={c('area-name')}>{area.name}</div>
                  {area.items.map((item) => <div key={item} className={c('area-item')}>{item} <span aria-hidden="true">›</span></div>)}
                </div>
              </Reveal>
            ))}
            <Reveal on={shown >= 4} className={c('span')}>
              <p className={c('note')}>Set it up here once. The everyday work stays in the CrewBarn app.</p>
            </Reveal>
          </div>
        </div>
      )

    case 'identity':
      return (
        <div className={c('split')}>
          <div className={c('stack')}>
            <Reveal on={shown >= 1}>
              <div className={c('card')}>
                <div className={c('label')}>Company info</div>
                {[
                  ['Company name', 'Acme Services'],
                  ['Phone', '(555) 555-1234'],
                  ['Address', '123 Main St, Springfield'],
                  ['License #', 'EF20001234'],
                ].map(([k, v]) => (
                  <div key={k} className={c('field')}><span>{k}</span>{v}</div>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className={c('card', 'row')}>
                <div className={c('logo')}>A</div>
                <div className={c('swatches')}>
                  {['#f59e0b', '#3b82f6', '#10b981', '#0f172a'].map((hex, k) => (
                    <span key={hex} className={c('swatch', k === 1 ? 'picked' : '')} style={{ background: hex }} />
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 3}>
            <div className={c('page')}>
              <div className={c('band')} />
              <div className={c('page-head')}>
                <div className={c('logo', 'small')}>A</div>
                <div>
                  <b>Acme Services</b>
                  <div>123 Main St, Springfield</div>
                  <div>(555) 555-1234 · License EF20001234</div>
                </div>
              </div>
              <div className={c('page-title')}>INVOICE #1042</div>
              <div className={c('line', 'w80')} /><div className={c('line', 'w60')} /><div className={c('line', 'w70')} />
              {shown >= 4 && (
                <div className={c('pills')}>
                  <span className={c('pill')}>Quotes</span><span className={c('pill')}>Invoices</span><span className={c('pill')}>Emails</span>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      )

    case 'reach':
      return (
        <div className={c('grid2')}>
          <Reveal on={shown >= 1}>
            <div className={c('card')}>
              <div className={c('label')}>CrewBarn sends it · the default</div>
              <div className={c('bubble')}>Hi Jordan, Sam from Acme Services is on the way for your water heater.</div>
              <div className={c('note')}>Nothing to set up.</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className={c('card')}>
              <div className={c('label')}>Your own Twilio number</div>
              <div className={c('from')}>From (555) 555-0199</div>
              <div className={c('bubble')}>Your lawn service is booked for Tuesday at 9.</div>
              <div className={c('note')}>About five minutes, with a test first.</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className={c('card')}>
              <div className={c('label')}>Your office phone service</div>
              <div className={c('chips')}>
                <span className={c('chip', 'ok')}>Texts</span><span className={c('chip', 'ok')}>Web calling</span><span className={c('chip', 'ok')}>Recordings</span>
              </div>
            </div>
          </Reveal>
          <Reveal on={shown >= 4}>
            <div className={c('card')}>
              <div className={c('label')}>Call transcription</div>
              <div className={c('wave')} aria-hidden="true">{Array.from({ length: 18 }, (_, k) => <span key={k} style={{ height: 6 + ((k * 7) % 18) }} />)}</div>
              <div className={c('transcript')}>“The back door won’t latch. Can someone come Thursday?”</div>
            </div>
          </Reveal>
        </div>
      )

    case 'email':
      return (
        <div className={c('flow')}>
          <Reveal on={shown >= 1}>
            <div className={c('card', 'mail')}>
              <div className={c('label')}>Before</div>
              <div className={c('from')}>Acme Services &lt;support@crewbarn.com&gt;</div>
              <div className={c('mail-subject')}>Your estimate is ready</div>
              <span className={c('chip', 'warn')}>More likely filtered</span>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className={c('card', 'dns')}>
              <div className={c('label')}>A few records, once</div>
              <div className={c('rec')}><b>TXT</b><span>resend._domainkey</span></div>
              <div className={c('rec')}><b>MX</b><span>send</span></div>
              <div className={c('rec')}><b>TXT</b><span>send</span></div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className={c('card', 'mail', 'good')}>
              <div className={c('label')}>After</div>
              <div className={c('from')}>Acme Services &lt;service@acmeservices.com&gt;</div>
              <div className={c('mail-subject')}>Your estimate is ready</div>
              <span className={c('chip', 'ok')}>✓ Your own address</span>
            </div>
          </Reveal>
        </div>
      )

    case 'paid':
      return (
        <div className={c('split')}>
          <Reveal on={shown >= 1}>
            <div className={c('card')}>
              <div className={c('label')}>Customer portal</div>
              <div className={c('due')}>Invoice #1042 · <b>$185.00</b></div>
              <div className={c('payopt', shown >= 2 ? 'lit' : '')}>💳 Pay by card</div>
              <div className={c('payopt', shown >= 3 ? 'lit' : '')}>🏦 Pay by bank transfer</div>
            </div>
          </Reveal>
          <div className={c('stack')}>
            <Reveal on={shown >= 2}>
              <div className={c('card', 'row')}>
                <span className={c('chip', 'ok')}>Stripe</span><span className={c('chip')}>or GoDaddy Payments</span>
                <span className={c('note')}>Straight to you</span>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className={c('card', 'row')}>
                <span className={c('chip', 'warn')}>“I’ve sent it”</span>
                <span className={c('note')}>A promise, still unpaid</span>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className={c('card', 'row', 'match')}>
                <span>🏦 Deposit $185.00</span><span aria-hidden="true">→</span><b>#1042 paid ✓</b>
              </div>
            </Reveal>
          </div>
        </div>
      )

    case 'types':
      return (
        <div className={c('split')}>
          <div className={c('stack')}>
            <Reveal on={shown >= 1}>
              <div className={c('card')}>
                <div className={c('label')}>Record a payment</div>
                <div className={c('chips')}>
                  <span className={c('chip')}>Cash</span><span className={c('chip')}>Check</span><span className={c('chip')}>Card</span>
                  {shown >= 2 && <span className={c('chip', 'custom')}>Zelle</span>}
                  {shown >= 2 && <span className={c('chip', 'custom')}>House account</span>}
                </div>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <p className={c('note')}>Turn off the ones you never take. Add the ones you do.</p>
            </Reveal>
          </div>
          <div className={c('stack')}>
            <Reveal on={shown >= 3}>
              <div className={c('card', 'row')}>
                <span>👷 Tech collects <b>$120 cash</b></span>
                <span className={c('chip', 'warn')}>Waiting to be turned in</span>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className={c('card', 'row', 'match')}>
                <span>Jordan Lee, cash flow manager</span><b>Received ✓</b>
              </div>
            </Reveal>
          </div>
        </div>
      )

    case 'app':
      return (
        <div className={c('split')}>
          <Reveal on={shown >= 1}>
            <div className={c('phone')}>
              <div className={c('home')}>
                <div className={c('appicon')}>A</div>
                <div className={c('appname')}>Acme Services</div>
              </div>
            </div>
          </Reveal>
          <div className={c('stack')}>
            <Reveal on={shown >= 2}>
              <div className={c('card')}>
                <div className={c('label')}>Opens your customer portal</div>
                <div className={c('area-item')}>Invoice #1042 · $185.00 <span aria-hidden="true">›</span></div>
                <div className={c('area-item')}>HVAC tune-up · Tuesday <span aria-hidden="true">›</span></div>
                <div className={c('note')}>Customers who sign up here only see your company.</div>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className={c('chips')}>
                <span className={c('chip', 'store')}>▶ Google Play</span><span className={c('chip', 'store')}>App Store</span>
              </div>
              <p className={c('note')}>Listed under your own developer accounts.</p>
            </Reveal>
          </div>
        </div>
      )

    case 'yourturn':
      return (
        <div className={c('mock')}>
          <div className={c('mock-bar')}><span /><span /><span /></div>
          <div className={c('mock-body')}>
            <Reveal on={shown >= 1}>
              <div className={c('mock-head')}>Connect · Your business</div>
              <div className={c('mock-grid')}>
                {['Company info', 'Brand & logo', 'Customer app', 'Payments'].map((m) => (
                  <div key={m} className={c('mock-card', m === 'Company info' && shown >= 2 ? 'lit' : '')}>{m}</div>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className={c('pointer')} aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className={c('mini-dock')}><span className={c('avatar')}>CB</span> Your turn: open Company info</div>
            </Reveal>
          </div>
        </div>
      )
  }
  return null
}

const RAW_CSS = `
.__in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.__in.__show { opacity: 1; transform: none; }
.__card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 8px; align-content: start; }
.__card.__row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; font-size: 13px; color: #0b1324; }
.__card.__match { border-color: #6ee7b7; box-shadow: 0 0 0 3px #d1fae5; }
.__card.__match b { color: #047857; }
.__label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.__note { margin: 0; font-size: 12.5px; color: #4d586b; }
.__span { grid-column: 1 / -1; }
.__split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; align-items: start; }
.__grid2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.__stack { display: grid; gap: 10px; }
.__connect { display: grid; grid-template-columns: 190px minmax(0,1fr); gap: 14px; align-items: start; }
.__rail { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 10px; display: grid; gap: 4px; }
.__rail-brand { font-size: 14px; font-weight: 800; color: #0b1324; padding: 2px 6px 8px; }
.__rail-brand b { color: #f59e0b; }
.__rail-brand span { font-size: 10px; background: #0b1324; color: #fff; border-radius: 99px; padding: 2px 7px; margin-left: 4px; vertical-align: middle; }
.__rail-item { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; color: #475569; border-radius: 8px; padding: 6px 8px; transition: all .35s; }
.__rail-item.__on { background: #fffbeb; color: #0b1324; font-weight: 700; box-shadow: inset 0 0 0 1px #fde68a; }
.__dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; }
.__areas { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
.__area-name { font-size: 14px; font-weight: 800; color: #0b1324; }
.__area-item { display: flex; justify-content: space-between; gap: 6px; font-size: 12.5px; color: #475569; border-top: 1px solid #f1f5f9; padding-top: 6px; }
.__field { display: flex; gap: 8px; font-size: 12.5px; color: #0b1324; }
.__field span { width: 104px; flex: none; color: #64748b; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; padding-top: 2px; }
.__logo { width: 44px; height: 44px; border-radius: 12px; background: #3b82f6; color: #fff; font-weight: 900; font-size: 20px; display: grid; place-items: center; flex: none; }
.__logo.__small { width: 34px; height: 34px; font-size: 16px; border-radius: 9px; }
.__swatches { display: flex; gap: 8px; }
.__swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid #e2e8f0; }
.__swatch.__picked { border-color: #0b1324; box-shadow: 0 0 0 3px #e2e8f0; }
.__page { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 0 12px; display: grid; gap: 7px; box-shadow: 0 6px 16px rgba(11,19,36,.08); overflow: hidden; min-height: 220px; align-content: start; }
.__band { height: 8px; background: #3b82f6; }
.__page-head { display: flex; gap: 10px; padding: 6px 12px; font-size: 11px; color: #64748b; line-height: 1.5; }
.__page-head b { color: #0b1324; font-size: 14px; }
.__page-title { margin: 2px 12px; font-size: 11px; font-weight: 900; letter-spacing: .12em; color: #3b82f6; }
.__line { height: 7px; border-radius: 99px; background: #e2e8f0; margin: 0 12px; }
.__line.__w80 { width: 75%; } .__line.__w70 { width: 65%; } .__line.__w60 { width: 55%; }
.__pills, .__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.__pills { margin: 6px 12px 0; animation: __fade .4s ease both; }
.__pill { font-size: 11.5px; font-weight: 700; border-radius: 99px; padding: 3px 9px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.__chip { display: inline-flex; align-items: center; border-radius: 8px; padding: 4px 9px; font-size: 12px; font-weight: 800; border: 1px solid #e2e8f0; background: #f8fafc; color: #334155; }
.__chip.__ok { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.__chip.__warn { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
.__chip.__custom { background: #fffbeb; color: #92400e; border-color: #fcd34d; animation: __fade .4s ease both; }
.__chip.__store { background: #0b1324; color: #fff; border-color: #0b1324; }
.__bubble { background: #e5e7eb; color: #0f172a; font-size: 13px; line-height: 1.4; border-radius: 18px 18px 18px 6px; padding: 9px 12px; }
.__from { font-size: 11.5px; font-weight: 700; color: #475569; font-family: ui-monospace, monospace; word-break: break-all; }
.__wave { display: flex; align-items: center; gap: 3px; height: 26px; }
.__wave span { width: 4px; border-radius: 3px; background: #f59e0b; }
.__transcript { font-size: 13px; font-style: italic; color: #0b1324; }
.__flow { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,.8fr) minmax(0,1fr); gap: 12px; align-items: start; }
.__mail-subject { font-size: 13.5px; font-weight: 800; color: #0b1324; }
.__card.__good { border-color: #6ee7b7; }
.__rec { display: flex; gap: 8px; font-size: 12px; font-family: ui-monospace, monospace; color: #334155; border-top: 1px solid #f1f5f9; padding-top: 5px; }
.__rec b { width: 34px; color: #0b1324; }
.__due { font-size: 13.5px; color: #0b1324; }
.__payopt { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; font-size: 13px; font-weight: 700; transition: all .35s; }
.__payopt.__lit { border-color: #f59e0b; box-shadow: 0 0 0 3px #fde68a; }
.__phone { width: 170px; height: 250px; margin: 0 auto; border-radius: 28px; border: 6px solid #0b1324; background: linear-gradient(160deg, #e0f2fe, #fef3c7); display: grid; place-items: center; }
.__home { display: grid; justify-items: center; gap: 6px; }
.__appicon { width: 58px; height: 58px; border-radius: 15px; background: #3b82f6; color: #fff; font-size: 26px; font-weight: 900; display: grid; place-items: center; box-shadow: 0 8px 18px rgba(59,130,246,.35); }
.__appname { font-size: 12px; font-weight: 700; color: #0b1324; }
.__mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.__mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.__mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.__mock-body { position: relative; padding: 14px; min-height: 210px; }
.__mock-head { font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 10px; }
.__mock-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
.__mock-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12.5px; font-weight: 700; transition: all .4s; }
.__mock-card.__lit { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251,191,36,.35); }
.__pointer { position: absolute; left: 34%; top: 40%; font-size: 26px; animation: __tap 1.4s ease-in-out infinite; }
.__mini-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: __dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.__avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); }
@keyframes __tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px, 6px) scale(.92); } }
@keyframes __dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes __fade { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 760px) {
  .__split, .__grid2, .__flow, .__connect, .__areas { grid-template-columns: minmax(0,1fr); }
  .__rail { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .__in, .__pointer, .__mini-dock, .__pills, .__chip, .__payopt, .__mock-card, .__rail-item { animation: none !important; transition: none !important; }
}
`

export const businessSetupScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <Visual id={id} shown={shown} />,
  css: RAW_CSS.replace(/__/g, P),
}
