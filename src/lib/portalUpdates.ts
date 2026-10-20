import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/** One change from the portal waiting for the office (GET /v1/customers/{id}/portal-updates). */
export interface PortalUpdate {
  id: string
  /** A contact (changed or new), or a new service address. */
  subject: 'contact' | 'address'
  kind: 'change' | 'new'
  contact_id: string | null
  contact_name: string | null
  new_name: string | null
  /** "Pat Ruiz in the portal", "Seaside Condos, the property". */
  from: string
  source: 'portal' | 'property'
  changes: { field: string; label: string; now: string | null; new: string | null }[]
  at: string | null
  /** An address: on one line, and the jobs sent on another address meanwhile (they move here on import). */
  address?: string
  work_order_ids?: string[]
}

export const portalUpdatesKey = (customerId: string) => ['customer-portal-updates', customerId] as const

/** The changes from the portal waiting on a customer. */
export function usePortalUpdates(customerId: string | null | undefined) {
  return useQuery({
    queryKey: portalUpdatesKey(customerId ?? ''),
    queryFn: () => apiRequest<{ data: PortalUpdate[] }>(`/v1/customers/${customerId}/portal-updates`).then((r) => r.data),
    enabled: !!customerId,
    staleTime: 30_000,
  })
}
