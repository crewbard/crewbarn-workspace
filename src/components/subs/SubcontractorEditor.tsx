import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { apiRequest } from '@/lib/api'
import { formatPhoneInput } from '@/lib/phone'
import {
  useCreateSubcontractor,
  useUpdateSubcontractor,
} from '@/hooks/useSubcontractors'
import { PortalUserPicker } from '@/components/subs/PortalUserPicker'
import type {
  Subcontractor,
  SubcontractorInput,
  SubPaymentTerms,
} from '@/types/subcontractor'

/**
 * SubcontractorEditor — add or edit a vendor partner.
 *
 * Used standalone from the Subcontractors management page, AND inline
 * from the SubcontractorPicker when the user clicks "+ Add new" while
 * filling out a sub job form. Owns its own draft state + mutation;
 * caller just listens to onSaved.
 *
 * Address fields are plain text (no autocomplete) — sub addresses are
 * less critical than service locations and we don't want to drag in
 * the Google Maps dependency for this surface.
 */

type Mode = 'add' | 'edit'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Provide when editing; omit to open in add mode. */
  subcontractor?: Subcontractor | null
  /** Optional seed values when opening in add mode (e.g. pre-fill from picker query). */
  seed?: Partial<SubcontractorInput>
  /** Fires after a successful save with the persisted row. */
  onSaved?: (sub: Subcontractor) => void
}

interface DraftState {
  business_name: string
  contact_name: string
  phone: string
  email: string
  street_address: string
  apt_unit: string
  city: string
  state: string
  postal_code: string
  vendor_partner_number: string
  w9_on_file: boolean
  coi_on_file: boolean
  license_on_file: boolean
  default_payment_terms: SubPaymentTerms
  active: boolean
  notes: string
  portal_account: { id: string; email?: string | null } | null
}

function emptyDraft(seed?: Partial<SubcontractorInput>): DraftState {
  return {
    business_name: seed?.business_name ?? '',
    contact_name: seed?.contact_name ?? '',
    phone: seed?.phone ?? '',
    email: seed?.email ?? '',
    street_address: seed?.street_address ?? '',
    apt_unit: seed?.apt_unit ?? '',
    city: seed?.city ?? '',
    state: seed?.state ?? '',
    postal_code: seed?.postal_code ?? '',
    vendor_partner_number: seed?.vendor_partner_number ?? '',
    w9_on_file: seed?.w9_on_file ?? false,
    coi_on_file: seed?.coi_on_file ?? false,
    license_on_file: seed?.license_on_file ?? false,
    default_payment_terms: seed?.default_payment_terms ?? 'net_30',
    active: seed?.active ?? true,
    notes: seed?.notes ?? '',
    portal_account: null,
  }
}

function fromExisting(sub: Subcontractor): DraftState {
  return {
    business_name: sub.business_name,
    contact_name: sub.contact_name ?? '',
    phone: sub.phone ?? '',
    email: sub.email ?? '',
    street_address: sub.street_address ?? '',
    apt_unit: sub.apt_unit ?? '',
    city: sub.city ?? '',
    state: sub.state ?? '',
    postal_code: sub.postal_code ?? '',
    vendor_partner_number: sub.vendor_partner_number ?? '',
    w9_on_file: sub.w9_on_file,
    coi_on_file: sub.coi_on_file,
    license_on_file: sub.license_on_file,
    default_payment_terms: sub.default_payment_terms,
    active: sub.active,
    notes: sub.notes ?? '',
    portal_account: sub.portal_account_id
      ? { id: sub.portal_account_id, email: sub.portal_account_email }
      : null,
  }
}

function toInput(d: DraftState): SubcontractorInput {
  const n = (s: string) => (s.trim() === '' ? null : s.trim())
  return {
    business_name: d.business_name.trim(),
    contact_name: n(d.contact_name),
    phone: n(d.phone),
    email: n(d.email),
    street_address: n(d.street_address),
    apt_unit: n(d.apt_unit),
    city: n(d.city),
    state: n(d.state),
    postal_code: n(d.postal_code),
    vendor_partner_number: n(d.vendor_partner_number),
    w9_on_file: d.w9_on_file,
    coi_on_file: d.coi_on_file,
    license_on_file: d.license_on_file,
    default_payment_terms: d.default_payment_terms,
    active: d.active,
    notes: n(d.notes),
    portal_account_id: d.portal_account?.id ?? null,
  }
}

export function SubcontractorEditor({
  isOpen,
  onClose,
  subcontractor,
  seed,
  onSaved,
}: Props) {
  const mode: Mode = subcontractor ? 'edit' : 'add'
  const [draft, setDraft] = useState<DraftState>(() =>
    subcontractor ? fromExisting(subcontractor) : emptyDraft(seed)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverErr, setServerErr] = useState<string | null>(null)

  const createMutation = useCreateSubcontractor()
  const updateMutation = useUpdateSubcontractor()
  const saving = createMutation.isPending || updateMutation.isPending

  // Reset draft when the editor reopens with different inputs.
  useEffect(() => {
    if (!isOpen) return
    setDraft(subcontractor ? fromExisting(subcontractor) : emptyDraft(seed))
    setErrors({})
    setServerErr(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subcontractor?.id])

  function patch(p: Partial<DraftState>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setErrors({})
    setServerErr(null)

    if (!draft.business_name.trim()) {
      setErrors({ business_name: 'Business name is required.' })
      return
    }

    try {
      let saved: Subcontractor
      if (mode === 'edit' && subcontractor) {
        saved = await updateMutation.mutateAsync({
          id: subcontractor.id,
          input: toInput(draft),
        })
      } else {
        saved = await createMutation.mutateAsync(toInput(draft))
      }
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const e = err as { payload?: { message?: string; errors?: Record<string, string[]> } }
      if (e?.payload?.errors) {
        const flat: Record<string, string> = {}
        for (const [k, v] of Object.entries(e.payload.errors)) flat[k] = v[0]
        setErrors(flat)
      } else {
        setServerErr(e?.payload?.message ?? String(err))
      }
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'edit' ? 'Edit subcontractor' : 'Add subcontractor'} size="lg">
      <Modal.Body>
        <form id="sub-editor-form" onSubmit={handleSubmit} className="space-y-4">
          {serverErr && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2">
              {serverErr}
            </div>
          )}

          {/* Identity */}
          <Field label="Business name *" error={errors.business_name}>
            <input
              type="text"
              value={draft.business_name}
              onChange={(e) => patch({ business_name: e.target.value })}
              autoFocus
              className={inputCls}
              placeholder="Tampa Lock Shop, Smith Electric, etc."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary contact name" error={errors.contact_name}>
              <input type="text" value={draft.contact_name} onChange={(e) => patch({ contact_name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Vendor partner number" error={errors.vendor_partner_number}>
              {/* Auto-assigned on save via TenantSetting::nextSubcontractorPartnerNumber.
                  On add: readonly placeholder so the user knows it's coming.
                  On edit: show the actual value (still readonly — change via DB if needed). */}
              <input
                type="text"
                readOnly
                value={draft.vendor_partner_number}
                className={`${inputCls} bg-slate-50 text-slate-600 cursor-not-allowed`}
                placeholder={mode === 'add' ? 'Auto-assigned on save (VP-1000+)' : ''}
                title="Auto-assigned per tenant. Not editable from this form."
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" error={errors.phone}>
              <input type="tel" value={draft.phone} onChange={(e) => patch({ phone: formatPhoneInput(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={draft.email} onChange={(e) => patch({ email: e.target.value })} className={inputCls} />
            </Field>
          </div>

          {/* Address */}
          <fieldset className="border-t border-slate-100 pt-3">
            <legend className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Mailing address</legend>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Street" error={errors.street_address}>
                    <input type="text" value={draft.street_address} onChange={(e) => patch({ street_address: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <Field label="Apt / Suite" error={errors.apt_unit}>
                  <input type="text" value={draft.apt_unit} onChange={(e) => patch({ apt_unit: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City" error={errors.city}>
                  <input type="text" value={draft.city} onChange={(e) => patch({ city: e.target.value })} className={inputCls} />
                </Field>
                <Field label="State" error={errors.state}>
                  <input type="text" value={draft.state} onChange={(e) => patch({ state: e.target.value })} className={inputCls} />
                </Field>
                <Field label="ZIP" error={errors.postal_code}>
                  <input type="text" value={draft.postal_code} onChange={(e) => patch({ postal_code: e.target.value })} className={inputCls} />
                </Field>
              </div>
            </div>
          </fieldset>

          {/* Portal access — link this sub to a portal user so they
              can see assigned WOs + submit invoices at portal.crewbarn.com.
              Three paths:
                1. Attach existing portal user (PortalUserPicker)
                2. Email an invite (only when editing an existing sub —
                   the API needs a sub.id to attach the invite to)
                3. Show pending invite + revoke action */}
          <fieldset className="border-t border-slate-100 pt-3">
            <legend className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Portal access</legend>
            <Field label="Portal user (optional)" error={errors.portal_account_id}>
              <PortalUserPicker
                value={draft.portal_account}
                onChange={(v) => patch({ portal_account: v })}
              />
            </Field>

            {mode === 'edit' && subcontractor && (
              <SubInvitePanel
                sub={subcontractor}
                seedEmail={draft.email}
              />
            )}

            {mode === 'add' && (
              <p className="text-[11px] text-slate-500 mt-1">
                Save the sub first, then you'll be able to email them a portal-access invite from this section.
              </p>
            )}
          </fieldset>

          {/* Compliance + terms */}
          <fieldset className="border-t border-slate-100 pt-3">
            <legend className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Compliance & terms</legend>
            <div className="flex flex-wrap gap-4 mb-3">
              <Check label="W-9 on file" checked={draft.w9_on_file} onChange={(v) => patch({ w9_on_file: v })} />
              <Check label="COI on file" checked={draft.coi_on_file} onChange={(v) => patch({ coi_on_file: v })} />
              <Check label="License on file" checked={draft.license_on_file} onChange={(v) => patch({ license_on_file: v })} />
            </div>
            <Field label="Default payment terms" error={errors.default_payment_terms}>
              <select
                value={draft.default_payment_terms}
                onChange={(e) => patch({ default_payment_terms: e.target.value as SubPaymentTerms })}
                className={inputCls}
              >
                <option value="on_receipt">On receipt</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_60">Net 60</option>
              </select>
            </Field>
          </fieldset>

          {/* Notes */}
          <Field label="Internal notes" error={errors.notes}>
            <textarea
              value={draft.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              className={inputCls}
              placeholder="Anything to remember about this sub (specialties, on-call hours, who to call after-hours, etc.)"
            />
          </Field>

          {mode === 'edit' && (
            <Check label="Active (uncheck to disable without deleting)" checked={draft.active} onChange={(v) => patch({ active: v })} />
          )}
        </form>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="sub-editor-form"
          disabled={saving}
          className="px-4 py-2 text-sm rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add subcontractor'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300"
      />
      <span>{label}</span>
    </label>
  )
}

/**
 * Three-state portal-invite panel sitting under the Portal user picker:
 *
 *   - Pending invite outstanding → show "Pending to <email>, expires <date>"
 *     with a Revoke button.
 *   - Already linked OR no pending invite → show "Invite by email" form.
 *     Submitting calls POST /v1/subcontractors/{id}/portal-invite which
 *     either (a) links an existing PlatformCustomer directly when the
 *     email matches, or (b) creates an invite and emails the link.
 *
 * Lives inside the SubcontractorEditor modal; only rendered in edit mode
 * because we need a sub.id to attach the invite to.
 */
function SubInvitePanel({ sub, seedEmail }: { sub: Subcontractor; seedEmail: string }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState(sub.email ?? seedEmail ?? '')
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function invalidateSub() {
    qc.invalidateQueries({ queryKey: ['subcontractors'] })
    qc.invalidateQueries({ queryKey: ['subcontractor', sub.id] })
  }

  const sendInvite = useMutation({
    mutationFn: (overrideEmail?: string) =>
      apiRequest<{ data: { kind: 'invited' | 'linked_existing'; email?: string; portal_account_id?: string } }>(
        `/v1/subcontractors/${sub.id}/portal-invite`,
        { method: 'POST', body: overrideEmail ? { email: overrideEmail } : {} },
      ),
    onSuccess: (res) => {
      setError(null)
      if (res.data.kind === 'linked_existing') {
        setFlash('That email already has a portal account — linked them directly.')
      } else {
        setFlash(`Invite sent to ${res.data.email}. Link expires in 14 days.`)
      }
      invalidateSub()
    },
    onError: (e: { payload?: { message?: string } } | Error) => {
      const msg =
        (e as { payload?: { message?: string } })?.payload?.message ??
        (e as Error).message ??
        'Failed to send invite.'
      setError(msg)
    },
  })

  const revoke = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/subcontractors/${sub.id}/portal-invite`, { method: 'DELETE' }),
    onSuccess: () => {
      setFlash('Invite revoked.')
      invalidateSub()
    },
    onError: (e: Error) => setError(e.message),
  })

  // Linked already? Nothing to do here.
  if (sub.portal_account_id) {
    return (
      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-emerald-900">
        ✓ Linked to <strong>{sub.portal_account_email ?? sub.portal_account_id}</strong>
      </div>
    )
  }

  if (sub.pending_invite) {
    const expires = sub.pending_invite.expires_at
      ? new Date(sub.pending_invite.expires_at).toLocaleDateString()
      : '—'
    return (
      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 space-y-2">
        <div className="text-xs text-amber-900">
          Invite pending to <strong>{sub.pending_invite.email}</strong> (expires {expires})
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => sendInvite.mutate(sub.pending_invite!.email)}
            disabled={sendInvite.isPending}
            className="text-[11px] font-semibold text-amber-800 border border-amber-300 hover:bg-amber-100 rounded px-2 py-1 disabled:opacity-50"
          >
            {sendInvite.isPending ? 'Resending…' : 'Resend'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Revoke this invite? The link will stop working immediately.')) {
                revoke.mutate()
              }
            }}
            disabled={revoke.isPending}
            className="text-[11px] font-semibold text-red-700 border border-red-300 hover:bg-red-50 rounded px-2 py-1 disabled:opacity-50"
          >
            {revoke.isPending ? 'Revoking…' : 'Revoke'}
          </button>
        </div>
        {flash && <div className="text-[11px] text-emerald-800">{flash}</div>}
        {error && <div className="text-[11px] text-red-700">{error}</div>}
      </div>
    )
  }

  // No portal account, no pending invite — show the invite form.
  return (
    <div className="mt-3 space-y-2">
      <div className="text-[11px] text-slate-500">
        Or send them an invite — they'll get an email with a link to set up portal access.
      </div>
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@subshop.com"
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="button"
          onClick={() => sendInvite.mutate(email.trim() || undefined)}
          disabled={sendInvite.isPending || !email.trim()}
          className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md px-3 py-2 disabled:opacity-50"
        >
          {sendInvite.isPending ? 'Sending…' : 'Send invite'}
        </button>
      </div>
      {flash && <div className="text-xs text-emerald-700">{flash}</div>}
      {error && <div className="text-xs text-red-700">{error}</div>}
    </div>
  )
}
