import { useState, useMemo } from "react"
import {
  useProductCatalogCategories,
  useCreateProductCatalogCategory,
  useUpdateProductCatalogCategory,
  useDeleteProductCatalogCategory,
} from "@/hooks/useProductCatalogCategories"
import { ApiError } from "@/lib/api"
import type { ProductCatalogCategory } from "@/types/productCatalogCategory"
import {
  uploadProductCategoryImage,
  deleteProductCategoryImage,
} from "@/lib/productCatalogCategories"
import { useQueryClient } from "@tanstack/react-query"
import { ImageEditorDialog } from "@/components/images/ImageEditorDialog"
import { useRef, useState as useLocalState } from "react"

// ---------- Page ----------

export function ProductCategoriesPage() {
  const { data, isLoading, isError, error } = useProductCatalogCategories({
    shape: "flat",
    per_page: 200,
  })
  const [editing, setEditing] = useState<ProductCatalogCategory | null>(null)
  const [creating, setCreating] = useState(false)

  const categories = data?.data ?? []

  // Build a sort order that displays parents before children (depth-aware)
  // For each category, compute depth by walking parent chain.
  const indexed = useMemo(() => buildIndentedList(categories), [categories])

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <PageHeader onNew={() => setCreating(true)} />

      {isError && (
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6">
          <p className="text-sm text-red-700">
            Failed to load categories.
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
        <CategoriesTable rows={indexed} onEdit={setEditing} />
      )}

      {creating && (
        <CreateModal
          allCategories={categories}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <EditModal
          category={editing}
          allCategories={categories}
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
        <h1 className="text-3xl font-semibold text-slate-900">Product Categories</h1>
        <p className="text-sm text-slate-600 mt-1">
          Hierarchical taxonomy for organizing products. Distinct from Service Categories so the customer-facing product catalog displays only product categories.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors flex-shrink-0"
      >
        + New Category
      </button>
    </div>
  )
}

// ---------- Indented list builder ----------

interface IndentedRow {
  category: ProductCatalogCategory
  depth: number
}

function buildIndentedList(categories: ProductCatalogCategory[]): IndentedRow[] {
  // Map id -> category for O(1) parent lookup
  const byId = new Map(categories.map((c) => [c.id, c]))
  const childrenOf = new Map<string | null, ProductCatalogCategory[]>()
  for (const c of categories) {
    const key = c.parent_id
    const arr = childrenOf.get(key) ?? []
    arr.push(c)
    childrenOf.set(key, arr)
  }
  // Sort each bucket by sort_order then name
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }
  // DFS from roots
  const result: IndentedRow[] = []
  function visit(parentId: string | null, depth: number) {
    const kids = childrenOf.get(parentId) ?? []
    for (const k of kids) {
      result.push({ category: k, depth })
      visit(k.id, depth + 1)
    }
  }
  visit(null, 0)
  // Catch any orphans (parent_id points to nothing visible)
  const visited = new Set(result.map((r) => r.category.id))
  for (const c of categories) {
    if (!visited.has(c.id)) {
      result.push({ category: c, depth: 0 })
    }
  }
  // Suppress unused warning; byId reserved for future ancestor breadcrumb display
  void byId
  return result
}

// ---------- Table ----------

function CategoriesTable({
  rows,
  onEdit,
}: {
  rows: IndentedRow[]
  onEdit: (c: ProductCatalogCategory) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
        <p className="text-sm text-slate-600">
          No categories yet. Create one to start organizing your catalog.
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
            <th className="text-left px-6 py-3 font-medium w-24">Photo</th>
            <th className="text-left px-6 py-3 font-medium">Slug</th>
            <th className="text-center px-6 py-3 font-medium">Active</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ category: c, depth }) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <div className="font-medium text-slate-900 flex items-center">
                  {depth > 0 && (
                    <span
                      className="text-slate-300 mr-2"
                      style={{ paddingLeft: `${depth * 16}px` }}
                    >
                      └
                    </span>
                  )}
                  {c.name}
                </div>
              </td>
              <td className="px-6 py-4">
                <CategoryPhotoCell category={c} />
              </td>
              <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                {c.slug}
              </td>
              <td className="px-6 py-4 text-center">
                {c.active ? (
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
                  onClick={() => onEdit(c)}
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

// ---------- Create modal ----------

function CreateModal({
  allCategories,
  onClose,
}: {
  allCategories: ProductCatalogCategory[]
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState("")
  const [active, setActive] = useState(true)

  const createMutation = useCreateProductCatalogCategory()
  const canSave = name.trim().length > 0 && !createMutation.isPending

  const handleSave = () => {
    createMutation.mutate(
      {
        name: name.trim(),
        parent_id: parentId || null,
        active,
      },
      { onSuccess: () => onClose() }
    )
  }

  const serverError =
    createMutation.isError
      ? createMutation.error instanceof ApiError
        ? createMutation.error.message
        : "Failed to create category."
      : null

  return (
    <ModalShell title="New Category" onClose={onClose}>
      <div className="p-6 space-y-4">
        <Field label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Locks & Hardware"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            autoFocus
          />
        </Field>
        <Field label="Parent category (optional)">
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">— Root (no parent) —</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-center">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-700">
              {active ? "Active" : "Inactive"}
            </span>
          </label>
        </div>
        {serverError && <ErrorBanner message={serverError} />}
      </div>
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
          {createMutation.isPending ? "Creating…" : "Create category"}
        </button>
      </ModalFooter>
    </ModalShell>
  )
}

// ---------- Edit modal ----------

function EditModal({
  category,
  allCategories,
  onClose,
}: {
  category: ProductCatalogCategory
  allCategories: ProductCatalogCategory[]
  onClose: () => void
}) {
  const [name, setName] = useState(category.name)
  const [parentId, setParentId] = useState(category.parent_id ?? "")
  const [active, setActive] = useState(category.active)

  const updateMutation = useUpdateProductCatalogCategory()
  const deleteMutation = useDeleteProductCatalogCategory()

  const dirty =
    name.trim() !== category.name ||
    (parentId || null) !== (category.parent_id ?? null) ||
    active !== category.active

  const canSave = name.trim().length > 0 && dirty && !updateMutation.isPending

  // Filter out self and descendants from parent picker (server enforces, this is just UX)
  const validParentOptions = useMemo(() => {
    const blocked = new Set<string>([category.id])
    // Walk children of this category (using the local list, not recursive)
    let changed = true
    while (changed) {
      changed = false
      for (const c of allCategories) {
        if (c.parent_id && blocked.has(c.parent_id) && !blocked.has(c.id)) {
          blocked.add(c.id)
          changed = true
        }
      }
    }
    return allCategories.filter((c) => !blocked.has(c.id))
  }, [category.id, allCategories])

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: category.id,
        input: {
          name: name.trim(),
          parent_id: parentId || null,
          active,
        },
      },
      { onSuccess: () => onClose() }
    )
  }

  const handleDelete = () => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate(category.id, { onSuccess: () => onClose() })
  }

  const serverError =
    updateMutation.isError
      ? updateMutation.error instanceof ApiError
        ? updateMutation.error.message
        : "Failed to update category."
      : deleteMutation.isError
      ? deleteMutation.error instanceof ApiError
        ? deleteMutation.error.message
        : "Failed to delete category."
      : null

  return (
    <ModalShell title={`Edit: ${category.name}`} onClose={onClose}>
      <div className="p-6 space-y-4">
        <Field label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
        </Field>
        <Field label="Parent category">
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">— Root (no parent) —</option>
            {validParentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-center">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-700">
              {active ? "Active" : "Inactive"}
            </span>
          </label>
        </div>
        {serverError && <ErrorBanner message={serverError} />}
      </div>
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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
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


/**
 * The category's photo, uploaded in place.
 *
 * A wall of name/slug/Active rows reads slowly; a picture of a cylinder is
 * recognised before the word is. Clicking the tile opens the file picker, so
 * there is no separate edit trip for what is a one-field change.
 */
function CategoryPhotoCell({ category }: { category: ProductCatalogCategory }) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useLocalState(false)
  const [error, setError] = useLocalState<string | null>(null)
  // Same editor as catalog items: square crop, downscale, optional cut-out —
  // so the "Shop by category" tiles line up instead of each photo filling its
  // box differently.
  const [editing, setEditing] = useLocalState<File | null>(null)
  const src = category.images?.thumb_url ?? category.images?.medium_url ?? null

  async function handle(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await uploadProductCategoryImage(category.id, file)
      await qc.invalidateQueries({ queryKey: ["product-catalog-categories"] })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={src ? "Replace photo" : "Add a photo"}
        className="h-12 w-12 shrink-0 overflow-hidden rounded border border-dashed border-slate-300 bg-slate-50 hover:border-amber-400"
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-slate-400">{busy ? "…" : "Add"}</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          // Cleared FIRST so choosing the same file again still fires a change
          // event even when the editor is cancelled.
          e.target.value = ""
          if (picked) setEditing(picked)
        }}
      />
      {editing && (
        <ImageEditorDialog
          file={editing}
          onCancel={() => setEditing(null)}
          onDone={(edited) => {
            setEditing(null)
            void handle(edited)
          }}
        />
      )}
      {src && (
        <button
          type="button"
          onClick={async () => {
            setBusy(true)
            try {
              await deleteProductCategoryImage(category.id)
              await qc.invalidateQueries({ queryKey: ["product-catalog-categories"] })
            } finally {
              setBusy(false)
            }
          }}
          className="text-[11px] text-slate-400 hover:text-rose-600"
        >
          Remove
        </button>
      )}
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  )
}
