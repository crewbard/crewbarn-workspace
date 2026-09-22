import { useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import {
  useCompanySecureFileAudit,
  useCompanySecureFiles,
  useCompanySecureFileStatus,
  useCreateCompanySecureNote,
  useDeleteCompanySecureFile,
  useRecoverCompanySecureFileKey,
  useRequestCompanySecureFileAccess,
  useRotateCompanySecureFileRecoveryKey,
  useSetupCompanySecureFiles,
  useUpdateCompanySecureFile,
  useUploadCompanySecureFile,
  useVerifyCompanySecureFileAccess,
} from '@/hooks/useCompanySecureFiles'
import { fetchCompanySecureFileBlob, type CompanySecureFile } from '@/lib/companySecureFiles'

type SecureFileViewerState = {
  file: CompanySecureFile
  blobUrl: string | null
  body: string | null
  mimeType: string | null
  loading: boolean
  error: string | null
}

/**
 * Tool Shed → Company Files. A tenant-internal encrypted vault for the
 * business's OWN sensitive documents (bank statements, EIN/insurance docs,
 * master-key charts) — protected exactly like customer Secure Files: per-file
 * AES-256-GCM under the per-tenant wrapping key (KMS/BYOK envelope), a step-up
 * code to unlock, and a full audit trail. Not attached to any customer.
 */
export function CompanySecureFilesPage() {
  const { has } = usePermissions()
  const status = useCompanySecureFileStatus()
  const files = useCompanySecureFiles()
  const setup = useSetupCompanySecureFiles()
  const requestAccess = useRequestCompanySecureFileAccess()
  const verifyAccess = useVerifyCompanySecureFileAccess()
  const rotateRecovery = useRotateCompanySecureFileRecoveryKey()
  const recoverKey = useRecoverCompanySecureFileKey()
  const upload = useUploadCompanySecureFile()
  const createNote = useCreateCompanySecureNote()
  const remove = useDeleteCompanySecureFile()
  const [viewer, setViewer] = useState<SecureFileViewerState | null>(null)
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [recoveryInput, setRecoveryInput] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const [auditFile, setAuditFile] = useState<CompanySecureFile | null>(null)

  const keyConfigured = !!status.data?.data.key.configured
  const unlocked = !!files.data?.meta.unlocked
  const canManage = !!status.data?.data.can_manage
  const rows = files.data?.data ?? []

  async function handleSetup() {
    const res = await setup.mutateAsync()
    if (res.data.recovery_key) setRecoveryKey(res.data.recovery_key)
  }

  async function handleRequestAccess() {
    await requestAccess.mutateAsync(channel)
  }

  async function handleVerifyAccess() {
    await verifyAccess.mutateAsync(code)
    setCode('')
  }

  async function handleRotateRecoveryKey() {
    setRecoveryMessage(null)
    const confirmed = window.confirm('Rotate the Company Files recovery key? The new key is shown once. The old recovery key will stop working.')
    if (!confirmed) return
    const res = await rotateRecovery.mutateAsync()
    setRecoveryKey(res.data.recovery_key)
    setRecoveryMessage('Recovery key rotated. Store the new key now.')
  }

  async function handleRecoverKey() {
    setRecoveryMessage(null)
    try {
      await recoverKey.mutateAsync(recoveryInput)
      setRecoveryInput('')
      setRecoveryMessage('Recovery key accepted. Company Files key material was rewrapped.')
    } catch (e) {
      setRecoveryMessage(e instanceof Error ? e.message : 'Recovery failed.')
    }
  }

  async function handleUpload(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return
    setUploadError(null)
    try {
      for (const file of Array.from(filesList)) {
        await upload.mutateAsync({ file })
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleCreateNote() {
    setUploadError(null)
    try {
      await createNote.mutateAsync({
        title: noteTitle || 'Secure note',
        body: noteBody,
      })
      setNoteTitle('')
      setNoteBody('')
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function openSecureFile(file: CompanySecureFile, download = false) {
    try {
      const blob = await fetchCompanySecureFileBlob(file.id, download)
      const url = URL.createObjectURL(blob)
      if (download) {
        const a = document.createElement('a')
        a.href = url
        a.download = file.original_filename || file.title
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else {
        if (viewer?.blobUrl) URL.revokeObjectURL(viewer.blobUrl)
        setViewer({
          file,
          blobUrl: null,
          body: null,
          mimeType: file.mime_type || blob.type || null,
          loading: true,
          error: null,
        })

        if (isSecureTextFile(file, blob)) {
          const body = await blob.text()
          URL.revokeObjectURL(url)
          setViewer({
            file,
            blobUrl: null,
            body,
            mimeType: file.mime_type || blob.type || 'text/plain',
            loading: false,
            error: null,
          })
        } else {
          setViewer({
            file,
            blobUrl: url,
            body: null,
            mimeType: file.mime_type || blob.type || null,
            loading: false,
            error: null,
          })
        }
      }
    } catch (e) {
      if (download) {
        alert(e instanceof Error ? e.message : String(e))
      } else {
        setViewer({
          file,
          blobUrl: null,
          body: null,
          mimeType: file.mime_type,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  function closeSecureViewer() {
    if (viewer?.blobUrl) URL.revokeObjectURL(viewer.blobUrl)
    setViewer(null)
  }

  async function handleDelete(file: CompanySecureFile) {
    if (!window.confirm(`Delete "${file.title}"? This cannot be undone.`)) return
    try {
      await remove.mutateAsync(file.id)
    } catch (e) {
      alert('Failed to delete secure file: ' + String(e))
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-navy-900">Company Files</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Your company's own encrypted vault — bank statements, EIN/insurance docs, master-key
              charts, and other sensitive records that aren't tied to a customer. Same protection as
              customer Secure Files: encrypted per file, a step-up code to open, and a full audit trail.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {unlocked ? 'Unlocked' : 'Locked'}
          </div>
        </div>

        {status.isLoading ? (
          <div className="mt-5 text-sm text-slate-500">Loading…</div>
        ) : (
          <>
            {!keyConfigured && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-950">Secure Files setup required</div>
                <p className="mt-1 text-sm text-amber-900">
                  Setup generates tenant-specific encryption keys and a one-time recovery key. Store the
                  recovery key somewhere safe; it cannot be shown again. (Customer Secure Files and Company
                  Files share the same tenant key — if you've already set up one, the other is ready too.)
                </p>
                {canManage ? (
                  <button
                    type="button"
                    onClick={handleSetup}
                    disabled={setup.isPending}
                    className="mt-3 rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
                  >
                    {setup.isPending ? 'Setting up...' : 'Set up secure files'}
                  </button>
                ) : (
                  <p className="mt-3 text-sm text-amber-900">Ask an owner or admin to complete setup.</p>
                )}
              </div>
            )}

            {recoveryKey && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-900">Recovery key shown once</div>
                <p className="mt-1 text-sm text-red-800">Store this in a safe place now. CrewBarn will not show it again.</p>
                <code className="mt-3 block rounded border border-red-200 bg-white p-3 text-sm font-bold text-red-950">{recoveryKey}</code>
                <button type="button" onClick={() => setRecoveryKey(null)} className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800">
                  I stored this safely
                </button>
              </div>
            )}

            {keyConfigured && canManage && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-navy-900">Owner/admin recovery controls</div>
                <p className="mt-1 text-xs text-slate-500">
                  Rotate shows a new recovery key one time. Recover rewraps tenant key material from the stored recovery key.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRotateRecoveryKey}
                    disabled={rotateRecovery.isPending}
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                  >
                    {rotateRecovery.isPending ? 'Rotating...' : 'Rotate recovery key'}
                  </button>
                  <input
                    value={recoveryInput}
                    onChange={(e) => setRecoveryInput(e.target.value)}
                    placeholder="Existing recovery key"
                    className="min-w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleRecoverKey}
                    disabled={recoverKey.isPending || !recoveryInput.trim()}
                    className="rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
                  >
                    {recoverKey.isPending ? 'Recovering...' : 'Recover / rewrap'}
                  </button>
                </div>
                {recoveryMessage && <p className="mt-2 text-xs text-slate-600">{recoveryMessage}</p>}
              </div>
            )}

            {keyConfigured && (
              <>
                {!unlocked && (
                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-navy-900">Unlock company files</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <select value={channel} onChange={(e) => setChannel(e.target.value as 'sms' | 'email')} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="sms">Text code</option>
                        <option value="email">Email code</option>
                      </select>
                      <button type="button" onClick={handleRequestAccess} disabled={requestAccess.isPending} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60">
                        {requestAccess.isPending ? 'Sending...' : 'Send code'}
                      </button>
                      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      <button type="button" onClick={handleVerifyAccess} disabled={verifyAccess.isPending || !code.trim()} className="rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
                        Verify
                      </button>
                    </div>
                    {requestAccess.data?.data && (
                      <p className={`mt-2 text-xs ${requestAccess.data.data.sent ? 'text-emerald-700' : 'text-red-700'}`}>
                        {requestAccess.data.data.sent
                          ? `Code sent to ${requestAccess.data.data.to ?? channel}.`
                          : requestAccess.data.data.error ?? 'Could not send code.'}
                      </p>
                    )}
                    {verifyAccess.error && <p className="mt-2 text-xs text-red-700">{verifyAccess.error instanceof Error ? verifyAccess.error.message : 'Invalid code.'}</p>}
                  </div>
                )}

                {unlocked && (
                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <div className="text-sm font-semibold text-navy-900">Upload encrypted file</div>
                      <label className="mt-3 inline-block cursor-pointer rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                        {upload.isPending ? 'Uploading...' : '+ Upload file'}
                        <input type="file" multiple className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }} />
                      </label>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <div className="text-sm font-semibold text-navy-900">Create secure note</div>
                      <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Title" className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Secure note" rows={3} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      <button type="button" onClick={handleCreateNote} disabled={createNote.isPending || !noteBody.trim()} className="mt-2 rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
                        Save encrypted note
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {uploadError && <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</div>}

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
              {files.isLoading ? (
                <div className="p-4 text-sm text-slate-500">Loading secure files...</div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No company files yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {rows.map((file) => (
                    <div key={file.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-navy-950">{file.title}</div>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">{sourceLabel(file.source)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>{file.original_filename ?? 'Secure note'}</span>
                          <span>{formatSecureFileSize(file.size_bytes)}</span>
                          {file.created_by_name && <span>By {file.created_by_name}</span>}
                          {file.created_at && <span>{new Date(file.created_at).toLocaleString()}</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <button type="button" onClick={() => openSecureFile(file)} disabled={!unlocked || !has('company.secure_files.view')} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">View</button>
                        {has('company.secure_files.audit') && <button type="button" onClick={() => setAuditFile(file)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Audit</button>}
                        {has('company.secure_files.delete') && <button type="button" onClick={() => handleDelete(file)} className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {viewer && (
          <CompanySecureFileViewerModal
            viewer={viewer}
            onClose={closeSecureViewer}
            onSaved={(file) => setViewer((current) => current ? { ...current, file } : current)}
          />
        )}
        {auditFile && <CompanySecureFileAuditModal file={auditFile} onClose={() => setAuditFile(null)} />}
      </section>
    </div>
  )
}

function CompanySecureFileViewerModal({
  viewer,
  onClose,
  onSaved,
}: {
  viewer: SecureFileViewerState
  onClose: () => void
  onSaved: (file: CompanySecureFile) => void
}) {
  const { has } = usePermissions()
  const updateFile = useUpdateCompanySecureFile()
  const [title, setTitle] = useState(viewer.file.title || '')
  const [description, setDescription] = useState(viewer.file.description || '')
  const [body, setBody] = useState(viewer.body || '')
  const [savedBody, setSavedBody] = useState(viewer.body || '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const canEditBody = viewer.file.source === 'web_creator' && has('company.secure_files.create')
  const canEditMetadata = has('company.secure_files.create') || has('company.secure_files.upload')
  const mimeType = viewer.mimeType || viewer.file.mime_type || ''
  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const dirty =
    title !== (viewer.file.title || '') ||
    description !== (viewer.file.description || '') ||
    (canEditBody && body !== savedBody)

  useEffect(() => {
    setTitle(viewer.file.title || '')
    setDescription(viewer.file.description || '')
    setBody(viewer.body || '')
    setSavedBody(viewer.body || '')
    setSaveError(null)
  }, [viewer.file.id, viewer.file.title, viewer.file.description, viewer.body])

  async function handleSave() {
    setSaveError(null)
    try {
      const res = await updateFile.mutateAsync({
        fileId: viewer.file.id,
        title,
        description,
        ...(canEditBody ? { body } : {}),
      })
      onSaved(res.data)
      setSavedBody(body)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-navy-900">Company file</div>
            <div className="mt-1 truncate text-xs text-slate-500">{viewer.file.original_filename ?? 'Secure note'}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">Close</button>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[360px_1fr]">
          <div className="overflow-auto border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEditMetadata}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEditMetadata}
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <div>{sourceLabel(viewer.file.source)}</div>
              <div>{formatSecureFileSize(viewer.file.size_bytes)}</div>
              {viewer.file.updated_at && <div>Updated {new Date(viewer.file.updated_at).toLocaleString()}</div>}
            </div>
            {saveError && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || updateFile.isPending || (!canEditMetadata && !canEditBody)}
                className="rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
              >
                {updateFile.isPending ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
          <div className="min-h-[420px] overflow-auto bg-slate-100 p-5">
            {viewer.loading ? (
              <div className="rounded-lg bg-white p-6 text-sm text-slate-500">Loading secure file...</div>
            ) : viewer.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{viewer.error}</div>
            ) : canEditBody ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[520px] w-full rounded-lg border border-slate-300 bg-white p-4 font-mono text-sm text-slate-900 shadow-sm"
              />
            ) : viewer.body !== null ? (
              <pre className="min-h-[420px] whitespace-pre-wrap rounded-lg bg-white p-4 text-sm text-slate-800 shadow-sm">{viewer.body}</pre>
            ) : isImage && viewer.blobUrl ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-lg bg-white p-4 shadow-sm">
                <img src={viewer.blobUrl} alt={viewer.file.title} className="max-h-[70vh] max-w-full object-contain" />
              </div>
            ) : isPdf && viewer.blobUrl ? (
              <iframe title={viewer.file.title} src={viewer.blobUrl} className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white shadow-sm" />
            ) : (
              <div className="rounded-lg bg-white p-6 text-sm text-slate-600 shadow-sm">
                This file type cannot be previewed inline yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CompanySecureFileAuditModal({ file, onClose }: { file: CompanySecureFile; onClose: () => void }) {
  const audit = useCompanySecureFileAudit(file.id)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-navy-900">Company file audit</div>
            <div className="text-xs text-slate-500">{file.title}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        <div className="max-h-[60vh] overflow-auto p-5">
          {audit.isLoading ? (
            <div className="text-sm text-slate-500">Loading audit...</div>
          ) : (audit.data?.data ?? []).length === 0 ? (
            <div className="text-sm text-slate-500">No audit events yet.</div>
          ) : (
            <div className="space-y-3">
              {(audit.data?.data ?? []).map((row) => (
                <div key={row.id} className="rounded border border-slate-200 p-3">
                  <div className="text-sm font-semibold text-navy-900">{row.event.replace(/_/g, ' ')}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.actor ?? 'system'} · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatSecureFileSize(bytes: number | null): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function sourceLabel(source: string): string {
  return source.replace(/_/g, ' ')
}

function isSecureTextFile(file: CompanySecureFile, blob: Blob): boolean {
  const mimeType = file.mime_type || blob.type || ''
  return file.source === 'web_creator' || mimeType.startsWith('text/')
}
