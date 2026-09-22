/**
 * Tenant-level settings — backed by the tenant_settings table.
 *
 * Today this file only covers the inventory settings exposed at
 * GET/PATCH /v1/settings/inventory. Future settings groups (receiving,
 * imaging, restock reports) will add their own interfaces here.
 */

/**
 * Inventory rules — controls how strict inventory operations are
 * for this tenant. Both default to false on tenant creation.
 */
export interface InventorySettings {
  /**
   * If true, every stock-bearing row must specify a bin within a location.
   * If false, stock can sit at the location level with no bin detail.
   */
  inventory_require_bin_for_stock: boolean

  /**
   * If true, an outgoing movement that exceeds available stock floors
   * stock at 0, writes a row to inventory_pending_reconciliations, and
   * allows the movement. A manager later resolves each shortfall via
   * the reconciliation queue (retroactive receive OR write-off).
   *
   * If false, the same movement is rejected with 422.
   */
  inventory_allow_unrecorded_stock: boolean

  /**
   * Slice 13c follow-up. If true (default), the AssetComponentsManager
   * shows a free-text serial input alongside the inventory unit picker.
   * If false, only the picker is visible to non-admins - prevents typos
   * pushing bad serials into the install endpoint. Platform admins
   * always see the free-text input regardless of this setting.
   */
  inventory_allow_serial_freetext_install: boolean

  // (removed) inventory_show_stock_in_catalog — the Product Catalog now shows
  // stock on every stocked item; the master override was dead (nothing read it).

  /**
   * Master switch for backend-owned physical stock-unit fingerprints/QRs.
   * When false, normal inventory quantities still work, but job product scans
   * and transfer QR enforcement are skipped.
   */
  inventory_stock_unit_tracking_enabled: boolean

  /**
   * If true, the manual '+ Add stock' button on the Stock Levels tab
   * is disabled. Stock can only arrive via the Purchase Order receive
   * flow. Off by default. Future: tied to per-account permissions
   * when the Crew Member feature ships, so admins can still override.
   */
  inventory_require_po_for_stock_add: boolean

  /**
   * Owner switch for the write-in workflow (Day 21). When on, a tech may write
   * in an item bought on a job; the system mints a tracked unit under a seeded
   * "Write In" catalog item and files a reconciliation row. Off by default.
   */
  inventory_allow_write_in: boolean

  /**
   * If true, stocked products can only be added to a job when the scanned
   * physical stock unit is already in the current tech's assigned truck/van.
   * If false (default), techs may pull available stock from a warehouse shelf
   * or any tracked location; the stock-unit fingerprint logs the true source.
   */
  inventory_require_van_stock_for_job_use: boolean

  /**
   * Tenant-wide visibility for SN-tracking UI. When false (default),
   * the SN-tracked checkbox + badges + columns are hidden everywhere
   * — most shops never serial-track and the option is just clutter.
   * Flip to true for shops that genuinely need per-instance tracking
   * (firearms, medical, pawn, regulated goods).
   */
  inventory_show_sn_tracking: boolean
}

/**
 * PATCH body — partial updates allowed (sometimes|boolean on backend).
 */
export type InventorySettingsUpdate = Partial<InventorySettings>

/**
 * API envelope — both GET and PATCH return { data: InventorySettings }.
 */
export interface InventorySettingsResponse {
  data: InventorySettings
}
