import { visibleStatusColor } from './statusColor'

interface DispatchJobStatus {
  kind?: 'job' | 'estimate'
  paid_in_full?: boolean | null
  status: { name?: string; category: string; color: string | null } | null
}

// A green job pin is a promise about both completion and collection, so a
// tenant's green status color cannot make an unfinished/unconfirmed job green.
function greenFamily(hex: string): boolean {
  let value = hex.replace('#', '')
  if (value.length === 3) value = value.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value)) return false
  const r = parseInt(value.slice(0, 2), 16), g = parseInt(value.slice(2, 4), 16), b = parseInt(value.slice(4, 6), 16)
  return g > r * 1.1 && g > b * 1.1
}

export function dispatchJobAppearance(job: DispatchJobStatus): { color: string; label: string } {
  const status = job.status?.name || 'Status not set'
  if (job.kind !== 'estimate' && job.status?.category === 'complete') {
    return job.paid_in_full === true
      ? { color: '#16a34a', label: `${status} · paid in full` }
      : { color: '#d97706', label: `${status} · payment not confirmed` }
  }
  const color = visibleStatusColor(job.status?.color)
  return { color: greenFamily(color) ? '#2563eb' : color, label: status }
}
