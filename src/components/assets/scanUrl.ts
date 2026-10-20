/**
 * Public scan links for asset stickers.
 *
 * A printed sticker has to open in a plain phone camera, so it encodes the
 * full public scan URL (the same shape the group placard uses):
 *   <origin>/scan/<tenantId>/<code>
 * The in-app scanners accept either that URL or a bare code, so
 * `extractScanCode` turns whatever was scanned back into the code.
 */
export function assetScanUrl(tenantId: string | null | undefined, code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const tenant = (tenantId ?? '').trim()
  return tenant
    ? `${origin}/scan/${encodeURIComponent(tenant)}/${encodeURIComponent(code)}`
    : `${origin}/scan/${encodeURIComponent(code)}`
}

/** Returns the code from a full scan URL, or the trimmed text when it is already a bare code. */
export function extractScanCode(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const parts = url.pathname.split('/').filter(Boolean)
      const scanIndex = parts.indexOf('scan')
      if (scanIndex >= 0) {
        const rest = parts.slice(scanIndex + 1)
        const last = rest[rest.length - 1]
        if (last) return decodeURIComponent(last)
      }
      const q = url.searchParams.get('code') ?? url.searchParams.get('scan')
      if (q) return extractScanCode(q)
    } catch {
      return trimmed
    }
  }
  return trimmed
}
