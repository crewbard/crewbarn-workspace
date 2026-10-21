/**
 * The Bins tree, as plain data: built once from the bins and locations the
 * page already holds, then read by the tree, the rack view and the detail
 * panel. No React here, so the rules can be tested on their own
 * (scripts/bin-tree.test.mjs).
 *
 * The model, as the server has it:
 *   - Every rack, shelf, bin and row is a row in inventory_bins, nested by
 *     parent_bin_id. "Kind" is the shop's own word (Rack, Shelf, Row, Pocket…);
 *     nothing about the tree depends on it, so here it only picks an icon.
 *   - holds_stock says whether stock may sit directly in a place. A bin and
 *     its rows can both hold stock, so having children says nothing either way.
 *   - bin_code is unique among siblings (and among the top-level bins of a
 *     location), not across the tree. A row's code is just "A".
 *   - capacity (units) is optional on any node.
 */

export type NodeType = 'location' | 'rack' | 'shelf' | 'bin' | 'row' | 'other'

export interface TreeBin {
  id: string
  location_id: string
  parent_bin_id: string | null
  bin_code: string | null
  name: string | null
  kind: string | null
  holds_stock?: boolean
  barcode: string | null
  qr_code_value: string | null
  sort_order: number
  active: boolean
  path_label: string
  capacity?: number | null
}

export interface TreeLocation {
  id: string
  name: string
}

export interface StockCell {
  items: number
  qty: number
  units: number
}

export interface TreeNode {
  id: string
  type: NodeType
  /** Null for a location. */
  bin: TreeBin | null
  locationId: string
  parentId: string | null
  depth: number
  label: string
  code: string
  children: string[]
  /** What sits directly here. */
  own: { items: number; amount: number }
  /** This node and everything below it. */
  total: { items: number; amount: number }
  /**
   * Layered: when every place inside has a capacity, this is their sum (rows add
   * up to the bin, bins to the shelf, shelves to the rack), whatever was set on
   * the place itself. Otherwise its own capacity, if any.
   */
  capacity: number | null
  /** True when the capacity above is the sum of the places inside. */
  capacityRolledUp?: boolean
  /** Places below (bins, rows) that hold stock and have nothing in them. */
  emptySpots: number
  /** All descendants, not counting itself. */
  descendantCount: number
  holdsStock: boolean
  /** Some child can take stock directly (so the children are the spots). */
  hasStockChildren: boolean
}

export interface BinTree {
  nodes: Map<string, TreeNode>
  /** Location ids, in the order the page lists them. */
  roots: string[]
}

const ROW_WORDS = ['row', 'section', 'pocket', 'slot', 'position', 'tray', 'compartment', 'cell']
const SHELF_WORDS = ['shelf', 'level', 'tier', 'drawer']
const RACK_WORDS = ['rack', 'cabinet', 'case', 'bay', 'aisle', 'unit', 'tower']
const BIN_WORDS = ['bin', 'box', 'tote', 'container']

/** Which icon a node gets, from the shop's own word for it. */
export function nodeType(kind: string | null | undefined): NodeType {
  const k = (kind ?? '').trim().toLowerCase()
  if (!k) return 'other'
  if (ROW_WORDS.some((w) => k.startsWith(w))) return 'row'
  if (SHELF_WORDS.some((w) => k.startsWith(w))) return 'shelf'
  if (RACK_WORDS.some((w) => k.startsWith(w))) return 'rack'
  if (BIN_WORDS.some((w) => k.startsWith(w))) return 'bin'
  return 'other'
}

/**
 * How much is in one bin. A stock level's quantity and its tracked units
 * describe the same things (the units are the per-item stickers behind the
 * quantity), so they are not added together; the larger one wins, which also
 * covers a bin holding tracked units without a stock row.
 */
export function amountOf(cell: StockCell | undefined): number {
  if (!cell) return 0
  return Math.max(Number(cell.qty) || 0, Number(cell.units) || 0)
}

function binLabel(b: TreeBin): string {
  return b.name || b.bin_code || b.id
}

/** Build the tree. O(n) in bins; cheap enough to run on every data change. */
export function buildBinTree(
  locations: readonly TreeLocation[],
  bins: readonly TreeBin[],
  rollup: Readonly<Record<string, StockCell>>,
): BinTree {
  const nodes = new Map<string, TreeNode>()
  const roots: string[] = []
  for (const loc of locations) {
    nodes.set(loc.id, {
      id: loc.id, type: 'location', bin: null, locationId: loc.id, parentId: null, depth: 0,
      label: loc.name, code: '', children: [],
      own: { items: 0, amount: 0 }, total: { items: 0, amount: 0 },
      capacity: null, emptySpots: 0, descendantCount: 0, holdsStock: false, hasStockChildren: false,
    })
    roots.push(loc.id)
  }
  const sorted = [...bins].sort((a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) || binLabel(a).localeCompare(binLabel(b), undefined, { numeric: true }))
  for (const b of sorted) {
    const cell = rollup[b.id]
    nodes.set(b.id, {
      id: b.id, type: nodeType(b.kind), bin: b, locationId: b.location_id,
      parentId: null, depth: 0, label: binLabel(b), code: b.bin_code ?? '', children: [],
      own: { items: cell?.items ?? 0, amount: amountOf(cell) },
      total: { items: 0, amount: 0 },
      capacity: b.capacity ?? null, emptySpots: 0, descendantCount: 0,
      // Unknown (older payloads) behaves like the server default: true.
      holdsStock: b.holds_stock ?? true,
      hasStockChildren: false,
    })
  }
  for (const b of sorted) {
    const node = nodes.get(b.id)!
    // A parent that isn't loaded (filtered out, or another location) leaves the
    // bin at the top of its location rather than dropping it from the tree.
    const parent = (b.parent_bin_id && nodes.get(b.parent_bin_id)) || nodes.get(b.location_id)
    if (!parent || parent.id === node.id) continue
    node.parentId = parent.id
    parent.children.push(node.id)
  }

  // Depths top-down, roll-ups bottom-up, without recursion (deep trees).
  const order: string[] = []
  const stack = [...roots].reverse()
  for (const loc of roots) nodes.get(loc)!.depth = 0
  while (stack.length) {
    const id = stack.pop()!
    order.push(id)
    const n = nodes.get(id)!
    for (let i = n.children.length - 1; i >= 0; i--) {
      const c = nodes.get(n.children[i])!
      c.depth = n.depth + 1
      stack.push(c.id)
    }
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const n = nodes.get(order[i])!
    let items = n.own.items
    let amount = n.own.amount
    let empty = 0
    let desc = 0
    let childCap = 0
    let allChildrenHaveCap = n.children.length > 0
    for (const cid of n.children) {
      const c = nodes.get(cid)!
      if (c.holdsStock) n.hasStockChildren = true
      items += c.total.items
      amount += c.total.amount
      empty += c.emptySpots + (isEmptySpot(c) ? 1 : 0)
      desc += 1 + c.descendantCount
      if (c.capacity == null) allChildrenHaveCap = false
      else childCap += c.capacity
    }
    n.total = { items, amount }
    n.emptySpots = empty
    n.descendantCount = desc
    if (allChildrenHaveCap) { n.capacity = childCap; n.capacityRolledUp = true }
  }
  return { nodes, roots }
}

/**
 * An empty spot: somewhere stock can sit, with nothing in it or below it.
 * A shelf full of empty bins is not itself counted; its bins are.
 */
export function isEmptySpot(n: TreeNode): boolean {
  if (n.type === 'location' || !n.holdsStock) return false
  if (n.total.amount > 0) return false
  // A bin whose rows can take stock: the rows are the spots, not the bin.
  return !n.hasStockChildren
}

/** Root first: the location, then each bin down to (not including) the node. */
export function ancestorsOf(tree: BinTree, id: string): TreeNode[] {
  const out: TreeNode[] = []
  let cur = tree.nodes.get(id)
  let guard = 0
  while (cur?.parentId && guard++ < 64) {
    cur = tree.nodes.get(cur.parentId)
    if (cur) out.unshift(cur)
  }
  return out
}

/** Every node under this one, depth first, in tree order. */
export function descendantsOf(tree: BinTree, id: string): string[] {
  const out: string[] = []
  const start = tree.nodes.get(id)
  if (!start) return out
  const stack = [...start.children].reverse()
  while (stack.length) {
    const cid = stack.pop()!
    out.push(cid)
    const c = tree.nodes.get(cid)
    if (c) for (let i = c.children.length - 1; i >= 0; i--) stack.push(c.children[i])
  }
  return out
}

// ---------------------------------------------------------------- fill ----

export type FillBucket = 'empty' | 'light' | 'healthy' | 'well' | 'near' | 'over'
export type RelativeBucket = 'empty' | 'some' | 'more'

export const FILL_LABELS: Record<FillBucket, string> = {
  empty: 'Empty',
  light: 'Light',
  healthy: 'Healthy',
  well: 'Well stocked',
  near: 'Near full',
  over: 'Over capacity',
}

export const RELATIVE_LABELS: Record<RelativeBucket, string> = {
  empty: 'Empty',
  some: 'Some stock',
  more: 'More stock',
}

/** Units against capacity. Over 100% is over capacity, not clamped. */
export function fillBucket(amount: number, capacity: number): FillBucket {
  if (amount <= 0) return 'empty'
  const r = amount / capacity
  if (r > 1) return 'over'
  if (r >= 0.85) return 'near'
  if (r >= 0.6) return 'well'
  if (r >= 0.25) return 'healthy'
  return 'light'
}

/**
 * Without a capacity there is no "full", only "more than its neighbours".
 * Half or more of the fullest sibling reads as More stock.
 */
export function relativeBucket(amount: number, siblingMax: number): RelativeBucket {
  if (amount <= 0) return 'empty'
  if (siblingMax <= 0) return 'some'
  return amount / siblingMax >= 0.5 ? 'more' : 'some'
}

export type Tone =
  | { mode: 'capacity'; bucket: FillBucket; ratio: number }
  | { mode: 'relative'; bucket: RelativeBucket; share: number }

/** How a tile is coloured: by real fill when the capacity is known. */
export function toneFor(n: TreeNode, siblings: readonly TreeNode[]): Tone {
  if (n.capacity != null && n.capacity > 0) {
    return { mode: 'capacity', bucket: fillBucket(n.total.amount, n.capacity), ratio: n.total.amount / n.capacity }
  }
  const max = siblings.reduce((m, s) => Math.max(m, s.total.amount), 0)
  const sum = siblings.reduce((m, s) => m + s.total.amount, 0)
  return { mode: 'relative', bucket: relativeBucket(n.total.amount, max), share: sum > 0 ? n.total.amount / sum : 0 }
}

/** Is the node near full or over, by its own (or rolled-up) capacity? */
export function isNearFull(n: TreeNode): boolean {
  if (n.type === 'location' || n.capacity == null || n.capacity <= 0) return false
  const b = fillBucket(n.total.amount, n.capacity)
  return b === 'near' || b === 'over'
}

// --------------------------------------------------------- filtering ----

export interface TreeFilter {
  query?: string
  types?: ReadonlySet<NodeType>
  emptyOnly?: boolean
  nearFullOnly?: boolean
  locationId?: string
  /** Places that match the search by what is in them (an item's name or SKU). */
  alsoMatch?: ReadonlySet<string>
}

export interface FilterResult {
  /** Null: no filter, everything is shown. */
  visible: Set<string> | null
  /** The nodes that matched themselves (not just ancestors of a match). */
  matches: Set<string>
  /** Ancestors to open so every match is on screen. */
  expand: Set<string>
}

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
}

export function nodeMatchesQuery(n: TreeNode, q: string): boolean {
  if (!q) return true
  const b = n.bin
  return norm(n.label).includes(q) ||
    norm(n.code).includes(q) ||
    (!!b && (norm(b.barcode).includes(q) || norm(b.kind).includes(q)))
}

/**
 * Which nodes stay on screen. A node is kept when it matches every active
 * test; its ancestors are kept (and opened) so it can be seen in place.
 */
export function filterTree(tree: BinTree, f: TreeFilter): FilterResult {
  const q = norm(f.query).trim()
  const typed = f.types && f.types.size > 0 ? f.types : null
  const active = !!(q || typed || f.emptyOnly || f.nearFullOnly || f.locationId)
  if (!active) return { visible: null, matches: new Set(), expand: new Set() }
  const visible = new Set<string>()
  const matches = new Set<string>()
  const expand = new Set<string>()
  const narrowing = !!(q || typed || f.emptyOnly || f.nearFullOnly)
  for (const loc of tree.roots) {
    if (f.locationId && loc !== f.locationId) continue
    if (!narrowing) {
      visible.add(loc)
      for (const id of descendantsOf(tree, loc)) visible.add(id)
      continue
    }
    // A search shows only the locations it found something in.
    for (const id of descendantsOf(tree, loc)) {
      const n = tree.nodes.get(id)!
      if (q && !nodeMatchesQuery(n, q) && !f.alsoMatch?.has(id)) continue
      if (typed && !typed.has(n.type)) continue
      if (f.emptyOnly && !isEmptySpot(n)) continue
      if (f.nearFullOnly && !isNearFull(n)) continue
      matches.add(id)
      visible.add(id)
      for (const a of ancestorsOf(tree, id)) {
        visible.add(a.id)
        expand.add(a.id)
      }
    }
  }
  // A filter picks what is highlighted, not what you may open: everything
  // inside a match stays reachable (closed until you open it), so "Racks"
  // still lets you walk down into a rack's shelves and bins.
  for (const id of [...matches]) for (const d of descendantsOf(tree, id)) visible.add(d)
  return { visible, matches, expand }
}

// ------------------------------------------------------------ flatten ----

export interface FlatRow {
  id: string
  depth: number
  hasChildren: boolean
  open: boolean
  /** For connector lines: is each ancestor level (and this one) the last child? */
  lastAt: boolean[]
}

/** The rows on screen, in order, for the given open set and filter. */
export function flattenTree(tree: BinTree, open: ReadonlySet<string>, visible: ReadonlySet<string> | null): FlatRow[] {
  const out: FlatRow[] = []
  const walk = (ids: readonly string[], trail: boolean[]) => {
    const shown = visible ? ids.filter((id) => visible.has(id)) : ids
    shown.forEach((id, i) => {
      const n = tree.nodes.get(id)
      if (!n) return
      const kids = visible ? n.children.filter((c) => visible.has(c)) : n.children
      const isOpen = open.has(id) && kids.length > 0
      const lastAt = [...trail, i === shown.length - 1]
      out.push({ id, depth: n.depth, hasChildren: kids.length > 0, open: isOpen, lastAt })
      if (isOpen) walk(n.children, lastAt)
    })
  }
  walk(tree.roots, [])
  return out
}

// ------------------------------------------------------------- select ----

export type TickState = 'none' | 'some' | 'all'

/** Tick or untick a node and everything below it. */
export function toggleSelect(tree: BinTree, selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  const ids = [id, ...descendantsOf(tree, id)]
  const on = tickState(tree, selected, id) !== 'all'
  for (const x of ids) {
    if (on) next.add(x)
    else next.delete(x)
  }
  return next
}

export function tickState(tree: BinTree, selected: ReadonlySet<string>, id: string): TickState {
  const ids = [id, ...descendantsOf(tree, id)]
  let n = 0
  for (const x of ids) if (selected.has(x)) n++
  if (n === 0) return 'none'
  return n === ids.length ? 'all' : 'some'
}

/** The selected bins (not locations), in tree order: the label print order. */
export function selectedBinIds(tree: BinTree, selected: ReadonlySet<string>): string[] {
  const out: string[] = []
  for (const loc of tree.roots) {
    for (const id of descendantsOf(tree, loc)) if (selected.has(id)) out.push(id)
  }
  return out
}

// --------------------------------------------------------- next code ----

/** 1 -> A, 26 -> Z, 27 -> AA. Shared with the structure builder's numbering. */
export function alphaLabel(i: number): string {
  let s = ''
  let n = i
  while (n > 0) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

function alphaIndex(s: string): number {
  let n = 0
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

/**
 * The code for the next child, following the siblings' pattern:
 * A, B, C -> D; Z -> AA; B1..B10 -> B11; BIN-09 -> BIN-10; 01, 02 -> 03.
 * Codes are unique among siblings (the database says so), so the answer is
 * never one already taken; null when there is no pattern to follow.
 */
export function nextChildCode(siblingCodes: readonly (string | null | undefined)[], fallbackAlpha = false): string | null {
  const codes = siblingCodes.map((c) => (c ?? '').trim()).filter(Boolean)
  const taken = new Set(codes.map((c) => c.toUpperCase()))
  if (codes.length === 0) return fallbackAlpha ? 'A' : '1'
  if (codes.every((c) => /^[A-Z]{1,3}$/.test(c))) {
    let i = Math.max(...codes.map(alphaIndex)) + 1
    while (taken.has(alphaLabel(i))) i++
    return alphaLabel(i)
  }
  if (codes.every((c) => /^[a-z]{1,3}$/.test(c))) {
    let i = Math.max(...codes.map((c) => alphaIndex(c.toUpperCase()))) + 1
    while (taken.has(alphaLabel(i))) i++
    return alphaLabel(i).toLowerCase()
  }
  const parsed = codes.map((c) => /^(.*?)(\d+)$/.exec(c))
  if (parsed.every(Boolean)) {
    const prefixes = new Set(parsed.map((m) => m![1]))
    if (prefixes.size === 1) {
      const prefix = parsed[0]![1]
      const width = Math.max(...parsed.map((m) => (m![2].startsWith('0') ? m![2].length : 0)))
      let n = Math.max(...parsed.map((m) => Number(m![2]))) + 1
      const make = (k: number) => prefix + (width > 0 ? String(k).padStart(width, '0') : String(k))
      while (taken.has(make(n).toUpperCase())) n++
      return make(n)
    }
  }
  return null
}

/** What a new child is called, from its siblings: "Row" under bins whose children are rows. */
export function childKindFor(tree: BinTree, parentId: string): string | null {
  const p = tree.nodes.get(parentId)
  if (!p) return null
  const counts = new Map<string, number>()
  for (const cid of p.children) {
    const k = tree.nodes.get(cid)?.bin?.kind
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n }
  return best
}

// -------------------------------------------------------- stock rules ----

export interface StockActionRules {
  canEdit: boolean
  poRequired: boolean
}

export type AddStockVerdict =
  | { ok: true }
  | { ok: false; reason: string; kind: 'po' | 'permission' | 'container' | 'location' }

/**
 * Whether "Add to bin" may put stock straight into this node, and if not, why.
 * The same rules the server enforces: the PO-only switch
 * (inventory_require_po_for_stock_add), the inventory.edit permission, and
 * holds_stock (a rack that only holds shelves takes no stock).
 */
export function addStockVerdict(n: TreeNode, rules: StockActionRules): AddStockVerdict {
  if (n.type === 'location') {
    return { ok: false, kind: 'location', reason: 'Pick a bin inside this location to put stock in.' }
  }
  if (!rules.canEdit) {
    return { ok: false, kind: 'permission', reason: "You don't have permission to change stock." }
  }
  if (rules.poRequired) {
    return {
      ok: false,
      kind: 'po',
      reason: 'Stock comes in through purchase orders only. Change this in Inventory › Settings › Require purchase orders for adding stock.',
    }
  }
  if (!n.holdsStock) {
    const word = (n.bin?.kind || 'place').toLowerCase()
    return { ok: false, kind: 'container', reason: `This ${word} only holds other places. Put the stock in one of the places inside it.` }
  }
  return { ok: true }
}

/** Children of a node that can take stock directly (the "which row?" list). */
export function stockChildren(tree: BinTree, id: string): TreeNode[] {
  const n = tree.nodes.get(id)
  if (!n) return []
  return n.children.map((c) => tree.nodes.get(c)!).filter((c) => c && c.holdsStock)
}

// ------------------------------------------------------------ totals ----

export interface TreeTotals {
  locations: number
  places: number
  items: number
  amount: number
  emptySpots: number
  nearFull: number
}

export function treeTotals(tree: BinTree): TreeTotals {
  let items = 0
  let amount = 0
  let empty = 0
  let places = 0
  let near = 0
  for (const loc of tree.roots) {
    const n = tree.nodes.get(loc)!
    items += n.total.items
    amount += n.total.amount
    empty += n.emptySpots
    places += n.descendantCount
  }
  // Places with a capacity of their own, so a full rack isn't counted once per level.
  for (const n of tree.nodes.values()) if (n.bin?.capacity != null && isNearFull(n)) near++
  return { locations: tree.roots.length, places, items, amount, emptySpots: empty, nearFull: near }
}

/**
 * One row pill on a bin tile: how much of it is stored (green) and how much
 * room is left (red), as fractions of the pill. Null when the row has no
 * capacity, so it keeps a neutral look.
 */
export function pillFill(n: Pick<TreeNode, 'capacity' | 'total'>): { stored: number; room: number; over: boolean } | null {
  if (n.capacity == null || n.capacity <= 0) return null
  const stored = Math.max(0, Math.min(1, n.total.amount / n.capacity))
  return { stored, room: 1 - stored, over: n.total.amount > n.capacity }
}

/** The innermost places under a node (its rows), which is where "how many fit" is set. */
export function innermostUnder(tree: BinTree, id: string): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (nid: string) => {
    const n = tree.nodes.get(nid)
    if (!n) return
    if (n.children.length === 0) { if (nid !== id) out.push(n); return }
    for (const c of n.children) walk(c)
  }
  walk(id)
  return out
}

/** A "how many fit" box: '' clears (null); a whole number 1..1,000,000; anything else is undefined (not valid). */
export function parseFits(v: string): number | null | undefined {
  const t = v.trim()
  if (t === '') return null
  const n = Math.floor(Number(t))
  return Number.isFinite(n) && n >= 1 && n <= 1_000_000 && String(n) === t ? n : undefined
}

/** "254 of 400 units", or "254 units · no capacity set" (short: "254 units"). */
export function unitsLine(n: Pick<TreeNode, 'capacity' | 'total'>, short = false): string {
  const amt = Math.round(n.total.amount).toLocaleString('en-US')
  if (n.capacity != null && n.capacity > 0) return `${amt} of ${n.capacity.toLocaleString('en-US')} units`
  return short ? `${amt} units` : `${amt} units · no capacity set`
}
