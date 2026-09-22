import { useState, useMemo, useEffect } from "react"
import {
  useAssetTypes,
  useCreateAssetType,
  useUpdateAssetType,
  useDeleteAssetType,
} from "@/hooks/useAssetTypes"
import { ApiError } from "@/lib/api"
import type { AssetType, AssetCustomField, InspectionCadence } from "@/types/assetType"
import { INSPECTION_CADENCES, INSPECTION_CADENCE_LABELS } from "@/types/assetType"

// ---------- Page ----------

export function AssetTypesPage() {
  const { data, isLoading, isError, error } = useAssetTypes({ per_page: 200 })
  const [editing, setEditing] = useState<AssetType | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const types = data?.data ?? []

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Header onNew={() => setShowCreate(true)} />

      {isError && (
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6">
          <p className="text-sm text-red-700">
            Failed to load asset types.{error instanceof Error ? ` ${error.message}` : ""}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 animate-pulse">
          <div className="h-5 w-40 bg-slate-200 rounded mb-6" />
          <div className="space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        </div>
      )}

      {!isLoading && !isError && <TypesTable types={types} onEdit={setEditing} />}

      {showCreate && <CreateTypeModal onClose={() => setShowCreate(false)} />}
      {editing && <EditTypeModal type={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

// ---------- Header ----------

function Header({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Asset Types</h1>
        <p className="text-sm text-slate-600 mt-1">
          Categories for the things you track - fire doors, extinguishers, safes, AC units. Each type defines what custom fields appear when creating an asset of that type.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors flex-shrink-0"
      >
        + New Asset Type
      </button>
    </div>
  )
}

// ---------- Table ----------

function TypesTable({ types, onEdit }: { types: AssetType[]; onEdit: (t: AssetType) => void }) {
  if (types.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
        <p className="text-sm text-slate-600 mb-2">
          No asset types yet.
        </p>
        <p className="text-xs text-slate-500">
          Examples: Fire Door, Fire Extinguisher, Safe, Master Key System, Rooftop AC Unit, Exit Sign
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left px-6 py-3 font-medium">Type</th>
            <th className="text-left px-6 py-3 font-medium">Slug</th>
            <th className="text-left px-6 py-3 font-medium">Custom fields</th>
            <th className="text-left px-6 py-3 font-medium">Cadence</th>
            <th className="text-center px-6 py-3 font-medium">Active</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {types.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {t.icon && <span className="text-lg">{t.icon}</span>}
                  <div>
                    <div className="font-medium text-slate-900">{t.name}</div>
                    {t.color && (
                      <div className="text-xs text-slate-500">{t.color}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-xs font-mono text-slate-500">{t.slug}</td>
              <td className="px-6 py-4 text-xs text-slate-600">
                {t.custom_field_schema && t.custom_field_schema.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {t.custom_field_schema.slice(0, 3).map((f) => (
                      <span key={f.key} className="px-2 py-0.5 bg-slate-100 rounded font-mono">
                        {f.key}
                      </span>
                    ))}
                    {t.custom_field_schema.length > 3 && (
                      <span className="text-slate-400">+{t.custom_field_schema.length - 3} more</span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400">No custom fields</span>
                )}
              </td>
              <td className="px-6 py-4 text-xs text-slate-600">
                {t.default_inspection_cadence ? INSPECTION_CADENCE_LABELS[t.default_inspection_cadence] : <span className="text-slate-400">-</span>}
              </td>
              <td className="px-6 py-4 text-center">
                {t.active ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded">Active</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">Inactive</span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(t)}
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

type TypeFormState = {
  name: string
  icon: string
  color: string
  default_inspection_cadence: InspectionCadence | ""
  custom_field_schema: AssetCustomField[]
  active: boolean
}

const emptyForm: TypeFormState = {
  name: "",
  icon: "",
  color: "",
  default_inspection_cadence: "",
  custom_field_schema: [],
  active: true,
}

function formStateFromType(type: AssetType): TypeFormState {
  return {
    name: type.name,
    icon: type.icon ?? "",
    color: type.color ?? "",
    default_inspection_cadence: type.default_inspection_cadence ?? "",
    custom_field_schema: type.custom_field_schema ?? [],
    active: type.active,
  }
}

function formStateToInput(form: TypeFormState) {
  return {
    name: form.name.trim(),
    icon: form.icon.trim() || null,
    color: form.color.trim() || null,
    default_inspection_cadence: form.default_inspection_cadence || null,
    custom_field_schema: form.custom_field_schema,
    active: form.active,
  }
}

// ---------- Create Modal ----------

function CreateTypeModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<TypeFormState>(emptyForm)
  const createMutation = useCreateAssetType()

  const canSave = form.name.trim().length > 0 && !createMutation.isPending

  const handleSave = () => {
    createMutation.mutate(formStateToInput(form), { onSuccess: () => onClose() })
  }

  const errorMsg = createMutation.isError
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : "Failed to create asset type."
    : null

  return (
    <ModalShell title="New Asset Type" onClose={onClose}>
      <TypeForm form={form} onChange={setForm} />
      {errorMsg && <div className="px-6 pb-2"><ErrorBanner message={errorMsg} /></div>}
      <Footer>
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
          {createMutation.isPending ? "Creating..." : "Create asset type"}
        </button>
      </Footer>
    </ModalShell>
  )
}

// ---------- Edit Modal ----------

function EditTypeModal({ type, onClose }: { type: AssetType; onClose: () => void }) {
  const [form, setForm] = useState<TypeFormState>(formStateFromType(type))
  const initial = useMemo(() => formStateFromType(type), [type])

  const updateMutation = useUpdateAssetType()
  const deleteMutation = useDeleteAssetType()

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)
  const canSave = form.name.trim().length > 0 && isDirty && !updateMutation.isPending

  const handleSave = () => {
    updateMutation.mutate(
      { id: type.id, input: formStateToInput(form) },
      { onSuccess: () => onClose() }
    )
  }

  const handleDelete = () => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate(type.id, { onSuccess: () => onClose() })
  }

  const errorMsg = updateMutation.isError
    ? updateMutation.error instanceof ApiError
      ? updateMutation.error.message
      : "Failed to save."
    : deleteMutation.isError
    ? deleteMutation.error instanceof ApiError
      ? deleteMutation.error.message
      : "Failed to delete."
    : null

  return (
    <ModalShell title={`Edit: ${type.name}`} onClose={onClose}>
      <TypeForm form={form} onChange={setForm} />
      {errorMsg && <div className="px-6 pb-2"><ErrorBanner message={errorMsg} /></div>}
      <Footer>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="text-sm px-3 py-2 text-red-600 hover:text-red-800 disabled:opacity-50 mr-auto"
        >
          {deleteMutation.isPending ? "Deleting..." : "Delete"}
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
          {updateMutation.isPending ? "Saving..." : "Save changes"}
        </button>
      </Footer>
    </ModalShell>
  )
}

// ---------- Type Form ----------

function TypeForm({ form, onChange }: { form: TypeFormState; onChange: (form: TypeFormState) => void }) {
  const set = (key: keyof TypeFormState, value: unknown) => {
    onChange({ ...form, [key]: value })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Field label="Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Fire Door, Master Key System"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
              autoFocus
            />
          </Field>
        </div>
        <Field label="Icon (emoji)">
          <input
            type="text"
            value={form.icon}
            onChange={(e) => set("icon", e.target.value)}
            placeholder="🚪"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 text-center text-lg"
            maxLength={4}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Color tag">
          <input
            type="text"
            value={form.color}
            onChange={(e) => set("color", e.target.value)}
            placeholder="red, amber, blue, etc."
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
        </Field>
        <Field label="Default inspection cadence">
          <select
            value={form.default_inspection_cadence}
            onChange={(e) => set("default_inspection_cadence", e.target.value as InspectionCadence | "")}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">- None -</option>
            {INSPECTION_CADENCES.map((c) => (
              <option key={c} value={c}>
                {INSPECTION_CADENCE_LABELS[c]}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            New assets of this type inherit this cadence.
          </p>
        </Field>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <CustomFieldsEditor
          fields={form.custom_field_schema}
          onChange={(fields) => set("custom_field_schema", fields)}
        />
      </div>

      <div className="flex items-center pt-2">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-sm text-slate-700">{form.active ? "Active" : "Inactive"}</span>
        </label>
      </div>
    </div>
  )
}

// ---------- Custom Fields Editor ----------

function CustomFieldsEditor({
  fields,
  onChange,
}: {
  fields: AssetCustomField[]
  onChange: (fields: AssetCustomField[]) => void
}) {
  const addField = () => {
    onChange([
      ...fields,
      { key: "", label: "", type: "text", required: false },
    ])
  }

  const updateField = (idx: number, updates: Partial<AssetCustomField>) => {
    const next = fields.slice()
    next[idx] = { ...next[idx], ...updates }
    onChange(next)
  }

  const removeField = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide">Custom fields</h3>
          <p className="text-xs text-slate-500 mt-1">
            Fields shown on the asset form when creating an asset of this type. e.g., Fire Door has "Door Number" and "Fire Rating".
          </p>
        </div>
        <button
          type="button"
          onClick={addField}
          className="text-xs text-amber-600 hover:underline font-medium flex-shrink-0"
        >
          + Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-6 bg-slate-50 rounded border border-dashed border-slate-200">
          <p className="text-xs text-slate-500">No custom fields. Click "+ Add field" to define one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, idx) => (
            <div key={idx} className="border border-slate-200 rounded-md p-3 space-y-2 bg-slate-50">
              <div className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-3">
                  <input
                    type="text"
                    value={field.key}
                    onChange={(e) => updateField(idx, { key: e.target.value })}
                    placeholder="key (snake_case)"
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(idx, { label: e.target.value })}
                    placeholder="Display label"
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={field.type}
                    onChange={(e) => updateField(idx, { type: e.target.value as AssetCustomField["type"] })}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="select">Select</option>
                    <option value="date">Date</option>
                  </select>
                </div>
                <div className="col-span-3 flex items-center">
                  <label className="inline-flex items-center gap-1 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={field.required ?? false}
                      onChange={(e) => updateField(idx, { required: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500"
                    />
                    <span className="text-slate-700">Required</span>
                  </label>
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeField(idx)}
                    className="text-slate-400 hover:text-red-600 text-base"
                    aria-label="Remove field"
                  >
                    ×
                  </button>
                </div>
              </div>
              {field.type === "select" && (
                <div>
                  <input
                    type="text"
                    value={(field.options ?? []).join(", ")}
                    onChange={(e) =>
                      updateField(idx, {
                        options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Options (comma-separated): 20min, 45min, 60min, 90min"
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Modal infrastructure ----------

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 26, 46, 0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
      {children}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
