import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
} from '@/lib/admin'
import type {
  TenantListParams,
  CreateTenantInput,
  UpdateTenantInput,
} from '@/types/tenant'

// ---------- Query key factory ----------

export const adminTenantKeys = {
  all: ['admin', 'tenants'] as const,
  lists: () => [...adminTenantKeys.all, 'list'] as const,
  list: (params: TenantListParams) => [...adminTenantKeys.lists(), params] as const,
  details: () => [...adminTenantKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminTenantKeys.details(), id] as const,
}

// ---------- Queries ----------

export function useTenants(params: TenantListParams = {}, enabled = true) {
  return useQuery({
    queryKey: adminTenantKeys.list(params),
    queryFn: () => listTenants(params),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useTenant(id: string | undefined) {
  return useQuery({
    queryKey: adminTenantKeys.detail(id ?? ''),
    queryFn: () => getTenant(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}

// ---------- Mutations ----------

export function useCreateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTenantInput) => createTenant(input),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: adminTenantKeys.lists() })
      queryClient.setQueryData(
        adminTenantKeys.detail(response.data.tenant.id),
        { data: response.data.tenant }
      )
    },
  })
}

export function useUpdateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTenantInput }) =>
      updateTenant(id, input),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: adminTenantKeys.lists() })
      queryClient.setQueryData(adminTenantKeys.detail(response.data.id), response)
    },
  })
}
