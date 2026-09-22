import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listSubcontractors,
  getSubcontractor,
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
} from '@/lib/subcontractors'
import type {
  SubcontractorInput,
  SubcontractorUpdateInput,
} from '@/types/subcontractor'

export const subcontractorKeys = {
  all: ['subcontractors'] as const,
  list: (params: { q?: string; active?: boolean } = {}) =>
    [...subcontractorKeys.all, 'list', params] as const,
  detail: (id: string) => [...subcontractorKeys.all, 'detail', id] as const,
}

/**
 * useSubcontractors — list. Defaults to active=true so the picker
 * doesn't surface soft-deleted or disabled subs.
 */
export function useSubcontractors(params: { q?: string; active?: boolean } = {}) {
  return useQuery({
    queryKey: subcontractorKeys.list(params),
    queryFn: () => listSubcontractors(params),
    staleTime: 30_000,
  })
}

export function useSubcontractor(id: string | undefined) {
  return useQuery({
    queryKey: subcontractorKeys.detail(id ?? ''),
    queryFn: () => getSubcontractor(id!),
    enabled: !!id,
  })
}

export function useCreateSubcontractor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubcontractorInput) => createSubcontractor(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subcontractorKeys.all })
    },
  })
}

export function useUpdateSubcontractor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SubcontractorUpdateInput }) =>
      updateSubcontractor(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subcontractorKeys.all })
    },
  })
}

export function useDeleteSubcontractor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSubcontractor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subcontractorKeys.all })
    },
  })
}
