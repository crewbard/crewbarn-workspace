/**
 * Disabled image-upload affordance shown in CREATE forms — the real
 * uploader (CatalogItemImageUploader) needs a saved item id, so we
 * tell the user to save first.
 *
 * Still used by ServiceCatalogPage. Edit forms render the real uploader.
 */
export function ImageUploadPlaceholder() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">Image</h3>
      <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        <div className="text-2xl mb-2">📷</div>
        <p className="text-xs text-slate-500">
          Save the item first — you can add an image after.
        </p>
      </div>
    </div>
  )
}
