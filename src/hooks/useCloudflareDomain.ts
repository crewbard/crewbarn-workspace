import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * The domain a workspace has already told CrewBarn about.
 *
 * Connecting Cloudflare hands over the zone, and several screens then ask for
 * the same domain again — the map key's referrer, the email sending domain,
 * the website address. One hook so a prefill added in one place is available
 * in the next, rather than each screen solving it separately or not at all.
 *
 * Falls back to the first zone the token can see when a zone has not been
 * picked yet, and returns null when Cloudflare is not connected, so a caller
 * can tell "we know" from "we do not".
 */

interface CloudflareStatus {
  connected: boolean
  zone_name: string | null
  zones: Array<{ id: string; name: string }>
}

export const CLOUDFLARE_KEY = ['settings', 'cloudflare']

/**
 * Is Cloudflare connected, and which domain does it carry?
 *
 * The domain alone cannot answer "connected": a token with no zones yet
 * returns nothing, which is a different thing from never having connected.
 * Screens that offer to set up a custom address need to tell those apart.
 */
export function useCloudflareStatus(): { connected: boolean; domain: string | null; loading: boolean } {
  const status = useQuery({
    queryKey: CLOUDFLARE_KEY,
    queryFn: () => apiRequest<{ data: CloudflareStatus }>('/v1/settings/cloudflare'),
    staleTime: 5 * 60_000,
    retry: false,
  })
  const s = status.data?.data
  return {
    connected: Boolean(s?.connected),
    domain: s?.zone_name || s?.zones?.[0]?.name || null,
    loading: status.isLoading,
  }
}

export function useCloudflareDomain(): string | null {
  const status = useQuery({
    queryKey: CLOUDFLARE_KEY,
    queryFn: () => apiRequest<{ data: CloudflareStatus }>('/v1/settings/cloudflare'),
    // Several screens ask; none of them need it fresh to the second.
    staleTime: 5 * 60_000,
    retry: false,
  })
  const s = status.data?.data
  return s?.zone_name || s?.zones?.[0]?.name || null
}
