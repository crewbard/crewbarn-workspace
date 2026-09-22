import { useState, useMemo } from "react"
import {
  useTaxClasses,
  useCreateTaxClass,
  useUpdateTaxClass,
  useDeleteTaxClass,
  useCreateTaxClassComponent,
  useUpdateTaxClassComponent,
  useDeleteTaxClassComponent,
} from "@/hooks/useTaxClasses"
import { ApiError } from "@/lib/api"
import { lookupSalesTaxRate } from "@/lib/salesTax"
import type {
  TaxClass,
  TaxClassComponent,
  TaxClassComponentInput,
} from "@/types/taxClass"
import { Button } from "@/components/ui/Button"

// ---------- Page ----------

export function TaxClassesPage() {
  const { data, isLoading, isError, error } = useTaxClasses({ per_page: 100 })
  const [editing, setEditing] = useState<TaxClass | null>(null)
  const [creating, setCreating] = useState(false)

  const taxClasses = data?.data ?? []
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <PageHeader onNew={() => setCreating(true)} />

      {isError && (
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6">
          <p className="text-sm text-red-700">
            Failed to load tax classes.
            {error instanceof Error ? ` ${error.message}` : ""}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 animate-pulse">
          <div className="h-5 w-40 bg-slate-200 rounded mb-6" />
          <div className="space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        </div>
      )}

      {!isLoading && !isError && (
        <TaxClassesTable taxClasses={taxClasses} onEdit={setEditing} />
      )}

      {creating && <CreateTaxClassModal onClose={() => setCreating(false)} />}
      {editing && (
        <EditTaxClassModal
          taxClass={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function PageHeader({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Tax Classes</h1>
        <p className="text-sm text-slate-600 mt-1">
          Composite tax rates applied to catalog line items. Each tax class is the sum of its components — split for tax remittance reporting.
        </p>
      </div>
      <Button size="sm" onClick={onNew} className="whitespace-nowrap shrink-0">
        + New Tax Class
      </Button>
    </div>
  )
}

// ---------- Table ----------

function TaxClassesTable({
  taxClasses,
  onEdit,
}: {
  taxClasses: TaxClass[]
  onEdit: (tc: TaxClass) => void
}) {
  // Toggle the default flag inline from the table. Star button is a
  // true two-way toggle: ☆ → click to set; ★ → click to clear. Backend
  // single-default invariant clears the prior default automatically
  // when a new one is set.
  const updateTaxClass = useUpdateTaxClass()
  function toggleDefault(tc: TaxClass) {
    updateTaxClass.mutate({ id: tc.id, input: { is_default: !tc.is_default } })
  }

  if (taxClasses.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
        <p className="text-sm text-slate-600">
          No tax classes yet. Create one to start applying tax to your catalog items.
        </p>
      </div>
    )
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left px-6 py-3 font-medium">Name</th>
            <th className="text-right px-6 py-3 font-medium">Total Rate</th>
            <th className="text-left px-6 py-3 font-medium">Jurisdiction</th>
            <th className="text-left px-6 py-3 font-medium">Components</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {taxClasses.map((tc) => (
            <tr key={tc.id} className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {/* Star toggle. Filled amber = default for this
                      tenant; outline = not default. Click toggles. */}
                  <button
                    type="button"
                    onClick={() => toggleDefault(tc)}
                    disabled={updateTaxClass.isPending}
                    className={`text-xl leading-none disabled:opacity-50 transition-colors ${
                      tc.is_default
                        ? 'text-amber-500 hover:text-amber-600'
                        : 'text-slate-300 hover:text-amber-400'
                    }`}
                    aria-pressed={tc.is_default}
                    title={
                      tc.is_default
                        ? 'Default tax class — click to clear'
                        : 'Click to make this the default tax class for new invoice lines'
                    }
                  >
                    {tc.is_default ? '★' : '☆'}
                  </button>
                  <div>
                    <div className="font-medium text-slate-900">{tc.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{tc.slug}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-right font-mono font-semibold text-slate-900">
                {Number(tc.rate_pct).toFixed(3)}%
              </td>
              <td className="px-6 py-4 text-slate-700">{tc.jurisdiction || "—"}</td>
              <td className="px-6 py-4">
                {tc.components.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No components</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {tc.components.map((c) => (
                      <span
                        key={c.id}
                        className="text-xs px-2 py-0.5 bg-slate-100 rounded font-mono"
                        title={c.remit_to ? `Remit to: ${c.remit_to}` : undefined}
                      >
                        {c.name} · {Number(c.rate_pct).toFixed(3)}%
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(tc)}
                  className="text-sm text-slate-600 hover:text-amber-600"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Create modal (components-first) ----------

interface DraftComponent {
  localKey: string
  name: string
  rate_pct: number | string
  jurisdiction: string
  remit_to: string
}

function CreateTaxClassModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("")
  const [jurisdiction, setJurisdiction] = useState("")
  const [components, setComponents] = useState<DraftComponent[]>([
    { localKey: "c1", name: "", rate_pct: 0, jurisdiction: "", remit_to: "" },
  ])

  // Prefill from ZIP via the configured sales-tax provider. Fills the
  // components below; the owner confirms before saving.
  const [zip, setZip] = useState("")
  const [zipBusy, setZipBusy] = useState(false)
  const [zipError, setZipError] = useState<string | null>(null)

  const searchByZip = async () => {
    setZipBusy(true)
    setZipError(null)
    try {
      const r = await lookupSalesTaxRate(zip.trim())
      if (!name.trim()) setName(`Sales Tax — ${r.jurisdiction}`)
      if (!jurisdiction.trim()) setJurisdiction(r.jurisdiction)
      if (r.components.length > 0) {
        setComponents(
          r.components.map((c, i) => ({
            localKey: `z${i}-${Date.now()}`,
            name: c.name,
            rate_pct: c.rate_pct,
            jurisdiction: c.jurisdiction ?? "",
            remit_to: c.remit_to ?? "",
          })),
        )
      }
    } catch (e) {
      setZipError(e instanceof ApiError ? e.message : "Lookup failed — enter the rate manually.")
    } finally {
      setZipBusy(false)
    }
  }

  const createMutation = useCreateTaxClass()

  const totalRate = useMemo(
    () => components.reduce((sum, c) => sum + (Number(c.rate_pct) || 0), 0),
    [components]
  )

  const canSave =
    name.trim().length > 0 &&
    components.some((c) => c.name.trim().length > 0) &&
    !createMutation.isPending

  const handleSave = () => {
    const cleaned: TaxClassComponentInput[] = components
      .filter((c) => c.name.trim().length > 0)
      .map((c, idx) => ({
        name: c.name.trim(),
        rate_pct: Number(c.rate_pct) || 0,
        jurisdiction: c.jurisdiction.trim() || null,
        remit_to: c.remit_to.trim() || null,
        sort_order: idx,
      }))

    createMutation.mutate(
      {
        name: name.trim(),
        jurisdiction: jurisdiction.trim() || null,
        components: cleaned,
      },
      { onSuccess: () => onClose() }
    )
  }

  const addRow = () => {
    setComponents([
      ...components,
      {
        localKey: `c${Date.now()}`,
        name: "",
        rate_pct: 0,
        jurisdiction: "",
        remit_to: "",
      },
    ])
  }

  const removeRow = (key: string) => {
    setComponents(components.filter((c) => c.localKey !== key))
  }

  const updateRow = (key: string, patch: Partial<DraftComponent>) => {
    setComponents(
      components.map((c) => (c.localKey === key ? { ...c, ...patch } : c))
    )
  }

  const serverError =
    createMutation.isError
      ? createMutation.error instanceof ApiError
        ? createMutation.error.message
        : "Failed to create tax class."
      : null

  return (
    <ModalShell title="New Tax Class" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Prefill from ZIP code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && zip.trim().length >= 5) searchByZip()
              }}
              placeholder="e.g. 32904"
              className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={searchByZip}
              disabled={zipBusy || zip.trim().length < 5}
              className="px-3 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
            >
              {zipBusy ? "Searching…" : "Search"}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pulls state + county/city rates and fills the components below. Confirm before saving;
            add other service areas manually.
          </p>
          {zipError && <p className="text-xs text-red-700 mt-1">{zipError}</p>}
        </div>

        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Florida sales tax — Brevard County"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            autoFocus
          />
        </Field>
        <Field label="Jurisdiction (parent label, optional)">
          <input
            type="text"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="e.g. Brevard County, FL"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-700 uppercase tracking-wide">
              Components
            </label>
            <button
              type="button"
              onClick={addRow}
              className="text-xs text-amber-600 hover:underline font-medium"
            >
              + Add component
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Components are the source of truth — total rate is the sum of all components. Remit_to drives tax remittance reports.
          </p>

          <div className="space-y-3">
            {components.map((c) => (
              <div
                key={c.localKey}
                className="border border-slate-200 rounded-md p-3 space-y-2"
              >
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Component name (e.g. FL state)"
                    value={c.name}
                    onChange={(e) => updateRow(c.localKey, { name: e.target.value })}
                    className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                  />
                  <div className="relative w-28">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={c.rate_pct}
                      onChange={(e) =>
                        updateRow(c.localKey, { rate_pct: e.target.value })
                      }
                      className="w-full text-sm pl-3 pr-7 py-2 border border-slate-200 rounded font-mono focus:outline-none focus:border-amber-500"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 text-sm">
                      %
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(c.localKey)}
                    className="text-slate-400 hover:text-red-600 px-2"
                    aria-label="Remove component"
                    disabled={components.length === 1}
                    title={components.length === 1 ? "Need at least one component" : "Remove"}
                  >
                    ×
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Jurisdiction (e.g. FL)"
                    value={c.jurisdiction}
                    onChange={(e) =>
                      updateRow(c.localKey, { jurisdiction: e.target.value })
                    }
                    className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Remit to (e.g. FL Dept of Revenue)"
                    value={c.remit_to}
                    onChange={(e) => updateRow(c.localKey, { remit_to: e.target.value })}
                    className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-600">Total rate</span>
            <span className="font-mono font-semibold text-slate-900">
              {totalRate.toFixed(3)}%
            </span>
          </div>
        </div>

        {serverError && <ErrorBanner message={serverError} />}
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={createMutation.isPending} disabled={!canSave}>
          Create tax class
        </Button>
      </ModalFooter>
    </ModalShell>
  )
}

// ---------- Edit modal ----------

function EditTaxClassModal({
  taxClass,
  onClose,
}: {
  taxClass: TaxClass
  onClose: () => void
}) {
  const [name, setName] = useState(taxClass.name)
  const [jurisdiction, setJurisdiction] = useState(taxClass.jurisdiction ?? "")

  const updateMutation = useUpdateTaxClass()
  const deleteMutation = useDeleteTaxClass()
  const createComponent = useCreateTaxClassComponent()
  const updateComponent = useUpdateTaxClassComponent()
  const deleteComponent = useDeleteTaxClassComponent()

  const dirty =
    name.trim() !== taxClass.name ||
    (jurisdiction.trim() || null) !== (taxClass.jurisdiction ?? null)

  const handleSaveParent = () => {
    if (!dirty) return
    updateMutation.mutate({
      id: taxClass.id,
      input: {
        name: name.trim(),
        jurisdiction: jurisdiction.trim() || null,
      },
    })
  }

  const handleAddComponent = () => {
    createComponent.mutate({
      taxClassId: taxClass.id,
      input: {
        name: "New component",
        rate_pct: 0,
        sort_order: taxClass.components.length,
      },
    })
  }

  const handleUpdateComponent = (
    component: TaxClassComponent,
    patch: Partial<TaxClassComponentInput>
  ) => {
    updateComponent.mutate({
      taxClassId: taxClass.id,
      componentId: component.id,
      input: patch,
    })
  }

  const handleDeleteComponent = (componentId: string) => {
    deleteComponent.mutate({ taxClassId: taxClass.id, componentId })
  }

  const handleDelete = () => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate(taxClass.id, { onSuccess: () => onClose() })
  }

  const serverError =
    updateMutation.isError
      ? updateMutation.error instanceof ApiError
        ? updateMutation.error.message
        : "Failed to update tax class."
      : null

  return (
    <ModalShell title={`Edit: ${taxClass.name}`} onClose={onClose}>
      <div className="p-6 space-y-4">
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
        </Field>
        <Field label="Jurisdiction">
          <input
            type="text"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
        </Field>

        {dirty && (
          <div className="flex items-center justify-end gap-3 -mt-1">
            <button
              type="button"
              onClick={() => {
                setName(taxClass.name)
                setJurisdiction(taxClass.jurisdiction ?? "")
              }}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              Discard parent changes
            </button>
            <button
              type="button"
              onClick={handleSaveParent}
              disabled={updateMutation.isPending}
              className="text-xs px-3 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving…" : "Save name/jurisdiction"}
            </button>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-700 uppercase tracking-wide">
              Components — total rate {Number(taxClass.rate_pct).toFixed(3)}%
            </label>
            <button
              type="button"
              onClick={handleAddComponent}
              disabled={createComponent.isPending}
              className="text-xs text-amber-600 hover:underline font-medium disabled:opacity-50"
            >
              {createComponent.isPending ? "Adding…" : "+ Add component"}
            </button>
          </div>
          {taxClass.components.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-2">
              No components — total rate is 0%.
            </div>
          ) : (
            <div className="space-y-3">
              {taxClass.components.map((c) => (
                <ComponentRowExisting
                  key={c.id}
                  component={c}
                  onSave={(patch) => handleUpdateComponent(c, patch)}
                  onDelete={() => handleDeleteComponent(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {serverError && <ErrorBanner message={serverError} />}
      </div>

      <ModalFooter>
        <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending} className="mr-auto">
          Delete tax class
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </ModalShell>
  )
}

function ComponentRowExisting({
  component,
  onSave,
  onDelete,
}: {
  component: TaxClassComponent
  onSave: (patch: Partial<TaxClassComponentInput>) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(component.name)
  const [rate, setRate] = useState<number | string>(Number(component.rate_pct))
  const [jurisdiction, setJurisdiction] = useState(component.jurisdiction ?? "")
  const [remitTo, setRemitTo] = useState(component.remit_to ?? "")

  const dirty =
    name.trim() !== component.name ||
    Number(rate) !== Number(component.rate_pct) ||
    jurisdiction.trim() !== (component.jurisdiction ?? "") ||
    remitTo.trim() !== (component.remit_to ?? "")

  return (
    <div className="border border-slate-200 rounded-md p-3 space-y-2">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
        />
        <div className="relative w-28">
          <input
            type="number"
            step="0.001"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full text-sm pl-3 pr-7 py-2 border border-slate-200 rounded font-mono focus:outline-none focus:border-amber-500"
          />
          <span className="absolute right-3 top-2 text-slate-400 text-sm">%</span>
        </div>
        {dirty ? (
          <button
            type="button"
            onClick={() =>
              onSave({
                name: name.trim(),
                rate_pct: Number(rate) || 0,
                jurisdiction: jurisdiction.trim() || null,
                remit_to: remitTo.trim() || null,
              })
            }
            className="text-xs px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium"
          >
            Save
          </button>
        ) : (
          <span className="text-xs text-slate-400 px-2">saved</span>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-400 hover:text-red-600 px-2"
          aria-label="Delete component"
        >
          ×
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Jurisdiction"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
        />
        <input
          type="text"
          placeholder="Remit to"
          value={remitTo}
          onChange={(e) => setRemitTo(e.target.value)}
          className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
        />
      </div>
    </div>
  )
}

// ---------- Reusable bits ----------

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 26, 46, 0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
      {children}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 bg-red-50 border border-red-100 rounded">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  )
}
