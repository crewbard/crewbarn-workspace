import { useState } from 'react'
import { useCreateProductCatalogCategory } from '@/hooks/useProductCatalogCategories'
import { ApiError } from '@/lib/api'
import type { ProductCatalogCategory } from '@/types/productCatalogCategory'

/**
 * Tiny stacked modal for creating a root-level product category from
 * inside another form. Used by:
 *   - ProductCatalogPage (full edit/create form)
 *   - CatalogItemQuickCreate ("+ New product" overlay on Stock Levels)
 *
 * Always creates a root category (parent_id = null). For sub-categories
 * or hierarchy management, users go to Tool Shed → Categories.
 */
export function InlineCreateProductCategoryModal({
  onCreated,
  onClose,
}: {
  onCreated: (cat: ProductCatalogCategory) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const createMutation = useCreateProductCatalogCategory()

  const canSave = name.trim().length > 0 && !createMutation.isPending

  const handleCreate = () => {
    createMutation.mutate(
      { name: name.trim(), parent_id: null, active: true },
      { onSuccess: (newCategory) => onCreated(newCategory) }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canSave) {
      e.preventDefault()
      handleCreate()
    }
  }

  const serverError =
    createMutation.isError
      ? createMutation.error instanceof ApiError
        ? createMutation.error.message
        : 'Failed to create category.'
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 26, 46, 0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Quick add category</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
            aria-label="Close"
          >
            x
          </button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Category name <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Locks and Hardware"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
              autoFocus
            />
          </div>
          <p className="text-xs text-slate-500">
            Creates a root-level category. For sub-categories or to organize hierarchy, use the Categories management page (Tool Shed menu).
          </p>
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}
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
            {createMutation.isPending ? 'Creating...' : 'Create and select'}
          </button>
        </div>
      </div>
    </div>
  )
}
