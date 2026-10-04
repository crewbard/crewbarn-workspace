import { useEffect, useState } from 'react'
import {
  useCreateCustomerContact,
  useUpdateCustomerContact,
} from '@/hooks/useCustomerContacts'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { Modal } from '@/components/ui/Modal'
import { formatPhoneInput } from '@/lib/phone'
import type { CustomerContact, CustomerContactInput } from '@/types/customer'

/**
 * ContactEditorModal — add or edit a single CustomerContact.
 *
 * Used from CustomerDetailPage Contacts tab. Owns its own draft state,
 * mutation, and validation. Caller passes either the customerId only
 * (add mode) or the contact to edit. Saves close the modal and the
 * onSaved callback fires so the page can react.
 */

type Mode = 'add' | 'edit'

interface Props {
  isOpen: boolean
  onClose: () => void
  customerId: string
  /** When provided, modal opens in edit mode pre-filled with this contact */
  contact?: CustomerContact | null
  onSaved?: (contact: CustomerContact) => void
}

interface DraftState {
  prefix: string
  first_name: string
  last_name: string
  suffix: string
  job_title: string
  department: string
  email: string
  email_alt: string
  phone: string
  phone_alt: string
  notes: string

  is_main_contact: boolean
  is_billing_contact: boolean
  is_service_contact: boolean
  is_intake_contact: boolean
  is_intake_approver: boolean
  sms_consent: boolean
  active: boolean

  mailing_address_line1: string
  mailing_address_line2: string
  mailing_city: string
  mailing_state: string
  mailing_postal_code: string
  mailing_country: string
  bill_to_service_address: boolean
  show_mailing: boolean
}

function emptyDraft(): DraftState {
  return {
    prefix: '',
    first_name: '',
    last_name: '',
    suffix: '',
    job_title: '',
    department: '',
    email: '',
    email_alt: '',
    phone: '',
    phone_alt: '',
    notes: '',
    is_main_contact: false,
    is_billing_contact: false,
    is_service_contact: false,
    is_intake_contact: false,
    is_intake_approver: false,
    sms_consent: false,
    active: true,
    mailing_address_line1: '',
    mailing_address_line2: '',
    mailing_city: '',
    mailing_state: '',
    mailing_postal_code: '',
    mailing_country: 'US',
    bill_to_service_address: false,
    show_mailing: false,
  }
}

function contactToDraft(c: CustomerContact): DraftState {
  return {
    prefix:               c.prefix              ?? '',
    first_name:           c.first_name          ?? '',
    last_name:            c.last_name           ?? '',
    suffix:               c.suffix              ?? '',
    job_title:            c.job_title           ?? '',
    department:           c.department          ?? '',
    email:                c.email               ?? '',
    email_alt:            c.email_alt           ?? '',
    phone:                c.phone               ?? '',
    phone_alt:            c.phone_alt           ?? '',
    notes:                c.notes               ?? '',
    is_main_contact:      !!c.is_main_contact,
    is_billing_contact:   !!c.is_billing_contact,
    is_service_contact:   !!c.is_service_contact,
    is_intake_contact:    !!c.is_intake_contact,
    is_intake_approver:   !!c.is_intake_approver,
    sms_consent:          !!c.sms_consent,
    active:               c.active !== false,
    mailing_address_line1: c.mailing_address?.line1 ?? '',
    mailing_address_line2: c.mailing_address?.line2 ?? '',
    mailing_city:          c.mailing_address?.city ?? '',
    mailing_state:         c.mailing_address?.state ?? '',
    mailing_postal_code:   c.mailing_address?.postal_code ?? '',
    mailing_country:       c.mailing_address?.country ?? 'US',
    bill_to_service_address: !!c.bill_to_service_address,
    show_mailing: !!(c.mailing_address?.line1 || c.mailing_address?.city),
  }
}

export function ContactEditorModal({
  isOpen,
  onClose,
  customerId,
  contact,
  onSaved,
}: Props) {
  const mode: Mode = contact ? 'edit' : 'add'

  const [draft, setDraft] = useState<DraftState>(emptyDraft())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverErr, setServerErr] = useState<string | null>(null)

  const create = useCreateCustomerContact()
  const update = useUpdateCustomerContact()
  const submitting = create.isPending || update.isPending

  useEffect(() => {
    if (!isOpen) return
    setDraft(contact ? contactToDraft(contact) : emptyDraft())
    setErrors({})
    setServerErr(null)
  }, [isOpen, contact])

  function patch(p: Partial<DraftState>) {
    setDraft((s) => ({ ...s, ...p }))
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!draft.first_name.trim() && !draft.last_name.trim() && !draft.email.trim() && !draft.phone.trim()) {
      e._form = 'Enter at least a name, email, or phone.'
    }
    if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) {
      e.email = 'Email looks invalid.'
    }
    return e
  }

  async function handleSave() {
    const e = validate()
    setErrors(e)
    setServerErr(null)
    if (Object.keys(e).length > 0) return

    const input: CustomerContactInput = {
      prefix:      draft.prefix.trim()      || null,
      first_name:  draft.first_name.trim()  || null,
      last_name:   draft.last_name.trim()   || null,
      suffix:      draft.suffix.trim()      || null,
      job_title:   draft.job_title.trim()   || null,
      department:  draft.department.trim()  || null,
      email:       draft.email.trim()       || null,
      email_alt:   draft.email_alt.trim()   || null,
      phone:       draft.phone.trim()       || null,
      phone_alt:   draft.phone_alt.trim()   || null,
      notes:       draft.notes.trim()       || null,
      is_main_contact:    draft.is_main_contact,
      is_billing_contact: draft.is_billing_contact,
      is_service_contact: draft.is_service_contact,
      is_intake_contact:  draft.is_intake_contact,
      is_intake_approver: draft.is_intake_approver,
      sms_consent:        draft.sms_consent,
      active:             draft.active,
      bill_to_service_address: draft.bill_to_service_address,
      ...(draft.show_mailing && {
        mailing_address_line1: draft.mailing_address_line1.trim() || null,
        mailing_address_line2: draft.mailing_address_line2.trim() || null,
        mailing_city:          draft.mailing_city.trim()          || null,
        mailing_state:         draft.mailing_state.trim()         || null,
        mailing_postal_code:   draft.mailing_postal_code.trim()   || null,
        mailing_country:       draft.mailing_country.trim()       || null,
      }),
    }

    try {
      const saved =
        mode === 'edit' && contact
          ? await update.mutateAsync({ customerId, contactId: contact.id, input })
          : await create.mutateAsync({ customerId, input })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const errObj = err as { status?: number; payload?: { errors?: Record<string, string[]>; message?: string } }
      if (errObj?.status === 422 && errObj?.payload?.errors) {
        const flat: Record<string, string> = {}
        for (const [k, v] of Object.entries(errObj.payload.errors)) {
          flat[k] = v[0]
        }
        setErrors(flat)
      } else {
        setServerErr(errObj?.payload?.message ?? String(err))
      }
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit contact' : 'Add contact'}
      size="lg"
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* Role badges */}
          <div className="flex flex-wrap gap-3 pb-3 border-b border-slate-100">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer" title="Receives scheduling + on-the-way + completion notifications">
              <input
                type="checkbox"
                checked={draft.is_main_contact}
                onChange={(e) => patch({ is_main_contact: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Main</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer" title="Receives invoices when this customer is billed">
              <input
                type="checkbox"
                checked={draft.is_billing_contact}
                onChange={(e) => patch({ is_billing_contact: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Billing</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer" title="The person to call about service appointments">
              <input
                type="checkbox"
                checked={draft.is_service_contact}
                onChange={(e) => patch({ is_service_contact: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Service</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer" title="When an intake call/text comes from this contact's number, attribute it to this customer for billing">
              <input
                type="checkbox"
                checked={draft.is_intake_contact}
                onChange={(e) => patch({ is_intake_contact: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Intake / bill-to</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer" title="Texted when work is sent to the intake number, and their reply of APPROVED authorizes it">
              <input
                type="checkbox"
                checked={draft.is_intake_approver}
                onChange={(e) => patch({ is_intake_approver: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Approves intake</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={!draft.active}
                onChange={(e) => patch({ active: !e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="text-slate-600">Inactive</span>
            </label>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="First name">
              <input className={inputCls} value={draft.first_name} onChange={(e) => patch({ first_name: e.target.value })} placeholder="Jane" />
            </Labeled>
            <Labeled label="Last name">
              <input className={inputCls} value={draft.last_name} onChange={(e) => patch({ last_name: e.target.value })} placeholder="Doe" />
            </Labeled>
          </div>

          {/* Contact channels */}
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Email" error={errors.email}>
              <input type="email" className={inputCls} value={draft.email} onChange={(e) => patch({ email: e.target.value })} placeholder="jane@example.com" />
            </Labeled>
            <Labeled label="Phone">
              <input className={inputCls} value={draft.phone} onChange={(e) => patch({ phone: formatPhoneInput(e.target.value) })} inputMode="tel" placeholder="(321) 555-0100" />
            </Labeled>
            <Labeled label="Email alt">
              <input type="email" className={inputCls} value={draft.email_alt} onChange={(e) => patch({ email_alt: e.target.value })} placeholder="alt@example.com" />
            </Labeled>
            <Labeled label="Phone alt">
              <input className={inputCls} value={draft.phone_alt} onChange={(e) => patch({ phone_alt: formatPhoneInput(e.target.value) })} inputMode="tel" placeholder="(321) 555-0101" />
            </Labeled>
          </div>

          {/* Role at company */}
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Job title">
              <input className={inputCls} value={draft.job_title} onChange={(e) => patch({ job_title: e.target.value })} placeholder="Office Manager" />
            </Labeled>
            <Labeled label="Department">
              <input className={inputCls} value={draft.department} onChange={(e) => patch({ department: e.target.value })} placeholder="Operations" />
            </Labeled>
          </div>

          {/* Notes */}
          <Labeled label="Notes">
            <textarea
              rows={2}
              className={inputCls}
              value={draft.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="e.g. Prefers to be called after 3pm"
            />
          </Labeled>

          {/* SMS consent */}
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={draft.sms_consent}
              onChange={(e) => patch({ sms_consent: e.target.checked })}
              className="rounded border-slate-300"
            />
            <span>SMS consent — this person agreed to receive texts</span>
          </label>

          {/* Mailing address (collapsed by default) */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => patch({ show_mailing: !draft.show_mailing })}
              className="text-xs text-slate-600 hover:text-amber-600 inline-flex items-center gap-1"
            >
              {draft.show_mailing ? '▼' : '▶'} {draft.show_mailing ? 'Hide' : 'Show'} mailing address
            </button>
            {draft.show_mailing && (
              <div className="mt-3 space-y-3 p-3 bg-slate-50 rounded border border-slate-100">
                <AddressAutocomplete
                  value={draft.mailing_address_line1}
                  onChange={(v) => patch({ mailing_address_line1: v })}
                  onPlaceSelected={(p) => {
                    const street = [p.street_number, p.route].filter(Boolean).join(' ')
                    patch({
                      mailing_address_line1: street || p.formatted_address,
                      mailing_city:          p.city          ?? draft.mailing_city,
                      mailing_state:         p.state         ?? draft.mailing_state,
                      mailing_postal_code:   p.postal_code   ?? draft.mailing_postal_code,
                      mailing_country:       p.country       ?? draft.mailing_country,
                    })
                  }}
                  placeholder="Street address"
                  className={inputCls}
                />
                <input className={inputCls} placeholder="Apt / Suite" value={draft.mailing_address_line2} onChange={(e) => patch({ mailing_address_line2: e.target.value })} />
                <div className="grid grid-cols-3 gap-2">
                  <input className={inputCls} placeholder="City" value={draft.mailing_city} onChange={(e) => patch({ mailing_city: e.target.value })} />
                  <input className={inputCls} placeholder="State" maxLength={2} value={draft.mailing_state} onChange={(e) => patch({ mailing_state: e.target.value })} />
                  <input className={inputCls} placeholder="Zip" value={draft.mailing_postal_code} onChange={(e) => patch({ mailing_postal_code: e.target.value })} />
                </div>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.bill_to_service_address}
                    onChange={(e) => patch({ bill_to_service_address: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span>Use the service location address on invoices instead</span>
                </label>
              </div>
            )}
          </div>

          {(errors._form || serverErr) && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {errors._form || serverErr}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
        >
          {submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add contact'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function Labeled({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  )
}
