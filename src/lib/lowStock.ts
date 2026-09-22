import { apiRequest } from '@/lib/api'
import type { LowStockItem } from '@/types/lowStock'

interface LowStockResponse {
  data: LowStockItem[]
}

export async function listLowStock(): Promise<LowStockItem[]> {
  const res = await apiRequest<LowStockResponse>('/v1/inventory-stock-levels/low-stock')
  return res.data
}
