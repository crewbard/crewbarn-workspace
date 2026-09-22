import { apiRequest } from '@/lib/api'

export type DiscountKind = 'percent' | 'fixed'

export interface Discount {
  id: string
  name: string
  kind: DiscountKind
  value: number
  code: string | null
  description: string | null
  active: boolean
  created_at: string | null
}

export interface DiscountInput {
  name: string
  kind: DiscountKind
  value: number
  code?: string | null
  description?: string | null
  active?: boolean
}

export async function listDiscounts(): Promise<Discount[]> {
  const res = await apiRequest<{ data: Discount[] }>('/v1/discounts')
  return res.data
}

export async function createDiscount(input: DiscountInput): Promise<Discount> {
  const res = await apiRequest<{ data: Discount }>('/v1/discounts', { method: 'POST', body: input })
  return res.data
}

export async function updateDiscount(id: string, input: Partial<DiscountInput>): Promise<Discount> {
  const res = await apiRequest<{ data: Discount }>(`/v1/discounts/${id}`, { method: 'PATCH', body: input })
  return res.data
}

export async function deleteDiscount(id: string): Promise<void> {
  await apiRequest<void>(`/v1/discounts/${id}`, { method: 'DELETE' })
}

/** Human-readable amount: "10%" or "$25.00". */
export function formatDiscount(d: Pick<Discount, 'kind' | 'value'>): string {
  return d.kind === 'percent' ? `${d.value}%` : `$${d.value.toFixed(2)}`
}
