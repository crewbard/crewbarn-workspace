import { useState, useRef, useCallback } from "react"
import { useAssetDocuments, useUploadAssetDocument } from "@/hooks/useAssetDocuments"
import { ApiError } from "@/lib/api"
import type { AssetDocument } from "@/types/assetDocument"
import { PostUploadModal } from "@/components/documents/PostUploadModal"
import { ExtractedDocumentEditor } from "@/components/documents/ExtractedDocumentEditor"
import { useExtractedDocsForSources } from "@/hooks/useExtractedDocuments"
import { assetDocumentCategory, assetDocumentKindLabel, assetDocumentSourceLabel, assetDocumentStatusLabel, assetDocumentVisibilityLabel, canPreviewAssetDocument } from "@/lib/assetDocumentLabels"

/**
 * AssetDocumentUploader — drag-drop OR click-to-pick file uploader for an asset.
 *
 * Wired to:
 *   GET  /v1/assets/{id}/documents
 *   POST /v1/assets/{id}/documents (multipart)
 *
 * Backend accepts: PDF, Word, Excel, plain text, CSV, JPEG/PNG/HEIC/WebP.
 * Max 25MB per file. Stored as-is in R2 (no re-encoding, unlike photos).
 */

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.heic,.heif,.webp"
const MAX_SIZE_MB = 25

export function AssetDocumentUploader({ assetId }: { assetId: string }) {
  const { data: documents = [], isLoading } = useAssetDocuments(assetId)
  const uploadMutation = useUploadAssetDocument(assetId)
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [postUpload, setPostUpload] = useState<{ id: string; fileName: string | null; mimeType: string | null } | null>(null)
  const [editingExtractedId, setEditingExtractedId] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<AssetDocument | null>(null)
  const extractedLookup = useExtractedDocsForSources("asset_document", documents.map((d) => d.id))
  const extractedMap = extractedLookup.data?.data ?? {}
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setErrorMessage(null)
      const fileArray = Array.from(files)

      for (const file of fileArray) {
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          setErrorMessage(`"${file.name}" is too large. Max ${MAX_SIZE_MB} MB per file.`)
          return
        }
      }

      let lastDoc: { id: string; original_filename: string | null; mime_type: string | null } | null = null
      for (const file of fileArray) {
        try {
          lastDoc = await uploadMutation.mutateAsync({ file })
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Upload failed."
          setErrorMessage(`"${file.name}": ${msg}`)
          return
        }
      }
      if (lastDoc) {
        setPostUpload({ id: lastDoc.id, fileName: lastDoc.original_filename, mimeType: lastDoc.mime_type })
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
      e.target.value = ""
    }
  }

  const dropzoneClass = [
    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
    isDragging ? "border-amber-500 bg-amber-50" : "border-slate-300 hover:border-amber-400 hover:bg-slate-50",
    uploadMutation.isPending ? "pointer-events-none opacity-60" : "",
  ].join(" ")

  return (
    <div className="space-y-3">
      <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()} className={dropzoneClass}>
        <input ref={inputRef} type="file" accept={ACCEPTED_EXTENSIONS} multiple className="hidden" onChange={handleInputChange} />
        <div className="text-3xl mb-2">{"\uD83D\uDCC4"}</div>
        {uploadMutation.isPending ? (
          <p className="text-sm text-slate-700 font-medium">Uploading...</p>
        ) : (
          <>
            <p className="text-sm text-slate-700 font-medium">Drop documents here or click to pick</p>
            <p className="text-xs text-slate-500 mt-1">PDF, Word, Excel, text, CSV, or image. Max {MAX_SIZE_MB} MB. Multiple OK.</p>
          </>
        )}
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (<div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />))}
        </div>
      ) : documents.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-2">No documents yet.</p>
      ) : (
        <DocumentList
          documents={documents}
          onExtract={(doc) => setPostUpload({ id: doc.id, fileName: doc.original_filename, mimeType: doc.mime_type })}
          extractedMap={extractedMap}
          onOpenExtracted={(extractedId) => setEditingExtractedId(extractedId)}
          onPreview={setPreviewDoc}
        />
      )}

      {editingExtractedId && (
        <ExtractedDocumentEditor id={editingExtractedId} onClose={() => setEditingExtractedId(null)} />
      )}

      {postUpload && (
        <PostUploadModal sourceType="asset_document" sourceId={postUpload.id} fileName={postUpload.fileName} mimeType={postUpload.mimeType} onClose={() => setPostUpload(null)} />
      )}

      {previewDoc && (
        <AssetDocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  )
}

function DocumentList({
  documents,
  onExtract,
  extractedMap,
  onOpenExtracted,
  onPreview,
}: {
  documents: AssetDocument[]
  onExtract: (doc: AssetDocument) => void
  extractedMap: Record<string, { id: string }>
  onOpenExtracted: (extractedId: string) => void
  onPreview: (doc: AssetDocument) => void
}) {
  return (
    <ul className="divide-y divide-slate-200 border border-slate-200 rounded">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} onExtract={onExtract} extractedId={extractedMap[doc.id]?.id ?? null} onOpenExtracted={onOpenExtracted} onPreview={onPreview} />
      ))}
    </ul>
  )
}

function DocumentRow({
  doc,
  onExtract,
  extractedId,
  onOpenExtracted,
  onPreview,
}: {
  doc: AssetDocument
  onExtract: (doc: AssetDocument) => void
  extractedId: string | null
  onOpenExtracted: (id: string) => void
  onPreview: (doc: AssetDocument) => void
}) {
  const icon = iconForMimeType(doc.mime_type)
  const category = assetDocumentCategory(doc)
  const kindLabel = assetDocumentKindLabel(doc)
  const canPreview = canPreviewAssetDocument(doc)
  const sizeLabel = doc.size_bytes ? formatBytes(doc.size_bytes) : null
  const dateLabel = doc.created_at ? new Date(doc.created_at).toLocaleDateString() : null

  const titleClass = "block font-medium text-sm text-slate-900 hover:text-amber-700 truncate"
  const titleNoLinkClass = "font-medium text-sm text-slate-900 truncate"
  const actionClass = "text-xs flex-shrink-0 px-2 py-1 rounded"
  const downloadClass = actionClass + " text-amber-700 hover:text-amber-800 hover:bg-amber-50"

  const titleEl = doc.file_url
    ? (<a href={doc.file_url} target="_blank" rel="noopener noreferrer" className={titleClass} title={doc.original_filename ?? doc.title}>{doc.title}</a>)
    : (<div className={titleNoLinkClass} title={doc.title}>{doc.title}</div>)

  const downloadEl = doc.file_url
    ? (<a href={doc.file_url} target="_blank" rel="noopener noreferrer" download={doc.original_filename ?? undefined} className={downloadClass} title="Download">Download</a>)
    : null

  const metaParts: string[] = []
  metaParts.push(doc.document_number)
  metaParts.push(kindLabel)
  metaParts.push(assetDocumentStatusLabel(doc.document_status))
  metaParts.push(assetDocumentVisibilityLabel(doc.visibility))
  metaParts.push(assetDocumentSourceLabel(doc.source_type))
  metaParts.push(doc.original_filename ?? "-")
  if (sizeLabel) metaParts.push(sizeLabel)
  if (dateLabel) metaParts.push(dateLabel)
  const meta = metaParts.join(" · ")

  const extractable = !!doc.mime_type && (doc.mime_type.includes("pdf") || doc.mime_type.startsWith("image/"))

  return (
    <li className="px-3 py-2 hover:bg-slate-50 flex items-center gap-3">
      <div className="text-2xl flex-shrink-0 leading-none">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={"inline-flex flex-shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold " + category.className}>{category.label}</span>
          <div className="min-w-0 flex-1">{titleEl}</div>
        </div>
        <div className="text-xs text-slate-500 truncate">{meta}</div>
      </div>
      {canPreview && (
        <button type="button" onClick={() => onPreview(doc)} className={actionClass + " border border-slate-200 text-slate-700 hover:bg-slate-100"} title="Preview this document on the asset page">Preview</button>
      )}
      {extractable && (
        extractedId ? (
          <button type="button" onClick={() => onOpenExtracted(extractedId)} className="text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center gap-1 flex-shrink-0" title="Open the editable extracted version">
            <span className="text-emerald-600">✎</span> Edit extracted
          </button>
        ) : (
          <button type="button" onClick={() => onExtract(doc)} className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-800 hover:bg-amber-50 flex items-center gap-1 flex-shrink-0" title="Extract editable text with AI">
            <span className="text-amber-500">✦</span> Extract
          </button>
        )
      )}
      {downloadEl}
    </li>
  )
}

function AssetDocumentPreviewModal({ doc, onClose }: { doc: AssetDocument; onClose: () => void }) {
  const kind = assetDocumentKindLabel(doc)
  const category = assetDocumentCategory(doc)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={"inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold " + category.className}>{category.label}</span>
              <span className="text-xs font-semibold text-slate-500">{kind}</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 truncate">{doc.title}</h3>
            <p className="text-xs text-slate-500 truncate">{doc.original_filename ?? "CrewBarn asset document"}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {doc.file_url && (<a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-2 rounded border border-slate-200 text-slate-700 hover:bg-slate-50">Open original</a>)}
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none" aria-label="Close">×</button>
          </div>
        </div>
        <div className="bg-slate-100 flex-1 min-h-[60vh] overflow-auto p-4">
          {doc.file_url && kind === "Image" ? (
            <img src={doc.file_url} alt={doc.title} className="mx-auto max-h-[72vh] max-w-full rounded bg-white shadow" />
          ) : doc.file_url && (kind === "PDF" || kind === "Text" || kind === "CSV") ? (
            <iframe src={doc.file_url} title={doc.title} sandbox="allow-same-origin" className="w-full h-[72vh] rounded border border-slate-200 bg-white" />
          ) : (
            <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
              This file type cannot be previewed in the browser. Open or download the original file.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function iconForMimeType(mime: string | null): string {
  if (!mime) return "\uD83D\uDCC4"
  if (mime === "application/pdf") return "\uD83D\uDCD5"
  if (mime.startsWith("image/")) return "\uD83D\uDDBC\uFE0F"
  if (mime.includes("wordprocessing") || mime === "application/msword") return "\uD83D\uDCDD"
  if (mime.includes("spreadsheet") || mime === "application/vnd.ms-excel") return "\uD83D\uDCCA"
  return "\uD83D\uDCC4"
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}