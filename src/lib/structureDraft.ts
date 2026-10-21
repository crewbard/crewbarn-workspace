/**
 * Build a storage structure, as plain data: the layers the shop describes,
 * the draft tree they produce (what the tile canvas draws), and every edit
 * the canvas makes to it. No React, so the rules are tested on their own
 * (scripts/structure-builder.test.mjs).
 *
 * Two forms, one draft:
 *   - Layers: every shelf alike, "2 racks x 4 shelves x 10 bins". Generated
 *     here exactly the way the server's InventoryStructureBuilder does it, so
 *     the canvas shows the codes the server will create.
 *   - A tweaked tree: once a single tile is changed (renamed, more rows, a
 *     copied shelf), the draft is kept as a tree and sent as `tree`.
 *
 * Codes follow the Bins screen's rule (nextChildCode in lib/binTree.ts):
 * unique among siblings, and the next one carries on their pattern.
 */
import { alphaLabel, nextChildCode, nodeType, type BinTree, type TreeBin } from './binTree'

export type Mode = 'num' | 'pad' | 'alpha'

export interface Layer {
  id: string
  name: string
  count: number
  mode: Mode
  prefix: string
  stock: boolean
  /** Units each one fits. Only used for layers that hold stock. */
  capacity?: number | null
}

export interface DraftNode {
  key: string
  code: string
  name: string
  kind: string
  holdsStock: boolean
  capacity: number | null
  children: DraftNode[]
}

/** The tree the API takes (structure-apply `tree`, templates `tree`). */
export interface ApiTreeNode {
  code: string
  name?: string | null
  kind?: string | null
  holds_stock?: boolean
  capacity?: number | null
  children?: ApiTreeNode[]
}

export const MAX_LAYERS = 8
export const MAX_PER_LAYER = 60
/** Same ceiling as the server's StructureShape::MAX_NODES for a tree. */
export const MAX_TREE_NODES = 5000

let seq = 0
export const newKey = (p = 'd') => `${p}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 1,2,3 · 01,02 · A,B,C (AA after Z). The server's label() twin. */
export function layerLabel(mode: Mode, index: number, count: number): string {
  if (mode === 'pad') return String(index).padStart(Math.max(2, String(count).length), '0')
  if (mode === 'alpha') return alphaLabel(index)
  return String(index)
}

/** The draft the layers produce: each layer repeated under every place above it. */
export function generateDraft(layers: readonly Layer[]): DraftNode[] {
  const clean = layers.filter((l) => l.name.trim() !== '')
  const build = (depth: number): DraftNode[] => {
    const layer = clean[depth]
    if (!layer) return []
    const count = Math.max(1, Math.min(MAX_PER_LAYER, Math.floor(layer.count) || 1))
    const name = layer.name.trim().slice(0, 40)
    const out: DraftNode[] = []
    for (let i = 1; i <= count; i++) {
      out.push({
        key: newKey(),
        code: layer.prefix.trim().slice(0, 20) + layerLabel(layer.mode, i, count),
        name: `${name} ${i}`,
        kind: name,
        holdsStock: layer.stock,
        capacity: layer.stock && layer.capacity && layer.capacity > 0 ? Math.floor(layer.capacity) : null,
        children: build(depth + 1),
      })
    }
    return out
  }
  return build(0)
}

/** How many places a set of layers makes, without building them. */
export function layerTotal(layers: readonly Layer[]): number {
  let total = 0
  let product = 1
  for (const l of layers) {
    if (!l.name.trim()) continue
    product *= Math.max(1, Math.min(MAX_PER_LAYER, Math.floor(l.count) || 1))
    total += product
  }
  return total
}

// ------------------------------------------------------------- reading ----

export function countDraft(nodes: readonly DraftNode[]): number {
  let n = 0
  const stack = [...nodes]
  while (stack.length) {
    const x = stack.pop()!
    n++
    stack.push(...x.children)
  }
  return n
}

export interface FoundNode {
  node: DraftNode
  parent: DraftNode | null
  siblings: DraftNode[]
  index: number
  /** Codes from the top down to this node. */
  path: string[]
}

export function findNode(nodes: readonly DraftNode[], key: string): FoundNode | null {
  const walk = (list: DraftNode[], parent: DraftNode | null, path: string[]): FoundNode | null => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i]
      const p = [...path, n.code]
      if (n.key === key) return { node: n, parent, siblings: list, index: i, path: p }
      const hit = walk(n.children, n, p)
      if (hit) return hit
    }
    return null
  }
  return walk(nodes as DraftNode[], null, [])
}

/** "R1-S3-BIN-05": how a place's full code reads on a label. */
export function codePath(path: readonly string[]): string {
  return path.join('-')
}

export interface LevelSummary {
  depth: number
  kind: string
  count: number
  first: string
  last: string
  /** Lowest and highest "fits" among places that hold stock; null when none set. */
  fits: { min: number; max: number } | null
  holdsStock: boolean
  /** Places at this level that hold stock but have no "fits". */
  withoutFits: number
}

/**
 * One line per level, for the inline "R1-S1-BIN-01 → R2-S4-BIN-10 · fits 20"
 * under each layer card. Read from the draft, so tile tweaks show too.
 */
export function levelSummaries(nodes: readonly DraftNode[]): LevelSummary[] {
  const out: LevelSummary[] = []
  const walk = (list: readonly DraftNode[], depth: number, path: string[]) => {
    for (const n of list) {
      const p = [...path, n.code]
      let s = out[depth]
      if (!s) {
        s = out[depth] = { depth, kind: n.kind, count: 0, first: codePath(p), last: codePath(p), fits: null, holdsStock: false, withoutFits: 0 }
      }
      s.count++
      s.last = codePath(p)
      if (n.holdsStock) {
        s.holdsStock = true
        if (n.capacity != null) {
          s.fits = s.fits ? { min: Math.min(s.fits.min, n.capacity), max: Math.max(s.fits.max, n.capacity) } : { min: n.capacity, max: n.capacity }
        } else {
          s.withoutFits++
        }
      }
      walk(n.children, depth + 1, p)
    }
  }
  walk(nodes, 0, [])
  return out
}

/** "R1-S1-BIN-01 → R2-S4-BIN-10 · fits 20 · 80 in all" */
export function levelLine(s: LevelSummary): string {
  const range = s.count === 1 || s.first === s.last ? s.first : `${s.first} → ${s.last}`
  const parts = [range]
  if (s.fits) parts.push(s.fits.min === s.fits.max ? `fits ${s.fits.min}` : `fits ${s.fits.min}–${s.fits.max}`)
  parts.push(`${s.count.toLocaleString('en-US')} in all`)
  return parts.join(' · ')
}

// ------------------------------------------------------------- editing ----
// Every edit returns a new tree; the old one is the Undo.

function mapNode(nodes: readonly DraftNode[], key: string, fn: (n: DraftNode) => DraftNode | null): DraftNode[] {
  const out: DraftNode[] = []
  for (const n of nodes) {
    if (n.key === key) {
      const next = fn(n)
      if (next) out.push(next)
      continue
    }
    out.push(n.children.length ? { ...n, children: mapNode(n.children, key, fn) } : n)
  }
  return out
}

function mapChildrenOf(nodes: readonly DraftNode[], parentKey: string | null, fn: (kids: DraftNode[]) => DraftNode[]): DraftNode[] {
  if (parentKey === null) return fn([...nodes])
  return mapNode(nodes, parentKey, (n) => ({ ...n, children: fn([...n.children]) }))
}

/** Why a code can't be used here, or null when it can. */
export function codeProblem(nodes: readonly DraftNode[], key: string, code: string): string | null {
  const c = code.trim()
  if (!c) return 'Give it a code. It goes on the label.'
  if (c.length > 100) return 'Keep the code under 100 characters.'
  const found = findNode(nodes, key)
  if (!found) return null
  const clash = found.siblings.find((s) => s.key !== key && s.code.trim().toLowerCase() === c.toLowerCase())
  if (clash) return `${clash.name || clash.code} already uses ${c} here. Codes next to each other must differ.`
  return null
}

export interface NodePatch {
  name?: string
  code?: string
  kind?: string
  holdsStock?: boolean
  capacity?: number | null
}

/** Change one place. A code that clashes with a neighbour is refused (returns the tree unchanged). */
export function patchNode(nodes: readonly DraftNode[], key: string, patch: NodePatch): DraftNode[] {
  if (patch.code !== undefined && codeProblem(nodes, key, patch.code)) return nodes as DraftNode[]
  return mapNode(nodes, key, (n) => {
    const next = { ...n, ...patch }
    if (patch.code !== undefined) next.code = patch.code.trim()
    if (patch.holdsStock === false) next.capacity = null
    if (next.capacity != null && (!Number.isFinite(next.capacity) || next.capacity < 1)) next.capacity = null
    return next
  })
}

/** "Rack 1" with R1 -> R3 becomes "Rack 3". The server's renumberName twin. */
export function renumberName(name: string, oldCode: string, newCode: string): string {
  const o = /(\d+)$/.exec(oldCode)
  const nn = /(\d+)$/.exec(newCode)
  const m = /^(.*\s)0*(\d+)$/.exec(name)
  if (o && nn && m && Number(m[2]) === Number(o[1])) return `${m[1]}${Number(nn[1])}`
  if (name.endsWith(` ${oldCode}`)) return name.slice(0, name.length - oldCode.length) + newCode
  return name
}

function cloneWithNewKeys(n: DraftNode): DraftNode {
  return { ...n, key: newKey(), children: n.children.map(cloneWithNewKeys) }
}

/** The code the next sibling gets: the pattern's next, else "<code>-2", "-3"… */
export function nextSiblingCode(codes: readonly string[], like: string): string {
  const next = nextChildCode([...codes, like])
  if (next) return next
  const taken = new Set(codes.map((c) => c.toLowerCase()))
  for (let i = 2; i < 10000; i++) {
    const t = `${like}-${i}`
    if (!taken.has(t.toLowerCase())) return t
  }
  return `${like}-${Date.now().toString(36)}`
}

/**
 * "Add another shelf like this one": a copy of the place with its bins, rows
 * and capacity, right after the last of its neighbours, with the next code.
 * Returns the new tree and the copy's key.
 */
export function copyAsSibling(nodes: readonly DraftNode[], key: string): { nodes: DraftNode[]; copyKey: string | null; code: string | null } {
  const found = findNode(nodes, key)
  if (!found) return { nodes: nodes as DraftNode[], copyKey: null, code: null }
  const code = nextSiblingCode(found.siblings.map((s) => s.code), found.node.code)
  const copy = { ...cloneWithNewKeys(found.node), code, name: renumberName(found.node.name, found.node.code, code) }
  const next = mapChildrenOf(nodes, found.parent?.key ?? null, (kids) => [...kids, copy])
  return { nodes: next, copyKey: copy.key, code }
}

export function removeNode(nodes: readonly DraftNode[], key: string): DraftNode[] {
  return mapNode(nodes, key, () => null)
}

/** The word for a place's rows: what most of its children are, else "Row". */
export function rowKindOf(n: DraftNode): string {
  const counts = new Map<string, number>()
  for (const c of n.children) counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1)
  let best = 'Row'
  let bestN = 0
  for (const [k, v] of counts) if (v > bestN) { best = k; bestN = v }
  return best
}

/**
 * The next `count` codes after the existing ones. With no pattern to follow,
 * numbered by mode (A,B,C / 1,2,3 / 01,02), skipping anything taken. The
 * server's StructureShape::nextCodes twin.
 */
export function nextCodes(existing: readonly string[], count: number, mode: Mode = 'alpha'): string[] {
  const codes = existing.map((c) => c.trim()).filter(Boolean)
  const out: string[] = []
  const usePattern = codes.length > 0 && nextChildCode(codes) !== null
  const taken = new Set(codes.map((c) => c.toUpperCase()))
  let k = 0
  for (let i = 0; i < count; i++) {
    let next: string
    if (usePattern) {
      next = nextChildCode([...codes, ...out])!
    } else {
      do {
        k++
        next = mode === 'alpha' ? layerLabel('alpha', k, count) : mode === 'pad' ? String(k).padStart(Math.max(2, String(count).length), '0') : String(k)
      } while (taken.has(next.toUpperCase()))
    }
    taken.add(next.toUpperCase())
    out.push(next)
  }
  return out
}

export interface RowOptions {
  mode?: Mode
  kind?: string
  capacity?: number | null
}

function makeRows(parent: DraftNode, count: number, opts: RowOptions): DraftNode[] {
  const kind = opts.kind?.trim() || rowKindOf(parent)
  const codes = nextCodes(parent.children.map((c) => c.code), count, opts.mode ?? 'alpha')
  const like = parent.children.find((c) => c.kind === kind)
  return codes.map((code, i) => ({
    key: newKey(),
    code,
    // Named by position, the way the builder and the server name them.
    name: `${kind} ${parent.children.length + i + 1}`,
    kind,
    holdsStock: like ? like.holdsStock : true,
    capacity: opts.capacity !== undefined ? opts.capacity : (like?.capacity ?? null),
    children: [],
  }))
}

/** Add rows inside each of these places, after the rows they already have. */
export function addRows(nodes: readonly DraftNode[], keys: readonly string[], count: number, opts: RowOptions = {}): DraftNode[] {
  let next = nodes as DraftNode[]
  const n = Math.max(1, Math.min(MAX_PER_LAYER, Math.floor(count) || 1))
  for (const key of keys) {
    next = mapNode(next, key, (p) => ({ ...p, children: [...p.children, ...makeRows(p, n, opts)] }))
  }
  return next
}

/**
 * Set how many rows a place has. Adding carries on the codes; taking away
 * removes from the end, and only rows with nothing inside them.
 */
export function setRowCount(nodes: readonly DraftNode[], key: string, count: number, opts: RowOptions = {}): DraftNode[] {
  const found = findNode(nodes, key)
  if (!found) return nodes as DraftNode[]
  const want = Math.max(0, Math.min(MAX_PER_LAYER, Math.floor(count)))
  const kind = rowKindOf(found.node)
  const rows = found.node.children.filter((c) => c.kind === kind)
  if (want > rows.length) return addRows(nodes, [key], want - rows.length, { ...opts, kind })
  let toRemove = rows.length - want
  return mapNode(nodes, key, (p) => {
    const kids = [...p.children]
    for (let i = kids.length - 1; i >= 0 && toRemove > 0; i--) {
      if (kids[i].kind === kind && kids[i].children.length === 0) {
        kids.splice(i, 1)
        toRemove--
      }
    }
    return { ...p, children: kids }
  })
}

/** Set "fits" on many places at once (only those that hold stock). */
export function setCapacityMany(nodes: readonly DraftNode[], keys: readonly string[], capacity: number | null): DraftNode[] {
  let next = nodes as DraftNode[]
  for (const key of keys) next = mapNode(next, key, (n) => (n.holdsStock ? { ...n, capacity } : n))
  return next
}

/** The rows of a place: children of its most common kind, when that reads as a row. */
export function rowsOf(n: DraftNode): DraftNode[] {
  if (!n.children.length) return []
  const kind = rowKindOf(n)
  return nodeType(kind) === 'row' || n.children.every((c) => c.children.length === 0) ? n.children.filter((c) => c.kind === kind) : []
}

// ---------------------------------------------------------- converting ----

export function draftToApiTree(nodes: readonly DraftNode[]): ApiTreeNode[] {
  return nodes.map((n) => ({
    code: n.code,
    name: n.name,
    kind: n.kind,
    holds_stock: n.holdsStock,
    capacity: n.holdsStock ? n.capacity : null,
    ...(n.children.length ? { children: draftToApiTree(n.children) } : {}),
  }))
}

export function apiTreeToDraft(nodes: readonly ApiTreeNode[] | null | undefined): DraftNode[] {
  return (nodes ?? []).map((n, i) => {
    const kind = (n.kind ?? '').trim() || 'Place'
    return {
      key: newKey(),
      code: (n.code ?? '').trim() || String(i + 1),
      name: (n.name ?? '').trim() || `${kind} ${i + 1}`,
      kind,
      holdsStock: n.holds_stock ?? true,
      capacity: n.capacity ?? null,
      children: apiTreeToDraft(n.children),
    }
  })
}

/**
 * The draft as bins, so the Bins screen's own tree, tiles and colours
 * (buildBinTree, BinTile) draw it exactly as the real thing will look.
 */
export function draftToTreeBins(nodes: readonly DraftNode[], locationId: string, locationName: string): TreeBin[] {
  const out: TreeBin[] = []
  let order = 0
  const walk = (list: readonly DraftNode[], parent: string | null, path: string[]) => {
    for (const n of list) {
      const p = [...path, n.code]
      out.push({
        id: n.key, location_id: locationId, parent_bin_id: parent, bin_code: n.code, name: n.name, kind: n.kind,
        holds_stock: n.holdsStock, barcode: null, qr_code_value: null, sort_order: order++, active: true,
        path_label: [locationName, ...p].join(' / '), capacity: n.holdsStock ? n.capacity : null,
      })
      walk(n.children, n.key, p)
    }
  }
  walk(nodes, null, [])
  return out
}

/**
 * Top-level codes that are already used in the place being built in move
 * on to the next free code (a second R1 becomes R3 when R1 and R2 exist), so
 * a build adds new places instead of filling in existing ones.
 */
export function renumberRoots(nodes: readonly DraftNode[], existingRootCodes: readonly string[]): { nodes: DraftNode[]; moved: Array<{ from: string; to: string }> } {
  const codes = existingRootCodes.map((c) => c.trim()).filter(Boolean)
  const taken = new Set(codes.map((c) => c.toLowerCase()))
  const moved: Array<{ from: string; to: string }> = []
  const out = nodes.map((n) => {
    if (!taken.has(n.code.toLowerCase())) {
      codes.push(n.code)
      taken.add(n.code.toLowerCase())
      return n
    }
    const to = nextSiblingCode([...codes, ...nodes.map((x) => x.code)], n.code)
    codes.push(to)
    taken.add(to.toLowerCase())
    moved.push({ from: n.code, to })
    return { ...n, code: to, name: renumberName(n.name, n.code, to) }
  })
  return { nodes: out, moved }
}

/**
 * A real place and everything inside it, as a draft ("Start from one you
 * already have"). Takes the Bins list as it comes from the API.
 */
export function binsToDraft(
  bins: ReadonlyArray<Pick<TreeBin, 'id' | 'parent_bin_id' | 'bin_code' | 'name' | 'kind' | 'holds_stock' | 'sort_order' | 'active'> & { capacity?: number | null }>,
  rootId: string,
): DraftNode[] {
  const byParent = new Map<string, typeof bins[number][]>()
  let root: typeof bins[number] | undefined
  for (const b of bins) {
    if (b.id === rootId) root = b
    if (!b.parent_bin_id || b.active === false) continue
    const list = byParent.get(b.parent_bin_id) ?? []
    list.push(b)
    byParent.set(b.parent_bin_id, list)
  }
  if (!root) return []
  let budget = MAX_TREE_NODES
  const make = (b: typeof bins[number], i: number): DraftNode => {
    budget--
    const kind = (b.kind ?? '').trim() || 'Place'
    const kids = (byParent.get(b.id) ?? []).slice().sort((x, y) => x.sort_order - y.sort_order)
    const children: DraftNode[] = []
    for (let j = 0; j < kids.length && budget > 0; j++) children.push(make(kids[j], j))
    return {
      key: newKey(),
      code: (b.bin_code ?? '').trim() || String(i + 1),
      name: (b.name ?? '').trim() || `${kind} ${i + 1}`,
      kind,
      holdsStock: b.holds_stock ?? true,
      capacity: b.capacity ?? null,
      children,
    }
  }
  return [make(root, 0)]
}

/**
 * Which ticked places get rows on the Bins screen. Ticking a rack ticks
 * everything inside it, so this keeps only the innermost ticked places that
 * aren't rows themselves: ticking a shelf of bins adds rows to each bin, not
 * to the shelf, and never rows inside rows.
 */
export function rowTargets(tree: BinTree, picked: readonly string[]): string[] {
  const on = new Set(picked)
  return picked.filter((id) => {
    const n = tree.nodes.get(id)
    if (!n?.bin || n.type === 'row') return false
    return !n.children.some((c) => {
      const k = tree.nodes.get(c)
      return !!k && on.has(c) && k.type !== 'row'
    })
  })
}

/**
 * Building from the layers in a place that already has R1: should the outer
 * codes move on to the next free ones by themselves? Only once per layer
 * shape and place (so Undo sticks and nothing loops), never after the user
 * chose to add into the existing ones, and only once we know what is there.
 */
export function shouldAutoNextFree(o: { fromLayers: boolean; existingLoaded: boolean; clashes: number; declined: boolean; tried: boolean }): boolean {
  return o.fromLayers && o.existingLoaded && o.clashes > 0 && !o.declined && !o.tried
}

/** "R1 is taken, so this is R2." for the note under the drawing. */
export function nextFreeNote(moved: ReadonlyArray<{ from: string; to: string }>): string {
  if (moved.length === 0) return ''
  if (moved.length === 1) return `${moved[0].from} is taken, so this is ${moved[0].to}.`
  const list = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 3).join(', ')}…` : xs.join(', '))
  return `${list(moved.map((m) => m.from))} are taken, so these are ${list(moved.map((m) => m.to))}.`
}
