import { useState, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useEffect } from 'react'
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
import { useCustomer } from '@/hooks/useCustomers'
import { useCustomerTagColor, useCustomerTags } from '@/lib/customerTags'
import { usePermissions } from '@/hooks/usePermissions'
import { useTheme } from '@/hooks/useTheme'
import { CustomFieldsSection, type CustomValues } from '@/components/CustomFieldsSection'
import { InvoiceSubjectField } from '@/components/customers/InvoiceSubjectField'


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
  is_intake_approver: boolean
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
  statement_day: string
  invoice_email_subject: string
  statement_recipients: string
  statement_subject: string
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
  is_intake_approver: false,
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
  state: '',
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
      is_intake_approver: !!contact.is_intake_approver,
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
    statement_day: String(c.statement_preferences?.day ?? ''),
    invoice_email_subject: c.invoice_email_subject ?? '',
    statement_recipients: c.statement_preferences?.recipients.join(', ') ?? '',
    statement_subject: c.statement_preferences?.subject ?? 'Monthly statement',
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
    out.is_intake_approver = !!c.is_intake_approver
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
  input.invoice_email_subject = data.invoice_email_subject.trim() || null
  input.statement_preferences = data.customer_type !== 'residential' && data.statement_day
    ? { day: Number(data.statement_day), recipients: data.statement_recipients.split(/[,;\n]/).map(v => v.trim()).filter(Boolean), subject: data.statement_subject.trim() }
    : null
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
  /**
   * customValues: tenant-defined customer custom fields (keyed by
   * custom_field_id). The parent saves them with uploadCustomValues()
   * once it has the customer id. Empty when the tenant has none.
   */
  onSubmit: (data: CustomerInput, customValues: CustomValues) => Promise<void>
  onCancel: () => void
  submitLabel: string
  serverErrors?: Record<string, string[]>
  initialData?: Customer
  mode?: 'create' | 'edit'
  onOpenTemplates?: () => void
  profileOnly?: boolean
  /**
   * New customer from a call: the caller's number goes on the main contact.
   * Only the number: caller-ID names are often a city or "WIRELESS CALLER".
   */
  prefill?: { phone?: string | null }
}

type CreateTab = 'account' | 'contacts' | 'locations' | 'billing' | 'review'
const createTabs: { id: CreateTab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'locations', label: 'Locations' },
  { id: 'billing', label: 'Billing & notes' },
  { id: 'review', label: 'Review' },
]

export function CustomerForm({ onSubmit, onCancel, submitLabel, serverErrors, initialData, mode = 'create', onOpenTemplates, profileOnly = false, prefill }: CustomerFormProps) {
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
        statement_day: '',
        invoice_email_subject: '',
        statement_recipients: '',
        statement_subject: 'Monthly statement',
        default_currency: 'USD',
        payment_method: '',
        assigned_agent_id: '',
        commission_pct: '',
        birthday: '',
        anniversary: '',
        sms_consent: false,
        contacts: [{ ...emptyContact(true), phone: prefill?.phone ?? '' }],
        service_locations: [emptyLocation(true)],
      }

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { isSubmitting, isDirty },
  } = useForm<FormData>({ defaultValues })

  const { theme } = useTheme()
  const customerType = watch('customer_type')
  const newCustomer = mode === 'create' && !initialData && !profileOnly
  const focusCreate = newCustomer && theme === 'focus'
  const [createLayout, setCreateLayout] = useState<'tabbed' | 'canvas'>('tabbed')
  const tabbedCreate = focusCreate && createLayout === 'tabbed'
  const canvasCreate = focusCreate && createLayout === 'canvas'
  const [activeTab, setActiveTab] = useState<CreateTab>('account')
  const previewFirstName = watch('first_name')
  const previewLastName = watch('last_name')
  const previewBusinessName = watch('business_name')
  const previewName = customerType === 'residential'
    ? [previewFirstName, previewLastName].filter(Boolean).join(' ') || 'New customer'
    : previewBusinessName || 'New business account'
  // Match cleanFormData: untouched placeholder rows are not saved as contacts or locations.
  const reviewContacts = (watch('contacts') ?? []).filter((contact) => !!contact.id || hasContactContent(contact))
  const reviewLocations = (watch('service_locations') ?? []).filter((location) => !!location.id || hasLocationContent(location))
  const { data: paymentTerms = [] } = usePaymentTerms({ active: true })
  const paymentTermId = watch('payment_term_id')
  const selectedPaymentTerm = paymentTerms.find((term) => term.id === paymentTermId)
  const watchedTags = watch('tags') ?? []
  const { has } = usePermissions()
  // Field definitions live behind the settings permission family; without
  // it the section would only show a load error, so skip it.
  const showCustomFields = !profileOnly && (has('settings.view') || has('settings.edit'))
  const [customValues, setCustomValues] = useState<CustomValues>({})

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

  useEffect(() => {
    if (!tabbedCreate || !serverErrors || Object.keys(serverErrors).length === 0) return
    const keys = Object.keys(serverErrors)
    const nextTab: CreateTab = keys.some((key) => key.startsWith('contacts')) ? 'contacts'
      : keys.some((key) => key.startsWith('service_locations')) ? 'locations'
      : keys.some((key) => /tax|payment|statement|invoice|currency/i.test(key)) ? 'billing'
      : 'account'
    setActiveTab(nextTab)
  }, [serverErrors, tabbedCreate])

  const goToTab = (tab: CreateTab) => {
    setActiveTab(tab)
    requestAnimationFrame(() => document.getElementById('customer-create-tabs')?.scrollIntoView({ block: 'start' }))
  }

  const handleCreateTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: CreateTab) => {
    const currentIndex = createTabs.findIndex(({ id }) => id === tab)
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? createTabs.length - 1
      : event.key === 'ArrowRight' ? (currentIndex + 1) % createTabs.length
      : event.key === 'ArrowLeft' ? (currentIndex - 1 + createTabs.length) % createTabs.length
      : -1
    if (nextIndex < 0) return
    event.preventDefault()
    const nextTab = createTabs[nextIndex].id
    goToTab(nextTab)
    document.getElementById(`customer-create-tab-${nextTab}`)?.focus()
  }

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

  const customerTags = useCustomerTags()
  const libraryTags = customerTags.data?.data ?? []
  const tagColor = useCustomerTagColor()
  const toggleTag = (tag: CustomerTag) => {
    if (watchedTags.includes(tag)) {
      setValue('tags', watchedTags.filter((t) => t !== tag))
    } else {
      setValue('tags', [...watchedTags, tag])
    }
  }

  const handleFormSubmit = async (data: FormData) => {
    const cleaned = cleanFormData(data)
    await onSubmit(cleaned, showCustomFields ? customValues : {})
  }

  const errorFor = (key: string): string | undefined => {
    if (!serverErrors) return undefined
    const messages = serverErrors[key]
    return messages && messages.length > 0 ? messages[0] : undefined
  }

  // Stable identity (empty deps): defined-in-render components remount the whole
  // subtree each keystroke, so a wrapped input loses focus after one letter.
  const Section = useCallback(
    ({ title, subtitle, tour, children }: { title: string; subtitle?: string; tour?: string; children: React.ReactNode }) => (
      <section data-tour={tour} className="bg-white rounded-lg border border-navy-100 p-4 sm:p-6">
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
    <form onSubmit={handleSubmit(handleFormSubmit)} className={focusCreate ? 'pb-24' : 'space-y-6 pb-24'}>

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

      {focusCreate && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-navy-900">Choose how to work</p>
            <p className="text-xs text-navy-500">Switch layouts without losing what you entered.</p>
          </div>
          <div data-tour="customer-new-layout" role="group" aria-label="Customer form layout" className="inline-flex overflow-hidden rounded-lg border border-navy-200">
            <button type="button" aria-pressed={createLayout === 'tabbed'} onClick={() => setCreateLayout('tabbed')} className={`px-3 py-2 text-sm font-semibold ${createLayout === 'tabbed' ? 'bg-navy-800 text-white' : 'bg-white text-navy-600 hover:bg-navy-50'}`}>Tabbed workspace</button>
            <button type="button" aria-pressed={createLayout === 'canvas'} onClick={() => setCreateLayout('canvas')} className={`border-l border-navy-200 px-3 py-2 text-sm font-semibold ${createLayout === 'canvas' ? 'bg-navy-800 text-white' : 'bg-white text-navy-600 hover:bg-navy-50'}`}>Grouped canvas</button>
          </div>
        </div>
      )}

      {focusCreate && (
        <nav id="customer-create-tabs" data-tour="customer-new-tabs" role="tablist" aria-label="New customer sections" className={`${tabbedCreate ? 'grid' : 'hidden'} mb-4 grid-cols-2 gap-2 rounded-xl border border-navy-100 bg-white p-2 sm:grid-cols-5`}>
          {createTabs.map(({ id, label }) => (
            <button
              key={id}
              id={`customer-create-tab-${id}`}
              data-tour={`customer-new-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`customer-create-panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => goToTab(id)}
              onKeyDown={(event) => handleCreateTabKeyDown(event, id)}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${activeTab === id ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-400' : 'text-navy-600 hover:bg-navy-50'}`}
            >
              {label}
              {id === 'contacts' && <span className="ml-1 text-xs text-navy-500">{reviewContacts.length}</span>}
              {id === 'locations' && <span className="ml-1 text-xs text-navy-500">{reviewLocations.length}</span>}
            </button>
          ))}
        </nav>
      )}

      <div className={tabbedCreate ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]' : ''}>
      <div className={canvasCreate ? 'grid min-w-0 gap-4 xl:grid-cols-2' : 'space-y-6 min-w-0'}>
      <div id={tabbedCreate ? 'customer-create-panel-account' : undefined} role={tabbedCreate ? 'tabpanel' : undefined} aria-labelledby={tabbedCreate ? 'customer-create-tab-account' : undefined} hidden={tabbedCreate && activeTab !== 'account'} className={canvasCreate ? 'xl:col-span-2' : undefined}>

      <Section title="Identity" subtitle="Who is this customer?" tour="customer-identity">
        <div className="space-y-4">
          <div>
            <Label>Customer type</Label>
            <div className="flex gap-3" data-tour="customer-type-picker">
              {(['residential', 'commercial', 'government'] as CustomerType[]).map((t) => (
                <label
                  key={t}
                  data-tour={`customer-type-${t}`}
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
            <div data-tour="customer-business-name">
              <Label>{customerType === 'government' ? 'Agency / organization name *' : 'Business name *'}</Label>
              <Input {...register('business_name')} placeholder={customerType === 'government' ? 'City of Springfield' : 'Acme Services'} />
              <FieldError name="business_name" />
            </div>
          )}
          {customerType === 'residential' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-tour="customer-person-name">
              <div>
                <Label>First name *</Label>
                <Input {...register('first_name')} placeholder="Jordan" />
                <FieldError name="first_name" />
              </div>
              <div>
                <Label>Last name *</Label>
                <Input {...register('last_name')} placeholder="Lee" />
                <FieldError name="last_name" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2" data-tour="customer-flags">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-navy-100" data-tour="customer-account-parent">
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

      </div>
      <div id={tabbedCreate ? 'customer-create-panel-contacts' : undefined} role={tabbedCreate ? 'tabpanel' : undefined} aria-labelledby={tabbedCreate ? 'customer-create-tab-contacts' : undefined} hidden={tabbedCreate && activeTab !== 'contacts'}>

      <Section title="Contacts" subtitle="People to reach at this customer. The main contact gets job notifications. Billing contacts get invoices." tour="customer-contacts">
        <div className="space-y-4">
          {contactFields.map((field, index) => {
            const showAdvanced = watch(`contacts.${index}.showAdvanced`)
            const showMailing = watch(`contacts.${index}.showMailing`)
            return (
              <div key={field.id} className="border border-navy-200 rounded-md p-4 bg-navy-50/30">
                <div className="flex items-start justify-between gap-2 mb-3 pb-3 border-b border-navy-200">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" data-tour="customer-contact-roles">
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
                    <label className="inline-flex items-center gap-2 cursor-pointer" title="Texted when work is sent to the intake number, and their reply of APPROVED authorizes it">
                      <input type="checkbox" {...register(`contacts.${index}.is_intake_approver`)} className="rounded border-navy-300" />
                      <span className="text-navy-700">Approves intake</span>
                    </label>
                  </div>
                  {contactFields.length > 1 && (
                    <button type="button" onClick={() => removeContact(index)} className="text-xs text-danger hover:underline">
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3" data-tour="customer-contact-fields">
                  <div>
                    <Label>First name</Label>
                    <Input {...register(`contacts.${index}.first_name`)} placeholder="Jordan" />
                  </div>
                  <div>
                    <Label>Last name</Label>
                    <Input {...register(`contacts.${index}.last_name`)} placeholder="Lee" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input {...register(`contacts.${index}.email`)} type="email" placeholder="jordan@example.com" />
                  </div>
                  <div>
                    <Label>Email alt</Label>
                    <Input {...register(`contacts.${index}.email_alt`)} type="email" placeholder="alt@example.com" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input {...phoneField(register(`contacts.${index}.phone`))} placeholder="(555) 555-0123" />
                  </div>
                  <div>
                    <Label>Phone alt</Label>
                    <Input {...phoneField(register(`contacts.${index}.phone_alt`))} placeholder="(555) 555-0124" />
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

                <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; setValue(`contacts.${index}.showMailing`, !showMailing); requestAnimationFrame(() => window.scrollTo(0, y)); }} data-tour="customer-contact-mailing" className="text-xs text-navy-500 hover:text-amber-600 inline-flex items-center gap-1 mb-2">
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
                        <Input {...register(`contacts.${index}.mailing_city`)} placeholder="Springfield" />
                      </div>
                      <div>
                        <Label>State</Label>
                        <Input {...register(`contacts.${index}.mailing_state`)} placeholder="ST" maxLength={2} />
                      </div>
                      <div>
                        <Label>Zip</Label>
                        <Input {...register(`contacts.${index}.mailing_postal_code`)} placeholder="12345" />
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-navy-700">
                      <input type="checkbox" {...register(`contacts.${index}.bill_to_service_address`)} className="rounded border-navy-300" />
                      <span>Show service location address on invoice instead of this</span>
                    </label>
                  </div>
                )}

                <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; setValue(`contacts.${index}.showAdvanced`, !showAdvanced); requestAnimationFrame(() => window.scrollTo(0, y)); }} data-tour="customer-contact-advanced" className="text-xs text-navy-500 hover:text-amber-600 inline-flex items-center gap-1">
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

          <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; appendContact(emptyContact(false)); requestAnimationFrame(() => window.scrollTo(0, y)); }} data-tour="customer-add-contact-row" className="w-full py-3 border-2 border-dashed border-navy-200 rounded-md text-sm text-navy-500 hover:border-amber-400 hover:text-amber-600 transition-colors">
            + Add another contact
          </button>
        </div>
      </Section>

      </div>
      <div id={tabbedCreate ? 'customer-create-panel-locations' : undefined} role={tabbedCreate ? 'tabpanel' : undefined} aria-labelledby={tabbedCreate ? 'customer-create-tab-locations' : undefined} hidden={tabbedCreate && activeTab !== 'locations'}>

      <Section title="Service Locations" subtitle="Physical addresses where techs are dispatched. The primary location is the default for new jobs." tour="customer-locations">
        <div className="space-y-4">
          {locationFields.map((field, index) => {
            const isGated = watch(`service_locations.${index}.gated_property`)
            const showLatLng = watch(`service_locations.${index}.showLatLng`)
            return (
              <div key={field.id} className="border border-navy-200 rounded-md p-4 bg-navy-50/30">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-navy-200">
                  <div className="flex items-center gap-4 text-sm" data-tour="customer-location-flags">
                    <span className="font-semibold text-navy-700">Location {index + 1}</span>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register(`service_locations.${index}.is_primary`)} className="rounded border-navy-300" />
                      <span className="text-navy-700">Primary</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer" data-tour="customer-location-gated">
                      <input type="checkbox" {...register(`service_locations.${index}.gated_property`)} className="rounded border-navy-300" />
                      <span className="text-navy-700">Gated property</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Only for a location that has been saved: a row just
                        added has no id yet, and an agreement cannot point
                        at a property that does not exist. */}
                    {!profileOnly && watch(`service_locations.${index}.id`) && initialData?.id && (
                      <a
                        data-tour="customer-location-agreement"
                        href={`/maintenance-contracts/new?customer=${initialData.id}&location=${watch(`service_locations.${index}.id`)}`}
                        className="text-xs font-semibold text-amber-700 hover:underline"
                      >
                        Service agreement for this location
                      </a>
                    )}
                    {locationFields.length > 1 && (
                      <button type="button" onClick={() => removeLocation(index)} className="text-xs text-danger hover:underline">Remove</button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Nickname (e.g. &ldquo;Main warehouse&rdquo;, &ldquo;North store&rdquo;)</Label>
                    <Input {...register(`service_locations.${index}.nickname`)} placeholder="Optional label" />
                  </div>
                  <div data-tour="customer-location-address">
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
                      <Input {...register(`service_locations.${index}.city`)} placeholder="Springfield" />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input {...register(`service_locations.${index}.state`)} placeholder="ST" maxLength={2} />
                    </div>
                    <div>
                      <Label>Zip</Label>
                      <Input {...register(`service_locations.${index}.postal_code`)} placeholder="12345" />
                    </div>
                  </div>

                  {isGated && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-3" data-tour="customer-location-gate">
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

                  <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; setValue(`service_locations.${index}.showLatLng`, !showLatLng); requestAnimationFrame(() => window.scrollTo(0, y)); }} data-tour="customer-location-latlng" className="text-xs text-navy-500 hover:text-amber-600 inline-flex items-center gap-1">
                    {showLatLng ? '▼' : '▶'} {showLatLng ? 'Hide' : 'Show'} lat/lng coords
                  </button>
                  {showLatLng && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input {...register(`service_locations.${index}.latitude`)} placeholder="Latitude" />
                      <Input {...register(`service_locations.${index}.longitude`)} placeholder="Longitude" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <button type="button" onClick={(e) => { e.preventDefault(); const y = window.scrollY; appendLocation(emptyLocation(false)); requestAnimationFrame(() => window.scrollTo(0, y)); }} data-tour="customer-add-location-row" className="w-full py-3 border-2 border-dashed border-navy-200 rounded-md text-sm text-navy-500 hover:border-amber-400 hover:text-amber-600 transition-colors">
            + Add another location
          </button>
        </div>
      </Section>

      </div>
      <div id={tabbedCreate ? 'customer-create-panel-billing' : undefined} role={tabbedCreate ? 'tabpanel' : undefined} aria-labelledby={tabbedCreate ? 'customer-create-tab-billing' : undefined} hidden={tabbedCreate && activeTab !== 'billing'} className={canvasCreate ? 'grid gap-4 xl:col-span-2 xl:grid-cols-2' : 'space-y-6'}>

      <Section title="Notes & Tags" subtitle="Internal notes are staff-only. Public notes appear on invoices and work orders." tour="customer-notes-tags">
        <div className="space-y-4">
          <div className="space-y-4" data-tour="customer-notes">
          <div>
            <Label>Internal notes (staff only)</Label>
            <textarea {...register('internal_notes')} rows={3} className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Anything important about this customer that customers shouldn't see..." />
          </div>
          <div>
            <Label>Public notes (visible on invoices)</Label>
            <textarea {...register('public_notes')} rows={2} className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="e.g. Thank you for your continued business!" />
          </div>
          </div>
          <div data-tour="customer-tags">
            <Label>Tags</Label>
            {/* From the Tags library; one the library switched off stays
                on a customer that has it until it's removed here. */}
            <div className="flex flex-wrap gap-2">
              {[...libraryTags.map((t) => t.name), ...watchedTags.filter((name) => !libraryTags.some((t) => t.name === name))].map((tag) => {
                const selected = watchedTags.includes(tag)
                const inLibrary = libraryTags.some((t) => t.name === tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={selected}
                    title={inLibrary ? undefined : 'No longer in your Tags library. Click to remove it from this customer.'}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'text-white' : 'bg-navy-50 text-navy-600 hover:bg-navy-100'}`}
                    style={selected ? { background: tagColor(tag) } : undefined}
                  >
                    {!selected && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: tagColor(tag) }} />}
                    {tag}
                  </button>
                )
              })}
              {customerTags.isSuccess && libraryTags.length === 0 && watchedTags.length === 0 && (
                <span className="text-xs text-navy-500">No tags in your library yet.</span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-navy-500">
              Add, rename or recolor tags under <Link to="/tool-shed/tags" className="font-medium text-amber-700 hover:underline">Tool Shed → Tags</Link>.
            </p>
          </div>
        </div>
      </Section>

      {showCustomFields && (
        <CustomFieldsBlock
          customerId={initialData?.id ?? null}
          values={customValues}
          onChange={setCustomValues}
        />
      )}

      <Section title="Tax & Billing" subtitle="Taxable status, payment defaults." tour="customer-billing">
        <div className="space-y-4">
          <label className="inline-flex items-center gap-2 text-sm text-navy-700 cursor-pointer" data-tour="customer-taxable">
            <input type="checkbox" {...register('taxable')} className="rounded border-navy-300" />
            <span>Taxable</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div data-tour="customer-tax-class">
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
            <div data-tour="customer-payment-terms">
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
            {customerType !== 'residential' && (
              <div data-tour="customer-statement-day" className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <label htmlFor="statement-send-day" className="mb-1 block text-sm font-medium text-slate-700">Statement send day (every month)</label>
                <select id="statement-send-day" {...register('statement_day')} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                  <option value="">No monthly schedule</option>
                  {Array.from({ length: 31 }, (_, index) => index + 1).map(day => (
                    <option key={day} value={day}>Day {day} of every month</option>
                  ))}
                </select>
                <FieldError name="statement_preferences.day" />
                {onOpenTemplates ? (
                  <button type="button" className="mt-2 text-sm font-semibold text-amber-800 underline underline-offset-2" onClick={() => {
                    if (!isDirty || window.confirm('You have unsaved customer changes. Leave without saving and open Templates?')) onOpenTemplates()
                  }}>Choose this customer's statement template →</button>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">Save this customer first, then open Templates to choose a statement template.</p>
                )}
                <p className="mt-2 text-xs text-slate-600">Choose this customer's monthly send day. Days 29–31 use month-end in shorter months. Saving a day does not enable delivery or change payment due dates.</p>
              </div>
            )}
          </div>

          {/* Monthly statement pack (commercial / government only). */}
          {customerType !== 'residential' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3" data-tour="customer-statement-pack">
              <h3 className="font-semibold text-navy-900">Monthly statement pack</h3>
              <p className="text-sm text-slate-500">Save your schedule here, then use Preview statement to enable or pause monthly delivery. Pause delivery before editing an active schedule. Packs include all unpaid invoices, including overdue balances, without changing their NET due dates.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Send to</Label><Input {...register('statement_recipients')} placeholder="billing@example.com, accounts@example.com" /><FieldError name="statement_preferences.recipients" /></div>
              </div>
              <div><Label>Statement email subject</Label><Input {...register('statement_subject')} maxLength={200} /><FieldError name="statement_preferences.subject" /></div>
              <p className="text-xs text-slate-500">Days 29–31 use the last day in shorter months. Select this customer's statement template before enabling delivery. System-wide sending must also be enabled.</p>
            </div>
          )}
          <div data-tour="customer-invoice-subject" className="rounded-xl border border-slate-200 p-4 space-y-2">
            <Label>Invoice email subject for this customer</Label>
            <input type="hidden" {...register('invoice_email_subject')} />
            <InvoiceSubjectField
              value={watch('invoice_email_subject') ?? ''}
              onChange={(v) => setValuePreservingScroll('invoice_email_subject', v, { shouldDirty: true })}
              customerName={watch('business_name') || [watch('first_name'), watch('last_name')].filter(Boolean).join(' ') || undefined}
            />
            <FieldError name="invoice_email_subject" />
          </div>
          {/* Hidden — kept so legacy 'tax_item' on existing customers
              doesn't get nulled silently on save. Pure passthrough. */}
          <input type="hidden" {...register('tax_item')} />

          {/* Tax exempt certificate. Only renderable for an existing
              customer (need an id to upload against). For new
              customers the field is suppressed with a hint. */}
          <div data-tour="customer-tax-exempt">
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
        </div>
      </Section>

      <Section title="Advanced" subtitle="Optional. Most customers don't need anything here." tour="customer-advanced">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Industry</Label><Input {...register('industry')} placeholder="Property management" /></div>
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

      </div>
      {tabbedCreate && (
        <section id="customer-create-panel-review" data-tour="customer-new-review" role="tabpanel" aria-labelledby="customer-create-tab-review" hidden={activeTab !== 'review'} className="rounded-xl border border-navy-100 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-navy-900">Review before creating</h2>
          <p className="mt-1 text-sm text-navy-500">Check the account at a glance. Choose a tab above to change anything.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-navy-50 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Account</p><button type="button" onClick={() => goToTab('account')} className="text-xs font-semibold text-amber-700 hover:underline">Edit</button></div>
              <p className="mt-1 text-sm font-semibold text-navy-900">{previewName}</p>
              <p className="text-xs capitalize text-navy-600">{customerType} · {watch('active') ? 'Active' : 'Inactive'}</p>
              <p className="mt-2 text-xs text-navy-600">{watch('vip') ? 'VIP · ' : ''}Account number assigned on save</p>
            </div>
            <div className="rounded-lg bg-navy-50 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Contacts</p><button type="button" onClick={() => goToTab('contacts')} className="text-xs font-semibold text-amber-700 hover:underline">Edit</button></div>
              <p className="mt-1 text-sm font-semibold text-navy-900">{reviewContacts.length} {reviewContacts.length === 1 ? 'contact' : 'contacts'} to save</p>
              <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-navy-600">
                {reviewContacts.map((contact, index) => <li key={contact.id ?? index} className="border-t border-navy-100 pt-2 first:border-0 first:pt-0">
                  <span className="font-medium text-navy-900">{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || contact.phone || `Contact ${index + 1}`}</span>
                  {(contact.email || contact.phone) && <span className="block break-all">{[contact.email, contact.phone].filter(Boolean).join(' · ')}</span>}
                  <span className="block">{[contact.is_main_contact && 'Main', contact.is_billing_contact && 'Billing', contact.is_service_contact && 'Service', contact.is_intake_contact && 'Intake', contact.is_intake_approver && 'Intake approver'].filter(Boolean).join(' · ') || 'No contact role selected'}</span>
                </li>)}
                {reviewContacts.length === 0 && <li>No contacts entered.</li>}
              </ul>
            </div>
            <div className="rounded-lg bg-navy-50 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Service locations</p><button type="button" onClick={() => goToTab('locations')} className="text-xs font-semibold text-amber-700 hover:underline">Edit</button></div>
              <p className="mt-1 text-sm font-semibold text-navy-900">{reviewLocations.length} {reviewLocations.length === 1 ? 'location' : 'locations'} to save</p>
              <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-navy-600">
                {reviewLocations.map((location, index) => <li key={location.id ?? index} className="border-t border-navy-100 pt-2 first:border-0 first:pt-0">
                  <span className="font-medium text-navy-900">{location.nickname || `Location ${index + 1}`}{location.is_primary ? ' · Primary' : ''}</span>
                  <span className="block">{[location.street_address, location.apt_unit, location.city, location.state, location.postal_code].filter(Boolean).join(', ') || 'Address not entered'}</span>
                </li>)}
                {reviewLocations.length === 0 && <li>No service locations entered.</li>}
              </ul>
            </div>
            <div className="rounded-lg bg-navy-50 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Billing</p><button type="button" onClick={() => goToTab('billing')} className="text-xs font-semibold text-amber-700 hover:underline">Edit</button></div>
              <p className="mt-1 text-sm font-semibold text-navy-900">{watch('taxable') ? 'Taxable' : 'Not marked taxable'} · {watch('default_currency') || 'USD'}</p>
              <p className="mt-2 text-xs text-navy-600">Payment terms: {selectedPaymentTerm?.name ?? (paymentTermId ? 'Selected term' : 'Tenant default (COD if none)')}</p>
              {watch('payment_method') && <p className="text-xs text-navy-600">Payment method: {watch('payment_method')}</p>}
              {customerType !== 'residential' && <p className="text-xs text-navy-600">Monthly statement: {watch('statement_day') ? `Day ${watch('statement_day')} (delivery enabled separately)` : 'Not scheduled'}</p>}
            </div>
          </div>
          <p className="mt-5 text-sm text-navy-600">This review shows the key details. Notes, tags, custom fields, and advanced settings entered in the tabs are also saved.</p>
        </section>
      )}
      </div>

      {tabbedCreate && (
        <aside data-tour="customer-new-preview" aria-label="Customer account preview" className="hidden rounded-xl border border-navy-100 bg-white p-4 xl:sticky xl:top-4 xl:block">
          <h2 className="text-sm font-semibold text-navy-900">Account preview</h2>
          <p className="mt-1 text-xs text-navy-500">Your entries stay in place as you move through tabs.</p>
          <p className="mt-5 break-words text-lg font-semibold text-navy-900">{previewName}</p>
          <p className="text-xs capitalize text-navy-500">{customerType} · {watch('active') ? 'Active' : 'Inactive'}</p>
          <dl className="mt-5 divide-y divide-navy-100 text-sm">
            <div className="py-3"><dt className="text-xs font-medium text-navy-500">Account number</dt><dd className="mt-1 text-navy-800">Assigned on save</dd></div>
            <div className="py-3"><dt className="text-xs font-medium text-navy-500">Contacts</dt><dd className="mt-1 text-navy-800">{reviewContacts.length} {reviewContacts.length === 1 ? 'contact' : 'contacts'} entered</dd></div>
            <div className="py-3"><dt className="text-xs font-medium text-navy-500">Service locations</dt><dd className="mt-1 text-navy-800">{reviewLocations.length} {reviewLocations.length === 1 ? 'location' : 'locations'} entered</dd></div>
            <div className="py-3"><dt className="text-xs font-medium text-navy-500">Billing</dt><dd className="mt-1 text-navy-800">{watch('taxable') ? 'Taxable' : 'Not marked taxable'}</dd></div>
          </dl>
        </aside>
      )}
      </div>

      <div data-tour="customer-save" className="fixed bottom-0 left-0 right-0 bg-white border-t border-navy-100 px-3 sm:px-6 py-3 sm:py-4 z-10">
        <div className={`${focusCreate ? 'max-w-[1760px]' : 'max-w-3xl'} mx-auto flex items-center justify-end gap-2 sm:gap-3`}>
          <Button type="button" variant="secondary" onClick={onCancel} data-tour="customer-cancel">Cancel</Button>
          {tabbedCreate && activeTab !== 'account' && (
            <Button type="button" variant="secondary" onClick={() => goToTab(createTabs[createTabs.findIndex((tab) => tab.id === activeTab) - 1]?.id ?? 'account')}>
              Back
            </Button>
          )}
          {tabbedCreate && activeTab !== 'review' ? (
            <Button type="button" onClick={() => goToTab(createTabs[createTabs.findIndex((tab) => tab.id === activeTab) + 1]?.id ?? 'review')}>
              {activeTab === 'billing' ? 'Review & create' : `Next: ${createTabs[createTabs.findIndex((tab) => tab.id === activeTab) + 1]?.label ?? 'Review'}`}
            </Button>
          ) : (
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Saving...' : submitLabel}
            </Button>
          )}
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
    <div data-tour="customer-territory">
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
  // When value is set on edit, fetch the saved parent once so the picker's
  // collapsed "selected" state has a name to show.
  const [resolved, setResolved] = useState<Customer | null>(null)
  const [cleared, setCleared] = useState(false)
  const saved = useCustomer(value && !resolved && !cleared ? value : undefined)
  const shown = resolved ?? (!cleared && value && saved.data?.id === value ? saved.data : null)
  return (
    <CustomerPicker
      value={shown}
      onChange={(c) => {
        setResolved(c)
        setCleared(!c)
        onChange(c?.id ?? null)
      }}
      placeholder={value ? 'Reset to search…' : 'Start typing a parent customer…'}
    />
  )
}

/**
 * Customer custom fields (Tool Shed › Custom Fields › Customer). Renders
 * nothing when the tenant has no active customer fields.
 */
function CustomFieldsBlock({
  customerId,
  values,
  onChange,
}: {
  customerId: string | null
  values: CustomValues
  onChange: (next: CustomValues) => void
}) {
  return (
    <div data-tour="customer-custom-fields" className="empty:hidden">
      <CustomFieldsSectionCard customerId={customerId} values={values} onChange={onChange} />
    </div>
  )
}

function CustomFieldsSectionCard({
  customerId,
  values,
  onChange,
}: {
  customerId: string | null
  values: CustomValues
  onChange: (next: CustomValues) => void
}) {
  const { data } = useQuery({
    queryKey: ['custom-fields', 'customer', 'active', []],
    queryFn: () => apiRequest<{ data: unknown[] }>('/v1/custom-fields?entity_type=customer&active=true'),
    staleTime: 0,
  })
  if (!data || data.data.length === 0) return null
  return (
    <section className="bg-white rounded-lg border border-navy-100 p-4 sm:p-6">
      <div className="mb-4 sm:mb-5">
        <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">Custom fields</h2>
        <p className="text-xs text-navy-500 mt-1">Your company's own fields for customers. Each one is also a {'{{custom.key}}'} merge tag.</p>
      </div>
      <CustomFieldsSection entityType="customer" entityId={customerId} values={values} onChange={onChange} />
    </section>
  )
}
