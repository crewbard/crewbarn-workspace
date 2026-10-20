import { useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { API_URL, getStoredToken, getActingTenant } from "@/lib/api"
import { assetScanUrl } from "@/components/assets/scanUrl"

/**
 * AssetQrCard — displays the QR code for an asset and provides a print
 * button.
 *
 * The QR PNG is served by the backend at /v1/assets/{id}/qr.png which
 * redirects to a CDN-cached image at images.crewbarn.com.
 *
 * Because the API endpoint requires auth headers (Bearer token + tenant),
 * we cannot use it directly as an <img src>. Instead we fetch it as a blob,
 * convert to a data URL, and use that. The browser caches the data URL
 * locally for the modal lifetime; subsequent re-opens hit the API again
 * but the API itself returns instantly because R2 is already cached.
 *
 * Print: opens a new window with just the QR + asset name + code, sized
 * for label printing. User triggers OS print dialog from there.
 *
 */
export function AssetQrCard({
  assetId,
  assetCode,
  tenantId,
}: {
  assetId: string
  /** When given, the QR is drawn here with the same public scan URL the printed label uses. */
  tenantId?: string | null
  /**
   * Kept in the call-site signature for backwards compatibility with
   * existing callers that pass it; intentionally ignored now that
   * the print flow opens /assets/{id}/labels which fetches its own
   * data.
   */
  assetName?: string
  assetCode: string | null
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadQr() {
    setIsLoading(true)
    setError(null)
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      }
      const token = getStoredToken()
      if (token) headers["Authorization"] = `Bearer ${token}`
      const acting = getActingTenant()
      if (acting) headers["X-Act-As-Tenant"] = acting

      // Backend returns { url, asset_code }. The url points at images.crewbarn.com
      // which is public-readable, so we can use it directly in <img src> without
      // sending any auth headers (which would trigger a CORS preflight).
      const response = await fetch(`${API_URL}/v1/assets/${assetId}/qr.png`, {
        method: "GET",
        headers,
      })
      if (!response.ok) {
        throw new Error(`Failed to load QR (HTTP ${response.status})`)
      }
      const json = await response.json()
      setQrUrl(json.url)
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load QR")
      setIsLoading(false)
    }
  }
  const scanUrl = tenantId && assetCode ? assetScanUrl(tenantId, assetCode) : null

  // Auto-load on first render (only when we can't draw the scan-URL QR locally)
  if (!scanUrl && !qrUrl && !isLoading && !error) {
    loadQr()
  }

  if (!assetCode) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
        This asset has no code yet. Save the asset to generate one.
      </div>
    )
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-4 flex items-start gap-4">
      <div className="flex-shrink-0">
        {scanUrl && (
          <div className="w-32 h-32 border border-slate-200 rounded bg-white flex items-center justify-center">
            <QRCodeCanvas value={scanUrl} size={116} level="M" />
          </div>
        )}
        {!scanUrl && isLoading && (
          <div className="w-32 h-32 bg-slate-200 rounded animate-pulse flex items-center justify-center text-slate-400 text-xs">
            Loading...
          </div>
        )}
        {!scanUrl && error && (
          <div className="w-32 h-32 bg-red-50 border border-red-200 rounded flex items-center justify-center text-red-600 text-xs text-center px-2">
            {error}
          </div>
        )}
        {!scanUrl && qrUrl && !error && (
          <img
            src={qrUrl}
            alt="Asset QR code"
            className="w-32 h-32 border border-slate-200 rounded bg-white"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">
          CrewBarn QR sticker
        </div>
        <div className="font-mono text-sm text-slate-900 mb-2 truncate" title={assetCode}>
          {assetCode}
        </div>
        <p className="text-xs text-slate-600 mb-3">
          This QR opens the public scan page for this asset in any phone camera. Print it and stick it on the equipment, or keep an existing sticker and type its code above. CrewBarn looks up by code either way.
        </p>
        <a
          href={`/assets/${assetId}/labels`}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-800 text-white font-medium transition-colors"
        >
          🖨 Print sticker
        </a>
      </div>
    </div>
  )
}

