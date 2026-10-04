import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { photoGuidance } from '@/lib/photoGuidance'

type Result = { parts: { part_number: string; description: string | null; fits: string | null; caution: string | null; source: string; inventory: { id: string; name: string; sku: string; available: number }[] }[]; needed_evidence: string | null }

export function PhotoPartResearch({ messageId, url, subject = '' }: { messageId: string; url: string; subject?: string }) {
  const id = useId()
  const [correction, setCorrection] = useState('')
  const lookup = useMutation({ mutationFn: () => apiRequest<{ data: Result & { vehicle?: { year: string; make: string; model: string } | null } }>(`/v1/comms/messages/${encodeURIComponent(messageId)}/photo-parts`, { method: 'POST', body: { url, correction } }) })
  const result = lookup.data?.data
  return <section className="space-y-3 border-t border-slate-200 pt-5 text-sm">
    <h3 className="font-bold">Find possible parts</h3>
    <p className="text-xs text-slate-500">Research this photo and conversation on the web, then check your inventory. Uses your Anthropic AI account; charges may apply. Results stay here.</p>
    <button type="button" disabled={lookup.isPending} onClick={() => lookup.mutate()} className="rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{lookup.isPending ? 'Researching web, then checking inventory…' : 'Search web → check inventory'}</button>
    <label htmlFor={id} className="block font-medium">Correct or add details for CBI</label>
    <textarea id={id} value={correction} onChange={e => setCorrection(e.target.value)} maxLength={1000} disabled={lookup.isPending} placeholder={photoGuidance(subject)} className="w-full rounded-lg border border-slate-300 p-2" />
    <p className="text-xs text-slate-500">Details apply to your next search. Use Teach CBI below to save approved learning.</p>
    {lookup.isError && <p role="status" className="rounded-lg bg-slate-50 p-3">No part match yet. The lookup could not complete. Check your AI connection or access, add details, and try again.</p>}
    {result && <div aria-live="polite" className="space-y-3">
      {result.vehicle && <p className="rounded-lg bg-slate-50 p-3">VIN identifies: <strong>{result.vehicle.year} {result.vehicle.make} {result.vehicle.model}</strong> · NHTSA</p>}
      {!result.parts.length && <p>No part match yet. Correct the details above and search again.</p>}
      {result.parts.map((part, i) => <article key={`${part.part_number}-${i}`} className="space-y-2 rounded-lg border border-slate-200 p-3">
        <p className="text-xs font-semibold text-amber-800">Possible match — fitment unverified</p>
        <p className="font-mono font-bold">{part.part_number}</p><p>{part.description}</p>
        {part.fits && <p>Listed application: {part.fits}</p>}{part.caution && <p className="text-amber-800">{part.caution}</p>}
        <p className="text-xs text-slate-500">Web source: {part.source}</p>
        {part.inventory.length ? part.inventory.map(item => <p key={item.id} className="rounded bg-slate-50 p-2">Inventory: {item.name} · {item.sku} · {item.available} available</p>) : <p className="text-slate-500">No exact part-number match in your inventory.</p>}
      </article>)}
      {result.needed_evidence && <p className="rounded-lg bg-amber-50 p-3">To narrow this down: {result.needed_evidence}</p>}
    </div>}
  </section>
}
