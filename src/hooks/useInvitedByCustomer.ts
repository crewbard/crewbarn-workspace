import { useAuth } from '@/hooks/useAuth'

/**
 * A trade a customer brought into CrewBarn, still free: the customer's name.
 * It can open every page; it changes only its business details and the jobs
 * its customers send it (App\Services\SubNetwork\SubPlan::CUSTOMER_*).
 */
export function useInvitedByCustomer(): string | null {
  const { account } = useAuth()
  if (!account || account.is_platform_admin || !account.tenant?.on_free_sub_plan) return null
  return account.tenant.invited_by_customer ?? null
}
