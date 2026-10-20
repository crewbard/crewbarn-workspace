/**
 * Adding stock without a purchase order, when the shop requires one.
 *
 * The server decides (app/Services/Inventory/PoOnlyGate.php). A person with
 * the override switch on writes a reason and confirms it is them with a
 * 6-digit code; that opens a 30-minute window on this device. A count
 * correction (when the shop allows them) needs only the reason. Every
 * override is written to an append-only log.
 *
 * Endpoints: GET /v1/inventory/po-override, POST .../code, POST .../verify,
 * POST .../end, GET .../events, GET|PATCH /v1/staff/{id}/po-override.
 */
import { apiRequest } from './api'

export interface PoOverrideStatus {
  po_required: boolean
  count_corrections_allowed: boolean
  can_override: boolean
  reason_min: number
  session_minutes: number
  session: { id: string; expires_at: string } | null
  channels: { sms: boolean; email: boolean }
}

export type OverrideChannel = 'sms' | 'email'

export function getPoOverrideStatus() {
  return apiRequest<{ data: PoOverrideStatus }>('/v1/inventory/po-override').then((r) => r.data)
}

export function sendPoOverrideCode(channel?: OverrideChannel) {
  return apiRequest<{ data: { channel: OverrideChannel; to: string; expires_in_minutes: number } }>(
    '/v1/inventory/po-override/code', { method: 'POST', body: channel ? { channel } : {} },
  ).then((r) => r.data)
}

export function verifyPoOverrideCode(code: string) {
  return apiRequest<{ data: { session: { id: string; expires_at: string } } }>(
    '/v1/inventory/po-override/verify', { method: 'POST', body: { code } },
  ).then((r) => r.data)
}

export function endPoOverride() {
  return apiRequest<{ data: { session: null } }>('/v1/inventory/po-override/end', { method: 'POST', body: {} })
}

export interface PoOverrideEvent {
  id: string
  /** override, count_correction, code_sent, code_verified, code_failed, session_ended, granted, revoked */
  event: string
  path: string | null
  actor_account_id: string | null
  actor_name: string | null
  target_account_id: string | null
  target_name: string | null
  session_id: string | null
  catalog_item_id: string | null
  item_name: string | null
  location_name: string | null
  bin_label: string | null
  serial_number: string | null
  quantity: number | null
  before_qty: number | null
  after_qty: number | null
  reason: string | null
  details: Record<string, unknown> | null
  ip: string | null
  created_at: string | null
}

export function listPoOverrideEvents(params: { event?: string; kind?: 'stock'; page?: number } = {}) {
  const q = new URLSearchParams()
  if (params.event) q.set('event', params.event)
  if (params.kind) q.set('kind', params.kind)
  if (params.page) q.set('page', String(params.page))
  const s = q.toString()
  return apiRequest<{ data: PoOverrideEvent[]; meta?: { current_page: number; last_page: number; total: number } }>(
    `/v1/inventory/po-override/events${s ? `?${s}` : ''}`,
  )
}

export interface StaffPoOverride {
  account_id: string
  enabled: boolean
  changed_by: string | null
  changed_by_name: string | null
  changed_at: string | null
  /** Only owners and admins may flip it. */
  can_change: boolean
  /** The switch only matters with Edit inventory. */
  has_inventory_edit: boolean
}

export function getStaffPoOverride(staffId: string) {
  return apiRequest<{ data: StaffPoOverride }>(`/v1/staff/${encodeURIComponent(staffId)}/po-override`).then((r) => r.data)
}

export function setStaffPoOverride(staffId: string, on: boolean) {
  return apiRequest<{ data: StaffPoOverride }>(`/v1/staff/${encodeURIComponent(staffId)}/po-override`, {
    method: 'PATCH', body: { enabled: on },
  }).then((r) => r.data)
}

/** What a stock form has to show and send for an increase. */
export type OverrideNeed =
  | { kind: 'none' }
  /** The shop doesn't let this person add stock outside a PO. */
  | { kind: 'blocked' }
  /** A reason only (count correction). */
  | { kind: 'reason'; min: number }
  /** A reason and a live verified window. */
  | { kind: 'step-up'; min: number; live: boolean }

/**
 * The rule the server applies, so the form can say it up front.
 * `increase`: the save puts more stock in than was there.
 */
export function overrideNeed(status: PoOverrideStatus | undefined, increase: boolean, countCorrection: boolean, now = Date.now()): OverrideNeed {
  if (!status || !status.po_required || !increase) return { kind: 'none' }
  if (countCorrection && status.count_corrections_allowed) return { kind: 'reason', min: status.reason_min }
  if (!status.can_override) return { kind: 'blocked' }
  const live = !!status.session && new Date(status.session.expires_at).getTime() > now
  return { kind: 'step-up', min: status.reason_min, live }
}

/** May the form save with this reason? */
export function overrideReady(need: OverrideNeed, reason: string): boolean {
  if (need.kind === 'none') return true
  if (need.kind === 'blocked') return false
  if (reason.trim().length < need.min) return false
  return need.kind === 'reason' || need.live
}

/** The extra body field, only when it's needed. */
export function overrideBody(need: OverrideNeed, reason: string): { override_reason?: string } {
  return need.kind === 'reason' || need.kind === 'step-up' ? { override_reason: reason.trim() } : {}
}

export type StockInKey = 'po' | 'counter' | 'count'
export interface StockInChoice {
  key: StockInKey
  label: string
  hint: string
  enabled: boolean
}

/**
 * The three ways stock comes in, from the one "+ Stock in" button, with the
 * same PO-only rule the server applies (PoOnlyGate, via the status):
 * - from a purchase order: always, for anyone who may edit stock;
 * - counter pickup (no PO): off under PO-only unless this person may override,
 *   and then the form asks for the reason and code;
 * - count correction: always (a lower count never needs anything); under
 *   PO-only a raise needs a reason, or the override.
 */
export function stockInChoices(status: Pick<PoOverrideStatus, 'po_required' | 'can_override' | 'count_corrections_allowed'> | undefined, canEdit: boolean): StockInChoice[] {
  const po = !!status?.po_required
  const can = !!status?.can_override
  const counted = !!status?.count_corrections_allowed
  return [
    { key: 'po', label: 'From a purchase order', hint: 'Receive the lines that arrived, into their bins.', enabled: canEdit },
    {
      key: 'counter',
      label: 'Counter pickup (no PO)',
      hint: !po ? 'Bought at the counter or found: say what and where.'
        : can ? 'Your shop uses purchase orders: this needs your reason and a code.'
          : 'Your shop adds stock through purchase orders. An owner or admin can allow you an override in Staff.',
      enabled: canEdit && (!po || can),
    },
    {
      key: 'count',
      label: 'Count correction',
      hint: !po ? 'Fix a count on a stock row after a physical count.'
        : counted ? 'Fix a count on a stock row; a higher count needs a written reason.'
          : can ? 'Fix a count on a stock row; a higher count needs your override.'
            : 'Fix a count on a stock row. Lowering is fine; a higher count needs a purchase order.',
      enabled: canEdit,
    },
  ]
}
