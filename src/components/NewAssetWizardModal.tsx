import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AssetGroupTreePicker } from '@/components/AssetGroupTreePicker'
import { AssetGroupManagerModal } from '@/components/AssetGroupManagerModal'
import { QrScanButton } from '@/components/QrScanButton'
import { AssetQrCard } from '@/components/AssetQrCard'
import { AssetPhotoUploader } from '@/components/AssetPhotoUploader'
import { AssetDocumentUploader } from '@/components/AssetDocumentUploader'
import { AssetComponentsManager } from '@/components/AssetComponentsManager'
import { AssetCustomFieldsForm, assetCustomFieldsAreValid, normalizeAssetCustomFields } from '@/components/AssetCustomFieldsForm'
import type { Asset } from '@/types/asset'
import { useCreateCustomer, useCustomer, useCustomers } from '@/hooks/useCustomers'
import { useCreateCustomerServiceLocation } from '@/hooks/useCustomerServiceLocations'
import { useAssetTypes, useCreateAssetType } from '@/hooks/useAssetTypes'
import { useCreateAsset } from '@/hooks/useAssets'
import type { Customer, CustomerInput, CustomerServiceLocation } from '@/types/customer'
import type { AssetType, InspectionCadence } from '@/types/assetType'
import { INSPECTION_CADENCES, INSPECTION_CADENCE_LABELS } from '@/types/assetType'

/**
 * NewAssetWizardModal — Slice 13c.
 *
 * Single Modal with content that swaps based on the current step:
 *   1. customer-pick   — typeahead, with [+ New customer] sub-step
 *   2. customer-create — minimal inline create form
 *   3. location-pick   — list customer's locations + [+ New location]
 *   4. location-create — minimal inline create form
 *   5. group-pick      — tree picker for the chosen location (optional)
 *   6. asset-details   — final asset form
 *
 * Implements the "Modal Layer 1, content swaps" pattern from
 * CREWBARN-ASSET-LIFECYCLE-DESIGN.md (lines 302-345). User stays in the
 * same modal the entire time; back arrow returns to the previous step.
 *
 * Pre-selection via initialCustomer / initialLocation lets the wizard
 * start at a later step (entry from a customer or location detail page).
 */

type WizardStep =
  | 'customer-pick'
  | 'customer-create'
  | 'location-pick'
  | 'location-create'
  | 'group-pick'
  | 'asset-details'
  | 'asset-created'

interface NewAssetWizardModalProps {
  isOpen: boolean
  onClose: () => void
  initialCustomer?: Customer | null
  initialLocation?: CustomerServiceLocation | null
  /** Called after asset creation succeeds with the created asset id. */
  onCreated?: (assetId: string) => void
}

export function NewAssetWizardModal({
  isOpen,
  onClose,
  initialCustomer,
  initialLocation,
  onCreated,
}: NewAssetWizardModalProps) {
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer ?? null)
  const [location, setLocation] = useState<CustomerServiceLocation | null>(
    initialLocation ?? null
  )
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState<string>('')
  const [createdAsset, setCreatedAsset] = useState<Asset | null>(null)

  // The reload-customer hook: when we create a new customer or location
  // via the inline forms, the new entity isn't on the customer object yet
  // (it's on a separate API response). Refetching the customer pulls in
  // the new service_locations array so the location picker shows it.
  const refreshedCustomer = useCustomer(customer?.id)

  const [step, setStep] = useState<WizardStep>(() => {
    if (initialLocation) return 'group-pick'
    if (initialCustomer) return 'location-pick'
    return 'customer-pick'
  })

  // Reset state when modal opens fresh
  useEffect(() => {
    if (!isOpen) return
    setCustomer(initialCustomer ?? null)
    setLocation(initialLocation ?? null)
    setGroupId(null)
    setGroupName('')
    setCreatedAsset(null)
    if (initialLocation) setStep('group-pick')
    else if (initialCustomer) setStep('location-pick')
    else setStep('customer-pick')
  }, [isOpen, initialCustomer, initialLocation])

  // After we refetch the customer post-create, splice the latest version
  // into our local customer state so the location picker sees the fresh
  // service_locations array.
  useEffect(() => {
    if (refreshedCustomer.data && customer && refreshedCustomer.data.id === customer.id) {
      setCustomer(refreshedCustomer.data)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshedCustomer.data])

  // Header text per step
  const { title, subtitle } = useMemo(() => {
    switch (step) {
      case 'customer-pick':
        return { title: 'New Asset — pick a customer', subtitle: 'Step 1 of 4' }
      case 'customer-create':
        return { title: 'New Asset — create customer', subtitle: 'Step 1 of 4' }
      case 'location-pick':
        return {
          title: 'New Asset — pick a service location',
          subtitle: customer ? customer.display_name : 'Step 2 of 4',
        }
      case 'location-create':
        return {
          title: 'New Asset — add a service location',
          subtitle: customer ? customer.display_name : 'Step 2 of 4',
        }
      case 'group-pick':
        return {
          title: 'New Asset — pick a group (optional)',
          subtitle: locationLabel(location),
        }
      case 'asset-details':
        return {
          title: 'New Asset — one asset details',
          subtitle: locationLabel(location),
        }
      case 'asset-created':
        return {
          title: createdAsset ? `${createdAsset.name} — finish setup` : 'Asset created',
          subtitle: 'Add a photo, print sticker, attach documents, install components',
        }
    }
  }, [step, customer, location, createdAsset])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="lg"
      disableBackdropClose
    >
      {step === 'customer-pick' && (
        <CustomerPickStep
          onPick={(c) => {
            setCustomer(c)
            setStep('location-pick')
          }}
          onCreateNew={() => setStep('customer-create')}
          onCancel={onClose}
        />
      )}

      {step === 'customer-create' && (
        <CustomerCreateStep
          onCreated={(c) => {
            setCustomer(c)
            setStep('location-pick')
          }}
          onCancel={() => setStep('customer-pick')}
        />
      )}

      {step === 'location-pick' && customer && (
        <LocationPickStep
          customer={customer}
          onPick={(loc) => {
            setLocation(loc)
            setGroupId(null)
            setGroupName('')
            setStep('group-pick')
          }}
          onCreateNew={() => setStep('location-create')}
          onBack={initialCustomer ? null : () => setStep('customer-pick')}
          onCancel={onClose}
        />
      )}

      {step === 'location-create' && customer && (
        <LocationCreateStep
          customer={customer}
          onCreated={(loc) => {
            setLocation(loc)
            setGroupId(null)
            setGroupName('')
            // Trigger customer refetch so future steps see the new location
            refreshedCustomer.refetch()
            setStep('group-pick')
          }}
          onCancel={() => setStep('location-pick')}
        />
      )}

      {step === 'group-pick' && customer && location && (
        <GroupPickStep
          location={location}
          selectedGroupId={groupId}
          onSelect={(id, name) => {
            setGroupId(id)
            setGroupName(name)
          }}
          onContinue={() => setStep('asset-details')}
          onSkip={() => {
            setGroupId(null)
            setGroupName('')
            setStep('asset-details')
          }}
          onBack={initialLocation ? null : () => setStep('location-pick')}
          onCancel={onClose}
        />
      )}

      {step === 'asset-details' && customer && location && (
        <AssetDetailsStep
          customer={customer}
          location={location}
          groupId={groupId}
          groupName={groupName}
          onBack={() => setStep('group-pick')}
          onCancel={onClose}
          onCreated={(asset) => {
            setCreatedAsset(asset)
            setStep('asset-created')
          }}
        />
      )}

      {step === 'asset-created' && createdAsset && (
        <AssetCreatedStep
          asset={createdAsset}
          onDone={() => {
            onCreated?.(createdAsset.id)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}

// ============================================================
// Step 1 — Customer pick
// ============================================================

function CustomerPickStep({
  onPick,
  onCreateNew,
  onCancel,
}: {
  onPick: (c: Customer) => void
  onCreateNew: () => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // 250ms debounce so we don't spam the search endpoint on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(handle)
  }, [query])

  // Only query the server when the user has typed something - no recent list
  // pre-loaded (Patrick's note: results should be silent until you type).
  const customersQuery = useCustomers(
    debouncedQuery.length >= 1 ? { q: debouncedQuery, per_page: 25 } : {}
  )
  const enabled = debouncedQuery.length >= 1
  const results = enabled ? customersQuery.data?.data ?? [] : []
  const hasTyped = query.length > 0
  const showLoading = enabled && customersQuery.isFetching
  const showEmpty = enabled && !customersQuery.isFetching && results.length === 0

  return (
    <>
      <Modal.Body className="min-h-[260px]">
        <div className="space-y-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers by name or account #..."
            className="w-full text-sm px-3 py-2.5 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            autoFocus
          />

          {!hasTyped && (
            <div className="text-center text-xs text-slate-500 py-6">
              Start typing to search customers
            </div>
          )}

          {hasTyped && showLoading && (
            <div className="text-center text-xs text-slate-500 py-3">
              Searching…
            </div>
          )}

          {hasTyped && !showLoading && results.length > 0 && (
            <ul className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-amber-50 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {c.display_name}
                      </div>
                      {c.account_number != null && (
                        <div className="text-xs text-slate-500">
                          Account #{c.account_number}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {c.customer_type}
                    </span>
                    <span className="text-amber-600 text-xs flex-shrink-0">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {hasTyped && showEmpty && (
            <div className="text-center text-xs text-slate-500 py-6">
              No customers match "{query}".
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={onCreateNew}
              className="text-sm text-amber-700 hover:underline font-medium"
            >
              + Add new customer
            </button>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
      </Modal.Footer>
    </>
  )
}

// ============================================================
// Step 1.5 — Customer create (minimal)
// ============================================================

function CustomerCreateStep({
  onCreated,
  onCancel,
}: {
  onCreated: (c: Customer) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<'residential' | 'commercial'>('residential')
  const [businessName, setBusinessName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateCustomer()

  const canSave =
    !createMutation.isPending &&
    (type === 'commercial'
      ? businessName.trim().length > 0
      : firstName.trim().length > 0 || lastName.trim().length > 0)

  async function handleSave() {
    setError(null)
    const displayName =
      type === 'commercial'
        ? businessName.trim()
        : `${firstName.trim()} ${lastName.trim()}`.trim()
    const input: CustomerInput = {
      display_name: displayName,
      customer_type: type,
      business_name: type === 'commercial' ? businessName.trim() : null,
      first_name: type === 'residential' ? firstName.trim() || null : null,
      last_name: type === 'residential' ? lastName.trim() || null : null,
    }
    try {
      const created = await createMutation.mutateAsync(input)
      // Phone, email, contacts handled via the customer detail page after
      // the wizard completes — keeps this step minimal.
      onCreated(created)
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <>
      <Modal.Body>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Customer type
            </label>
            <div className="flex gap-2">
              <TypePill
                active={type === 'residential'}
                onClick={() => setType('residential')}
              >
                Residential
              </TypePill>
              <TypePill
                active={type === 'commercial'}
                onClick={() => setType('commercial')}
              >
                Commercial
              </TypePill>
            </div>
          </div>

          {type === 'commercial' ? (
            <Field label="Business name" required>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputClass()}
                placeholder='e.g. "Memorial Hospital"'
                autoFocus
              />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass()}
                  autoFocus
                />
              </Field>
              <Field label="Last name">
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass()}
                />
              </Field>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Phone, email, address, and other details can be filled in on the
            customer page after you finish creating the asset.
          </p>

          {error && (
            <div className="text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
              {error}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? 'Creating...' : 'Create & continue'}
        </button>
      </Modal.Footer>
    </>
  )
}

// ============================================================
// Step 2 — Location pick
// ============================================================

function LocationPickStep({
  customer,
  onPick,
  onCreateNew,
  onBack,
  onCancel,
}: {
  customer: Customer
  onPick: (loc: CustomerServiceLocation) => void
  onCreateNew: () => void
  onBack: (() => void) | null
  onCancel: () => void
}) {
  const locations = customer.service_locations ?? []
  return (
    <>
      <Modal.Body>
        {locations.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-sm text-slate-600">
              {customer.display_name} has no service locations yet.
            </div>
            <button
              type="button"
              onClick={onCreateNew}
              className="text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium"
            >
              + Add the first one
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 -my-2">
            {locations.map((loc) => (
              <li key={loc.id} className="py-2">
                <button
                  type="button"
                  onClick={() => onPick(loc)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 -mx-3 rounded hover:bg-amber-50 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {locationLabel(loc)}
                      {loc.is_primary && (
                        <span className="ml-2 text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {locationAddress(loc)}
                    </div>
                  </div>
                  <span className="text-amber-600 text-xs">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal.Body>
      <Modal.Footer>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 mr-auto"
          >
            ← Back
          </button>
        )}
        {locations.length > 0 && (
          <button
            type="button"
            onClick={onCreateNew}
            className="px-4 py-2 text-sm font-medium border border-amber-600 text-amber-700 hover:bg-amber-50 rounded-md"
          >
            + Add new location
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
      </Modal.Footer>
    </>
  )
}

// ============================================================
// Step 2.5 — Location create (minimal)
// ============================================================

function LocationCreateStep({
  customer,
  onCreated,
  onCancel,
}: {
  customer: Customer
  onCreated: (loc: CustomerServiceLocation) => void
  onCancel: () => void
}) {
  const [nickname, setNickname] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [stateAbbr, setStateAbbr] = useState('')
  const [postal, setPostal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateCustomerServiceLocation()

  const canSave =
    !createMutation.isPending && street.trim().length > 0 && city.trim().length > 0

  async function handleSave() {
    setError(null)
    try {
      const created = await createMutation.mutateAsync({
        customerId: customer.id,
        input: {
          nickname: nickname.trim() || null,
          street_address: street.trim(),
          city: city.trim(),
          state: stateAbbr.trim() || null,
          postal_code: postal.trim() || null,
        },
      })
      onCreated(created)
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <>
      <Modal.Body>
        <div className="space-y-3">
          <Field label="Nickname (optional)">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder='e.g. "Main Campus"'
              className={inputClass()}
              autoFocus
            />
          </Field>
          <Field label="Street address" required>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className={inputClass()}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City" required>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field label="State">
              <input
                type="text"
                value={stateAbbr}
                onChange={(e) => setStateAbbr(e.target.value)}
                maxLength={2}
                placeholder="FL"
                className={inputClass()}
              />
            </Field>
            <Field label="Zip">
              <input
                type="text"
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                className={inputClass()}
              />
            </Field>
          </div>
          {error && (
            <div className="text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
              {error}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? 'Saving...' : 'Save & continue'}
        </button>
      </Modal.Footer>
    </>
  )
}

// ============================================================
// Step 3 — Group pick (optional)
// ============================================================

function GroupPickStep({
  location,
  selectedGroupId,
  onSelect,
  onContinue,
  onSkip,
  onBack,
  onCancel,
}: {
  location: CustomerServiceLocation
  selectedGroupId: string | null
  onSelect: (id: string | null, name: string) => void
  onContinue: () => void
  onSkip: () => void
  onBack: (() => void) | null
  onCancel: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)

  const selectedLabel = selectedGroupId ? selectedGroupId : null

  return (
    <>
      <Modal.Body>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Optionally place this asset within a sub-group of the location
            (e.g. Building C → Floor 3 → Room 305). Skip if you don't use
            groups, or pick "(no group)" in the picker.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex-1 text-left text-sm px-3 py-2 border border-slate-300 rounded bg-white hover:bg-slate-50"
            >
              {selectedLabel ?? <span className="text-slate-400">No group selected</span>}
            </button>
            {selectedGroupId && (
              <button
                type="button"
                onClick={() => onSelect(null, '')}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setManagerOpen(true)}
              className="text-xs text-amber-700 hover:text-amber-800"
            >
              Manage…
            </button>
          </div>

          {/* Picker + Manager modals — these stack on top of the wizard */}
          <AssetGroupTreePicker
            isOpen={pickerOpen}
            onClose={() => setPickerOpen(false)}
            customerServiceLocationId={location.id}
            selectedGroupId={selectedGroupId}
            onSelect={(id, group) => onSelect(id, group?.name ?? '')}
            onManageClick={() => {
              setPickerOpen(false)
              setManagerOpen(true)
            }}
          />
          <AssetGroupManagerModal
            isOpen={managerOpen}
            onClose={() => setManagerOpen(false)}
            customerServiceLocationId={location.id}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 mr-auto"
          >
            ← Back
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md"
        >
          Skip group
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!selectedGroupId}
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </Modal.Footer>
    </>
  )
}

// ============================================================
// Step 4 — Asset details (final)
// ============================================================

function AssetDetailsStep({
  customer,
  location,
  groupId,
  groupName,
  onBack,
  onCancel,
  onCreated,
}: {
  customer: Customer
  location: CustomerServiceLocation
  groupId: string | null
  groupName: string
  onBack: () => void
  onCancel: () => void
  onCreated: (asset: Asset) => void
}) {
  const { data: typesData } = useAssetTypes({ active: true, per_page: 200 })
  const types: AssetType[] = typesData?.data ?? []

  const [name, setName] = useState('')
  const [assetTypeId, setAssetTypeId] = useState('')
  const [assetCode, setAssetCode] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [installDate, setInstallDate] = useState('')
  const [notes, setNotes] = useState('')
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({})
  const [cadence, setCadence] = useState<InspectionCadence | ''>('')
  const [isSecured, setIsSecured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateAsset()
  const selectedType = types.find((type) => type.id === assetTypeId)

  // Auto-inherit cadence from selected asset type
  useEffect(() => {
    if (!assetTypeId) return
    const t = types.find((x) => x.id === assetTypeId)
    if (t?.default_inspection_cadence && !cadence) setCadence(t.default_inspection_cadence)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetTypeId])

  const canSave =
    !createMutation.isPending &&
    name.trim().length > 0 &&
    assetTypeId.length > 0 &&
    assetCustomFieldsAreValid(selectedType, customFields)

  async function handleSave() {
    setError(null)
    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        asset_type_id: assetTypeId,
        customer_service_location_id: location.id,
        asset_group_id: groupId,
        asset_code: assetCode.trim() || null,
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
        serial_number: serialNumber.trim() || null,
        install_date: installDate || null,
        notes: notes.trim() || null,
        custom_fields: normalizeAssetCustomFields(customFields, selectedType),
        inspection_cadence: cadence || null,
        is_secured: isSecured,
        active: true,
      })
      onCreated(created)
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <>
      <Modal.Body>
        <div className="space-y-4">
          <div className="text-xs text-slate-600 -mt-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded space-y-1">
            <div>
              <span className="font-medium text-slate-700">This creates one specific asset at:</span>{' '}
              {customer.display_name} → {locationLabel(location)}
              {groupId && groupName && <> → {groupName}</>}
            </div>
            <div>Use Manage groups → Build with CrewBarn when you need to create a full floor, building, or repeated asset tree.</div>
          </div>

          <Field label="Asset name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fire Door 101, Lobby Camera 2, Main Lobby Safe"
              className={inputClass()}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset type" required>
              <div className="space-y-1">
                <select
                  value={assetTypeId}
                  onChange={(e) => setAssetTypeId(e.target.value)}
                  className={inputClass() + ' bg-white'}
                >
                  <option value="">— Select type —</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon ? `${t.icon} ` : ''}
                      {t.name}
                    </option>
                  ))}
                </select>
                <InlineNewAssetType onCreated={(t) => setAssetTypeId(t.id)} />
              </div>
            </Field>
            <Field label="Asset code or QR sticker">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value)}
                  placeholder="Scan or type, blank = system generates"
                  className={inputClass() + ' font-mono'}
                />
                <QrScanButton
                  onScan={(c) => setAssetCode(c)}
                  buttonLabel="📷"
                  buttonClassName="flex-shrink-0 text-sm px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium whitespace-nowrap"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Manufacturer">
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field label="Model">
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field label="Serial number">
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className={inputClass() + ' font-mono'}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Install date">
              <input
                type="date"
                value={installDate}
                onChange={(e) => setInstallDate(e.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field label="Cadence">
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as InspectionCadence | '')}
                className={inputClass() + ' bg-white'}
              >
                <option value="">— Inherit from type —</option>
                {INSPECTION_CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {INSPECTION_CADENCE_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <AssetCustomFieldsForm
            assetType={selectedType}
            values={customFields}
            onChange={setCustomFields}
          />

          <Field label="Notes (internal)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass() + ' resize-y'}
            />
          </Field>

          <label className="flex items-start gap-2 text-sm pt-2 border-t border-slate-100">
            <input
              type="checkbox"
              checked={isSecured}
              onChange={(e) => setIsSecured(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span>
              <span className="font-medium">🔒 Secured asset</span>
              <span className="block text-xs text-slate-500">
                Sensitive data on this asset (drill points, master codes)
                stored encrypted. Slice 9 inspector access flow gates viewing.
              </span>
            </span>
          </label>

          {error && (
            <div className="text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
              {error}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 mr-auto"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? 'Creating...' : 'Create asset & add photos'}
        </button>
      </Modal.Footer>
    </>
  )
}

// ============================================================
// Helpers
// ============================================================

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function inputClass(): string {
  return 'w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
}

function TypePill({
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
      className={
        'px-4 py-2 text-sm rounded-md border transition-colors ' +
        (active
          ? 'bg-amber-600 border-amber-600 text-white'
          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50')
      }
    >
      {children}
    </button>
  )
}

// ============================================================
// Step 5 — Asset created (post-create attachments)
// ============================================================

/**
 * After the asset row is saved, swap to this view so the user can
 * print the QR sticker, drop in photos, attach documents, and install
 * components — all without leaving the modal. Mirrors the bottom half
 * of the existing AssetForm edit mode (which is gated on existingAsset).
 */
function AssetCreatedStep({
  asset,
  onDone,
}: {
  asset: Asset
  onDone: () => void
}) {
  return (
    <>
      <Modal.Body>
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3 text-sm text-emerald-900">
            <span className="font-medium">✓ Asset created.</span>{' '}
            <span className="text-emerald-700">
              Add a clear photo so techs and inspectors can identify this exact asset.
              Display label: <span className="font-medium">{asset.display_label}</span>
            </span>
          </div>

          <Section
            title="Asset photo"
            description="Upload the real door, panel, camera, extinguisher, or equipment photo before moving on."
          >
            <AssetPhotoUploader assetId={asset.id} />
          </Section>

          <Section title="QR sticker">
            <AssetQrCard
              assetId={asset.id}
              assetName={asset.name}
              assetCode={asset.asset_code}
            />
          </Section>

          <Section title="Documents">
            <AssetDocumentUploader assetId={asset.id} />
          </Section>

          <Section title="Installed components">
            <AssetComponentsManager assetId={asset.id} />
          </Section>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white"
        >
          Done
        </button>
      </Modal.Footer>
    </>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          {title}
        </h3>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  )
}

/**
 * InlineNewAssetType — small expandable form below the asset-type select
 * for creating a new type without leaving the wizard. Same inline-create
 * spirit as the customer + location steps; just a much smaller form
 * because asset types only need a name to be useful (icon + cadence
 * optional, custom fields configured later from the AssetTypesPage).
 */
function InlineNewAssetType({ onCreated }: { onCreated: (t: AssetType) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [cadence, setCadence] = useState<InspectionCadence | ''>('')
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateAssetType()

  const canSave = !createMutation.isPending && name.trim().length > 0

  async function handleSave() {
    setError(null)
    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        icon: icon.trim() || null,
        default_inspection_cadence: cadence || null,
      })
      onCreated(created)
      // reset and collapse
      setName('')
      setIcon('')
      setCadence('')
      setOpen(false)
    } catch (err) {
      setError(extractError(err))
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-amber-700 hover:underline font-medium"
      >
        + New asset type
      </button>
    )
  }

  return (
    <div className="border border-amber-200 rounded p-2 bg-amber-50/50 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Type name (e.g. "Fire Door")'
          className="flex-1 text-sm px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
          autoFocus
        />
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🚪"
          maxLength={4}
          className="w-14 text-sm px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500 text-center"
          title="Optional emoji icon"
        />
      </div>
      <select
        value={cadence}
        onChange={(e) => setCadence(e.target.value as InspectionCadence | '')}
        className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500 bg-white"
      >
        <option value="">— Default cadence (optional) —</option>
        {INSPECTION_CADENCES.map((c) => (
          <option key={c} value={c}>
            {INSPECTION_CADENCE_LABELS[c]}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-xs px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50"
        >
          {createMutation.isPending ? 'Saving...' : 'Save type'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setName('')
            setIcon('')
            setCadence('')
            setError(null)
          }}
          className="text-xs text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600 ml-auto">{error}</span>}
      </div>
    </div>
  )
}

function locationLabel(loc: CustomerServiceLocation | null): string | undefined {
  if (!loc) return undefined
  return loc.nickname || loc.address?.street_address || 'Service location'
}

function locationAddress(loc: CustomerServiceLocation): string {
  const a = loc.address
  if (!a) return ''
  const parts = [a.street_address, a.city, a.state].filter(Boolean)
  return parts.join(', ')
}

function extractError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
