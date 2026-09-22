import { useState } from 'react'
import {
  useExtractedDocForSource,
  useTriggerExtraction,
  type ExtractedDocSourceType,
} from '@/hooks/useExtractedDocuments'
import { ExtractedDocumentEditor } from './ExtractedDocumentEditor'

/**
 * PostUploadModal — shown right after a successful document upload.
 *
 * Three paths:
 *   1. Keep as-is — close, leave the file as a plain attachment
 *   2. Extract & make editable — AI pulls text → opens editor → save
 *      creates revision history. Edits track who + when.
 *   3. Make signable — coming soon (separate epic)
 *
 * If the source already has an extracted doc (re-upload, or somehow
 * triggered earlier), skips straight to the editor.
 */
interface Props {
  sourceType: ExtractedDocSourceType
  sourceId: string
  fileName: string | null
  mimeType: string | null
  onClose: () => void
}

export function PostUploadModal({ sourceType, sourceId, fileName, mimeType, onClose }: Props) {
  const existing = useExtractedDocForSource(sourceType, sourceId)
  const trigger = useTriggerExtraction()
  const [editingId, setEditingId] = useState<string | null>(null)

  // If existing extraction was found, jump straight to the editor.
  if (existing.data?.data && !editingId) {
    setEditingId(existing.data.data.id)
  }

  if (editingId) {
    return <ExtractedDocumentEditor id={editingId} onClose={onClose} />
  }

  const supported = !!mimeType && (mimeType.startsWith('image/') || mimeType.includes('pdf'))

  function handleExtract() {
    trigger.mutate(
      { source_type: sourceType, source_id: sourceId, title: fileName ?? undefined },
      {
        onSuccess: (resp) => setEditingId(resp.data.id),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy-900">What next?</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-slate-600">
            <strong>{fileName ?? 'File'}</strong> uploaded. Pick an option below.
          </p>

          <button
            type="button"
            onClick={handleExtract}
            disabled={!supported || trigger.isPending}
            className="w-full text-left px-4 py-3 rounded-lg border border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:hover:border-amber-200"
            title={!supported ? 'AI extraction only supports PDFs and images for now.' : ''}
          >
            <div className="flex items-start gap-3">
              <SparkleIcon />
              <div className="flex-1">
                <div className="text-sm font-semibold text-navy-900">
                  Extract content & make editable
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  AI reads the document and gives you an editable text version.
                  Every edit gets a revision stamp (who + when).
                  {!supported && ' Only PDFs + images supported.'}
                  {trigger.isPending && ' Extracting…'}
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            disabled
            className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 cursor-not-allowed opacity-70"
            title="Signable documents ship in a separate release."
          >
            <div className="flex items-start gap-3">
              <SignatureIcon />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  Make signable
                  <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium bg-slate-200 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Add signature fields for internal sign-off or customer signature.
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <FileIcon />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-700">Keep as-is</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Store the file as a plain attachment. You can extract later.
                </div>
              </div>
            </div>
          </button>

          {trigger.isError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {(trigger.error as Error)?.message ?? 'Extraction failed.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="currentColor">
      <path d="M8 1.5l1.4 3.6 3.6 1.4-3.6 1.4L8 11.5 6.6 7.9 3 6.5l3.6-1.4L8 1.5z" />
      <path d="M12.5 10l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </svg>
  )
}

function SignatureIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 13c2-4 4-6 6-2 1.5 3 4.5 1 6-2 1 2 2 2 2 2" strokeLinecap="round" />
      <path d="M3 16h14" strokeLinecap="round" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinejoin="round" />
      <path d="M13 3v4h4" strokeLinejoin="round" />
    </svg>
  )
}
