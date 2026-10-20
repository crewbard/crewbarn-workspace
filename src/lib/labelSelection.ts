import type { LabelFaceData } from '@/components/labels/LabelFace'

/**
 * Choosing which labels print, on the Print labels screen.
 *
 * Every label starts chosen, so the screen prints exactly what it printed
 * before unless somebody unticks some. What is remembered is the set of
 * labels taken OUT, by a key built from the label itself, so switching
 * "what gets a label" or "also label what's stored here" doesn't shift the
 * ticks onto different labels the way remembering positions would.
 *
 * Everything here is plain functions, so the rules can be tested without a
 * browser.
 */

/** A key per label: its QR and name, plus a count for exact repeats. */
export function faceKeys(faces: ReadonlyArray<Pick<LabelFaceData, 'qrValue' | 'name'>>): string[] {
  const seen = new Map<string, number>()
  return faces.map((f) => {
    const base = `${f.qrValue}\u0000${f.name}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return `${base}\u0000${n}`
  })
}

/** Positions of the chosen labels, in print order. */
export function selectedIndices(keys: readonly string[], excluded: ReadonlySet<string>): number[] {
  const out: number[] = []
  keys.forEach((k, i) => {
    if (!excluded.has(k)) out.push(i)
  })
  return out
}

/**
 * Only the chosen items, in their original order. No list (an older caller)
 * means everything, which is what the screen printed before choosing existed.
 */
export function pickSelected<T>(items: readonly T[], selected?: readonly number[] | null): T[] {
  if (!selected) return [...items]
  const keep = new Set(selected)
  return items.filter((_, i) => keep.has(i))
}

/** Tick or untick a set of labels, by position. Returns a new set. */
export function setChosen(
  excluded: ReadonlySet<string>,
  keys: readonly string[],
  indices: Iterable<number>,
  on: boolean,
): Set<string> {
  const next = new Set(excluded)
  for (const i of indices) {
    const k = keys[i]
    if (k === undefined) continue
    if (on) next.delete(k)
    else next.add(k)
  }
  return next
}

/**
 * Shift-click: every label shown between the last one clicked and this one,
 * inclusive, gets the same tick as this one is getting. `shown` is the list
 * on screen (a search can hide some), in screen order.
 */
export function rangeBetween(shown: readonly number[], anchor: number, target: number): number[] {
  const a = shown.indexOf(anchor)
  const b = shown.indexOf(target)
  if (a < 0 || b < 0) return [target]
  const [from, to] = a <= b ? [a, b] : [b, a]
  return shown.slice(from, to + 1)
}

/** Does a label match what was typed in the search box? Every word must appear. */
export function matchesFilter(face: LabelFaceData, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const hay = [face.name, face.code, face.tag, face.path, face.note].filter(Boolean).join(' ').toLowerCase()
  return words.every((w) => hay.includes(w))
}

const PATH_SPLIT = /\s*(?:\/|›|\u203a|>)\s*/

/** "Melbourne Shop / Rack 1 / Shelf 2" → ["Melbourne Shop", "Rack 1", "Shelf 2"]. */
export function pathParts(path: string | undefined): string[] {
  return (path ?? '').split(PATH_SPLIT).map((s) => s.trim()).filter(Boolean)
}

export interface LabelGroup {
  id: string
  label: string
  indices: number[]
}

/**
 * Ways to pick many labels at once: every label of one type ("All ROW
 * labels"), and everything inside one place ("Inside Melbourne Shop / Rack 1").
 * Only groups that are a real subset are offered: a group holding every
 * label is the same as Select all.
 */
export function labelGroups(faces: readonly LabelFaceData[], maxPlaces = 60): LabelGroup[] {
  const total = faces.length
  const byTag = new Map<string, number[]>()
  const byPlace = new Map<string, number[]>()
  faces.forEach((f, i) => {
    const tag = (f.tag ?? '').trim()
    if (tag) {
      const key = tag.toUpperCase()
      byTag.set(key, [...(byTag.get(key) ?? []), i])
    }
    const parts = pathParts(f.path)
    // Every place above the label itself, so "Rack 1" holds its shelves' bins too.
    for (let depth = 1; depth < parts.length; depth++) {
      const place = parts.slice(0, depth).join(' / ')
      byPlace.set(place, [...(byPlace.get(place) ?? []), i])
    }
  })
  const out: LabelGroup[] = []
  for (const [tag, indices] of byTag) {
    if (indices.length < total) {
      out.push({ id: `tag:${tag}`, label: `Every ${tag.toLowerCase()} label (${indices.length})`, indices })
    }
  }
  const places = [...byPlace.entries()]
    .filter(([, indices]) => indices.length > 1 && indices.length < total)
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .slice(0, maxPlaces)
  for (const [place, indices] of places) {
    out.push({ id: `place:${place}`, label: `Inside ${place} (${indices.length})`, indices })
  }
  return out
}

/**
 * Print CSS that leaves the unchosen labels out of the page's printable copy
 * (the `.print-stage` some pages hand to the browser's own print window).
 *
 * That copy draws its cards in the same order as the faces, `perFace` cards
 * each (a page that repeats a card per copy). Nothing is written when every
 * label is chosen. The last card that does print stops forcing a page break
 * after it, so a roll doesn't feed one blank label at the end.
 */
export function printStageSelectionCss(faceCount: number, selected: readonly number[], perFace = 1): string {
  if (faceCount === 0 || selected.length === faceCount) return ''
  const per = Math.max(1, Math.floor(perFace))
  const keep = new Set(selected)
  const hidden: string[] = []
  let lastShown = 0
  for (let face = 0; face < faceCount; face++) {
    for (let c = 0; c < per; c++) {
      const child = face * per + c + 1
      if (keep.has(face)) lastShown = child
      else hidden.push(`.print-stage > * > :nth-child(${child})`)
    }
  }
  const rules = [`${hidden.join(',\n')} { display: none !important; }`]
  if (lastShown > 0) {
    rules.push(
      `.print-stage > * > :nth-child(${lastShown}) { page-break-after: auto !important; break-after: auto !important; }`,
    )
  }
  return `@media print {\n${rules.join('\n')}\n}`
}

/** How many labels fit across, at least one. */
export function columnsFor(width: number, cellWidth: number, gap: number): number {
  if (!(width > 0) || !(cellWidth > 0)) return 1
  return Math.max(1, Math.floor((width + gap) / (cellWidth + gap)))
}

/**
 * Which rows of the grid to actually draw: the ones in view plus a few
 * either side. Hundreds of QR codes drawn at once freeze the page; a screen
 * only ever shows a dozen rows.
 */
export function visibleRows(opts: {
  count: number
  columns: number
  rowHeight: number
  scrollTop: number
  viewport: number
  overscan?: number
}): { first: number; last: number; rows: number } {
  const columns = Math.max(1, opts.columns)
  const rows = Math.ceil(opts.count / columns)
  if (rows === 0 || !(opts.rowHeight > 0)) return { first: 0, last: -1, rows }
  const overscan = opts.overscan ?? 2
  const viewport = opts.viewport > 0 ? opts.viewport : opts.rowHeight * 6
  const first = Math.max(0, Math.floor(opts.scrollTop / opts.rowHeight) - overscan)
  const last = Math.min(rows - 1, Math.ceil((opts.scrollTop + viewport) / opts.rowHeight) + overscan)
  return { first, last, rows }
}
