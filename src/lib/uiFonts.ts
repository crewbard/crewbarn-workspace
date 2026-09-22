/**
 * UI typography options for Branding & appearance — the app's text typeface
 * and reading size. Per-browser prefs (useTheme), applied as `--ui-font` and
 * `--ui-base` on the document (see index.css `body`).
 *
 * Inter and System need no loading. Public Sans / Source Sans 3 are pulled in
 * by the font pipeline when offered in the picker; until then a chosen-but-
 * unloaded face falls back gracefully through the stack.
 */
export interface UiFontOption {
  id: string
  name: string
  note: string
  /** CSS font-family stack written to `--ui-font`. */
  stack: string
  /** Stylesheet to load on demand (webfonts). Omitted for OS/stack faces. */
  href?: string
}

export const UI_FONTS: UiFontOption[] = [
  {
    id: 'inter',
    name: 'Inter',
    note: 'Current — crisp and neutral',
    stack: '"Inter", system-ui, -apple-system, sans-serif',
  },
  {
    id: 'publicsans',
    name: 'Public Sans',
    note: 'Open & legible',
    stack: '"Public Sans", "Inter", system-ui, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=optional',
  },
  {
    id: 'sourcesans',
    name: 'Source Sans 3',
    note: 'Warm & humanist',
    stack: '"Source Sans 3", "Inter", system-ui, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700;800&display=optional',
  },
  {
    id: 'system',
    name: 'System',
    note: 'Matches the device',
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
]

export const DEFAULT_UI_FONT = 'inter'

export function uiFontStack(id: string): string {
  return (UI_FONTS.find((f) => f.id === id) ?? UI_FONTS[0]).stack
}

/**
 * Ensure the webfont stylesheet for a font id is in the document — a no-op for
 * OS/stack faces and for a font already loaded. Called when the typeface pref
 * changes, so we only fetch fonts a tenant actually chose.
 */
export function ensureUiFontLoaded(id: string): void {
  if (typeof document === 'undefined') return
  const href = UI_FONTS.find((f) => f.id === id)?.href
  if (!href) return
  const attr = 'data-ui-font'
  if (document.head.querySelector(`link[${attr}="${id}"]`)) return

  // Warm the font hosts once (harmless if repeated; guarded by the link check).
  for (const preconnect of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
    if (!document.head.querySelector(`link[rel="preconnect"][href="${preconnect}"]`)) {
      const pc = document.createElement('link')
      pc.rel = 'preconnect'
      pc.href = preconnect
      if (preconnect.includes('gstatic')) pc.crossOrigin = 'anonymous'
      document.head.appendChild(pc)
    }
  }

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.setAttribute(attr, id)
  document.head.appendChild(link)
}

export type TextScale = 'comfortable' | 'large' | 'xlarge'

export interface TextScaleOption {
  id: TextScale
  name: string
  px: string
}

export const TEXT_SCALES: TextScaleOption[] = [
  // Comfortable = 16px, the app's prior implicit base — so the default look is
  // unchanged and text size only shifts when a user picks Large / Extra large.
  { id: 'comfortable', name: 'Comfortable', px: '16px' },
  { id: 'large', name: 'Large', px: '17.5px' },
  { id: 'xlarge', name: 'Extra large', px: '19px' },
]

export const DEFAULT_TEXT_SCALE: TextScale = 'comfortable'

export function textScalePx(id: string): string {
  return (TEXT_SCALES.find((s) => s.id === id) ?? TEXT_SCALES[0]).px
}
