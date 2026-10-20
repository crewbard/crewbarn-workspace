import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  downloadSecureFileExport,
  listSecureFileExports,
  startSecureFileExport,
  type SecureFileExport,
} from '@/lib/companySecureFiles'

/**
 * Take your secure files with you: every file in Company Files and every
 * customer's Secure Files as one AES-256 encrypted zip that opens in 7-Zip
 * (or Keka / The Unarchiver on a Mac) without CrewBarn.
 *
 * The password is shown here once, when the export starts. CrewBarn keeps it
 * only until the zip is built. The zip is kept for 24 hours.
 */
export function SecureFileExportPanel({ unlocked }: { unlocked: boolean }) {
  const qc = useQueryClient()
  const [passphrase, setPassphrase] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const exports = useQuery({
    queryKey: ['secure-file-exports'],
    queryFn: () => listSecureFileExports(),
    // While one is being made, check every few seconds.
    refetchInterval: (q) =>
      (q.state.data?.data ?? []).some((e) => e.status === 'queued' || e.status === 'building') ? 3000 : false,
  })
  const start = useMutation({
    mutationFn: () => startSecureFileExport(),
    onSuccess: (res) => {
      setPassphrase(res.passphrase)
      setCopied(false)
      qc.invalidateQueries({ queryKey: ['secure-file-exports'] })
    },
  })

  const latest: SecureFileExport | undefined = exports.data?.data[0]
  const working = latest?.status === 'queued' || latest?.status === 'building'

  async function handleDownload(exp: SecureFileExport) {
    setDownloadError(null)
    setDownloading(true)
    try {
      await downloadSecureFileExport(exp.id, exp.download_name)
      qc.invalidateQueries({ queryKey: ['secure-file-exports'] })
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e))
    } finally {
      setDownloading(false)
    }
  }

  async function copyPassphrase() {
    if (!passphrase) return
    try {
      await navigator.clipboard.writeText(passphrase)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div data-tour="company-files-export" className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-navy-900">Take your secure files with you</div>
      <p className="mt-1 max-w-2xl text-xs text-slate-500">
        Every file in Company Files and every customer&apos;s Secure Files, in one encrypted zip (AES-256). It opens
        with 7-Zip on Windows, or Keka or The Unarchiver on a Mac, using a password shown here once. File names are
        inside too, in a manifest, so nothing about them shows until it&apos;s opened. Kept for 24 hours.
      </p>

      {!unlocked ? (
        <p className="mt-3 text-xs font-medium text-slate-600">Unlock company files below to make an export.</p>
      ) : (
        <button
          type="button"
          onClick={() => start.mutate()}
          disabled={start.isPending || working}
          className="mt-3 rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
        >
          {start.isPending ? 'Starting…' : working ? 'Making the export…' : 'Export all secure files'}
        </button>
      )}
      {start.error && (
        <p className="mt-2 text-xs text-red-700">{start.error instanceof Error ? start.error.message : 'Could not start the export.'}</p>
      )}

      {passphrase && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-900">The zip&apos;s password, shown once</div>
          <p className="mt-1 text-xs text-red-800">
            Save it somewhere safe before you leave this page. Without it the zip can&apos;t be opened, and CrewBarn
            doesn&apos;t keep a copy.
          </p>
          <code className="mt-3 block select-all break-all rounded border border-red-200 bg-white p-3 font-mono text-sm font-bold tracking-wide text-red-950">
            {passphrase}
          </code>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copyPassphrase} className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800">
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={() => setPassphrase(null)} className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800">
              I saved it
            </button>
          </div>
        </div>
      )}

      {latest && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          {working && <span className="text-slate-700">Making the export…</span>}
          {latest.status === 'ready' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-700">
                Ready: {latest.file_count} file{latest.file_count === 1 ? '' : 's'}
                {latest.customer_count > 0 && ` from ${latest.customer_count} customer${latest.customer_count === 1 ? '' : 's'} and the company`}
                , {formatBytes(latest.size_bytes)}.
                {latest.skipped_count > 0 && (
                  <span className="text-amber-800"> {latest.skipped_count} couldn&apos;t be read; the manifest names them.</span>
                )}
                {latest.expires_at && (
                  <span className="text-slate-500"> Deleted {new Date(latest.expires_at).toLocaleString()}.</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => handleDownload(latest)}
                disabled={!unlocked || downloading}
                title={!unlocked ? 'Unlock company files first' : undefined}
                className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {downloading ? 'Downloading…' : 'Download encrypted zip'}
              </button>
            </div>
          )}
          {latest.status === 'failed' && <span className="text-red-700">The last export didn&apos;t finish: {latest.error ?? 'unknown error'}</span>}
          {latest.status === 'expired' && <span className="text-slate-500">The last export has been deleted. Make a new one when you need it.</span>}
        </div>
      )}
      {downloadError && <p className="mt-2 text-xs text-red-700">{downloadError}</p>}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
