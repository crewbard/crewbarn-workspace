import { useQuery } from '@tanstack/react-query'
import { apiRequest, getFranchiseActAs, setFranchiseActAs } from '@/lib/api'

/**
 * Sticky banner shown while a franchisor is drilled into one of its franchises
 * (FR-4/FR-5). Everything on screen is that franchise's data. By default it's
 * read-only; if the franchise has approved a support grant it shows SUPPORT
 * MODE (editing enabled, until expiry). "Exit" returns to the dashboard.
 */
export function FranchiseDrillBanner() {
  const f = getFranchiseActAs()

  // Only poll status when actually drilled in.
  const { data } = useQuery({
    queryKey: ['franchise-support-status', f?.id],
    queryFn: () =>
      apiRequest<{ data: { active: boolean; expires_at: string | null } }>(
        `/v1/franchises/${f!.id}/support-status`,
      ),
    enabled: !!f,
    refetchInterval: 60_000,
  })

  if (!f) return null

  const active = data?.data.active ?? false
  const until = data?.data.expires_at ? new Date(data.data.expires_at).toLocaleString() : null

  const exit = () => {
    setFranchiseActAs(null)
    window.location.assign('/franchises')
  }

  return (
    <div
      className={`h-20 sm:h-16 overflow-y-auto px-4 py-2 flex items-center justify-between gap-3 text-sm shrink-0 text-white ${
        active ? 'bg-emerald-600' : 'bg-amber-500'
      }`}
    >
      <span>
        {active ? 'Support mode' : 'Viewing franchise'}: <strong>{f.name}</strong> ·{' '}
        <span className="opacity-90">
          {active ? `editing enabled${until ? ` until ${until}` : ''}` : 'read-only'}
        </span>
      </span>
      <button
        type="button"
        onClick={exit}
        className="rounded bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-semibold transition-colors"
      >
        Exit franchise
      </button>
    </div>
  )
}
