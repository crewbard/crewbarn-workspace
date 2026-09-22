/**
 * AssetComponent types matching AssetComponentResource on backend.
 *
 * SLICE-6a: Inventory <-> Asset Bridge.
 *
 * Represents an inventory_unit currently installed on an asset (a component).
 * The catalog_item nested object is eager-loaded by the backend Resource so
 * the UI can render "Schlage L9080 Cylinder (SCH-L9080-000042)" inline.
 *
 * Backend: app/Http/Resources/AssetComponentResource.php
 */

import type { ResourceResponse } from "@/types/api"
export type { ResourceResponse }

export interface AssetComponentCatalogItem {
  id: string
  name: string
  sku: string | null
}

export interface AssetComponent {
  inventory_unit_id: string
  serial_number: string
  status: string
  notes: string | null
  installed_at: string | null
  installed_at_asset_id: string | null
  catalog_item?: AssetComponentCatalogItem
  created_at: string | null
  updated_at: string | null
}

export interface InstallAssetComponentInput {
  serial_number: string
  notes?: string
}