export type PaySchedule = {
  frequency: 'unspecified' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'quarterly' | 'annually'
  days_of_month?: number[]
  weekday?: number
  anchor_date?: string
}
export const salaryPeriods = { annual: 1, monthly: 12, semimonthly: 24, biweekly: 26, weekly: 52 }
export type SalaryPeriod = keyof typeof salaryPeriods
export function annualSalary(amount: string, period: SalaryPeriod): string {
  return String(Math.round(Number(amount || 0) * 100) * salaryPeriods[period] / 100)
}
export function salaryAmount(annual: string, period: SalaryPeriod): string {
  return String(Math.round(Number(annual || 0) * 100 / salaryPeriods[period]) / 100)
}
export function defaultPaySchedule(frequency: PaySchedule['frequency']): PaySchedule {
  if (frequency === 'weekly') return { frequency, weekday: 5 }
  if (frequency === 'semimonthly') return { frequency, days_of_month: [1, 16] }
  if (frequency === 'monthly') return { frequency, days_of_month: [1] }
  if (frequency === 'quarterly' || frequency === 'annually') return { frequency, days_of_month: [1], anchor_date: '' }
  if (frequency === 'biweekly') return { frequency, anchor_date: '' }
  return { frequency }
}
