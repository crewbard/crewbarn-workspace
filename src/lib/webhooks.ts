import { apiRequest } from '@/lib/api'

export interface WebhookEndpoint {
  id: string
  url: string
  description: string | null
  events: string[]
  secret: string
  active: boolean
  last_status: number | null
  last_delivered_at: string | null
  consecutive_failures: number
  created_at: string | null
}

export interface WebhookDelivery {
  id: string
  event: string
  ok: boolean
  status_code: number | null
  error: string | null
  duration_ms: number | null
  created_at: string | null
}

export interface WebhookEndpointInput {
  url: string
  events: string[]
  description?: string | null
  active?: boolean
  regenerate_secret?: boolean
}

export interface TestResult {
  ok: boolean
  status_code: number | null
  error: string | null
  duration_ms: number | null
}

export async function listWebhooks(): Promise<WebhookEndpoint[]> {
  const res = await apiRequest<{ data: WebhookEndpoint[] }>('/v1/webhooks')
  return res.data
}

export async function getWebhookEvents(): Promise<string[]> {
  const res = await apiRequest<{ data: string[] }>('/v1/webhooks/events')
  return res.data
}

export async function createWebhook(input: WebhookEndpointInput): Promise<WebhookEndpoint> {
  const res = await apiRequest<{ data: WebhookEndpoint }>('/v1/webhooks', {
    method: 'POST',
    body: input,
  })
  return res.data
}

export async function updateWebhook(
  id: string,
  input: Partial<WebhookEndpointInput>
): Promise<WebhookEndpoint> {
  const res = await apiRequest<{ data: WebhookEndpoint }>(`/v1/webhooks/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return res.data
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiRequest<void>(`/v1/webhooks/${id}`, { method: 'DELETE' })
}

export async function testWebhook(id: string): Promise<TestResult> {
  return apiRequest<TestResult>(`/v1/webhooks/${id}/test`, { method: 'POST' })
}

export async function getWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
  const res = await apiRequest<{ data: WebhookDelivery[] }>(`/v1/webhooks/${id}/deliveries`)
  return res.data
}
