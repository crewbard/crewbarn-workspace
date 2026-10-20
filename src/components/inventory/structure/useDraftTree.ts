import { useMemo } from 'react'
import { buildBinTree, type BinTree } from '@/lib/binTree'
import { draftToTreeBins, findNode, type DraftNode } from '@/lib/structureDraft'

/** The pretend location the drawing hangs off. */
export const DRAFT_LOCATION = '__draft__'

/** The draft as the Bins screen's own tree, so the canvas draws it with the real tiles. */
export function useDraftTree(draft: readonly DraftNode[], locationName: string): BinTree {
  return useMemo(
    () => buildBinTree([{ id: DRAFT_LOCATION, name: locationName }], draftToTreeBins(draft, DRAFT_LOCATION, locationName), {}),
    [draft, locationName],
  )
}

/** Remount the editor when the place, or what it says, changes underneath it (Undo). */
export function tileEditorKey(draft: readonly DraftNode[], key: string): string {
  const n = findNode(draft, key)?.node
  return n ? `${key}|${n.name}|${n.code}|${n.capacity ?? ''}` : key
}
