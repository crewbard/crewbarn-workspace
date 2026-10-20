import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import type { FromJobs as FromJobsSummary } from '@/lib/referenceCards'
import { FromJobs } from './FromJobs'

type Part = { description: string; quantity: number | null; catalog_item_id: string | null }
type Answer = { note: string | null; parts: Part[]; minutes: number | null }
type Prompt = {
  enabled: boolean
  cards?: { id: string; title: string; from_jobs: FromJobsSummary }[]
  new_card?: { title: string; triggers: string[] } | null
  vehicle?: { label: string } | null
  parts?: Part[]
  answered?: Record<string, Answer>
}

const NEW = 'new'

/**
 * "What worked?" on the job page, for every trade.
 *
 * Shows when the job's words open one of the shop's cards (or name a
 * vehicle no card covers yet): what worked on past jobs first, so whoever
 * is about to do this one sees it, then a few fields to add this job's
 * answer. The phone app asks the same question at close-out; this is the
 * same thing for the office and anyone working from a computer.
 *
 * Nothing at all when Reference cards are switched off or the job opens no
 * card.
 */
export function WhatWorkedPanel({ workOrderId }: { workOrderId: string }) {
  const { isModuleEnabled } = useModuleVisibility()
  const on = isModuleEnabled('reference_cards')
  const queryClient = useQueryClient()

  const promptQ = useQuery({
    queryKey: ['what-worked', workOrderId],
    queryFn: () => apiRequest<{ data: Prompt }>(`/v1/work-orders/${workOrderId}/what-worked`),
    enabled: on,
    staleTime: 60_000,
  })
  const prompt = promptQ.data?.data
  const cards = prompt?.cards ?? []
  const newCard = prompt?.new_card ?? null

  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<string>('')
  const [note, setNote] = useState('')
  const [minutes, setMinutes] = useState('')
  const [picked, setPicked] = useState<Record<number, boolean>>({})
  const [saved, setSaved] = useState<string | null>(null)

  const chosen = target || cards[0]?.id || (newCard ? NEW : '')
  const parts = prompt?.parts ?? []

  const start = () => {
    const previous = prompt?.answered?.[chosen]
    setNote(previous?.note ?? '')
    setMinutes(previous?.minutes ? String(previous.minutes) : '')
    setPicked(Object.fromEntries(parts.map((_, i) => [i, true])))
    setSaved(null)
    setOpen(true)
  }

  const save = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { card_id: string }; message: string }>(`/v1/work-orders/${workOrderId}/what-worked`, {
        method: 'POST',
        body: JSON.stringify({
          ...(chosen === NEW ? { new_card: newCard } : { card_id: chosen }),
          note: note.trim() || null,
          parts: parts.filter((_, i) => picked[i]),
          minutes: minutes.trim() ? Number(minutes) : null,
        }),
      }),
    onSuccess: (res) => {
      setSaved(res.message)
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['what-worked', workOrderId] })
      void queryClient.invalidateQueries({ queryKey: ['reference-card', res.data.card_id] })
    },
  })

  if (!on || !prompt?.enabled || (cards.length === 0 && !newCard)) return null

  const nothingToSave = !note.trim() && !minutes.trim() && !parts.some((_, i) => picked[i])

  return (
    <section data-tour="job-what-worked" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">What worked</h2>

      {cards.map((card) => (
        <div key={card.id} className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-600">{card.title}</p>
          {card.from_jobs.jobs > 0 ? (
            <FromJobs fromJobs={card.from_jobs} />
          ) : (
            <p className="text-xs italic text-slate-500">No job has said what worked yet.</p>
          )}
        </div>
      ))}

      {cards.length === 0 && newCard && (
        <p className="mt-2 text-xs text-slate-600">
          No card for the {prompt.vehicle?.label ?? newCard.title} yet. Saving what worked starts one.
        </p>
      )}

      {saved && !open && <p className="mt-3 text-xs font-medium text-emerald-700">{saved}</p>}

      {!open ? (
        <button
          type="button"
          onClick={start}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:border-amber-400 hover:bg-amber-50"
        >
          {prompt.answered && prompt.answered[chosen] ? 'Change what worked on this job' : 'Add what worked on this job'}
        </button>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!nothingToSave) save.mutate()
          }}
        >
          {cards.length + (newCard ? 1 : 0) > 1 && (
            <label className="block text-xs font-medium text-slate-600">
              Which card
              <select
                value={chosen}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                {cards.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
                {newCard && <option value={NEW}>New card: {newCard.title}</option>}
              </select>
            </label>
          )}

          <label className="block text-xs font-medium text-slate-600">
            What worked
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. All keys lost: Autel IM608, PIN from the dealer, 40 minutes"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>

          {parts.length > 0 && (
            <fieldset>
              <legend className="text-xs font-medium text-slate-600">Parts it took</legend>
              <div className="mt-1 space-y-1">
                {parts.map((part, i) => (
                  <label key={`${part.description}-${i}`} className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={!!picked[i]}
                      onChange={(e) => setPicked({ ...picked, [i]: e.target.checked })}
                    />
                    <span className="min-w-0 truncate">{part.description}</span>
                    {part.quantity !== null && part.quantity !== 1 && <span className="text-xs text-slate-500">× {part.quantity}</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="block text-xs font-medium text-slate-600">
            Minutes it took <span className="font-normal text-slate-400">(optional)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="mt-1 w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>

          {save.isError && <p className="text-xs text-red-700">{(save.error as ApiError)?.message || 'Could not save that.'}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={nothingToSave || save.isPending}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Save on the card'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
