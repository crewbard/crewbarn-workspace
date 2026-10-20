import { useOnboardingStatus } from '@/hooks/useOnboarding'

/**
 * The trade pack this workspace picked at sign-up (it can't change later).
 * Null while loading or when no pack was applied. Used to show
 * trade-specific presets and examples only to that trade.
 */
export function useTradeVertical(): string | null {
  const { data } = useOnboardingStatus()
  const status = data?.data
  return status?.seed_state?.vertical || status?.tenant?.vertical || null
}

export function useIsLocksmithTrade(): boolean {
  return useTradeVertical() === 'locksmith'
}
