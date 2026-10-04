import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * The other company on the same building.
 *
 * A locksmith and a mechanical contractor both service Harbor Point. The
 * first built the equipment records; without this the second builds a
 * second set for the same equipment, and the building ends up with two
 * histories that disagree.
 *
 * What this shows before access is granted is exactly one sentence:
 * records exist here. Not whose, not how many, not what — the server does
 * not send those and this could not display them if it wanted to.
 *
 * It renders nothing at all in the ordinary case, which is most
 * locations. A card that appears on every property saying "no other
 * company here" is noise that teaches people to stop reading it.
 */
export function EquipmentSharingCard({ locationId }: { locationId: string }) {
  const qc = useQueryClient()
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState('')

  const sharing = useQuery({
    queryKey: ['equipment-sharing', locationId],
    queryFn: () =>
      apiRequest<{
        data: {
          own_asset_count: number
          records_exist_elsewhere: boolean
          can_request: boolean
          share: { id: string; status: string; decided_at: string | null; expires_at: string | null } | null
        }
      }>(`/v1/service-locations/${locationId}/equipment-sharing`),
  })

  const request = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/service-locations/${locationId}/equipment-sharing/request`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() || undefined }),
      }),
    onSuccess: () => {
      setAsking(false)
      setMessage('')
      void qc.invalidateQueries({ queryKey: ['equipment-sharing', locationId] })
    },
  })

  const info = sharing.data?.data

  // Nothing to say, so say nothing.
  if (!info || (!info.records_exist_elsewhere && !info.share)) return null

  const status = info.share?.status

  if (status === 'active') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <p className="font-semibold">You have access to this property's equipment records.</p>
        <p className="mt-0.5 text-emerald-800">
          The owner allowed it
          {info.share?.expires_at ? ` until ${new Date(info.share.expires_at).toLocaleDateString()}` : ''}.
        </p>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <p className="font-semibold">Waiting on the property owner.</p>
        <p className="mt-0.5 text-sky-800">
          They decide in their portal. You will see the answer here.
        </p>
      </div>
    )
  }

  if (status === 'declined' || status === 'revoked') {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold">
          {status === 'declined' ? 'The property owner declined.' : 'The property owner took access back.'}
        </p>
        <p className="mt-0.5 text-slate-600">
          {/* No re-ask button. A customer who said no should not be asked
              again by a button; if the shop has a reason, that is a
              conversation, not a click. */}
          Talk to them directly if that needs revisiting.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">
        Another CrewBarn company keeps equipment records at this address.
      </p>
      <p className="mt-0.5 text-amber-800">
        {/* Deliberately vague, because the server is too. Who they are and
            what they hold is what access is FOR. */}
        You can ask the property owner for access to them, rather than
        building a second list of the same equipment.
      </p>

      {!asking ? (
        <button
          type="button"
          onClick={() => setAsking(true)}
          disabled={!info.can_request}
          className="mt-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          Request access
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Optional: tell them who you are and why (they see this)."
            className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => request.mutate()}
              disabled={request.isPending}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {request.isPending ? 'Sending…' : 'Send request'}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900"
            >
              Cancel
            </button>
          </div>
          {request.isError && (
            <p className="text-sm text-red-700">{(request.error as Error).message}</p>
          )}
        </div>
      )}
    </div>
  )
}
