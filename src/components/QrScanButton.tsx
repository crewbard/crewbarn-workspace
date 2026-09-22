import { useState, useRef, useEffect, useCallback } from "react"

/**
 * QrScanButton — opens a camera modal and decodes QR codes.
 *
 * Uses BarcodeDetector API natively (Chrome, Edge, Safari iOS 17+).
 * Falls back to @zxing/library on Firefox + older Safari via dynamic
 * import — only loaded when needed, keeping the main bundle smaller.
 *
 * Camera access requires HTTPS (browser security). Works on:
 *   - https://app.crewbarn.com (production)
 *   - http://localhost:* (dev — browsers allow camera on localhost)
 * Does NOT work on:
 *   - http://192.168.x.x or other LAN HTTP addresses
 *
 * SLICE-2.5: Camera scanner - see docs/CREWBARN-ASSETS-SLICES.md#slice-25
 */

interface QrScanButtonProps {
  onScan: (decodedValue: string) => void
  buttonLabel?: string
  buttonClassName?: string
  disabled?: boolean
}

// Type declaration for BarcodeDetector (not in default TS lib yet)
interface BarcodeDetectorResult {
  rawValue: string
  format: string
}
interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement | ImageBitmap) => Promise<BarcodeDetectorResult[]>
}
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats?: () => Promise<string[]>
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

export function QrScanButton({
  onScan,
  buttonLabel = "📷 Scan QR",
  buttonClassName = "",
  disabled = false,
}: QrScanButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={
          buttonClassName ||
          "text-sm px-3 py-2 rounded bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors"
        }
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <ScannerModal
          onScan={(value) => {
            onScan(value)
            setIsOpen(false)
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

// ---------- Scanner modal ----------

function ScannerModal({
  onScan,
  onClose,
}: {
  onScan: (value: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("Starting camera...")

  // Stop camera + scanner cleanly on unmount
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let scanInterval: ReturnType<typeof setInterval> | null = null
    let zxingReader: { reset: () => void } | null = null

    async function startCamera() {
      try {
        // Request rear camera (better for scanning physical QR codes)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setStatus("Point camera at QR code")

        // Try BarcodeDetector first (no library import needed)
        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] })

          scanInterval = setInterval(async () => {
            if (!videoRef.current || cancelled) return
            try {
              const results = await detector.detect(videoRef.current)
              if (results.length > 0 && !cancelled) {
                const value = results[0].rawValue
                cancelled = true
                if (scanInterval) clearInterval(scanInterval)
                onScan(value)
              }
            } catch {
              // Single-frame failures are normal — keep scanning
            }
          }, 300)
        } else {
          // Fallback: dynamic import @zxing/library only when needed
          setStatus("Loading scanner library...")
          const { BrowserMultiFormatReader } = await import("@zxing/library")

          if (cancelled) return

          const reader = new BrowserMultiFormatReader()
          zxingReader = reader as unknown as { reset: () => void }

          setStatus("Point camera at QR code")
          reader.decodeFromVideoElementContinuously(videoRef.current!, (result, _error) => {
            if (result && !cancelled) {
              cancelled = true
              onScan(result.getText())
            }
          })
        }
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error
            ? err.message
            : "Could not access camera"
        // Friendly common cases
        if (message.includes("Permission") || message.includes("NotAllowed")) {
          setError("Camera permission denied. Allow camera access and try again.")
        } else if (message.includes("NotFound")) {
          setError("No camera found on this device.")
        } else if (message.includes("NotReadable")) {
          setError("Camera is in use by another app.")
        } else {
          setError(message)
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (scanInterval) clearInterval(scanInterval)
      if (zxingReader) {
        try { zxingReader.reset() } catch { /* ignore */ }
      }
      stopCamera()
    }
  }, [onScan, stopCamera])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-medium text-slate-900">Scan QR code</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="relative bg-black aspect-square">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-white text-sm">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Scanning frame overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-2/3 aspect-square border-2 border-amber-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
              </div>
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 inline-block px-3 py-1 rounded">
                  {status}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-900 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
