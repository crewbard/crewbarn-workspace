import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listTaxClasses,
  getTaxClass,
  createTaxClass,
  updateTaxClass,
  deleteTaxClass,
  createTaxClassComponent,
  updateTaxClassComponent,
  deleteTaxClassComponent,
} from '@/lib/taxClasses'
import type {
  TaxClassInput,
  TaxClassUpdateInput,
  TaxClassListParams,
  TaxClassComponentInput,
} from '@/types/taxClass'

// ---------- Query key factory ----------

export const taxClassKeys = {
  all: ['tax-classes'] as const,
  lists: () => [...taxClassKeys.all, 'list'] as const,
  list: (params: TaxClassListParams) => [...taxClassKeys.lists(), params] as const,
  details: () => [...taxClassKeys.all, 'detail'] as const,
  detail: (id: string) => [...taxClassKeys.details(), id] as const,
}

// ---------- Queries ----------

/**
 * useTaxClasses - list tax classes for the current tenant.
 *
 * 5-minute staleTime: powers the catalog item form picker and the tax
 * classes management page. Rarely changes during a session.
 */
export function useTaxClasses(params: TaxClassListParams = {}) {
  return useQuery({
    queryKey: taxClassKeys.list(params),
    queryFn: () => listTaxClasses(params),
    staleTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useTaxClass(id: string | undefined) {
  return useQuery({
    queryKey: taxClassKeys.detail(id ?? ''),
    queryFn: () => getTaxClass(id as string),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

// ---------- Mutations: tax class ----------

export function useCreateTaxClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TaxClassInput) => createTaxClass(input),
    onSuccess: (newTaxClass) => {
      queryClient.invalidateQueries({ queryKey: taxClassKeys.lists() })
      queryClient.setQueryData(taxClassKeys.detail(newTaxClass.id), newTaxClass)
    },
  })
}

export function useUpdateTaxClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaxClassUpdateInput }) =>
      updateTaxClass(id, input),
    onSuccess: (updatedTaxClass) => {
      queryClient.invalidateQueries({ queryKey: taxClassKeys.lists() })
      queryClient.setQueryData(taxClassKeys.detail(updatedTaxClass.id), updatedTaxClass)
    },
  })
}

export function useDeleteTaxClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTaxClass(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: taxClassKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: taxClassKeys.lists() })
    },
  })
}

// ---------- Mutations: components ----------

/**
 * Component mutations all invalidate both the parent tax class detail
 * (which contains the components array) AND the tax class lists (which
 * surface total_rate that depends on components).
 */
export function useCreateTaxClassComponent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taxClassId, input }: { taxClassId: string; input: TaxClassComponentInput }) =>
      createTaxClassComponent(taxClassId, input),
    onSuccess: (_, { taxClassId }) => {
      queryClient.invalidateQueries({ queryKey: taxClassKeys.detail(taxClassId) })
      queryClient.invalidateQueries({ queryKey: taxClassKeys.lists() })
    },
  })
}

export function useUpdateTaxClassComponent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      taxClassId,
      componentId,
      input,
    }: {
      taxClassId: string
      componentId: string
      input: Partial<TaxClassComponentInput>
    }) => updateTaxClassComponent(taxClassId, componentId, input),
    onSuccess: (_, { taxClassId }) => {
      queryClient.invalidateQueries({ queryKey: taxClassKeys.detail(taxClassId) })
      queryClient.invalidateQueries({ queryKey: taxClassKeys.lists() })
    },
  })
}

export function useDeleteTaxClassComponent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taxClassId, componentId }: { taxClassId: string; componentId: string }) =>
      deleteTaxClassComponent(taxClassId, componentId),
    onSuccess: (_, { taxClassId }) => {
      queryClient.invalidateQueries({ queryKey: taxClassKeys.detail(taxClassId) })
      queryClient.invalidateQueries({ queryKey: taxClassKeys.lists() })
    },
  })
}
