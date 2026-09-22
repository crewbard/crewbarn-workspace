/**
 * The subscription shape returned by /v1/tenant-settings/subscription.
 *
 * It lives here rather than on SettingsSubscriptionPage because the app shell
 * needs it too — AppLayout, SubscriptionBanner and HostedPlanWall all read the
 * summary to decide what to show. A shared type exported from a page means
 * everything that needs the type imports the page, which is how the shell
 * ended up reaching CrewBarn's billing screen.
 */
export interface SubscriptionSummary {
  billing_mode: 'off' | 'free' | 'subscription'
  tier: 'connect' | 'hosted'
  hosted_app_allowed: boolean
  connect_seat_cents: number
  hosted_seat_cents: number
  state: 'off' | 'active' | 'grace' | 'read_only'
  status: string | null
  base_cents: number
  seat_cents: number
  seats_purchased: number
  seats_used: number
  seats_available: number
  monthly_total_cents: number
  current_period_end: string | null
  grace_ends_at: string | null
  canceled_at: string | null
  grace_days: number
  checkout_ready: boolean
  has_stripe_customer: boolean
  can_manage: boolean
}
