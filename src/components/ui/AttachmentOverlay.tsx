import { useEffect } from 'react'

/**
 * Shared full-screen overlay for viewing attachments inline. Renders
 * the attachment in-page (image or PDF) with two header actions:
 *
 *   - Print           — image: opens a print-formatted new window and
 *                       auto-fires window.print(); PDF: opens the file
 *                       in a new tab where the browser's PDF viewer
 *                       toolbar handles print (cross-origin iframe
 *                       print is unreliable across Chrome/Safari/Firefox)
 *   - Open in browser — window.open(url, '_blank')
 *   - Close           — backdrop click, Esc key, or × button
 *
 * Used by Pictures, Docs, Photos, Signatures, and Sub Invoice tabs.
 * Pass `filename` so the print-window title + download default are
 * something recognizable.
 *
 * Kind defaults to 'image'. For PDFs and other docs pass kind='document'
 * which switches the inline viewer from <img> to <iframe>.
 */
export function AttachmentOverlay({
  url,
  filename,
  kind = 'image',
  onExtract,
  extractLabel = '✦ Extract with AI',
  onClose,
}: {
  url: string
  filename?: string
  kind?: 'image' | 'document'
  /**
   * When provided, an "Extract with AI" button appears in the header
   * and calls this handler. The caller is responsible for opening the
   * post-extract flow (the overlay closes after firing so the screen
   * doesn't end up with two big modals stacked).
   */
  onExtract?: () => void
  extractLabel?: string
  onClose: () => void
}) {
  // Esc closes — standard modal affordance.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handlePrint() {
    if (kind === 'image') {
      // Open a clean new window scoped to just this image and trigger
      // print after the image has loaded. Cross-origin URLs are fine
      // here because we're rendering <img src=...> — the browser
      // doesn't need script access to the image bytes to print it.
      const w = window.open('', '_blank', 'width=900,height=1100')
      if (!w) return
      const safe = (filename ?? 'image').replace(/[<>"']/g, '')
      w.document.write(`<!doctype html>
<html><head><title>${safe}</title>
<style>
  html,body { margin:0; padding:0; background:#fff; }
  .wrap { padding:24px; display:flex; align-items:center; justify-content:center; min-height:100vh; box-sizing:border-box; }
  img { max-width:100%; max-height:100vh; object-fit:contain; }
  @media print { .wrap { padding:0; } }
</style></head>
<body><div class="wrap"><img src="${url}" alt="${safe}" onload="setTimeout(function(){window.focus();window.print();}, 100);" /></div></body></html>`)
      w.document.close()
    } else {
      // PDF / doc: open in a new tab. The browser's native PDF viewer
      // has its own Print toolbar; trying to print a cross-origin
      // iframe from JS is blocked in most browsers.
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  function handleOpenInBrowser() {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Header — stop click propagation so taps don't dismiss while
          the user reaches for a button. */}
      <div
        className="flex items-center justify-between gap-3 bg-slate-900/90 text-white px-4 py-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1 text-sm truncate font-medium">
          {filename ?? 'Attachment'}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onExtract && (
            <button
              type="button"
              onClick={() => {
                onExtract()
                onClose()
              }}
              className="text-xs font-semibold bg-amber-500/90 hover:bg-amber-500 text-white rounded px-3 py-1.5"
              title="Use AI to extract editable text from this document"
            >
              {extractLabel}
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded px-3 py-1.5"
          >
            🖨️ Print
          </button>
          <button
            type="button"
            onClick={handleOpenInBrowser}
            className="text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded px-3 py-1.5"
          >
            ↗ Open in browser
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center"
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-auto"
        onClick={(e) => {
          // Click on the body region (not the file itself) closes.
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {kind === 'image' ? (
          <img
            src={url}
            alt={filename ?? ''}
            className="max-w-full max-h-full object-contain bg-white rounded"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <iframe
            src={url}
            title={filename ?? 'document'}
            className="w-full h-full bg-white rounded border border-slate-300"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  )
}
