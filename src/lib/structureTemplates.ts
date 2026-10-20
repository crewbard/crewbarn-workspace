/**
 * The structure builder's server calls (API section 34.245): saved
 * templates, bulk rows, "Add another like this one", and Undo for places
 * that were just created.
 */
import { apiRequest } from '@/lib/api'
import type { ApiTreeNode, Layer } from '@/lib/structureDraft'

export interface StructureTemplate {
  id: string
  name: string
  description: string | null
  source: 'builder' | 'place' | 'location'
  node_count: number
  shape: ApiTreeNode[]
  layers: Array<Omit<Layer, 'id'>> | null
  created_at: string | null
}

/** What every "create" answers with, so the screen can offer Undo and labels. */
export interface CreatedPlaces {
  created_count: number
  created_ids: string[]
  undo_token?: string
  undo_expires_at?: number
  root_codes?: string[]
  renamed?: Array<{ from: string; to: string }>
  skipped_count?: number
}

export const structureTemplateKeys = { all: ['inventory-structure-templates'] as const }

export async function listStructureTemplates(): Promise<StructureTemplate[]> {
  const res = await apiRequest<{ data: StructureTemplate[] }>('/v1/inventory-structure-templates')
  return res.data
}

export type SaveTemplateInput =
  | { name: string; description?: string | null; tree: ApiTreeNode[]; layers?: Array<Omit<Layer, 'id'>> | null }
  | { name: string; description?: string | null; from_bin_id: string }
  | { name: string; description?: string | null; from_location_id: string }

export async function saveStructureTemplate(input: SaveTemplateInput): Promise<StructureTemplate> {
  const res = await apiRequest<{ data: StructureTemplate }>('/v1/inventory-structure-templates', { method: 'POST', body: input })
  return res.data
}

/** Goes through the normal delete check (password and reason), like any delete. */
export async function deleteStructureTemplate(id: string): Promise<void> {
  await apiRequest(`/v1/inventory-structure-templates/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function applyStructureTemplate(id: string, locationId: string, parentBinId?: string | null): Promise<CreatedPlaces> {
  const res = await apiRequest<{ data: CreatedPlaces }>(`/v1/inventory-structure-templates/${encodeURIComponent(id)}/apply`, {
    method: 'POST',
    body: { location_id: locationId, ...(parentBinId ? { parent_bin_id: parentBinId } : {}) },
  })
  return res.data
}

export interface BulkRowsInput {
  bin_ids: string[]
  count: number
  mode?: 'alpha' | 'num' | 'pad'
  kind?: string | null
  capacity?: number | null
}

export async function bulkAddRows(input: BulkRowsInput): Promise<CreatedPlaces & { per_bin: Array<{ bin_id: string; codes: string[] }> }> {
  const res = await apiRequest<{ data: CreatedPlaces & { per_bin: Array<{ bin_id: string; codes: string[] }> } }>(
    '/v1/inventory-bins/bulk-add-rows', { method: 'POST', body: input })
  return res.data
}

export async function copyPlace(binId: string, count = 1): Promise<CreatedPlaces> {
  const res = await apiRequest<{ data: CreatedPlaces }>(`/v1/inventory-bins/${encodeURIComponent(binId)}/copy`, { method: 'POST', body: { count } })
  return res.data
}

/** Can this be undone right now? (The server's undo lasts 15 minutes.) */
export function canUndo(c: CreatedPlaces | null | undefined, nowMs = Date.now()): boolean {
  return !!c && !!c.undo_token && !!c.undo_expires_at && c.created_ids.length > 0 && c.undo_expires_at * 1000 > nowMs
}

export async function undoCreatedPlaces(c: CreatedPlaces): Promise<number> {
  const res = await apiRequest<{ data: { removed_count: number } }>('/v1/inventory-bins/undo-create', {
    method: 'POST',
    body: { ids: c.created_ids, undo_token: c.undo_token, undo_expires_at: c.undo_expires_at },
  })
  return res.data.removed_count
}
