import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IconCopy, IconPlug, IconTrash } from '@tabler/icons-react'
import { apiRequest } from '@/lib/api'

type Connection = { id: string; client_name: string; email: string; last_used_at: string | null; created_at: string }
type ConnectorList = { oauth_connections: Connection[]; mcp_url: string }

export function AiConnectorSettingsCard() {
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['settings', 'ai', 'connectors'], queryFn: () => apiRequest<ConnectorList>('/v1/settings/ai/connectors') })
  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/settings/ai/connectors/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'ai', 'connectors'] }),
  })
  const copy = (value: string) => navigator.clipboard.writeText(value)

  return <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-start gap-3"><IconPlug className="mt-0.5 h-5 w-5 text-orange-600" /><div><h2 className="text-lg font-semibold text-slate-900">Read-only AI connector</h2><p className="mt-1 text-sm text-slate-600">Use this address in Claude or another OAuth-compatible MCP client. CrewBarn sign-in and a fresh 2FA code determine the tenant, person, role, and permissions.</p></div></div>
    {list.data?.mcp_url && <div className="mt-5 flex items-center gap-2 text-sm"><span className="font-medium text-slate-700">MCP URL</span><code className="min-w-0 flex-1 overflow-x-auto rounded bg-slate-100 px-3 py-2 text-xs">{list.data.mcp_url}</code><button className="rounded-md border border-slate-300 p-2" title="Copy MCP URL" onClick={() => copy(list.data!.mcp_url)}><IconCopy className="h-4 w-4" /></button></div>}
    <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-600"><li>Paste the MCP URL into the AI provider's custom connector screen.</li><li>Leave OAuth Client ID and Client Secret blank when dynamic registration is supported.</li><li>Sign into CrewBarn, review the tenant and role, then enter a current 2FA code.</li></ol>
    <h3 className="mt-6 text-sm font-semibold text-slate-900">Connected AI applications</h3>
    <div className="mt-2 divide-y divide-slate-200 border-t border-slate-200">{list.data?.oauth_connections.length ? list.data.oauth_connections.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{item.client_name}</p><p className="text-xs text-slate-500">{item.email}{item.last_used_at ? ` · Used ${new Date(item.last_used_at).toLocaleString()}` : ` · Connected ${new Date(item.created_at).toLocaleString()}`}</p></div><button className="rounded-md border border-red-200 p-2 text-red-700" title="Revoke connector" onClick={() => revoke.mutate(item.id)}><IconTrash className="h-4 w-4" /></button></div>) : <p className="py-4 text-sm text-slate-500">No OAuth applications connected.</p>}</div>
  </section>
}
