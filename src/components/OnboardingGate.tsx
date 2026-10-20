import { useEffect, useState, lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useOnboardingStatus } from '@/hooks/useOnboarding'
const OnboardingOverlay = lazy(() => import('@/components/onboarding/OnboardingOverlay').then((m) => ({ default: m.OnboardingOverlay })))

interface OnboardingGateProps {
  children: ReactNode
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const { account } = useAuth()
  const location = useLocation()
  const [, forceDismissRefresh] = useState(0)
  const shouldCheck =
    !!account &&
    !account.is_platform_admin &&
    account.account_type === 'tenant_admin' &&
    location.pathname !== '/onboarding'

  const onboardingQuery = useOnboardingStatus(shouldCheck)
  const onboarding = onboardingQuery.data?.data
  const tenantId = onboarding?.tenant.id ?? null
  // A setup step opened this page in a new tab (`?onboarding=peek`) so the
  // owner can look at it. Don't cover it with the setup list again; remember
  // that for this tab only.
  const peek = new URLSearchParams(location.search).get('onboarding') === 'peek'
  useEffect(() => {
    if (peek && tenantId) {
      window.sessionStorage.setItem(`crewbarn:onboarding:overlay-dismissed:${tenantId}`, '1')
    }
  }, [peek, tenantId])
  const dismissed =
    peek ||
    (!!tenantId &&
      window.sessionStorage.getItem(`crewbarn:onboarding:overlay-dismissed:${tenantId}`) === '1')

  if (!shouldCheck) {
    return <>{children}</>
  }

  if (onboardingQuery.isError || !onboarding?.should_redirect || dismissed) {
    return <>{children}</>
  }

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <OnboardingOverlay
          open={!onboardingQuery.isLoading}
          onClose={() => {
            if (tenantId) {
              window.sessionStorage.setItem(`crewbarn:onboarding:overlay-dismissed:${tenantId}`, '1')
              forceDismissRefresh((value) => value + 1)
            }
          }}
        />
      </Suspense>
    </>
  )
}
