import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconBook2, IconTrash, IconUpload } from '@tabler/icons-react'
import { apiRequest, type ApiError } from '@/lib/api'
import {
  formatSize,
  removeReferenceCardDocument,
  showToCustomers,
  updateReferenceCardDocument,
  uploadReferenceCardDocument,
} from '@/lib/referenceCardDocuments'
import { LIMITS, type ReferenceCard, type ReferenceCardDocument } from '@/lib/referenceCards'
import { OpenDocument } from '@/components/magazine/OpenDocument'

/**
 * The files on a card, from the card's editor: add a manual, name it,
 * say whether it may travel, open it to set its tabs.
 *
 * Files save the moment they upload rather than with the card's Save
 * button. A twenty-megabyte upload that is thrown away because somebody
 * pressed Cancel on the words afterwards is a bad trade.
 */
export function ReferenceCardFiles({ cardId }: { cardId: string }) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)

  const cardQ = useQuery({
    queryKey: ['reference-card', cardId],
    queryFn: () => apiRequest<{ card: ReferenceCard }>(`/v1/reference-cards/${cardId}`),
  })
  const documents = cardQ.data?.card.documents ?? []

  const [pending, setPending] = useState<{ file: File; title: string; shareable: boolean } | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<ReferenceCardDocument | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['reference-card', cardId] })
    void qc.invalidateQueries({ queryKey: ['reference-cards'] })
  }

  const choose = (file: File | undefined) => {
    setError(null)
    if (!file) return

    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setError('Only PDF files can go on a card.')
      return
    }
    if (file.size > LIMITS.documentMb * 1024 * 1024) {
      setError(`That file is ${formatSize(file.size)}. The most a card takes is ${LIMITS.documentMb} MB — a catalogue that size usually splits into sections.`)
      return
    }

    setPending({ file, title: file.name.replace(/\.pdf$/i, ''), shareable: false })
  }

  const upload = useMutation({
    mutationFn: () => {
      if (!pending) throw new Error('Choose a file first.')
      setProgress(0)
      return uploadReferenceCardDocument(cardId, pending.file, {
        title: pending.title.trim(),
        shareable: pending.shareable,
        onProgress: setProgress,
      })
    },
    onSuccess: () => {
      setPending(null)
      refresh()
    },
    onError: (e) => setError((e as Error).message),
    onSettled: () => setProgress(null),
  })

  const change = useMutation({
    mutationFn: (v: { id: string; patch: { title?: string; shareable?: boolean } }) =>
      updateReferenceCardDocument(cardId, v.id, v.patch),
    onSuccess: refresh,
    onError: (e) => setError((e as ApiError)?.message ?? 'That change did not save.'),
  })

  const customers = useMutation({
    mutationFn: (v: { id: string; on: boolean }) => showToCustomers(cardId, v.id, v.on),
    onSuccess: refresh,
    onError: (e) => setError((e as ApiError)?.message ?? 'That change did not save.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeReferenceCardDocument(cardId, id),
    onSuccess: refresh,
    onError: (e) => setError((e as ApiError)?.message ?? 'That file was not removed.'),
  })

  const full = documents.length >= LIMITS.documents

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Files</span>
      <p className="mt-0.5 text-xs text-slate-500">
        A manual, an install guide, a catalogue — PDF, up to {LIMITS.documentMb} MB. It opens as a book
        with tabs down the edge. Files save as soon as they upload.
      </p>

      {error && (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
      )}

      {documents.length > 0 && (
        <ul className="mt-2 space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded-lg border border-slate-200 p-2.5">
              <div className="flex items-center gap-2">
                <IconBook2 size={18} className="shrink-0 text-slate-400" />
                <input
                  // Keyed on the saved title, so a rename that lands resets the field.
                  key={`${doc.id}:${doc.title}`}
                  defaultValue={doc.title}
                  maxLength={200}
                  aria-label="File name"
                  onBlur={(e) => {
                    const title = e.target.value.trim()
                    if (title && title !== doc.title) change.mutate({ id: doc.id, patch: { title } })
                  }}
                  className="min-w-0 flex-1 rounded border border-transparent px-1.5 py-1 text-sm font-medium hover:border-slate-300 focus:border-slate-300"
                />
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">{formatSize(doc.size_bytes)}</span>
                <button
                  type="button"
                  onClick={() => setOpen(doc)}
                  className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open{doc.tabs.length === 0 ? ' · set tabs' : ''}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${doc.title}`}
                  onClick={() => remove.mutate(doc.id)}
                  disabled={remove.isPending}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-700"
                >
                  <IconTrash size={16} />
                </button>
              </div>
              <ShareToggle
                checked={doc.shareable}
                onChange={(shareable) => change.mutate({ id: doc.id, patch: { shareable } })}
              />
              <CustomersToggle
                checked={!!doc.customer_visible}
                onChange={(on) => customers.mutate({ id: doc.id, on })}
              />
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50/50 p-2.5">
          <div className="flex items-center gap-2">
            <IconBook2 size={18} className="shrink-0 text-sky-600" />
            <input
              value={pending.title}
              maxLength={200}
              aria-label="File name"
              onChange={(e) => setPending({ ...pending, title: e.target.value })}
              className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            />
            <span className="shrink-0 text-xs text-slate-500 tabular-nums">{formatSize(pending.file.size)}</span>
          </div>
          <ShareToggle checked={pending.shareable} onChange={(shareable) => setPending({ ...pending, shareable })} />

          {progress !== null ? (
            <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-sky-600 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Storing it…'}
              </p>
            </div>
          ) : (
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => upload.mutate()}
                disabled={pending.title.trim() === ''}
                className="rounded bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              choose(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={full}
            onClick={() => input.current?.click()}
            className="mt-2 inline-flex items-center gap-1.5 rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50"
          >
            <IconUpload size={16} />
            {full ? `${LIMITS.documents} files is the most a card holds` : 'Add a PDF'}
          </button>
        </>
      )}

      {open && (
        <OpenDocument
          cardId={cardId}
          document={open}
          canEdit
          onClose={() => setOpen(null)}
          onTabsSaved={refresh}
        />
      )}
    </div>
  )
}

/**
 * Share this one catalog with the shop's customers in the portal, or not.
 * Each file is its own switch and every one starts off: the shop picks
 * which books its customers see, and a supplier's book is only shared if
 * the shop is allowed to.
 */
function CustomersToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mt-2 flex items-start gap-3 rounded-md bg-slate-50 px-2.5 py-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Share with customers"
        onClick={() => onChange(!checked)}
        className={
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 '
          + (checked ? 'bg-emerald-600' : 'bg-slate-300')
        }
      >
        <span
          aria-hidden
          className={'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ' + (checked ? 'translate-x-[18px]' : 'translate-x-0.5')}
        />
      </button>
      <span className="text-xs text-slate-600">
        <span className="flex items-center gap-2 font-medium text-slate-800">
          Share with customers
          {checked && <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[10.5px] font-semibold text-emerald-800">Shared</span>}
        </span>
        {checked
          ? 'Your customers can browse this one in the portal and send you an order from it.'
          : 'Off: only your team sees it. Turn on to let customers browse it and order from it in the portal. Only share a catalog you are allowed to share.'}
      </span>
    </div>
  )
}

/**
 * Off unless the shop turns it on. A supplier's catalogue is somebody
 * else's copyright: a shop may keep a copy for itself, and approving the
 * card around it must not hand that copy to every other shop.
 */
function ShareToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-1.5 flex items-start gap-2 text-xs text-slate-600">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span>
        Other shops may open this if CrewBarn approves the card for everyone. Leave it off for a
        supplier's catalogue — your copy is yours to keep, not to pass on.
      </span>
    </label>
  )
}
