import { useState } from 'react'
import { from12Parts, to12Parts } from '@/lib/time'

/**
 * ClockPicker — on-brand analog clock (tap hour → tap minute → AM/PM), the
 * touch-friendly companion to TimeField's typeable slot dropdown. Value is
 * "HH:mm" (24h). Pure Tailwind/SVG, no MUI.
 */

const SIZE = 240
const C = SIZE / 2
const R = 92 // number ring radius

function pointFor(index: number): { x: number; y: number } {
  // index 0 sits at the top (12 o'clock), clockwise.
  const angle = (-90 + index * 30) * (Math.PI / 180)
  return { x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) }
}

export function ClockPicker({
  value,
  onCommit,
  onCancel,
}: {
  value: string | null | undefined
  onCommit: (hhmm: string) => void
  onCancel: () => void
}) {
  const parts = to12Parts(value)
  const [hour12, setHour12] = useState(parts.hour12)
  const [minute, setMinute] = useState(parts.minute)
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parts.ampm)
  const [view, setView] = useState<'hours' | 'minutes'>('hours')

  const hours = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i)) // 12,1,2,…,11
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,…,55

  // Which ring index the current selection points at.
  const selIndex = view === 'hours' ? hour12 % 12 : Math.round(minute / 5) % 12
  const hand = pointFor(selIndex)

  const timeLabel = `${hour12}:${String(minute).padStart(2, '0')}`

  return (
    <div className="w-[280px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
      {/* Digital readout */}
      <div className="mb-3 flex items-end justify-between">
        <div className="flex items-baseline gap-1 text-3xl font-light text-slate-800">
          <button
            type="button"
            onClick={() => setView('hours')}
            className={view === 'hours' ? 'text-amber-600' : 'hover:text-slate-900'}
          >
            {hour12}
          </button>
          <span>:</span>
          <button
            type="button"
            onClick={() => setView('minutes')}
            className={view === 'minutes' ? 'text-amber-600' : 'hover:text-slate-900'}
          >
            {String(minute).padStart(2, '0')}
          </button>
        </div>
        <div className="flex flex-col text-sm font-semibold">
          <button type="button" onClick={() => setAmpm('AM')} className={ampm === 'AM' ? 'text-amber-600' : 'text-slate-400'}>AM</button>
          <button type="button" onClick={() => setAmpm('PM')} className={ampm === 'PM' ? 'text-amber-600' : 'text-slate-400'}>PM</button>
        </div>
      </div>

      {/* Clock face */}
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <div className="absolute inset-0 rounded-full bg-slate-100" />
        <svg width={SIZE} height={SIZE} className="absolute inset-0 pointer-events-none">
          <line x1={C} y1={C} x2={hand.x} y2={hand.y} stroke="#d97706" strokeWidth={2} />
          <circle cx={C} cy={C} r={3} fill="#d97706" />
          <circle cx={hand.x} cy={hand.y} r={18} fill="#d97706" />
        </svg>
        {(view === 'hours' ? hours : minutes).map((n, i) => {
          const p = pointFor(i)
          const selected = i === selIndex
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                if (view === 'hours') {
                  setHour12(n)
                  setView('minutes')
                } else {
                  setMinute(n)
                }
              }}
              className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-sm font-medium ${
                selected ? 'text-white' : 'text-slate-700 hover:bg-slate-200'
              }`}
              style={{ left: p.x, top: p.y }}
            >
              {view === 'minutes' ? String(n).padStart(2, '0') : n}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">{timeLabel} {ampm}</span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCommit(from12Parts(hour12, minute, ampm))}
            className="px-3 py-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
