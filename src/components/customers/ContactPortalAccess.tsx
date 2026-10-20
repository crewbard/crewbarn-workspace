import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, isDeleteCancelled } from '@/lib/api'
import { customerKeys } from '@/hooks/useCustomers'
import { usePermissions } from '@/hooks/usePermissions'
import type { CustomerContact } from '@/types/customer'

/**
 * Who signs in to the customer portal as this contact, and taking that away
 * (they left the company, say). Removing access ends their view of this
 * customer's records only: their portal account stays, and so does every
 * other account they are on (a property manager keeps the other properties they look after).
 * Deleting or deactivating the contact does the same. The customer's own
 * portal manager can do it from their team page.
 */
export function ContactPortalAccess({ customerId, contact }: { customerId: string; contact: CustomerContact }) {
  const qc = useQueryClient()
  const { has } = usePermissions()
  const remove = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/customers/${encodeURIComponent(customerId)}/contacts/${encodeURIComponent(contact.id)}/portal-access`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
  })

  if (!contact.portal_access) return null

  if (contact.portal_access === 'removed') {
    return (
      <div className="mt-2 text-xs text-slate-500">
        Portal access removed{contact.portal_login_email ? ` (signed in as ${contact.portal_login_email})` : ''}.
      </div>
    )
  }

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs">
      <span className="text-emerald-900">
        Signs in to the portal as <span className="font-semibold">{contact.portal_login_email}</span>
        {contact.portal_login_email && contact.email && contact.portal_login_email.toLowerCase() !== contact.email.toLowerCase() && (
          <span className="text-emerald-800"> (confirmed with a code to {contact.email})</span>
        )}
      </span>
      {has('customers.edit') && (
        <button
          type="button"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          title="They stop seeing this customer's jobs, invoices and assets. Their portal and their other accounts stay."
          className="font-semibold text-red-700 hover:underline disabled:opacity-50"
        >
          {remove.isPending ? 'Removing…' : 'Remove portal access'}
        </button>
      )}
      <span className="w-full text-[11px] text-emerald-800/80">
        Deleting this contact also ends their portal access to this customer. Their other accounts stay.
      </span>
      {remove.isError && !isDeleteCancelled(remove.error) && (
        <span role="alert" className="w-full text-red-700">{(remove.error as Error).message}</span>
      )}
    </div>
  )
}
