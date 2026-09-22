import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createVendor,
  deleteVendor,
  getVendor,
  listVendors,
  updateVendor,
} from '@/lib/vendors'
import type {
  VendorInput,
  VendorUpdateInput,
  VendorListParams,
} from '@/types/vendor'

export const vendorKeys = {
  all: ['vendors'] as const,
  lists: () => [...vendorKeys.all, 'list'] as const,
  list: (p: VendorListParams) => [...vendorKeys.lists(), p] as const,
  details: () => [...vendorKeys.all, 'detail'] as const,
  detail: (id: string) => [...vendorKeys.details(), id] as const,
}

export function useVendors(params: VendorListParams = {}) {
  return useQuery({
    queryKey: vendorKeys.list(params),
    queryFn: () => listVendors(params),
    staleTime: 30_000,
  })
}

export function useVendor(id: string | undefined) {
  return useQuery({
    queryKey: vendorKeys.detail(id ?? ''),
    queryFn: () => getVendor(id!),
    enabled: !!id,
  })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: VendorInput) => createVendor(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.lists() })
    },
  })
}

export function useUpdateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VendorUpdateInput }) =>
      updateVendor(id, input),
    onSuccess: (vendor) => {
      qc.invalidateQueries({ queryKey: vendorKeys.lists() })
      qc.setQueryData(vendorKeys.detail(vendor.id), vendor)
    },
  })
}

export function useDeleteVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVendor(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: vendorKeys.lists() })
      qc.removeQueries({ queryKey: vendorKeys.detail(id) })
    },
  })
}
