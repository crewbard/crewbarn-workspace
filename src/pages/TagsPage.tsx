import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'

/**
 * Tool Shed → Lists → Tags.
 *
 * Tenant-defined label dictionary. Pure CRUD — join tables on work
 * orders / customers / assets ship as those features need them, so this
 * page just manages the master list.
 */

interface Tag {
  id: string
  name: string
  color: string
  sort_order: number
  active: boolean
}

const COLOR_OPTIONS = [
  { value: 'slate', label: 'Slate', hex: '#64748b' },
  { value: 'blue', label: 'Blue', hex: '#3b82f6' },
  { value: 'green', label: 'Green', hex: '#10b981' },
  { value: 'amber', label: 'Amber', hex: '#f59e0b' },
  { value: 'red', label: 'Red', hex: '#ef4444' },
  { value: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { value: 'pink', label: 'Pink', hex: '#ec4899' },
  { value: 'teal', label: 'Teal', hex: '#14b8a6' },
]

function hexFor(c: string): string {
  return COLOR_OPTIONS.find((o) => o.value === c)?.hex ?? c
}

interface Form {
  name: string
  color: string
  sort_order: string
  active: boolean
}

const EMPTY_FORM: Form = { name: '', color: 'slate', sort_order: '0', active: true }

export function TagsPage() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiRequest<{ data: Tag[] }>('/v1/tags'),
  })
  const tags = query.data?.data ?? []

  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const editTag = useMemo(() => tags.find((t) => t.id === editId) ?? null, [tags, editId])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest(`/v1/tags/${id}`, { method: 'PATCH', body: { active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })

  const busy = deleteMutation.isPending || toggleActive.isPending

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tags</h1>
        <p className="text-sm text-slate-500 mt-1">
          Labels you can attach to jobs, customers, and other records. Use them
          to filter and group however your shop thinks — VIP, Recurring, Warranty,
          Needs Follow-up, etc.
        </p>
      </div>

      {query.isLoading && <p className="text-sm text-slate-400 italic">Loading…</p>}

      {!query.isLoading && tags.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-6 py-12 text-center">
          <p className="text-sm text-slate-600 mb-4">No tags yet.</p>
          <button
            onClick={() => setAddOpen(true)}
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            Add your first tag →
          </button>
        </div>
      )}

      {tags.length > 0 && (
        <>
          <div className="space-y-2">
            {tags.map((t) => (
              <div
                key={t.id}
                className={[
                  'bg-white border rounded-lg px-4 py-3 flex items-center gap-3',
                  t.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/60 opacity-70',
                ].join(' ')}
              >
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-white text-[11px] font-bold shrink-0"
                  style={{ background: hexFor(t.color) }}
                >
                  {t.name}
                </span>
                <div className="flex-1 min-w-0">
                  {!t.active && (
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.active}
                    title={t.active ? 'Active' : 'Inactive'}
                    onClick={() => toggleActive.mutate({ id: t.id, active: !t.active })}
                    disabled={busy}
                    className={[
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
                      t.active ? 'bg-emerald-500' : 'bg-slate-300',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                        t.active ? 'translate-x-6' : 'translate-x-1',
                      ].join(' ')}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(t.id)}
                    disabled={busy}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(t.id)}
                    disabled={busy}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <button
              onClick={() => setAddOpen(true)}
              className="text-sm font-medium text-amber-700 hover:underline"
            >
              + Add tag
            </button>
          </div>
        </>
      )}

      {(addOpen || editTag) && (
        <TagEditor
          isOpen
          tag={editTag}
          onClose={() => {
            setAddOpen(false)
            setEditId(null)
          }}
          onSaved={() => {
            setAddOpen(false)
            setEditId(null)
            qc.invalidateQueries({ queryKey: ['tags'] })
          }}
        />
      )}
    </div>
  )
}

function TagEditor({
  isOpen,
  tag,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  tag: Tag | null
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const mode = tag ? 'edit' : 'add'
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setServerError(null)
    if (tag) {
      setForm({
        name: tag.name,
        color: tag.color,
        sort_order: tag.sort_order.toString(),
        active: tag.active,
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [isOpen, tag])

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      mode === 'add'
        ? apiRequest<{ data: Tag }>('/v1/tags', { method: 'POST', body: payload })
        : apiRequest<{ data: Tag }>(`/v1/tags/${tag!.id}`, { method: 'PATCH', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] })
      onSaved()
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      if (err?.status === 422 && err?.payload?.errors) {
        const fe: Record<string, string> = {}
        for (const [k, v] of Object.entries(err.payload.errors)) fe[k] = (v as string[])[0]
        setErrors(fe)
      } else {
        setServerError(err?.payload?.message ?? String(err))
      }
    },
  })

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

  const save = () => {
    setErrors({})
    setServerError(null)
    if (!form.name.trim()) {
      setErrors({ name: 'Name is required' })
      return
    }
    mutation.mutate({
      name: form.name.trim(),
      color: form.color,
      sort_order: parseInt(form.sort_order || '0', 10),
      active: form.active,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'add' ? 'Add Tag' : 'Edit Tag'}
      size="md"
    >
      <Modal.Body className="space-y-4">
        {serverError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
            {serverError}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
            maxLength={80}
            autoFocus
            disabled={mutation.isPending}
          />
          {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm({ ...form, color: opt.value })}
                title={opt.label}
                className={[
                  'w-9 h-9 rounded-full border-2 transition',
                  form.color === opt.value
                    ? 'border-amber-500 ring-2 ring-amber-200'
                    : 'border-slate-200 hover:border-slate-400',
                ].join(' ')}
                style={{ background: opt.hex }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Sort order</label>
          <input
            type="number"
            min={0}
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            className={inputCls + ' max-w-[120px]'}
            disabled={mutation.isPending}
          />
          <p className="text-[11px] text-slate-500 mt-1">Lower numbers appear first.</p>
        </div>

        <div>
          <div className="text-xs font-medium text-slate-700 mb-2">Preview</div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-white text-[11px] font-bold"
            style={{ background: hexFor(form.color) }}
          >
            {form.name || 'Tag name'}
          </span>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={mutation.isPending}
          className="px-4 py-2 text-sm rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : mode === 'add' ? 'Add' : 'Save'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
