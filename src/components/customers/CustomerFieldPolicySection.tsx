import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'
import type { Customer } from '@/types/customer'
import { customerKeys } from '@/hooks/useCustomers'
import { usePermissions } from '@/hooks/usePermissions'
import { RequirementCount, RequirementToggle } from '@/components/completion/RequirementChoice'

/**
 * Vendor-side card on the customer detail page that controls the
 * field-service requirements every work order for this customer
 * inherits at creation time. This is what property managers and
 * maintenance companies use to enforce their on-site rules — check-in
 * with GPS, signature on completion, photo minimums, NTE caps.
 *
 * Check-in, geofence and NTE are snapshotted onto NEW work orders. The proof
 * a job needs before Complete (signature, photos, before/after, parts and
 * labour) is read live: each is this account's own rule, or Default — the
 * parent account's, then the job type's, then the company's.
 */

interface FieldPolicy {
  requires_check_in_out: boolean
  requires_signature: boolean | null
  min_photos_required: number | null
  requires_before_after_photos: boolean | null
  requires_line_items: boolean | null
  requires_client_wo_number: boolean | null
  requires_client_wo_document: boolean | null
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
  const { has } = usePermissions()
  const canEdit = has('customers.edit')

  const [policy, setPolicy] = useState<FieldPolicy>({
    requires_check_in_out: customer.requires_check_in_out,
    requires_signature: customer.requires_signature,
    min_photos_required: customer.min_photos_required,
    requires_before_after_photos: customer.requires_before_after_photos,
    requires_line_items: customer.requires_line_items ?? null,
    requires_client_wo_number: customer.requires_client_wo_number ?? null,
    requires_client_wo_document: customer.requires_client_wo_document ?? null,
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
      requires_line_items: customer.requires_line_items ?? null,
      requires_client_wo_number: customer.requires_client_wo_number ?? null,
      requires_client_wo_document: customer.requires_client_wo_document ?? null,
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
          requires_line_items: policy.requires_line_items,
          requires_client_wo_number: policy.requires_client_wo_number,
          requires_client_wo_document: policy.requires_client_wo_document,
          geofence_radius_m: policy.geofence_radius_m,
          default_nte_cents: centsFromDollars(nteInput),
        },
      }),
    onSuccess: () => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: customerKeys.detail(customer.id) })
      qc.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })

  const checkInOn = policy.requires_check_in_out

  return (
    <section data-tour="customer-field-requirements" className="bg-white rounded-lg border border-navy-100 p-6">
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
        What this account's jobs need. The proof needed before Complete
        applies to everyone, on open jobs too. <strong>Default</strong> uses the
        parent account's rule, then the job type's, then the company's
        (Preferences); set it here to require something, or to turn a company
        rule off for this customer.
      </p>

      {save.isError && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-3">
          {(save.error as ApiError).message ?? 'Failed to save.'}
        </div>
      )}

      <fieldset disabled={!canEdit} className="space-y-4">
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

        {/* Proof before Complete: this account's own rule, or Default. */}
        <div data-policy="proof" className="space-y-3 rounded-md border border-navy-100 bg-navy-50/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-navy-600">Before Complete</div>
          <RequirementToggle
            label="Customer signature"
            hint="Captured on site; it goes on the customer's WO PDF."
            value={policy.requires_signature}
            onChange={(v) => patchLocal('requires_signature', v)}
          />
          <RequirementCount
            label="Job photos"
            hint="Photos on the job or its service log count."
            value={policy.min_photos_required}
            onChange={(v) => patchLocal('min_photos_required', v)}
          />
          <RequirementToggle
            label="A Before and an After photo"
            hint="One photo labelled Before and one labelled After."
            value={policy.requires_before_after_photos}
            onChange={(v) => patchLocal('requires_before_after_photos', v)}
          />
          <RequirementToggle
            label="Parts and labour added"
            hint="The job is priced before it closes."
            value={policy.requires_line_items}
            onChange={(v) => patchLocal('requires_line_items', v)}
          />
          <RequirementToggle
            label="Their WO # entered"
            hint="The client's work order number is on the job."
            value={policy.requires_client_wo_number}
            onChange={(v) => patchLocal('requires_client_wo_number', v)}
          />
          <RequirementToggle
            label="Their work order attached"
            hint="Their form, or a photo of the signed sheet, marked Client WO on the job."
            value={policy.requires_client_wo_document}
            onChange={(v) => patchLocal('requires_client_wo_document', v)}
          />
        </div>

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
      </fieldset>

      {canEdit && <div className="mt-5 flex items-center gap-3">
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
      </div>}

    </section>
  )
}
