import type { AssetDocument } from "@/types/assetDocument"

export type AssetDocumentCategory =
  | "inspection_report"
  | "work_file"
  | "manual"
  | "warranty"
  | "photo"
  | "spreadsheet"
  | "text"
  | "general"


export function assetDocumentStatusLabel(status: AssetDocument["document_status"] | null | undefined): string {
  switch (status) {
    case "draft": return "Draft"
    case "ready": return "Ready"
    case "needs_signature": return "Needs signature"
    case "signed": return "Signed"
    case "expired": return "Expired"
    case "archived": return "Archived"
    default: return "Ready"
  }
}

export function assetDocumentVisibilityLabel(visibility: AssetDocument["visibility"] | null | undefined): string {
  switch (visibility) {
    case "customer_portal": return "Customer portal"
    case "public_qr": return "Public QR"
    case "secured": return "Secured"
    case "internal": return "Internal"
    default: return "Internal"
  }
}

export function assetDocumentSourceLabel(sourceType: AssetDocument["source_type"] | null | undefined): string {
  switch (sourceType) {
    case "crewcam": return "CrewCam"
    case "job": return "Job"
    case "estimate": return "Estimate"
    case "invoice": return "Invoice"
    case "inspection": return "Inspection"
    case "system": return "System"
    case "upload": return "Upload"
    default: return "Upload"
  }
}

export function assetDocumentKindLabel(doc: Pick<AssetDocument, "mime_type" | "original_filename">): string {
  const mime = (doc.mime_type ?? "").toLowerCase()
  const name = (doc.original_filename ?? "").toLowerCase()

  if (mime === "application/pdf" || name.endsWith(".pdf")) return "PDF"
  if (mime.startsWith("image/")) return "Image"
  if (mime.includes("wordprocessing") || mime === "application/msword" || name.endsWith(".doc") || name.endsWith(".docx")) return "Word"
  if (mime.includes("spreadsheet") || mime === "application/vnd.ms-excel" || name.endsWith(".xls") || name.endsWith(".xlsx")) return "Spreadsheet"
  if (mime.includes("csv") || name.endsWith(".csv")) return "CSV"
  if (mime.startsWith("text/") || name.endsWith(".txt")) return "Text"
  return "File"
}

export function assetDocumentCategory(doc: Pick<AssetDocument, "title" | "original_filename" | "mime_type">): {
  key: AssetDocumentCategory
  label: string
  className: string
} {
  const haystack = `${doc.title ?? ""} ${doc.original_filename ?? ""}`.toLowerCase()
  const mime = (doc.mime_type ?? "").toLowerCase()

  if (/\b(report|inspection|deficien|compliance|ahj|nfpa|checklist)\b/.test(haystack)) {
    return category("inspection_report", "Inspection / report", "bg-emerald-50 text-emerald-700 border-emerald-200")
  }

  if (/\b(work\s*order|wo\b|sign[\s-]*off|estimate|invoice|ticket|quote)\b/.test(haystack)) {
    return category("work_file", "Work file", "bg-blue-50 text-blue-700 border-blue-200")
  }

  if (/\b(manual|spec|cut\s*sheet|datasheet|data\s*sheet|instruction|install)\b/.test(haystack)) {
    return category("manual", "Manual / spec", "bg-indigo-50 text-indigo-700 border-indigo-200")
  }

  if (/\b(warranty|guarantee|registration)\b/.test(haystack)) {
    return category("warranty", "Warranty", "bg-purple-50 text-purple-700 border-purple-200")
  }

  if (mime.startsWith("image/")) {
    return category("photo", "Photo / image", "bg-amber-50 text-amber-700 border-amber-200")
  }

  if (assetDocumentKindLabel(doc) === "Spreadsheet" || assetDocumentKindLabel(doc) === "CSV") {
    return category("spreadsheet", "Spreadsheet", "bg-lime-50 text-lime-700 border-lime-200")
  }

  if (assetDocumentKindLabel(doc) === "Text") {
    return category("text", "Text note", "bg-slate-50 text-slate-700 border-slate-200")
  }

  return category("general", "Asset file", "bg-slate-50 text-slate-700 border-slate-200")
}

export function canPreviewAssetDocument(doc: Pick<AssetDocument, "file_url" | "mime_type" | "original_filename">): boolean {
  if (!doc.file_url) return false
  const kind = assetDocumentKindLabel(doc)
  return kind === "PDF" || kind === "Image" || kind === "Text" || kind === "CSV"
}

function category(key: AssetDocumentCategory, label: string, className: string) {
  return { key, label, className }
}
