/**
 * The menu for one place (right-click, long press, Shift+F10, or the ⋯
 * button). When stock could go into the place itself or one of its rows,
 * the menu asks which, as a second step, instead of guessing.
 * Escape closes it; arrow keys move; on a phone it comes up from the bottom.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type { MenuId, MenuItem } from '@/lib/binReceive'
import type { TreeNode } from '@/lib/binTree'
import { TypeIcon } from './binUi'
import { fmtNum } from './binStyle'

const ICONS: Record<MenuId, string> = {
  'add-product': 'M12 5v14M5 12h14',
  'add-po': 'M4 7h16M4 7l2 12h12l2-12M9 11v4M15 11v4M8 7l1-3h6l1 3',
  'add-row': 'M4 6h16M4 12h10M4 18h7M18 15v6M15 18h6',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z',
  capacity: 'M4 20h16M6 16V9M10 16V5M14 16v-4M18 16V8',
  catalog: 'M4 6h16M4 12h16M4 18h10',
  details: 'M12 8h.01M11 12h1v5h1M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
}

export function BinContextMenu({
  node, items, targets, at, onChoose, onClose,
}: {
  node: TreeNode
  items: MenuItem[]
  /** Where stock may go from here (the place itself, then its rows). */
  targets: TreeNode[]
  at: { x: number; y: number }
  onChoose: (id: MenuId, targetId: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<MenuItem | null>(null)
  const [pos, setPos] = useState(at)
  const phone = typeof window !== 'undefined' && window.innerWidth < 640

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || phone) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)),
    })
  }, [at, step, phone])

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not([disabled])')?.focus()
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (step) setStep(null); else onClose() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([disabled])') ?? [])]
        const i = list.indexOf(document.activeElement as HTMLButtonElement)
        const next = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]
        next?.focus()
        e.preventDefault()
      }
    }
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose, step])

  const choose = (m: MenuItem) => {
    if (m.disabled) return
    // A short list of spots is asked here; a long one is picked in the dialog.
    if (m.pickTarget && targets.length > 1 && targets.length <= 6) { setStep(m); return }
    onChoose(m.id, targets.length === 1 && m.id === 'add-po' ? targets[0].id : node.id)
  }

  const body = (
    <div
      ref={ref}
      data-bins-ui
      role="menu"
      aria-label={`${node.label} menu`}
      className={phone
        ? 'fixed inset-x-0 bottom-0 z-[140] max-h-[80vh] overflow-y-auto rounded-t-2xl border border-[var(--bins-border)] bg-[var(--bins-surface)] pb-[env(safe-area-inset-bottom)] shadow-2xl'
        : 'fixed z-[140] w-[300px] overflow-hidden rounded-xl border border-[var(--bins-border)] bg-[var(--bins-surface)] shadow-xl'}
      style={phone ? undefined : { left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {phone && <span aria-hidden className="mx-auto mt-2 block h-1 w-10 rounded bg-[var(--bins-border)]" />}
      <div className="flex items-center gap-2 border-b border-[var(--bins-border-soft)] px-3 py-2.5">
        <TypeIcon type={node.type} size={24} />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-[var(--bins-text)]">{node.label}</div>
          <div className="truncate text-[11.5px] text-[var(--bins-muted)]">
            {node.total.amount > 0 ? `${fmtNum(node.total.amount)}${node.capacity ? ` of ${fmtNum(node.capacity)}` : ''} units` : 'Empty'}
            {node.bin?.path_label ? ` · ${node.bin.path_label}` : ''}
          </div>
        </div>
      </div>
      {step ? (
        <div className="p-1.5">
          <button type="button" onClick={() => setStep(null)} className="mb-1 flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[var(--bins-muted)] hover:bg-[var(--bins-soft)]">
            ← Back
          </button>
          <div className="px-2 pb-1.5 text-[13px] font-semibold text-[var(--bins-text)]">
            {step.id === 'add-po' ? 'Receive into which spot?' : 'Put it in which spot?'}
          </div>
          {targets.map((t) => (
            <button key={t.id} type="button" role="menuitem" onClick={() => onChoose(step.id, t.id)}
              className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--bins-accent-soft)] focus:bg-[var(--bins-accent-soft)] focus:outline-none">
              <TypeIcon type={t.type} size={22} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-[var(--bins-text)]">{t.id === node.id ? `${t.label} itself` : t.label}</span>
                <span className="block text-[11.5px] text-[var(--bins-muted)]">
                  {t.total.amount > 0 ? `${fmtNum(t.total.amount)}${t.capacity ? ` of ${fmtNum(t.capacity)}` : ''} in it` : 'Empty'}
                </span>
              </span>
              {t.code && <code className="rounded bg-[var(--bins-soft)] px-1.5 text-[11px] text-[var(--bins-muted)]">{t.code}</code>}
            </button>
          ))}
        </div>
      ) : (
        <div className="p-1.5">
          {items.map((m, i) => (
            <div key={m.id}>
              {i === 2 && <div className="my-1 border-t border-[var(--bins-border-soft)]" />}
              <button type="button" role="menuitem" disabled={m.disabled} aria-disabled={m.disabled}
                onClick={() => choose(m)}
                className="flex min-h-[44px] w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left enabled:hover:bg-[var(--bins-accent-soft)] focus:bg-[var(--bins-accent-soft)] focus:outline-none disabled:cursor-not-allowed">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                  className={`mt-0.5 shrink-0 ${m.disabled ? 'text-[var(--bins-muted)]' : 'text-[var(--bins-accent-strong)]'}`}><path d={ICONS[m.id]} /></svg>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13.5px] ${m.disabled ? 'text-[var(--bins-text-2)]' : m.id === 'add-product' ? 'font-bold text-[var(--bins-text)]' : 'font-medium text-[var(--bins-text)]'}`}>
                    {m.label}{m.pickTarget && targets.length > 1 && !m.disabled ? '…' : ''}
                  </span>
                  {m.reason && <span className="block text-[12.5px] leading-snug text-[var(--bins-text-2)]">{m.reason}</span>}
                </span>
              </button>
              {m.disabled && m.fix && (
                <div className="-mt-1 pb-1.5 pl-[38px]">
                  {'href' in m.fix
                    ? <Link to={m.fix.href} onClick={onClose} className="text-[12.5px] font-semibold text-[var(--bins-accent-ink)] underline">{m.fix.label}</Link>
                    : <button type="button" role="menuitem" onClick={() => onChoose((m.fix as { action: MenuId }).action, node.id)} className="text-[12.5px] font-semibold text-[var(--bins-accent-ink)] underline">{m.fix.label}</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return createPortal(
    <>
      {phone && <div data-bins-ui className="fixed inset-0 z-[139] bg-[color-mix(in_srgb,var(--bins-dark)_35%,transparent)]" onClick={onClose} />}
      {body}
    </>,
    document.body,
  )
}
