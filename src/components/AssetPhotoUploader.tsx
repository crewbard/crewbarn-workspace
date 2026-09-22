import { useState, useRef, useCallback } from "react"
import { useAssetPhotos, useUploadAssetPhoto } from "@/hooks/useAssetPhotos"
import { ApiError } from "@/lib/api"
import type { AssetPhoto } from "@/types/assetPhoto"

/**
 * AssetPhotoUploader — drag-drop OR click-to-pick image uploader for an asset.
 *
 * SLICE-4: photo upload pipeline.
 *
 * Wired to:
 *   GET  /v1/assets/{id}/photos
 *   POST /v1/assets/{id}/photos (multipart)
 *
 * NOT YET (deferred to follow-up slice):
 *   - PATCH (caption editing inline)
 *   - DELETE (per photo)
 *   - Drag-to-reorder
 *   - Bulk upload
 *
 * Backend accepts: JPEG, PNG, HEIC, HEIF, WebP. Max 10MB per file.
 * Server re-encodes everything to JPEG and generates 3 size variants.
 */

const ACCEPTED_TYPES = "image/jpeg,image/png,image/heic,image/heif,image/webp"
const MAX_SIZE_MB = 10

export function AssetPhotoUploader({ assetId }: { assetId: string }) {
  const { data: photos = [], isLoading } = useAssetPhotos(assetId)
  const uploadMutation = useUploadAssetPhoto(assetId)
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setErrorMessage(null)
      const fileArray = Array.from(files)

      // Validate client-side first to give fast feedback
      for (const file of fileArray) {
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          setErrorMessage(`"${file.name}" is too large. Max ${MAX_SIZE_MB} MB per file.`)
          return
        }
        if (!ACCEPTED_TYPES.split(",").includes(file.type)) {
          setErrorMessage(`"${file.name}" is not a supported image type. Use JPEG, PNG, HEIC, or WebP.`)
          return
        }
      }

      // Upload sequentially — keeps UI responsive and avoids overwhelming the API
      for (const file of fileArray) {
        try {
          await uploadMutation.mutateAsync({ file })
        } catch (err) {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
              ? err.message
              : "Upload failed."
          setErrorMessage(`"${file.name}": ${msg}`)
          return
        }
      }
    },
    [uploadMutation]
  )

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
      e.target.value = ""  // allow re-upload of the same file
    }
  }

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-amber-500 bg-amber-50"
            : "border-slate-300 hover:border-amber-400 hover:bg-slate-50",
          uploadMutation.isPending ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="text-3xl mb-2">📷</div>
        {uploadMutation.isPending ? (
          <p className="text-sm text-slate-700 font-medium">Uploading...</p>
        ) : (
          <>
            <p className="text-sm text-slate-700 font-medium">
              Drop photos here or click to pick
            </p>
            <p className="text-xs text-slate-500 mt-1">
              JPEG, PNG, HEIC, or WebP. Max {MAX_SIZE_MB} MB. Multiple OK.
            </p>
          </>
        )}
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* Existing photos */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-2">No photos yet.</p>
      ) : (
        <PhotoGrid photos={photos} />
      )}
    </div>
  )
}

// ---------- Photo grid ----------

function PhotoGrid({ photos }: { photos: AssetPhoto[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {photos.map((photo) => (
        <PhotoTile key={photo.id} photo={photo} />
      ))}
    </div>
  )
}

function PhotoTile({ photo }: { photo: AssetPhoto }) {
  return (
    
    <a
      href={photo.full_url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block relative aspect-square rounded overflow-hidden border border-slate-200 hover:border-amber-400 transition-colors group bg-slate-50"
      title={photo.original_filename ?? ""}
    >
      {photo.thumb_url ? (
        <img
          src={photo.thumb_url}
          alt={photo.caption ?? photo.original_filename ?? "Asset photo"}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-slate-400 text-xs">
          (no preview)
        </div>
      )}
      {photo.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
          {photo.caption}
        </div>
      )}
    </a>
  )
}
