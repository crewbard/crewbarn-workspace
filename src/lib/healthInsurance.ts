export type HealthInsurance = {
  enabled: boolean
  monthly_premium_cents: number | null
  employer_contribution_type: 'percent' | 'fixed'
  employer_percent: number | null
  employer_fixed_cents: number | null
  cost_handling: 'review_required' | 'already_in_costs' | 'add_to_cost_model'
}
export type HealthInsuranceForm = {
  enabled: boolean
  monthlyPremium: string
  contributionType: 'percent' | 'fixed'
  employerPercent: string
  employerFixed: string
  costHandling: HealthInsurance['cost_handling']
  changed: boolean
}
export function insuranceForm(value?: HealthInsurance | null): HealthInsuranceForm {
  return {
    enabled: value?.enabled ?? false,
    monthlyPremium: value?.monthly_premium_cents == null ? '' : String(value.monthly_premium_cents / 100),
    contributionType: value?.employer_contribution_type ?? 'percent',
    employerPercent: value?.employer_percent == null ? '' : String(value.employer_percent),
    employerFixed: value?.employer_fixed_cents == null ? '' : String(value.employer_fixed_cents / 100),
    costHandling: value?.cost_handling ?? 'review_required',
    changed: false,
  }
}
function amount(value: string): number | null {
  if (value.trim() === '' || !/^\d+(\.\d{1,2})?$/.test(value.trim())) return null
  const cents = Math.round(Number(value) * 100)
  return Number.isSafeInteger(cents) && cents <= 999999999 ? cents : null
}
export function insurancePreview(form: HealthInsuranceForm) {
  if (!form.enabled) return { error: null, employer: 0, employee: 0 }
  const premium = amount(form.monthlyPremium)
  if (premium == null || premium <= 0) return { error: 'Enter this employee’s total monthly premium, greater than zero.', employer: null, employee: null }
  let employer: number
  if (form.contributionType === 'percent') {
    const percent = form.employerPercent.trim() === '' ? NaN : Number(form.employerPercent)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { error: 'Enter an employer percentage from 0 to 100.', employer: null, employee: null }
    employer = Math.round(premium * percent / 100)
  } else {
    const fixed = amount(form.employerFixed)
    if (fixed == null || fixed > premium) return { error: 'Enter an employer monthly amount from zero up to the total premium.', employer: null, employee: null }
    employer = fixed
  }
  return { error: null, employer, employee: premium - employer }
}
/** Omit untouched insurance from PATCH so unrelated payroll edits preserve it. */
export function insurancePatch(form?: HealthInsuranceForm): { health_insurance?: HealthInsurance } {
  if (!form?.changed) return {}
  const preview = insurancePreview(form)
  if (preview.error) throw new Error(preview.error)
  return { health_insurance: {
    enabled: form.enabled,
    monthly_premium_cents: form.enabled ? amount(form.monthlyPremium) : null,
    employer_contribution_type: form.contributionType,
    employer_percent: form.enabled && form.contributionType === 'percent' && form.employerPercent.trim() !== '' ? Number(form.employerPercent) : null,
    employer_fixed_cents: form.enabled && form.contributionType === 'fixed' ? amount(form.employerFixed) : null,
    cost_handling: form.costHandling,
  } }
}
