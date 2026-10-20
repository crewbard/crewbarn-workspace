/** Right-click (or press and hold) on a tile in the builder: the quick actions. */
import { useEffect, useRef } from 'react'

export type CanvasAction = 'edit' | 'copy' | 'rows' | 'remove'

export function CanvasMenu({ at, word, onChoose, onClose }: {
  at: { x: number; y: number }
  word: string
  onChoose: (a: CanvasAction) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const off = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', off)
    document.addEventListener('touchstart', off)
    document.addEventListener('keydown', esc)
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      document.removeEventListener('mousedown', off)
      document.removeEventListener('touchstart', off)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])
  const x = Math.min(at.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240)
  const y = Math.min(at.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220)
  const items: Array<[CanvasAction, string]> = [
    ['edit', `Change this ${word}`],
    ['copy', `Add another ${word} like this`],
    ['rows', 'Add rows inside'],
    ['remove', `Remove this ${word}`],
  ]
  return (
    <div ref={ref} role="menu" className="fixed z-[135] w-[230px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl" style={{ left: Math.max(8, x), top: Math.max(8, y) }}>
      {items.map(([id, label]) => (
        <button key={id} type="button" role="menuitem" onClick={() => onChoose(id)}
          className={`block min-h-[42px] w-full px-3.5 text-left text-[13.5px] font-medium hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${id === 'remove' ? 'text-red-700' : 'text-slate-800'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}
