export type InventoryReturnType = 'vendor' | 'customer' | 'internal'
export type InventoryReturnStatus = 'pending' | 'shipped' | 'received_credit' | 'cancelled'

export interface InventoryReturnItem {
  id: string
  return_id: string
  catalog_item_id: string
  inventory_unit_id: string | null
  quantity: string | number
  source_location_id: string | null
  source_bin_id: string | null
  reason: string | null
  movement_id: string | null
  catalog_item?: { id: string; name: string; sku?: string | null } | null
  source_bin?: { id: string; path_label?: string | null; name?: string | null } | null
}

export interface InventoryReturn {
  id: string
  tenant_id: string
  type: InventoryReturnType
  vendor_id: string | null
  rma_number: string | null
  reason: string | null
  notes: string | null
  status: InventoryReturnStatus
  return_label_path: string | null
  return_label_url: string | null
  return_label_mime: string | null
  return_label_original_filename: string | null
  return_label_size_bytes: number | null
  shipped_at: string | null
  received_at: string | null
  created_by_account_id: string | null
  created_at: string
  updated_at: string
  vendor?: { id: string; name: string } | null
  items?: InventoryReturnItem[]
}

export interface CreateReturnInput {
  type: InventoryReturnType
  vendor_id?: string | null
  rma_number?: string | null
  reason?: string | null
  notes?: string | null
  items: Array<{
    catalog_item_id: string
    inventory_unit_id?: string | null
    quantity: number
    source_location_id?: string | null
    source_bin_id?: string | null
    reason?: string | null
  }>
}
