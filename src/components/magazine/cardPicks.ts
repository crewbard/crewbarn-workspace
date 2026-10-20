import { looksLikePartNumber, type PartOnPage } from './partNumbers'
import type { Box } from './pdfBook'

/*
 * What a part picked off a catalog page becomes: the selection on the
 * page, and what the card editor is opened with.
 */

/** What was picked on the page. */
export type CardSelection = {
  page: number
  box: Box
  /** The part number pressed, or the first one inside the box. */
  partNumber: string
  /** The words around it: its name, usually. */
  text: string[]
}

/** What the card editor is opened with. */
export type CardPrefill = {
  partNumber: string
  name: string
  about: string
  page: number
  pageLabel: string
  picture: Blob | null
}

/** A pressed part number as a selection: its row, a little either side, makes the picture. */
export function selectionFromPart(page: number, part: PartOnPage): CardSelection {
  const padX = 0.06
  const padY = 0.03
  const left = Math.max(0, part.box.left - padX)
  const top = Math.max(0, part.box.top - padY)
  return {
    page,
    partNumber: part.text,
    text: part.line ? [part.line] : [],
    box: {
      left,
      top,
      width: Math.min(1 - left, part.box.width + padX * 2 + 0.25),
      height: Math.min(1 - top, part.box.height + padY * 2),
    },
  }
}

/** The first part number in some lines of text, and the words that are not it. */
export function splitPartNumber(lines: string[]): { partNumber: string; name: string } {
  for (const line of lines) {
    for (const m of line.matchAll(/[A-Za-z0-9][A-Za-z0-9./-]*[A-Za-z0-9]/g)) {
      if (looksLikePartNumber(m[0])) {
        const rest = lines.join(' ').replace(m[0], ' ').replace(/\s+/g, ' ').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '')
        return { partNumber: m[0], name: rest }
      }
    }
  }
  return { partNumber: '', name: lines.join(' ').replace(/\s+/g, ' ').trim() }
}
