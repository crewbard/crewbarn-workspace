import { useEffect, useState } from 'react'
import { ImageEditorDialog } from '@/components/images/ImageEditorDialog'

/**
 * Pick (and edit) an image on a CREATE form, before the record exists.
 *
 * The image endpoints are keyed by id — /catalog-items/{id}/image — so nothing
 * can be uploaded until the item is saved. The old answer was a dead dashed box
 * reading "Save the item first", which looks exactly like a button and does
 * nothing when pressed: you had to save, find the item again, reopen it, and
 * upload. For someone entering a rack of products that is a second trip
 * through every one of them.
 *
 * So the file is chosen and cropped now, held in memory, and uploaded by the
 * parent the moment the item has an id.
 */
export function PendingImagePicker({
  value,
  onChange,
}: {
  value: File | null
  onChange: (file: File | null) => void
}) {
  const [editing, setEditing] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Object URLs are revoked when they change or the form closes; without this
  // every re-pick leaks the previous image for the life of the tab.
  useEffect(() => {
    if (!value) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">Image</h3>

      {preview ? (
        <div className="flex items-center gap-4">
          <img
            src={preview}
            alt=""
            className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
          />
          <div className="text-xs text-slate-500">
            <p className="font-medium text-slate-700">Ready to upload</p>
            <p className="mt-0.5">Saved with the product when you press Create.</p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(value)}
                className="font-semibold text-amber-700 hover:underline"
              >
                Adjust
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="font-semibold text-slate-500 hover:text-slate-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-200 p-8 text-center hover:border-amber-300 hover:bg-amber-50/40">
          <div className="text-2xl mb-2">📷</div>
          <p className="text-xs text-slate-500">
            Click to add an image — cropped square, background optional
          </p>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0]
              // Cleared first so re-picking the same file still fires a change
              // even if the editor is cancelled.
              e.target.value = ''
              if (picked) setEditing(picked)
            }}
          />
        </label>
      )}

      {editing && (
        <ImageEditorDialog
          file={editing}
          onCancel={() => setEditing(null)}
          onDone={(edited) => {
            setEditing(null)
            onChange(edited)
          }}
        />
      )}
    </div>
  )
}
