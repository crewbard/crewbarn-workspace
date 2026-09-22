import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acknowledgeTesterIntro,
  advanceTesterProgress,
  backTesterStep,
  getAdminTester,
  getAdminTesterActivity,
  getTesterProgress,
  listAdminTesters,
  restartTesterProgress,
  skipTesterStep,
} from '@/lib/tester'
import type { AdvanceInput } from '@/types/tester'

export const testerKeys = {
  progress: ['tester', 'progress'] as const,
  adminList: ['admin', 'testers', 'list'] as const,
  adminDetail: (id: string) => ['admin', 'testers', 'detail', id] as const,
  adminActivity: (id: string) => ['admin', 'testers', 'activity', id] as const,
}

// ---------- Self-service ----------

export function useTesterProgress(enabled: boolean) {
  return useQuery({
    queryKey: testerKeys.progress,
    queryFn: () => getTesterProgress(),
    enabled,
    staleTime: 10_000,
  })
}

export function useAdvanceTester() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdvanceInput) => advanceTesterProgress(input),
    onSuccess: (resp) => {
      qc.setQueryData(testerKeys.progress, resp)
    },
  })
}

export function useSkipTesterStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => skipTesterStep(),
    onSuccess: (resp) => {
      qc.setQueryData(testerKeys.progress, resp)
    },
  })
}

export function useBackTesterStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => backTesterStep(),
    onSuccess: (resp) => {
      qc.setQueryData(testerKeys.progress, resp)
    },
  })
}

export function useRestartTester() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => restartTesterProgress(),
    onSuccess: (resp) => {
      qc.setQueryData(testerKeys.progress, resp)
    },
  })
}

export function useAcknowledgeTesterIntro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => acknowledgeTesterIntro(),
    onSuccess: (resp) => {
      qc.setQueryData(testerKeys.progress, resp)
    },
  })
}

// ---------- Admin ----------

export function useAdminTesters() {
  return useQuery({
    queryKey: testerKeys.adminList,
    queryFn: () => listAdminTesters(),
    staleTime: 30_000,
  })
}

export function useAdminTester(id: string | undefined) {
  return useQuery({
    queryKey: testerKeys.adminDetail(id ?? ''),
    queryFn: () => getAdminTester(id as string),
    enabled: !!id,
    staleTime: 15_000,
  })
}

export function useAdminTesterActivity(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: testerKeys.adminActivity(id ?? ''),
    queryFn: () => getAdminTesterActivity(id as string),
    enabled: !!id && enabled,
    staleTime: 10_000,
  })
}
