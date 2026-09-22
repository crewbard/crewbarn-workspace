import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  createDiscount,
  deleteDiscount,
  formatDiscount,
  listDiscounts,
  updateDiscount,
  type Discount,
  type DiscountInput,
  type DiscountKind,
} from '@/lib/discounts'

const inputCls =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'

export function SettingsPricingPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Discount | null | 'new'>(null)

  const q = useQuery({ queryKey: ['discounts'], queryFn: listDiscounts })
  const refresh = () => qc.invalidateQueries({ queryKey: ['discounts'] })
  const discounts = q.data ?? []

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-navy-900">Pricing &amp; Discounts</h1>
          <p className="text-sm text-slate-600 mt-1">
            Define reusable discounts — a percentage off or a fixed dollar amount — that you can
            apply to estimates and invoices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="shrink-0 px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold"
        >
          + Add discount
        </button>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : discounts.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
          No discounts yet. Add one to start.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
          {discounts.map((d) => (
            <DiscountRow key={d.id} discount={d} onEdit={() => setEditing(d)} onChanged={refresh} />
          ))}
        </div>
      )}

      {editing && (
        <DiscountEditor
          discount={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function DiscountRow({
  discount,
  onEdit,
  onChanged,
}: {
  discount: Discount
  onEdit: () => void
  onChanged: () => void
}) {
  const del = useMutation({ mutationFn: () => deleteDiscount(discount.id), onSuccess: onChanged })

  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-navy-900">{discount.name}</span>
          <span className="text-xs font-semibold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
            {formatDiscount(discount)}
          </span>
          {!discount.active && (
            <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              Inactive
            </span>
          )}
        </div>
        {(discount.code || discount.description) && (
          <div className="text-xs text-slate-500 mt-0.5">
            {discount.code && <span className="font-mono">{discount.code}</span>}
            {discount.code && discount.description && ' · '}
            {discount.description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete discount "${discount.name}"?`)) del.mutate()
          }}
          disabled={del.isPending}
          className="text-xs px-2.5 py-1.5 rounded text-rose-700 hover:bg-rose-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function DiscountEditor({
  discount,
  onClose,
  onSaved,
}: {
  discount: Discount | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = discount !== null
  const [name, setName] = useState(discount?.name ?? '')
  const [kind, setKind] = useState<DiscountKind>(discount?.kind ?? 'percent')
  const [value, setValue] = useState(String(discount?.value ?? ''))
  const [code, setCode] = useState(discount?.code ?? '')
  const [description, setDescription] = useState(discount?.description ?? '')
  const [active, setActive] = useState(discount?.active ?? true)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => {
      const input: DiscountInput = {
        name: name.trim(),
        kind,
        value: Number(value) || 0,
        code: code.trim() || null,
        description: description.trim() || null,
        active,
      }
      return isEdit ? updateDiscount(discount!.id, input) : createDiscount(input)
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Save failed'),
  })

  const canSave = name.trim() !== '' && value !== '' && !save.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-navy-900 mb-4">
          {isEdit ? 'Edit discount' : 'New discount'}
        </h2>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputCls} placeholder="e.g. Senior / Veteran 10%" />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as DiscountKind)} className={inputCls}>
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed amount ($)</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {kind === 'percent' ? 'Percent off' : 'Amount off ($)'}
            </span>
            <input
              type="number"
              min={0}
              max={kind === 'percent' ? 100 : undefined}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Code (optional)</span>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} className={inputCls} placeholder="SPRING25" />
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</span>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className={inputCls} />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700 mb-4">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
          />
          Active
        </label>

        {error && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-3">{error}</div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!canSave}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPricingPage
