/**
 * Inline PDF preview card — used on the WO Doc tab for both the
 * customer's uploaded WO/PO and the auto-generated signed completion
 * copy. Falls back to a 'no PDF yet' state with a hint.
 *
 * Renders via iframe; R2 URLs are signed/public so the browser can
 * embed them directly. Header has the filename + 'open in new tab' +
 * 'download' affordances.
 */
export function WorkOrderPdfPreview({
  title,
  url,
  filename,
  uploadedAt,
  emptyHint,
}: {
  title: string
  url: string | null
  filename: string
  uploadedAt: string | null
  emptyHint: string
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-navy-900 truncate">
            {title}
          </h3>
          {url && (
            <p className="text-[11px] text-slate-500 truncate">
              {filename}
              {uploadedAt && (
                <span className="ml-1">
                  · {new Date(uploadedAt).toLocaleString()}
                </span>
              )}
            </p>
          )}
        </div>
        {url && (
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Open
            </a>
            <a
              href={url}
              download={filename}
              className="text-xs px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              Download
            </a>
          </div>
        )}
      </header>
      {url ? (
        <iframe
          src={url}
          title={title}
          className="w-full h-[640px] bg-slate-50"
        />
      ) : (
        <div className="p-8 text-center text-sm text-slate-500 bg-slate-50">
          {emptyHint}
        </div>
      )}
    </section>
  )
}
