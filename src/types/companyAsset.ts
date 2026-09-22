import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

export type CompanyAssetCategory =
  | 'tool'
  | 'equipment'
  | 'software'
  | 'vehicle'
  | 'device'
  | 'safety'
  | 'other'

export type CompanyAssetStatus =
  | 'needs_confirmation'
  | 'active'
  | 'maintenance'
  | 'retired'
  | 'lost'

export type CompanyAssetAssignmentType = 'unassigned' | 'account' | 'inventory_location'
export type CompanyAssetSource = 'manual' | 'seed' | 'ai_onboarding' | 'import'

export const COMPANY_ASSET_CATEGORIES: readonly CompanyAssetCategory[] = [
  'tool',
  'equipment',
  'software',
  'vehicle',
  'device',
  'safety',
  'other',
]

export const COMPANY_ASSET_CATEGORY_LABELS: Record<CompanyAssetCategory, string> = {
  tool: 'Tool',
  equipment: 'Equipment',
  software: 'Software',
  vehicle: 'Vehicle',
  device: 'Device',
  safety: 'Safety',
  other: 'Other',
}

export const COMPANY_ASSET_STATUSES: readonly CompanyAssetStatus[] = [
  'needs_confirmation',
  'active',
  'maintenance',
  'retired',
  'lost',
]

export const COMPANY_ASSET_STATUS_LABELS: Record<CompanyAssetStatus, string> = {
  needs_confirmation: 'Needs confirmation',
  active: 'Active',
  maintenance: 'Maintenance',
  retired: 'Retired',
  lost: 'Lost',
}

export interface CompanyAssetAssignee {
  id: string
  display_name: string
  email: string | null
}

export interface CompanyAssetLocation {
  id: string
  name: string
  type: string
  display_label: string
}

export interface CompanyAsset {
  id: string
  name: string
  category: CompanyAssetCategory
  status: CompanyAssetStatus
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  asset_tag: string | null
  assignment_type: CompanyAssetAssignmentType
  assigned_account_id: string | null
  assigned_account: CompanyAssetAssignee | null
  inventory_location_id: string | null
  inventory_location: CompanyAssetLocation | null
  capabilities: string[]
  capability_notes: string | null
  notes: string | null
  purchased_at: string | null
  purchase_price: number | null
  current_value: number | null
  monthly_depreciation: number | null
  loan_balance: number | null
  monthly_payment: number | null
  interest_rate_percent: number | null
  payoff_date: string | null
  monthly_insurance_cost: number | null
  monthly_maintenance_cost: number | null
  fuel_type: string | null
  average_mpg: number | null
  average_fuel_price: number | null
  monthly_miles: number | null
  monthly_fuel_cost: number | null
  vehicle_wear_cost_per_mile: number | null
  service_radius_miles: number | null
  subscription_expires_at: string | null
  source: CompanyAssetSource
  source_seed_key: string | null
  active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface CompanyAssetInput {
  name: string
  category?: CompanyAssetCategory
  status?: CompanyAssetStatus
  manufacturer?: string | null
  model?: string | null
  serial_number?: string | null
  asset_tag?: string | null
  assignment_type?: CompanyAssetAssignmentType
  assigned_account_id?: string | null
  inventory_location_id?: string | null
  capabilities?: string[]
  capability_notes?: string | null
  notes?: string | null
  purchased_at?: string | null
  purchase_price?: number | null
  current_value?: number | null
  monthly_depreciation?: number | null
  loan_balance?: number | null
  monthly_payment?: number | null
  interest_rate_percent?: number | null
  payoff_date?: string | null
  monthly_insurance_cost?: number | null
  monthly_maintenance_cost?: number | null
  fuel_type?: string | null
  average_mpg?: number | null
  average_fuel_price?: number | null
  monthly_miles?: number | null
  monthly_fuel_cost?: number | null
  vehicle_wear_cost_per_mile?: number | null
  service_radius_miles?: number | null
  subscription_expires_at?: string | null
  source?: CompanyAssetSource
  source_seed_key?: string | null
  active?: boolean
}

export type CompanyAssetUpdateInput = Partial<CompanyAssetInput>

export interface CompanyAssetListParams {
  category?: CompanyAssetCategory | ''
  status?: CompanyAssetStatus | ''
  active?: boolean
  assigned_account_id?: string
  inventory_location_id?: string
  q?: string
  per_page?: number
  page?: number
}
