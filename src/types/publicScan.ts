// Types for the no-auth public scan endpoint.
// Mirrors PHP PublicScanResource (assets) and PublicScanNodeResource
// (locations + groups). Locked-down allow-list per security boundary.
//
// Slice 3: asset variant only.
// Slice 13b: extended to a polymorphic union over asset / location / group.

// ---------- Shared helpers ----------

export interface ScanBreadcrumbStep {
  /** customer = non-clickable; location/group = clickable via code */
  type: 'customer' | 'location' | 'group'
  name: string
  /** null for customer entries; the QR code for location/group entries */
  code?: string | null
}

/** Flat child entry rendered as a clickable card in location/group views. */
export interface PublicScanDocumentSummary {
  id: string
  document_number: string | null
  title: string | null
  document_type: string | null
  document_status: string | null
  source_type: string | null
  visibility: string | null
  file_url: string | null
  original_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  signed_at: string | null
  signed_by_name: string | null
  signature_count: number
}

export interface PublicScanPhotoSummary {
  id: string
  thumb_url: string | null
  medium_url: string | null
  full_url: string | null
  caption: string | null
  original_filename: string | null
  created_at: string | null
}

export interface PublicScanReportHistoryEvent {
  type: string
  label: string
  title: string
  date: string | null
  status: string | null
  reference: string | null
}


export interface PublicScanRequiredFormSummary {
  id: string
  name: string
  description: string | null
  category: string | null
  asset_type_slug: string | null
  standard: string | null
  template_type: string | null
  jurisdiction: string | null
  approved_format_required: string | null
  requires_owner_signature: boolean
  requires_ahj_submission: boolean
  requires_inspector_permit_number: boolean
  export_formats: string[]
}
export interface PublicScanReportHistorySummary {
  // No estimate or work-order counts: they are commercial facts, and a
  // public asset record says what was done to the thing, not what anybody
  // was quoted. See PublicScanResource and NoMoneyTest.
  inventory_count: number
  inspection_count: number
  /** Public service-log entries. A visit is history too. */
  service_count?: number
  event_count: number
  recent_events?: PublicScanReportHistoryEvent[]
}

export interface PublicScanReportSummary {
  warnings: string[]
  documents_count: number
  has_public_documents: boolean
  photos_count?: number
  history?: PublicScanReportHistorySummary
  required_forms?: PublicScanRequiredFormSummary[]
  required_forms_count?: number
  inspection_cadence?: string | null
  next_due_at?: string | null
  last_inspected_at?: string | null
  last_inspection_result?: string | null
  /** Target for the public /verify page. */
  last_inspection_id?: string | null
  /** Server-computed so every surface gives the same answer. */
  compliance?: PublicScanCompliance | null
}

export type ComplianceState = 'overdue' | 'due' | 'due_soon' | 'current' | 'unscheduled'

export interface PublicScanCompliance {
  state: ComplianceState
  /** Signed: positive is days overdue, negative is days remaining. */
  days: number | null
  label: string
}

export interface ScanChildEntry {
  type: 'asset' | 'group'
  id: string
  name: string
  code: string | null
  is_secured: boolean
  /** Only present when type=asset */
  asset_type_name?: string | null
  /** The number the building itself uses: FD-201, RTU-3. */
  tag?: string | null
  /** Asset location inside the public tree, e.g. Building A > Floor 1. */
  path?: string[]
  /** Only present on public, non-secured asset entries. */
  physical?: PublicScanPhysical
  /** Only present when type=group */
  counts?: {
    child_groups: number
    assets: number
    /** Serviced in the last few months. */
    serviced?: number
    /** Something urgent still open, or an inspection already past due. */
    attention?: number
  }
  /** Public QR-safe documents visible without secured access. */
  documents?: PublicScanDocumentSummary[]
  /** Public QR-safe photos visible without secured access. */
  photos?: PublicScanPhotoSummary[]
  /** Public QR-safe report readiness summary. */
  report?: PublicScanReportSummary
  /**
   * Only on the asset that was actually scanned.
   *
   * The tree carries identity and enough to navigate; loading every
   * item's service history to draw a list of names would be one query
   * per row on a page anybody can reach with a phone camera.
   */
  service_log?: PublicServiceLogEntry[]
  parts?: PublicScanParts
  coverage?: PublicScanCoverage | null
  last_serviced_at?: string | null
  open_priority?: string | null
  /** Only present on nested tree entries returned from an asset scan. */
  children?: ScanChildEntry[]
  /** Who maintains this asset — company, phone, licence. */
  servicer?: PublicScanServicer | null
}

// ---------- Asset variant (Slice 3, extended Slice 13b) ----------

export interface PublicScanPhysical {
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  install_date: string | null  // ISO date YYYY-MM-DD
}

/**
 * One thing that was done, as a stranger may read it.
 *
 * The server builds this field by field — it is never a model serialised
 * whole. Nothing here is money, a job number or a customer's name, and the
 * tech is a first name and an initial.
 */
export interface PublicServiceLogEntry {
  /** "Oct 14, 2026", already in the property's own timezone. */
  date: string | null
  /** The same day as YYYY-MM-DD, for grouping a visit without re-parsing. */
  date_key: string | null
  time: string | null
  /** Work done, Part replaced, Part needed, Something found, Could not service. */
  kind: string
  summary: string | null
  result: string | null
  /** "Marcus W." */
  by: string | null
  company: string | null
  part?: {
    name: string
    quantity: string | null
    unit: string | null
    removed: string | null
  }
  /** Where a needed part has got to. Never says it was quoted. */
  need?: string
  priority?: string
  priority_word?: string
  skipped_because?: string
  /** Only the photos a tech ticked to share. */
  photos?: PublicServicePhoto[]
}

export interface PublicServicePhoto {
  url: string
  thumb_url: string | null
  /** 'before' | 'after' | null — the pair is the point. */
  phase: string | null
}

/** What went on, and what is still waiting. Names and dates, never prices. */
export interface PublicScanParts {
  replaced: { name: string; on: string | null }[]
  needed: { name: string; state: string; priority: string | null }[]
}

/**
 * On a service plan.
 *
 * The plan's rhythm and the next visit, so somebody standing in front of
 * the equipment knows it is looked after. Never the fee: what the customer
 * pays is between them and their shop.
 */
export interface PublicScanCoverage {
  service: string | null
  /** "Every 3 months" */
  how_often: string | null
  /** "Jan 14, 2027" */
  next_visit: string | null
}

export interface PublicScanAssetSecured {
  type: 'asset'
  id: string
  name: string
  is_secured: true
}

export interface PublicScanAssetOpen {
  type: 'asset'
  id: string
  name: string
  code: string | null
  is_secured: false
  asset_type_name?: string | null
  /** The number the building itself uses: FD-201, RTU-3. */
  tag?: string | null
  physical: PublicScanPhysical
  breadcrumb?: ScanBreadcrumbStep[]
  selected_asset_id?: string
  tree?: ScanChildEntry[]
  documents?: PublicScanDocumentSummary[]
  photos?: PublicScanPhotoSummary[]
  report?: PublicScanReportSummary
  /** What was done to it, newest first. Empty when the owner hides it. */
  service_log?: PublicServiceLogEntry[]
  parts?: PublicScanParts
  coverage?: PublicScanCoverage | null
  last_serviced_at?: string | null
  /** The worst open flag on this thing: critical, high, medium, low. */
  open_priority?: string | null
  /** Who maintains this asset — company, phone, licence. */
  servicer?: PublicScanServicer | null
}

// ---------- Location variant (Slice 13b) ----------

export interface PublicScanLocationSecured {
  type: 'location'
  id: string
  name: string
  is_secured: true
  breadcrumb: ScanBreadcrumbStep[]
}

export interface PublicScanLocationOpen {
  type: 'location'
  id: string
  name: string
  is_secured: false
  address: {
    street_address: string | null
    city: string | null
    state: string | null
    postal_code: string | null
  }
  breadcrumb: ScanBreadcrumbStep[]
  children: ScanChildEntry[]
}

// ---------- Group variant (Slice 13b) ----------

export interface PublicScanGroupSecured {
  type: 'group'
  id: string
  name: string
  is_secured: true
  breadcrumb: ScanBreadcrumbStep[]
}

export interface PublicScanGroupOpen {
  type: 'group'
  id: string
  name: string
  is_secured: false
  breadcrumb: ScanBreadcrumbStep[]
  children: ScanChildEntry[]
}

// ---------- Discriminated union ----------

export type PublicScanNode =
  | PublicScanAssetSecured
  | PublicScanAssetOpen
  | PublicScanLocationSecured
  | PublicScanLocationOpen
  | PublicScanGroupSecured
  | PublicScanGroupOpen

// Back-compat alias for existing call sites that import PublicScanAsset.
// Slice 13b widens the union but old code paths still work because the
// asset variants remain in the union.
export type PublicScanAsset = PublicScanAssetSecured | PublicScanAssetOpen

// Laravel JsonResource envelopes responses in { data: ... }
export interface PublicScanResponse {
  data: PublicScanNode
}

export interface SecuredScanAssetReport {
  asset_type_name: string | null
  physical: PublicScanPhysical
  path: string[]
  documents: PublicScanDocumentSummary[]
  photos: PublicScanPhotoSummary[]
  report: PublicScanReportSummary
}

export interface SecuredScanUnlock {
  type: 'asset' | 'location' | 'group'
  id: string
  name: string
  secured_data: unknown
  access_scope?: 'item' | 'tree'
  access_expires_at: string | null
  asset_report?: SecuredScanAssetReport
  asset_tree?: ScanChildEntry[]
  selected_asset_id?: string | null
}

export interface SecuredScanUnlockResponse {
  data: SecuredScanUnlock
}

/** Published contact details of the company that maintains the asset. */
export interface PublicScanServicer {
  name: string
  phone?: string | null
  license_number?: string | null
  website?: string | null
}
