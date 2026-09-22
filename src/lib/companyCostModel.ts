import { apiRequest } from '@/lib/api'
import type {
  CompanyCostEntry,
  CompanyCostEntryInput,
  CompanyCostModelResponse,
  CompanyCostModelSummary,
  TenantCostModelSettings,
  TenantCostModelSettingsInput,
} from '@/types/companyCostModel'

export async function getCompanyCostModel(): Promise<CompanyCostModelResponse> {
  return apiRequest<CompanyCostModelResponse>('/v1/company-cost-model')
}

export async function updateCompanyCostModelSettings(
  input: TenantCostModelSettingsInput,
): Promise<{ settings: TenantCostModelSettings; summary: CompanyCostModelSummary }> {
  return apiRequest<{ settings: TenantCostModelSettings; summary: CompanyCostModelSummary }>('/v1/company-cost-model/settings', {
    method: 'PATCH',
    body: input,
  })
}

export async function createCompanyCostEntry(
  input: CompanyCostEntryInput,
): Promise<{ entry: CompanyCostEntry; summary: CompanyCostModelSummary }> {
  return apiRequest<{ entry: CompanyCostEntry; summary: CompanyCostModelSummary }>('/v1/company-cost-model/entries', {
    method: 'POST',
    body: input,
  })
}

export async function updateCompanyCostEntry(
  id: string,
  input: Partial<CompanyCostEntryInput>,
): Promise<{ entry: CompanyCostEntry; summary: CompanyCostModelSummary }> {
  return apiRequest<{ entry: CompanyCostEntry; summary: CompanyCostModelSummary }>(`/v1/company-cost-model/entries/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function deleteCompanyCostEntry(id: string): Promise<void> {
  await apiRequest<void>(`/v1/company-cost-model/entries/${id}`, { method: 'DELETE' })
}
