/**
 * Shared presentation helpers for the activity_logs rows — used by the global
 * Audit Log page and the per-record Activity panels (e.g. a job's activity).
 */

export interface ActivityRow {
  id: string
  account_id: string | null
  actor_email: string | null
  client: string | null
  method: string
  path: string
  request_keys: string[] | null
  response_status: number
  duration_ms: number | null
  created_at: string
}

/** Turn a raw method+path into a friendly action label. */
export function describeAction(method: string, path: string, keys: string[] | null): string {
  const seg = path.replace(/^\/?v1\//, '').split('/').filter(Boolean)
  const resource = seg[0] ?? ''
  const hasId = seg.length >= 2 && /_/.test(seg[1]) // ids are prefixed: wo_, tsk_…
  const subAction = seg.length >= 3 ? seg[2] : seg.length === 2 && !hasId ? seg[1] : null
  const searched = !!keys && keys.some((k) => ['q', 'query', 'search'].includes(k))

  const NOUN: Record<string, string> = {
    'work-orders': 'job',
    tasks: 'task',
    estimates: 'estimate',
    customers: 'customer',
    assets: 'asset',
    invoices: 'invoice',
    'service-catalog-items': 'catalog item',
    'product-catalog-items': 'catalog item',
    'catalog-items': 'catalog item',
    inventory: 'inventory',
    scan: 'code',
    'public-scan': 'code',
  }
  const noun = NOUN[resource] ?? resource.replace(/-/g, ' ') ?? 'item'
  const verb =
    method === 'POST' ? 'Created' : method === 'DELETE' ? 'Deleted' : method === 'GET' ? 'Viewed' : 'Updated'

  if (resource === 'scan' || resource === 'public-scan') return 'Scanned a code'
  if (subAction) return `${verb === 'Viewed' ? '' : verb + ' '}${noun} · ${subAction.replace(/-/g, ' ')}`.trim()
  if (hasId) return `${verb} ${noun}`
  if (method === 'GET') return searched ? `Searched ${noun}s` : `Opened ${noun}s`
  return `${verb} ${noun}`
}

export function clientChip(client: string | null): string {
  return client === 'mobile' ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-600'
}

export function methodChip(method: string): string {
  switch (method) {
    case 'POST':
      return 'bg-emerald-100 text-emerald-800'
    case 'PATCH':
    case 'PUT':
      return 'bg-amber-100 text-amber-800'
    case 'DELETE':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export function statusTone(status: number): string {
  if (status >= 500) return 'text-red-700'
  if (status >= 400) return 'text-amber-700'
  if (status >= 200 && status < 300) return 'text-emerald-700'
  return 'text-slate-600'
}

export function ago(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return d.toLocaleString()
}
