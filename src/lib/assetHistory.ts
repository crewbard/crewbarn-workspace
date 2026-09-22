import { apiRequest } from '@/lib/api'
import type { AssetHistoryEvent, AssetHistoryResponse } from '@/types/assetHistory'

/**
 * GET /v1/assets/{id}/history — unified asset history timeline.
 * Backend: AssetController::historyIndex (Slice 7c).
 */
export async function getAssetHistory(assetId: string): Promise<AssetHistoryEvent[]> {
  const res = await apiRequest<AssetHistoryResponse>(
    `/v1/assets/${encodeURIComponent(assetId)}/history`
  )
  return res.data
}
