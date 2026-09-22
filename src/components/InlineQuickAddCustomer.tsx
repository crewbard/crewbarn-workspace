import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useCreateCustomer } from '@/hooks/useCustomers'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { verifyAddress } from '@/lib/verifyAddress'
import { formatPhoneInput } from '@/lib/phone'
import type { Customer, CustomerInput } from '@/types/customer'

/**
 * Inline quick-add for creating a customer + primary service location
 * (+ optional billing-different contact address) in one step. Used from
 * the WorkOrderForm so dispatch can book a job for a brand-new customer
 * without leaving the page.
 *
 * Three account types across two form shapes:
 *   - Personal (residential)  → first + last name, customer IS the person.
 *   - Business (commercial)   → business name + contact person (first/last).
 *   - Government              → agency name + contact person (first/last).
 *
 * Service address uses Google Places autocomplete. Billing address is
 * optional and only collected when "Bill to a different address" is on.
 *
 * On Save: POST to /v1/customers with nested service_locations +
 * a single main contact (always created, so billing address has a home).
 */

export type CustomerKind = 'personal' | 'business' | 'government'

type ContactTypeFlags = { main: boolean; billing: boolean; service: boolean; intake: boolean }

export interface InlineQuickAddCustomerContact {
  id: string
  first: string
  last: string
  email: string
  phone: string
  types: ContactTypeFlags
}

export interface InlineQuickAddCustomerAddress {
  street_address: string
  apt_unit: string
  city: string
  state: string
  postal_code: string
  country: string
  latitude: number | null
  longitude: number | null
  entry_notes: string
}

export interface InlineQuickAddCustomerDraft {
  kind: CustomerKind
  firstName: string
  lastName: string
  businessName: string
  contactFirst: string
  contactLast: string
  phone: string
  phoneAlt: string
  showPhoneAlt: boolean
  email: string
  service: InlineQuickAddCustomerAddress
  hasBillingOverride: boolean
  billing: InlineQuickAddCustomerAddress
  primaryTypes: ContactTypeFlags
  extraContacts: InlineQuickAddCustomerContact[]
}

interface InitialServiceAddress {
  street_address?: string | null
  apt_unit?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  entry_notes?: string | null
}

function blankAddress(overrides: Partial<InlineQuickAddCustomerAddress> = {}): InlineQuickAddCustomerAddress {
  return {
    street_address: '',
    apt_unit: '',
    city: '',
    state: 'FL',
    postal_code: '',
    country: 'US',
    latitude: null,
    longitude: null,
    entry_notes: '',
    ...overrides,
  }
}

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function formatInitialPhone(raw: string | null | undefined): string {
  const digits = clean(raw).replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return ten ? formatPhoneInput(ten) : ''
}


function initialAddress(input?: InitialServiceAddress | null): InlineQuickAddCustomerAddress {
  if (!input) return blankAddress()
  return blankAddress({
    street_address: clean(input.street_address),
    apt_unit: clean(input.apt_unit),
    city: clean(input.city),
    state: clean(input.state) || 'FL',
    postal_code: clean(input.postal_code),
    country: clean(input.country) || 'US',
    entry_notes: clean(input.entry_notes),
  })
}


export interface InlineQuickAddCustomerHandle {
  save: () => Promise<Customer | null>
}

interface InlineQuickAddCustomerProps {
  initialQuery?: string
  initialKind?: CustomerKind
  initialFirstName?: string | null
  initialLastName?: string | null
  initialBusinessName?: string | null
  initialPhone?: string | null
  initialEmail?: string | null
  initialServiceAddress?: InitialServiceAddress | null
  initialDraft?: InlineQuickAddCustomerDraft | null
  onDraftChange?: (draft: InlineQuickAddCustomerDraft) => void
  hideActions?: boolean
  onCreated: (customer: Customer) => void
  onCancel: () => void
}

export const InlineQuickAddCustomer = forwardRef<InlineQuickAddCustomerHandle, InlineQuickAddCustomerProps>(
function InlineQuickAddCustomer({
  initialQuery,
  initialKind,
  initialFirstName,
  initialLastName,
  initialBusinessName,
  initialPhone,
  initialEmail,
  initialServiceAddress,
  initialDraft,
  onDraftChange,
  hideActions = false,
  onCreated,
  onCancel,
}: InlineQuickAddCustomerProps, ref) {
  const [kind, setKind] = useState<CustomerKind>(
    initialDraft?.kind ?? initialKind ?? (clean(initialBusinessName) ? 'business' : 'personal'),
  )

  // Personal
  const [firstName, setFirstName] = useState(initialDraft?.firstName ?? (clean(initialFirstName) || initialQuery || ''))
  const [lastName, setLastName] = useState(initialDraft?.lastName ?? clean(initialLastName))

  // Business
  const [businessName, setBusinessName] = useState(initialDraft?.businessName ?? (clean(initialBusinessName) || initialQuery || ''))
  const [contactFirst, setContactFirst] = useState(initialDraft?.contactFirst ?? clean(initialFirstName))
  const [contactLast, setContactLast] = useState(initialDraft?.contactLast ?? clean(initialLastName))

  // Shared contact bits
  const [phone, setPhone] = useState(initialDraft?.phone ?? formatInitialPhone(initialPhone))
  const [phoneAlt, setPhoneAlt] = useState(initialDraft?.phoneAlt ?? '')
  const [showPhoneAlt, setShowPhoneAlt] = useState(initialDraft?.showPhoneAlt ?? false)
  const [email, setEmail] = useState(initialDraft?.email ?? clean(initialEmail))

  const [service, setService] = useState<InlineQuickAddCustomerAddress>(() => initialDraft?.service ?? initialAddress(initialServiceAddress))
  const [addressVerification, setAddressVerification] = useState<'idle' | 'checking' | 'verified' | 'failed'>(
    clean((initialDraft?.service ?? initialServiceAddress)?.street_address) ? 'checking' : 'idle',
  )
  const verifiedInitialAddress = useRef(false)

  const [hasBillingOverride, setHasBillingOverride] = useState(initialDraft?.hasBillingOverride ?? false)
  const [billing, setBilling] = useState<InlineQuickAddCustomerAddress>(() => initialDraft?.billing ?? blankAddress())

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCreateCustomer()

  // Primary contact's roles (was hardcoded main+billing) + any extra contacts.
  const [primaryTypes, setPrimaryTypes] = useState<ContactTypeFlags>(initialDraft?.primaryTypes ?? {
    main: true,
    billing: true,
    service: false,
    intake: false,
  })
  const [extraContacts, setExtraContacts] = useState<InlineQuickAddCustomerContact[]>(initialDraft?.extraContacts ?? [])
  const nextContactId = useRef((initialDraft?.extraContacts.length ?? 0) + 1)

  const addContact = () =>
    setExtraContacts((cs) => [
      ...cs,
      {
        id: String(nextContactId.current++),
        first: '',
        last: '',
        email: '',
        phone: '',
        types: { main: false, billing: false, service: true, intake: false },
      },
    ])
  const updateContact = (id: string, patch: Partial<InlineQuickAddCustomerContact>) =>
    setExtraContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const removeContact = (id: string) => setExtraContacts((cs) => cs.filter((c) => c.id !== id))

  useEffect(() => {
    onDraftChange?.({
      kind,
      firstName,
      lastName,
      businessName,
      contactFirst,
      contactLast,
      phone,
      phoneAlt,
      showPhoneAlt,
      email,
      service,
      hasBillingOverride,
      billing,
      primaryTypes,
      extraContacts,
    })
  }, [billing, businessName, contactFirst, contactLast, email, extraContacts, firstName, hasBillingOverride, kind, lastName, onDraftChange, phone, phoneAlt, primaryTypes, service, showPhoneAlt])

  // Verify the address we were handed — from AI intake, or typed upstream —
  // once, and fill in what Google normalises.
  //
  // The unit is not part of the lookup: see lib/verifyAddress. Appending
  // "Unit G" was making Google fail on a street address that was correct,
  // which is what put the amber "could not verify" line under a good address.
  useEffect(() => {
    if (verifiedInitialAddress.current) return
    if (!clean(initialServiceAddress?.street_address)) return
    verifiedInitialAddress.current = true
    setAddressVerification('checking')

    let cancelled = false
    ;(async () => {
      const outcome = await verifyAddress({
        street: initialServiceAddress?.street_address,
        city: initialServiceAddress?.city,
        state: initialServiceAddress?.state,
        zip: initialServiceAddress?.postal_code,
      })
      // Cancelled means this component went away, not that the address is bad.
      // It used to fall into the same branch as a failure and report one.
      if (cancelled) return

      if (outcome.status === 'unavailable') {
        // No key, no network, Geocoding not enabled on the key. Silent: the
        // autocomplete pick is still the real verification path.
        setAddressVerification('idle')
        return
      }
      if (outcome.status === 'ambiguous') {
        setAddressVerification('failed')
        return
      }

      const a = outcome.address
      setService((s) => ({
        ...s,
        street_address: a.street || s.street_address,
        city: a.city || s.city,
        state: a.state || s.state,
        postal_code: a.zip || s.postal_code,
        country: a.country || s.country,
        latitude: a.lat,
        longitude: a.lng,
      }))
      setAddressVerification('verified')
    })()

    return () => { cancelled = true }
  }, [initialServiceAddress])

  function isValid(): string | null {
    if (kind === 'personal') {
      if (!firstName.trim() || !lastName.trim()) return 'First and last name are required.'
    } else {
      if (!businessName.trim()) return 'Business name is required.'
    }
    if (!service.street_address.trim()) return 'Service address is required.'
    if (!service.city.trim() || !service.state.trim()) return 'Service city + state are required.'
    return null
  }

  async function saveCustomer(): Promise<Customer | null> {
    setError(null)
    const v = isValid()
    if (v) { setError(v); return null }

    const displayName =
      kind !== 'personal'
        ? businessName.trim()
        : `${firstName.trim()} ${lastName.trim()}`.trim()

    const contact = {
      first_name: kind !== 'personal' ? (contactFirst.trim() || null) : firstName.trim(),
      last_name:  kind !== 'personal' ? (contactLast.trim()  || null) : lastName.trim(),
      phone: phone.trim() || null,
      phone_alt: phoneAlt.trim() || null,
      email: email.trim() || null,
      is_main_contact: primaryTypes.main,
      is_billing_contact: primaryTypes.billing,
      is_service_contact: primaryTypes.service,
      is_intake_contact: primaryTypes.intake,
      ...(hasBillingOverride && {
        mailing_address_line1: billing.street_address || null,
        mailing_address_line2: billing.apt_unit       || null,
        mailing_city:          billing.city           || null,
        mailing_state:         billing.state          || null,
        mailing_postal_code:   billing.postal_code    || null,
        mailing_country:       billing.country        || null,
      }),
    }

    const extras = extraContacts
      .filter((c) => c.first.trim() || c.last.trim() || c.phone.trim() || c.email.trim())
      .map((c) => ({
        first_name: c.first.trim() || null,
        last_name: c.last.trim() || null,
        phone: c.phone.trim() || null,
        email: c.email.trim() || null,
        is_main_contact: c.types.main,
        is_billing_contact: c.types.billing,
        is_service_contact: c.types.service,
        is_intake_contact: c.types.intake,
      }))

    const input: CustomerInput = {
      display_name: displayName,
      customer_type: kind === 'government' ? 'government' : kind === 'business' ? 'commercial' : 'residential',
      business_name: kind !== 'personal' ? businessName.trim() : null,
      first_name:    kind === 'personal' ? firstName.trim()    : null,
      last_name:     kind === 'personal' ? lastName.trim()     : null,
      contacts: [contact, ...extras],
      service_locations: [{
        is_primary: true,
        street_address: service.street_address || null,
        apt_unit:       service.apt_unit       || null,
        city:           service.city           || null,
        state:          service.state          || null,
        postal_code:    service.postal_code    || null,
        country:        service.country        || null,
        latitude:       service.latitude,
        longitude:      service.longitude,
        entry_notes:    service.entry_notes    || null,
      }],
    }

    try {
      setSubmitting(true)
      const newCustomer = await create.mutateAsync(input)
      onCreated(newCustomer)
      return newCustomer
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create customer.')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  useImperativeHandle(ref, () => ({
    save: saveCustomer,
  }))

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'

  return (
    <div className="border border-amber-300 bg-amber-50/40 rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Add new customer</div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>

      {/* Kind toggle */}
      <div className="flex gap-2">
        <KindButton active={kind === 'personal'} onClick={() => setKind('personal')}>
          Personal
        </KindButton>
        <KindButton active={kind === 'business'} onClick={() => setKind('business')}>
          Commercial
        </KindButton>
        <KindButton active={kind === 'government'} onClick={() => setKind('government')}>
          Government
        </KindButton>
      </div>

      {/* Name fields per kind */}
      {kind === 'personal' ? (
        <div className="grid grid-cols-2 gap-2">
          <Labeled label="First name *">
            <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Labeled>
          <Labeled label="Last name *">
            <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Labeled>
        </div>
      ) : (
        <>
          <Labeled label={kind === 'government' ? 'Agency / organization name *' : 'Company name *'}>
            <input className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </Labeled>
          <div className="grid grid-cols-2 gap-2">
            <Labeled label="Contact first name">
              <input className={inputCls} value={contactFirst} onChange={(e) => setContactFirst(e.target.value)} />
            </Labeled>
            <Labeled label="Contact last name">
              <input className={inputCls} value={contactLast} onChange={(e) => setContactLast(e.target.value)} />
            </Labeled>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Labeled label="Phone">
            <input className={inputCls} value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} inputMode="tel" placeholder="(555) 555-5555" />
          </Labeled>
          {!showPhoneAlt ? (
            <button
              type="button"
              onClick={() => setShowPhoneAlt(true)}
              className="mt-1 text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
            >
              <span className="text-base leading-none">+</span> Add another number
            </button>
          ) : (
            <div className="mt-2">
              <Labeled label="Alt phone">
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    value={phoneAlt}
                    onChange={(e) => setPhoneAlt(formatPhoneInput(e.target.value))}
                    inputMode="tel"
                    placeholder="(555) 555-5555"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setShowPhoneAlt(false); setPhoneAlt('') }}
                    className="px-2 text-xs text-slate-500 hover:text-red-700"
                    aria-label="Remove alt phone"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </Labeled>
            </div>
          )}
        </div>
        <Labeled label="Email">
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </Labeled>
      </div>

      {/* Contact type for the customer's main contact */}
      <div>
        <span className="block text-xs font-medium text-slate-700 mb-1">Contact type</span>
        <ContactTypeChecks value={primaryTypes} onChange={setPrimaryTypes} />
      </div>

      {/* Service address */}
      <div className="pt-2 border-t border-amber-200">
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
          Service address
        </div>
        {/* Row 1: street autocomplete (3/4 width) + Apt/Unit (1/4 width)
            inline. Google's autocomplete never returns the unit so this
            is where dispatch types it — sitting next to the street makes
            it obvious. */}
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-3">
            <AddressAutocomplete
              value={service.street_address}
              // Manual edits drop the stale verification note from the initial
              // AI-address check — we only re-assert a status when they pick.
              onChange={(v) => { setService((s) => ({ ...s, street_address: v })); setAddressVerification('idle') }}
              onPlaceSelected={(p) => {
                const street = [p.street_number, p.route].filter(Boolean).join(' ')
                setService((s) => ({
                  ...s,
                  street_address: street || p.formatted_address,
                  city:        p.city        ?? s.city,
                  state:       p.state       ?? s.state,
                  postal_code: p.postal_code ?? s.postal_code,
                  country:     p.country     ?? s.country,
                  latitude:    p.lat,
                  longitude:   p.lng,
                }))
                // Picking a Google suggestion IS the verification — clear any
                // "couldn't verify" left over from the AI's raw text.
                setAddressVerification('verified')
              }}
              placeholder="Start typing an address…"
              className={inputCls}
            />
          </div>
          <input
            className={inputCls}
            placeholder="Apt / Unit #"
            value={service.apt_unit}
            onChange={(e) => setService((s) => ({ ...s, apt_unit: e.target.value }))}
          />
        </div>
        {/* Row 2: city / state / zip */}
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 mt-2">
          <input className={inputCls} placeholder="City *"   value={service.city}        onChange={(e) => setService((s) => ({ ...s, city: e.target.value }))} />
          <input className={inputCls} placeholder="State *"  value={service.state}       onChange={(e) => setService((s) => ({ ...s, state: e.target.value }))} maxLength={2} />
          <input className={inputCls} placeholder="Zip"      value={service.postal_code} onChange={(e) => setService((s) => ({ ...s, postal_code: e.target.value }))} />
        </div>
        <textarea
          className={`${inputCls} mt-2`}
          rows={2}
          placeholder="Entry notes, gate code, landmark, or call notes"
          value={service.entry_notes}
          onChange={(e) => setService((s) => ({ ...s, entry_notes: e.target.value }))}
        />
        {addressVerification !== 'idle' && (
          <div className={`mt-1 text-xs ${
            addressVerification === 'verified'
              ? 'text-emerald-700'
              : addressVerification === 'failed'
                ? 'text-amber-700'
                : 'text-slate-500'
          }`}>
            {addressVerification === 'checking' && 'Checking the AI address with Google Maps...'}
            {addressVerification === 'verified' && 'Address matched Google Maps. Review before saving.'}
            {addressVerification === 'failed' && 'Google could not verify this automatically. Review the address before saving.'}
          </div>
        )}
      </div>

      {/* Billing override */}
      <div className="pt-2 border-t border-amber-200">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasBillingOverride}
            onChange={(e) => setHasBillingOverride(e.target.checked)}
            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <span>Bill to a different address</span>
        </label>
        {hasBillingOverride && (
          <div className="mt-2">
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3">
                <AddressAutocomplete
                  value={billing.street_address}
                  onChange={(v) => setBilling((s) => ({ ...s, street_address: v }))}
                  onPlaceSelected={(p) => {
                    const street = [p.street_number, p.route].filter(Boolean).join(' ')
                    setBilling((s) => ({
                      ...s,
                      street_address: street || p.formatted_address,
                      city:        p.city        ?? s.city,
                      state:       p.state       ?? s.state,
                      postal_code: p.postal_code ?? s.postal_code,
                      country:     p.country     ?? s.country,
                    }))
                  }}
                  placeholder="Billing street address"
                  className={inputCls}
                />
              </div>
              <input
                className={inputCls}
                placeholder="Apt / Unit #"
                value={billing.apt_unit}
                onChange={(e) => setBilling((s) => ({ ...s, apt_unit: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 mt-2">
              <input className={inputCls} placeholder="City"     value={billing.city}        onChange={(e) => setBilling((s) => ({ ...s, city: e.target.value }))} />
              <input className={inputCls} placeholder="State"    value={billing.state}       onChange={(e) => setBilling((s) => ({ ...s, state: e.target.value }))} maxLength={2} />
              <input className={inputCls} placeholder="Zip"      value={billing.postal_code} onChange={(e) => setBilling((s) => ({ ...s, postal_code: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      {/* Additional contacts */}
      <div className="pt-2 border-t border-amber-200">
        {extraContacts.map((c, i) => (
          <div key={c.id} className="mb-3 rounded-md border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Contact {i + 2}</span>
              <button
                type="button"
                onClick={() => removeContact(c.id)}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="First name" value={c.first} onChange={(e) => updateContact(c.id, { first: e.target.value })} />
              <input className={inputCls} placeholder="Last name" value={c.last} onChange={(e) => updateContact(c.id, { last: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Phone" value={c.phone} onChange={(e) => updateContact(c.id, { phone: formatPhoneInput(e.target.value) })} inputMode="tel" />
              <input className={inputCls} placeholder="Email" value={c.email} onChange={(e) => updateContact(c.id, { email: e.target.value })} />
            </div>
            <ContactTypeChecks value={c.types} onChange={(t) => updateContact(c.id, { types: t })} />
          </div>
        ))}
        <button
          type="button"
          onClick={addContact}
          className="text-sm text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
        >
          <span className="text-base leading-none">+</span> Add contact
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      {!hideActions && (
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void saveCustomer() }}
            disabled={submitting}
            className="text-sm px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium"
          >
            {submitting ? 'Saving…' : 'Save customer'}
          </button>
        </div>
      )}
    </div>
  )
})

InlineQuickAddCustomer.displayName = 'InlineQuickAddCustomer'

function KindButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm px-4 py-1.5 rounded-md border font-medium transition-colors ${
        active
          ? 'bg-amber-500 border-amber-500 text-white'
          : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

function ContactTypeChecks({
  value,
  onChange,
}: {
  value: ContactTypeFlags
  onChange: (v: ContactTypeFlags) => void
}) {
  const item = (key: keyof ContactTypeFlags, label: string) => (
    <label className="flex items-center gap-1.5 text-xs text-slate-700">
      <input
        type="checkbox"
        checked={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
      />
      {label}
    </label>
  )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {item('main', 'Main')}
      {item('billing', 'Billing')}
      {item('service', 'Service')}
      {item('intake', 'Intake / bill-to')}
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
