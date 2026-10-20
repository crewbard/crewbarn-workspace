/**
 * Inventory › Bins › Select › Add rows: rows into every ticked bin at once,
 * for real (POST /v1/inventory-bins/bulk-add-rows). Hands back what was made
 * so the Bins screen can offer Undo.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { inventoryBinKeys } from '@/hooks/useInventoryBins'
import { nextCodes, rowTargets } from '@/lib/structureDraft'
import { bulkAddRows, type CreatedPlaces } from '@/lib/structureTemplates'
import type { BinTree } from '@/lib/binTree'
import { AddRowsDialog } from './AddRowsDialog'

export function BulkAddRowsModal({ tree, ids, onClose, onDone }: {
  tree: BinTree
  ids: string[]
  onClose: () => void
  onDone: (created: CreatedPlaces, text: string) => void
}) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Ticking a rack ticks everything in it: rows go into the innermost places.
  const targets = rowTargets(tree, ids)
  const first = tree.nodes.get(targets[0] ?? '')

  return (
    <AddRowsDialog
      targets={targets.length}
      busy={busy}
      error={error}
      example={(c) => {
        if (!first) return null
        const have = first.children.map((k) => tree.nodes.get(k)?.code ?? '')
        const next = nextCodes(have, Math.min(c.count, 6), c.mode)
        return `${first.code || first.label}${have.length ? ` has ${have.slice(0, 4).join(', ')}${have.length > 4 ? '…' : ''}, so it` : ''} gets ${next.join(', ')}${c.count > 6 ? '…' : ''}`
      }}
      onClose={onClose}
      onSubmit={async (c) => {
        setBusy(true)
        setError(null)
        try {
          const made = await bulkAddRows({ bin_ids: targets, count: c.count, mode: c.mode, capacity: c.capacity })
          await qc.invalidateQueries({ queryKey: inventoryBinKeys.all })
          onDone(made, `Added ${made.created_count} rows to ${targets.length} ${targets.length === 1 ? 'place' : 'places'}`)
          onClose()
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not add the rows. Try again.')
        } finally {
          setBusy(false)
        }
      }}
    />
  )
}
