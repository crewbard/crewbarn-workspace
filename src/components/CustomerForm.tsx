import { useState, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { phoneField } from '@/lib/phone'
import { CustomerPicker } from '@/components/CustomerPicker'
import { TenantAccountPicker } from '@/components/TenantAccountPicker'
import { useTaxClasses } from '@/hooks/useTaxClasses'
import { usePaymentTerms } from '@/hooks/usePaymentTerms'
import {
  useCustomerDocuments,
  useUploadCustomerDocument,
} from '@/hooks/useCustomerDocuments'
import type { Customer, CustomerInput, CustomerType, CustomerTag } from '@/types/customer'

const ALL_TAGS: CustomerTag[] = [
  'vip', 'commercial', 'recurring', 'warning', 'do-not-call', 'referred', 'priority',
]

interface ContactRow {
  id?: string
  first_name: string
  last_name: string
  email: string
  email_alt: string
  phone: string
  phone_alt: string
  job_title: string
  department: string
  is_main_contact: boolean
  is_billing_contact: boolean
  is_service_contact: boolean
  is_intake_contact: boolean
  notes: string
  prefix: string
  suffix: string
  birthday: string
  anniversary: string
  sms_consent: boolean
  mailing_address_line1: string
  mailing_address_line2: string
  mailing_city: string
  mailing_state: string
  mailing_postal_code: string
  mailing_country: string
  bill_to_service_address: boolean
  showAdvanced?: boolean
  showMailing?: boolean
}

interface LocationRow {
  id?: string
  nickname: string
  street_address: string
  apt_unit: string
  city: string
  state: string
  postal_code: string
  country: string
  latitude: string
  longitude: string
  is_primary: boolean
  gated_property: boolean
  gate_code: string
  entry_notes: string
  active: boolean
  showGated?: boolean
  showLatLng?: boolean
}

interface FormData {
  customer_type: CustomerType
  business_name: string
  first_name: string
  last_name: string
  vip: boolean
  service_agreement: boolean
  active: boolean
  account_number: string
  parent_customer_id: string
  territory_id: string
  industry: string
  referral_source: string
  internal_notes: string
  public_notes: string
  tags: CustomerTag[]
  taxable: boolean
  tax_item: string
  tax_id: string
  default_tax_class_id: string
  tax_exempt_certificate_document_id: string
  payment_term_id: string
  default_currency: string
  payment_method: string
  assigned_agent_id: string
  commission_pct: string
  birthday: string
  anniversary: string
  sms_consent: boolean
  contacts: ContactRow[]
  service_locations: LocationRow[]
}

const emptyContact = (isMain = false): ContactRow => ({
  first_name: '',
  last_name: '',
  email: '',
  email_alt: '',
  phone: '',
  phone_alt: '',
  job_title: '',
  department: '',
  is_main_contact: isMain,
  is_billing_contact: false,
  is_service_contact: false,
  is_intake_contact: false,
  notes: '',
  prefix: '',
  suffix: '',
  birthday: '',
  anniversary: '',
  sms_consent: false,
  mailing_address_line1: '',
  mailing_address_line2: '',
  mailing_city: '',
  mailing_state: '',
  mailing_postal_code: '',
  mailing_country: 'US',
  bill_to_service_address: false,
  showAdvanced: false,
  showMailing: false,
})

const emptyLocation = (isPrimary = false): LocationRow => ({
  nickname: '',
  street_address: '',
  apt_unit: '',
  city: '',
  state: 'FL',
  postal_code: '',
  country: 'US',
  latitude: '',
  longitude: '',
  is_primary: isPrimary,
  gated_property: false,
  gate_code: '',
  entry_notes: '',
  active: true,
  showGated: false,
  showLatLng: false,
})

// ---------- Helpers to convert Customer to FormData for prefill ----------

function contactRowsForCustomer(c: Customer): ContactRow[] {
  const contacts = c.contacts ?? []
  if (contacts.length === 0) {
    const fallback = emptyContact(true)
    fallback.first_name = c.first_name || ''
    fallback.last_name = c.last_name || ''
    fallback.email = c.email || ''
    return [fallback]
  }

  const hasMain = contacts.some((contact) => contact.is_main_contact)
  return contacts
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((contact, index) => ({
      id: contact.id,
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      email_alt: contact.email_alt || '',
      phone: contact.phone || '',
      phone_alt: contact.phone_alt || '',
      job_title: contact.job_title || '',
      department: contact.department || '',
      is_main_contact: hasMain ? !!contact.is_main_contact : index === 0,
      is_billing_contact: !!contact.is_billing_contact,
      is_service_contact: !!contact.is_service_contact,
      is_intake_contact: !!contact.is_intake_contact,
      notes: contact.notes || '',
      prefix: contact.prefix || '',
      suffix: contact.suffix || '',
      birthday: contact.birthday || '',
      anniversary: contact.anniversary || '',
      sms_consent: !!contact.sms_consent,
      mailing_address_line1: contact.mailing_address?.line1 || '',
      mailing_address_line2: contact.mailing_address?.line2 || '',
      mailing_city: contact.mailing_address?.city || '',
      mailing_state: contact.mailing_address?.state || '',
      mailing_postal_code: contact.mailing_address?.postal_code || '',
      mailing_country: contact.mailing_address?.country || 'US',
      bill_to_service_address: !!contact.bill_to_service_address,
      showAdvanced: false,
      showMailing: false,
    }))
}

function locationRowsForCustomer(c: Customer): LocationRow[] {
  const locations = c.service_locations ?? []
  if (locations.length === 0) return [emptyLocation(true)]

  const hasPrimary = locations.some((location) => location.is_primary)
  return locations
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((location, index) => ({
      id: location.id,
      nickname: location.nickname || '',
      street_address: location.address?.street_address || '',
      apt_unit: location.address?.apt_unit || '',
      city: location.address?.city || '',
      state: location.address?.state || '',
      postal_code: location.address?.postal_code || '',
      country: location.address?.country || 'US',
      latitude: location.coordinates?.latitude != null ? String(location.coordinates.latitude) : '',
      longitude: location.coordinates?.longitude != null ? String(location.coordinates.longitude) : '',
      is_primary: hasPrimary ? !!location.is_primary : index === 0,
      gated_property: !!location.gated_property,
      gate_code: location.gate_code || '',
      entry_notes: location.entry_notes || '',
      active: location.active !== false,
      showGated: false,
      showLatLng: false,
    }))
}

function customerToFormData(c: Customer): FormData {
  return {
    customer_type: c.customer_type,
    business_name: c.business_name || '',
    first_name: c.first_name || '',
    last_name: c.last_name || '',
    vip: !!c.vip,
    service_agreement: !!c.service_agreement,
    active: c.active !== false,
    account_number: c.account_number || '',
    parent_customer_id: c.parent_customer_id || '',
    territory_id: c.territory_id || '',
    industry: c.industry || '',
    referral_source: c.referral_source || '',
    internal_notes: c.internal_notes || '',
    public_notes: c.public_notes || '',
    tags: c.tags || [],
    taxable: !!c.taxable,
    tax_item: c.tax_item || '',
    tax_id: c.tax_id || '',
    default_tax_class_id: c.default_tax_class_id || '',
    tax_exempt_certificate_document_id: c.tax_exempt_certificate_document_id || '',
    payment_term_id: c.payment_term_id || '',
    default_currency: c.default_currency || 'USD',
    payment_method: c.payment_method || '',
    assigned_agent_id: c.assigned_agent_id || '',
    commission_pct: c.commission_pct !== null && c.commission_pct !== undefined ? String(c.commission_pct) : '',
    birthday: c.birthday || '',
    anniversary: c.anniversary || '',
    sms_consent: !!c.sms_consent,
    contacts: contactRowsForCustomer(c),
    service_locations: locationRowsForCustomer(c),
  }
}

// ---------- Helpers to clean form data into CustomerInput shape ----------

const blank = (s: string | null | undefined): string | null =>
  s && s.trim() !== '' ? s.trim() : null

const numOrNull = (s: string | null | undefined): number | null => {
  if (!s || s.trim() === '') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

const meaningfulContactKeys = [
  'first_name',
  'last_name',
  'prefix',
  'suffix',
  'email',
  'email_alt',
  'phone',
  'phone_alt',
  'job_title',
  'department',
  'notes',
  'mailing_address_line1',
  'mailing_address_line2',
  'mailing_city',
  'mailing_state',
  'mailing_postal_code',
  'birthday',
  'anniversary',
] as const

const meaningfulLocationKeys = [
  'nickname',
  'street_address',
  'apt_unit',
  'city',
  'postal_code',
  'latitude',
  'longitude',
  'gate_code',
  'entry_notes',
] as const

function hasContactContent(contact: ContactRow | Record<string, unknown>): boolean {
  return meaningfulContactKeys.some((key) => {
    const value = contact[key]
    return typeof value === 'string' && value.trim() !== ''
  })
}

function hasLocationContent(location: LocationRow | Record<string, unknown>): boolean {
  return meaningfulLocationKeys.some((key) => {
    const value = location[key]
    return typeof value === 'string' && value.trim() !== ''
  })
}

function cleanFormData(data: FormData): CustomerInput {
  const contacts = data.contacts.map((c, i) => {
    const out: Record<string, unknown> = { position: i }
    if (c.id) out.id = c.id
    if (blank(c.first_name)) out.first_name = blank(c.first_name)
    if (blank(c.last_name)) out.last_name = blank(c.last_name)
    if (blank(c.prefix)) out.prefix = blank(c.prefix)
    if (blank(c.suffix)) out.suffix = blank(c.suffix)
    if (blank(c.email)) out.email = blank(c.email)
    if (blank(c.email_alt)) out.email_alt = blank(c.email_alt)
    if (blank(c.phone)) out.phone = blank(c.phone)
    if (blank(c.phone_alt)) out.phone_alt = blank(c.phone_alt)
    if (blank(c.job_title)) out.job_title = blank(c.job_title)
    if (blank(c.department)) out.department = blank(c.department)
    if (blank(c.notes)) out.notes = blank(c.notes)
    if (blank(c.mailing_address_line1)) out.mailing_address_line1 = blank(c.mailing_address_line1)
    if (blank(c.mailing_address_line2)) out.mailing_address_line2 = blank(c.mailing_address_line2)
    if (blank(c.mailing_city)) out.mailing_city = blank(c.mailing_city)
    if (blank(c.mailing_state)) out.mailing_state = blank(c.mailing_state)
    if (blank(c.mailing_postal_code)) out.mailing_postal_code = blank(c.mailing_postal_code)
    if (c.mailing_country) out.mailing_country = c.mailing_country
    if (blank(c.birthday)) out.birthday = blank(c.birthday)
    if (blank(c.anniversary)) out.anniversary = blank(c.anniversary)
    out.is_main_contact = !!c.is_main_contact
    out.is_billing_contact = !!c.is_billing_contact
    out.is_service_contact = !!c.is_service_contact
    out.is_intake_contact = !!c.is_intake_contact
    out.bill_to_service_address = !!c.bill_to_service_address
    out.sms_consent = !!c.sms_consent
    return out
  }).filter((c) => !!c.id || hasContactContent(c))

  const service_locations = data.service_locations.map((l, i) => {
    const out: Record<string, unknown> = { position: i }
    if (l.id) out.id = l.id
    if (blank(l.nickname)) out.nickname = blank(l.nickname)
    if (blank(l.street_address)) out.street_address = blank(l.street_address)
    if (blank(l.apt_unit)) out.apt_unit = blank(l.apt_unit)
    if (blank(l.city)) out.city = blank(l.city)
    if (blank(l.state)) out.state = blank(l.state)
    if (blank(l.postal_code)) out.postal_code = blank(l.postal_code)
    if (l.country) out.country = l.country
    const lat = numOrNull(l.latitude)
    const lng = numOrNull(l.longitude)
    if (lat !== null) out.latitude = lat
    if (lng !== null) out.longitude = lng
    out.is_primary = !!l.is_primary
    out.gated_property = !!l.gated_property
    if (l.gated_property && blank(l.gate_code)) out.gate_code = blank(l.gate_code)
    if (l.gated_property && blank(l.entry_notes)) out.entry_notes = blank(l.entry_notes)
    out.active = l.active !== false
    return out
  }).filter((l) => !!l.id || hasLocationContent(l))

  // Derive display_name from name fields. The display_name field is required
  // by the API but not exposed to the user â€” it's always computed from
  // business_name (commercial) or first_name + last_name (residential).
  const displayName = data.customer_type !== 'residential'
    ? (data.business_name || '').trim()
    : [data.first_name, data.last_name].filter(Boolean).join(' ').trim()

  const input: CustomerInput = {
    display_name: displayName,
    customer_type: data.customer_type,
    vip: !!data.vip,
    service_agreement: !!data.service_agreement,
    active: data.active !== false,
    taxable: !!data.taxable,
    sms_consent: !!data.sms_consent,
    tags: data.tags || [],
  }

  if (data.customer_type !== 'residential' && blank(data.business_name)) {
    input.business_name = blank(data.business_name)
  }
  if (data.customer_type === 'residential') {
    if (blank(data.first_name)) input.first_name = blank(data.first_name)
    if (blank(data.last_name)) input.last_name = blank(data.last_name)
  }
  if (blank(data.industry)) input.industry = blank(data.industry)
  if (blank(data.referral_source)) input.referral_source = blank(data.referral_source)
  if (blank(data.internal_notes)) input.internal_notes = blank(data.internal_notes)
  if (blank(data.public_notes)) input.public_notes = blank(data.public_notes)
  if (blank(data.tax_item)) input.tax_item = blank(data.tax_item)
  if (blank(data.tax_id)) input.tax_id = blank(data.tax_id)
  // tax_class_id: always send (null clears the override; '' becomes null).
  input.default_tax_class_id = data.default_tax_class_id || null
  // exempt cert: same — always send so unsetting on the form clears it.
  input.tax_exempt_certificate_document_id = data.tax_exempt_certificate_document_id || null
  // payment_term_id: same pattern — null clears, server falls back to
  // tenant default (then COD).
  input.payment_term_id = data.payment_term_id || null
  // territory (FR-7): always send so clearing it on the form unassigns the
  // customer. Harmless for non-franchise tenants (column is nullable).
  input.territory_id = data.territory_id || null
  // parent customer + assigned agent: always send so the pickers actually
  // persist (and can be cleared). Both are bound in the form but were
  // previously dropped here, so selecting either had no effect on save.
  input.parent_customer_id = data.parent_customer_id || null
  input.assigned_agent_id = data.assigned_agent_id || null
  if (data.default_currency) input.default_currency = data.default_currency
  if (blank(data.payment_method)) input.payment_method = blank(data.payment_method)
  if (blank(data.birthday)) input.birthday = blank(data.birthday)
  if (blank(data.anniversary)) input.anniversary = blank(data.anniversary)
  const commission = numOrNull(data.commission_pct)
  if (commission !== null) input.commission_pct = commission

  if (contacts.length > 0) input.contacts = contacts as CustomerInput['contacts']
  if (service_locations.length > 0) input.service_locations = service_locations as CustomerInput['service_locations']

  return input
}

// ---------- Component ----------

interface CustomerFormProps {
  onSubmit: (data: CustomerInput) => Promise<void>
  onCancel: () => void
  submitLabel: string
  serverErrors?: Record<string, string[]>
  initialData?: Customer
  mode?: 'create' | 'edit'
}

export function CustomerForm({ onSubmit, onCancel, submitLabel, serverErrors, initialData, mode: _mode = 'create' }: CustomerFormProps) {
  const defaultValues: FormData = initialData
    ? customerToFormData(initialData)
    : {
        customer_type: 'residential',
        business_name: '',
        first_name: '',
        last_name: '',
        vip: false,
        service_agreement: false,
        active: true,
        account_number: '',
        parent_customer_id: '',
        territory_id: '',
        industry: '',
        referral_source: '',
        internal_notes: '',
        public_notes: '',
        tags: [],
        taxable: true,
        tax_item: '',
        tax_id: '',
        default_tax_class_id: '',
        tax_exempt_certificate_document_id: '',
        payment_term_id: '',
        default_currency: 'USD',
        payment_method: '',
        assigned_agent_id: '',
        commission_pct: '',
        birthday: '',
        anniversary: '',
        sms_consent: false,
        contacts: [emptyContact(true)],
        service_locations: [emptyLocation(true)],
      }

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormData>({ defaultValues })

  const customerType = watch('customer_type')
  const watchedTags = watch('tags') ?? []

  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({ control, name: 'contacts' })

  const {
    fields: locationFields,
    append: appendLocation,
    remove: removeLocation,
  } = useFieldArray({ control, name: 'service_locations' })

  /**
   * setValue wrapper that snapshots scroll position and restores it on
   * the next frame. react-hook-form's setValue can cause a re-render
   * that briefly drops the scroll anchor; existing toggles in this
   * file use the same workaround inline. This helper centralizes it
   * for the new dropdowns added in the Tax & Billing section.
   */
  function setValuePreservingScroll(
    name: Parameters<typeof setValue>[0],
    value: Parameters<typeof setValue>[1],
    options?: Parameters<typeof setValue>[2],
  ): void {
    const y = window.scrollY
    setValue(name, value, options)
    requestAnimationFrame(() => window.scrollTo(0, y))
  }

  const toggleTag = (tag: CustomerTag) => {
    if (watchedTags.includes(tag)) {
      setValue('tags', watchedTags.filter((t) => t !== tag))
    } else {
      setValue('tags', [...watchedTags, tag])
    }
  }

  const handleFormSubmit = async (data: FormData) => {
    const cleaned = cleanFormData(data)
    await onSubmit(cleaned)
  }

  const errorFor = (key: string): string | undefined => {
    if (!serverErrors) return undefined
    const messages = serverErrors[key]
    return messages && messages.length > 0 ? messages[0] : undefined
  }

  // Stable identity (empty deps): defined-in-render components remount the whole
  // subtree each keystroke, so a wrapped input loses focus after one letter.
  const Section = useCallback(
    ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
      <section className="bg-white rounded-lg border border-navy-100 p-4 sm:p-6">
        <div className="mb-4 sm:mb-5">
          <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">{title}</h2>
          {subtitle && <p className="text-xs text-navy-500 mt-1">{subtitle}</p>}
        </div>
        {children}
      </section>
    ),
    [],
  )

  const Label = useCallback(
    ({ children }: { children: React.ReactNode }) => (
      <label className="block text-xs font-medium text-navy-600 mb-1">{children}</label>
    ),
    [],
  )

  const FieldError = ({ name }: { name: string }) => {
    const msg = errorFor(name)
    if (!msg) return null
    return <p className="text-xs text-danger mt-1">{msg}</p>
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 pb-24">

      {serverErrors && Object.keys(serverErrors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-danger mb-2">Please fix the following:</p>
          <ul className="text-sm text-danger space-y-1 list-disc list-inside">
            {Object.entries(serverErrors).map(([field, msgs]) =>
              msgs.map((msg, i) => <li key={`${field}-${i}`}>{msg}</li>)
            )}
          </ul>
        </div>
      )}

      <Section title="Identity" subtitle="Who is this customer?">
        <div className="space-y-4">
          <div>
            <Label>Customer type</Label>
            <div className="flex gap-3">
              {(['residential', 'commercial', 'government'] as CustomerType[]).map((t) => (
                <label
                  key={t}
                  className={`flex-1 px-4 py-3 border rounded-md cursor-pointer text-sm font-medium text-center transition-colors capitalize ${
                    customerType === t
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-navy-200 text-navy-600 hover:border-navy-300'
                  }`}
                >
                  <input type="radio" {...register('customer_type')} value={t} className="sr-only" />
                  {t}
                </label>
              ))}
            </div>
            <FieldError name="customer_type" />
          </div>

          {customerType !== 'residential' && (
            <div>
              <Label>{customerType === 'government' ? 'Agency / organization name *' : 'Business name *'}</Label>
              <Input {...register('business_name')} placeholder={customerType === 'government' ? 'City of Melbourne' : 'Acme Locksmiths LLC'} />
              <FieldError name="business_name" />
            </div>
          )}
          {customerType === 'residential' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>First name *</Label>
                <Input {...register('first_name')} placeholder="Jane" />
                <FieldError name="first_name" />
              </div>
              <div>
                <Label>Last name *</Label>
                <Input {...register('last_name')} placeholder="Doe" />
                <FieldError name="last_name" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
              <input type="checkbox" {...register('vip')} className="rounded border-navy-300" />
              <span>VIP</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
              <input type="checkbox" {...register('service_agreement')} className="rounded border-navy-300" />
              <span>Service agreement</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
              <input type="checkbox" {...register('active')} className="rounded border-navy-300" />
              <span>Active</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-navy-100">
            <div>
              <Label>Account number (auto-assigned)</Label>
              <Input {...register('account_number')} placeholder="Auto-assigned on save" disabled />
            </div>
            <div>
              <Label>Parent customer (optional)</Label>
              <ParentCustomerPickerField
                value={watch('parent_customer_id')}
                onChange={(id) => setValuePreservingScroll('parent_customer_id', id ?? '', { shouldDirty: true })}
              />
              <p className="text-xs text-navy-400 mt-1">
                Use for sub-locations of a franchise, property manager, or warranty company.
              </p>
            </div>
          </div>

          <TerritoryField
            value={watch('territory_id')}
            onChange={(v) => setValuePreservingScroll('territory_id', v, { shouldDirty: true })}
          />
        </div>
      </Section>

      <Section title="Contacts" subtitle="People to reach at this customer. The main contact gets job notifications. Billing contacts get invoices.">
        <div className="space-y-4">
          {contactFields.map((field, index) => {
            const showAdvanced = watch(`contacts.${index}.showAdvanced`)
            const showMailing = watch(`contacts.${index}.showMailing`)
            return (
              <div key={field.id} className="border border-navy-200 rounded-md p-4 bg-navy-50/30">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-navy-200">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold text-navy-700">Contact {index + 1}</span>
                    <label className="inline-flex items-center gap-2 cursor-pointer" title="Receives scheduling, on-the-way, and completion notifications">
                      <input type="checkbox" {...register(`contacts.${index}.is_main_contact`)} className="rounded border-navy-300" />
                      <span className="text-navy-700">Main</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer" title="Receives invoices when this customer is billed">
                      <input type="checkbox" {...register(`contacts.${index}.is_billing_contact`)} className="rounded border-navy-300" />
                      <span className="text-navy-700">Billing</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer" title="The person to call about service appointments (e.g. a renter when the landlord is the main contact)">
                      <input type="checkbox" {...register(`contacts.${index}.is_service_contact`)} className="rounded border-navy-300" />
                      <span className="text-navy-700">Service</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer" title="When an intake call/text comes from this number, attribute it to this customer for billing">
                      <input type="checkbox" {...register(`contacts.${index}.is_intake_contact`)} className="rounded border-navy-300" />
                      <span className="text-navy-700">Intake / bill-to</span>
                    </label>
                  </div>
                  {contactFields.length > 1 && (
                    <button type="button" onClick={() => removeContact(index)} className="text-xs text-danger hover:underline">
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label>First name</Label>
                    <Input {...register(`contacts.${index}.first_name`)} placeholder="Jane" />
                  </div>
                  <div>
                    <Label>Last name</Label>
                    <Input {...register(`contacts.${index}.last_name`)} placeholder="Doe" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input {...register(`contacts.${index}.email`)} type="email" placeholder="jane@example.com" />
                  </div>
                  <div>
                    <Label>Email alt</Label>
                    <Input {...register(`contacts.${index}.email_alt`)} type="email" placeholder="alt@example.com" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input {...phoneField(register(`contacts.${index}.phone`))} placeholder="(321) 555-0100" />
                  </div>
                  <div>
                    <Label>Phone alt</Label>
                    <Input {...phoneField(register(`contacts.${index}.phone_alt`))} placeholder="(321) 555-0101" />
                  </div>
                  <div>
                    <Label>Job title</Label>
                    <Input {...register(`contacts.${index}.job_title`)} placeholder="Office Manager" />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Input {...register(`contacts.${index}.department`)} placeholder="Operations" />
                  </div>
                </div>

                <div className="mb-3">
                  <Label>Notes about this contact</Label>
                  <textarea {...register(`contacts.${index}.notes`)} rows={2} className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="e.g. Prefers to be called after 3pm" />
                </div>

                <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; setValue(`contacts.${index}.showMailing`, !showMailing); requestAnimationFrame(() => window.scrollTo(0, y)); }} className="text-xs text-navy-500 hover:text-amber-600 inline-flex items-center gap-1 mb-2">
                  {showMailing ? '▼' : '▶'} {showMailing ? 'Hide' : 'Show'} mailing address
                </button>
                {showMailing && (
                  <div className="space-y-3 mb-3 p-3 bg-white rounded border border-navy-100">
                    <AddressAutocomplete
                      value={watch(`contacts.${index}.mailing_address_line1`) ?? ''}
                      onChange={(v) => setValue(`contacts.${index}.mailing_address_line1`, v, { shouldDirty: true })}
                      onPlaceSelected={(parsed) => {
                        const street = [parsed.street_number, parsed.route].filter(Boolean).join(' ')
                        setValue(`contacts.${index}.mailing_address_line1`, street || parsed.formatted_address, { shouldDirty: true })
                        if (parsed.city)        setValue(`contacts.${index}.mailing_city`, parsed.city, { shouldDirty: true })
                        if (parsed.state)       setValue(`contacts.${index}.mailing_state`, parsed.state, { shouldDirty: true })
                        if (parsed.postal_code) setValue(`contacts.${index}.mailing_postal_code`, parsed.postal_code, { shouldDirty: true })
                        if (parsed.country)     setValue(`contacts.${index}.mailing_country`, parsed.country, { shouldDirty: true })
                      }}
                      placeholder="Street address"
                      className="w-full px-3 py-2 text-sm bg-white border border-navy-200 rounded-md placeholder:text-navy-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-navy-800"
                    />
                    <div>
                      <Label>Apt / Suite</Label>
                      <Input {...register(`contacts.${index}.mailing_address_line2`)} placeholder="Apt 4B" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>City</Label>
                        <Input {...register(`contacts.${index}.mailing_city`)} placeholder="Melbourne" />
                      </div>
                      <div>
                        <Label>State</Label>
                        <Input {...register(`contacts.${index}.mailing_state`)} placeholder="FL" maxLength={2} />
                      </div>
                      <div>
                        <Label>Zip</Label>
                        <Input {...register(`contacts.${index}.mailing_postal_code`)} placeholder="32901" />
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-navy-700">
                      <input type="checkbox" {...register(`contacts.${index}.bill_to_service_address`)} className="rounded border-navy-300" />
                      <span>Show service location address on invoice instead of this</span>
                    </label>
                  </div>
                )}

                <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; setValue(`contacts.${index}.showAdvanced`, !showAdvanced); requestAnimationFrame(() => window.scrollTo(0, y)); }} className="text-xs text-navy-500 hover:text-amber-600 inline-flex items-center gap-1">
                  {showAdvanced ? '▼' : '▶'} {showAdvanced ? 'Hide' : 'Show'} advanced (prefix, birthday, SMS consent)
                </button>
                {showAdvanced && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3 bg-white rounded border border-navy-100">
                    <div><Label>Prefix</Label><Input {...register(`contacts.${index}.prefix`)} placeholder="Mr / Mrs / Dr" /></div>
                    <div><Label>Suffix</Label><Input {...register(`contacts.${index}.suffix`)} placeholder="Jr / III" /></div>
                    <div><Label>Birthday</Label><Input {...register(`contacts.${index}.birthday`)} type="date" /></div>
                    <div><Label>Anniversary</Label><Input {...register(`contacts.${index}.anniversary`)} type="date" /></div>
                    <div className="col-span-2">
                      <label className="inline-flex items-center gap-2 text-sm text-navy-700">
                        <input type="checkbox" {...register(`contacts.${index}.sms_consent`)} className="rounded border-navy-300" />
                        <span>SMS consent (this person agreed to receive texts)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; appendContact(emptyContact(false)); requestAnimationFrame(() => window.scrollTo(0, y)); }} className="w-full py-3 border-2 border-dashed border-navy-200 rounded-md text-sm text-navy-500 hover:border-amber-400 hover:text-amber-600 transition-colors">
            + Add another contact
          </button>
        </div>
      </Section>

      <Section title="Service Locations" subtitle="Physical addresses where techs are dispatched. The primary location is the default for new jobs.">
        <div className="space-y-4">
          {locationFields.map((field, index) => {
            const isGated = watch(`service_locations.${index}.gated_property`)
            const showLatLng = watch(`service_locations.${index}.showLatLng`)
            return (
              <div key={field.id} className="border border-navy-200 rounded-md p-4 bg-navy-50/30">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-navy-200">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold text-navy-700">Location {index + 1}</span>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register(`service_locations.${index}.is_primary`)} className="rounded border-navy-300" />
                      <span className="text-navy-700">Primary</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register(`service_locations.${index}.gated_property`)} className="rounded border-navy-300" />
                      <span className="text-navy-700">Gated property</span>
                    </label>
                  </div>
                  {locationFields.length > 1 && (
                    <button type="button" onClick={() => removeLocation(index)} className="text-xs text-danger hover:underline">Remove</button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Nickname (e.g. &ldquo;Main warehouse&rdquo;, &ldquo;North store&rdquo;)</Label>
                    <Input {...register(`service_locations.${index}.nickname`)} placeholder="Optional label" />
                  </div>
                  <div>
                    <Label>Street address</Label>
                    <AddressAutocomplete
                      value={watch(`service_locations.${index}.street_address`) ?? ''}
                      onChange={(v) => setValue(`service_locations.${index}.street_address`, v, { shouldDirty: true })}
                      onPlaceSelected={(parsed) => {
                        const street = [parsed.street_number, parsed.route].filter(Boolean).join(' ')
                        setValue(`service_locations.${index}.street_address`, street || parsed.formatted_address, { shouldDirty: true })
                        if (parsed.city)        setValue(`service_locations.${index}.city`, parsed.city, { shouldDirty: true })
                        if (parsed.state)       setValue(`service_locations.${index}.state`, parsed.state, { shouldDirty: true })
                        if (parsed.postal_code) setValue(`service_locations.${index}.postal_code`, parsed.postal_code, { shouldDirty: true })
                        if (parsed.country)     setValue(`service_locations.${index}.country`, parsed.country, { shouldDirty: true })
                        if (parsed.lat != null) setValue(`service_locations.${index}.latitude`, String(parsed.lat), { shouldDirty: true })
                        if (parsed.lng != null) setValue(`service_locations.${index}.longitude`, String(parsed.lng), { shouldDirty: true })
                      }}
                      placeholder="Start typing an address…"
                      className="w-full px-3 py-2 text-sm bg-white border border-navy-200 rounded-md placeholder:text-navy-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-navy-800"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label>Apt / Unit</Label>
                      <Input {...register(`service_locations.${index}.apt_unit`)} placeholder="Apt 4B" />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input {...register(`service_locations.${index}.city`)} placeholder="Melbourne" />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input {...register(`service_locations.${index}.state`)} placeholder="FL" maxLength={2} />
                    </div>
                    <div>
                      <Label>Zip</Label>
                      <Input {...register(`service_locations.${index}.postal_code`)} placeholder="32901" />
                    </div>
                  </div>

                  {isGated && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-3">
                      <div>
                        <Label>Gate code</Label>
                        <Input {...register(`service_locations.${index}.gate_code`)} placeholder="1234" />
                        <p className="text-xs text-navy-500 mt-1">Encrypted at rest. Only you and your techs see this.</p>
                      </div>
                      <div>
                        <Label>Entry notes</Label>
                        <textarea {...register(`service_locations.${index}.entry_notes`)} rows={2} className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="e.g. Use side gate, code is for the back. Buzz unit 4B if no answer." />
                      </div>
                    </div>
                  )}

                  <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; setValue(`service_locations.${index}.showLatLng`, !showLatLng); requestAnimationFrame(() => window.scrollTo(0, y)); }} className="text-xs text-navy-500 hover:text-amber-600 inline-flex items-center gap-1">
                    {showLatLng ? '▼' : '▶'} {showLatLng ? 'Hide' : 'Show'} lat/lng coords
                  </button>
                  {showLatLng && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input {...register(`service_locations.${index}.latitude`)} placeholder="27.0658" />
                      <Input {...register(`service_locations.${index}.longitude`)} placeholder="-80.6034" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; appendLocation(emptyLocation(false)); requestAnimationFrame(() => window.scrollTo(0, y)); }} className="w-full py-3 border-2 border-dashed border-navy-200 rounded-md text-sm text-navy-500 hover:border-amber-400 hover:text-amber-600 transition-colors">
            + Add another location
          </button>
        </div>
      </Section>

      <Section title="Notes & Tags" subtitle="Internal notes are staff-only. Public notes appear on invoices and work orders.">
        <div className="space-y-4">
          <div>
            <Label>Internal notes (staff only)</Label>
            <textarea {...register('internal_notes')} rows={3} className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Anything important about this customer that customers shouldn't see..." />
          </div>
          <div>
            <Label>Public notes (visible on invoices)</Label>
            <textarea {...register('public_notes')} rows={2} className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="e.g. Thank you for your continued business!" />
          </div>
          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map((tag) => {
                const selected = watchedTags.includes(tag)
                return (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-amber-500 text-white' : 'bg-navy-50 text-navy-600 hover:bg-navy-100'}`}>
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Tax & Billing" subtitle="Taxable status, payment defaults.">
        <div className="space-y-4">
          <label className="inline-flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
            <input type="checkbox" {...register('taxable')} className="rounded border-navy-300" />
            <span>Taxable</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Default tax class</Label>
              <TaxClassSelect
                value={watch('default_tax_class_id')}
                onChange={(v) =>
                  setValuePreservingScroll('default_tax_class_id', v, { shouldDirty: true })
                }
              />
            </div>
            <div>
              <Label>Tax ID / EIN (if exempt)</Label>
              <Input {...register('tax_id')} placeholder="12-3456789" />
            </div>
            <div>
              <Label>Default payment method</Label>
              <Input {...register('payment_method')} placeholder="Credit card / Check / ACH" />
            </div>
            <div>
              <Label>Payment terms</Label>
              <PaymentTermSelect
                value={watch('payment_term_id')}
                onChange={(v) =>
                  setValuePreservingScroll('payment_term_id', v, { shouldDirty: true })
                }
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Input {...register('default_currency')} placeholder="USD" maxLength={3} />
            </div>
          </div>

          {/* Hidden — kept so legacy 'tax_item' on existing customers
              doesn't get nulled silently on save. Pure passthrough. */}
          <input type="hidden" {...register('tax_item')} />

          {/* Tax exempt certificate. Only renderable for an existing
              customer (need an id to upload against). For new
              customers the field is suppressed with a hint. */}
          <TaxExemptCertField
            customerId={initialData?.id ?? null}
            isTaxable={!!watch('taxable')}
            documentId={watch('tax_exempt_certificate_document_id')}
            onChange={(id) =>
              setValuePreservingScroll('tax_exempt_certificate_document_id', id ?? '', {
                shouldDirty: true,
              })
            }
          />
        </div>
      </Section>

      <Section title="Advanced" subtitle="Optional. Most customers don't need anything here.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Industry</Label><Input {...register('industry')} placeholder="Auto Dealership" /></div>
          <div><Label>Referral source</Label><Input {...register('referral_source')} placeholder="Google / Word of mouth" /></div>
          <div><Label>Birthday (residential)</Label><Input {...register('birthday')} type="date" /></div>
          <div><Label>Anniversary</Label><Input {...register('anniversary')} type="date" /></div>
          <div>
            <Label>Assigned agent</Label>
            <TenantAccountPicker
              value={watch('assigned_agent_id')}
              onChange={(id) => setValuePreservingScroll('assigned_agent_id', id ?? '', { shouldDirty: true })}
            />
          </div>
          <div><Label>Commission %</Label><Input {...register('commission_pct')} type="number" step="0.01" placeholder="10.00" /></div>
          <div className="col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
              <input type="checkbox" {...register('sms_consent')} className="rounded border-navy-300" />
              <span>Customer-level SMS consent (catch-all)</span>
            </label>
          </div>
        </div>
      </Section>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-navy-100 px-3 sm:px-6 py-3 sm:py-4 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-2 sm:gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}

/**
 * Territory (county / operating area) picker — FR-7. Sources from
 * /v1/territories (tenant-scoped). Self-hides for tenants that have no
 * territories configured — i.e. single-area shops that aren't franchises —
 * so the field only appears where it's meaningful. Empty value = unassigned.
 * Drives franchise roll-up reporting and royalties downstream.
 */
function TerritoryField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { data } = useQuery({
    queryKey: ['territories'],
    queryFn: () =>
      apiRequest<{ data: { id: string; name: string; is_primary: boolean }[] }>(
        '/v1/territories',
      ),
    staleTime: 5 * 60 * 1000,
  })
  const territories = data?.data ?? []
  if (territories.length === 0) return null

  return (
    <div>
      <label className="block text-xs font-medium text-navy-600 mb-1">
        Territory (county / operating area)
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-navy-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
      >
        <option value="">— Unassigned —</option>
        {territories.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.is_primary ? ' · primary' : ''}
          </option>
        ))}
      </select>
      <p className="text-xs text-navy-400 mt-1">
        Used for franchise roll-up reporting and royalties.
      </p>
    </div>
  )
}

/**
 * Tax class dropdown — sources from /v1/tax-classes (active only).
 * Highlights which one is the tenant default. "Use tenant default"
 * (value='') means: no per-customer override → fall back to the
 * tenant default in the invoice creator.
 */
function TaxClassSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { data } = useTaxClasses({ active: true, per_page: 100 })
  const taxClasses = data?.data ?? []
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-navy-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
    >
      <option value="">— Use tenant default —</option>
      {taxClasses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({Number(c.rate_pct).toFixed(3).replace(/\.?0+$/, '')}%)
          {c.is_default ? ' · tenant default' : ''}
        </option>
      ))}
    </select>
  )
}

/**
 * Payment terms dropdown — sources from /v1/payment-terms (active).
 * "Use tenant default" (value='') means: no per-customer override →
 * server falls back to tenant default, then to COD.
 *
 * Renders a help link if no terms are configured yet so the user
 * knows where to set them up.
 */
function PaymentTermSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { data: terms = [], isLoading } = usePaymentTerms({ active: true })
  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-navy-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        disabled={isLoading}
      >
        <option value="">— Use tenant default (COD if none) —</option>
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.days_until_due > 0 ? ` · ${t.days_until_due} days` : ' · due on receipt'}
            {t.is_default ? ' · tenant default' : ''}
          </option>
        ))}
      </select>
      {terms.length === 0 && !isLoading && (
        <p className="text-xs text-amber-700 mt-1">
          No payment terms configured.{' '}
          <Link
            to="/tool-shed/payment-terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Add some
          </Link>
          .
        </p>
      )}
    </div>
  )
}

/**
 * Tax exempt certificate uploader. Surfaces the customer's stored
 * cert (if any) with view/remove actions, and an upload button.
 *
 * New customers (no id yet) get a hint to save first — uploads need
 * a customer record to attach to. Once saved, they can come back and
 * upload here.
 *
 * When the customer is marked taxable, the section still renders
 * (you can keep a cert on file even if currently taxed) but it's
 * styled as "optional." When NOT taxable, we nudge: "Auditors will
 * ask for this — upload it."
 */
function TaxExemptCertField({
  customerId,
  isTaxable,
  documentId,
  onChange,
}: {
  customerId: string | null
  isTaxable: boolean
  documentId: string
  onChange: (id: string | null) => void
}) {
  const docsQ = useCustomerDocuments(customerId ?? '')
  const upload = useUploadCustomerDocument()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // listCustomerDocuments unwraps {data} for us — array is at .data
  // on the query result itself, not a nested .data.data.
  const docs = docsQ.data ?? []
  const currentDoc = documentId
    ? docs.find((d: { id: string }) => d.id === documentId)
    : null

  // Pre-existing customer documents the user might want to point at
  // instead of uploading a fresh one. Lets them re-use a doc already
  // attached to the customer (e.g. they uploaded it via the Documents
  // tab earlier).
  const pickableDocs = docs.filter((d: { id: string }) => d.id !== documentId)

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !customerId) return
    setErr(null)
    setBusy(true)
    try {
      const doc = await upload.mutateAsync({
        customerId,
        file: files[0],
        title: 'Tax exempt certificate',
      })
      onChange(doc.id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const isNew = !customerId

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        isTaxable
          ? 'border-slate-200 bg-slate-50'
          : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-navy-800 uppercase tracking-wide">
          Tax exempt certificate
          {!isTaxable && (
            <span className="ml-2 text-amber-700 normal-case font-normal">
              · required for audit trail when customer is non-taxable
            </span>
          )}
        </div>
      </div>

      {isNew ? (
        <p className="text-xs text-slate-500 italic">
          Save the customer first, then come back here to upload the certificate.
        </p>
      ) : currentDoc ? (
        <div className="flex items-center gap-3 bg-white rounded border border-slate-200 px-3 py-2">
          <span className="text-xl">📄</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">
              {currentDoc.title || currentDoc.original_filename || 'Certificate'}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {currentDoc.original_filename}
            </div>
          </div>
          {currentDoc.file_url && (
            <a
              href={currentDoc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-700 hover:text-amber-800"
            >
              View
            </a>
          )}
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-red-600 hover:text-red-700"
            title="Unlink (file stays in Documents tab)"
          >
            Unlink
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <span className="px-3 py-1.5 text-xs font-semibold bg-white border border-navy-300 text-navy-700 rounded hover:bg-slate-50">
              {busy ? 'Uploading…' : 'Upload certificate…'}
            </span>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
          {pickableDocs.length > 0 && (
            <div className="text-xs text-slate-600">
              or pick an existing document:{' '}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onChange(e.target.value)
                }}
                className="ml-1 text-xs border border-slate-300 rounded px-1.5 py-0.5"
              >
                <option value="">— choose —</option>
                {pickableDocs.map((d: {
                  id: string
                  title: string | null
                  original_filename: string | null
                }) => (
                  <option key={d.id} value={d.id}>
                    {d.title || d.original_filename || d.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {err && <p className="text-xs text-red-700">{err}</p>}
    </div>
  )
}

/**
 * Parent-customer picker — wraps CustomerPicker to bridge the
 * "id string" shape of the form field with CustomerPicker's "Customer | null"
 * shape. Resolves the id back to a customer on mount via the hybrid hook
 * (no extra endpoint needed — the user only picks from search results,
 * and on edit the id was already known + saved).
 */
function ParentCustomerPickerField({
  value,
  onChange,
}: {
  value: string | null | undefined
  onChange: (id: string | null) => void
}) {
  // We only need to display the picker — when value is set on edit, the
  // CustomerPicker shows its collapsed "selected" state. We fetch the full
  // customer once so the collapsed state has a name to show.
  const [resolved, setResolved] = useState<Customer | null>(null)
  return (
    <CustomerPicker
      value={resolved}
      onChange={(c) => {
        setResolved(c)
        onChange(c?.id ?? null)
      }}
      placeholder={value ? 'Reset to search…' : 'Start typing a parent customer…'}
    />
  )
}
