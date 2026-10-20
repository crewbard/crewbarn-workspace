import type { ReactNode } from 'react'
import { TUTORIAL } from '@/lib/tutorials/welcome'
import type { TutorialScript } from '../tutorialScript'

/**
 * "Welcome to CrewBarn": the film's drawings, and the script the player
 * walks. The film explains CrewBarn and ends on the road through setup; the
 * live part walks every setup step. Every class is prefixed `t-welcome-` so
 * it never clashes with another tutorial. Examples are generic, for any trade.
 */

const P = 't-welcome-'
const c = (...names: string[]) => names.filter(Boolean).map((n) => P + n).join(' ')

const REVEAL: Record<string, number> = {
  barn: 4, trade: 4, calls: 4, field: 4, paid: 4, keys: 4, road: 5, road2: 5, yourturn: 3,
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`${c('in')} ${on ? c('show') : ''} ${className}`}>{children}</div>
}

/** The whole road through setup, as stops on a line. */
const ROAD: Array<{ n: string; label: string }> = [
  { n: '✓', label: 'Your account' },
  { n: '1', label: 'AI' },
  { n: '2', label: 'Photos & maps' },
  { n: '3', label: 'Your company' },
  { n: '4', label: 'Trade pack' },
  { n: '5', label: 'Tools & trucks' },
  { n: '6', label: 'Stock' },
  { n: '7', label: 'Your crew' },
  { n: '8', label: 'Phone & texts' },
  { n: '9', label: 'Prices' },
  { n: '10', label: 'The chasing' },
  { n: '11', label: 'Have a look' },
]

function Road({ from, to, lit }: { from: number; to: number; lit: number }) {
  return (
    <ol className={c('road')}>
      {ROAD.slice(from, to).map((stop, k) => {
        const index = from + k
        const state = index === 0 ? 'done' : k < lit ? 'lit' : ''
        return (
          <li key={stop.label} className={c('stop', state)}>
            <span className={c('dot')}>{stop.n}</span>
            <span className={c('stop-label')}>{stop.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Visual({ id, shown }: { id: string; shown: number }) {
  switch (id) {
    case 'barn':
      return (
        <div className={c('stack')}>
          <div className={c('flow')}>
            {[
              { icon: '📞', head: 'The phone rings', line: 'Jordan Lee · water heater' },
              { icon: '📋', head: 'It becomes a job', line: 'Water heater repair' },
              { icon: '🗓️', head: 'On the schedule', line: 'Thu 9:00 · Sam' },
              { icon: '👷', head: 'The work gets done', line: '123 Main St, Springfield' },
              { icon: '💵', head: 'You get paid', line: '#1042 · $185.00 ✓' },
            ].map((step, k) => (
              <Reveal key={step.head} on={shown >= Math.min(4, k === 0 ? 1 : k === 1 ? 2 : k < 4 ? 3 : 4)}>
                <div className={c('card', 'step', k === 4 ? 'good' : '')}>
                  <span className={c('icon')} aria-hidden="true">{step.icon}</span>
                  <b>{step.head}</b>
                  <span className={c('note')}>{step.line}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 4}>
            <p className={c('tag')}>One barn for the whole company. No sticky notes. No three different apps.</p>
          </Reveal>
        </div>
      )

    case 'trade':
      return (
        <div className={c('split')}>
          <Reveal on={shown >= 1}>
            <div className={c('card')}>
              <div className={c('label')}>Your trade, picked at sign-up</div>
              <div className={c('chips')}>
                {['HVAC', 'Plumbing', 'Lawn care', 'Electrical', 'Garage doors', 'Pest control'].map((trade, k) => (
                  <span key={trade} className={c('chip', k === 0 ? 'on' : '')}>{trade}</span>
                ))}
              </div>
            </div>
          </Reveal>
          <div className={c('stack')}>
            <Reveal on={shown >= 2}>
              <div className={c('card')}>
                <div className={c('label')}>Job types</div>
                <div className={c('chips')}><span className={c('chip')}>Tune-up</span><span className={c('chip')}>Install</span><span className={c('chip')}>Repair</span><span className={c('chip')}>Inspection</span></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className={c('card')}>
                <div className={c('label')}>How a job moves</div>
                <div className={c('chips')}><span className={c('chip')}>Scheduled</span><span aria-hidden="true">→</span><span className={c('chip')}>On the way</span><span aria-hidden="true">→</span><span className={c('chip', 'ok')}>Done</span></div>
                <div className={c('line-row')}><span>Service call</span><b>$89.00</b></div>
                <div className={c('line-row')}><span>Furnace filter</span><b>$24.00</b></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <p className={c('tag')}>✏️ Don’t love a name? Change it. Missing something? Add it.</p>
            </Reveal>
          </div>
        </div>
      )

    case 'calls':
      return (
        <div className={c('split')}>
          <div className={c('stack')}>
            <Reveal on={shown >= 1}>
              <div className={c('card')}>
                <div className={c('label')}>One shared inbox</div>
                <div className={c('line-row')}><span>📞 Jordan Lee</span><span className={c('note')}>Call · 2 min</span></div>
                <div className={c('line-row')}><span>💬 (555) 555-0142</span><span className={c('note')}>“Can you come Tuesday?”</span></div>
                <div className={c('line-row')}><span>✉️ Riverside Apartments</span><span className={c('note')}>Lawn service quote</span></div>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}>
              <div className={c('card')}>
                <div className={c('wave')} aria-hidden="true">{Array.from({ length: 20 }, (_, k) => <span key={k} style={{ height: 6 + ((k * 7) % 18) }} />)}</div>
                <div className={c('quote')}>“The water heater’s leaking. 123 Main Street. Thursday morning works.”</div>
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 3}>
            <div className={c('card', 'draft')}>
              <div className={c('label')}><span className={c('avatar')}>CB</span> CBI drafted a job</div>
              {[['Who', 'Jordan Lee'], ['Where', '123 Main St, Springfield'], ['What', 'Water heater leaking'], ['When', 'Thursday morning']].map(([k, v]) => (
                <div key={k} className={c('field')}><span>{k}</span>{v}</div>
              ))}
              {shown >= 4 && (
                <div className={c('chips', 'pop')}>
                  <span className={c('btn')}>Confirm</span>
                  <span className={c('note')}>Nothing is saved until you say so.</span>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      )

    case 'field':
      return (
        <div className={c('split3')}>
          <Reveal on={shown >= 1}>
            <div className={c('card')}>
              <div className={c('label')}>Today</div>
              {[
                { tech: 'Sam', jobs: [{ at: 0, w: 40, name: 'Water heater' }, { at: 50, w: 35, name: 'Tune-up' }] },
                { tech: 'Alex', jobs: [{ at: 10, w: 30, name: 'Door repair' }, { at: 55, w: 40, name: 'Install' }] },
                { tech: 'Riley', jobs: [{ at: 20, w: 50, name: 'Lawn service' }] },
              ].map((row) => (
                <div key={row.tech} className={c('lane')}>
                  <span className={c('lane-name')}>{row.tech}</span>
                  <span className={c('lane-track')}>
                    {row.jobs.map((job) => <span key={job.name} className={c('block')} style={{ left: `${job.at}%`, width: `${job.w}%` }}>{job.name}</span>)}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className={c('card', 'map')}>
              <div className={c('label')}>Every truck</div>
              <div className={c('mapbox')} aria-hidden="true">
                <span className={c('road-h')} /><span className={c('road-v')} />
                <span className={c('pin')} style={{ left: '22%', top: '30%' }}>🚚</span>
                <span className={c('pin')} style={{ left: '62%', top: '58%' }}>🚚</span>
                <span className={c('pin')} style={{ left: '74%', top: '22%' }}>🚚</span>
              </div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className={c('phone')}>
              <div className={c('phone-head')}>Water heater · 9:00</div>
              <div className={c('phone-row')}>🔑 Gate code 4512</div>
              <div className={c('phone-row')}>📷 Before · After</div>
              <div className={c('phone-row')}>🔩 Parts and labor</div>
              {shown >= 4 && <div className={c('phone-row', 'sign')}>✍️ Signed by Jordan Lee</div>}
            </div>
          </Reveal>
        </div>
      )

    case 'paid':
      return (
        <div className={c('split')}>
          <Reveal on={shown >= 1}>
            <div className={c('page')}>
              <div className={c('band')} />
              <div className={c('page-head')}><b>Acme Services</b><span>INVOICE #1042</span></div>
              <div className={c('line-row')}><span>Water heater repair</span><b>$160.00</b></div>
              <div className={c('line-row')}><span>Valve</span><b>$25.00</b></div>
              <div className={c('line-row', 'total')}><span>Total</span><b>$185.00</b></div>
            </div>
          </Reveal>
          <div className={c('stack')}>
            <Reveal on={shown >= 2}>
              <div className={c('card', 'row')}>
                <span className={c('chip')}>💳 Card on the phone</span><span className={c('chip')}>📲 Text a pay link</span>
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className={c('card', 'row', 'match')}><span>Jordan Lee paid</span><b>#1042 · Paid ✓</b></div>
            </Reveal>
            <Reveal on={shown >= 4}>
              <div className={c('card', 'row')}><span>🏦 Deposit $185.00</span><span aria-hidden="true">→</span><b>Matched in your books</b></div>
            </Reveal>
          </div>
        </div>
      )

    case 'keys':
      return (
        <div className={c('stack')}>
          <div className={c('grid3')}>
            {[
              { name: 'Claude', what: 'The thinking: drafts jobs, reads photos', site: 'platform.claude.com' },
              { name: 'ChatGPT', what: 'The thinking, if that’s what you have', site: 'platform.openai.com' },
              { name: 'AssemblyAI', what: 'Phone calls turned into text', site: 'assemblyai.com' },
            ].map((key, k) => (
              <Reveal key={key.name} on={shown >= k + 1}>
                <div className={c('card', 'key')}>
                  <div className={c('keyname')}>🔑 {key.name}</div>
                  <span className={c('note')}>{key.what}</span>
                  <span className={c('link')}>Get a key ↗ {key.site}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 4}>
            <div className={c('card', 'row', 'cost')}>
              <span>Most everyday tasks</span>
              <span className={c('coin')} aria-hidden="true">½¢</span>
              <b>less than half a penny each</b>
              <span className={c('note')}>You pay them directly. Never us.</span>
            </div>
          </Reveal>
        </div>
      )

    case 'road':
      return (
        <div className={c('stack')}>
          <Reveal on>
            <Road from={0} to={5} lit={shown} />
          </Reveal>
          <Reveal on={shown >= 5}>
            <p className={c('tag')}>Skip anything, and come back to it whenever you like.</p>
          </Reveal>
        </div>
      )

    case 'road2':
      return (
        <div className={c('stack')}>
          <Reveal on>
            <Road from={5} to={12} lit={Math.min(7, shown * 2)} />
          </Reveal>
          <Reveal on={shown >= 5}>
            <div className={c('finish')}>
              <span className={c('chip', 'ok')}>You’re live</span>
              <span aria-hidden="true">→</span><span className={c('chip')}>First job</span>
              <span aria-hidden="true">→</span><span className={c('chip')}>First invoice</span>
              <span aria-hidden="true">→</span><span className={c('chip', 'ok')}>Paid ✓</span>
            </div>
          </Reveal>
        </div>
      )

    case 'yourturn':
      return (
        <div className={c('mock')}>
          <div className={c('mock-bar')}><span /><span /><span /></div>
          <div className={c('mock-body')}>
            <Reveal on={shown >= 1}>
              <div className={c('mock-head')}>Set up Acme Services</div>
              <div className={c('mock-grid')}>
                <div className={c('mock-list')}>
                  {['Let AI help', 'Photos and maps', 'Your shop', 'Trade pack'].map((m, k) => (
                    <div key={m} className={c('mock-card', k === 0 && shown >= 2 ? 'lit' : '')}>{k + 1} · {m}</div>
                  ))}
                </div>
                <div className={c('mock-step')}>
                  <div className={c('mock-line', 'w60')} /><div className={c('mock-line', 'w80')} /><div className={c('mock-line', 'w70')} />
                  <span className={c('btn')}>Save and carry on</span>
                </div>
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className={c('pointer')} aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className={c('mini-dock')}><span className={c('avatar')}>CB</span> Your turn: open Step 1</div>
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
.__stack { display: grid; gap: 12px; }
.__split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; align-items: start; }
.__split3 { display: grid; grid-template-columns: minmax(0,1.3fr) minmax(0,1fr) minmax(0,.8fr); gap: 12px; align-items: start; }
.__grid3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
.__flow { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; }
.__card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 8px; align-content: start; color: #0b1324; }
.__card.__row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; font-size: 13px; }
.__card.__good, .__card.__match { border-color: #6ee7b7; box-shadow: 0 0 0 3px #d1fae5; }
.__card.__match b { color: #047857; }
.__card.__step { justify-items: start; font-size: 13px; min-height: 118px; }
.__card.__draft { border-color: #fcd34d; box-shadow: 0 0 0 3px #fef3c7; }
.__icon { font-size: 24px; }
.__label { display: flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.__note { font-size: 12px; color: #4d586b; }
.__tag { margin: 0; font-size: 14px; font-weight: 800; color: #0b1324; text-align: center; }
.__chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.__chips.__pop { animation: __fade .4s ease both; }
.__chip { display: inline-flex; align-items: center; border-radius: 8px; padding: 4px 9px; font-size: 12px; font-weight: 800; border: 1px solid #e2e8f0; background: #f8fafc; color: #334155; }
.__chip.__on { background: #0b1324; color: #fde68a; border-color: #0b1324; }
.__chip.__ok { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.__btn { display: inline-flex; align-items: center; border-radius: 9px; padding: 5px 11px; font-size: 12px; font-weight: 900; background: #f59e0b; color: #0b1324; }
.__line-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; border-top: 1px solid #f1f5f9; padding-top: 6px; }
.__line-row.__total { font-weight: 900; border-top: 2px solid #e2e8f0; }
.__field { display: flex; gap: 8px; font-size: 13px; }
.__field span { width: 56px; flex: none; color: #64748b; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; padding-top: 2px; }
.__wave { display: flex; align-items: center; gap: 3px; height: 26px; }
.__wave span { width: 4px; border-radius: 3px; background: #f59e0b; }
.__quote { font-size: 13px; font-style: italic; }
.__avatar { width: 20px; height: 20px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 8.5px; font-weight: 900; color: #0b1324; background: linear-gradient(140deg, #fcd34d, #f59e0b 55%, #b45309); letter-spacing: 0; }
.__lane { display: grid; grid-template-columns: 44px minmax(0,1fr); gap: 6px; align-items: center; font-size: 11.5px; }
.__lane-name { font-weight: 800; }
.__lane-track { position: relative; height: 24px; background: #f1f5f9; border-radius: 6px; }
.__block { position: absolute; top: 2px; bottom: 2px; border-radius: 5px; background: #fde68a; border: 1px solid #f59e0b; font-size: 10px; font-weight: 700; padding: 3px 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.__mapbox { position: relative; height: 120px; border-radius: 10px; background: #e0f2fe; overflow: hidden; }
.__road-h { position: absolute; left: 0; right: 0; top: 45%; height: 8px; background: #fff; }
.__road-v { position: absolute; top: 0; bottom: 0; left: 40%; width: 8px; background: #fff; }
.__pin { position: absolute; font-size: 18px; transform: translate(-50%,-50%); }
.__phone { border: 6px solid #0b1324; border-radius: 22px; background: #fff; padding: 10px 8px; display: grid; gap: 6px; min-height: 190px; align-content: start; }
.__phone-head { font-size: 11.5px; font-weight: 900; color: #0b1324; }
.__phone-row { font-size: 11px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 6px; }
.__phone-row.__sign { background: #ecfdf5; border-color: #a7f3d0; color: #047857; font-weight: 800; animation: __fade .4s ease both; }
.__page { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 12px 12px; display: grid; gap: 6px; box-shadow: 0 6px 16px rgba(11,19,36,.08); overflow: hidden; color: #0b1324; }
.__band { height: 8px; background: #3b82f6; margin: 0 -12px 4px; }
.__page-head { display: flex; justify-content: space-between; font-size: 12px; }
.__page-head span { font-size: 10.5px; font-weight: 900; letter-spacing: .1em; color: #3b82f6; }
.__keyname { font-size: 15px; font-weight: 900; }
.__link { font-size: 11.5px; font-weight: 800; color: #92400e; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 7px; padding: 3px 7px; width: fit-content; }
.__cost { justify-content: center; font-size: 14px; }
.__coin { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-size: 15px; font-weight: 900; color: #78350f; background: radial-gradient(circle at 35% 30%, #fde68a, #f59e0b 70%, #b45309); box-shadow: 0 4px 10px rgba(180,83,9,.3); }
.__road { list-style: none; margin: 0; padding: 8px 0 0; display: flex; flex-wrap: wrap; gap: 18px 0; }
.__stop { position: relative; flex: 1 1 0; min-width: 88px; display: grid; justify-items: center; gap: 6px; text-align: center; }
.__stop::before { content: ""; position: absolute; top: 17px; left: -50%; right: 50%; height: 4px; background: #e2e8f0; z-index: 0; }
.__stop:first-child::before { display: none; }
.__stop.__lit::before, .__stop.__done::before { background: #f59e0b; transition: background .4s; }
.__dot { position: relative; z-index: 1; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 900; background: #fff; border: 2px solid #cbd5e1; color: #94a3b8; transition: all .4s; }
.__stop.__lit .__dot { border-color: #f59e0b; background: #fffbeb; color: #92400e; box-shadow: 0 0 0 4px rgba(251,191,36,.3); }
.__stop.__done .__dot { border-color: #10b981; background: #10b981; color: #fff; }
.__stop-label { font-size: 12px; font-weight: 800; color: #94a3b8; transition: color .4s; }
.__stop.__lit .__stop-label, .__stop.__done .__stop-label { color: #0b1324; }
.__finish { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
.__mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; color: #0b1324; }
.__mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.__mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.__mock-body { position: relative; padding: 14px; min-height: 210px; }
.__mock-head { font-weight: 900; font-size: 16px; margin-bottom: 10px; }
.__mock-grid { display: grid; grid-template-columns: minmax(0,.9fr) minmax(0,1.1fr); gap: 10px; }
.__mock-list { display: grid; gap: 6px; }
.__mock-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; font-size: 12px; font-weight: 700; transition: all .4s; }
.__mock-card.__lit { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251,191,36,.35); }
.__mock-step { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; display: grid; gap: 8px; align-content: start; }
.__mock-line { height: 7px; border-radius: 99px; background: #e2e8f0; }
.__mock-line.__w60 { width: 60%; } .__mock-line.__w70 { width: 70%; } .__mock-line.__w80 { width: 80%; }
.__pointer { position: absolute; left: 30%; top: 46%; font-size: 26px; animation: __tap 1.4s ease-in-out infinite; }
.__mini-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: __dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes __tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-24px, 6px) scale(.92); } }
@keyframes __dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes __fade { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 760px) {
  .__split, .__split3, .__grid3, .__mock-grid { grid-template-columns: minmax(0,1fr); }
  .__flow { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .__card.__step { min-height: 0; }
  .__stop { min-width: 72px; flex-basis: 25%; }
  .__stop::before { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .__in, .__pointer, .__mini-dock, .__chips, .__phone-row, .__mock-card, .__dot, .__stop::before, .__stop-label { animation: none !important; transition: none !important; }
}
`

export const welcomeScript: TutorialScript = {
  data: TUTORIAL,
  reveal: REVEAL,
  Visual: ({ id, shown }) => <Visual id={id} shown={shown} />,
  css: RAW_CSS.replace(/__/g, P),
}
