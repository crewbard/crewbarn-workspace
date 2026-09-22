import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listJobStatuses,
  getJobStatus,
  createJobStatus,
  updateJobStatus,
  deleteJobStatus,
} from '@/lib/jobStatuses'
import type {
  JobStatusInput,
  JobStatusUpdateInput,
  JobStatusListParams,
} from '@/types/jobStatus'

// ---------- Query key factory ----------

export const jobStatusKeys = {
  all: ['job-statuses'] as const,
  lists: () => [...jobStatusKeys.all, 'list'] as const,
  list: (params: JobStatusListParams) => [...jobStatusKeys.lists(), params] as const,
  details: () => [...jobStatusKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobStatusKeys.details(), id] as const,
}

// ---------- Queries ----------

/**
 * useJobStatuses — list job statuses for the current tenant.
 *
 * 5-minute staleTime: this powers form pickers and rarely changes during
 * a session. Settings -> Workflow page edits will manually invalidate.
 */
export function useJobStatuses(params: JobStatusListParams = {}) {
  return useQuery({
    queryKey: jobStatusKeys.list(params),
    queryFn: () => listJobStatuses(params),
    staleTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useJobStatus(id: string | undefined) {
  return useQuery({
    queryKey: jobStatusKeys.detail(id ?? ''),
    queryFn: () => getJobStatus(id as string),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

// ---------- Mutations ----------

export function useCreateJobStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: JobStatusInput) => createJobStatus(input),
    onSuccess: (newJobStatus) => {
      queryClient.invalidateQueries({ queryKey: jobStatusKeys.lists() })
      queryClient.setQueryData(jobStatusKeys.detail(newJobStatus.id), newJobStatus)
    },
  })
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: JobStatusUpdateInput }) =>
      updateJobStatus(id, input),
    onSuccess: (updatedJobStatus) => {
      queryClient.invalidateQueries({ queryKey: jobStatusKeys.lists() })
      queryClient.setQueryData(jobStatusKeys.detail(updatedJobStatus.id), updatedJobStatus)
    },
  })
}

export function useDeleteJobStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteJobStatus(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: jobStatusKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: jobStatusKeys.lists() })
    },
  })
}
