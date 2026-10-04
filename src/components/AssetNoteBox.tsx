import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { assetHistoryKeys } from '@/hooks/useAssetHistory'

/**
 * Writing down what somebody knows about a piece of equipment.
 *
 * The asset already has a `notes` field and it is one box that the next
 * person to open the form overwrites — so it cannot hold a history, and
 * nobody writes anything worth keeping in it. This adds to the item's
 * record instead: dated, attributed, and sitting in the same timeline as
 * the visits it explains.
 *
 * **Not shown to the customer unless it is ticked.** A note is written in
 * the words one tech uses to another, and the building's tenants can open
 * the page behind a scanned label. The tick is there because sometimes
 * the note IS for them ("new key issued to the site manager"), and it is
 * off until somebody decides that.
 */
export function AssetNoteBox({ assetId }: { assetId: string }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [shared, setShared] = useState(false)

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim()

      /*
       * The summary column holds 200 characters and is what the
       * timeline row shows. Anything longer is not truncated away — the
       * first line stands as the summary and the whole note goes in the
       * details, so nothing a tech typed is lost.
       */
      const summary = trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed

      await apiRequest(`/v1/assets/${encodeURIComponent(assetId)}/notes`, {
        method: 'POST',
        body: {
          // Minted here so a double-click, or a retry after a dropped
          // reply, is the same note rather than two.
          client_uuid: crypto.randomUUID(),
          summary,
          details: trimmed.length > 200 ? trimmed : null,
          visibility: shared ? 'public' : 'internal',
        },
      })
    },
    onSuccess: () => {
      setText('')
      setShared(false)
      void queryClient.invalidateQueries({ queryKey: assetHistoryKeys.detail(assetId) })
    },
  })

  const empty = text.trim() === ''

  return (
    <div className="border border-slate-200 rounded-md p-3 bg-white">
      <label htmlFor={`note-${assetId}`} className="block text-xs font-medium text-slate-700 mb-1.5">
        Add a note
      </label>
      <textarea
        id={`note-${assetId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="What the next person needs to know about this one."
        className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />

      <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show this to the customer
        </label>

        <button
          type="button"
          disabled={empty || save.isPending}
          onClick={() => save.mutate()}
          className="text-sm px-3 py-1.5 rounded bg-amber-600 text-white font-medium disabled:bg-slate-200 disabled:text-slate-400"
        >
          {save.isPending ? 'Saving…' : 'Save note'}
        </button>
      </div>

      {!shared && !empty && (
        <p className="text-xs text-slate-500 mt-1.5">
          Stays with your team. Nothing on the customer&rsquo;s page or a scanned label.
        </p>
      )}

      {save.isError && (
        <p className="text-xs text-red-700 mt-1.5">
          {save.error instanceof Error ? save.error.message : 'Could not save that note.'}
        </p>
      )}
    </div>
  )
}
