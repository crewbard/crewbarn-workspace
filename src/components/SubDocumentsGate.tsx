import { Navigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getMySubDocuments, subDocumentsPutOff } from '@/lib/subDocuments'

/**
 * A sub company on the free plan finishes onboarding before anything else:
 * until every document it was asked for is in and current, its owner or
 * admin lands on /sub-documents after signing in. Its techs are never held
 * up, and "Finish later" there lets the owner through for this sign-in: jobs
 * come through with documents missing. With the sub network off the check
 * answers 404 and nobody is stopped.
 */
export function SubDocumentsGate({ children }: { children: ReactNode }) {
  const { account } = useAuth()
  const location = useLocation()
  const check = !!account && !account.is_platform_admin && account.tenant?.plan === 'sub' && location.pathname !== '/sub-documents' && !subDocumentsPutOff()

  const docs = useQuery({
    queryKey: ['sub-documents'],
    queryFn: getMySubDocuments,
    enabled: check,
    retry: false,
    staleTime: 60_000,
  })

  if (!check) return <>{children}</>
  if (docs.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500" role="status">Loading…</div>
  }
  const data = docs.data?.data
  if (data && data.can_upload && !data.complete) {
    return <Navigate to="/sub-documents" replace />
  }

  return <>{children}</>
}
