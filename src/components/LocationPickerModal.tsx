import { useState, useEffect } from 'react'
import type { Customer, CustomerServiceLocation } from '@/types/customer'
import type { CustomerServiceLocationInput } from '@/lib/customerServiceLocations'
import {
  useCreateCustomerServiceLocation,
  useUpdateCustomerServiceLocation,
} from '@/hooks/useCustomerServiceLocations'
import { Modal } from '@/components/ui/Modal'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'

/**
 * LocationPickerModal — pick a service location for a customer, or add a new one.
 *
 * Owns its own state and side effects. Returns a service_location_id string
 * to the caller via onSelect. If the user adds a new location, this modal
 * POSTs it to the customer's service-locations endpoint internally, then
 * returns the newly created location's id. Caller never deals with raw
 * location data.
 *
 * Two views, internal state-machine:
 *   - 'list' (default): saved locations + "Add new" CTA
 *   - 'add':  inline address fields + Save/Cancel
 */

interface LocationPickerModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer
  /** Currently selected location id (highlighted in the list, if present) */
  selectedLocationId?: string
  /** Called when the user picks an existing location OR after a successful create */
  onSelect: (locationId: string, location: CustomerServiceLocation) => void
  /** Force opening directly into add or edit view (used by customer detail page) */
  initialView?: 'list' | 'add' | 'edit'
  /** Location id to edit on open — pairs with initialView='edit' */
  initialEditId?: string
}

type View = 'list' | 'add' | 'edit'

function blankNewLocation(): CustomerServiceLocationInput {
  return {
    nickname: '',
    street_address: '',
    apt_unit: '',
    city: '',
    state: '',
    postal_code: '',
    gated_property: false,
    gate_code: '',
    entry_notes: '',
    is_primary: false,
    active: true,
  }
}

function locationLabel(loc: CustomerServiceLocation): string {
  if (loc.nickname) return loc.nickname
  const addr = loc.address
  if (!addr) return 'Unnamed location'
  const parts = [addr.street_address, addr.city, addr.state].filter(Boolean)
  return parts.join(', ') || 'Unnamed location'
}

function locationAddress(loc: CustomerServiceLocation): string {
  const addr = loc.address
  if (!addr) return ''
  if (addr.formatted) return addr.formatted
  const parts = [
    addr.street_address,
    addr.apt_unit,
    addr.city,
    addr.state,
    addr.postal_code,
  ].filter(Boolean)
  return parts.join(', ')
}

export function LocationPickerModal({
  isOpen,
  onClose,
  customer,
  selectedLocationId,
  onSelect,
  initialView,
  initialEditId,
}: LocationPickerModalProps) {
  const [view, setView] = useState<View>('list')
  const [draft, setDraft] = useState<CustomerServiceLocationInput>(blankNewLocation())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({})
  const [query, setQuery] = useState('')

  const createLocation = useCreateCustomerServiceLocation()
  const updateLocation = useUpdateCustomerServiceLocation()

  // Reset internal state every time the modal opens
  useEffect(() => {
    if (isOpen) {
      const locations = customer.service_locations ?? []
      // Caller-forced view wins; otherwise fall back to "zero locations → add"
      if (initialView === 'edit' && initialEditId) {
        const loc = locations.find((l) => l.id === initialEditId)
        if (loc) {
          handleEdit(loc)
          return
        }
      }
      if (initialView === 'add') {
        setView('add')
      } else {
        setView(locations.length === 0 ? 'add' : 'list')
      }
      setDraft(blankNewLocation())
      setEditingId(null)
      setErrors({})
      setServerErrors({})
      setQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, customer.id, initialView, initialEditId])

  function handleEdit(loc: CustomerServiceLocation) {
    setDraft({
      nickname:        loc.nickname        ?? '',
      street_address:  loc.address?.street_address ?? '',
      apt_unit:        loc.address?.apt_unit       ?? '',
      city:            loc.address?.city           ?? '',
      state:           loc.address?.state          ?? '',
      postal_code:     loc.address?.postal_code    ?? '',
      country:         loc.address?.country        ?? '',
      latitude:        loc.coordinates?.latitude   ?? null,
      longitude:       loc.coordinates?.longitude  ?? null,
      gated_property:  loc.gated_property,
      gate_code:       loc.gate_code       ?? '',
      entry_notes:     loc.entry_notes     ?? '',
      is_primary:      loc.is_primary,
      active:          loc.active,
    })
    setEditingId(loc.id)
    setErrors({})
    setServerErrors({})
    setView('edit')
  }

  const locations = customer.service_locations ?? []
  const q = query.trim().toLowerCase()
  const filteredLocations = q
    ? locations.filter((loc) =>
        `${locationLabel(loc)} ${locationAddress(loc)}`.toLowerCase().includes(q),
      )
    : locations

  function handlePick(loc: CustomerServiceLocation) {
    onSelect(loc.id, loc)
    onClose()
  }

  function updateDraft(patch: Partial<CustomerServiceLocationInput>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function validateDraft(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!draft.street_address?.trim()) errs.street_address = 'Street address is required'
    if (!draft.city?.trim()) errs.city = 'City is required'
    if (!draft.state?.trim()) errs.state = 'State is required'
    return errs
  }

  async function handleSaveEdit() {
    if (!editingId) return
    const errs = validateDraft()
    setErrors(errs)
    setServerErrors({})
    if (Object.keys(errs).length > 0) return

    try {
      const updated = await updateLocation.mutateAsync({
        customerId: customer.id,
        locationId: editingId,
        input: draft,
      })
      onSelect(updated.id, updated)
      onClose()
    } catch (err) {
      const errObj = err as {
        status?: number
        payload?: { errors?: Record<string, string[]> }
      }
      if (errObj?.status === 422 && errObj?.payload?.errors) {
        setServerErrors(errObj.payload.errors)
      } else {
        alert('Failed to update location: ' + String(err))
      }
    }
  }

  async function handleSaveNew() {
    const errs = validateDraft()
    setErrors(errs)
    setServerErrors({})
    if (Object.keys(errs).length > 0) return

    try {
      const created = await createLocation.mutateAsync({
        customerId: customer.id,
        input: draft,
      })
      onSelect(created.id, created)
      onClose()
    } catch (err) {
      const errObj = err as {
        status?: number
        payload?: { errors?: Record<string, string[]> }
      }
      if (errObj?.status === 422 && errObj?.payload?.errors) {
        setServerErrors(errObj.payload.errors)
      } else {
        alert('Failed to save location: ' + String(err))
      }
    }
  }

  function fieldError(name: string): string | undefined {
    if (errors[name]) return errors[name]
    const server = serverErrors[name]
    if (server && server.length > 0) return server[0]
    return undefined
  }

  const subtitle = `${customer.display_name}${
    customer.account_number != null ? ` · #${customer.account_number}` : ''
  }`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        view === 'list'
          ? 'Pick a service location'
          : view === 'edit'
            ? 'Edit service location'
            : 'Add a service location'
      }
      subtitle={subtitle}
      size="lg"
      disableBackdropClose={(view === 'add' || view === 'edit') && hasUnsavedDraft(draft)}
    >
      {view === 'list' && (
        <>
          <Modal.Body>
            {locations.length === 0 ? (
              <div className="text-sm text-slate-600 py-6 text-center">
                This customer has no service locations on file.
              </div>
            ) : (
              <>
                {locations.length > 6 && (
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search locations by name or address…"
                    autoFocus
                    className="w-full mb-3 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                )}
                {filteredLocations.length === 0 ? (
                  <div className="text-sm text-slate-500 py-6 text-center">
                    No locations match “{query}”.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {filteredLocations.map((loc) => {
                  const isSelected = loc.id === selectedLocationId
                  return (
                    <li
                      key={loc.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        isSelected
                          ? 'bg-amber-50 border-amber-300'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          {/* Title row — nickname + badges, comfortably spaced */}
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 mb-1">
                            <span className="font-semibold text-slate-900 text-base">
                              {locationLabel(loc)}
                            </span>
                            {loc.is_primary && (
                              <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
                                Primary
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
                                Currently selected
                              </span>
                            )}
                          </div>
                          {locationAddress(loc) && (
                            <div className="text-sm text-slate-600 leading-relaxed">
                              {locationAddress(loc)}
                            </div>
                          )}
                          {loc.gated_property && (
                            <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                              <span aria-hidden>🔒</span>
                              <span>Gated property</span>
                              {loc.entry_notes && (
                                <span className="text-slate-400"> — {loc.entry_notes}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePick(loc)}
                            disabled={isSelected}
                            className="px-3 py-1.5 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {isSelected ? 'Selected' : 'Use this'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(loc)}
                            className="px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                    })}
                  </ul>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setView('add')}
              className="px-4 py-2 text-sm font-medium border border-amber-600 text-amber-700 hover:bg-amber-50 rounded-md"
            >
              + Add new location
            </button>
          </Modal.Footer>
        </>
      )}

      {(view === 'add' || view === 'edit') && (
        <>
          <Modal.Body>
            <div className="text-xs text-slate-600 mb-4">
              {view === 'edit' ? (
                <>
                  Editing this location updates it everywhere it's used —
                  past jobs, future jobs, the schedule, the map.
                </>
              ) : (
                <>
                  This location will be saved to{' '}
                  <strong>{customer.display_name}</strong> for future jobs.
                </>
              )}
            </div>
            <div className="space-y-3">
              <Field label="Nickname (optional)">
                <input
                  type="text"
                  value={draft.nickname ?? ''}
                  onChange={(e) => updateDraft({ nickname: e.target.value })}
                  placeholder='e.g., "Rental — Cocoa Beach"'
                  className={inputClass()}
                />
              </Field>
              <Field
                label="Street Address"
                required
                error={fieldError('street_address')}
              >
                <AddressAutocomplete
                  value={draft.street_address ?? ''}
                  onChange={(v) => updateDraft({ street_address: v })}
                  onPlaceSelected={(parsed) => {
                    const street = [parsed.street_number, parsed.route].filter(Boolean).join(' ')
                    updateDraft({
                      street_address: street || parsed.formatted_address,
                      city: parsed.city ?? draft.city,
                      state: parsed.state ?? draft.state,
                      postal_code: parsed.postal_code ?? draft.postal_code,
                      country: parsed.country ?? draft.country,
                      latitude: parsed.lat ?? draft.latitude,
                      longitude: parsed.lng ?? draft.longitude,
                    })
                  }}
                  placeholder="Start typing an address…"
                  className={inputClass(fieldError('street_address'))}
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Apt/Unit">
                  <input
                    type="text"
                    value={draft.apt_unit ?? ''}
                    onChange={(e) => updateDraft({ apt_unit: e.target.value })}
                    className={inputClass()}
                  />
                </Field>
                <Field label="City" required error={fieldError('city')}>
                  <input
                    type="text"
                    value={draft.city ?? ''}
                    onChange={(e) => updateDraft({ city: e.target.value })}
                    className={inputClass(fieldError('city'))}
                  />
                </Field>
                <Field label="State" required error={fieldError('state')}>
                  <input
                    type="text"
                    value={draft.state ?? ''}
                    onChange={(e) => updateDraft({ state: e.target.value })}
                    maxLength={2}
                    placeholder="FL"
                    className={inputClass(fieldError('state'))}
                  />
                </Field>
                <Field label="Zip">
                  <input
                    type="text"
                    value={draft.postal_code ?? ''}
                    onChange={(e) => updateDraft({ postal_code: e.target.value })}
                    className={inputClass()}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!draft.gated_property}
                  onChange={(e) => updateDraft({ gated_property: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Gated property</span>
              </label>
              {draft.gated_property && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6 border-l-2 border-amber-200">
                  <Field label="Gate Code">
                    <input
                      type="text"
                      value={draft.gate_code ?? ''}
                      onChange={(e) => updateDraft({ gate_code: e.target.value })}
                      className={inputClass()}
                    />
                  </Field>
                  <Field label="Entry Notes">
                    <input
                      type="text"
                      value={draft.entry_notes ?? ''}
                      onChange={(e) => updateDraft({ entry_notes: e.target.value })}
                      placeholder="Where to park, who to ask for, etc."
                      className={inputClass()}
                    />
                  </Field>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm pt-2">
                <input
                  type="checkbox"
                  checked={!!draft.is_primary}
                  onChange={(e) => updateDraft({ is_primary: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Set as customer&apos;s primary location</span>
                {locations.length > 0 && (
                  <span className="text-xs text-slate-500">
                    (will demote the current primary)
                  </span>
                )}
              </label>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={() => {
                if (view === 'add' && locations.length === 0) {
                  onClose()
                } else {
                  setView('list')
                  setDraft(blankNewLocation())
                  setEditingId(null)
                  setErrors({})
                  setServerErrors({})
                }
              }}
              disabled={createLocation.isPending || updateLocation.isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
            >
              {view === 'add' && locations.length === 0 ? 'Cancel' : '← Back'}
            </button>
            <button
              type="button"
              onClick={view === 'edit' ? handleSaveEdit : handleSaveNew}
              disabled={createLocation.isPending || updateLocation.isPending}
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
            >
              {view === 'edit'
                ? (updateLocation.isPending ? 'Updating…' : 'Save changes')
                : (createLocation.isPending ? 'Saving…' : 'Save & Use')}
            </button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  )
}

// ---------- Helpers ----------

function hasUnsavedDraft(d: CustomerServiceLocationInput): boolean {
  return !!(
    d.nickname ||
    d.street_address ||
    d.apt_unit ||
    d.city ||
    d.state ||
    d.postal_code ||
    d.gate_code ||
    d.entry_notes
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function inputClass(error?: string): string {
  const base =
    'w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'
  return base + (error ? ' border-red-300' : ' border-slate-300')
}