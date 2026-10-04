import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

type Contact = { manufacturer: string; phone: string | null; address: string | null; source_url: string; checked_at: string }

export function ManufacturerContact({ messageId, suggestedName }: { messageId: string; suggestedName?: string | null }) {
  const id = useId()
  const [name, setName] = useState(suggestedName ?? '')
  const lookup = useMutation({
    mutationFn: (manufacturer: string) => apiRequest<{ data: Contact }>(`/v1/comms/messages/${encodeURIComponent(messageId)}/manufacturer-contact`, { method: 'POST', body: { manufacturer } }),
  })
  const contact = lookup.data?.data
  return <section className="space-y-3 border-t border-slate-200 pt-5 text-sm">
    <h3 className="font-bold text-slate-900">Manufacturer contact</h3>
    <p className="text-xs leading-relaxed text-slate-500">Confirm the manufacturer—not a dealer or certification company. Uses your AI account for a web lookup; charges may apply. Currently requires Anthropic.</p>
    <form onSubmit={e => { e.preventDefault(); if (name.trim() && !lookup.isPending) lookup.mutate(name.trim()) }} className="space-y-2">
      <label htmlFor={id} className="block font-medium">Manufacturer name</label>
      <input id={id} value={name} onChange={e => { setName(e.target.value); lookup.reset() }} maxLength={120} disabled={lookup.isPending} placeholder="Brand or manufacturer shown on the item or label" className="w-full rounded-lg border border-slate-300 p-2.5" />
      <button disabled={!name.trim() || lookup.isPending} className="rounded-lg border border-amber-300 px-3 py-2 font-semibold text-amber-800 disabled:opacity-50">{lookup.isPending ? 'Looking up official contact…' : 'Find phone & address'}</button>
    </form>
    {lookup.isError && <p role="alert" className="text-red-700">{lookup.error.message}</p>}
    {contact && <div role="status" className="space-y-2 rounded-lg bg-slate-50 p-3 break-words">
      <p className="font-semibold">{contact.manufacturer}</p>
      <p><span className="font-medium">Phone:</span> {contact.phone || 'Not found in source'}</p>
      <p className="whitespace-pre-line"><span className="font-medium">Address:</span> {contact.address || 'Not found in source'}</p>
      <a href={contact.source_url} target="_blank" rel="noopener noreferrer" className="inline-block text-amber-800 underline">Check contact source ↗</a>
      <p className="text-xs text-slate-500">Looked up {new Date(contact.checked_at).toLocaleString()}. Check the source before calling or shipping anything.</p>
    </div>}
  </section>
}
