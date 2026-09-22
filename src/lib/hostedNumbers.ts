import { apiRequest } from '@/lib/api'

export interface HostedPhoneNumber {
  id: string
  provider: string
  phone_number: string
  friendly_name: string | null
  capabilities: Record<string, boolean> | null
  status: string
  monthly_fee_cents: number
  ten_dlc_status: string | null
  provisioned_at: string | null
  released_at: string | null
  last_error: string | null
}

export interface HostedNumbersStatus {
  enabled: boolean
  provisioning_enabled: boolean
  test_mode: boolean
  monthly_fee_cents: number
  numbers: HostedPhoneNumber[]
}

export interface HostedNumberSearchResult {
  phone_number: string
  friendly_name: string | null
  locality: string | null
  region: string | null
  iso_country: string | null
  capabilities: Record<string, boolean> | null
}

export async function getHostedNumbers(): Promise<HostedNumbersStatus> {
  const response = await apiRequest<{ data: HostedNumbersStatus }>(
    '/v1/settings/communication/hosted-numbers'
  )
  return response.data
}

export async function searchHostedNumbers(areaCode: string): Promise<HostedNumberSearchResult[]> {
  const response = await apiRequest<{ data: HostedNumberSearchResult[] }>(
    `/v1/settings/communication/hosted-numbers/search?area_code=${encodeURIComponent(areaCode)}`
  )
  return response.data
}

export async function buyHostedNumber(phoneNumber: string): Promise<HostedPhoneNumber> {
  const response = await apiRequest<{ data: HostedPhoneNumber }>(
    '/v1/settings/communication/hosted-numbers/buy',
    {
      method: 'POST',
      body: { phone_number: phoneNumber },
    }
  )
  return response.data
}

export async function releaseHostedNumber(id: string): Promise<HostedPhoneNumber> {
  const response = await apiRequest<{ data: HostedPhoneNumber }>(
    `/v1/settings/communication/hosted-numbers/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      body: { confirmation: 'RELEASE' },
    }
  )
  return response.data
}
