import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import {
  finishSubDocumentsLater,
  getMySubDocuments,
  uploadSubDocument,
  SUB_DOCUMENT_STATE_CLASS,
  SUB_DOCUMENT_STATE_LABEL,
  type SubDocumentRow,
} from '@/lib/subDocuments'

/**
 * /sub-documents -- a sub company's onboarding screen 2: upload what the
 * companies it works for asked for. Its owner lands here after every sign-in
 * until each one is in (SubDocumentsGate), so stopping halfway is fine.
 *
 * The first upload sets up the company's encryption key; its recovery key is
 * shown once, right then.
 *
 * Documents never hold up an urgent job (decided 2026-10-04), so "Finish
 * later" goes on into CrewBarn; the gate asks again at the next sign-in.
 */
export function SubDocumentsPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const qc = useQueryClient()
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)

  const docs = useQuery({ queryKey: ['sub-documents'], queryFn: getMySubDocuments, retry: false })
  const data = docs.data?.data

  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-50 p-4 sm:items-center sm:p-6">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 text-center text-lg font-bold text-navy-800">
          Crew<span className="text-amber-500">Barn</span>
        </div>
        <div data-tour="sub-docs-header">
        <h1 className="text-center text-xl font-semibold text-navy-900">Your documents</h1>
        <p className="mt-1 text-center text-sm text-slate-600">
          The companies you work for asked for these. They're encrypted, and only those companies can open them. You can stop and
          finish later: sign in and you'll land back here.
        </p>
        </div>

        {docs.isLoading && <p className="mt-6 text-center text-sm text-slate-500" role="status">Loading…</p>}
        {docs.isError && <p role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{(docs.error as Error).message}</p>}

        {data && (
          <>
            {!data.can_upload && (
              <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Your company's owner or an admin uploads these.</p>
            )}
            {data.documents.length === 0 ? (
              <p className="mt-6 text-center text-sm text-slate-600">Nothing has been asked for yet.</p>
            ) : (
              <ul className="mt-6 space-y-3" data-tour="sub-docs-row">
                {data.documents.map((row) => (
                  <DocumentRow
                    key={row.key ?? row.kind}
                    row={row}
                    canUpload={data.can_upload}
                    onUploaded={(next) => {
                      qc.setQueryData(['sub-documents'], { data: next.data })
                      if (next.data.recovery_key) setRecoveryKey(next.data.recovery_key)
                    }}
                  />
                ))}
              </ul>
            )}

            {data.complete ? (
              <div className="mt-6" data-tour="sub-docs-continue">
                <p role="status" className="text-center text-sm font-medium text-emerald-700">Everything they asked for is in.</p>
                <button type="button" onClick={() => navigate('/', { replace: true })} disabled={recoveryKey !== null} className="mt-3 w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                  Continue to CrewBarn
                </button>
              </div>
            ) : (
              <div className="mt-6" data-tour="sub-docs-continue">
                <p className="text-center text-xs text-slate-500">Jobs still come through while these are missing. The companies you work for see what's missing.</p>
                <button
                  type="button"
                  onClick={() => {
                    finishSubDocumentsLater()
                    navigate('/', { replace: true })
                  }}
                  disabled={recoveryKey !== null}
                  className="mt-3 w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-navy-900 hover:bg-slate-50 disabled:opacity-50"
                >
                  Finish later
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-5 text-center">
          <button type="button" onClick={() => void logout().then(() => navigate('/login', { replace: true }))} className="text-sm text-slate-600 hover:text-navy-900">
            Sign out and finish later
          </button>
        </div>
      </div>

      {recoveryKey && <RecoveryKeyModal recoveryKey={recoveryKey} onDone={() => setRecoveryKey(null)} />}
    </div>
  )
}

type UploadResult = Awaited<ReturnType<typeof uploadSubDocument>>

/** Insurance must carry its end date; a license may. */
const EXPIRY: Record<string, 'required' | 'optional'> = { insurance: 'required', insurance_holder: 'required', license: 'optional' }

function DocumentRow({ row, canUpload, onUploaded }: { row: SubDocumentRow; canUpload: boolean; onUploaded: (r: UploadResult) => void }) {
  const [open, setOpen] = useState(row.state === 'missing' || row.state === 'expired')
  const [file, setFile] = useState<File | null>(null)
  const [expiresOn, setExpiresOn] = useState('')
  const expiry = EXPIRY[row.kind]
  const inputId = `sub-doc-${(row.key ?? row.kind).replace(/[^a-zA-Z0-9_-]/g, '-')}`

  const upload = useMutation({
    mutationFn: () => uploadSubDocument(row.kind, file as File, expiresOn || null, row.for_hiring_tenant_id ?? null),
    onSuccess: (result) => {
      setFile(null)
      setExpiresOn('')
      setOpen(false)
      onUploaded(result)
    },
  })

  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy-900">
            {row.label}
            {row.required && <span className="ml-2 text-xs font-normal text-slate-500">Required</span>}
          </p>
          {row.kind === 'insurance_holder' && !row.document && (
            <p className="text-xs text-slate-500">Ask your insurance company for a certificate with this company as certificate holder, then upload it here.</p>
          )}
          {row.document && <p className="truncate text-xs text-slate-500">{row.document.filename}</p>}
          {row.document?.expires_on && (
            <p className="text-xs text-slate-500">Expires {new Date(`${row.document.expires_on}T00:00:00`).toLocaleDateString()}</p>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SUB_DOCUMENT_STATE_CLASS[row.state]}`}>{SUB_DOCUMENT_STATE_LABEL[row.state]}</span>
      </div>

      {canUpload && !open && (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-amber-700 hover:underline">
          Upload a newer one
        </button>
      )}

      {canUpload && open && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (file) upload.mutate()
          }}
        >
          <label htmlFor={inputId} className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-700">File</span>
            <input
              id={inputId}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-navy-900 hover:file:bg-slate-200"
            />
            <span className="mt-1 block text-xs text-slate-500">A PDF or a clear photo, up to 20 MB.</span>
          </label>
          {expiry && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-700">
                Expires on{expiry === 'optional' && <span className="normal-case tracking-normal text-slate-500"> (if it does)</span>}
              </span>
              <input
                type="date"
                value={expiresOn}
                required={expiry === 'required'}
                onChange={(e) => setExpiresOn(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </label>
          )}
          {upload.isError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{(upload.error as Error).message}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!file || upload.isPending || (expiry === 'required' && !expiresOn)} className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
            {row.document && (
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-600 hover:text-navy-900">Cancel</button>
            )}
          </div>
        </form>
      )}
    </li>
  )
}

/** Shown once, after the first upload made the company's encryption key. */
function RecoveryKeyModal({ recoveryKey, onDone }: { recoveryKey: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="recovery-key-title">
      <div className="m-auto w-full max-w-md rounded-xl bg-white p-6 shadow-xl" data-tour="sub-docs-recovery">
        <h2 id="recovery-key-title" className="text-lg font-semibold text-navy-900">Save your recovery key</h2>
        <p className="mt-2 text-sm text-slate-700">
          Your documents are encrypted with your company's own key. If that key is ever lost, this recovery key gets your files back.
          This is the only time CrewBarn shows it.
        </p>
        <p className="mt-4 break-all rounded-lg border border-amber-200 bg-amber-50 p-3 text-center font-mono text-sm font-bold text-navy-900">{recoveryKey}</p>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(recoveryKey).then(() => setCopied(true))}
          className="mt-2 text-xs font-medium text-amber-700 hover:underline"
        >
          {copied ? 'Copied' : 'Copy key'}
        </button>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 rounded text-amber-600 focus:ring-amber-500" />
          <span>I saved it somewhere safe, like a password manager.</span>
        </label>
        <div className="mt-5 text-right">
          <button type="button" onClick={onDone} disabled={!saved} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
