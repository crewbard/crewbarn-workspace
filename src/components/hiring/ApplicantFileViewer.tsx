import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchApplicationFile, type ApplicationFileKind } from '@/lib/hiring'

/**
 * Resume / license photo, in an overlay on top of the applicant card —
 * not a new browser tab. PDFs render in an iframe, photos as an image;
 * Download is right there for anything that needs saving. The file is
 * fetched with the bearer token (the endpoint is authenticated), held as
 * an object URL for the life of the overlay, and revoked on close.
 */
export function ApplicantFileViewer({
  applicationId,
  kind,
  title,
  fileName,
  onClose,
}: {
  applicationId: string
  kind: ApplicationFileKind
  title: string
  fileName: string | null
  onClose: () => void
}) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    fetchApplicationFile(applicationId, kind)
      .then((f) => {
        if (cancelled) { URL.revokeObjectURL(f.url); return }
        url = f.url
        setFile(f)
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [applicationId, kind])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isPdf = file?.type === 'application/pdf'
  const isImage = !!file && file.type.startsWith('image/')

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex flex-col bg-slate-900/85 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <div className="text-sm font-bold">{title}</div>
          {fileName && <div className="truncate text-xs text-white/70">{fileName}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {file && (
            <a
              href={file.url}
              download={fileName || title}
              className="rounded-md border border-white/30 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              Download
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3 pt-0" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="rounded-lg bg-white px-5 py-4 text-sm text-rose-700">{error}</div>
        ) : !file ? (
          <div className="text-sm text-white/80">Loading…</div>
        ) : isPdf ? (
          <iframe title={title} src={file.url} className="h-full w-full max-w-5xl rounded-lg bg-white" />
        ) : isImage ? (
          <img src={file.url} alt={title} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        ) : (
          <div className="rounded-lg bg-white px-5 py-4 text-sm text-slate-700">
            This file type can't be shown here — use Download.
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
