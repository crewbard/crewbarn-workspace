import type { ReactNode } from 'react'
import type { TemplatesFilmSceneId } from '@/lib/templatesTutorialLines'

/**
 * The drawn scenes for the film part of the Templates & Forms tutorial.
 * Each scene builds up piece by piece (`shown` counts the pieces on screen)
 * while the narrator reads it. Examples are generic so they fit any trade.
 */

export const TEMPLATES_REVEAL_STEPS: Record<TemplatesFilmSceneId, number> = {
  kinds: 3, moments: 5, chips: 4, tags: 3, default: 4, forms: 4, where: 5, yourturn: 3,
}

function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`cbt-in ${on ? 'show' : ''} ${className}`}>{children}</div>
}

function Chip({ kind, label, n }: { kind: 'sends' | 'off' | 'missing' | 'copies'; label: string; n?: number }) {
  return (
    <span className={`cbt-chip ${kind}`}>
      {kind === 'missing' ? '+ ' : ''}{label}{kind === 'off' ? ' off' : ''}
      {kind === 'copies' && <span className="cbt-chip-n">{n ?? 2}</span>}
    </span>
  )
}

const STAGES: Array<{ label: string; moments: string[] }> = [
  { label: 'Before the job', moments: ['Estimate', 'Appointment reminder'] },
  { label: 'On the job', moments: ['Tech on the way', 'Work order'] },
  { label: 'Getting paid', moments: ['Invoice', 'Payment received'] },
  { label: 'After the job', moments: ['Thank you + review', 'Agreement renewal'] },
]

export function TemplatesFilmVisual({ id, shown }: { id: TemplatesFilmSceneId; shown: number }) {
  switch (id) {
    case 'kinds':
      return (
        <div className="cbt-cards three">
          <Reveal on={shown >= 1}>
            <div className="cbt-card">
              <div className="cbt-label">✉ Email</div>
              <div className="cbt-mail">
                <div className="cbt-mail-subject">Your visit is confirmed</div>
                <div className="cbt-line w90" /><div className="cbt-line w70" /><div className="cbt-line w80" />
              </div>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="cbt-card">
              <div className="cbt-label">💬 Text</div>
              <div className="cbt-bubble">Hi Jordan, Sam is on the way and should be there around 10. Reply here with any questions.</div>
            </div>
          </Reveal>
          <Reveal on={shown >= 3}>
            <div className="cbt-card">
              <div className="cbt-label">📄 Document</div>
              <div className="cbt-page">
                <div className="cbt-page-band" />
                <div className="cbt-line w80" /><div className="cbt-line w60" /><div className="cbt-line w90" />
                <div className="cbt-sign">Customer signature</div>
              </div>
            </div>
          </Reveal>
        </div>
      )
    case 'moments':
      return (
        <div>
          <div className="cbt-lanes">
            {STAGES.map((stage, k) => (
              <Reveal key={stage.label} on={shown >= k + 1}>
                <div className="cbt-lane">
                  <div className="cbt-lane-head"><span className="cbt-num">{k + 1}</span>{stage.label}</div>
                  {stage.moments.map((m) => (
                    <div key={m} className={`cbt-moment ${shown >= 5 && m === 'Tech on the way' ? 'hot' : ''}`}>
                      <b>{m}</b>
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 5}>
            <div className="cbt-trigger">
              <span className="cbt-bolt">⚡ Tech starts travel</span>
              <span aria-hidden="true">→</span>
              <span className="cbt-bubble small">Sam is on the way to you now.</span>
            </div>
          </Reveal>
        </div>
      )
    case 'chips':
      return (
        <div className="cbt-legend">
          {[
            { kind: 'sends' as const, label: 'Email', text: 'Sends at this moment' },
            { kind: 'off' as const, label: 'Text', text: 'Made, but turned off' },
            { kind: 'missing' as const, label: 'Document', text: 'Not made yet' },
            { kind: 'copies' as const, label: 'Email', text: 'Has copies. Only one sends' },
          ].map((row, k) => (
            <Reveal key={row.text} on={shown >= k + 1}>
              <div className="cbt-legend-row">
                <Chip kind={row.kind} label={row.label} />
                <span>{row.text}</span>
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'tags':
      return (
        <div className="cbt-split">
          <Reveal on={shown >= 1}>
            <div className="cbt-card">
              <div className="cbt-label">What you write</div>
              <p className="cbt-mono">Hi <mark>{'{{customer.first_name}}'}</mark>, this is <mark>{'{{company.name}}'}</mark>. See you <mark>{'{{appointment.date}}'}</mark>.</p>
            </div>
          </Reveal>
          <Reveal on={shown >= 2}>
            <div className="cbt-card">
              <div className="cbt-label">What they get</div>
              <p className="cbt-filled">Hi <b>Jordan</b>, this is <b>Acme Services</b>. See you <b>Tuesday, May 12</b>.</p>
            </div>
          </Reveal>
          <Reveal on={shown >= 3} className="cbt-span">
            <p className="cbt-note">Pick tags from a list. You never have to remember them.</p>
          </Reveal>
        </div>
      )
    case 'default':
      return (
        <div className="cbt-split">
          <div className="cbt-stack">
            {['Payment reminder', 'Payment reminder (friendly)', 'Payment reminder (final)'].map((name, k) => (
              <Reveal key={name} on={shown >= k + 1}>
                <div className={`cbt-row ${shown >= 4 && k === 0 ? 'star' : ''}`}>
                  <span>{name}</span>
                  {shown >= 4 && k === 0 && <span className="cbt-default">★ Default</span>}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal on={shown >= 4}>
            <div className="cbt-card">
              <div className="cbt-label">Invoice is past due</div>
              <div className="cbt-sendline">★ Default sends on its own</div>
              <div className="cbt-sendline muted">The others: pick them by hand</div>
            </div>
          </Reveal>
        </div>
      )
    case 'forms':
      return (
        <div className="cbt-split">
          <div>
            <Reveal on={shown >= 1}>
              <div className="cbt-label">Make a form</div>
              <div className="cbt-pills">
                {['Customer name', 'Address', 'Work done', 'Parts used', 'Total'].map((f, k) => (
                  <span key={f} className={`cbt-pill ${shown >= 2 && k < 4 ? 'on' : ''}`}>{shown >= 2 && k < 4 ? '✓ ' : '+ '}{f}</span>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 3}>
              <div className="cbt-label" style={{ marginTop: 14 }}>Signature slots</div>
              <div className="cbt-pills">
                <span className="cbt-pill sig">Customer</span><span className="cbt-pill sig">Technician</span><span className="cbt-pill sig">Company</span>
              </div>
            </Reveal>
          </div>
          <Reveal on={shown >= 2}>
            <div className="cbt-page tall">
              <div className="cbt-page-band"><span>WORK ORDER</span></div>
              <div className="cbt-field"><span>Customer</span>Jordan Lee</div>
              <div className="cbt-field"><span>Address</span>123 Main St, Springfield</div>
              <div className="cbt-field"><span>Work done</span>Annual service</div>
              <div className="cbt-field"><span>Parts used</span>Filter, belt</div>
              {shown >= 4 && <div className="cbt-sign">✍ Customer signature</div>}
            </div>
          </Reveal>
        </div>
      )
    case 'where':
      return (
        <div className="cbt-hub">
          <Reveal on={shown >= 1} className="cbt-hub-center">
            <div className="cbt-hub-core">📄 Templates &amp; Forms</div>
          </Reveal>
          {[
            { icon: '👤', title: 'A customer’s account', line: 'Files › Templates', extra: <div className="cbt-override"><span>Invoice</span><b>Commercial invoice ★</b></div> },
            { icon: '🚦', title: 'Job stages', line: 'Each stage can email or text' },
            { icon: '⏰', title: 'Reminders and automations', line: 'Pick the email or text they send' },
            { icon: '🧾', title: 'Jobs, estimates, messages', line: 'Agreements to sign, saved replies' },
          ].map((spot, k) => (
            <Reveal key={spot.title} on={shown >= k + 2} className={`cbt-spoke s${k}`}>
              <div className="cbt-card">
                <div className="text-sm font-bold">{spot.icon} {spot.title}</div>
                <div className="cbt-note" style={{ marginTop: 0 }}>{spot.line}</div>
                {spot.extra}
              </div>
            </Reveal>
          ))}
        </div>
      )
    case 'yourturn':
      return (
        <div className="cbt-mock">
          <div className="cbt-mock-bar"><span /><span /><span /></div>
          <div className="cbt-mock-body">
            <Reveal on={shown >= 1}>
              <div className="cbt-mock-head">Templates &amp; Forms</div>
              <div className="cbt-mock-grid">
                {['Estimate', 'Appointment reminder', 'Tech on the way', 'Invoice'].map((m) => (
                  <div key={m} className={`cbt-mock-card ${m === 'Appointment reminder' && shown >= 2 ? 'lit' : ''}`}>{m}</div>
                ))}
              </div>
            </Reveal>
            <Reveal on={shown >= 2}><div className="cbt-pointer" aria-hidden="true">👆</div></Reveal>
            <Reveal on={shown >= 3}>
              <div className="cbt-mini-dock"><span className="cbt-avatar small">CB</span> Your turn: click the card</div>
            </Reveal>
          </div>
        </div>
      )
  }
}

export const TEMPLATES_FILM_CSS = `
.cbt-in { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
.cbt-in.show { opacity: 1; transform: none; }
.cbt-cards { display: grid; gap: 12px; }
.cbt-cards.three { grid-template-columns: repeat(3, minmax(0,1fr)); }
.cbt-card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 20px rgba(11,19,36,.06); display: grid; gap: 8px; align-content: start; }
.cbt-label { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.cbt-mail { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; display: grid; gap: 6px; }
.cbt-mail-subject { font-weight: 800; font-size: 13px; color: #0b1324; }
.cbt-line { height: 7px; border-radius: 99px; background: #e2e8f0; }
.cbt-line.w90 { width: 90%; } .cbt-line.w80 { width: 80%; } .cbt-line.w70 { width: 70%; } .cbt-line.w60 { width: 60%; }
.cbt-bubble { background: #e5e7eb; color: #0f172a; font-size: 13px; line-height: 1.4; border-radius: 18px 18px 18px 6px; padding: 9px 12px; }
.cbt-bubble.small { font-size: 12px; padding: 6px 10px; }
.cbt-page { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 0 10px; display: grid; gap: 6px; box-shadow: 0 6px 16px rgba(11,19,36,.08); overflow: hidden; }
.cbt-page > .cbt-line { margin: 0 10px; }
.cbt-page.tall { min-height: 220px; }
.cbt-page-band { height: 22px; background: #f59e0b; color: #fff; font-size: 11px; font-weight: 900; letter-spacing: .1em; display: flex; align-items: center; padding: 0 10px; }
.cbt-sign { margin: 8px 10px 0; border-top: 1.5px solid #0b1324; padding-top: 3px; font-size: 10.5px; color: #475569; width: 60%; animation: cbt-fade .4s ease both; }
.cbt-field { margin: 0 10px; font-size: 12px; color: #0b1324; display: flex; gap: 8px; }
.cbt-field span { width: 74px; flex: none; color: #64748b; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; padding-top: 2px; }
.cbt-lanes { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
.cbt-lane { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px; display: grid; gap: 6px; }
.cbt-lane-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: #0b1324; }
.cbt-num { width: 20px; height: 20px; border-radius: 50%; background: #0b1324; color: #fde68a; font-size: 10.5px; font-weight: 800; display: grid; place-items: center; flex: none; }
.cbt-moment { border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 9px; font-size: 12px; transition: box-shadow .35s, border-color .35s; }
.cbt-moment.hot { border-color: #f59e0b; box-shadow: 0 0 0 3px #fde68a; }
.cbt-trigger { margin-top: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 13px; }
.cbt-bolt { background: #f59e0b; color: #0b1324; font-weight: 800; font-size: 12px; border-radius: 9px; padding: 4px 10px; }
.cbt-chip { display: inline-flex; align-items: center; gap: 5px; border-radius: 8px; padding: 4px 9px; font-size: 12.5px; font-weight: 800; border: 1px solid; }
.cbt-chip.sends { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.cbt-chip.off { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
.cbt-chip.missing { color: #64748b; border-style: dashed; border-color: #cbd5e1; background: #fff; }
.cbt-chip.copies { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
.cbt-chip-n { width: 17px; height: 17px; border-radius: 50%; background: #f59e0b; color: #fff; font-size: 10px; display: grid; place-items: center; }
.cbt-legend { display: grid; gap: 10px; max-width: 520px; }
.cbt-legend-row { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; font-size: 14px; color: #334155; }
.cbt-legend-row .cbt-chip { min-width: 112px; justify-content: center; }
.cbt-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; align-items: start; }
.cbt-span { grid-column: 1 / -1; }
.cbt-mono { margin: 0; font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.7; color: #0b1324; }
.cbt-mono mark { background: #fef3c7; color: #92400e; border-radius: 5px; padding: 1px 4px; }
.cbt-filled { margin: 0; font-size: 15px; line-height: 1.6; color: #0b1324; }
.cbt-filled b { background: #ecfdf5; color: #065f46; border-radius: 5px; padding: 1px 4px; }
.cbt-note { margin: 4px 0 0; font-size: 12.5px; color: #4d586b; }
.cbt-stack { display: grid; gap: 8px; }
.cbt-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 10px 12px; font-size: 13px; font-weight: 700; transition: box-shadow .35s, border-color .35s; }
.cbt-row.star { border-color: #34d399; box-shadow: 0 0 0 3px #d1fae5; }
.cbt-default { font-size: 11px; font-weight: 800; color: #047857; background: #ecfdf5; border-radius: 99px; padding: 2px 8px; }
.cbt-sendline { font-size: 13px; font-weight: 700; color: #047857; }
.cbt-sendline.muted { color: #64748b; font-weight: 600; }
.cbt-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.cbt-pill { font-size: 12px; font-weight: 700; border-radius: 99px; padding: 4px 10px; border: 1px dashed #cbd5e1; color: #64748b; background: #fff; transition: all .35s; }
.cbt-pill.on { border-style: solid; border-color: #6ee7b7; color: #065f46; background: #ecfdf5; }
.cbt-pill.sig { border-style: solid; border-color: #6ee7b7; color: #065f46; background: #f0fdf4; font-family: ui-monospace, monospace; }
.cbt-hub { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; position: relative; }
.cbt-hub-center { grid-column: 1 / -1; display: flex; justify-content: center; }
.cbt-hub-core { background: #0b1324; color: #fde68a; font-weight: 900; font-size: 15px; border-radius: 999px; padding: 10px 18px; box-shadow: 0 10px 24px rgba(11,19,36,.25); }
.cbt-override { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; border: 1px solid #a7f3d0; background: #ecfdf5; color: #065f46; border-radius: 8px; padding: 5px 8px; }
.cbt-mock { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; max-width: 640px; margin: 0 auto; }
.cbt-mock-bar { display: flex; gap: 5px; padding: 8px 10px; background: #f1f5f9; }
.cbt-mock-bar span { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.cbt-mock-body { position: relative; padding: 14px; min-height: 210px; }
.cbt-mock-head { font-weight: 900; font-size: 16px; color: #0b1324; margin-bottom: 10px; }
.cbt-mock-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
.cbt-mock-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12.5px; font-weight: 700; transition: all .4s; }
.cbt-mock-card.lit { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251,191,36,.35); }
.cbt-pointer { position: absolute; left: 70%; top: 40%; font-size: 26px; animation: cbt-tap 1.4s ease-in-out infinite; }
.cbt-mini-dock { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; background: #0b1324; color: #fff; font-size: 12px; font-weight: 700; border-radius: 14px; padding: 8px 12px; box-shadow: 0 10px 24px rgba(11,19,36,.35); animation: cbt-dock .7s cubic-bezier(.2,.9,.3,1.2) both; }
.cbt-avatar.small { width: 22px; height: 22px; font-size: 9px; }
@keyframes cbt-tap { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px, 6px) scale(.92); } }
@keyframes cbt-dock { from { opacity: 0; transform: scale(2.2) translate(-20%, -30%); } to { opacity: 1; transform: none; } }
@keyframes cbt-fade { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 760px) {
  .cbt-cards.three, .cbt-split { grid-template-columns: minmax(0,1fr); }
  .cbt-lanes { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
`
