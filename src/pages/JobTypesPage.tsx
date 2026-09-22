import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { StatusIcon, TRADE_ICON_NAMES } from '@/lib/statusIcons'
import { JobTypeChip, JOB_TYPE_COLOR_OPTIONS } from '@/components/JobTypeChip'

/**
 * Tool Shed → Lists → Job Types.
 *
 * CRUD list page over /v1/job-types. Job types categorise work orders
 * (e.g. "Rekey", "Lockout", "Master Key System") and seed downstream
 * defaults — default status, default duration, default checklist.
 *
 * Mirrors the visual language of Job Statuses but stays lean: one list,
 * one add/edit modal, no drag reorder yet (sort_order is editable as a
 * plain number field — drag UI is a follow-up if it becomes painful).
 */

interface JobType {
  id: string
  name: string
  slug: string
  color: string
  icon: string | null
  category: 'service' | 'inspection' | 'install' | 'repair' | 'estimate' | 'project'
  default_status_id: string | null
  default_status: { id: string; name: string; color: string } | null
  default_duration_minutes: number | null
  default_checklist_id: string | null
  sort_order: number
  active: boolean
  most_used: boolean
}

interface JobStatusLite {
  id: string
  name: string
  color: string | null
  category: string
}

const CATEGORIES = ['service', 'inspection', 'install', 'repair', 'estimate', 'project'] as const

const COLOR_OPTIONS = JOB_TYPE_COLOR_OPTIONS

interface Form {
  name: string
  color: string
  icon: string
  category: JobType['category']
  default_status_id: string
  default_duration_minutes: string
  sort_order: string
  active: boolean
}

const EMPTY_FORM: Form = {
  name: '',
  color: 'navy',
  icon: '',
  category: 'service',
  default_status_id: '',
  default_duration_minutes: '',
  sort_order: '0',
  active: true,
}

export function JobTypesPage() {
  const qc = useQueryClient()

  const typesQuery = useQuery({
    queryKey: ['job-types'],
    queryFn: () => apiRequest<{ data: JobType[] }>('/v1/job-types?per_page=200'),
  })
  const statusesQuery = useQuery({
    queryKey: ['job-statuses'],
    queryFn: () => apiRequest<{ data: JobStatusLite[] }>('/v1/job-statuses'),
  })

  const types = typesQuery.data?.data ?? []
  const statuses = statusesQuery.data?.data ?? []

  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const editType = useMemo(() => types.find((t) => t.id === editId) ?? null, [types, editId])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/job-types/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-types'] }),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest(`/v1/job-types/${id}`, { method: 'PATCH', body: { active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-types'] }),
  })

  const handleDelete = (t: JobType) => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate(t.id)
  }

  const busy = deleteMutation.isPending || toggleActive.isPending

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Job Types</h1>
        <p className="text-sm text-slate-500 mt-1">
          Categorise work orders. Each type can carry a default status, duration, and
          checklist that pre-fill when a new job of that type is created.
        </p>
      </div>

      {typesQuery.isLoading && <p className="text-sm text-slate-400 italic">Loading…</p>}

      {!typesQuery.isLoading && types.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-6 py-12 text-center">
          <p className="text-sm text-slate-600 mb-4">No job types yet.</p>
          <button
            onClick={() => setAddOpen(true)}
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            Add your first job type →
          </button>
        </div>
      )}

      {types.length > 0 && (
        <>
          <div className="space-y-2">
            {types
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((t) => (
                <div
                  key={t.id}
                  className={[
                    'bg-white border rounded-lg px-4 py-3 flex items-center gap-3',
                    t.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/60 opacity-70',
                  ].join(' ')}
                >
                  <JobTypeChip color={t.color} icon={t.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {t.name}
                      {!t.active && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                          Inactive
                        </span>
                      )}
                      {t.most_used && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-600 font-semibold">
                          Most used
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 space-x-2">
                      <span>{t.category}</span>
                      {t.default_status && (
                        <>
                          <span>·</span>
                          <span>→ {t.default_status.name}</span>
                        </>
                      )}
                      {t.default_duration_minutes != null && (
                        <>
                          <span>·</span>
                          <span>{t.default_duration_minutes} min</span>
                        </>
                      )}
                    </div>
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
                      onClick={() => handleDelete(t)}
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
              + Add job type
            </button>
          </div>
        </>
      )}

      {(addOpen || editType) && (
        <JobTypeEditor
          isOpen
          jobType={editType}
          statuses={statuses}
          onClose={() => {
            setAddOpen(false)
            setEditId(null)
          }}
          onSaved={() => {
            setAddOpen(false)
            setEditId(null)
            qc.invalidateQueries({ queryKey: ['job-types'] })
          }}
        />
      )}
    </div>
  )
}

function JobTypeEditor({
  isOpen,
  jobType,
  statuses,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  jobType: JobType | null
  statuses: JobStatusLite[]
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const mode = jobType ? 'edit' : 'add'
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setServerError(null)
    if (jobType) {
      setForm({
        name: jobType.name,
        color: jobType.color,
        icon: jobType.icon ?? '',
        category: jobType.category,
        default_status_id: jobType.default_status_id ?? '',
        default_duration_minutes: jobType.default_duration_minutes?.toString() ?? '',
        sort_order: jobType.sort_order.toString(),
        active: jobType.active,
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [isOpen, jobType])

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      return mode === 'add'
        ? apiRequest<{ data: JobType }>('/v1/job-types', { method: 'POST', body: payload })
        : apiRequest<{ data: JobType }>(`/v1/job-types/${jobType!.id}`, {
            method: 'PATCH',
            body: payload,
          })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-types'] })
      onSaved()
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      if (err?.status === 422 && err?.payload?.errors) {
        const fe: Record<string, string> = {}
        for (const [k, v] of Object.entries(err.payload.errors)) {
          fe[k] = (v as string[])[0]
        }
        setErrors(fe)
      } else {
        setServerError(err?.payload?.message ?? String(err))
      }
    },
  })

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500'

  const handleSave = () => {
    setErrors({})
    setServerError(null)
    if (!form.name.trim()) {
      setErrors({ name: 'Name is required' })
      return
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      color: form.color,
      icon: form.icon || null,
      category: form.category,
      sort_order: parseInt(form.sort_order || '0', 10),
      active: form.active,
    }
    payload.default_status_id = form.default_status_id || null
    const dur = parseInt(form.default_duration_minutes, 10)
    payload.default_duration_minutes = isFinite(dur) ? dur : null
    mutation.mutate(payload)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'add' ? 'Add Job Type' : 'Edit Job Type'}
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
            maxLength={100}
            disabled={mutation.isPending}
            autoFocus
          />
          {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as JobType['category'] })
            }
            className={inputCls}
            disabled={mutation.isPending}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
                  'w-8 h-8 rounded-full border-2 transition',
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
          <label className="block text-xs font-medium text-slate-700 mb-1">Icon</label>
          <div className="flex items-center gap-3 mb-2">
            <JobTypeChip color={form.color} icon={form.icon || null} size={40} />
            <span className="text-[11px] text-slate-500">
              Sits on the color you picked. Shows on the schedule and dispatch cards.
            </span>
          </div>
          <div className="grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => setForm({ ...form, icon: '' })}
              title="No icon"
              className={[
                'h-9 rounded-md border flex items-center justify-center text-[10px]',
                form.icon === ''
                  ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold'
                  : 'border-slate-200 text-slate-400 hover:bg-slate-50',
              ].join(' ')}
            >
              None
            </button>
            {TRADE_ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm({ ...form, icon: n })}
                title={n}
                className={[
                  'h-9 rounded-md border flex items-center justify-center',
                  form.icon === n
                    ? 'border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-400'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                <StatusIcon name={n} size={18} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Default status (optional)
          </label>
          <select
            value={form.default_status_id}
            onChange={(e) => setForm({ ...form, default_status_id: e.target.value })}
            className={inputCls}
            disabled={mutation.isPending}
          >
            <option value="">— No default —</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 mt-1">
            New jobs of this type will start with this status.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Default duration (minutes)
            </label>
            <input
              type="number"
              min={0}
              value={form.default_duration_minutes}
              onChange={(e) =>
                setForm({ ...form, default_duration_minutes: e.target.value })
              }
              placeholder="—"
              className={inputCls}
              disabled={mutation.isPending}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Sort order
            </label>
            <input
              type="number"
              min={0}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className={inputCls}
              disabled={mutation.isPending}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-xs font-medium text-slate-700">Active</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Inactive types are hidden from new-job pickers.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.active}
            onClick={() => setForm({ ...form, active: !form.active })}
            disabled={mutation.isPending}
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
              form.active ? 'bg-emerald-500' : 'bg-slate-300',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                form.active ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={mutation.isPending}>
          {mode === 'add' ? 'Add' : 'Save'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
