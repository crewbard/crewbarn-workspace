/**
 * AssetDocument types matching AssetDocumentResource on backend.
 *
 * SLICE-5a: file upload pipeline. Slice 5b will activate document_type='rich_text'
 * and the in-app rich-text editor.
 *
 * file_url is public-readable via images.crewbarn.com (Cloudflare CDN backed by R2).
 *
 * Backend: app/Http/Resources/AssetDocumentResource.php
 */

import type { PaginatedResponse, ResourceResponse } from "@/types/api"
export type { PaginatedResponse, ResourceResponse }

export type AssetDocumentType = "file" | "rich_text"
export type AssetDocumentStatus = "draft" | "ready" | "needs_signature" | "signed" | "expired" | "archived"
export type AssetDocumentSourceType = "upload" | "crewcam" | "job" | "estimate" | "invoice" | "inspection" | "system"
export type AssetDocumentVisibility = "internal" | "customer_portal" | "public_qr" | "secured"

export interface AssetDocument {
  id: string
  asset_id: string
  document_number: string
  document_type: AssetDocumentType
  document_status: AssetDocumentStatus
  source_type: AssetDocumentSourceType
  visibility: AssetDocumentVisibility
  requires_access: boolean
  signed_at: string | null
  signed_by_name: string | null
  signature_count: number
  title: string
  file_url: string | null
  original_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  rich_text_html: string | null
  sort_order: number
  uploaded_by_account_id: string | null
  created_at: string | null
  updated_at: string | null
}