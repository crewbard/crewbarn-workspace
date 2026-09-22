import { useState, useMemo, useEffect } from "react"
import {
  useCatalogItems,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
} from "@/hooks/useCatalogItems"
import {
  useCatalogCategories,
  useCreateCatalogCategory,
} from "@/hooks/useCatalogCategories"
import { useTaxClasses } from "@/hooks/useTaxClasses"
import { ApiError } from "@/lib/api"
import type { CatalogItem, CatalogItemInput } from "@/types/catalogItem"
import type { CatalogCategory } from "@/types/catalogCategory"
import type { TaxClass } from "@/types/taxClass"
import { ImageUploadPlaceholder } from "@/components/ImageUploadPlaceholder"

// ---------- Page ----------

export function ServiceCatalogPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError, error } = useCatalogItems({
    type: "service",
    q: debouncedSearch || undefined,
    per_page: 50,
  })

  const items = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <PageHeader
        search={search}
        onSearchChange={setSearch}
        onNew={() => setCreating(true)}
      />

      {isError && (
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6">
          <p className="text-sm text-red-700">
            Failed to load catalog items.
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
        <>
          <ItemsTable items={items} onEdit={setEditing} />
          {meta && (
            <div className="text-xs text-slate-500 text-right">
              Showing {items.length} of {meta.total} services
              {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
            </div>
          )}
        </>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} />}
      {editing && <EditModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PageHeader({
  search,
  onSearchChange,
  onNew,
}: {
  search: string
  onSearchChange: (s: string) => void
  onNew: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Service Catalog</h1>
          <p className="text-sm text-slate-600 mt-1">
            Billable services — labor, dispatch, inspections. Use the search to find by name, description, or part number.
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors flex-shrink-0"
        >
          + New Service
        </button>
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search services..."
        className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
      />
    </div>
  )
}

// ---------- Table ----------

function ItemsTable({
  items,
  onEdit,
}: {
  items: CatalogItem[]
  onEdit: (item: CatalogItem) => void
}) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
        <p className="text-sm text-slate-600">
          No services yet. Click "+ New Service" to add one.
        </p>
      </div>
    )
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left px-6 py-3 font-medium">Name</th>
            <th className="text-left px-6 py-3 font-medium">Category</th>
            <th className="text-right px-6 py-3 font-medium">Price</th>
            <th className="text-left px-6 py-3 font-medium">Tax</th>
            <th className="text-left px-6 py-3 font-medium">Unit</th>
            <th className="text-center px-6 py-3 font-medium">Active</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <div className="font-medium text-slate-900">{item.name}</div>
                {item.sku && (
                  <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
                )}
              </td>
              <td className="px-6 py-4 text-slate-700">
                {item.service_category?.name || "—"}
              </td>
              <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                {item.pricing.customer_cost_formatted}
              </td>
              <td className="px-6 py-4 text-slate-700">
                {item.tax_class ? (
                  <span className="text-xs">
                    {item.tax_class.name}
                    <span className="text-slate-400 ml-1">
                      ({Number(item.tax_class.rate_pct).toFixed(2)}%)
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">No tax</span>
                )}
              </td>
              <td className="px-6 py-4 text-slate-700 text-xs">{item.unit_label}</td>
              <td className="px-6 py-4 text-center">
                {item.active ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                    Inactive
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
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

// ---------- Form state ----------

interface ServiceFormState {
  name: string
  sku: string
  service_category_id: string
  description: string
  internal_description: string
  internal_notes: string
  unit_label: string
  default_quantity: string
  customer_cost_dollars: string
  owner_cost_dollars: string
  tax_class_id: string
  active: boolean
  labor_warranty_days: string
}

const emptyForm: ServiceFormState = {
  name: "",
  sku: "",
  service_category_id: "",
  description: "",
  internal_description: "",
  internal_notes: "",
  unit_label: "hour",
  default_quantity: "1",
  customer_cost_dollars: "",
  owner_cost_dollars: "",
  tax_class_id: "",
  active: true,
  labor_warranty_days: "",
}

function formStateFromItem(item: CatalogItem): ServiceFormState {
  return {
    name: item.name,
    sku: item.sku ?? "",
    service_category_id: item.service_category_id ?? "",
    description: item.description ?? "",
    internal_description: item.internal_description ?? "",
    internal_notes: item.internal_notes ?? "",
    unit_label: item.unit_label,
    default_quantity: String(item.default_quantity),
    customer_cost_dollars: (item.pricing.customer_cost_cents / 100).toFixed(2),
    owner_cost_dollars: (item.pricing.owner_cost_cents / 100).toFixed(2),
    tax_class_id: item.pricing.tax_class_id ?? "",
    active: item.active,
    labor_warranty_days:
      item.warranty?.labor_days != null ? String(item.warranty.labor_days) : "",
  }
}

function formStateToInput(form: ServiceFormState, type: "service"): CatalogItemInput {
  return {
    type,
    name: form.name.trim(),
    sku: form.sku.trim() || null,
    service_category_id: form.service_category_id || null,
    description: form.description.trim() || null,
    internal_description: form.internal_description.trim() || null,
    internal_notes: form.internal_notes.trim() || null,
    unit_label: form.unit_label.trim() || "hour",
    default_quantity: Number(form.default_quantity) || 1,
    customer_cost_cents: Math.round((Number(form.customer_cost_dollars) || 0) * 100),
    owner_cost_cents: Math.round((Number(form.owner_cost_dollars) || 0) * 100),
    tax_class_id: form.tax_class_id || null,
    active: form.active,
    labor_warranty_days:
      form.labor_warranty_days.trim() === "" ? null : parseInt(form.labor_warranty_days, 10),
  }
}

// ---------- Create modal ----------

function CreateModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<ServiceFormState>(emptyForm)
  const createMutation = useCreateCatalogItem()

  const canSave = form.name.trim().length > 0 && !createMutation.isPending

  const handleSave = () => {
    createMutation.mutate(formStateToInput(form, "service"), {
      onSuccess: () => onClose(),
    })
  }

  const serverError =
    createMutation.isError
      ? createMutation.error instanceof ApiError
        ? createMutation.error.message
        : "Failed to create service."
      : null

  return (
    <ModalShell title="New Service" onClose={onClose}>
      <ServiceForm form={form} onChange={setForm} />
      {serverError && (
        <div className="px-6 pb-2">
          <ErrorBanner message={serverError} />
        </div>
      )}
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {createMutation.isPending ? "Creating…" : "Create service"}
        </button>
      </ModalFooter>
    </ModalShell>
  )
}

// ---------- Edit modal ----------

function EditModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const [form, setForm] = useState<ServiceFormState>(formStateFromItem(item))
  const initial = useMemo(() => formStateFromItem(item), [item])

  const updateMutation = useUpdateCatalogItem()
  const deleteMutation = useDeleteCatalogItem()

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const canSave = form.name.trim().length > 0 && dirty && !updateMutation.isPending

  const handleSave = () => {
    updateMutation.mutate(
      { id: item.id, input: formStateToInput(form, "service") },
      { onSuccess: () => onClose() }
    )
  }

  const handleDelete = () => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate(item.id, { onSuccess: () => onClose() })
  }

  const serverError =
    updateMutation.isError
      ? updateMutation.error instanceof ApiError
        ? updateMutation.error.message
        : "Failed to save."
      : null

  return (
    <ModalShell title={`Edit: ${item.name}`} onClose={onClose}>
      <ServiceForm form={form} onChange={setForm} />
      {serverError && (
        <div className="px-6 pb-2">
          <ErrorBanner message={serverError} />
        </div>
      )}
      <ModalFooter>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="text-sm px-3 py-2 text-red-600 hover:text-red-800 disabled:opacity-50 mr-auto"
        >
          {deleteMutation.isPending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {updateMutation.isPending ? "Saving…" : "Save changes"}
        </button>
      </ModalFooter>
    </ModalShell>
  )
}

// ---------- Service form ----------

function ServiceForm({
  form,
  onChange,
}: {
  form: ServiceFormState
  onChange: (next: ServiceFormState) => void
}) {
  const { data: categoriesData } = useCatalogCategories({ active: true })
  const { data: taxClassesData } = useTaxClasses({ active: true, per_page: 100 })

  const categories: CatalogCategory[] = categoriesData?.data ?? []
  const taxClasses: TaxClass[] = taxClassesData?.data ?? []

  const set = <K extends keyof ServiceFormState>(
    key: K,
    value: ServiceFormState[K]
  ) => {
    onChange({ ...form, [key]: value })
  }

  return (
    <div className="p-6 space-y-4">
      <Field label="Name" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Standard service call"
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU (optional for services)">
          <input
            type="text"
            value={form.sku}
            onChange={(e) => set("sku", e.target.value)}
            placeholder="e.g. SVC-CALL-01"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
          />
        </Field>
        <CategoryFieldWithAdd
          value={form.service_category_id}
          onChange={(v) => set("service_category_id", v)}
          categories={categories}
        />
      </div>

      <Field label="Customer description">
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Shows on invoices and customer-facing pages"
          rows={2}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
        />
      </Field>

      <Field label="Search aliases (internal)">
        <textarea
          value={form.internal_description}
          onChange={(e) => set("internal_description", e.target.value)}
          placeholder='Vendor part numbers, fitment data, alternate names. e.g. "Schlage L9080 / L-9080 / 9080-PD"'
          rows={2}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
        />
      </Field>

      <Field label="Manager notes (internal)">
        <textarea
          value={form.internal_notes}
          onChange={(e) => set("internal_notes", e.target.value)}
          placeholder="Anything you want to remember about this service"
          rows={2}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Unit label">
          <input
            type="text"
            value={form.unit_label}
            onChange={(e) => set("unit_label", e.target.value)}
            placeholder="hour, each, visit, mile"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
        </Field>
        <Field label="Default quantity">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.default_quantity}
            onChange={(e) => set("default_quantity", e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
          />
        </Field>
        <Field label="Active">
          <div className="flex items-center h-[38px]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set("active", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-700">
                {form.active ? "Active" : "Inactive"}
              </span>
            </label>
          </div>
        </Field>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">
          Pricing
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Customer price">
            <DollarInput
              value={form.customer_cost_dollars}
              onChange={(v) => set("customer_cost_dollars", v)}
            />
          </Field>
          <Field label="Owner cost (optional)">
            <DollarInput
              value={form.owner_cost_dollars}
              onChange={(v) => set("owner_cost_dollars", v)}
            />
          </Field>
          <Field label="Tax class">
            <select
              value={form.tax_class_id}
              onChange={(e) => set("tax_class_id", e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">— No tax —</option>
              {taxClasses.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.name} ({Number(tc.rate_pct).toFixed(2)}%)
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">
          Labor warranty (days)
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Override for the tenant labor rule. Blank = follow the tenant setting
          (match-parts or flat). Set a value to give this service its own labor
          coverage independent of the part warranty.
        </p>
        <Field label="Labor warranty days">
          <input
            type="number"
            min="0"
            value={form.labor_warranty_days}
            onChange={(e) => set("labor_warranty_days", e.target.value)}
            placeholder="e.g. 90"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
        </Field>
      </div>

      <ImageUploadPlaceholder />
    </div>
  )
}

// ---------- Category field with inline create ----------

function CategoryFieldWithAdd({
  value,
  onChange,
  categories,
}: {
  value: string
  onChange: (id: string) => void
  categories: CatalogCategory[]
}) {
  const [showInline, setShowInline] = useState(false)

  const handleCreated = (newCategory: CatalogCategory) => {
    onChange(newCategory.id)
    setShowInline(false)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium text-slate-700 uppercase tracking-wide">
          Category
        </label>
        <button
          type="button"
          onClick={() => setShowInline(true)}
          className="text-xs text-amber-600 hover:underline font-medium"
        >
          + Add new
        </button>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
      >
        <option value="">— No category —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {showInline && (
        <InlineCreateCategoryModal
          onCreated={handleCreated}
          onClose={() => setShowInline(false)}
        />
      )}
    </div>
  )
}

// ---------- Inline create category modal (modal-on-modal) ----------

function InlineCreateCategoryModal({
  onCreated,
  onClose,
}: {
  onCreated: (cat: CatalogCategory) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const createMutation = useCreateCatalogCategory()

  const canSave = name.trim().length > 0 && !createMutation.isPending

  const handleCreate = () => {
    createMutation.mutate(
      { name: name.trim(), parent_id: null, active: true },
      {
        onSuccess: (newCategory) => onCreated(newCategory),
      }
    )
  }

  // Pressing Enter in the name field submits
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSave) {
      e.preventDefault()
      handleCreate()
    }
  }

  const serverError =
    createMutation.isError
      ? createMutation.error instanceof ApiError
        ? createMutation.error.message
        : "Failed to create category."
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 26, 46, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Quick add category
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-3">
          <Field label="Category name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Locks & Hardware"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
              autoFocus
            />
          </Field>
          <p className="text-xs text-slate-500">
            Creates a root-level category. For sub-categories or to organize
            hierarchy, use the Categories management page (Tool Shed menu).
            .
          </p>
          {serverError && <ErrorBanner message={serverError} />}
        </div>
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSave}
            className="text-sm px-4 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            {createMutation.isPending ? "Creating…" : "Create & select"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Reusable bits ----------

function DollarInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="w-full text-sm pl-7 pr-3 py-2 border border-slate-200 rounded font-mono focus:outline-none focus:border-amber-500"
      />
    </div>
  )
}

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
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 bg-red-50 border border-red-100 rounded">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  )
}






