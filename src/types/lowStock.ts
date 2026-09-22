/**
 * Low-stock types — feeds the "+ Low stock" picker on PO detail.
 * Matches GET /v1/inventory-stock-levels/low-stock response.
 */

export interface LowStockItem {
  id: string
  name: string
  sku: string | null
  supplier_name: string | null
  supplier_sku: string | null
  owner_cost_cents: number
  reorder_threshold: number
  reorder_quantity: number | null
  current_stock: number
  suggested_qty: number
}
