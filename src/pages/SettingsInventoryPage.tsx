import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NotAuthorizedOverlay } from '@/components/RequirePermission'
import {
  useInventorySettings,
  useUpdateInventorySettings,
} from '@/hooks/useInventorySettings'
import { ApiError } from '@/lib/api'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import type { InventorySettings } from '@/types/tenantSettings'
import { useQuery } from '@tanstack/react-query'
import { listPoOverrideEvents } from '@/lib/poOverride'

export function InventorySettingsPanel() {
  const { data, isLoading, isError, error } = useInventorySettings()
  const updateMutation = useUpdateInventorySettings()
  const { has, isLoading: permissionsLoading, isPlatformAdmin, role_slug } = usePermissions()
  const canEdit = has(PERM.INVENTORY_EDIT)
  const [deniedOpen, setDeniedOpen] = useState(false)

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

  if (!isError && (isLoading || formValues === null || !data)) {
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

  if (!formValues || !data) return null

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
    formValues.inventory_locked_to_controllers !==
      data.inventory_locked_to_controllers ||
    formValues.inventory_show_sn_tracking !==
      data.inventory_show_sn_tracking ||
    formValues.inventory_allow_write_in !== data.inventory_allow_write_in ||
    !!formValues.inventory_allow_count_corrections !== !!data.inventory_allow_count_corrections ||
    !!formValues.inventory_auto_reorder !== !!data.inventory_auto_reorder ||
    !!formValues.inventory_auto_van_restock !== !!data.inventory_auto_van_restock

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
      formValues.inventory_locked_to_controllers !==
      data.inventory_locked_to_controllers
    ) {
      patch.inventory_locked_to_controllers =
        formValues.inventory_locked_to_controllers
    }
    if (
      formValues.inventory_show_sn_tracking !==
      data.inventory_show_sn_tracking
    ) {
      patch.inventory_show_sn_tracking =
        formValues.inventory_show_sn_tracking
    }
    if (
      !!formValues.inventory_allow_count_corrections !== !!data.inventory_allow_count_corrections
    ) {
      patch.inventory_allow_count_corrections = !!formValues.inventory_allow_count_corrections
    }
    if (
      formValues.inventory_allow_write_in !== data.inventory_allow_write_in
    ) {
      patch.inventory_allow_write_in = formValues.inventory_allow_write_in
    }
    if (!!formValues.inventory_auto_reorder !== !!data.inventory_auto_reorder) {
      patch.inventory_auto_reorder = !!formValues.inventory_auto_reorder
    }
    if (!!formValues.inventory_auto_van_restock !== !!data.inventory_auto_van_restock) {
      patch.inventory_auto_van_restock = !!formValues.inventory_auto_van_restock
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

  // Who may change these: the server says (owner, admin or platform admin);
  // an older API without can_change falls back to the same rule on the role.
  const canChange = data.can_change ?? (isPlatformAdmin || role_slug === 'owner' || role_slug === 'admin')
  const locked = !permissionsLoading && (!canEdit || !canChange)
  const off = saving || permissionsLoading
  const ask = data.ask ?? []
  const set = (patch: Partial<InventorySettings>) => setFormValues({ ...formValues, ...patch })
  const lockProps = { locked, onLocked: () => setDeniedOpen(true), disabled: off }
  const tracking = formValues.inventory_stock_unit_tracking_enabled
  const needsTracking = tracking ? undefined : 'Needs "Enable stock fingerprint / QR tracking" on'

  return (
    <div className="space-y-6">
      <div data-tour="inv-rules" data-can-edit={canEdit && canChange ? 'yes' : 'no'} className="space-y-4">
        {locked && (
          <div data-settings-lock role="note" className="flex items-start gap-3 rounded-xl border border-[var(--accent-200,#f4d7a1)] bg-[var(--accent-50,#fdf7ee)] px-4 py-3">
            <span aria-hidden="true" className="text-lg leading-6">🔒</span>
            <div className="text-sm">
              <p className="font-semibold text-slate-900">Only an owner or admin can change these.</p>
              <p className="text-slate-700">
                You can see the rules. To change one, ask{' '}
                {ask.length ? ask.map((a) => `${a.name} (${a.role.charAt(0).toUpperCase()}${a.role.slice(1)})`).join(' or ') : 'the shop owner'}.
              </p>
            </div>
          </div>
        )}

        <SettingsSection tour="inv-rules-receiving" title="Receiving & buying" subtitle="How stock comes into the shop">
          <ToggleRow
            tour="inv-rule-require-po"
            label="Require purchase orders for adding stock"
            summary="New stock must come in on a purchase order. Overrides are set per employee in Staff."
            description="When on, the manual '+ Add stock' button on the Stock Levels tab is disabled — every new stock row must come through a Purchase Order receive. Forces a paper trail and keeps inventory honest. Off by default."
            value={formValues.inventory_require_po_for_stock_add}
            onChange={(v) => set({ inventory_require_po_for_stock_add: v })}
            {...lockProps}
          />
          <ToggleRow
            child
            tour="inv-rule-count-corrections"
            label="Allow count corrections without a purchase order"
            summary="Fix a count after a physical count, with a written reason. Logged."
            needs={formValues.inventory_require_po_for_stock_add ? undefined : 'Needs "Require purchase orders" on'}
            description={formValues.inventory_require_po_for_stock_add
              ? "With purchase orders required, raising an existing count (say you found 3 more during a count) needs only a written reason. It is logged with the person's name. New stock still comes through a purchase order, or an override by someone you allow in Staff. Off by default."
              : "Only matters when Require purchase orders for adding stock is on. Then raising an existing count needs only a written reason, and it is logged."}
            value={!!formValues.inventory_allow_count_corrections}
            onChange={(v) => set({ inventory_allow_count_corrections: v })}
            {...lockProps}
            disabled={off || !formValues.inventory_require_po_for_stock_add}
          />
          <ToggleRow
            tour="inv-rule-auto-reorder"
            label="Order low stock automatically"
            summary="Low items go on a draft purchase order to their vendor. Nothing is sent."
            description="When a stocked item drops to its reorder threshold (set on the item under Stock & Reordering), CrewBarn adds it to a draft purchase order for its vendor: the one you last ordered it from, or the vendor named as its supplier. It orders the item's reorder quantity, or enough to reach the threshold. Stock already on order counts, so nothing is ordered twice. Nothing is sent: the draft waits for you to check it and mark it ordered, and the bell tells you when one starts. One draft per vendor, topped up as more of their items run low. Off by default."
            value={!!formValues.inventory_auto_reorder}
            onChange={(v) => set({ inventory_auto_reorder: v })}
            {...lockProps}
          />
          <ToggleRow
            tour="inv-rule-van-par"
            label="Restock vans to par"
            summary="Vans below their par get a transfer request from the shop."
            description="When a van carries fewer of an item than its par (set on the van's stock row), CrewBarn asks the shop to send the difference: a transfer request the van's tech confirms when it arrives. What's already on its way counts, and one request per item per van is topped up rather than repeated. Off by default."
            value={!!formValues.inventory_auto_van_restock}
            onChange={(v) => set({ inventory_auto_van_restock: v })}
            {...lockProps}
          />
        </SettingsSection>

        <SettingsSection tour="inv-rules-where" title="Where stock lives" subtitle="Bins and records">
          <ToggleRow
            tour="inv-rule-require-bin"
            label="Require bin assignment for all stock"
            summary="Every stock row says which bin it is in."
            description="When on, every stock row must specify which bin within a location it lives in (warehouse aisle, truck shelf, etc.). When off, stock can sit at the location level without bin detail. Recommended for warehouses with bin labels; leave off for simpler operations."
            value={formValues.inventory_require_bin_for_stock}
            onChange={(v) => set({ inventory_require_bin_for_stock: v })}
            {...lockProps}
          />
          <ToggleRow
            tour="inv-rule-unrecorded-stock"
            label="Allow issuing stock that hasn't been recorded yet"
            summary="Techs can use it; the shortfall lands in Reconciliation."
            description="When on, a tech can issue or install a part even when the system shows zero on hand. The shortfall is logged to a reconciliation queue for a manager to resolve later (retroactive receive or write-off). When off, the same operation is rejected. Useful for field crews who can't always record receipts in real time."
            value={formValues.inventory_allow_unrecorded_stock}
            onChange={(v) => set({ inventory_allow_unrecorded_stock: v })}
            {...lockProps}
          />
        </SettingsSection>

        <SettingsSection tour="inv-rules-tracking" title="Tracking every unit" subtitle="A fingerprint and QR label for each physical item">
          <ToggleRow
            tour="inv-rule-unit-tracking"
            label="Enable stock fingerprint / QR tracking"
            summary="Each unit gets its own QR label and history."
            description="The main switch for one-QR-per-physical-item tracking. When on, CrewBarn creates stock-unit fingerprints, requires scans for stocked job products, and can prove which exact item moved. When off, normal stock quantities still work but QR fingerprint enforcement is skipped."
            value={formValues.inventory_stock_unit_tracking_enabled}
            onChange={(v) => set({
              inventory_stock_unit_tracking_enabled: v,
              inventory_require_van_stock_for_job_use: v ? formValues.inventory_require_van_stock_for_job_use : false,
            })}
            {...lockProps}
          />
          <ToggleRow
            child
            tour="inv-rule-lock-store"
            label="Lock the store"
            summary="Only staff with Edit inventory move stock; techs confirm what they were given."
            needs={needsTracking}
            description="Off, a tech scans any part straight onto their van with Check in and the scan is the record — which suits a shop where the people holding scanners are the people who own the outcome. On, only staff you have given Edit inventory to can move stock: they transfer it to a tech's van, and the tech scans each item in to confirm they received it. The scan still does the moving either way; this decides who gets to decide."
            value={formValues.inventory_locked_to_controllers}
            onChange={(v) => set({ inventory_locked_to_controllers: v })}
            {...lockProps}
            disabled={off || !tracking}
          />
          <ToggleRow
            child
            tour="inv-rule-watch-van"
            label="Watch van stock"
            summary="A part used out of another tech's van raises a transfer to put one back."
            needs={needsTracking}
            description="Nothing is ever blocked. Every stocked item carries its own QR fingerprint and cannot go on a job without being scanned, so CrewBarn already knows which physical unit was used, which shelf or van it came out of, who took it and which job it went on — a tech can always use whatever part is in front of them. Turn this on and CrewBarn also acts on it: when one tech uses a part out of another tech's van, it raises a transfer request to put one back from the shop, and if the tech who took it is set to carry that part on their own van it flags that their van was empty. Leave it off and the movement record is the whole story."
            value={formValues.inventory_require_van_stock_for_job_use}
            onChange={(v) => set({ inventory_require_van_stock_for_job_use: v })}
            {...lockProps}
            disabled={off || !tracking}
          />
          <ToggleRow
            tour="inv-rule-show-sn"
            label="Show serial-number tracking features"
            summary="Serial-number fields and badges on the catalog and inventory pages."
            description="When off (default), the SN-tracked checkbox + badges + columns are hidden across the catalog and inventory pages. Most shops never serial-track — hiding the option keeps forms uncluttered. Turn on for shops dealing in regulated/serialized goods (firearms, medical devices, pawn). Items previously created with SN tracking on still work; the UI just stops surfacing the toggle."
            value={formValues.inventory_show_sn_tracking}
            onChange={(v) => set({ inventory_show_sn_tracking: v })}
            {...lockProps}
          />
          <ToggleRow
            tour="inv-rule-serial-freetext"
            label="Allow free-text serial entry on component install"
            summary="Techs may type a serial instead of picking a unit."
            description="When on, the asset component installer shows a 'Manual entry' field where techs can type a serial number directly. When off, only the inventory-unit picker is available — eliminates typo-driven install failures. Platform admins always see the manual entry regardless of this setting."
            value={formValues.inventory_allow_serial_freetext_install}
            onChange={(v) => set({ inventory_allow_serial_freetext_install: v })}
            {...lockProps}
          />
        </SettingsSection>

        <SettingsSection tour="inv-rules-jobs" title="Jobs">
          <ToggleRow
            tour="inv-rule-write-in"
            label="Allow write-in items on jobs"
            summary="Add a part that isn't in the catalog yet; it lands in Reconciliation."
            description="Lets a tech write in an item they bought on a job — a lock from Home Depot, say. The item is still tracked: it gets its own internal serial and lands in the Reconciliation queue, where a manager can turn it into real company stock. Turning this on creates a 'Write In' entry in your catalog. Off by default."
            value={formValues.inventory_allow_write_in}
            onChange={(v) => set({ inventory_allow_write_in: v })}
            {...lockProps}
          />
        </SettingsSection>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {serverErrorMessage && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-100 rounded-t-xl">
              <p className="text-sm text-red-700">{serverErrorMessage}</p>
            </div>
          )}

          {(formValues.inventory_require_po_for_stock_add || data.inventory_require_po_for_stock_add) && <OverrideLog />}

          <div data-tour="inv-rules-save" className="px-6 py-4 bg-slate-50 rounded-b-xl flex items-center justify-end gap-4 border-t border-slate-100">
            {locked && (
              <span className="mr-auto text-sm text-slate-600">
                🔒 Only an owner or admin can change these settings.
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
                disabled={off || locked}
                className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || off || locked}
              className="px-4 py-2 rounded-md bg-[var(--accent-500,#e8902c)] hover:brightness-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium transition"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
      <NotAuthorizedOverlay
        open={deniedOpen}
        onClose={() => setDeniedOpen(false)}
        message="Only an owner or admin can change inventory settings."
        ask={ask}
      />
    </div>
  )
}

function SettingsSection({ tour, title, subtitle, children }: { tour: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section data-tour={tour} className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-6 pt-5 pb-3 border-b border-slate-100">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  )
}

interface ToggleRowProps {
  /** Guided-tour target for this rule's row. */
  tour?: string
  label: string
  /** One line under the label; the full description opens with "More". */
  summary?: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  /** Indented under the setting it depends on. */
  child?: boolean
  /** Why it is off-limits right now ("Needs ... on"), shown instead of the summary. */
  needs?: string
  /** Seen but not changeable by this person: greyed, and a click explains why. */
  locked?: boolean
  onLocked?: () => void
}

function ToggleRow({
  label,
  summary,
  description,
  value,
  onChange,
  disabled,
  tour,
  child,
  needs,
  locked,
  onLocked,
}: ToggleRowProps) {
  const [more, setMore] = useState(false)
  return (
    <div
      data-tour={tour}
      data-on={value ? 'yes' : 'no'}
      data-locked={locked ? 'yes' : undefined}
      data-child={child ? 'yes' : undefined}
      className={`py-4 pr-6 flex items-start justify-between gap-6 ${child ? 'pl-12' : 'pl-6'} ${locked ? 'opacity-60' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-navy-900">
          {label}
          <button
            type="button"
            onClick={() => setMore(!more)}
            aria-expanded={more}
            className="ml-2 text-xs font-medium text-[var(--accent-700,#9c5c14)] hover:underline"
          >
            {more ? 'Less' : 'More'}
          </button>
        </div>
        {needs ? (
          <p data-needs className="text-[13px] text-[var(--accent-700,#9c5c14)] mt-0.5">{needs}</p>
        ) : (
          summary && <p className="text-[13px] text-slate-600 mt-0.5">{summary}</p>
        )}
        {(more || !summary) && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        aria-disabled={locked || undefined}
        onClick={() => {
          if (locked) return onLocked?.()
          if (!disabled) onChange(!value)
        }}
        disabled={!locked && disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${locked ? 'cursor-not-allowed' : ''} ${
          value ? 'bg-[var(--accent-500,#e8902c)]' : 'bg-slate-300'
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

/**
 * The PO-only override log (append-only, server side): who added stock
 * without a purchase order, why, what and where, plus the codes and switch
 * changes behind it. Read-only.
 */
function OverrideLog() {
  const [all, setAll] = useState(false)
  const [page, setPage] = useState(1)
  const canView = usePermissions().has(PERM.SETTINGS_VIEW)
  const q = useQuery({
    queryKey: ['inventory', 'po-override', 'events', all, page],
    queryFn: () => listPoOverrideEvents({ kind: all ? undefined : 'stock', page }),
    enabled: canView,
  })
  if (!canView) return null
  const rows = q.data?.data ?? []
  const meta = q.data?.meta
  const words: Record<string, string> = {
    override: 'Override', count_correction: 'Count correction', granted: 'Switch turned on', revoked: 'Switch turned off',
    code_sent: 'Code sent', code_verified: 'Code confirmed', code_failed: 'Wrong code', session_ended: 'Override ended',
  }
  return (
    <div data-tour="inv-override-log" className="border-t border-slate-100 px-6 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Stock added without a purchase order</h3>
        <label className="ml-auto flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={all} onChange={(e) => { setAll(e.target.checked); setPage(1) }} className="rounded border-slate-300 text-amber-600" />
          Also show codes and switch changes
        </label>
      </div>
      <p className="mt-1 text-[13px] text-slate-600">Every override and count correction, with who, why and where. Nothing here can be edited or deleted.</p>
      {q.isLoading && <p className="mt-3 text-sm text-slate-600">Loading…</p>}
      {q.isError && <p className="mt-3 text-sm text-red-700">Could not load the log.</p>}
      {!q.isLoading && rows.length === 0 && <p className="mt-3 text-sm text-slate-600">Nothing yet.</p>}
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-[12px] uppercase tracking-wide text-slate-600">
              <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">What</th><th className="px-3 py-2">Item and place</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Why</th></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{e.created_at ? new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</td>
                  <td className="px-3 py-2 text-slate-900">{e.actor_name ?? 'Someone'}{e.target_name ? <span className="text-slate-600"> → {e.target_name}</span> : null}</td>
                  <td className="px-3 py-2 text-slate-900">{words[e.event] ?? e.event}</td>
                  <td className="px-3 py-2 text-slate-700">{[e.item_name, e.serial_number ? `SN ${e.serial_number}` : null, e.bin_label ?? e.location_name].filter(Boolean).join(' · ')}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-900">{e.quantity != null ? `+${e.quantity}` : ''}{e.before_qty != null && e.after_qty != null ? <span className="block text-[12px] text-slate-600">{e.before_qty} → {e.after_qty}</span> : null}</td>
                  <td className="px-3 py-2 text-slate-700">{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta && meta.last_page > 1 && (
        <div className="mt-2 flex items-center gap-2 text-[13px]">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Newer</button>
          <span className="text-slate-700">Page {meta.current_page} of {meta.last_page}</span>
          <button type="button" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Older</button>
        </div>
      )}
    </div>
  )
}
