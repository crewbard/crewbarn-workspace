import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconCamera,
  IconEye,
  IconFileText,
  IconPhoto,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'

/**
 * Local-only draft attachment held in parent component state. The
 * parent runs a sequential POST after the WO/Estimate is created.
 */
export interface DraftAttachment {
  draft_id: string
  file: File
  kind: 'image' | 'document'
  share_with_customer: boolean
}

type AttachmentTab = DraftAttachment['kind']

/**
 * Compact launcher plus a focused upload and preview overlay. Files stay in
 * parent state until the job/estimate exists, then the parent uploads them.
 */
export function CreateFormAttachmentsPicker({
  attachments,
  onChange,
  hint = 'Add job photos and supporting documents. Files upload after the job is created.',
  compact = false,
  open: controlledOpen,
  onOpenChange,
  hideLauncher = false,
}: {
  attachments: DraftAttachment[]
  onChange: (next: DraftAttachment[]) => void
  hint?: string
  compact?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideLauncher?: boolean
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen

  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }
  const [activeTab, setActiveTab] = useState<AttachmentTab>('image')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  const photos = attachments.filter((attachment) => attachment.kind === 'image')
  const documents = attachments.filter((attachment) => attachment.kind === 'document')
  const visibleAttachments = activeTab === 'image' ? photos : documents
  const previewAttachment =
    attachments.find((attachment) => attachment.draft_id === previewId) ??
    visibleAttachments[0] ??
    null

  function openManager(tab: AttachmentTab) {
    const first = attachments.find((attachment) => attachment.kind === tab)
    setActiveTab(tab)
    setPreviewId(first?.draft_id ?? null)
    setOpen(true)
  }

  function changeTab(tab: AttachmentTab) {
    const first = attachments.find((attachment) => attachment.kind === tab)
    setActiveTab(tab)
    setPreviewId(first?.draft_id ?? null)
  }

  function handleFiles(files: FileList | null, expectedKind: AttachmentTab) {
    if (!files) return

    const additions: DraftAttachment[] = Array.from(files).map((file) => {
      const kind: AttachmentTab = file.type.startsWith('image/') ? 'image' : 'document'
      return {
        draft_id:
          'att_draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        file,
        kind,
        share_with_customer: false,
      }
    })

    onChange([...attachments, ...additions])
    const firstExpected = additions.find((attachment) => attachment.kind === expectedKind)
    setPreviewId(firstExpected?.draft_id ?? additions[0]?.draft_id ?? null)

    if (imageInputRef.current) imageInputRef.current.value = ''
    if (documentInputRef.current) documentInputRef.current.value = ''
  }

  function patch(id: string, changes: Partial<DraftAttachment>) {
    onChange(
      attachments.map((attachment) =>
        attachment.draft_id === id ? { ...attachment, ...changes } : attachment,
      ),
    )
  }

  function remove(id: string) {
    const next = attachments.filter((attachment) => attachment.draft_id !== id)
    onChange(next)
    if (previewId === id) {
      setPreviewId(next.find((attachment) => attachment.kind === activeTab)?.draft_id ?? null)
    }
  }

  return (
    <>
      {!hideLauncher && (
        <section
        className={[
          'bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden',
          compact ? 'mb-0' : 'mb-4',
        ].join(' ')}
      >
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-950">Photos & Documents</h2>
        </div>
        <div className={compact ? 'px-4 py-3' : 'px-5 py-4'}>
          <p className="text-xs text-slate-500 mb-3">{hint}</p>
          <div
            role="tablist"
            aria-label="Manage job photos and documents"
            className="grid grid-cols-2 gap-2"
          >
            <AttachmentLauncher
              icon={<IconPhoto size={18} />}
              label="Photos"
              count={photos.length}
              onClick={() => openManager('image')}
            />
            <AttachmentLauncher
              icon={<IconFileText size={18} />}
              label="Documents"
              count={documents.length}
              onClick={() => openManager('document')}
            />
          </div>
        </div>
        </section>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Photos & Documents"
        subtitle="Review each file before it is attached to the new job."
        size="xl"
      >
        <Modal.Body className="space-y-4">
          <div
            role="tablist"
            aria-label="Attachment type"
            className="inline-flex rounded-md border border-slate-300 bg-slate-100 p-1"
          >
            <TabButton
              active={activeTab === 'image'}
              icon={<IconPhoto size={17} />}
              label={'Photos (' + photos.length + ')'}
              onClick={() => changeTab('image')}
            />
            <TabButton
              active={activeTab === 'document'}
              icon={<IconFileText size={17} />}
              label={'Documents (' + documents.length + ')'}
              onClick={() => changeTab('document')}
            />
          </div>

          <label className="flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-5 text-center text-slate-700 transition-colors hover:border-amber-400 hover:bg-amber-50/40">
            <input
              ref={activeTab === 'image' ? imageInputRef : documentInputRef}
              type="file"
              multiple
              accept={activeTab === 'image' ? 'image/*' : 'application/pdf,.doc,.docx'}
              onChange={(event) => handleFiles(event.target.files, activeTab)}
              className="hidden"
            />
            {activeTab === 'image' ? <IconCamera size={25} /> : <IconUpload size={25} />}
            <span>
              <span className="block text-sm font-semibold">
                {activeTab === 'image' ? 'Add job photos' : 'Add supporting documents'}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {activeTab === 'image'
                  ? 'Select one or more images from this device.'
                  : 'Select PDF, DOC, or DOCX files.'}
              </span>
            </span>
          </label>

          {visibleAttachments.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-white px-5 py-10 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                {activeTab === 'image' ? <IconPhoto size={21} /> : <IconFileText size={21} />}
              </div>
              <p className="text-sm font-medium text-slate-700">
                No {activeTab === 'image' ? 'photos' : 'documents'} selected
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Added files stay with this draft and upload after the job is created.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
              <div className="min-h-80 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                {previewAttachment ? (
                  <AttachmentVisual attachment={previewAttachment} large />
                ) : null}
              </div>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {visibleAttachments.map((attachment) => (
                  <AttachmentRow
                    key={attachment.draft_id}
                    attachment={attachment}
                    selected={previewAttachment?.draft_id === attachment.draft_id}
                    onPreview={() => setPreviewId(attachment.draft_id)}
                    onShareChange={(share_with_customer) =>
                      patch(attachment.draft_id, { share_with_customer })
                    }
                    onRemove={() => remove(attachment.draft_id)}
                  />
                ))}
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="justify-between">
          <span className="text-xs text-slate-500">
            {attachments.length} {attachments.length === 1 ? 'file' : 'files'} ready to upload
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Done
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

function AttachmentLauncher({
  icon,
  label,
  count,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      onClick={onClick}
      className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-slate-700 hover:border-amber-400 hover:bg-amber-50/30"
    >
      <span className="text-slate-500">{icon}</span>
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">
        {count}
      </span>
    </button>
  )
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium',
        active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}

function AttachmentRow({
  attachment,
  selected,
  onPreview,
  onShareChange,
  onRemove,
}: {
  attachment: DraftAttachment
  selected: boolean
  onPreview: () => void
  onShareChange: (checked: boolean) => void
  onRemove: () => void
}) {
  return (
    <div
      className={[
        'rounded-md border bg-white p-2.5',
        selected ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200',
      ].join(' ')}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPreview}
          className="h-16 w-20 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100"
          aria-label={'Preview ' + attachment.file.name}
        >
          <AttachmentVisual attachment={attachment} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{attachment.file.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{formatBytes(attachment.file.size)}</p>
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              onClick={onPreview}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Preview file"
              aria-label="Preview file"
            >
              <IconEye size={17} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-rose-600 hover:bg-rose-50"
              title="Remove file"
              aria-label="Remove file"
            >
              <IconTrash size={17} />
            </button>
          </div>
        </div>
      </div>
      <label className="mt-2.5 flex cursor-pointer items-center gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={attachment.share_with_customer}
          onChange={(event) => onShareChange(event.target.checked)}
          className="rounded border-slate-300"
        />
        Share in customer portal
      </label>
    </div>
  )
}

function AttachmentVisual({
  attachment,
  large = false,
}: {
  attachment: DraftAttachment
  large?: boolean
}) {
  const url = useMemo(() => URL.createObjectURL(attachment.file), [attachment.file])

  useEffect(() => {
    return () => URL.revokeObjectURL(url)
  }, [url])

  if (attachment.kind === 'image') {
    return <img src={url} alt={attachment.file.name} className="h-full w-full object-contain" />
  }

  if (isPdf(attachment.file)) {
    const source = url + '#page=1&view=FitH&toolbar=0'
    return large ? (
      <iframe
        src={source}
        title={attachment.file.name}
        className="h-full min-h-[28rem] w-full bg-white"
      />
    ) : (
      <div className="relative h-full w-full overflow-hidden bg-white">
        <iframe
          src={source}
          title={'Preview of ' + attachment.file.name}
          tabIndex={-1}
          className="pointer-events-none h-[240%] w-[240%] origin-top-left scale-[0.42] bg-white"
        />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 px-3 text-center text-slate-500">
      <IconFileText size={large ? 48 : 25} />
      {large && (
        <>
          <p className="max-w-md break-all text-sm font-medium text-slate-700">
            {attachment.file.name}
          </p>
          <p className="text-xs">A visual preview is available for images and PDF files.</p>
        </>
      )}
    </div>
  )
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * Uploads a single DraftAttachment to a WO. Best-effort: one failed
 * upload does not roll back the parent record.
 */
// This module intentionally exports the uploader used by create-page parents.
// eslint-disable-next-line react-refresh/only-export-components
export async function uploadDraftAttachment(
  endpoint: string,
  draft: DraftAttachment,
): Promise<void> {
  const fd = new FormData()
  if (draft.kind === 'image') {
    fd.append('photos[]', draft.file)
  } else {
    fd.append('document', draft.file)
  }
  fd.append('share_with_customer', draft.share_with_customer ? '1' : '0')

  const token = getStoredToken()
  const tenant = getActingTenant()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  if (tenant) headers['X-Act-As-Tenant'] = tenant

  const res = await fetch(API_URL + endpoint, {
    method: 'POST',
    headers,
    body: fd,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Upload failed (' + res.status + ')')
  }
}