import { apiRequest } from '@/lib/api'

/**
 * QuickBooks Online connection client. The tenant connects by OAuth login
 * only — no API keys are ever entered here. See QuickBooksController.
 */

export interface QuickBooksSyncSettings {
  entities: { customers: boolean; items: boolean; invoices: boolean }
  direction: 'pull' | 'push' | 'two_way'
  schedule: 'manual' | 'daily'
  number_strategy: 'fresh' | 'keep'
}

export interface QuickBooksStatus {
  /** Server has Intuit app credentials configured. */
  configured: boolean
  connected: boolean
  status: 'disconnected' | 'connected' | 'error' | 'expired'
  environment: string
  realm_id: string | null
  sync_settings: QuickBooksSyncSettings
  last_synced_at: string | null
  last_error: string | null
}

export function getQuickBooksStatus(): Promise<QuickBooksStatus> {
  return apiRequest<{ data: QuickBooksStatus }>('/v1/integrations/quickbooks').then((r) => r.data)
}

/** Returns the Intuit consent URL to redirect the browser to. */
export function startQuickBooksConnect(): Promise<string> {
  return apiRequest<{ data: { url: string } }>('/v1/integrations/quickbooks/connect', {
    method: 'POST',
  }).then((r) => r.data.url)
}

/** Hand the OAuth code back to the API to complete the connection. */
export function finishQuickBooksConnect(params: {
  code: string
  realm_id: string
  state: string
}): Promise<QuickBooksStatus> {
  return apiRequest<{ data: QuickBooksStatus }>('/v1/integrations/quickbooks/callback', {
    method: 'POST',
    body: params,
  }).then((r) => r.data)
}

export function updateQuickBooksSettings(
  settings: Partial<QuickBooksSyncSettings>,
): Promise<QuickBooksStatus> {
  return apiRequest<{ data: QuickBooksStatus }>('/v1/integrations/quickbooks/settings', {
    method: 'PATCH',
    body: settings,
  }).then((r) => r.data)
}

export function testQuickBooks(): Promise<{ ok: boolean; company_name: string | null }> {
  return apiRequest<{ data: { ok: boolean; company_name: string | null } }>(
    '/v1/integrations/quickbooks/test',
    { method: 'POST' },
  ).then((r) => r.data)
}

export function disconnectQuickBooks(): Promise<{ disconnected: boolean }> {
  return apiRequest<{ data: { disconnected: boolean } }>('/v1/integrations/quickbooks', {
    method: 'DELETE',
  }).then((r) => r.data)
}

export interface QuickBooksEntityResult {
  created: number
  updated: number
  skipped: number
  errors: { ref: string; message: string }[]
}

export interface QuickBooksSyncResult {
  /** Keyed by entity: 'customers' | 'items' | 'invoices'. */
  results: Record<string, QuickBooksEntityResult>
  last_synced_at: string | null
}

/** Pull the enabled entities from QuickBooks into CrewBarn. */
export function runQuickBooksSync(): Promise<QuickBooksSyncResult> {
  return apiRequest<{ data: QuickBooksSyncResult }>('/v1/integrations/quickbooks/sync', {
    method: 'POST',
  }).then((r) => r.data)
}

/** Push CrewBarn records up to QuickBooks (customers now; invoices/payments next). */
export function pushToQuickBooks(): Promise<{ results: Record<string, QuickBooksEntityResult> }> {
  return apiRequest<{ data: { results: Record<string, QuickBooksEntityResult> } }>(
    '/v1/integrations/quickbooks/push',
    { method: 'POST' },
  ).then((r) => r.data)
}
