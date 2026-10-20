import { annualSalary, defaultPaySchedule, salaryAmount, salaryPeriods, type PaySchedule, type SalaryPeriod } from '@/lib/paySchedule'

export type SalaryFieldsValue = { annual_salary: string; salary_period?: SalaryPeriod; salary_amount?: string }
const labels: Record<SalaryPeriod, string> = { annual: 'Per year', monthly: 'Per month', semimonthly: 'Twice a month (24 a year)', biweekly: 'Every 2 weeks (26 a year)', weekly: 'Per week (52 a year)' }
const inputClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
export function SalaryAmountFields({ value, onChange }: { value: SalaryFieldsValue; onChange: (patch: Partial<SalaryFieldsValue>) => void }) {
  const period = value.salary_period ?? 'annual'
  return <div className="space-y-2">
    <label className="block text-sm font-semibold">Salary amount before tax ($)
      <input type="number" min="0" step="0.01" className={inputClass} value={value.salary_amount ?? salaryAmount(value.annual_salary, period)} onChange={e => onChange({ salary_amount: e.target.value, annual_salary: annualSalary(e.target.value, period) })} />
    </label>
    <label className="block text-sm font-semibold">This salary amount is
      <select className={inputClass} value={period} onChange={e => { const next = e.target.value as SalaryPeriod; onChange({ salary_period: next, salary_amount: salaryAmount(value.annual_salary, next) }) }}>
        {Object.keys(salaryPeriods).map(key => <option key={key} value={key}>{labels[key as SalaryPeriod]}</option>)}
      </select>
    </label>
    <p className="text-xs text-slate-600">{Number(value.annual_salary || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per year before tax. Changing the amount period keeps the yearly salary the same; enter a new amount to change their pay.</p>
  </div>
}
export function PayScheduleFields({ value = { frequency: 'unspecified' }, onChange }: { value?: PaySchedule; onChange: (schedule: PaySchedule) => void }) {
  const monthDays = ['semimonthly', 'monthly', 'quarterly', 'annually'].includes(value.frequency)
  const anchor = ['biweekly', 'quarterly', 'annually'].includes(value.frequency)
  return <section className="space-y-3">
    <label className="block text-sm font-semibold">When they are paid
      <select className={inputClass} value={value.frequency} onChange={e => onChange(defaultPaySchedule(e.target.value as PaySchedule['frequency']))}>
        <option value="unspecified">Not set yet</option><option value="weekly">Every week</option><option value="biweekly">Every 2 weeks</option><option value="semimonthly">Twice a month</option><option value="monthly">Every month</option><option value="quarterly">Every 3 months</option><option value="annually">Every year</option>
      </select>
    </label>
    {value.frequency === 'weekly' && <label className="block text-sm font-semibold">Pay day<select className={inputClass} value={value.weekday ?? 5} onChange={e => onChange({ ...value, weekday: Number(e.target.value) })}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}
    {monthDays && <div className="flex flex-wrap gap-3">{Array.from({ length: value.frequency === 'semimonthly' ? 2 : 1 }, (_, index) => <label key={index} className="text-sm font-semibold">{value.frequency === 'semimonthly' ? `${index === 0 ? 'First' : 'Second'} pay day` : 'Day of the month'}<select className={inputClass} value={value.days_of_month?.[index] ?? (index === 0 ? 1 : 16)} onChange={e => { const days = [...(value.days_of_month ?? [1, 16])]; days[index] = Number(e.target.value); onChange({ ...value, days_of_month: days }) }}>{Array.from({ length: 31 }, (_, day) => <option key={day + 1} value={day + 1}>{day + 1}</option>)}</select></label>)}</div>}
    {anchor && <label className="block text-sm font-semibold">{value.frequency === 'biweekly' ? 'A known pay date' : 'A date in the first pay month'}<input type="date" required className={inputClass} value={value.anchor_date ?? ''} onChange={e => onChange({ ...value, anchor_date: e.target.value })} /></label>}
    <p className="text-xs text-slate-600">This sets their payment schedule. Hourly rates, salary and commissions are set separately.{monthDays ? ' If a month is too short for a chosen day, use its last day.' : ''}{value.frequency === 'biweekly' ? ' Pay dates repeat every 14 days from the date above.' : ''}</p>
  </section>
}
