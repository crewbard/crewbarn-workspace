import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ApiError } from '@/lib/api'
import { SubcontractorPicker } from '@/components/subs/SubcontractorPicker'
import { SubInviteModal, type InviteResult, type NotInvitedSub } from '@/components/staff/SubCompanies'
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
 *
 * A sub company whose documents aren't all in is refused once, saying what's
 * missing (documents_missing); "Send anyway" sends it, because most of this
 * work is urgent, and the job notes what was missing.
 *
 * With the sub network on, every sub accepts an invite before it gets work:
 * a sub not on CrewBarn (sub_not_on_crewbarn) can be invited from here, and
 * one already on CrewBarn takes the job right after.
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
  // The sub's documents aren't all in: what the server said, until sent anyway.
  const [missingDocs, setMissingDocs] = useState<string | null>(null)
  // The sub isn't on CrewBarn yet (or is still setting up): invite it here.
  const [notReady, setNotReady] = useState<{ code: string; message: string; sub: NotInvitedSub } | null>(null)
  const [inviting, setInviting] = useState(false)
  const [invited, setInvited] = useState<InviteResult | null>(null)
  // Editing, and the current sub's details didn't load. The job still has
  // that sub, so saving keeps it unless another is picked. message is null
  // for a 403: the details aren't this person's to see, which isn't an error.
  const [subLoadFailure, setSubLoadFailure] = useState<{ message: string | null } | null>(null)

  const loadCurrentSub = (id: string) => {
    setSubLoadFailure(null)
    void getSubcontractor(id)
      .then((s) => setSub(s))
      .catch((e: unknown) => {
        setSub(null)
        setSubLoadFailure({
          message: e instanceof ApiError && e.status === 403
            ? null
            : e instanceof Error && e.message ? e.message : 'Something went wrong.',
        })
      })
  }

  // On open: hydrate from initial values when editing. The picker
  // needs the full Subcontractor object so we fetch by id; cheap call
  // (a single show route).
  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setServerErr(null)
    setMissingDocs(null)
    setNotReady(null)
    setInvited(null)
    if (isEdit) {
      setNteDollars(
        initialNteCents != null ? (initialNteCents / 100).toFixed(2) : '',
      )
      setInstructions(initialSpecialInstructions ?? '')
      // Fetch sub for the picker. Failure isn't fatal, but it is said:
      // an empty picker alone reads as "no sub on this job".
      loadCurrentSub(initialSubcontractorId!)
    } else {
      setSubLoadFailure(null)
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

  async function handleSubmit(e: React.FormEvent | null, sendAnyway = false) {
    e?.preventDefault()
    setErrors({})
    setServerErr(null)
    setMissingDocs(null)
    setNotReady(null)
    const e2: Record<string, string> = {}
    // The sub already on the job counts as picked when its details didn't load.
    const subId = sub?.id ?? (isEdit && subLoadFailure ? initialSubcontractorId! : null)
    if (!subId) e2.subcontractor_id = 'Pick the sub doing the work.'
    const nte = parseFloat(nteDollars)
    if (isNaN(nte) || nte < 0) e2.sub_nte_cents = 'NTE must be a non-negative number.'
    if (Object.keys(e2).length > 0) { setErrors(e2); return }

    setSubmitting(true)
    try {
      const payload = {
        subcontractor_id: subId!,
        sub_nte_cents: Math.round(nte * 100),
        sub_special_instructions: instructions.trim() || null,
        ...(sendAnyway ? { send_anyway: true } : {}),
      }
      if (isEdit) {
        await updateSubOutWorkOrder(workOrderId, payload)
      } else {
        await subOutWorkOrder(workOrderId, payload)
      }
      onSubbed?.()
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'documents_missing') {
        setMissingDocs(err.message)
      } else if (err instanceof ApiError && (err.code === 'sub_not_on_crewbarn' || err.code === 'sub_setting_up')) {
        const s = (err.details as { subcontractor?: { id: string; business_name: string; contact_name: string | null; email: string | null; phone: string | null } } | undefined)?.subcontractor
        setNotReady({
          code: err.code,
          message: err.message,
          sub: {
            subcontractor_id: s?.id ?? subId!,
            business_name: s?.business_name ?? sub?.business_name ?? 'this sub',
            contact_name: s?.contact_name ?? null,
            email: s?.email ?? null,
            phone: s?.phone ?? null,
          },
        })
      } else if (err instanceof ApiError && err.status === 422 && err.details && typeof err.details === 'object') {
        const flat: Record<string, string> = {}
        for (const [k, v] of Object.entries(err.details as Record<string, unknown>)) flat[k] = Array.isArray(v) ? String(v[0]) : String(v)
        setErrors(flat)
      } else {
        setServerErr(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit sub assignment' : 'Sub this job out'}
      size="md"
      disableEscapeClose={inviting}
    >
      <Modal.Body>
        <form id="sub-out-form" onSubmit={handleSubmit} className="space-y-4">
          {serverErr && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2">
              {serverErr}
            </div>
          )}

          {missingDocs && (
            <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p>{missingDocs}</p>
              <p className="mt-1 text-xs text-amber-800">Sending anyway notes on this job what was missing.</p>
              <button
                type="button"
                onClick={() => void handleSubmit(null, true)}
                disabled={submitting}
                className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send anyway (urgent)'}
              </button>
            </div>
          )}

          {notReady && (
            <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p>{notReady.message}</p>
              {invited?.on_crewbarn ? (
                <>
                  <p className="mt-1 text-xs text-amber-800">{invited.company_name} is on CrewBarn, so the job can go now.</p>
                  <button
                    type="button"
                    onClick={() => void handleSubmit(null)}
                    disabled={submitting}
                    className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Send the job now'}
                  </button>
                </>
              ) : invited ? (
                <p className="mt-1 text-xs text-amber-800">We emailed {invited.email} an invite code. Once they've set up, send the job again.</p>
              ) : notReady.code === 'sub_not_on_crewbarn' ? (
                <button
                  type="button"
                  onClick={() => setInviting(true)}
                  className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Invite {notReady.sub.business_name}
                </button>
              ) : null}
            </div>
          )}

          {isEdit && subLoadFailure?.message && !sub && (
            <div role="alert" className="text-xs bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2">
              Couldn't load the sub on this job ({subLoadFailure.message}). It's still assigned — saving keeps it
              unless you pick another.
              <button
                type="button"
                onClick={() => loadCurrentSub(initialSubcontractorId!)}
                className="ml-2 font-semibold underline"
              >
                Try again
              </button>
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
              Max payout authorized to the sub, including labor, materials and tax. If they need to go
              over it, they request an increase from their portal for you to approve.
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
            The job goes to the sub's own CrewBarn, under <strong>Inbound sub jobs</strong>, and they're emailed that it's there.
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
    {inviting && notReady && (
      <SubInviteModal
        initial={notReady.sub}
        onInvited={setInvited}
        onClose={() => setInviting(false)}
      />
    )}
    </>
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
