/**
 * Fetch every screen's file in the background once the app is up.
 *
 * Screens load the first time they're opened (main.tsx), so the first screen
 * appears without waiting for the rest. Warming them afterwards means:
 *   - opening a screen is instant, with no "Loading…";
 *   - a tab left open across a deploy keeps working. Cloudflare Pages serves
 *     only the newest deploy's /assets, so a screen first opened after a
 *     deploy couldn't load its old file. It's in this browser's cache now.
 *
 * The build lists the files in #crewbarn-chunks (vite.config.ts), and
 * public/_headers lets the browser keep them for a year, so this downloads
 * each deploy's files once. Skipped with data saver on or on a 2G connection.
 */

const START_AFTER_MS = 3000
const AT_ONCE = 3

type NetworkInformation = { saveData?: boolean; effectiveType?: string }

function listedFiles(): string[] {
  const el = document.getElementById('crewbarn-chunks')
  if (!el?.textContent) return []
  try {
    const parsed: unknown = JSON.parse(el.textContent)
    return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === 'string' && f.startsWith('/assets/')) : []
  } catch {
    return []
  }
}

export function warmLazyChunks(): void {
  const files = listedFiles()
  if (files.length === 0) return

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return

  const start = () => {
    const queue = [...files]
    const next = async (): Promise<void> => {
      const url = queue.shift()
      if (!url) return
      try {
        const res = await fetch(url, { priority: 'low' } as RequestInit)
        await res.blob()
      } catch {
        // Offline or blocked: the screen still loads when it's opened.
      }
      return next()
    }
    for (let i = 0; i < AT_ONCE; i++) void next()
  }

  const later = () => window.setTimeout(start, START_AFTER_MS)
  if (document.readyState === 'complete') later()
  else window.addEventListener('load', later, { once: true })
}
