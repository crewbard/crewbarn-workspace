import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { TenantBanner } from '@/components/TenantBanner'
import { OnboardingGate } from '@/components/OnboardingGate'
import { TwoFactorGate } from '@/components/TwoFactorGate'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-navy-500 text-sm">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return (
    <>
      <TenantBanner />
      <TwoFactorGate>
        <OnboardingGate>{children}</OnboardingGate>
      </TwoFactorGate>
    </>
  )
}
