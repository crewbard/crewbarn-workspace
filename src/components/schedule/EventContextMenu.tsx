import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useJobStatuses } from '@/hooks/useJobStatuses'
import { visibleStatusColor } from '@/lib/statusColor'
import type { ScheduleWorkOrder } from '@/types/schedule'

/**
 * Right-click context menu for an event tile. Floating panel anchored
 * to cursor coordinates. Closes on outside click or Escape.
 *
 * Actions:
 *   - Change status — submenu of all statuses
 *   - Cancel — quick alias for setting status to a cancelled-category one
 *   - Reassign — submenu listing every tech (plus "Unassigned")
 *   - Open detail — same as clicking the event normally
 */
export interface EventContextMenuProps {
  wo: ScheduleWorkOrder
  x: number
  y: number
  onClose: () => void
  onChangeStatus: (statusId: string) => void
  onReassign: (techAccountId: string | null) => void
  onChangeTime?: (startIso: string, endIso: string) => void
  onOpenDetail: () => void
  /** Estimate-only: open the Convert-to-job overlay. */
  onConvertToJob?: () => void
}

export function EventContextMenu({
  wo,
  x,
  y,
  onClose,
  onChangeStatus,
  onReassign,
  onChangeTime,
  onOpenDetail,
  onConvertToJob,
}: EventContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [showStatuses, setShowStatuses] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [showTimeChange, setShowTimeChange] = useState(false)

  // Tech roster for the reassign submenu. Same `dispatch-board` query
  // key as TrackingDeviceEditor + DispatchPage — react-query shares the
  // cache, so this only hits the network if the data isn't already warm.
  const board = useQuery({
    queryKey: ['dispatch-board'],
    queryFn: () =>
      apiRequest<{ data: { techs: Array<{ id: string; name: string }> } }>(
        '/v1/dispatch/board',
      ),
    staleTime: 60_000,
    enabled: showReassign,
  })
  const techs = board.data?.data.techs ?? []

  // Pre-fill datetime-local inputs with the WO's current schedule.
  const toLocalInput = (iso: string | null): string => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    )
  }
  const [newStart, setNewStart] = useState(toLocalInput(wo.scheduled_start_time))
  const [newEnd, setNewEnd] = useState(toLocalInput(wo.scheduled_end_time))

  const statusesQuery = useJobStatuses()
  const statuses = statusesQuery.data?.data ?? []
  const cancelStatus = statuses.find((s) => s.name.toLowerCase().includes('cancel'))

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // Clamp position so the menu stays inside the viewport.
  const left = Math.min(x, window.innerWidth - 240)
  const top = Math.min(y, window.innerHeight - 280)

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 200, width: 220 }}
      className="bg-white border border-slate-200 rounded-md shadow-xl py-1 text-sm"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] text-slate-500">
        {wo.customer?.name ?? '—'} · #{wo.work_order_number ?? '—'}
      </div>

      <MenuItem onClick={onOpenDetail}>📋 Open detail</MenuItem>

      {/* Convert-to-job — only for estimate events. Backend rejects if
          the estimate isn't yet 'approved'; the modal will surface that. */}
      {wo.kind === 'estimate' && onConvertToJob && (
        <MenuItem onClick={() => { onConvertToJob(); onClose() }}>
          🔁 Convert to job…
        </MenuItem>
      )}

      {onChangeTime && (
        <div
          className="relative"
          onMouseEnter={() => {
            setShowTimeChange(true)
            setShowStatuses(false)
            setShowReassign(false)
          }}
          onMouseLeave={() => setShowTimeChange(false)}
        >
          <MenuItem rightArrow active={showTimeChange}>
            🕒 Change time
          </MenuItem>
          {showTimeChange && (
            <div
              className="absolute top-0 bg-white border border-slate-200 rounded-md shadow-xl p-3 w-72"
              style={{ left: 'calc(100% - 1px)' }}
            >
              <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-1">
                Start
              </label>
              <input
                type="datetime-local"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-full text-xs px-2 py-1 border border-slate-200 rounded mb-2"
              />
              <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-1">
                End
              </label>
              <input
                type="datetime-local"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="w-full text-xs px-2 py-1 border border-slate-200 rounded mb-3"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!newStart || !newEnd) return
                    const s = new Date(newStart)
                    const e = new Date(newEnd)
                    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
                      alert('End time must be after start time')
                      return
                    }
                    onChangeTime(s.toISOString(), e.toISOString())
                    onClose()
                  }}
                  className="text-xs px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded flex-1 font-medium"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowTimeChange(false)}
                  className="text-xs px-3 py-1 border border-slate-200 hover:bg-slate-50 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wrapping parent + submenu in one hover container so moving between
          them keeps the submenu open. Submenu opens to the right with a
          1px overlap (negative margin) to bridge the visual gap. */}
      <div
        className="relative"
        onMouseEnter={() => {
          setShowStatuses(true)
          setShowReassign(false)
        }}
        onMouseLeave={() => setShowStatuses(false)}
      >
        <MenuItem rightArrow active={showStatuses}>
          🎨 Change status
        </MenuItem>
        {showStatuses && (
          <div
            className="absolute top-0 bg-white border border-slate-200 rounded-md shadow-xl py-1 w-52 max-h-72 overflow-y-auto"
            style={{ left: 'calc(100% - 1px)' }}
          >
            {statuses.map((s) => {
              // An "Invoiced" status is only reachable once the job is
              // completed — mirrors the server-side guard so the dispatcher
              // sees it disabled rather than getting a 422.
              const isInvoiced =
                /invoic/i.test(s.slug ?? '') || /invoic/i.test(s.name)
              const blocked = isInvoiced && !wo.completed_at
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={blocked}
                  title={blocked ? 'Mark the job Complete before invoicing' : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (blocked) return
                    onChangeStatus(s.id)
                    onClose()
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
                    blocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="inline-block w-3 h-3 rounded flex-shrink-0 border border-slate-200"
                    style={{ background: visibleStatusColor(s.color) }}
                  />
                  <span className="truncate">{s.name}</span>
                  {blocked && <span className="ml-auto text-[10px] text-slate-400">needs complete</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div
        className="relative"
        onMouseEnter={() => {
          setShowReassign(true)
          setShowStatuses(false)
        }}
        onMouseLeave={() => setShowReassign(false)}
      >
        <MenuItem rightArrow active={showReassign}>
          👤 Reassign tech
        </MenuItem>
        {showReassign && (
          <div
            className="absolute top-0 bg-white border border-slate-200 rounded-md shadow-xl py-1 w-56 max-h-72 overflow-y-auto"
            style={{ left: 'calc(100% - 1px)' }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onReassign(null)
                onClose()
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm italic text-slate-500 flex items-center justify-between"
            >
              <span>— Unassigned —</span>
              {!wo.lead_tech?.id && <span className="text-amber-500">✓</span>}
            </button>
            {board.isLoading && (
              <div className="px-3 py-2 text-xs text-slate-400 italic">Loading techs…</div>
            )}
            {!board.isLoading && techs.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400 italic">No techs on the roster.</div>
            )}
            {techs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onReassign(t.id)
                  onClose()
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm flex items-center justify-between"
              >
                <span className="truncate">{t.name}</span>
                {wo.lead_tech?.id === t.id && <span className="text-amber-500 ml-2">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {cancelStatus && (
        <>
          <div className="border-t border-slate-100 my-1" />
          <MenuItem
            onClick={() => {
              if (confirm(`Cancel job ${wo.work_order_number}?`)) {
                onChangeStatus(cancelStatus.id)
                onClose()
              }
            }}
            danger
          >
            🛑 Cancel job
          </MenuItem>
        </>
      )}
    </div>
  )
}

function MenuItem({
  onClick,
  rightArrow,
  active,
  danger,
  children,
}: {
  onClick?: () => void
  rightArrow?: boolean
  active?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${
        danger
          ? 'text-red-700 hover:bg-red-50'
          : active
            ? 'bg-amber-50 text-amber-900 font-medium'
            : 'text-slate-800 hover:bg-slate-50'
      }`}
    >
      <span>{children}</span>
      {rightArrow && (
        <span className="text-slate-400 text-xs">{active ? '▾' : '▸'}</span>
      )}
    </button>
  )
}
