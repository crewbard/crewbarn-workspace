import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatTime12, parseTimeInput, timeSlots } from '@/lib/time'
import { ClockPicker } from '@/components/ClockPicker'

/**
 * TimeField — the one time input across CrewBarn. Type "3:30 PM" / "330p" /
 * "15:30" and it parses, or click the field for a 15-minute slot list, or tap
 * the clock icon for the analog picker. Value is a 24-hour "HH:mm" string, so
 * it's a drop-in for the old <input type="time">.
 *
 * The dropdown/clock render in a PORTAL (position: fixed) so they escape any
 * card `overflow` — otherwise they'd be clipped inside the form section.
 */
export function TimeField({
  value,
  onChange,
  placeholder = 'Time',
  className,
  disabled,
}: {
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const [text, setText] = useState(formatTime12(value))
  const [open, setOpen] = useState(false)
  const [clockOpen, setClockOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const slots = useMemo(() => timeSlots(15), [])

  useEffect(() => {
    setText(formatTime12(value))
  }, [value])

  const commit = () => {
    if (text.trim() === '') {
      onChange('')
      return
    }
    const parsed = parseTimeInput(text)
    if (parsed) {
      onChange(parsed)
      setText(formatTime12(parsed))
    } else {
      setText(formatTime12(value))
    }
  }

  const place = () => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  const openSlots = () => { place(); setOpen(true); setClockOpen(false) }
  const openClock = () => { place(); setClockOpen(true); setOpen(false) }
  const closeAll = () => { setOpen(false); setClockOpen(false) }

  // Reposition while a popover is open (scroll/resize), and close on outside click.
  useEffect(() => {
    if (!open && !clockOpen) return
    const reposition = () => place()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || popRef.current?.contains(t)) return
      commit()
      closeAll()
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clockOpen, text, value])

  const pick = (v: string) => {
    onChange(v)
    setText(formatTime12(v))
    closeAll()
  }

  const baseCls =
    className ??
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-50'

  return (
    <div ref={anchorRef} className="relative">
      <input
        type="text"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onFocus={openSlots}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); closeAll() }
          else if (e.key === 'Escape') closeAll()
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={`${baseCls} pr-9`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onMouseDown={(e) => { e.preventDefault(); clockOpen ? closeAll() : openClock() }}
        className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 hover:text-amber-600"
        aria-label="Open clock"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      </button>

      {(open || clockOpen) && pos && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: clockOpen ? Math.min(pos.left, window.innerWidth - 296) : pos.left,
            zIndex: 70,
          }}
        >
          {clockOpen ? (
            <ClockPicker value={value} onCommit={pick} onCancel={closeAll} />
          ) : (
            <ul
              style={{ width: pos.width }}
              className="max-h-64 min-w-[9rem] overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
            >
              {slots.map((s) => (
                <li key={s.value}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(s.value) }}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-amber-50 ${s.value === value ? 'bg-amber-50 font-semibold text-amber-800' : 'text-slate-700'}`}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
