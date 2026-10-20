import { createContext, useContext } from 'react'
import { emptyDraft, type Draft } from '@/lib/referenceCards'

/**
 * The job or estimate a page is about, so a flash card can offer to put the
 * part on it. A page that has one wraps its content in FlashWordsContext.
 */
export type FlashContextValue = {
  job?: { id: string; label: string }
  estimate?: { id: string; label: string }
}

export const FlashWordsContext = createContext<FlashContextValue>({})

export function useFlashContext(): FlashContextValue {
  return useContext(FlashWordsContext)
}

/** A new card for a part number, ready to fill in. */
export function draftForPart(term: string, name?: string | null): Draft {
  const d = emptyDraft()
  const word = term.trim()
  d.title = (name ?? '').trim() || word
  d.partNumbers = word ? [word] : []
  d.triggers = word.length >= 3 ? [word] : []
  return d
}
