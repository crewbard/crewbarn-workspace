export type CompanyCostEntryType =
  | 'facility'
  | 'debt'
  | 'payroll'
  | 'fuel'
  | 'inventory'
  | 'insurance'
  | 'software'
  | 'vehicle'
  | 'operating'
  | 'other'

export const COMPANY_COST_ENTRY_TYPES: readonly CompanyCostEntryType[] = [
  'facility',
  'debt',
  'payroll',
  'fuel',
  'inventory',
  'insurance',
  'software',
  'vehicle',
  'operating',
  'other',
]

export const COMPANY_COST_ENTRY_TYPE_LABELS: Record<CompanyCostEntryType, string> = {
  facility: 'Facility',
  debt: 'Debt',
  payroll: 'Payroll',
  fuel: 'Fuel',
  inventory: 'Inventory',
  insurance: 'Insurance',
  software: 'Software',
  vehicle: 'Vehicle',
  operating: 'Operating',
  other: 'Other',
}

export interface TenantCostModelSettings {
  tenant_id: string
  target_gross_margin_percent: number | null
  target_net_margin_percent: number | null
  minimum_job_profit: number | null
  minimum_service_call: number | null
  after_hours_multiplier: number | null
  default_material_markup_percent: number | null
  default_labor_markup_percent: number | null
  expected_monthly_billable_hours: number | null
  trade_margin_targets: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
}

export interface CompanyCostModelTotals {
  monthly_cost_entries: number
  monthly_company_assets: number
  fixed_monthly_cost: number
  expected_monthly_billable_hours: number
  break_even_hourly_rate: number | null
  target_gross_margin_percent: number | null
  target_net_margin_percent: number | null
  minimum_job_profit: number | null
  minimum_service_call: number | null
}

export interface CompanyCostBreakdownBucket {
  count: number
  monthly_total: number
}

export interface CompanyCostModelSummary {
  settings: TenantCostModelSettings
  totals: CompanyCostModelTotals
  breakdown: {
    by_type: Record<string, CompanyCostBreakdownBucket>
    by_category: Record<string, CompanyCostBreakdownBucket>
    assets: {
      count: number
      monthly_total: number
      by_category: Record<string, CompanyCostBreakdownBucket>
    }
  }
}

export interface CompanyCostEntry {
  id: string
  type: CompanyCostEntryType
  category: string | null
  name: string
  monthly_amount: number | null
  annual_amount: number | null
  computed_monthly_amount: number
  current_balance: number | null
  minimum_payment: number | null
  interest_rate_percent: number | null
  linked_company_asset_id: string | null
  trade: string | null
  fixed: boolean
  active: boolean
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CompanyCostModelResponse {
  summary: CompanyCostModelSummary
  entries: CompanyCostEntry[]
}

export type TenantCostModelSettingsInput = Partial<{
  target_gross_margin_percent: number | null
  target_net_margin_percent: number | null
  minimum_job_profit: number | null
  minimum_service_call: number | null
  after_hours_multiplier: number | null
  default_material_markup_percent: number | null
  default_labor_markup_percent: number | null
  expected_monthly_billable_hours: number | null
  trade_margin_targets: Record<string, unknown> | null
}>

export interface CompanyCostEntryInput {
  type: CompanyCostEntryType
  category?: string | null
  name: string
  monthly_amount?: number | null
  annual_amount?: number | null
  current_balance?: number | null
  minimum_payment?: number | null
  interest_rate_percent?: number | null
  linked_company_asset_id?: string | null
  trade?: string | null
  fixed?: boolean
  active?: boolean
  notes?: string | null
}
