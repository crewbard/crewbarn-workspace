import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applySeedPack,
  completeOnboardingStep,
  getOnboardingStatus,
  inviteOnboardingStaff,
  listOnboardingStaff,
  listSeedPacks,
  previewSeedPack,
  seedOnboardingCompanyAssets,
  seedOnboardingInventoryStock,
} from '@/lib/onboarding'
import type {
  CompleteOnboardingStepPayload,
  InviteOnboardingStaffInput,
  SeedOnboardingCompanyAssetInput,
  SeedOnboardingInventoryStockInput,
} from '@/types/onboarding'

export const onboardingKeys = {
  status: ['onboarding', 'status'] as const,
  packs: ['onboarding', 'seed-packs'] as const,
  preview: (vertical: string) => ['onboarding', 'seed-pack', vertical] as const,
  staff: ['onboarding', 'staff'] as const,
}

export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.status,
    queryFn: () => getOnboardingStatus(),
    enabled,
    staleTime: 15_000,
  })
}

export function useSeedPacks(enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.packs,
    queryFn: () => listSeedPacks(),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSeedPackPreview(vertical: string | null) {
  return useQuery({
    queryKey: onboardingKeys.preview(vertical ?? ''),
    queryFn: () => previewSeedPack(vertical as string),
    enabled: !!vertical,
    staleTime: 5 * 60 * 1000,
  })
}

export function useApplySeedPack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vertical, confirmTradeLock, trade }: { vertical: string; confirmTradeLock: boolean; trade?: string | null }) =>
      applySeedPack(vertical, confirmTradeLock, trade),
    onSuccess: (resp) => {
      qc.setQueryData(onboardingKeys.status, { data: resp.data.onboarding })
      qc.invalidateQueries({ queryKey: onboardingKeys.packs })
    },
  })
}

export function useCompleteOnboardingStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ step, payload }: { step: string; payload?: CompleteOnboardingStepPayload }) =>
      completeOnboardingStep(step, payload),
    onSuccess: (resp) => {
      qc.setQueryData(onboardingKeys.status, { data: resp.data.onboarding })
    },
  })
}

export function useSeedOnboardingCompanyAssets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assets: SeedOnboardingCompanyAssetInput[]) => seedOnboardingCompanyAssets(assets),
    onSuccess: (resp) => {
      qc.setQueryData(onboardingKeys.status, { data: resp.data.onboarding })
    },
  })
}

export function useSeedOnboardingInventoryStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: SeedOnboardingInventoryStockInput[]) => seedOnboardingInventoryStock(items),
    onSuccess: (resp) => {
      qc.setQueryData(onboardingKeys.status, { data: resp.data.onboarding })
    },
  })
}

export function useOnboardingStaff(enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.staff,
    queryFn: () => listOnboardingStaff(),
    enabled,
    staleTime: 30_000,
  })
}

export function useInviteOnboardingStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InviteOnboardingStaffInput) => inviteOnboardingStaff(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: onboardingKeys.staff })
      qc.invalidateQueries({ queryKey: onboardingKeys.status })
    },
  })
}
