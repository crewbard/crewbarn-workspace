import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acknowledgeTesterIntro,
  advanceTesterProgress,
  backTesterStep,
  getTesterProgress,
  restartTesterProgress,
  skipTesterStep,
} from '@/lib/tester'
import type { AdvanceInput } from '@/types/tester'

export const testerKeys = {
  progress: ['tester', 'progress'] as const,
}

// The platform admin's tester hooks are in src/admin/hooks/useAdminTesters.ts.

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
