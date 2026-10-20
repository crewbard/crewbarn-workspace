/**
 * "Add from PO" and the right-click menu on the Bins screen, as plain data so
 * the rules can be tested on their own (scripts/bin-tree.test.mjs).
 *
 * Receiving goes through the existing POST /v1/purchase-orders/{po}/receive,
 * one call per order, with only bin_id set: the server works out the
 * location from the bin, so the two can never disagree.
 */
import {
  childKindFor, nextChildCode, nodeType,
  type BinTree, type TreeNode,
} from './binTree'

export interface ReceivableLine {
  id: string
  description: string
  part_number: string | null
  /** The line's price from the vendor, for "Create product" (optional on older servers). */
  unit_cost_cents?: number
  qty_ordered: number
  qty_received: number
  qty_remaining: number
  catalog_item: {
    id: string
    name: string
    sku: string | null
    unit_label: string | null
    sn_tracking_enabled: boolean
    default_bin_id: string | null
  } | null
}

export interface ReceivableOrder {
  id: string
  po_number: string
  vendor_order_number: string | null
  status: string
  order_date: string | null
  expected_delivery: string | null
  vendor: { id: string; name: string } | null
  lines: ReceivableLine[]
}

export interface ReceivableRow {
  key: string
  poId: string
  poNumber: string
  vendor: string
  date: string | null
  line: ReceivableLine
  remaining: number
  name: string
  tracked: boolean
  /** Why this line can't be received here, if it can't. */
  blocked: string | null
  /** Where the item usually lives: 'here', another place's id, or null. */
  usual: 'here' | string | null
}

/** One row per line still to come, the lines that usually live here first. */
export function receivableRows(orders: readonly ReceivableOrder[], targetId: string | null): ReceivableRow[] {
  const rows: ReceivableRow[] = []
  for (const po of orders) {
    for (const line of po.lines) {
      const remaining = Math.max(0, Number(line.qty_remaining) || 0)
      if (remaining <= 0) continue
      const usualId = line.catalog_item?.default_bin_id ?? null
      rows.push({
        key: `${po.id}:${line.id}`,
        poId: po.id,
        poNumber: po.po_number,
        vendor: po.vendor?.name ?? '',
        date: po.order_date,
        line,
        remaining,
        name: line.catalog_item?.name || line.description || 'Item',
        tracked: !!line.catalog_item?.sn_tracking_enabled,
        blocked: line.catalog_item ? null : 'Link this line to a catalog item on the order first.',
        usual: usualId == null ? null : usualId === targetId ? 'here' : usualId,
      })
    }
  }
  // Stable: lines that belong here first, then the order list's own order.
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => Number(b.r.usual === 'here') - Number(a.r.usual === 'here') || a.i - b.i)
    .map(({ r }) => r)
}

/** Lines that can actually be received (linked to a catalog item). */
export function receivableCount(orders: readonly ReceivableOrder[] | undefined): number {
  if (!orders) return 0
  return receivableRows(orders, null).filter((r) => !r.blocked).length
}

/** A typed quantity, checked against what is left. Tracked items come in whole. */
export function checkQty(raw: string, row: ReceivableRow): { qty: number; error: string | null } {
  const t = raw.trim()
  if (t === '') return { qty: 0, error: null }
  const qty = Number(t)
  if (!Number.isFinite(qty) || qty < 0) return { qty: 0, error: 'Type a number.' }
  if (row.tracked && !Number.isInteger(qty)) return { qty, error: 'Tracked items come in whole numbers.' }
  if (qty > row.remaining + 1e-9) return { qty, error: `Only ${fmt(row.remaining)} left to receive on this order.` }
  return { qty, error: null }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export interface ReceiveRequest {
  poId: string
  poNumber: string
  body: { lines: Array<{ po_item_id: string; qty: number; bin_id: string; serials?: string[] }> }
}

/**
 * Serial numbers typed or scanned for a tracked line: one per line of text
 * (commas and tabs split too, so a pasted row works), trimmed, blanks dropped.
 */
export function parseSerials(raw: string | undefined): string[] {
  return (raw ?? '').split(/[\n,\t]+/).map((s) => s.trim()).filter(Boolean)
}

/** What is wrong with the serials typed for a line, or null. */
export function checkSerials(serials: readonly string[], qty: number): string | null {
  if (serials.length > qty) return `${serials.length} serial numbers for ${fmt(qty)} coming in. Remove ${serials.length - qty} or raise the quantity.`
  const seen = new Set<string>()
  for (const s of serials) {
    const k = s.toLowerCase()
    if (seen.has(k)) return `${s} is typed twice.`
    seen.add(k)
  }
  return null
}

export interface ReceiveExtras {
  /** A line's own spot (dropped on a tile), instead of the chosen place. */
  spots?: Readonly<Record<string, string>>
  /** Serial numbers typed for tracked lines, raw text by row key. */
  serials?: Readonly<Record<string, string>>
}

/**
 * One receive call per order. Every line goes into the chosen place unless it
 * was given its own spot; tracked lines carry the serials typed for them
 * (the rest of their units get numbers made up as before).
 */
export function buildReceiveRequests(
  rows: readonly ReceivableRow[],
  qtyByKey: Readonly<Record<string, string>>,
  binId: string,
  extras: ReceiveExtras = {},
): { requests: ReceiveRequest[]; errors: Record<string, string>; total: number; byBin: Record<string, number> } {
  const byPo = new Map<string, ReceiveRequest>()
  const errors: Record<string, string> = {}
  const byBin: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    const raw = qtyByKey[row.key]
    if (raw == null) continue
    const { qty, error } = checkQty(raw, row)
    if (error) { errors[row.key] = error; continue }
    if (qty <= 0) continue
    if (row.blocked) { errors[row.key] = row.blocked; continue }
    const serials = row.tracked ? parseSerials(extras.serials?.[row.key]) : []
    const serialError = checkSerials(serials, qty)
    if (serialError) { errors[row.key] = serialError; continue }
    const spot = extras.spots?.[row.key] || binId
    const req = byPo.get(row.poId) ?? { poId: row.poId, poNumber: row.poNumber, body: { lines: [] } }
    req.body.lines.push({ po_item_id: row.line.id, qty, bin_id: spot, ...(serials.length ? { serials } : {}) })
    byPo.set(row.poId, req)
    byBin[spot] = (byBin[spot] ?? 0) + qty
    total += qty
  }
  return { requests: [...byPo.values()], errors, total, byBin }
}

/**
 * A warning (never a block) when this would put more in a place than it fits.
 * Null when the capacity isn't known or it still fits.
 */
export function capacityWarning(target: TreeNode, adding: number): string | null {
  if (target.capacity == null || target.capacity <= 0 || adding <= 0) return null
  const after = target.total.amount + adding
  if (after <= target.capacity) return null
  const word = (target.bin?.kind || 'place').toLowerCase()
  return `This ${word} fits ${target.capacity}. It will hold ${fmt(after)} after this, ${fmt(after - target.capacity)} over. You can still go ahead.`
}

// ------------------------------------------------------------- menu ----

export type MenuId = 'add-product' | 'add-po' | 'add-row' | 'print' | 'capacity' | 'catalog' | 'details'

/** A way out of a "can't": a menu action or a page to open. */
export type MenuFix = { label: string; action: MenuId } | { label: string; href: string }

export interface MenuItem {
  id: MenuId
  label: string
  disabled: boolean
  /** Why it's off, in one plain line (shown under the label, readable size). */
  reason?: string
  /** What to do about it. */
  fix?: MenuFix
  /** Opens a "which spot?" step first. */
  pickTarget?: boolean
}

export interface MenuRules {
  canEdit: boolean
  poRequired: boolean
  /** Lines waiting on open orders; undefined while still loading. */
  openPoLines: number | undefined
}

/**
 * Where stock may go from this node: itself if it holds stock, then every
 * place inside it that does (rows of a bin, bins of a shelf, all the way
 * down a rack or a whole location), in the tree's order.
 */
export function stockTargets(tree: BinTree, id: string): TreeNode[] {
  const n = tree.nodes.get(id)
  if (!n) return []
  const out: TreeNode[] = n.type !== 'location' && n.holdsStock ? [n] : []
  const walk = (ids: readonly string[]) => {
    for (const c of ids) {
      const k = tree.nodes.get(c)
      if (!k) continue
      if (k.holdsStock) out.push(k)
      walk(k.children)
    }
  }
  walk(n.children)
  return out
}

/** The word for what "Add row" adds here: Row, Bin, Shelf… */
export function childWord(tree: BinTree, id: string): string {
  const k = childKindFor(tree, id)
  if (k) return k
  const n = tree.nodes.get(id)
  const t = n?.type
  if (t === 'bin') return 'Row'
  if (t === 'shelf') return 'Bin'
  if (t === 'rack') return 'Shelf'
  return 'place'
}

/** The suggested code for the next child, following its siblings. */
export function nextCodeFor(tree: BinTree, id: string): string | null {
  const n = tree.nodes.get(id)
  if (!n) return null
  const codes = n.children.map((c) => tree.nodes.get(c)?.code ?? '')
  const alpha = nodeType(childWord(tree, id)) === 'row'
  return nextChildCode(codes, alpha)
}

export function contextMenu(tree: BinTree, id: string, rules: MenuRules): MenuItem[] {
  const n = tree.nodes.get(id)
  if (!n) return []
  const targets = stockTargets(tree, id)
  const intoWord = n.type === 'location' ? 'location' : n.type === 'row' ? 'row' : (n.bin?.kind || 'bin').toLowerCase()
  const manyTargets = targets.length > 1 || (targets.length === 1 && targets[0].id !== id)
  const noEdit = "Adding stock needs the Inventory edit permission. Ask an owner or admin."
  const items: MenuItem[] = []

  // Add product: the one way in, from any node. Containers ask where next.
  const add: MenuItem = {
    id: 'add-product',
    label: n.holdsStock && !manyTargets ? `Add product to this ${intoWord}` : 'Add product',
    disabled: false,
    // With the PO-only switch on, the PO overlay asks where; otherwise this menu does.
    pickTarget: manyTargets && !rules.poRequired,
  }
  if (!rules.canEdit) { add.disabled = true; add.reason = noEdit }
  else if (targets.length === 0) {
    add.disabled = true
    add.reason = n.type === 'location' ? 'There are no bins here yet.' : `Nothing inside this ${intoWord} can hold stock yet.`
    if (n.type !== 'location') add.fix = { label: `Add ${childWord(tree, id).toLowerCase()}`, action: 'add-row' }
  } else if (rules.poRequired) {
    add.reason = 'Comes in through a purchase order (your shop requires one).'
  }
  items.push(add)

  // A whole delivery from one order into one spot.
  const po: MenuItem = { id: 'add-po', label: 'Add from a purchase order', disabled: false, pickTarget: manyTargets }
  if (!rules.canEdit) { po.disabled = true; po.reason = noEdit }
  else if (targets.length === 0) { po.disabled = true; po.reason = add.reason; po.fix = add.fix }
  else if (rules.openPoLines === 0) {
    po.disabled = true
    po.reason = 'No purchase orders are waiting to arrive.'
    po.fix = { label: 'Start a purchase order', href: '/purchase-orders/new' }
  } else if (rules.openPoLines === undefined) { po.reason = 'Checking open orders…' }
  items.push(po)

  if (n.type === 'location') {
    items.push({ id: 'details', label: 'Details', disabled: false })
    return items
  }

  const word = childWord(tree, id)
  const code = nextCodeFor(tree, id)
  const noBins = "Changing bins needs the Inventory edit permission. Ask an owner or admin."
  items.push({
    id: 'add-row',
    label: `Add ${word.toLowerCase()}${code ? ` ${code}` : ''}`,
    disabled: !rules.canEdit,
    reason: rules.canEdit ? undefined : noBins,
  })
  items.push({ id: 'print', label: n.children.length ? 'Print labels for this and inside' : 'Print label', disabled: false })
  items.push({
    id: 'capacity', label: n.bin?.capacity ? `Change how many fit (${n.bin.capacity})` : 'Set how many fit',
    disabled: !rules.canEdit, reason: rules.canEdit ? undefined : noBins,
  })
  items.push({ id: 'catalog', label: "See what's inside", disabled: false })
  items.push({ id: 'details', label: 'Details', disabled: false })
  return items
}

/**
 * The catalog item's existing label sheet (CatalogItemLabelsPage), narrowed to
 * one bin: it prints the fingerprinted stock-unit QR codes a receive makes.
 * Every "Print labels" after receiving goes here, so they all print the same.
 */
export function labelSheetHref(
  itemId: string,
  at: { locationId?: string | null; binId?: string | null; binLabel?: string | null; qty?: number | null; perUnit?: boolean } = {},
): string {
  const q = new URLSearchParams()
  // With unit tracking on, one label per unit, each with its own QR.
  if (at.perUnit) q.set('per_unit', '1')
  if (at.locationId) q.set('location_id', at.locationId)
  if (at.binId) q.set('bin_id', at.binId)
  if (at.binLabel) q.set('bin_label', at.binLabel)
  if (at.qty != null && at.qty > 0) q.set('qty', String(at.qty))
  const s = q.toString()
  return `/catalog-items/${encodeURIComponent(itemId)}/labels${s ? `?${s}` : ''}`
}
