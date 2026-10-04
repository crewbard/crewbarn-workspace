import { useEffect, useState } from 'react'
import { EquipmentSharingCard } from '@/components/assets/EquipmentSharingCard'
import { formatPhone } from '@/lib/comms'
import { CONNECT_URL } from '@/lib/workspaceScope'
import { Avatar } from '@/components/Avatar'
import { CustomerAvatarPicker } from '@/components/CustomerAvatarPicker'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { customerKeys, useCustomer, useCustomers, useDeleteCustomer, useMergeCustomer, useUpdateCustomer } from '@/hooks/useCustomers'
import { useAssets } from '@/hooks/useAssets'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { useEstimates } from '@/hooks/useEstimates'
import { Button } from '@/components/ui/Button'
import { CustomerForm } from '@/components/CustomerForm'
import { CustomerStatementButton } from '@/components/CustomerStatementButton'
import { LocationPickerModal } from '@/components/LocationPickerModal'
import { LocationMapPlaceholder } from '@/components/LocationMapPlaceholder'
import { ReceivePaymentModal } from '@/components/ReceivePaymentModal'
import { ApplyCreditModal } from '@/components/ApplyCreditModal'
import { AttachmentOverlay } from '@/components/ui/AttachmentOverlay'
import { ContactEditorModal } from '@/components/ContactEditorModal'
import { useDeleteCustomerContact } from '@/hooks/useCustomerContacts'
import {
  useCustomerDocuments,
  useUploadCustomerDocument,
  useDeleteCustomerDocument,
} from '@/hooks/useCustomerDocuments'
import {
  useCreateCustomerSecureNote,
  useCustomerSecureFileAudit,
  useCustomerSecureFiles,
  useCustomerSecureFileStatus,
  useDeleteCustomerSecureFile,
  useRecoverSecureFileKey,
  useRequestSecureFileAccess,
  useRotateSecureFileRecoveryKey,
  useSetupSecureFiles,
  useUpdateCustomerSecureFile,
  useUploadCustomerSecureFile,
  useVerifySecureFileAccess,
} from '@/hooks/useCustomerSecureFiles'
import {
  useInvoices,
  useSendInvoice,
  useMarkInvoicePaid,
  useDeleteInvoice,
  useCancelInvoice,
} from '@/hooks/useInvoices'
import { InvoiceCreatorModal } from '@/components/InvoiceCreatorModal'
import { PostUploadModal } from '@/components/documents/PostUploadModal'
import { ExtractedDocumentEditor } from '@/components/documents/ExtractedDocumentEditor'
import { useExtractedDocsForSources } from '@/hooks/useExtractedDocuments'
import type { CustomerContact } from '@/types/customer'
import type { Invoice, InvoiceStatus } from '@/types/invoice'
import { NewAssetWizardModal } from '@/components/NewAssetWizardModal'
import { CustomerPortalSection } from '@/components/customers/CustomerPortalSection'
import { CustomerFieldPolicySection } from '@/components/customers/CustomerFieldPolicySection'
import { CustomerMessagesTab } from '@/components/comms/CustomerMessagesTab'
import { ClickToCallButton } from '@/components/comms/ClickToCallButton'
import { TasksPanel } from '@/components/tasks/TasksPanel'
import { EntityActivityPanel } from '@/components/EntityActivityPanel'
import { MessagesDrawer } from '@/components/comms/MessagesDrawer'
import { usePermissions } from '@/hooks/usePermissions'
import type { Customer, CustomerInput } from '@/types/customer'
import type { CustomerContactInput, CustomerServiceLocationInput } from '@/types/customer'
import type { Asset } from '@/types/asset'
import { ApiError, apiRequest, isDeleteCancelled } from '@/lib/api'
import { fetchCustomerSecureFileBlob, type CustomerSecureFile } from '@/lib/customerSecureFiles'
import {
  createCustomerContact,
  deleteCustomerContact,
  updateCustomerContact,
} from '@/lib/customerContacts'
import {
  createCustomerServiceLocation,
  deleteCustomerServiceLocation,
  updateCustomerServiceLocation,
} from '@/lib/customerServiceLocations'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'

type TabKey = 'overview' | 'edit' | 'contacts' | 'locations' | 'assets' | 'jobs' | 'estimates' | 'invoices' | 'tasks' | 'messages' | 'documents' | 'secure-files' | 'templates' | 'activity'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'edit', label: 'Edit Info' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'locations', label: 'Locations' },
  { key: 'assets', label: 'Assets' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'estimates', label: 'Estimates' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'messages', label: 'Messages' },
  { key: 'documents', label: 'Documents' },
  { key: 'secure-files', label: 'Secure Files' },
  { key: 'templates', label: 'Templates' },
  { key: 'activity', label: 'Activity' },
]

type TabGroupKey = 'overview' | 'details' | 'work' | 'files' | 'log'

const TAB_GROUPS: { key: TabGroupKey; label: string; count?: number; tabs: TabKey[] }[] = [
  { key: 'overview', label: 'Overview', tabs: ['overview'] },
  { key: 'details', label: 'Details', count: 3, tabs: ['edit', 'contacts', 'locations'] },
  { key: 'work', label: 'Records', count: 5, tabs: ['jobs', 'estimates', 'invoices', 'assets', 'tasks'] },
  { key: 'files', label: 'Files', count: 3, tabs: ['documents', 'secure-files', 'templates'] },
  { key: 'log', label: 'Log', tabs: ['messages', 'activity'] },
]

type ContactInputWithId = CustomerContactInput & { id?: string }

// Same tab keys/components/permissions; Easy changes only their grouping.
const EASY_CUSTOMER_GROUPS: { key: string; label: string; count?: number; tabs: TabKey[] }[] = [
  { key: 'overview', label: 'Overview', tabs: ['overview'] },
  { key: 'work', label: 'Jobs & equipment', tabs: ['jobs', 'tasks', 'assets'] },
  { key: 'money', label: 'Estimates & invoices', tabs: ['invoices', 'estimates'] },
  { key: 'people', label: 'People & places', tabs: ['contacts', 'locations'] },
  { key: 'files', label: 'Files', tabs: ['documents', 'secure-files', 'templates'] },
  { key: 'more', label: 'More', tabs: ['edit', 'messages', 'activity'] },
]
type LocationInputWithId = CustomerServiceLocationInput & { id?: string }
type SecureFileViewerState = {
  file: CustomerSecureFile
  blobUrl: string | null
  body: string | null
  mimeType: string | null
  loading: boolean
  error: string | null
}

function withoutId<T extends { id?: string }>(input: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = input
  return rest
}

async function syncCustomerChildren(
  customer: Customer,
  nextContacts: CustomerContactInput[],
  nextLocations: CustomerServiceLocationInput[],
): Promise<void> {
  const contacts = nextContacts as ContactInputWithId[]
  const locations = nextLocations as LocationInputWithId[]

  const nextContactIds = new Set(contacts.map((contact) => contact.id).filter(Boolean))
  const removedContacts = (customer.contacts ?? []).filter((contact) => !nextContactIds.has(contact.id))
  for (const contact of removedContacts) {
    await deleteCustomerContact(customer.id, contact.id)
  }
  for (const contact of contacts) {
    if (contact.id) {
      await updateCustomerContact(customer.id, contact.id, withoutId(contact))
    } else {
      await createCustomerContact(customer.id, withoutId(contact))
    }
  }

  const nextLocationIds = new Set(locations.map((location) => location.id).filter(Boolean))
  const removedLocations = (customer.service_locations ?? []).filter((location) => !nextLocationIds.has(location.id))
  for (const location of removedLocations) {
    await deleteCustomerServiceLocation(customer.id, location.id)
  }
  for (const location of locations) {
    if (location.id) {
      await updateCustomerServiceLocation(customer.id, location.id, withoutId(location))
    } else {
      await createCustomerServiceLocation(customer.id, withoutId(location))
    }
  }
}

export function CustomerDetailPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const tabGroups = easy ? EASY_CUSTOMER_GROUPS : TAB_GROUPS
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { has } = usePermissions()
  const { data: customer, isLoading, isError, error } = useCustomer(id)
  const queryClient = useQueryClient()
  const deleteCustomer = useDeleteCustomer()
  const updateCustomer = useUpdateCustomer()
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [editServerErrors, setEditServerErrors] = useState<Record<string, string[]>>()

  const activeTab = (searchParams.get('tab') as TabKey) || 'overview'
  const setTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next)
  }

  const handleDelete = async () => {
    if (!customer) return
    // Confirmation handled by the global delete modal (password + reason).
    try {
      await deleteCustomer.mutateAsync(customer.id)
      navigate('/customers', { replace: true })
    } catch (err) {
      if (isDeleteCancelled(err)) return
      // Surface real reasons — notably the "has invoices/payments" block.
      alert(err instanceof ApiError ? err.message : 'Failed to delete customer.')
    }
  }

  const handleEditSubmit = async (input: CustomerInput) => {
    if (!customer) return
    setEditServerErrors(undefined)
    try {
      const { contacts, service_locations, ...customerInput } = input
      await updateCustomer.mutateAsync({ id: customer.id, input: customerInput })
      await syncCustomerChildren(customer, contacts ?? [], service_locations ?? [])
      await queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: customerKeys.detail(customer.id) })
      await queryClient.refetchQueries({ queryKey: customerKeys.detail(customer.id) })
      setTab('overview')
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const details = err.details as { [field: string]: string[] } | undefined
        if (details) setEditServerErrors(details)
      } else {
        console.error('Update failed:', err)
        alert('Failed to update customer. Check console for details.')
      }
    }
  }

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Slice 13c polish: removed local TopBar — duplicated the global TopBar
  // that AppLayout already renders above every authenticated page.

  if (isLoading) {
    return (
      <main className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 text-navy-500 text-sm">
        Loading customer...
      </main>
    )
  }

  if (isError || !customer) {
    return (
      <main className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-danger">
          Failed to load customer: {(error as Error)?.message ?? 'Unknown error'}
        </div>
        <div className="mt-4">
          <Link to="/customers" className="text-amber-600 hover:underline text-sm">
            ← Back to Customers
          </Link>
        </div>
      </main>
    )
  }

  const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
    <section className="bg-white rounded-lg border border-navy-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <div className="text-xs text-navy-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm text-navy-800">{value || <span className="text-navy-400">—</span>}</div>
    </div>
  )

  // ===========================================================================
  // TAB CONTENT RENDERERS
  // ===========================================================================

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.75fr)] items-start">
        <div className="space-y-5">
          <Section title="Identity" action={<button onClick={() => setTab('edit')} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Edit info</button>}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
              {customer.customer_type === 'commercial' ? (
                <Field label="Business name" value={customer.business_name} />
              ) : (
                <>
                  <Field label="First name" value={customer.first_name} />
                  <Field label="Last name" value={customer.last_name} />
                </>
              )}
              <Field label="Type" value={customer.customer_type} />
              <Field label="Created" value={formatDate(customer.created_at)} />
              <Field label="Last contact" value={formatDate(customer.last_contact_at)} />
              <Field label="Industry" value={customer.industry} />
              <Field label="Referral source" value={customer.referral_source} />
              <Field label="Birthday" value={formatDate(customer.birthday)} />
              <Field label="Anniversary" value={formatDate(customer.anniversary)} />
            </div>
            <div className="mt-5 inline-flex items-center rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500">
              + Add industry, referral source, key dates
            </div>
          </Section>

          <CustomerPortalSection
            customerId={customer.id}
            customerEmail={customer.email ?? null}
          />
        </div>

        <CustomerFieldPolicySection customer={customer} />
      </div>

      <Section
        title={`Contacts (${customer.contacts?.length ?? 0})`}
        action={
          <button onClick={() => setTab('contacts')} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
            Manage →
          </button>
        }
      >
        {(!customer.contacts || customer.contacts.length === 0) ? (
          <p className="text-sm text-navy-400">No contacts yet.</p>
        ) : (
          <div className="space-y-3">
            {customer.contacts.map((c) => (
              <div key={c.id} className="border border-navy-200 rounded-md p-4 bg-navy-50/30">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy-800">{c.full_name || '(no name)'}</span>
                    {c.is_main_contact && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-500 text-white font-semibold">MAIN</span>
                    )}
                    {c.is_billing_contact && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">BILLING</span>
                    )}
                    {c.is_service_contact && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-sky-50 text-sky-700 border border-sky-200">SERVICE</span>
                    )}
                    {c.is_intake_contact && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-violet-50 text-violet-700 border border-violet-200" title="Intake calls/texts from this number bill this account">INTAKE</span>
                    )}
                    {c.is_managed_by_portal && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
                        title="Name, email, and phone here are kept in sync with the customer's portal profile."
                      >
                        PORTAL-SYNCED
                      </span>
                    )}
                  </div>
                  {c.job_title && <span className="text-xs text-navy-500">{c.job_title}{c.department ? ` · ${c.department}` : ''}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {c.email && <div><span className="text-navy-500 text-xs">Email:</span> <a href={`mailto:${c.email}`} className="text-amber-600 hover:underline">{c.email}</a></div>}
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <span>
                        <span className="text-navy-500 text-xs">Phone:</span>{' '}
                        <span className="text-navy-700 font-mono">{c.phone}</span>
                      </span>
                      <ClickToCallButton phone={c.phone} customerId={customer.id} />
                    </div>
                  )}
                </div>
                {c.notes && <div className="mt-2 text-sm text-navy-600 italic">{c.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`Service Locations (${customer.service_locations?.length ?? 0})`}
        action={
          <button onClick={() => setTab('locations')} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
            Manage →
          </button>
        }
      >
        {(!customer.service_locations || customer.service_locations.length === 0) ? (
          <p className="text-sm text-navy-400">No service locations yet.</p>
        ) : (
          <div className="space-y-3">
            {customer.service_locations.map((loc) => (
              <div key={loc.id} className="border border-navy-200 rounded-md p-4 bg-navy-50/30">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy-800">{loc.nickname || loc.address.formatted}</span>
                    {loc.is_primary && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-500 text-white font-semibold">PRIMARY</span>
                    )}
                    {loc.gated_property && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">GATED</span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-navy-700 mb-2">{loc.address.formatted}</div>
                {loc.gated_property && loc.gate_code && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                    <div className="text-xs text-navy-600 mb-1">Gate code</div>
                    <div className="font-mono text-sm text-navy-800">{loc.gate_code}</div>
                    {loc.entry_notes && <div className="text-xs text-navy-600 mt-1 italic">{loc.entry_notes}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {(customer.internal_notes || customer.public_notes) && (
        <Section title="Notes">
          <div className="space-y-3">
            {customer.internal_notes && (
              <div>
                <div className="text-xs text-navy-500 uppercase tracking-wider mb-1">Internal (staff only)</div>
                <div className="text-sm text-navy-800 whitespace-pre-wrap bg-navy-50/50 p-3 rounded border border-navy-100">{customer.internal_notes}</div>
              </div>
            )}
            {customer.public_notes && (
              <div>
                <div className="text-xs text-navy-500 uppercase tracking-wider mb-1">Public (visible on invoices)</div>
                <div className="text-sm text-navy-800 whitespace-pre-wrap bg-amber-50/50 p-3 rounded border border-amber-100">{customer.public_notes}</div>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title="Tax & Billing">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Taxable" value={customer.taxable ? 'Yes' : 'No'} />
          <Field label="Tax item / rate" value={customer.tax_item} />
          <Field label="Tax ID" value={customer.tax_id} />
          <Field label="Payment method" value={customer.payment_method} />
          <Field label="Currency" value={customer.default_currency} />
        </div>
      </Section>
    </div>
  )

  const renderEdit = () => (
    <CustomerForm
      onSubmit={handleEditSubmit}
      onCancel={() => setTab('overview')}
      submitLabel="Save changes"
      serverErrors={editServerErrors}
      initialData={customer}
      mode="edit"
      onOpenTemplates={() => setTab('templates')}
    />
  )

  const renderContacts = () => (
    <CustomerContactsTab customer={customer} />
  )

  const renderLocations = () => (
    <CustomerLocationsTab customer={customer} />
  )

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">

        <div>
          <Link to="/customers" className="text-sm font-medium text-amber-700 hover:text-amber-800 inline-flex items-center gap-1">
            ← Back to Customers
          </Link>
        </div>

        <div className={easy ? 'rounded-2xl border border-emerald-900 bg-emerald-950 p-5 shadow-sm sm:p-7' : 'bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-7'}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <CustomerAvatarPicker customer={customer} size={56} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight break-words ${easy ? 'text-white' : 'text-slate-950'}`}>{customer.display_name}</h1>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 capitalize">{customer.customer_type}</span>
                    {customer.vip && <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">VIP</span>}
                    {!customer.active && <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">Inactive</span>}
                  </div>
                  <div className={`mt-1 font-mono text-sm ${easy ? 'text-emerald-200' : 'text-slate-600'}`}>Account #{customer.account_number}</div>
                  {customer.tags && customer.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {customer.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{tag}</span>)}
                    </div>
                  )}
                  {customer.service_agreement && <div className={`mt-2 text-xs font-medium ${easy ? 'text-emerald-100' : 'text-slate-500'}`}>Service agreement customer</div>}
                </div>
              </div>
              <div className="relative flex flex-wrap items-center gap-2 sm:shrink-0">
                <button type="button" onClick={() => setMessagesOpen(true)} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap" title="View and send customer messages">
                  💬 Messages
                </button>
                <Link to={`/jobs/new?customer_id=${customer.id}`} className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 whitespace-nowrap">
                  + New job
                </Link>
                <button type="button" onClick={() => setActionsOpen((open) => !open)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-700 hover:bg-slate-50" aria-label="More customer actions" aria-expanded={actionsOpen}>
                  ...
                </button>
                {actionsOpen && (
                  <div className="absolute right-0 top-12 z-20 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    <button type="button" onClick={() => { setActionsOpen(false); setMergeOpen(true) }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">Merge duplicate</button>
                    <button type="button" onClick={() => { setActionsOpen(false); handleDelete() }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50">Delete customer</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <CustomerRevenueStats customerId={customer.id} customer={customer} lastContact={formatDate(customer.last_contact_at)} />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div role="group" aria-label="Customer sections" className={easy ? 'grid grid-cols-2 gap-2 border-b border-slate-200 p-3 sm:grid-cols-3 xl:grid-cols-6' : 'flex overflow-x-auto border-b border-slate-200'}>
            {tabGroups.map((group) => {
              const isActive = group.tabs.includes(activeTab)
              return (
                <button key={group.key} type="button" aria-pressed={isActive} onClick={() => setTab(group.tabs[0])} className={easy ? `rounded-xl border px-3 py-3 text-left text-sm font-semibold ${isActive ? 'border-emerald-900 bg-emerald-950 text-white' : 'border-slate-200 text-slate-600 hover:bg-emerald-50'}` : `whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${isActive ? 'border-amber-500 bg-amber-50/70 text-slate-950' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
                  {group.label}{group.count ? <span className="ml-2 text-xs text-slate-400">{group.count}</span> : null}
                  {easy && group.tabs.length > 1 && (
                    <span className="mt-1 block text-xs font-normal opacity-80">
                      {group.tabs
                        .filter(key => !(key === 'activity' && !has('settings.view')) && !(key === 'secure-files' && !has('customers.secure_files.list') && !has('customers.secure_files.manage')))
                        .map(key => TABS.find(tab => tab.key === key)?.label)
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {activeTab !== 'overview' && (
            <div role="group" aria-label="Customer section tools" className={`flex ${easy ? 'flex-wrap' : 'overflow-x-auto'} border-b border-slate-100 bg-slate-50/70 px-2`}>
              {(tabGroups.find((group) => group.tabs.includes(activeTab))?.tabs ?? []).map((key) => {
                const tab = TABS.find((item) => item.key === key)
                if (!tab || (key === 'activity' && !has('settings.view')) || (key === 'secure-files' && !has('customers.secure_files.list') && !has('customers.secure_files.manage'))) return null
                return (
                  <button key={key} type="button" data-easy-view-option aria-pressed={activeTab === key} onClick={() => setTab(key)} className={`${easy ? 'my-1 rounded-lg' : ''} whitespace-nowrap px-3 py-2 text-xs font-semibold ${activeTab === key ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'}`}>
                    {tab.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {/* Tab content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'edit' && renderEdit()}
        {activeTab === 'contacts' && renderContacts()}
        {activeTab === 'locations' && renderLocations()}
        {activeTab === 'assets' && <CustomerAssetsTab key={customer.id} customer={customer} />}
        {activeTab === 'jobs' && <CustomerJobsTab key={customer.id} customer={customer} />}
        {activeTab === 'estimates' && <CustomerEstimatesTab key={customer.id} customer={customer} />}
        {activeTab === 'invoices' && <CustomerInvoicesTab key={customer.id} customer={customer} />}
        {activeTab === 'activity' && has('settings.view') && (
          <EntityActivityPanel entityId={customer.id} noun="customer" />
        )}
        {activeTab === 'tasks' && (
          <TasksPanel
            anchorType="customer"
            anchorId={customer.id}
            anchorLabel={customer.display_name}
            canEdit={has('customers.edit')}
          />
        )}
        {activeTab === 'messages' && <CustomerMessagesTab customer={customer} />}
        {activeTab === 'documents' && <CustomerDocumentsTab customer={customer} />}
        {activeTab === 'secure-files' && <CustomerSecureFilesTab customer={customer} />}
        {activeTab === 'templates' && <CustomerTemplatesTab customer={customer} />}

      </main>

      <CustomerMergeModal
        survivor={customer}
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        onMerged={async () => {
          setMergeOpen(false)
          await queryClient.invalidateQueries({ queryKey: customerKeys.detail(customer.id) })
          await queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
          alert('Customer merge complete. The duplicate account was moved into this account and archived.')
        }}
      />
      <MessagesDrawer
        open={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        context={{ kind: 'customer', customer }}
        title={`Messages · ${customer.display_name}`}
      />
    </div>
  )
}

function CustomerMergeModal({
  survivor,
  open,
  onClose,
  onMerged,
}: {
  survivor: Customer
  open: boolean
  onClose: () => void
  onMerged: () => void | Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const customersQuery = useCustomers({ q: query, per_page: 8, sort: 'display_name', direction: 'asc' })
  const merge = useMergeCustomer()

  if (!open) return null

  const candidates = (customersQuery.data?.data ?? []).filter((customer) => customer.id !== survivor.id)

  async function handleSubmit() {
    if (!selected) return
    setError(null)
    try {
      await merge.mutateAsync({
        survivorCustomerId: survivor.id,
        mergeCustomerId: selected.id,
        reason,
      })
      setQuery('')
      setReason('')
      setSelected(null)
      await onMerged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to merge customers.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 px-4 py-6">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl border border-navy-100 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-navy-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">Merge duplicate customer</h2>
            <p className="mt-1 text-sm text-navy-500">Keep {survivor.display_name} and move another account into it.</p>
          </div>
          <button type="button" className="text-sm text-navy-500 hover:text-navy-800" onClick={onClose}>Close</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Survivor: <span className="font-semibold">{survivor.display_name}</span>{' '}
            <span className="font-mono text-xs">Acct #{survivor.account_number ?? survivor.id}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-800 mb-1">Duplicate account to merge in</label>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelected(null)
              }}
              placeholder="Search customer name or account #..."
              className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoFocus
            />
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-navy-100 bg-white">
              {customersQuery.isFetching && <div className="px-3 py-2 text-sm text-navy-400">Searching...</div>}
              {!customersQuery.isFetching && candidates.length === 0 && (
                <div className="px-3 py-2 text-sm text-navy-400">No matching duplicate customers.</div>
              )}
              {candidates.map((candidate) => {
                const isSelected = selected?.id === candidate.id
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelected(candidate)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-amber-50 ${isSelected ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : ''}`}
                  >
                    <span>
                      <span className="block font-medium text-navy-900">{candidate.display_name}</span>
                      <span className="block text-xs text-navy-500">Acct #{candidate.account_number ?? candidate.id}</span>
                    </span>
                    <span className="text-xs capitalize text-navy-500">{candidate.customer_type}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {selected && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This will move {selected.display_name} into {survivor.display_name}, then archive the duplicate account.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-navy-800 mb-1">Reason / note</label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Optional note saved on the survivor customer..."
              className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-navy-100 px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="danger" onClick={handleSubmit} disabled={!selected} loading={merge.isPending}>
            {merge.isPending ? 'Merging...' : 'Merge duplicate'}
          </Button>
        </div>
      </div>
    </div>
  )
}
// ============================================================
// Customer Assets tab (Slice 13c follow-up)
// ============================================================

function CustomerAssetsTab({ customer }: { customer: Customer }) {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, error, isFetching, refetch } = useAssets({
    customer_id: customer.id,
    page,
    per_page: 100,
  })
  const [showWizard, setShowWizard] = useState(false)

  const assets = data?.data ?? []

  return (
    <section className="bg-white rounded-lg border border-navy-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">
            Assets
          </h2>
          <p className="text-xs text-navy-500 mt-1">
            Physical things at this customer's locations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium"
        >
          + New Asset
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-700">
          Failed to load assets.{error instanceof Error ? ` ${error.message}` : ''}
          <button type="button" onClick={() => { void refetch() }} disabled={isFetching} className="ml-2 underline disabled:opacity-50">Retry</button>
        </p>
      )}

      {!isLoading && !isError && assets.length === 0 && (
        <div className="text-center text-sm text-slate-500 py-8">
          No assets yet for {customer.display_name}.{' '}
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="text-amber-700 hover:underline font-medium"
          >
            Add the first one
          </button>
          .
        </div>
      )}

      {!isLoading && !isError && assets.length > 0 && (
        <CustomerAssetsByLocation assets={assets} />
      )}

      {!isLoading && !isError && data?.meta && (
        <nav aria-label="Customer assets pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span role="status">{isFetching ? 'Updating assets…' : `Showing ${data.meta.from ?? 0}–${data.meta.to ?? 0} of ${data.meta.total} assets`}</span>
          {data.meta.last_page > 1 && <div className="flex items-center gap-3">
            <button type="button" disabled={isFetching || page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40">Previous</button>
            <span>Page {data.meta.current_page} of {data.meta.last_page}</span>
            <button type="button" disabled={isFetching || page >= data.meta.last_page} onClick={() => setPage(p => p + 1)} className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40">Next</button>
          </div>}
        </nav>
      )}

      {showWizard && (
        <NewAssetWizardModal
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          initialCustomer={customer}
        />
      )}
    </section>
  )
}

/**
 * The same assets, grouped by the property they are at.
 *
 * A flat list is fine for a customer with one building and useless for
 * one with nine: "which of these is at Harbor Point" is the question
 * being asked, and a Location column makes somebody answer it by
 * scanning. Grouping also gives each property somewhere to say that
 * another company keeps records there.
 */
function CustomerAssetsByLocation({ assets }: { assets: Asset[] }) {
  const groups = new Map<string, { label: string; assets: Asset[] }>()

  for (const asset of assets) {
    const id = asset.service_location?.id ?? 'none'
    const label =
      asset.service_location?.nickname
      || asset.service_location?.city
      || 'No property set'

    const group = groups.get(id) ?? { label, assets: [] }
    group.assets.push(asset)
    groups.set(id, group)
  }

  const ordered = [...groups.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label))

  return (
    <div className="space-y-6">
      {ordered.map(([locationId, group]) => (
        <section key={locationId}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-navy-800">{group.label}</h3>
            <span className="text-xs text-slate-500">
              {group.assets.length} item{group.assets.length === 1 ? '' : 's'}
            </span>
          </div>
          {locationId !== 'none' && (
            <div className="mb-3">
              <EquipmentSharingCard locationId={locationId} />
            </div>
          )}
          <CustomerAssetsTable assets={group.assets} />
        </section>
      ))}
    </div>
  )
}

function CustomerAssetsTable({ assets }: { assets: Asset[] }) {
  const { theme } = useTheme()
  const easy = theme === 'easy-top' || theme === 'easy-side'
  return (
    <>
    {easy && <ul aria-label="Customer assets" className="space-y-3 md:hidden">
      {assets.map(asset => <li key={asset.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words font-semibold text-slate-900">{asset.name}</h3>
          {asset.is_secured && <span className="shrink-0 text-xs text-slate-600">🔒 Secured</span>}
        </div>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
          <dt className="text-slate-500">Type</dt><dd className="break-words">{asset.asset_type?.name ?? '—'}</dd>
          <dt className="text-slate-500">Code</dt><dd className="break-all font-mono">{asset.asset_code || '—'}</dd>
          <dt className="text-slate-500">Location</dt><dd className="break-words">{asset.service_location?.nickname || asset.service_location?.city || '—'}</dd>
          <dt className="text-slate-500">Group</dt><dd className="break-words">{asset.asset_group?.name ?? '—'}</dd>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/assets?q=${encodeURIComponent(asset.asset_code || asset.name)}`} className="inline-flex min-h-11 items-center rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-800" aria-label={`View or edit ${asset.name}`}>View / Edit →</Link>
          {asset.scan_url && (
            <a href={asset.scan_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700" aria-label={`Open the public record for ${asset.name}`}>Public record →</a>
          )}
        </div>
      </li>)}
    </ul>}
    <div className={`${easy ? 'hidden md:block' : ''} overflow-x-auto rounded border border-slate-200`}>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Type</th>
            <th className="text-left px-4 py-2 font-medium">Name</th>
            <th className="text-left px-4 py-2 font-medium">Code</th>
            <th className="text-left px-4 py-2 font-medium">Location</th>
            <th className="text-left px-4 py-2 font-medium">Group</th>
            <th className="text-center px-4 py-2 font-medium">Secured</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.map((asset) => (
            <tr key={asset.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-xs text-slate-600">
                {asset.asset_type ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded">
                    {asset.asset_type.icon && <span>{asset.asset_type.icon}</span>}
                    <span>{asset.asset_type.name}</span>
                  </span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-slate-900">{asset.name}</td>
              <td className="px-4 py-3 text-xs font-mono text-slate-600">
                {asset.asset_code || <span className="text-slate-300">-</span>}
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {asset.service_location?.nickname ||
                  asset.service_location?.city ||
                  '-'}
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {asset.asset_group?.name ?? <span className="text-slate-300">-</span>}
              </td>
              <td className="px-4 py-3 text-center">
                {asset.is_secured ? (
                  <span title="Secured asset">🔒</span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/assets?q=${encodeURIComponent(asset.asset_code || asset.name)}`}
                  className="text-xs text-amber-700 hover:underline font-medium"
                >
                  View / Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

// ============================================================
// Customer Locations tab — full CRUD via LocationPickerModal
// ============================================================

function CustomerLocationsTab({ customer }: { customer: Customer }) {
  const [modalState, setModalState] = useState<
    | { open: false }
    | { open: true; view: 'list' | 'add' | 'edit'; editId?: string }
  >({ open: false })

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">
            Service Locations
          </h2>
          <p className="text-xs text-navy-500 mt-1">
            {customer.service_locations?.length ?? 0} location
            {customer.service_locations?.length === 1 ? '' : 's'} on this customer
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalState({ open: true, view: 'add' })}
          className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium whitespace-nowrap"
        >
          + Add location
        </button>
      </div>

      {!customer.service_locations || customer.service_locations.length === 0 ? (
        <div className="text-center text-sm text-slate-500 py-8">
          No service locations yet.{' '}
          <button
            type="button"
            onClick={() => setModalState({ open: true, view: 'add' })}
            className="text-amber-700 hover:underline font-medium"
          >
            Add the first one
          </button>
          .
        </div>
      ) : (
        <ul className="space-y-3">
          {customer.service_locations.map((loc) => (
            <li
              key={loc.id}
              className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 text-base">
                    {loc.nickname || loc.address.formatted}
                  </span>
                  {loc.is_primary && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-amber-500 text-white font-semibold uppercase tracking-wide">
                      Primary
                    </span>
                  )}
                  {loc.gated_property && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
                      Gated
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setModalState({ open: true, view: 'edit', editId: loc.id })}
                  className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
              </div>
              <div className="text-sm text-slate-700 leading-relaxed">
                {loc.address.formatted}
              </div>
              {/* Only speaks when another CrewBarn company keeps equipment
                  records at this same address, or when this shop has
                  already asked about it. Silent otherwise, which is most
                  properties. */}
              <div className="mt-3">
                <EquipmentSharingCard locationId={loc.id} />
              </div>
              {loc.gated_property && loc.gate_code && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                  <div className="text-xs text-slate-600 mb-0.5">Gate code</div>
                  <div className="font-mono text-sm text-slate-800">{loc.gate_code}</div>
                  {loc.entry_notes && (
                    <div className="text-xs text-slate-600 mt-1 italic">{loc.entry_notes}</div>
                  )}
                </div>
              )}
              <div className="mt-3">
                <LocationMapPlaceholder
                  latitude={loc.coordinates.latitude}
                  longitude={loc.coordinates.longitude}
                  formattedAddress={loc.address.formatted}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalState.open && (
        <LocationPickerModal
          isOpen
          onClose={() => setModalState({ open: false })}
          customer={customer}
          onSelect={() => setModalState({ open: false })}
          initialView={modalState.view}
          initialEditId={modalState.editId}
        />
      )}
    </section>
  )
}

// ============================================================
// Customer Jobs tab
// ============================================================

/**
 * Compact revenue strip shown in the customer header. Reads the same
 * /v1/invoices?customer_id=… that the Invoices tab uses (TanStack
 * Query dedupes / caches, so there's no extra round-trip).
 *
 * Cards:
 *   - Total billed     (SUM of all invoice total_cents, excluding cancelled)
 *   - Paid             (SUM of amount_paid_cents)
 *   - Due              (Total − Paid)
 *   - Open invoices    (count where balance > 0 and not cancelled)
 *
 * Hidden entirely if the customer has zero invoices — keeps the
 * header tidy for fresh accounts.
 */
interface CustomerInvoiceSummary {
  invoice_count: number
  cancelled_count: number
  billed_cents: number
  paid_amount_cents: number
  due_cents: number
  open_count: number
  paid_count: number
}

function CustomerRevenueStats({
  customerId,
  customer,
  lastContact,
}: {
  customerId: string
  customer: Customer
  lastContact: string
}) {
  // Who to reach: the main contact (else the first one), with phone + email
  // shown whole — an email that ends in "…" is one you can't read off the
  // screen, and the phone is what the office actually dials.
  const main = (customer.contacts ?? []).find((c) => c.is_main_contact) ?? customer.contacts?.[0] ?? null
  const contactName = main?.full_name?.trim() || null
  const contactPhone = main?.phone || main?.phone_alt || null
  const contactEmail = main?.email || customer.email || null
  // Server-computed over ALL the customer's invoices — the old client-side
  // sum only saw the newest page (200) and undercounted busy accounts by half.
  const { data: summary } = useQuery({
    queryKey: ['customer-invoice-summary', customerId],
    queryFn: () =>
      apiRequest<{ data: CustomerInvoiceSummary }>(`/v1/customers/${customerId}/invoice-summary`),
    staleTime: 30_000,
  })
  const sum = summary?.data
  const totalBilled = sum?.billed_cents ?? 0
  const totalPaid = sum?.paid_amount_cents ?? 0
  const openCount = sum?.open_count ?? 0
  const due = sum?.due_cents ?? 0

  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)

  return (
    <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3 lg:grid-cols-7">
      <Stat label="Lifetime value" value={fmt(totalBilled)} />
      <Stat label="Paid" value={fmt(totalPaid)} tone="paid" />
      <Stat label="Balance due" value={fmt(due)} tone={due > 0 ? 'due' : undefined} />
      <Stat label="Open invoices" value={String(openCount)} tone={openCount > 0 ? 'due' : undefined} />
      <div className="min-w-0 bg-white px-3 py-3 text-slate-900 sm:px-4 lg:col-span-2">
        <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">Primary contact</div>
        {!contactName && !contactPhone && !contactEmail ? (
          <div className="text-sm font-bold sm:text-base">—</div>
        ) : (
          <div className="space-y-0.5 text-sm leading-tight">
            {contactName && <div className="truncate font-bold sm:text-base">{contactName}</div>}
            {contactPhone && (
              <a href={`tel:${contactPhone}`} className="block font-mono text-sm font-semibold tabular-nums text-slate-900 hover:underline">
                {formatPhone(contactPhone)}
              </a>
            )}
            {contactEmail && (
              <a href={`mailto:${contactEmail}`} className="block break-all text-xs text-amber-700 hover:underline sm:text-[13px]" title={contactEmail}>
                {contactEmail}
              </a>
            )}
          </div>
        )}
      </div>
      <Stat label="Last contact" value={lastContact} />
    </div>
  )
}

/**
 * Sub-tab pill used inside Jobs and Invoices tabs to flip between
 * filtered subsets (All / Unpaid / Paid / Uninvoiced / Invoiced).
 * Bottom-border style mirrors the page-level tab strip so the visual
 * hierarchy reads as "tab → sub-tab → table."
 */
function SubTab({
  active,
  onClick,
  highlight,
  children,
}: {
  active: boolean
  onClick: () => void
  /** Amber dot indicator — used to draw eyes to "Uninvoiced" or "Unpaid"
   *  when there's something to act on. */
  highlight?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-easy-view-option
      className={`relative px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
        active
          ? 'border-amber-500 text-navy-800'
          : 'border-transparent text-navy-500 hover:text-navy-800'
      }`}
    >
      {children}
      {highlight && !active && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
      )}
    </button>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'paid' | 'due'
}) {
  const colors =
    tone === 'paid'
      ? 'bg-emerald-50 text-emerald-900'
      : tone === 'due'
        ? 'bg-rose-50 text-rose-900'
        : 'bg-white text-slate-900'
  return (
    <div className={'min-w-0 px-3 py-3 sm:px-4 ' + colors}>
      <div className="truncate text-[10px] uppercase tracking-wide font-semibold text-slate-500">
        {label}
      </div>
      <div className="truncate text-sm sm:text-base font-bold font-mono tabular-nums">{value}</div>
    </div>
  )
}

function CustomerJobsTab({ customer }: { customer: Customer }) {
  const [filter, setFilter] = useState<'all' | 'uninvoiced' | 'invoiced'>('all')
  const [page, setPage] = useState(1)
  // Switching filters restarts paging from the top.
  const pickFilter = (f: 'all' | 'uninvoiced' | 'invoiced') => {
    setFilter(f)
    setPage(1)
  }

  const { data, isLoading, isError, error, refetch, isFetching } = useWorkOrders({
    service_customer_id: customer.id,
    include_bill_to: true, // their own jobs + sub-account jobs billed to them
    invoiced: filter === 'all' ? undefined : filter === 'invoiced',
    page,
    per_page: 100,
  })

  const rows = data?.data ?? []
  // Full-set counts (own + billed-to), server-computed so the badges never
  // reflect just the current page.
  const totalJobs = data?.tab_counts?.all ?? data?.meta?.total ?? rows.length
  const invoicedTotal = data?.tab_counts?.invoiced ?? 0
  const uninvoicedTotal = data?.tab_counts?.uninvoiced ?? 0
  // Pager, within the active filter.
  const currentPage = data?.meta?.current_page ?? 1
  const lastPage = data?.meta?.last_page ?? 1
  const fromRow = data?.meta?.from ?? 0
  const toRow = data?.meta?.to ?? 0
  const filterTotal = data?.meta?.total ?? rows.length

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">Jobs</h2>
          <p className="text-xs text-navy-500 mt-1">
            Work orders for {customer.display_name}.
          </p>
        </div>
        <Link
          to={`/jobs/new?customer_id=${customer.id}`}
          className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium whitespace-nowrap"
        >
          + New Job
        </Link>
      </div>

      {/* Sub-tabs */}
      <div role="group" aria-label="Customer job filters" className="flex flex-wrap gap-1 mb-3 border-b border-slate-200">
        <SubTab active={filter === 'all'} onClick={() => pickFilter('all')}>
          All ({isLoading || isError ? '—' : totalJobs})
        </SubTab>
        <SubTab
          active={filter === 'uninvoiced'}
          onClick={() => pickFilter('uninvoiced')}
          highlight={uninvoicedTotal > 0}
        >
          Uninvoiced ({isLoading || isError ? '—' : uninvoicedTotal})
        </SubTab>
        <SubTab active={filter === 'invoiced'} onClick={() => pickFilter('invoiced')}>
          Invoiced ({isLoading || isError ? '—' : invoicedTotal})
        </SubTab>
      </div>

      {!isLoading && !isError && filterTotal > 0 && (
        <p className="mb-2 text-xs text-slate-500">
          Showing {fromRow}–{toRow} of {filterTotal.toLocaleString()}
        </p>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-700">
          Failed to load jobs.{error instanceof Error ? ` ${error.message}` : ''}
          <button type="button" onClick={() => { void refetch() }} disabled={isFetching} className="ml-2 underline disabled:opacity-50">Retry</button>
        </p>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center text-sm text-slate-500 py-8">
          {filter === 'all' ? 'No jobs yet.' : 'No jobs match this filter.'}{' '}
          <Link
            to={`/jobs/new?customer_id=${customer.id}`}
            className="text-amber-700 hover:underline font-medium"
          >
            Create the first one
          </Link>
          .
        </div>
      )}
      {!isLoading && !isError && rows.length > 0 && (
        <>
          {/* Mobile: card list. Wraps the WO into a tappable card with the
              key fields stacked — much more thumb-friendly than a tiny
              horizontal-scroll table on a phone. */}
          <div className="md:hidden space-y-2">
            {rows.map((wo) => (
              <Link
                key={wo.id}
                to={`/jobs/${wo.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-amber-300 hover:bg-amber-50/30 active:bg-amber-50/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-500">
                    {wo.display_number ?? '—'}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: wo.status?.color ?? undefined }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: wo.status?.color ?? '#94a3b8' }}
                    />
                    {wo.status?.name ?? '—'}
                  </span>
                </div>
                <div className="mt-1 font-medium text-slate-900 leading-snug">
                  {wo.title}
                </div>
                {wo.service_customer_id !== customer.id && wo.service_customer?.display_name && (
                  <div className="mt-0.5">
                    <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      For: {wo.service_customer.display_name}
                    </span>
                  </div>
                )}
                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-600 gap-2">
                  <span>
                    {wo.schedule?.is_scheduled && wo.schedule?.date
                      ? `📅 ${wo.schedule.date}${wo.schedule.start_time ? ` ${wo.schedule.start_time.slice(0, 5)}` : ''}`
                      : <span className="text-slate-400">Unscheduled</span>}
                  </span>
                  <span>
                    {wo.lead_tech?.full_name ?? <span className="text-slate-400">Unassigned</span>}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: the original table */}
          <div className="hidden md:block overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Job #</th>
                  <th className="text-left px-4 py-2 font-medium">Title</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Scheduled</th>
                  <th className="text-left px-4 py-2 font-medium">Tech</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((wo) => (
                  <tr key={wo.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {wo.display_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {wo.title}
                      {wo.service_customer_id !== customer.id && wo.service_customer?.display_name && (
                        <span className="ml-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-600 align-middle">
                          For: {wo.service_customer.display_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: wo.status?.color ?? undefined }}
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ background: wo.status?.color ?? '#94a3b8' }}
                        />
                        {wo.status?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {wo.schedule?.is_scheduled && wo.schedule?.date
                        ? `${wo.schedule.date}${wo.schedule.start_time ? ` ${wo.schedule.start_time.slice(0, 5)}` : ''}`
                        : <span className="text-slate-400">Unscheduled</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {wo.lead_tech?.full_name ?? <span className="text-slate-400">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/jobs/${wo.id}`}
                        className="text-xs text-amber-700 hover:underline font-medium"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isLoading && !isError && lastPage > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isFetching || currentPage <= 1}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-500">Page {currentPage} of {lastPage}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={isFetching || currentPage >= lastPage}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  )
}

// ============================================================
// Customer Estimates tab
// ============================================================

function CustomerEstimatesTab({ customer }: { customer: Customer }) {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, error, refetch, isFetching } = useEstimates({
    customer_id: customer.id,
    page,
    per_page: 100,
  })
  const rows = data?.data ?? []

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">Estimates</h2>
          <p className="text-xs text-navy-500 mt-1">
            Quotes given to {customer.display_name}.
          </p>
        </div>
        <Link
          to={`/estimates/new?customer_id=${customer.id}`}
          className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium whitespace-nowrap"
        >
          + New Estimate
        </Link>
      </div>

      {!isLoading && !isError && data?.meta && (
        <nav aria-label="Customer estimates pages" className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span role="status">{isFetching ? 'Updating estimates…' : `Showing ${data.meta.from ?? 0}–${data.meta.to ?? 0} of ${data.meta.total} estimates`}</span>
          {data.meta.last_page > 1 && <div className="flex items-center gap-3">
            <button type="button" disabled={isFetching || page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40">Previous</button>
            <span>Page {data.meta.current_page} of {data.meta.last_page}</span>
            <button type="button" disabled={isFetching || page >= data.meta.last_page} onClick={() => setPage(p => p + 1)} className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40">Next</button>
          </div>}
        </nav>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-700">
          Failed to load estimates.{error instanceof Error ? ` ${error.message}` : ''}
          <button type="button" onClick={() => { void refetch() }} disabled={isFetching} className="ml-2 underline disabled:opacity-50">Retry</button>
        </p>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center text-sm text-slate-500 py-8">
          No estimates yet.{' '}
          <Link
            to={`/estimates/new?customer_id=${customer.id}`}
            className="text-amber-700 hover:underline font-medium"
          >
            Create the first one
          </Link>
          .
        </div>
      )}
      {!isLoading && !isError && rows.length > 0 && (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map((est) => (
              <Link
                key={est.id}
                to={`/estimates/${est.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-amber-300 active:bg-amber-50/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-600">
                    {est.display_number ?? est.estimate_number ?? '—'}
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 uppercase font-medium">
                    {est.status}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">
                    {est.created_at
                      ? new Date(est.created_at).toLocaleDateString()
                      : '—'}
                  </span>
                  <span className="font-mono text-sm font-semibold text-slate-900">
                    {est.money?.total_cents != null
                      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(est.money.total_cents / 100)
                      : '—'}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Estimate #</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((est) => (
                <tr key={est.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {est.display_number ?? est.estimate_number ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 uppercase font-medium">
                      {est.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {est.money?.total_cents != null
                      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(est.money.total_cents / 100)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {est.created_at
                      ? new Date(est.created_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/estimates/${est.id}`}
                      className="text-xs text-amber-700 hover:underline font-medium"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  )
}

// ============================================================
// Customer Contacts tab — Add/Edit/Delete via ContactEditorModal
// ============================================================

function CustomerContactsTab({ customer }: { customer: Customer }) {
  const [editorState, setEditorState] = useState<
    | { open: false }
    | { open: true; contact: CustomerContact | null }
  >({ open: false })
  const deleteContact = useDeleteCustomerContact()

  async function handleDelete(c: CustomerContact) {
    // Confirmation handled by the global delete modal (password + reason).
    try {
      await deleteContact.mutateAsync({ customerId: customer.id, contactId: c.id })
    } catch (err) {
      if (!isDeleteCancelled(err)) alert('Failed to delete contact: ' + String(err))
    }
  }

  const contacts = customer.contacts ?? []

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">Contacts</h2>
          <p className="text-xs text-navy-500 mt-1">
            {contacts.length} contact{contacts.length === 1 ? '' : 's'} on this customer
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditorState({ open: true, contact: null })}
          className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium whitespace-nowrap"
        >
          + Add contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center text-sm text-slate-500 py-8">
          No contacts yet.{' '}
          <button
            type="button"
            onClick={() => setEditorState({ open: true, contact: null })}
            className="text-amber-700 hover:underline font-medium"
          >
            Add the first one
          </button>
          .
        </div>
      ) : (
        <ul className="space-y-3">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Avatar name={c.full_name || '(no name)'} colorKey={c.id} size={32} className="shrink-0" />
                  <span className="font-semibold text-slate-900 text-base">
                    {c.full_name || '(no name)'}
                  </span>
                  {c.is_main_contact && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-amber-500 text-white font-semibold uppercase tracking-wide">
                      Main
                    </span>
                  )}
                  {c.is_billing_contact && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-700 border border-amber-200 font-medium uppercase tracking-wide">
                      Billing
                    </span>
                  )}
                  {c.is_service_contact && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-sky-50 text-sky-700 border border-sky-200 font-medium uppercase tracking-wide">
                      Service
                    </span>
                  )}
                  {c.is_intake_contact && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-violet-50 text-violet-700 border border-violet-200 font-medium uppercase tracking-wide">
                      Intake
                    </span>
                  )}
                  {!c.active && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-slate-200 text-slate-600 uppercase tracking-wide">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditorState({ open: true, contact: c })}
                    className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    disabled={deleteContact.isPending}
                    className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {(c.job_title || c.department) && (
                <div className="text-xs text-slate-500 mb-2">
                  {c.job_title}
                  {c.job_title && c.department ? ' · ' : ''}
                  {c.department}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {c.email && (
                  <div>
                    <span className="text-slate-500 text-xs">Email:</span>{' '}
                    <a href={`mailto:${c.email}`} className="break-all text-amber-700 hover:underline">{c.email}</a>
                  </div>
                )}
                {c.email_alt && (
                  <div>
                    <span className="text-slate-500 text-xs">Email alt:</span>{' '}
                    <a href={`mailto:${c.email_alt}`} className="break-all text-amber-700 hover:underline">{c.email_alt}</a>
                  </div>
                )}
                {c.phone && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500 text-xs">Phone:</span>{' '}
                    <span className="text-slate-800 font-mono">{c.phone}</span>
                    <ClickToCallButton phone={c.phone} customerId={customer.id} />
                  </div>
                )}
                {c.phone_alt && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500 text-xs">Phone alt:</span>{' '}
                    <span className="text-slate-800 font-mono">{c.phone_alt}</span>
                    <ClickToCallButton phone={c.phone_alt} customerId={customer.id} />
                  </div>
                )}
              </div>
              {c.notes && (
                <div className="mt-2 text-sm text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                  {c.notes}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editorState.open && (
        <ContactEditorModal
          isOpen
          onClose={() => setEditorState({ open: false })}
          customerId={customer.id}
          contact={editorState.contact}
        />
      )}
    </section>
  )
}

// ============================================================
// Customer Secure Files tab — encrypted, token-gated files
// ============================================================

function CustomerSecureFilesTab({ customer }: { customer: Customer }) {
  const { has } = usePermissions()
  const status = useCustomerSecureFileStatus(customer.id)
  const files = useCustomerSecureFiles(customer.id)
  const setup = useSetupSecureFiles()
  const requestAccess = useRequestSecureFileAccess()
  const verifyAccess = useVerifySecureFileAccess()
  const rotateRecovery = useRotateSecureFileRecoveryKey()
  const recoverKey = useRecoverSecureFileKey()
  const upload = useUploadCustomerSecureFile()
  const createNote = useCreateCustomerSecureNote()
  const remove = useDeleteCustomerSecureFile()
  const [viewer, setViewer] = useState<SecureFileViewerState | null>(null)
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [recoveryInput, setRecoveryInput] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const [auditFile, setAuditFile] = useState<CustomerSecureFile | null>(null)

  const keyConfigured = !!status.data?.data.key.configured
  const unlocked = !!files.data?.meta.unlocked
  const canManage = !!status.data?.data.can_manage
  const rows = files.data?.data ?? []

  async function handleSetup() {
    const res = await setup.mutateAsync(customer.id)
    if (res.data.recovery_key) setRecoveryKey(res.data.recovery_key)
  }

  async function handleRequestAccess() {
    await requestAccess.mutateAsync({ customerId: customer.id, channel })
  }

  async function handleVerifyAccess() {
    await verifyAccess.mutateAsync({ customerId: customer.id, code })
    setCode('')
  }

  async function handleRotateRecoveryKey() {
    setRecoveryMessage(null)
    const confirmed = window.confirm('Rotate the Secure Files recovery key? The new key is shown once. The old recovery key will stop working.')
    if (!confirmed) return
    const res = await rotateRecovery.mutateAsync(customer.id)
    setRecoveryKey(res.data.recovery_key)
    setRecoveryMessage('Recovery key rotated. Store the new key now.')
  }

  async function handleRecoverKey() {
    setRecoveryMessage(null)
    try {
      await recoverKey.mutateAsync({ customerId: customer.id, recoveryKey: recoveryInput })
      setRecoveryInput('')
      setRecoveryMessage('Recovery key accepted. Secure Files key material was rewrapped.')
    } catch (e) {
      setRecoveryMessage(e instanceof Error ? e.message : 'Recovery failed.')
    }
  }

  async function handleUpload(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return
    setUploadError(null)
    try {
      for (const file of Array.from(filesList)) {
        await upload.mutateAsync({ customerId: customer.id, file })
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleCreateNote() {
    setUploadError(null)
    try {
      await createNote.mutateAsync({
        customerId: customer.id,
        title: noteTitle || 'Secure note',
        body: noteBody,
      })
      setNoteTitle('')
      setNoteBody('')
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function openSecureFile(file: CustomerSecureFile, download = false) {
    try {
      const blob = await fetchCustomerSecureFileBlob(customer.id, file.id, download)
      const url = URL.createObjectURL(blob)
      if (download) {
        const a = document.createElement('a')
        a.href = url
        a.download = file.original_filename || file.title
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else {
        if (viewer?.blobUrl) URL.revokeObjectURL(viewer.blobUrl)
        setViewer({
          file,
          blobUrl: null,
          body: null,
          mimeType: file.mime_type || blob.type || null,
          loading: true,
          error: null,
        })

        if (isSecureTextFile(file, blob)) {
          const body = await blob.text()
          URL.revokeObjectURL(url)
          setViewer({
            file,
            blobUrl: null,
            body,
            mimeType: file.mime_type || blob.type || 'text/plain',
            loading: false,
            error: null,
          })
        } else {
          setViewer({
            file,
            blobUrl: url,
            body: null,
            mimeType: file.mime_type || blob.type || null,
            loading: false,
            error: null,
          })
        }
      }
    } catch (e) {
      if (download) {
        alert(e instanceof Error ? e.message : String(e))
      } else {
        setViewer({
          file,
          blobUrl: null,
          body: null,
          mimeType: file.mime_type,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  function closeSecureViewer() {
    if (viewer?.blobUrl) URL.revokeObjectURL(viewer.blobUrl)
    setViewer(null)
  }

  async function handleDelete(file: CustomerSecureFile) {
    try {
      await remove.mutateAsync({ customerId: customer.id, fileId: file.id })
    } catch (e) {
      if (!isDeleteCancelled(e)) alert('Failed to delete secure file: ' + String(e))
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy-800">Secure Files</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Encrypted customer files for safe photos, keys, access notes, private documents, and field-sensitive records.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {unlocked ? 'Unlocked' : 'Locked'}
        </div>
      </div>

      {!keyConfigured && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-950">Secure Files setup required</div>
          <p className="mt-1 text-sm text-amber-900">
            Setup generates tenant-specific encryption keys and a one-time recovery key. Store the recovery key somewhere safe; it cannot be shown again.
          </p>
          {canManage ? (
            <button
              type="button"
              onClick={handleSetup}
              disabled={setup.isPending}
              className="mt-3 rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
            >
              {setup.isPending ? 'Setting up...' : 'Set up secure files'}
            </button>
          ) : (
            <p className="mt-3 text-sm text-amber-900">Ask an owner or admin to complete setup.</p>
          )}
        </div>
      )}

      {recoveryKey && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-900">Recovery key shown once</div>
          <p className="mt-1 text-sm text-red-800">Store this in a safe place now. CrewBarn will not show it again.</p>
          <code className="mt-3 block rounded border border-red-200 bg-white p-3 text-sm font-bold text-red-950">{recoveryKey}</code>
          <button type="button" onClick={() => setRecoveryKey(null)} className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800">
            I stored this safely
          </button>
        </div>
      )}

      {keyConfigured && canManage && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-navy-900">Owner/admin recovery controls</div>
          <p className="mt-1 text-xs text-slate-500">
            Rotate shows a new recovery key one time. Recover rewraps tenant key material from the stored recovery key.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRotateRecoveryKey}
              disabled={rotateRecovery.isPending}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              {rotateRecovery.isPending ? 'Rotating...' : 'Rotate recovery key'}
            </button>
            <input
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
              placeholder="Existing recovery key"
              className="min-w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleRecoverKey}
              disabled={recoverKey.isPending || !recoveryInput.trim()}
              className="rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
            >
              {recoverKey.isPending ? 'Recovering...' : 'Recover / rewrap'}
            </button>
          </div>
          {recoveryMessage && <p className="mt-2 text-xs text-slate-600">{recoveryMessage}</p>}
        </div>
      )}

      {keyConfigured && (
        <>
          {!unlocked && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-navy-900">Unlock secure files</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select value={channel} onChange={(e) => setChannel(e.target.value as 'sms' | 'email')} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="sms">Text code</option>
                  <option value="email">Email code</option>
                </select>
                <button type="button" onClick={handleRequestAccess} disabled={requestAccess.isPending} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60">
                  {requestAccess.isPending ? 'Sending...' : 'Send code'}
                </button>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <button type="button" onClick={handleVerifyAccess} disabled={verifyAccess.isPending || !code.trim()} className="rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
                  Verify
                </button>
              </div>
              {requestAccess.data?.data && (
                <p className={`mt-2 text-xs ${requestAccess.data.data.sent ? 'text-emerald-700' : 'text-red-700'}`}>
                  {requestAccess.data.data.sent
                    ? `Code sent to ${requestAccess.data.data.to ?? channel}.`
                    : requestAccess.data.data.error ?? 'Could not send code.'}
                </p>
              )}
              {verifyAccess.error && <p className="mt-2 text-xs text-red-700">{verifyAccess.error instanceof Error ? verifyAccess.error.message : 'Invalid code.'}</p>}
            </div>
          )}

          {unlocked && (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-sm font-semibold text-navy-900">Upload encrypted file</div>
                <label className="mt-3 inline-block cursor-pointer rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                  {upload.isPending ? 'Uploading...' : '+ Upload file'}
                  <input type="file" multiple className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }} />
                </label>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-sm font-semibold text-navy-900">Create secure note</div>
                <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Title" className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Secure note" rows={3} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <button type="button" onClick={handleCreateNote} disabled={createNote.isPending || !noteBody.trim()} className="mt-2 rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
                  Save encrypted note
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {uploadError && <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</div>}

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        {files.isLoading ? (
          <div className="p-4 text-sm text-slate-500">Loading secure files...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No secure files yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((file) => (
              <div key={file.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-navy-950">{file.title}</div>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">{sourceLabel(file.source)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{file.original_filename ?? 'Secure note'}</span>
                    <span>{formatSecureFileSize(file.size_bytes)}</span>
                    {file.created_by_name && <span>By {file.created_by_name}</span>}
                    {file.created_at && <span>{new Date(file.created_at).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button type="button" onClick={() => openSecureFile(file)} disabled={!unlocked || !has('customers.secure_files.view')} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">View</button>
                  {has('customers.secure_files.audit') && <button type="button" onClick={() => setAuditFile(file)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Audit</button>}
                  {has('customers.secure_files.delete') && <button type="button" onClick={() => handleDelete(file)} className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewer && (
        <SecureFileViewerModal
          customerId={customer.id}
          viewer={viewer}
          onClose={closeSecureViewer}
          onSaved={(file) => setViewer((current) => current ? { ...current, file } : current)}
        />
      )}
      {auditFile && <SecureFileAuditModal customerId={customer.id} file={auditFile} onClose={() => setAuditFile(null)} />}
    </section>
  )
}

function SecureFileViewerModal({
  customerId,
  viewer,
  onClose,
  onSaved,
}: {
  customerId: string
  viewer: SecureFileViewerState
  onClose: () => void
  onSaved: (file: CustomerSecureFile) => void
}) {
  const { has } = usePermissions()
  const updateFile = useUpdateCustomerSecureFile()
  const [title, setTitle] = useState(viewer.file.title || '')
  const [description, setDescription] = useState(viewer.file.description || '')
  const [body, setBody] = useState(viewer.body || '')
  const [savedBody, setSavedBody] = useState(viewer.body || '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const canEditBody = viewer.file.source === 'web_creator' && has('customers.secure_files.create')
  const canEditMetadata = has('customers.secure_files.create') || has('customers.secure_files.upload')
  const mimeType = viewer.mimeType || viewer.file.mime_type || ''
  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const dirty =
    title !== (viewer.file.title || '') ||
    description !== (viewer.file.description || '') ||
    (canEditBody && body !== savedBody)

  useEffect(() => {
    setTitle(viewer.file.title || '')
    setDescription(viewer.file.description || '')
    setBody(viewer.body || '')
    setSavedBody(viewer.body || '')
    setSaveError(null)
  }, [viewer.file.id, viewer.file.title, viewer.file.description, viewer.body])

  async function handleSave() {
    setSaveError(null)
    try {
      const res = await updateFile.mutateAsync({
        customerId,
        fileId: viewer.file.id,
        title,
        description,
        ...(canEditBody ? { body } : {}),
      })
      onSaved(res.data)
      setSavedBody(body)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-navy-900">Secure file</div>
            <div className="mt-1 truncate text-xs text-slate-500">{viewer.file.original_filename ?? 'Secure note'}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">Close</button>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[360px_1fr]">
          <div className="overflow-auto border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEditMetadata}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEditMetadata}
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <div>{sourceLabel(viewer.file.source)}</div>
              <div>{formatSecureFileSize(viewer.file.size_bytes)}</div>
              {viewer.file.updated_at && <div>Updated {new Date(viewer.file.updated_at).toLocaleString()}</div>}
            </div>
            {saveError && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || updateFile.isPending || (!canEditMetadata && !canEditBody)}
                className="rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
              >
                {updateFile.isPending ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
          <div className="min-h-[420px] overflow-auto bg-slate-100 p-5">
            {viewer.loading ? (
              <div className="rounded-lg bg-white p-6 text-sm text-slate-500">Loading secure file...</div>
            ) : viewer.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{viewer.error}</div>
            ) : canEditBody ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[520px] w-full rounded-lg border border-slate-300 bg-white p-4 font-mono text-sm text-slate-900 shadow-sm"
              />
            ) : viewer.body !== null ? (
              <pre className="min-h-[420px] whitespace-pre-wrap rounded-lg bg-white p-4 text-sm text-slate-800 shadow-sm">{viewer.body}</pre>
            ) : isImage && viewer.blobUrl ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-lg bg-white p-4 shadow-sm">
                <img src={viewer.blobUrl} alt={viewer.file.title} className="max-h-[70vh] max-w-full object-contain" />
              </div>
            ) : isPdf && viewer.blobUrl ? (
              <iframe title={viewer.file.title} src={viewer.blobUrl} className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white shadow-sm" />
            ) : (
              <div className="rounded-lg bg-white p-6 text-sm text-slate-600 shadow-sm">
                This file type cannot be previewed inline yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SecureFileAuditModal({ customerId, file, onClose }: { customerId: string; file: CustomerSecureFile; onClose: () => void }) {
  const audit = useCustomerSecureFileAudit(customerId, file.id)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-navy-900">Secure file audit</div>
            <div className="text-xs text-slate-500">{file.title}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        <div className="max-h-[60vh] overflow-auto p-5">
          {audit.isLoading ? (
            <div className="text-sm text-slate-500">Loading audit...</div>
          ) : (audit.data?.data ?? []).length === 0 ? (
            <div className="text-sm text-slate-500">No audit events yet.</div>
          ) : (
            <div className="space-y-3">
              {(audit.data?.data ?? []).map((row) => (
                <div key={row.id} className="rounded border border-slate-200 p-3">
                  <div className="text-sm font-semibold text-navy-900">{row.event.replace(/_/g, ' ')}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.actor ?? 'system'} · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatSecureFileSize(bytes: number | null): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function sourceLabel(source: string): string {
  return source.replace(/_/g, ' ')
}

function isSecureTextFile(file: CustomerSecureFile, blob: Blob): boolean {
  const mimeType = file.mime_type || blob.type || ''
  return file.source === 'web_creator' || mimeType.startsWith('text/')
}

// ============================================================
// Customer Documents tab — R2 file uploader + list
// ============================================================

function CustomerDocumentsTab({ customer }: { customer: Customer }) {
  const { data: docs, isLoading, isError, error } = useCustomerDocuments(customer.id)
  const upload = useUploadCustomerDocument()
  const remove = useDeleteCustomerDocument()
  const [uploadError, setUploadError] = useState<string | null>(null)
  // After upload, open the AI post-upload modal so the user can choose
  // extract-and-edit / make-signable / keep-as-is.
  const [postUpload, setPostUpload] = useState<{ id: string; fileName: string | null; mimeType: string | null } | null>(null)
  // When a row already has an extraction, clicking "Edit extracted" opens the
  // editor directly instead of going through the post-upload modal.
  const [editingExtractedId, setEditingExtractedId] = useState<string | null>(null)
  // Doc preview overlay — when set, opens AttachmentOverlay with the
  // file inline + Print / Open in browser / Extract with AI actions.
  // Lets the user read the doc without leaving the page.
  const [previewing, setPreviewing] = useState<
    | { id: string; url: string; filename: string | null; mimeType: string | null }
    | null
  >(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError(null)
    try {
      // Upload sequentially so the error surface stays simple.
      let lastDoc: { id: string; original_filename: string | null; mime_type: string | null } | null = null
      for (const file of Array.from(files)) {
        lastDoc = await upload.mutateAsync({ customerId: customer.id, file })
      }
      // Only prompt for the LAST uploaded file (typical case = one).
      if (lastDoc) {
        setPostUpload({ id: lastDoc.id, fileName: lastDoc.original_filename, mimeType: lastDoc.mime_type })
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDelete(doc: { id: string; title: string }) {
    // Confirmation handled by the global delete modal (password + reason).
    try {
      await remove.mutateAsync({ customerId: customer.id, documentId: doc.id })
    } catch (e) {
      if (!isDeleteCancelled(e)) alert('Failed to delete document: ' + String(e))
    }
  }

  function formatSize(bytes: number | null): string {
    if (bytes == null) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  function iconFor(mime: string | null, filename: string | null): string {
    const m = (mime ?? '').toLowerCase()
    const f = (filename ?? '').toLowerCase()
    if (m.includes('pdf') || f.endsWith('.pdf')) return '📕'
    if (m.includes('word') || f.match(/\.docx?$/)) return '📘'
    if (m.includes('sheet') || m.includes('excel') || f.match(/\.xlsx?$/) || f.endsWith('.csv')) return '📗'
    if (m.startsWith('image/')) return '🖼️'
    return '📄'
  }

  // AI extraction only supports PDFs + images via Anthropic vision.
  function isExtractable(mime: string | null): boolean {
    if (!mime) return false
    return mime.includes('pdf') || mime.startsWith('image/')
  }

  const rows = docs ?? []

  // Bulk lookup: which of these doc rows already has an extracted_document?
  const extractedLookup = useExtractedDocsForSources('customer_document', rows.map((r) => r.id))
  const extractedMap = extractedLookup.data?.data ?? {}

  return (
    <section className="bg-white rounded-lg border border-navy-100 p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">Documents</h2>
          <p className="text-xs text-navy-500 mt-1">
            Contracts, COIs, tax-exempt forms, signed agreements. PDF / Word / Excel / image, up to 25 MB.
          </p>
        </div>
        <label className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium cursor-pointer">
          {upload.isPending ? 'Uploading…' : '+ Upload'}
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.heic,.heif,.webp"
            className="hidden"
            disabled={upload.isPending}
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {uploadError && (
        <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {uploadError}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-700">
          Failed to load documents.{error instanceof Error ? ` ${error.message}` : ''}
        </p>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center text-sm text-slate-500 py-8">
          No documents yet. Drop one in via the Upload button above.
        </div>
      )}
      {!isLoading && !isError && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((doc) => (
            <li
              key={doc.id}
              className="border border-slate-200 rounded-lg p-3 flex items-center gap-3 hover:border-slate-300 transition-colors"
            >
              <span className="text-2xl flex-shrink-0">
                {iconFor(doc.mime_type, doc.original_filename)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900 truncate">{doc.title}</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="truncate">{doc.original_filename ?? '—'}</span>
                  <span className="text-slate-300">·</span>
                  <span className="whitespace-nowrap">{formatSize(doc.size_bytes)}</span>
                  {doc.created_at && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isExtractable(doc.mime_type) && (
                  extractedMap[doc.id] ? (
                    <button
                      type="button"
                      onClick={() => setEditingExtractedId(extractedMap[doc.id].id)}
                      className="text-xs px-2.5 py-1.5 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center gap-1"
                      title="Open the editable extracted version"
                    >
                      <span className="text-emerald-600">✎</span> Edit extracted
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPostUpload({ id: doc.id, fileName: doc.original_filename, mimeType: doc.mime_type })}
                      className="text-xs px-2.5 py-1.5 rounded border border-amber-300 text-amber-800 hover:bg-amber-50 flex items-center gap-1"
                      title="Extract editable text with AI"
                    >
                      <span className="text-amber-500">✦</span> Extract
                    </button>
                  )
                )}
                {doc.file_url && (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewing({
                        id: doc.id,
                        url: doc.file_url!,
                        filename: doc.original_filename ?? doc.title ?? null,
                        mimeType: doc.mime_type ?? null,
                      })
                    }
                    className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(doc)}
                  disabled={remove.isPending}
                  className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingExtractedId && (
        <ExtractedDocumentEditor
          id={editingExtractedId}
          onClose={() => setEditingExtractedId(null)}
        />
      )}

      {postUpload && (
        <PostUploadModal
          sourceType="customer_document"
          sourceId={postUpload.id}
          fileName={postUpload.fileName}
          mimeType={postUpload.mimeType}
          onClose={() => setPostUpload(null)}
        />
      )}

      {previewing && (
        <AttachmentOverlay
          url={previewing.url}
          filename={previewing.filename ?? undefined}
          kind={(previewing.mimeType ?? '').startsWith('image/') ? 'image' : 'document'}
          // Extract handler only enabled for PDFs + images (Anthropic
          // vision support). For everything else we hide the button by
          // leaving onExtract undefined.
          onExtract={
            isExtractable(previewing.mimeType)
              ? () => {
                  // If there's already an extracted version, open the
                  // editor straight away; otherwise go through the
                  // AI post-upload flow which fires the extraction.
                  const existing = extractedMap[previewing.id]
                  if (existing) {
                    setEditingExtractedId(existing.id)
                  } else {
                    setPostUpload({
                      id: previewing.id,
                      fileName: previewing.filename,
                      mimeType: previewing.mimeType,
                    })
                  }
                }
              : undefined
          }
          extractLabel={
            extractedMap[previewing.id] ? '✎ Edit extracted' : '✦ Extract with AI'
          }
          onClose={() => setPreviewing(null)}
        />
      )}
    </section>
  )
}

// ============================================================
// Customer Invoices tab
// ============================================================

function CustomerInvoicesTab({ customer }: { customer: Customer }) {
  const invoiceQuery = useInvoices({ customer_id: customer.id, per_page: 200, include_bill_to: true })
  const rows = invoiceQuery.data
  // The actionable list — every invoice still owing, fetched with the
  // server-side balance filter so the page cap can never hide an unpaid one.
  const openInvoiceQuery = useInvoices({ customer_id: customer.id, per_page: 200, balance: 'open', include_bill_to: true })
  const openRows = openInvoiceQuery.data
  // True totals over ALL invoices (tab counts + truncation notice).
  const { data: summaryRes } = useQuery({
    queryKey: ['customer-invoice-summary', customer.id],
    queryFn: () =>
      apiRequest<{ data: CustomerInvoiceSummary }>(`/v1/customers/${customer.id}/invoice-summary`),
    staleTime: 30_000,
  })
  const summary = summaryRes?.data ?? null
  const sendInvoice = useSendInvoice()
  const markPaid = useMarkInvoicePaid()
  const cancelInv = useCancelInvoice()
  const deleteInv = useDeleteInvoice()
  const [actionError, setActionError] = useState<string | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid' | 'cancelled'>('all')
  const selectedQuery = filter === 'unpaid' ? openInvoiceQuery : invoiceQuery
  const { isLoading, isError, error } = selectedQuery

  const allInvoices = rows ?? []
  // Filter buckets. "Unpaid" = anything with outstanding balance and
  // not cancelled (covers draft, sent, partially paid). "Paid" =
  // fully paid OR explicit status=paid. "Cancelled" = soft hidden in
  // most views, surfaced for office reconciliation only.
  const unpaidInvoices = openRows ?? []
  const paidInvoices = allInvoices.filter(
    (i) => i.status !== 'cancelled' && (i.money?.amount_paid_cents ?? 0) >= (i.money?.total_cents ?? 0) && (i.money?.total_cents ?? 0) > 0,
  )
  const cancelledInvoices = allInvoices.filter((i) => i.status === 'cancelled')
  const invoices =
    filter === 'unpaid'
      ? unpaidInvoices
      : filter === 'paid'
        ? paidInvoices
        : filter === 'cancelled'
          ? cancelledInvoices
          : allInvoices

  function fmtMoney(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  }

  // Dealer view: an invoice whose customer isn't THIS customer is one billed
  // TO them from a sub-account job — tag it with whose job it was.
  const billedFor = (inv: Invoice): string | null =>
    inv.customer_id && inv.customer_id !== customer.id ? (inv.customer?.display_name ?? 'sub-account') : null

  async function handleSend(id: string) {
    setActionError(null)
    try { await sendInvoice.mutateAsync(id) } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }
  async function handleMarkPaid(id: string, totalCents: number) {
    setActionError(null)
    const method = window.prompt('Payment method (e.g. Check #1234, Visa, ACH):')
    if (method === null) return
    try {
      await markPaid.mutateAsync({
        id,
        input: {
          amount_paid_cents: totalCents,
          payment_method: method || null,
        },
      })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }
  async function handleCancel(id: string) {
    if (!window.confirm('Cancel this invoice? It can no longer be sent or paid.')) return
    setActionError(null)
    try { await cancelInv.mutateAsync(id) } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }
  async function handleDelete(inv: Invoice) {
    // Confirmation handled by the global delete modal (password + reason).
    setActionError(null)
    try { await deleteInv.mutateAsync(inv.id) } catch (e) {
      if (!isDeleteCancelled(e)) setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">Invoices</h2>
          <p className="text-xs text-navy-500 mt-1">
            Bills sent to {customer.display_name}. v1: one invoice per work order, payment marked as a single lump sum.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setReceivePaymentOpen(true)}
            className="text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium whitespace-nowrap"
            title="Apply one check/card/cash payment across multiple invoices"
          >
            Receive payment
          </button>
          <CustomerStatementButton customer={customer} />
          <button
            type="button"
            onClick={() => setCreatorOpen(true)}
            className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium whitespace-nowrap"
          >
            + New invoice
          </button>
        </div>
      </div>

      {receivePaymentOpen && (
        <ReceivePaymentModal
          customerId={customer.id}
          customerName={customer.display_name}
          onClose={() => setReceivePaymentOpen(false)}
        />
      )}

      {/* Customer credits — down-payments + overpayment leftovers that
          haven't been applied to an invoice yet. Show before the
          invoice list so the office sees them while reviewing what's
          owed. Apply button opens a modal to draw down to a specific
          invoice. */}
      <CustomerCreditsSection customerId={customer.id} />

      {/* Sub-tab filter — defaults to "All" but "Unpaid" is where the
          office spends most of their time at month-end. */}
      <div role="group" aria-label="Customer invoice filters" className="flex flex-wrap gap-1 mb-3 border-b border-slate-200">
        <SubTab active={filter === 'all'} onClick={() => setFilter('all')}>
          All ({summary?.invoice_count ?? (invoiceQuery.isSuccess ? allInvoices.length : '—')})
        </SubTab>
        <SubTab
          active={filter === 'unpaid'}
          onClick={() => setFilter('unpaid')}
          highlight={unpaidInvoices.length > 0}
        >
          Unpaid ({summary?.open_count ?? (openInvoiceQuery.isSuccess ? unpaidInvoices.length : '—')})
        </SubTab>
        <SubTab active={filter === 'paid'} onClick={() => setFilter('paid')}>
          Paid ({summary?.paid_count ?? (invoiceQuery.isSuccess ? paidInvoices.length : '—')})
        </SubTab>
        {cancelledInvoices.length > 0 && (
          <SubTab
            active={filter === 'cancelled'}
            onClick={() => setFilter('cancelled')}
          >
            Cancelled ({cancelledInvoices.length})
          </SubTab>
        )}
      </div>

      {actionError && (
        <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {actionError}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-700">
          Failed to load invoices.{error instanceof Error ? ` ${error.message}` : ''}
          <button type="button" onClick={() => { void selectedQuery.refetch() }} disabled={selectedQuery.isFetching} className="ml-2 underline disabled:opacity-50">Retry</button>
        </p>
      )}
      {!isLoading && !isError && invoices.length === 0 && (
        <div className="text-center text-sm text-slate-500 py-8">
          {filter === 'all' ? 'No invoices yet.' : 'No invoices match this filter.'}{' '}
          <button
            type="button"
            onClick={() => setCreatorOpen(true)}
            className="text-amber-700 hover:underline font-medium"
          >
            Create an invoice
          </button>
          .
        </div>
      )}
      {!isLoading && !isError && invoices.length > 0 && (
        <>
          {filter !== 'unpaid' && summary && summary.invoice_count > allInvoices.length && (
            <p className="mb-2 text-xs text-slate-500">
              Showing the latest {allInvoices.length} of {summary.invoice_count.toLocaleString()} invoices —
              totals above cover all of them.
            </p>
          )}
          {/* Mobile cards — tap the invoice number to go to detail.
              Action buttons (Send/Mark paid/Cancel) move into a small
              row at the bottom of the card so they're not lost in a
              cramped table. */}
          <div className="md:hidden space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/invoices/${inv.id}`}
                      className="font-mono text-xs text-slate-700 hover:text-amber-700"
                    >
                      {inv.invoice_number}
                    </Link>
                    {billedFor(inv) && (
                      <div className="text-[11px] text-slate-500 truncate">For: {billedFor(inv)}</div>
                    )}
                  </div>
                  <InvoiceStatusPill status={inv.status} overdue={inv.is_overdue} />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <div className="text-xs text-slate-500">
                    {inv.issued_at
                      ? new Date(inv.issued_at).toLocaleDateString()
                      : '—'}
                    {inv.due_at && (
                      <>
                        {' '}· due{' '}
                        {new Date(inv.due_at).toLocaleDateString()}
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-slate-900">
                      {fmtMoney(inv.money.total_cents)}
                    </div>
                    {inv.money.balance_due_cents > 0 && (
                      <div className="font-mono text-xs text-red-700">
                        {fmtMoney(inv.money.balance_due_cents)} due
                      </div>
                    )}
                  </div>
                </div>
                {/* Action row — buttons wrap; minimum touch target ~36px */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {inv.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => handleSend(inv.id)}
                      disabled={sendInvoice.isPending}
                      className="text-xs px-3 py-1.5 rounded border border-amber-500 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                    >
                      Send
                    </button>
                  )}
                  {(inv.status === 'sent' || inv.status === 'draft') && (
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(inv.id, inv.money.total_cents)}
                      disabled={markPaid.isPending}
                      className="text-xs px-3 py-1.5 rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Mark paid
                    </button>
                  )}
                  {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(inv.id)}
                      className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  )}
                  {inv.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(inv)}
                      className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table — unchanged */}
          <div className="hidden md:block overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Invoice #</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                <th className="text-right px-4 py-2 font-medium">Balance</th>
                <th className="text-left px-4 py-2 font-medium">Due</th>
                <th className="text-left px-4 py-2 font-medium">Issued</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      to={`/invoices/${inv.id}`}
                      className="text-slate-700 hover:text-amber-700 hover:underline"
                    >
                      {inv.invoice_number}
                    </Link>
                    {billedFor(inv) && (
                      <div className="text-[11px] font-sans text-slate-500">For: {billedFor(inv)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusPill status={inv.status} overdue={inv.is_overdue} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {fmtMoney(inv.money.total_cents)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {fmtMoney(inv.money.balance_due_cents)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {inv.due_at ? new Date(inv.due_at).toLocaleDateString() : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {inv.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleSend(inv.id)}
                          disabled={sendInvoice.isPending}
                          className="text-xs px-2.5 py-1 rounded border border-amber-500 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Send
                        </button>
                      )}
                      {(inv.status === 'sent' || inv.status === 'draft') && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(inv.id, inv.money.total_cents)}
                          disabled={markPaid.isPending}
                          className="text-xs px-2.5 py-1 rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      )}
                      {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(inv.id)}
                          className="text-xs px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      )}
                      {inv.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(inv)}
                          className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {creatorOpen && (
        <InvoiceCreatorModal
          isOpen
          onClose={() => setCreatorOpen(false)}
          customer={customer}
        />
      )}
    </section>
  )
}

function InvoiceStatusPill({ status, overdue }: { status: InvoiceStatus; overdue: boolean }) {
  const display = overdue && (status === 'sent' || status === 'draft') ? 'overdue' : status
  const styles: Record<string, string> = {
    draft:     'bg-slate-100 text-slate-700',
    sent:      'bg-sky-50 text-sky-700 border border-sky-200',
    paid:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
    cancelled: 'bg-slate-100 text-slate-500',
    overdue:   'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] uppercase font-medium tracking-wide ${styles[display] ?? styles.draft}`}>
      {display}
    </span>
  )
}

// ============================================================
// Customer-specific template overrides
// ============================================================

interface DocTemplateRow {
  id: string
  name: string
  type: string
  title: string
  active: boolean
  is_default: boolean
}

/** Doc types we let customers override. Mirrors DocumentTemplate::TYPES. */
const OVERRIDABLE_DOC_TYPES: Array<{ value: string; label: string; hint: string }> = [
  { value: 'statement', label: 'Statement', hint: 'Monthly account statement layout for this customer.' },
  { value: 'invoice',    label: 'Invoice',    hint: 'Used when invoicing this customer.' },
  { value: 'receipt',    label: 'Receipt',    hint: 'Used when issuing a paid receipt.' },
  { value: 'estimate',   label: 'Estimate',   hint: 'Used when sending an estimate / quote.' },
  { value: 'work_order', label: 'Work Order', hint: 'Used when generating an onsite work order.' },
  { value: 'sub_work_order', label: 'Sub Work Order', hint: 'Used when this job is subbed out to a vendor partner.' },
  { value: 'contract',   label: 'Contract',   hint: 'Used for service contracts / agreements.' },
  { value: 'inspection', label: 'Inspection', hint: 'Used for inspection reports.' },
]

function CustomerTemplatesTab({ customer }: { customer: Customer }) {
  const qc = useQueryClient()
  // All tenant document templates, grouped by type so the dropdowns
  // only show options matching the row's doc type.
  const templates = useQuery({
    queryKey: ['document-templates', 'for-overrides'],
    queryFn: () =>
      apiRequest<{ data: DocTemplateRow[] }>('/v1/document-templates?active=true'),
    staleTime: 30_000,
  })
  // Active SMS templates — the text-message dropdown lists all of them
  // (SMS templates aren't doc-typed; the customer picks one per category).
  const smsTemplates = useQuery({
    queryKey: ['sms-templates', 'for-overrides'],
    queryFn: () =>
      apiRequest<{ data: Array<{ id: string; name: string; category: string }> }>(
        '/v1/sms-templates?active=true',
      ),
    staleTime: 30_000,
  })
  const overrides = useQuery({
    queryKey: ['customer-template-overrides', customer.id],
    queryFn: () =>
      apiRequest<{ data: { overrides: Record<string, string>; sms_overrides: Record<string, string> } }>(
        `/v1/customers/${customer.id}/template-overrides`,
      ),
  })

  const [draft, setDraft] = useState<Record<string, string>>({})
  const [smsDraft, setSmsDraft] = useState<Record<string, string>>({})
  const [hydrated, setHydrated] = useState(false)

  // Seed both drafts from the server response on first load.
  if (!hydrated && overrides.data?.data) {
    setDraft(overrides.data.data.overrides ?? {})
    setSmsDraft(overrides.data.data.sms_overrides ?? {})
    setHydrated(true)
  }

  const save = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { overrides: Record<string, string> } }>(
        `/v1/customers/${customer.id}/template-overrides`,
        { method: 'PUT', body: { overrides: draft, sms_overrides: smsDraft } },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-template-overrides', customer.id] })
    },
  })

  function setOverride(type: string, templateId: string) {
    setDraft((prev) => {
      const next = { ...prev }
      if (templateId) next[type] = templateId
      else delete next[type]
      return next
    })
  }

  function setSmsOverride(type: string, templateId: string) {
    setSmsDraft((prev) => {
      const next = { ...prev }
      if (templateId) next[type] = templateId
      else delete next[type]
      return next
    })
  }

  const smsChoices = smsTemplates.data?.data ?? []
  const smsLabel = (id: string) => smsChoices.find((t) => t.id === id)?.name ?? id

  const templatesByType: Record<string, DocTemplateRow[]> = {}
  for (const t of templates.data?.data ?? []) {
    ;(templatesByType[t.type] ||= []).push(t)
  }

  function templateLabel(tplId: string): string {
    for (const list of Object.values(templatesByType)) {
      const found = list.find((t) => t.id === tplId)
      if (found) return found.name
    }
    return tplId
  }

  return (
    <div className="space-y-4">
      <CustomerFormWorkflowCards customer={customer} />
      <section className="bg-white rounded-lg border border-navy-100 p-6">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">
          Templates for this customer
        </h2>
        <a href={`${CONNECT_URL}/custom-documents`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-amber-700 hover:underline">
          Create templates in Connect ↗ <span className="sr-only">(opens in a new tab)</span>
        </a>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !hydrated}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save overrides'}
        </button>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed mb-5">
        Pin a specific template for each doc type when this customer needs a different
        layout than your default. Anything left as <strong>Use tenant default</strong>{' '}
        falls back to whichever template you&apos;ve marked as the default on the{' '}
        <a href={`${CONNECT_URL}/custom-documents`} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">
          Templates &amp; Forms
        </a>{' '}
        page.
      </p>

      {save.isError && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          {(save.error as Error).message}
        </div>
      )}
      {save.data && (
        <div className="mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
          ✓ Overrides saved.
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {OVERRIDABLE_DOC_TYPES.map((dt) => {
          const choices = templatesByType[dt.value] ?? []
          const selected = draft[dt.value] ?? ''
          const defaultTpl = choices.find((c) => c.is_default)
          return (
            <div key={dt.value} className="py-3 flex items-start gap-4 flex-wrap">
              <div className="min-w-[180px] flex-1">
                <div className="text-sm font-medium text-slate-900">{dt.label}</div>
                <div className="text-[11px] text-slate-500">{dt.hint}</div>
              </div>
              <div className="flex-[2] min-w-[260px]">
                <select
                  value={selected}
                  onChange={(e) => setOverride(dt.value, e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
                >
                  <option value="">
                    Use tenant default{defaultTpl ? ` (${defaultTpl.name})` : ' (none set)'}
                  </option>
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.is_default ? ' · default' : ''}
                    </option>
                  ))}
                </select>
                {choices.length === 0 && (
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    No {dt.label.toLowerCase()} templates yet.{' '}
                    <Link to="/custom-documents" className="text-amber-700 hover:underline">
                      Create one
                    </Link>
                    .
                  </p>
                )}
                {selected && (
                  <p className="text-[11px] text-emerald-700 mt-1">
                    ★ This customer gets <strong>{templateLabel(selected)}</strong> for{' '}
                    {dt.label.toLowerCase()}s.
                  </p>
                )}

                {/* Text (SMS) message template for this category. */}
                <div className="mt-2">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Text message
                  </label>
                  <select
                    value={smsDraft[dt.value] ?? ''}
                    onChange={(e) => setSmsOverride(dt.value, e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
                  >
                    <option value="">— No text for {dt.label.toLowerCase()} —</option>
                    {smsChoices.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {smsDraft[dt.value] && (
                    <p className="text-[11px] text-emerald-700 mt-1">
                      ✆ Texts this customer <strong>{smsLabel(smsDraft[dt.value])}</strong> for{' '}
                      {dt.label.toLowerCase()}s.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
    </div>
  )
}

function CustomerFormWorkflowCards({ customer }: { customer: Customer }) {
  const { has } = usePermissions()
  const [showSteps, setShowSteps] = useState(() => {
    try {
      return localStorage.getItem('crewbarn:customer-form-workflow-steps') !== 'off'
    } catch {
      return true
    }
  })
  const cards = [
    {
      title: 'Customer document packet',
      body: 'Keep tax forms, agreements, COIs, third-party work orders, and signed paperwork on this account.',
      steps: ['Open Documents', 'Upload or extract the file', 'Attach it to future jobs when needed'],
      to: `/customers/${customer.id}?tab=documents`,
      action: 'Open documents',
    },
    {
      title: 'Private secure records',
      body: 'Store sensitive customer records behind permission and access approval.',
      steps: ['Request access', 'View in overlay', 'Update the encrypted record'],
      to: `/customers/${customer.id}?tab=secure-files`,
      action: 'Open secure files',
      visible: has('customers.secure_files.list') || has('customers.secure_files.manage'),
    },
    {
      title: 'Customer-specific forms',
      body: 'Pin special invoice, work order, estimate, receipt, or inspection templates for only this customer.',
      steps: ['Choose the form type below', 'Select the customer override', 'Save overrides'],
      to: '/custom-documents',
      action: 'Manage all forms',
    },
  ].filter((card) => card.visible !== false)

  function toggleSteps() {
    setShowSteps((current) => {
      const next = !current
      try {
        localStorage.setItem('crewbarn:customer-form-workflow-steps', next ? 'on' : 'off')
      } catch {
        /* non-fatal */
      }
      return next
    })
  }

  return (
    <section className="rounded-lg border border-navy-100 bg-white p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy-800">
            Form workflows for this customer
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Start with the kind of paperwork this account needs, then use the controls below for
            exact template overrides.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleSteps}
          className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold ${
            showSteps
              ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Step-by-step {showSteps ? 'on' : 'off'}
        </button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.to}
            className="flex min-h-[175px] flex-col rounded-lg border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-amber-300 hover:bg-amber-50/60"
          >
            <h3 className="text-sm font-semibold text-navy-900">{card.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{card.body}</p>
            {showSteps && (
              <ol className="mt-3 space-y-1 text-[11px] text-slate-500">
                {card.steps.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
            <span className="mt-auto pt-3 text-xs font-semibold text-amber-700">
              {card.action} →
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ============================================================
// Customer credits (down payments + overpayment leftovers)
// ============================================================

interface CustomerCreditRow {
  id: string
  source_type: string
  payment_id: string | null
  amount_cents: number
  balance_cents: number
  notes: string | null
  created_at: string | null
}

function CustomerCreditsSection({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ['customer-credits', customerId],
    queryFn: () =>
      apiRequest<{ data: CustomerCreditRow[] }>(`/v1/customers/${customerId}/credits`),
  })
  const credits = q.data?.data ?? []
  const [applying, setApplying] = useState<CustomerCreditRow | null>(null)

  if (q.isLoading) return null
  if (credits.length === 0) return null

  const total = credits.reduce((acc, c) => acc + c.balance_cents, 0)

  return (
    <section className="mb-4 bg-sky-50 border border-sky-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-sky-900 uppercase tracking-wider">
            Available credits
          </h3>
          <p className="text-xs text-sky-800 mt-1">
            Customer has{' '}
            <strong className="font-mono">
              ${(total / 100).toFixed(2)}
            </strong>{' '}
            on account — apply to outstanding invoices below.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {credits.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 bg-white border border-sky-200 rounded p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-900">
                <span className="font-mono font-semibold">
                  ${(c.balance_cents / 100).toFixed(2)}
                </span>
                {c.balance_cents < c.amount_cents && (
                  <span className="ml-2 text-[11px] text-slate-500">
                    ({((c.balance_cents / c.amount_cents) * 100).toFixed(0)}% of $
                    {(c.amount_cents / 100).toFixed(2)} remaining)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {c.source_type.replace(/_/g, ' ')}
                {c.created_at && ` · ${new Date(c.created_at).toLocaleDateString()}`}
              </div>
              {c.notes && (
                <div className="text-[11px] text-slate-600 italic mt-1">{c.notes}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setApplying(c)}
              className="text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded px-3 py-1.5 shrink-0"
            >
              Apply to invoice →
            </button>
          </div>
        ))}
      </div>

      {applying && (
        <ApplyCreditModal
          credit={applying}
          customerId={customerId}
          onClose={() => setApplying(null)}
        />
      )}
    </section>
  )
}
