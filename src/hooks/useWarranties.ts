import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listWarranties,
  voidWarranty,
  claimWarranty,
  type WarrantyListParams,
} from '@/lib/warranties'

export const warrantyKeys = {
  all: ['warranties'] as const,
  list: (p: WarrantyListParams) => ['warranties', 'list', p] as const,
}

export function useWarranties(params: WarrantyListParams = {}) {
  return useQuery({
    queryKey: warrantyKeys.list(params),
    queryFn: () => listWarranties(params),
    staleTime: 60_000,
  })
}

export function useVoidWarranty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => voidWarranty(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: warrantyKeys.all }),
  })
}

export function useClaimWarranty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => claimWarranty(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: warrantyKeys.all }),
  })
}
