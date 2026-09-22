import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

export interface TeamNoteAck {
  account_id: string
  name: string
  at: string
}

export interface TeamNote {
  id: string
  content: string
  color: 'yellow' | 'blue' | 'green' | 'pink'
  pinned_until: string | null
  target_account_ids: string[] | null
  created_at: string
  author: { id: string; name: string } | null
  acknowledged_by?: TeamNoteAck[]
  acknowledged?: boolean
}

export function useTeamNotes() {
  return useQuery({
    queryKey: ['team-notes'],
    queryFn: () => apiRequest<{ data: TeamNote[] }>('/v1/team-notes'),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    select: (r) => r.data ?? [],
  })
}

export function useCreateTeamNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { content: string; color?: string; pinned_until?: string; target_account_ids?: string[] }) =>
      apiRequest<{ data: TeamNote }>('/v1/team-notes', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['team-notes'] }),
  })
}

export function useDeleteTeamNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/v1/team-notes/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['team-notes'] }),
  })
}
