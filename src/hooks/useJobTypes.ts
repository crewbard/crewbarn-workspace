import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listJobTypes,
  getJobType,
  createJobType,
  updateJobType,
  deleteJobType,
} from '@/lib/jobTypes'
import type {
  JobTypeInput,
  JobTypeUpdateInput,
  JobTypeListParams,
} from '@/types/jobType'

// ---------- Query key factory ----------

export const jobTypeKeys = {
  all: ['job-types'] as const,
  lists: () => [...jobTypeKeys.all, 'list'] as const,
  list: (params: JobTypeListParams) => [...jobTypeKeys.lists(), params] as const,
  details: () => [...jobTypeKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobTypeKeys.details(), id] as const,
}

// ---------- Queries ----------

/**
 * useJobTypes — list job types for the current tenant.
 *
 * 5-minute staleTime: this powers form pickers and rarely changes during
 * a session. Settings -> Workflow page edits will manually invalidate.
 */
export function useJobTypes(params: JobTypeListParams = {}) {
  return useQuery({
    queryKey: jobTypeKeys.list(params),
    queryFn: () => listJobTypes(params),
    staleTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useJobType(id: string | undefined) {
  return useQuery({
    queryKey: jobTypeKeys.detail(id ?? ''),
    queryFn: () => getJobType(id as string),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

// ---------- Mutations ----------

export function useCreateJobType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: JobTypeInput) => createJobType(input),
    onSuccess: (newJobType) => {
      queryClient.invalidateQueries({ queryKey: jobTypeKeys.lists() })
      queryClient.setQueryData(jobTypeKeys.detail(newJobType.id), newJobType)
    },
  })
}

export function useUpdateJobType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: JobTypeUpdateInput }) =>
      updateJobType(id, input),
    onSuccess: (updatedJobType) => {
      queryClient.invalidateQueries({ queryKey: jobTypeKeys.lists() })
      queryClient.setQueryData(jobTypeKeys.detail(updatedJobType.id), updatedJobType)
    },
  })
}

export function useDeleteJobType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteJobType(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: jobTypeKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: jobTypeKeys.lists() })
    },
  })
}
