/**
 * Asset history event types — Slice 7c.
 *
 * Backend: GET /v1/assets/{id}/history returns { data: AssetHistoryEvent[] }
 * sorted newest-first. Each entry is one of four discriminated shapes
 * (estimate line, work order line, inventory movement, inspection record). Frontend renders
 * them in a unified vertical timeline.
 */

export interface AssetHistoryParent {
  id: string
  type: 'estimate' | 'work_order'
  number: string | number
  display_number?: string
  status: string
}

export interface AssetHistoryEstimateLine {
  type: 'estimate_line'
  event_id: string
  event_date: string | null
  description: string
  quantity: number
  unit_price_cents: number
  line_total_cents: number
  parent: AssetHistoryParent | null
}

export interface AssetHistoryWorkOrderLine {
  type: 'work_order_line'
  event_id: string
  event_date: string | null
  description: string
  quantity: number
  unit_price_cents: number
  line_total_cents: number
  parent: AssetHistoryParent | null
}

export interface AssetHistoryInventoryMovement {
  type: 'inventory_movement'
  event_id: string
  event_date: string | null
  description: string
  movement_type: 'install' | 'return'
  quantity: number
  serial_number: string | null
  catalog_item_name: string | null
}

export interface AssetHistoryInspectionRecord {
  type: 'inspection_record'
  event_id: string
  event_date: string | null
  description: string
  overall_status: string
  started_at: string | null
  finalized_at: string | null
  report_path: string | null
  parent: AssetHistoryParent | null
}

export type AssetHistoryEvent =
  | AssetHistoryEstimateLine
  | AssetHistoryWorkOrderLine
  | AssetHistoryInventoryMovement
  | AssetHistoryInspectionRecord

export interface AssetHistoryResponse {
  data: AssetHistoryEvent[]
}
