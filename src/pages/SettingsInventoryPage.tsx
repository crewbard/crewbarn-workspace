import { useEffect, useState } from 'react'
import {
  useInventorySettings,
  useUpdateInventorySettings,
} from '@/hooks/useInventorySettings'
import { ApiError } from '@/lib/api'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import type { InventorySettings } from '@/types/tenantSettings'

export function InventorySettingsPanel() {
  const { data, isLoading, isError, error } = useInventorySettings()
  const updateMutation = useUpdateInventorySettings()
  const { has, isLoading: permissionsLoading } = usePermissions()
  const canEdit = has(PERM.INVENTORY_EDIT)

  // Local form state — separate from server cache so the user sees their
  // pending edits, not a partially-applied optimistic value.
  const [formValues, setFormValues] = useState<InventorySettings | null>(null)
  const [showSaved, setShowSaved] = useState(false)

  // Initialize form once the first fetch resolves.
  useEffect(() => {
    if (data && formValues === null) {
      setFormValues(data)
    }
  }, [data, formValues])

  // Brief "Saved" indicator after a successful save.
  useEffect(() => {
    if (updateMutation.isSuccess) {
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 2000)
      return () => clearTimeout(t)
    }
  }, [updateMutation.isSuccess])

  if (isLoading || formValues === null || !data) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 animate-pulse">
          <div className="h-5 w-40 bg-slate-200 rounded mb-6" />
          <div className="space-y-4">
            <div className="h-14 bg-slate-100 rounded" />
            <div className="h-14 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6">
          <p className="text-sm text-red-700">
            Failed to load inventory settings.
            {error instanceof Error ? ` ${error.message}` : ''}
          </p>
        </div>
      </div>
    )
  }

  const dirty =
    formValues.inventory_require_bin_for_stock !==
      data.inventory_require_bin_for_stock ||
    formValues.inventory_allow_unrecorded_stock !==
      data.inventory_allow_unrecorded_stock ||
    formValues.inventory_allow_serial_freetext_install !==
      data.inventory_allow_serial_freetext_install ||
    formValues.inventory_stock_unit_tracking_enabled !==
      data.inventory_stock_unit_tracking_enabled ||
    formValues.inventory_require_po_for_stock_add !==
      data.inventory_require_po_for_stock_add ||
    formValues.inventory_require_van_stock_for_job_use !==
      data.inventory_require_van_stock_for_job_use ||
    formValues.inventory_show_sn_tracking !==
      data.inventory_show_sn_tracking ||
    formValues.inventory_allow_write_in !== data.inventory_allow_write_in

  const saving = updateMutation.isPending

  // Send only fields that actually changed — keeps PATCH bodies minimal
  // and aligns with the "sometimes|boolean" validation on the server.
  const buildPatch = (): Partial<InventorySettings> => {
    const patch: Partial<InventorySettings> = {}
    if (
      formValues.inventory_require_bin_for_stock !==
      data.inventory_require_bin_for_stock
    ) {
      patch.inventory_require_bin_for_stock =
        formValues.inventory_require_bin_for_stock
    }
    if (
      formValues.inventory_allow_unrecorded_stock !==
      data.inventory_allow_unrecorded_stock
    ) {
      patch.inventory_allow_unrecorded_stock =
        formValues.inventory_allow_unrecorded_stock
    }
    if (
      formValues.inventory_allow_serial_freetext_install !==
      data.inventory_allow_serial_freetext_install
    ) {
      patch.inventory_allow_serial_freetext_install =
        formValues.inventory_allow_serial_freetext_install
    }
    if (
      formValues.inventory_stock_unit_tracking_enabled !==
      data.inventory_stock_unit_tracking_enabled
    ) {
      patch.inventory_stock_unit_tracking_enabled =
        formValues.inventory_stock_unit_tracking_enabled
    }
    if (
      formValues.inventory_require_po_for_stock_add !==
      data.inventory_require_po_for_stock_add
    ) {
      patch.inventory_require_po_for_stock_add =
        formValues.inventory_require_po_for_stock_add
    }
    if (
      formValues.inventory_require_van_stock_for_job_use !==
      data.inventory_require_van_stock_for_job_use
    ) {
      patch.inventory_require_van_stock_for_job_use =
        formValues.inventory_require_van_stock_for_job_use
    }
    if (
      formValues.inventory_show_sn_tracking !==
      data.inventory_show_sn_tracking
    ) {
      patch.inventory_show_sn_tracking =
        formValues.inventory_show_sn_tracking
    }
    if (
      formValues.inventory_allow_write_in !== data.inventory_allow_write_in
    ) {
      patch.inventory_allow_write_in = formValues.inventory_allow_write_in
    }
    return patch
  }

  const handleSave = () => {
    const patch = buildPatch()
    if (Object.keys(patch).length === 0) return
    updateMutation.mutate(patch)
  }

  const handleDiscard = () => {
    setFormValues(data)
    updateMutation.reset()
    setShowSaved(false)
  }

  const serverErrorMessage =
    updateMutation.isError
      ? updateMutation.error instanceof ApiError
        ? updateMutation.error.message
        : 'Failed to save changes.'
      : null

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-navy-900">Stock rules</h2>
          <p className="text-sm text-slate-500 mt-1">
            How strict CrewBarn is about stock placement and stock counts.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          <ToggleRow
            label="Require bin assignment for all stock"
            description="When on, every stock row must specify which bin within a location it lives in (warehouse aisle, truck shelf, etc.). When off, stock can sit at the location level without bin detail. Recommended for warehouses with bin labels; leave off for simpler operations."
            value={formValues.inventory_require_bin_for_stock}
            onChange={(v) =>
              setFormValues({ ...formValues, inventory_require_bin_for_stock: v })
            }
            disabled={saving || permissionsLoading || !canEdit}
          />
          <ToggleRow
            label="Allow issuing stock that hasn't been recorded yet"
            description="When on, a tech can issue or install a part even when the system shows zero on hand. The shortfall is logged to a reconciliation queue for a manager to resolve later (retroactive receive or write-off). When off, the same operation is rejected. Useful for field crews who can't always record receipts in real time."
            value={formValues.inventory_allow_unrecorded_stock}
            onChange={(v) =>
              setFormValues({
                ...formValues,
                inventory_allow_unrecorded_stock: v,
              })
            }
            disabled={saving || permissionsLoading || !canEdit}
          />
          <ToggleRow
            label="Allow free-text serial entry on component install"
            description="When on, the asset component installer shows a 'Manual entry' field where techs can type a serial number directly. When off, only the inventory-unit picker is available — eliminates typo-driven install failures. Platform admins always see the manual entry regardless of this setting."
            value={formValues.inventory_allow_serial_freetext_install}
            onChange={(v) =>
              setFormValues({
                ...formValues,
                inventory_allow_serial_freetext_install: v,
              })
            }
            disabled={saving || permissionsLoading || !canEdit}
          />
          <ToggleRow
            label="Enable stock fingerprint / QR tracking"
            description="Master backend switch for one-QR-per-physical-item tracking. When on, CrewBarn creates stock-unit fingerprints, requires scans for stocked job products, and can prove which exact item moved. When off, normal stock quantities still work but QR fingerprint enforcement is skipped."
            value={formValues.inventory_stock_unit_tracking_enabled}
            onChange={(v) =>
              setFormValues({
                ...formValues,
                inventory_stock_unit_tracking_enabled: v,
                inventory_require_van_stock_for_job_use: v
                  ? formValues.inventory_require_van_stock_for_job_use
                  : false,
              })
            }
            disabled={saving || permissionsLoading || !canEdit}
          />
          <ToggleRow
            label="Require purchase orders for adding stock (admin)"
            description="When on, the manual '+ Add stock' button on the Stock Levels tab is disabled — every new stock row must come through a Purchase Order receive. Forces a paper trail and keeps inventory honest. Off by default. (Future: tied to per-account permissions when Crew Member roles ship; admins will still bypass.)"
            value={formValues.inventory_require_po_for_stock_add}
            onChange={(v) =>
              setFormValues({
                ...formValues,
                inventory_require_po_for_stock_add: v,
              })
            }
            disabled={saving || permissionsLoading || !canEdit}
          />
          <ToggleRow
            label="Allow write-in items on jobs"
            description="Lets a tech write in an item they bought on a job — a lock from Home Depot, say. The item is still tracked: it gets its own internal serial and lands in the Reconciliation queue, where a manager can turn it into real company stock. Turning this on creates a 'Write In' entry in your catalog. Off by default."
            value={formValues.inventory_allow_write_in}
            onChange={(v) =>
              setFormValues({
                ...formValues,
                inventory_allow_write_in: v,
              })
            }
            disabled={saving || permissionsLoading || !canEdit}
          />
          <ToggleRow
            label="Require tech van stock before job use"
            description="When off, a tech can pull an available item from a warehouse shelf or another tracked location, scan it, and add it to the job; CrewBarn logs the exact stock-unit source. When on, stocked job products can only be added if the scanned unit is already in that tech's assigned truck/van."
            value={formValues.inventory_require_van_stock_for_job_use}
            onChange={(v) =>
              setFormValues({
                ...formValues,
                inventory_require_van_stock_for_job_use: v,
              })
            }
            disabled={saving || permissionsLoading || !canEdit || !formValues.inventory_stock_unit_tracking_enabled}
          />
          <ToggleRow
            label="Show serial-number tracking features"
            description="When off (default), the SN-tracked checkbox + badges + columns are hidden across the catalog and inventory pages. Most shops never serial-track — hiding the option keeps forms uncluttered. Turn on for shops dealing in regulated/serialized goods (firearms, medical devices, pawn). Items previously created with SN tracking on still work; the UI just stops surfacing the toggle."
            value={formValues.inventory_show_sn_tracking}
            onChange={(v) =>
              setFormValues({
                ...formValues,
                inventory_show_sn_tracking: v,
              })
            }
            disabled={saving || permissionsLoading || !canEdit}
          />
        </div>

        {serverErrorMessage && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100">
            <p className="text-sm text-red-700">{serverErrorMessage}</p>
          </div>
        )}

        <div className="px-6 py-4 bg-slate-50 rounded-b-xl flex items-center justify-end gap-4 border-t border-slate-100">
          {!permissionsLoading && !canEdit && (
            <span className="mr-auto text-sm text-slate-500">
              Inventory edit permission is required to change these settings.
            </span>
          )}
          {showSaved && !dirty && (
            <span className="text-sm text-emerald-700 font-medium">
              ✓ Saved
            </span>
          )}
          {dirty && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving || permissionsLoading || !canEdit}
              className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving || permissionsLoading || !canEdit}
            className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ToggleRowProps {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: ToggleRowProps) {
  return (
    <div className="px-6 py-5 flex items-start justify-between gap-6">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-navy-900">{label}</div>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? 'bg-amber-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
