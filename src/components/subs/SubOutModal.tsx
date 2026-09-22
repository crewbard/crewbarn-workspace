import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { SubcontractorPicker } from '@/components/subs/SubcontractorPicker'
import {
  getSubcontractor,
  subOutWorkOrder,
  updateSubOutWorkOrder,
} from '@/lib/subcontractors'
import type { Subcontractor } from '@/types/subcontractor'

/**
 * SubOutModal — sub-out an EXISTING WO directly from the detail page,
 * or edit an existing sub assignment. Mode is inferred from props:
 *
 *   no `initial*` props  → create mode → POST /sub-out
 *   `initial*` provided  → edit   mode → PATCH /sub-out
 *
 * Fields are intentionally narrower than the create form — the WO
 * already exists, so customer/location/scope are baked in; we only
 * collect the sub + NTE + special instructions.
 */
export function SubOutModal({
  isOpen,
  onClose,
  workOrderId,
  onSubbed,
  initialSubcontractorId,
  initialNteCents,
  initialSpecialInstructions,
}: {
  isOpen: boolean
  onClose: () => void
  workOrderId: string
  onSubbed?: () => void
  /** Provide all three to open in edit mode (prefills the form). */
  initialSubcontractorId?: string | null
  initialNteCents?: number | null
  initialSpecialInstructions?: string | null
}) {
  const isEdit = !!initialSubcontractorId
  const [sub, setSub] = useState<Subcontractor | null>(null)
  const [nteDollars, setNteDollars] = useState('')
  const [instructions, setInstructions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverErr, setServerErr] = useState<string | null>(null)

  // On open: hydrate from initial values when editing. The picker
  // needs the full Subcontractor object so we fetch by id; cheap call
  // (a single show route).
  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setServerErr(null)
    if (isEdit) {
      setNteDollars(
        initialNteCents != null ? (initialNteCents / 100).toFixed(2) : '',
      )
      setInstructions(initialSpecialInstructions ?? '')
      // Fetch sub for the picker. Failure isn't fatal — we just leave
      // it empty and the user can re-select.
      void getSubcontractor(initialSubcontractorId!)
        .then((s) => setSub(s))
        .catch(() => setSub(null))
    } else {
      setSub(null)
      setNteDollars('')
      setInstructions('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    initialSubcontractorId,
    initialNteCents,
    initialSpecialInstructions,
  ])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerErr(null)
    const e2: Record<string, string> = {}
    if (!sub) e2.subcontractor_id = 'Pick the sub doing the work.'
    const nte = parseFloat(nteDollars)
    if (isNaN(nte) || nte < 0) e2.sub_nte_cents = 'NTE must be a non-negative number.'
    if (Object.keys(e2).length > 0) { setErrors(e2); return }

    setSubmitting(true)
    try {
      const payload = {
        subcontractor_id: sub!.id,
        sub_nte_cents: Math.round(nte * 100),
        sub_special_instructions: instructions.trim() || null,
      }
      if (isEdit) {
        await updateSubOutWorkOrder(workOrderId, payload)
      } else {
        await subOutWorkOrder(workOrderId, payload)
      }
      onSubbed?.()
      onClose()
    } catch (err) {
      const e = err as { payload?: { message?: string; errors?: Record<string, string[]> } }
      if (e?.payload?.errors) {
        const flat: Record<string, string> = {}
        for (const [k, v] of Object.entries(e.payload.errors)) flat[k] = v[0]
        setErrors(flat)
      } else {
        setServerErr(e?.payload?.message ?? String(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit sub assignment' : 'Sub this job out'}
      size="md"
    >
      <Modal.Body>
        <form id="sub-out-form" onSubmit={handleSubmit} className="space-y-4">
          {serverErr && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2">
              {serverErr}
            </div>
          )}

          <Field label="Subcontractor *" error={errors.subcontractor_id}>
            <SubcontractorPicker value={sub} onChange={setSub} error={errors.subcontractor_id} />
          </Field>

          <Field label="Not-To-Exceed (NTE) — USD *" error={errors.sub_nte_cents}>
            <div className="flex items-center gap-1">
              <span className="text-slate-500">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={nteDollars}
                onChange={(e) => setNteDollars(e.target.value)}
                placeholder="350.00"
                className={`${inputCls} max-w-[180px]`}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Max payout authorized to the sub. They'll get this on the customer doc and can request
              an increase from the portal if they need to exceed.
            </p>
          </Field>

          <Field label="Special instructions for the sub" error={errors.sub_special_instructions}>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Site access, on-site contact, what to do if no one's there, etc."
              className={inputCls}
            />
          </Field>

          <p className="text-[11px] text-slate-500">
            The sub will be emailed their assignment + see the WO in their portal under <strong>Subbed jobs</strong>.
          </p>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="sub-out-form"
          disabled={submitting}
          className="px-4 py-2 text-sm rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
        >
          {submitting
            ? isEdit
              ? 'Saving…'
              : 'Subbing out…'
            : isEdit
              ? 'Save changes'
              : 'Sub this out'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">{label}</span>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </label>
  )
}
