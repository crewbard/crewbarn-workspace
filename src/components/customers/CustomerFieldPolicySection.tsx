import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'
import type { Customer } from '@/types/customer'

/**
 * Vendor-side card on the customer detail page that controls the
 * field-service requirements every work order for this customer
 * inherits at creation time. This is what property managers and
 * maintenance companies use to enforce their on-site rules — check-in
 * with GPS, signature on completion, photo minimums, NTE caps.
 *
 * Changes are snapshotted onto NEW work orders only. Existing /
 * in-flight work orders keep the policy they were created under.
 */

interface FieldPolicy {
  requires_check_in_out: boolean
  requires_signature: boolean
  min_photos_required: number
  requires_before_after_photos: boolean
  geofence_radius_m: number | null
  default_nte_cents: number | null
}

function dollarsFromCents(c: number | null): string {
  if (c === null || c === undefined) return ''
  return (c / 100).toFixed(2)
}

function centsFromDollars(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export function CustomerFieldPolicySection({ customer }: { customer: Customer }) {
  const qc = useQueryClient()

  const [policy, setPolicy] = useState<FieldPolicy>({
    requires_check_in_out: customer.requires_check_in_out,
    requires_signature: customer.requires_signature,
    min_photos_required: customer.min_photos_required,
    requires_before_after_photos: customer.requires_before_after_photos,
    geofence_radius_m: customer.geofence_radius_m,
    default_nte_cents: customer.default_nte_cents,
  })
  const [nteInput, setNteInput] = useState<string>(dollarsFromCents(customer.default_nte_cents))
  const [dirty, setDirty] = useState(false)

  // If the upstream customer reloads (e.g., after a different save), reset
  // the local form so we don't show stale state.
  useEffect(() => {
    setPolicy({
      requires_check_in_out: customer.requires_check_in_out,
      requires_signature: customer.requires_signature,
      min_photos_required: customer.min_photos_required,
      requires_before_after_photos: customer.requires_before_after_photos,
      geofence_radius_m: customer.geofence_radius_m,
      default_nte_cents: customer.default_nte_cents,
    })
    setNteInput(dollarsFromCents(customer.default_nte_cents))
    setDirty(false)
  }, [customer.id, customer.updated_at])

  function patchLocal<K extends keyof FieldPolicy>(key: K, value: FieldPolicy[K]) {
    setPolicy((p) => ({ ...p, [key]: value }))
    setDirty(true)
  }

  const save = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/customers/${customer.id}`, {
        method: 'PATCH',
        body: {
          requires_check_in_out: policy.requires_check_in_out,
          requires_signature: policy.requires_signature,
          min_photos_required: policy.min_photos_required,
          requires_before_after_photos: policy.requires_before_after_photos,
          geofence_radius_m: policy.geofence_radius_m,
          default_nte_cents: centsFromDollars(nteInput),
        },
      }),
    onSuccess: () => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['customers', customer.id] })
      qc.invalidateQueries({ queryKey: ['customer', customer.id] })
    },
  })

  const checkInOn = policy.requires_check_in_out
  const sigOn = policy.requires_signature
  const beforeAfterAvailable = policy.min_photos_required >= 2

  return (
    <section className="bg-white rounded-lg border border-navy-100 p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">
          Field Requirements
        </h2>
        {dirty && (
          <span className="text-[11px] uppercase tracking-wider text-amber-600 font-semibold">
            Unsaved
          </span>
        )}
      </div>
      <p className="text-xs text-navy-500 mb-4 max-w-xl">
        Settings here apply to every NEW work order created for this customer.
        Property managers and maintenance companies typically require all of
        these. In-flight jobs keep the policy they were created under.
      </p>

      {save.isError && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-3">
          {(save.error as ApiError).message ?? 'Failed to save.'}
        </div>
      )}

      <div className="space-y-4">
        {/* Check-in / check-out toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checkInOn}
            onChange={(e) => patchLocal('requires_check_in_out', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-navy-300 text-amber-600 focus:ring-amber-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-navy-800">
              Require GPS check-in / check-out
            </div>
            <div className="text-xs text-navy-500">
              Tech must check in on arrival and check out on completion. Location
              is GPS-stamped on both ends.
            </div>
          </div>
        </label>

        {/* Geofence radius — only meaningful when check-in is on */}
        {checkInOn && (
          <div className="ml-7 flex items-center gap-3">
            <label className="text-sm text-navy-700">Geofence radius</label>
            <input
              type="number"
              min={25}
              max={5000}
              step={25}
              placeholder="150"
              value={policy.geofence_radius_m ?? ''}
              onChange={(e) =>
                patchLocal(
                  'geofence_radius_m',
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
              className="w-24 text-sm rounded border border-navy-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-xs text-navy-500">
              meters (blank = use tenant default, 150m)
            </span>
          </div>
        )}

        {/* Signature toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sigOn}
            onChange={(e) => patchLocal('requires_signature', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-navy-300 text-amber-600 focus:ring-amber-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-navy-800">
              Require signature on completion
            </div>
            <div className="text-xs text-navy-500">
              Tech captures a signature from the on-site contact before checking
              out. The signature gets dropped into the customer's WO PDF on
              completion.
            </div>
          </div>
        </label>

        {/* Photo minimum */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-navy-800 font-medium">
            Minimum photos required
          </label>
          <input
            type="number"
            min={0}
            max={50}
            value={policy.min_photos_required}
            onChange={(e) =>
              patchLocal('min_photos_required', Math.max(0, Number(e.target.value || 0)))
            }
            className="w-20 text-sm rounded border border-navy-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-xs text-navy-500">
            0 = none. Tech can't check out until this many photos are uploaded.
          </span>
        </div>

        {/* Before/after photos — only meaningful at 2+ */}
        <label
          className={`flex items-start gap-3 ml-7 ${
            beforeAfterAvailable ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <input
            type="checkbox"
            checked={policy.requires_before_after_photos}
            disabled={!beforeAfterAvailable}
            onChange={(e) => patchLocal('requires_before_after_photos', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-navy-300 text-amber-600 focus:ring-amber-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-navy-800">
              Require before / after photos
            </div>
            <div className="text-xs text-navy-500">
              At least one "before" and one "after" photo are required (counts
              toward the minimum above).
            </div>
          </div>
        </label>

        {/* Default NTE */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-navy-800 font-medium">Default NTE cap</label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-navy-500">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="(none)"
              value={nteInput}
              onChange={(e) => {
                setNteInput(e.target.value)
                setDirty(true)
              }}
              className="w-28 text-sm rounded border border-navy-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <span className="text-xs text-navy-500">
            Optional. Each WO can be overridden — this is just the starting cap.
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save field requirements'}
        </button>
        {!dirty && !save.isPending && save.isSuccess && (
          <span className="text-xs text-emerald-600">Saved.</span>
        )}
      </div>

    </section>
  )
}
