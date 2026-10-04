import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { onConnect } from '@/lib/workspaceScope'

/**
 * Does this workspace list company settings in its own Tool Shed?
 *
 * Off by default — they live on connect.crewbarn.com. The switch is on
 * Connect, under Your business.
 *
 * Two deliberate behaviours while the answer is unknown:
 *
 *   On Connect the answer is always yes without asking. The settings console
 *   showing no settings for a beat would be absurd.
 *
 *   Everywhere else, an unanswered or failed request means NO. A menu that
 *   fills with sixty-five entries and then empties is worse than one that
 *   fills once, and the failure mode of guessing wrong is only a link people
 *   have to take one extra hop to reach.
 */
export function useSettingsInWorkspace(): { show: boolean; isLoading: boolean } {
  const connect = onConnect()

  const query = useQuery({
    queryKey: ['tenant-preferences', 'settings-in-workspace'],
    queryFn: () =>
      apiRequest<{ data: { settings_in_workspace?: boolean } }>('/v1/settings/modules'),
    staleTime: 5 * 60_000,
    retry: false,
    enabled: !connect,
  })

  if (connect) return { show: true, isLoading: false }

  return {
    show: query.data?.data?.settings_in_workspace === true,
    isLoading: query.isLoading,
  }
}
