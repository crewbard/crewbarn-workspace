import { useRef, useState } from 'react'
import {
  useCatalogItem,
  useUploadCatalogItemImage,
  useDeleteCatalogItemImage,
} from '@/hooks/useCatalogItems'
import { ApiError } from '@/lib/api'
import { ImageEditorDialog } from '@/components/images/ImageEditorDialog'
import type { CatalogItem } from '@/types/catalogItem'

/**
 * Image uploader for a single catalog item. Replaces ImageUploadPlaceholder.
 *
 * 1:1 — uploading replaces any prior image. Backend re-encodes to three
 * JPEG variants (thumb / medium / full) and stores them on R2 under
 * tenants/{tenant}/catalog/items/{id}/image-{size}.jpg.
 *
 * The component requires an existing item id, so on the create modal
 * (where the item doesn't exist yet) callers should hide it until after
 * the first save.
 */
export function CatalogItemImageUploader({ item: initialItem }: { item: CatalogItem }) {
  // Subscribe to the live cached item so the preview refreshes the moment
  // the upload/delete mutations write the new resource into TanStack Query.
  const { data: live } = useCatalogItem(initialItem.id)
  const item: CatalogItem = live ?? initialItem

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const uploadMutation = useUploadCatalogItemImage()
  const [editing, setEditing] = useState<File | null>(null)
  const deleteMutation = useDeleteCatalogItemImage()

  const isPending = uploadMutation.isPending || deleteMutation.isPending
  const hasImage = !!(item.images.medium_url || item.images.full_url || item.images.thumb_url)
  const previewUrl = item.images.medium_url || item.images.full_url || item.images.thumb_url

  function handlePick() {
    fileInputRef.current?.click()
  }

  /**
   * Picking a file opens the editor rather than uploading straight away.
   *
   * Every catalog image then arrives square and downscaled, so the tiles line
   * up and a 10MB phone photo doesn't travel over a truck's signal — and the
   * background can be cut out first, which is what makes a catalog look
   * deliberate rather than assembled.
   */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset immediately so re-picking the same file fires onChange again even
    // if the editor is cancelled.
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    setError(null)
    setEditing(file)
  }

  async function handleEdited(edited: File) {
    setEditing(null)
    setError(null)
    try {
      await uploadMutation.mutateAsync({ id: item.id, file: edited })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Upload failed.')
    }
  }

  async function handleRemove() {
    if (!confirm('Remove this image?')) return
    setError(null)
    try {
      await deleteMutation.mutateAsync(item.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">
        Image
      </h3>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFileChange}
        className="hidden"
      />
      {hasImage ? (
        <div className="flex items-start gap-4">
          <img
            src={previewUrl ?? ''}
            alt={item.name}
            className="w-32 h-32 object-cover rounded border border-slate-200 bg-slate-50"
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handlePick}
              disabled={isPending}
              className="text-sm px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded border border-red-200 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={isPending}
          className="w-full border-2 border-dashed border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/30 transition-colors disabled:opacity-50"
        >
          <div className="text-2xl mb-2">📷</div>
          {uploadMutation.isPending ? 'Uploading…' : (
            <>Drop an image here or <span className="text-amber-600 font-medium">browse</span></>
          )}
          <p className="text-xs mt-2 text-slate-400">JPG/PNG/WebP/HEIC up to 10 MB. Auto-resized to thumb + medium + full.</p>
        </button>
      )}
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
      {editing && (
        <ImageEditorDialog
          file={editing}
          onCancel={() => setEditing(null)}
          onDone={handleEdited}
        />
      )}
    </div>
  )
}
