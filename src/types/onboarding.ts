export interface OnboardingStep {
  key: string
  title: string
  detail: string
  complete: boolean
  path: string
}

export interface OnboardingSeedPackSummary {
  key: string
  label: string
  description: string
  counts: Record<string, number>
}

/** A trade the owner can pick at signup, resolved to the pack that gets applied. */
export interface OnboardingTrade {
  slug: string
  name: string
  icon: string | null
  /** Seed pack key applied when this trade is chosen ('generic' if unlinked). */
  pack_key: string
  pack_label: string
  /** True when an admin explicitly linked this trade to a real pack. */
  linked: boolean
}

export interface OnboardingSeedPackPreview extends OnboardingSeedPackSummary {
  statuses: Array<Record<string, unknown>>
  job_types: Array<Record<string, unknown>>
  asset_types: Array<Record<string, unknown>>
  service_categories: Array<Record<string, unknown>>
  product_categories: Array<Record<string, unknown>>
  service_items: Array<Record<string, unknown>>
  product_items: Array<Record<string, unknown>>
  inventory_locations: Array<Record<string, unknown>>
  custom_fields: Array<Record<string, unknown>>
  resource_recommendations: string[]
  company_asset_recommendations: OnboardingCompanyAssetRecommendation[]
  inventory_stock_recommendations: OnboardingInventoryStockRecommendation[]
}

export interface OnboardingCompanyAssetRecommendation {
  name: string
  category: 'tool' | 'equipment' | 'software' | 'vehicle' | 'device' | 'safety' | 'other'
  capabilities: string[]
  notes: string | null
  source_seed_key: string | null
}

export interface OnboardingInventoryStockRecommendation {
  name: string
  category: string
  sku: string | null
  recommended_quantity: number
  reorder_threshold: number | null
  reorder_quantity: number | null
  notes: string | null
  source_seed_key: string | null
}

export interface OnboardingSeedIntelligence {
  vertical: string | null
  source: 'ai' | 'curated' | 'static'
  generated_at: string | null
  ai_provider?: string | null
  ai_model?: string | null
  ai_error?: string | null
  research_sources?: Array<{
    label: string
    url: string
  }>
}

export interface OnboardingStatus {
  tenant: {
    id: string
    name: string
    slug: string
    vertical: string | null
  }
  company: {
    company_name: string | null
    company_phone: string | null
    company_email: string | null
    company_address: string | null
    company_website: string | null
  }
  beta_agreement: {
    required: boolean
    accepted: boolean
    accepted_at: string | null
    /** Beta (free-for-life) workspaces: bring-your-own keys only — no CrewBarn-managed storage/maps/numbers. */
    byo_only?: boolean
  }
  onboarding_required: boolean
  onboarding_completed_at: string | null
  should_redirect: boolean
  progress_percent: number
  steps: OnboardingStep[]
  counts: Record<string, number>
  seed_state: {
    vertical: string | null
    trade: string | null
    applied_at: string | null
    locked_at: string | null
    locked_by_account_id: string | null
    summary: Record<string, number | string> | null
  }
  seed_intelligence: OnboardingSeedIntelligence | null
  seed_packs: OnboardingSeedPackSummary[]
  trades: OnboardingTrade[]
  company_asset_recommendations: OnboardingCompanyAssetRecommendation[]
  inventory_stock_recommendations: OnboardingInventoryStockRecommendation[]
}

export interface OnboardingStatusResponse {
  data: OnboardingStatus
}

export interface ApplySeedResponse {
  data: {
    summary: Record<string, number | string>
    onboarding: OnboardingStatus
  }
}

export interface CompleteOnboardingStepPayload {
  choice?: string
  notes?: string
  ai_provider?: 'anthropic' | 'openai' | 'google' | 'azure'
  ai_api_key?: string
  ai_model?: string | null
  transcription_openai_api_key?: string
  storage_mode?: 'byo' | 'crewbarn_managed' | 'decide_later'
  maps_mode?: 'byo' | 'crewbarn_managed' | 'decide_later'
  storage_provider?: 'cloudflare_r2' | 'crewbarn'
  cloudflare_r2_account_id?: string
  cloudflare_r2_bucket?: string
  cloudflare_r2_endpoint?: string
  cloudflare_r2_access_key_id?: string
  cloudflare_r2_secret_access_key?: string
  cloudflare_r2_public_base_url?: string
  google_maps_api_key?: string
  company_name?: string
  company_phone?: string
  company_email?: string
  company_address?: string
  company_website?: string
  email_mode?: 'byo' | 'crewbarn_managed' | 'decide_later'
  sms_mode?: 'twilio' | 'net2phone' | 'crewbarn_managed' | 'decide_later'
}

export interface CompleteOnboardingStepResponse {
  data: {
    onboarding: OnboardingStatus
  }
}

export interface SeedOnboardingCompanyAssetInput {
  name: string
  category?: OnboardingCompanyAssetRecommendation['category']
  capabilities?: string[]
  capability_notes?: string | null
  notes?: string | null
  source_seed_key?: string | null
}

export interface SeedOnboardingCompanyAssetsResponse {
  data: {
    created_count: number
    existing_count: number
    onboarding: OnboardingStatus
  }
}

export interface SeedOnboardingInventoryStockInput {
  name: string
  category: string
  sku?: string | null
  quantity: number
  reorder_threshold?: number | null
  reorder_quantity?: number | null
  notes?: string | null
  source_seed_key?: string | null
}

export interface SeedOnboardingInventoryStockResponse {
  data: {
    created_catalog_count: number
    updated_catalog_count: number
    stock_rows_count: number
    onboarding: OnboardingStatus
  }
}

export interface OnboardingStaffMember {
  id: string
  email: string
  first_name: string
  last_name: string | null
  name: string
  role_slug: string
  status: string
  created_at: string | null
}

export interface OnboardingStaffRoleOption {
  role_slug: string
  display_name: string
  description: string | null
}

export interface OnboardingStaffIndexResponse {
  data: OnboardingStaffMember[]
  roles: OnboardingStaffRoleOption[]
}

export interface InviteOnboardingStaffInput {
  first_name: string
  last_name?: string | null
  email: string
  role_slug: string
}

export interface InviteOnboardingStaffResponse {
  data: OnboardingStaffMember
  invite: {
    email_sent: boolean
    email_error: string | null
    accept_url: string
  }
}
