import { apiRequest } from '@/lib/api'
import type {
  ApplySeedResponse,
  CompleteOnboardingStepPayload,
  CompleteOnboardingStepResponse,
  InviteOnboardingStaffInput,
  InviteOnboardingStaffResponse,
  OnboardingStaffIndexResponse,
  OnboardingSeedPackPreview,
  OnboardingSeedPackSummary,
  OnboardingStatusResponse,
  SeedOnboardingCompanyAssetInput,
  SeedOnboardingCompanyAssetsResponse,
  SeedOnboardingInventoryStockInput,
  SeedOnboardingInventoryStockResponse,
} from '@/types/onboarding'

export async function getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  return apiRequest<OnboardingStatusResponse>('/v1/onboarding')
}

export async function listSeedPacks(): Promise<{ data: OnboardingSeedPackSummary[] }> {
  return apiRequest<{ data: OnboardingSeedPackSummary[] }>('/v1/onboarding/seed-packs')
}

export async function previewSeedPack(vertical: string): Promise<{ data: OnboardingSeedPackPreview }> {
  return apiRequest<{ data: OnboardingSeedPackPreview }>(`/v1/onboarding/seed-packs/${vertical}`)
}

export async function applySeedPack(vertical: string, confirmTradeLock = false, trade?: string | null): Promise<ApplySeedResponse> {
  return apiRequest<ApplySeedResponse>('/v1/onboarding/apply-seed', {
    method: 'POST',
    body: { vertical, confirm_trade_lock: confirmTradeLock, trade: trade ?? null },
  })
}

export async function completeOnboardingStep(
  step: string,
  payload: CompleteOnboardingStepPayload = {},
): Promise<CompleteOnboardingStepResponse> {
  return apiRequest<CompleteOnboardingStepResponse>(`/v1/onboarding/steps/${step}`, {
    method: 'POST',
    body: payload,
  })
}

export async function seedOnboardingCompanyAssets(
  assets: SeedOnboardingCompanyAssetInput[],
): Promise<SeedOnboardingCompanyAssetsResponse> {
  return apiRequest<SeedOnboardingCompanyAssetsResponse>('/v1/onboarding/company-assets', {
    method: 'POST',
    body: { assets },
  })
}

export async function seedOnboardingInventoryStock(
  items: SeedOnboardingInventoryStockInput[],
): Promise<SeedOnboardingInventoryStockResponse> {
  return apiRequest<SeedOnboardingInventoryStockResponse>('/v1/onboarding/inventory-stock', {
    method: 'POST',
    body: { items },
  })
}

export async function listOnboardingStaff(): Promise<OnboardingStaffIndexResponse> {
  return apiRequest<OnboardingStaffIndexResponse>('/v1/staff')
}

export async function inviteOnboardingStaff(
  input: InviteOnboardingStaffInput,
): Promise<InviteOnboardingStaffResponse> {
  return apiRequest<InviteOnboardingStaffResponse>('/v1/staff', {
    method: 'POST',
    body: input,
  })
}
