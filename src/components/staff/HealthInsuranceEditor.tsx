import { insuranceForm, insurancePreview, type HealthInsuranceForm } from '@/lib/healthInsurance'
const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export function HealthInsuranceEditor({ value, onChange }: { value?: HealthInsuranceForm; onChange: (value: HealthInsuranceForm) => void }) {
  const form = value ?? insuranceForm()
  const set = (patch: Partial<HealthInsuranceForm>) => onChange({ ...form, ...patch, changed: true })
  const preview = insurancePreview(form)
  const input = 'rounded-md border border-slate-300 bg-white px-3 py-2'
  return <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
    <h3 className="text-sm font-bold text-navy-900">Health insurance for this employee</h3>
    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.enabled} onChange={e => set({ enabled: e.target.checked })} />Enrolled in health insurance</label>
    {form.enabled && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Total monthly premium ($)<input className={input} inputMode="decimal" value={form.monthlyPremium} onChange={e => set({ monthlyPremium: e.target.value })} /><span className="text-xs font-normal text-slate-500">The full premium for this employee before splitting it.</span></label>
        <label className="grid gap-1 text-sm font-semibold">Company pays<select className={input} value={form.contributionType} onChange={e => set({ contributionType: e.target.value as HealthInsuranceForm['contributionType'] })}><option value="percent">Percentage of premium</option><option value="fixed">Fixed monthly amount</option></select></label>
        {form.contributionType === 'percent' ? <label className="grid gap-1 text-sm font-semibold">Company share (%)<input className={input} inputMode="decimal" value={form.employerPercent} onChange={e => set({ employerPercent: e.target.value })} /></label> : <label className="grid gap-1 text-sm font-semibold">Company monthly amount ($)<input className={input} inputMode="decimal" value={form.employerFixed} onChange={e => set({ employerFixed: e.target.value })} /></label>}
      </div>
      {preview.error ? <p role="alert" className="text-sm text-red-700">{preview.error}</p> : <p aria-live="polite" className="text-sm font-semibold">Company: {money(preview.employer!)} / month · Employee: {money(preview.employee!)} / month</p>}
      <label className="grid gap-1 text-sm font-semibold">How is the company share counted?<select className={input} value={form.costHandling} onChange={e => set({ costHandling: e.target.value as HealthInsuranceForm['costHandling'] })}><option value="review_required">Confirm how cost is counted</option><option value="already_in_costs">Already included in payroll/overhead</option><option value="add_to_cost_model">Add employer share to cost model</option></select></label>
      {form.costHandling === 'review_required' && <p className="text-xs text-amber-800">Confirm whether this cost is already included before adding it to pricing, to avoid counting it twice.</p>}
      <p className="text-xs leading-5 text-slate-600">Only the company share affects pricing. The employee contribution is not an extra employer expense. Saving this split does not automatically deduct money from a paycheck.</p>
    </>}
  </section>
}
