/**
 * statusColor — shared helpers for job-status color rendering.
 *
 * Historically `job_statuses.color` stored Tailwind color names
 * ("navy", "amber", "emerald") because the picker used a fixed
 * palette. Now the picker uses a real color wheel so new rows save
 * #rrggbb directly. This shim normalizes both shapes so the Schedule
 * calendar, the Job Statuses settings cards, and anywhere else can
 * render the same hex consistently.
 *
 * Native <input type="color"> only accepts #rrggbb, so always feed
 * its `value` through `toHexColor`.
 */

export const TAILWIND_COLOR_HEX: Record<string, string> = {
  navy: '#1e3a8a',
  blue: '#2563eb',
  red: '#dc2626',
  amber: '#d97706',
  yellow: '#eab308',
  orange: '#f97316',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  slate: '#475569',
  gray: '#6b7280',
  zinc: '#52525b',
  stone: '#57534e',
  rose: '#e11d48',
  pink: '#db2777',
  fuchsia: '#c026d3',
  purple: '#9333ea',
  violet: '#7c3aed',
  indigo: '#4f46e5',
  sky: '#0284c7',
  lime: '#84cc16',
  black: '#000000',
  white: '#ffffff',
}

/** Default fallback for statuses with no color set. */
export const STATUS_COLOR_FALLBACK = '#94a3b8'  // slate-400

/**
 * Convert any stored status color value into a usable #rrggbb hex.
 * - "#rrggbb"          → returned as-is
 * - "navy" / "amber" / etc. → mapped via TAILWIND_COLOR_HEX
 * - missing / unknown  → fallback slate-400
 */
export function toHexColor(color: string | null | undefined): string {
  if (!color) return STATUS_COLOR_FALLBACK
  const trimmed = color.trim()
  if (trimmed.startsWith('#')) return trimmed
  return TAILWIND_COLOR_HEX[trimmed.toLowerCase()] ?? STATUS_COLOR_FALLBACK
}

/**
 * Is this hex inside the near-white zone? Such a status would render an
 * (almost) invisible card on the white calendar.
 */
function isNearWhite(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return r >= 0xe8 && g >= 0xe8 && b >= 0xe8
}

/**
 * Status color guaranteed to be visible on the (white) calendar + in the
 * status swatch. Resolves Tailwind names / null via toHexColor, then forces
 * any near-white result to the slate fallback — a white/blank status must
 * never produce an invisible card. Use this anywhere a status color paints
 * a surface (calendar cards, the change-status swatches).
 */
export function visibleStatusColor(color: string | null | undefined): string {
  const hex = toHexColor(color)
  return isNearWhite(hex) ? STATUS_COLOR_FALLBACK : hex
}

/**
 * Pick a readable text color (near-black or near-white) for an
 * arbitrary background hex, using relative luminance.
 */
export function textColorOn(bg: string): string {
  const hex = toHexColor(bg).replace('#', '')
  if (hex.length !== 6) return '#0f172a'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 170 ? '#0f172a' : '#ffffff'
}

/**
 * Quick-pick presets surfaced alongside the freeform wheel. Covers
 * the previously-named tokens so a tenant who liked the old palette
 * gets the same look back from a one-click chip.
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = toHexColor(hex).replace('#', '')
  if (h.length !== 6) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}

function mixWithWhite(hex: string, whiteRatio: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#f1f5f9'
  const ratio = Math.max(0, Math.min(1, whiteRatio))
  return rgbToHex(
    rgb.r * (1 - ratio) + 255 * ratio,
    rgb.g * (1 - ratio) + 255 * ratio,
    rgb.b * (1 - ratio) + 255 * ratio,
  )
}

/** Status accent for rails, borders, and swatches. */
export function statusAccentColor(color: string | null | undefined): string {
  return visibleStatusColor(color)
}

/** Matte/tinted surface for calendar and dispatch cards. */
export function matteStatusBackground(
  primary: string | null | undefined,
  secondary?: string | null | undefined,
): string {
  const a = mixWithWhite(visibleStatusColor(primary), 0.88)
  if (!secondary) return a
  const b = mixWithWhite(visibleStatusColor(secondary), 0.88)
  if (a.toLowerCase() === b.toLowerCase()) return a
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
}

/** Solid middle fill for schedule cards. Secondary color owns the card body. */
export function matteStatusFill(
  outline: string | null | undefined,
  fill?: string | null | undefined,
): string {
  return mixWithWhite(visibleStatusColor(fill || outline), 0.88)
}

/** Soft border companion for matte status cards. */
export function matteStatusBorder(color: string | null | undefined): string {
  return mixWithWhite(visibleStatusColor(color), 0.62)
}

/** Matte cards stay light, so dark text is the most readable default. */
export function matteStatusTextColor(): string {
  return '#0f172a'
}

export const STATUS_COLOR_PRESETS: Array<{ value: string; label: string }> = [
  { value: '#475569', label: 'Slate' },
  { value: '#7c6f4e', label: 'Khaki' },
  { value: '#2f6f5e', label: 'Muted green' },
  { value: '#b7791f', label: 'Amber' },
  { value: '#2c6e91', label: 'Steel blue' },
  { value: '#c56a2d', label: 'Clay' },
  { value: '#8a6d1d', label: 'Olive gold' },
  { value: '#6b7280', label: 'Gray' },
  { value: '#b45309', label: 'Burnt amber' },
  { value: '#2f855a', label: 'Green' },
  { value: '#2563a6', label: 'Muted blue' },
  { value: '#047857', label: 'Deep green' },
  { value: '#7f1d1d', label: 'Muted red' },
  { value: '#4c1d95', label: 'Plum' },
]
/**
 * Render a CSS `background` value for a status — solid when no
 * secondary color is set, gradient (135deg primary → secondary)
 * when both are present. Used by calendar events + status cards
 * so the look stays in sync across the app.
 */
export function statusBackground(
  primary: string | null | undefined,
  secondary: string | null | undefined,
): string {
  const a = toHexColor(primary)
  if (!secondary) return a
  const b = toHexColor(secondary)
  if (a.toLowerCase() === b.toLowerCase()) return a
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
}

// ----------------------------------------------------------------
// Recently-used colors — small localStorage-backed ring buffer so
// the picker remembers the last N colors the user actually picked.
// Shared across statuses / templates / wherever the picker shows up.
// ----------------------------------------------------------------

const RECENTS_KEY = 'crewbarn_color_recents'
const RECENTS_LIMIT = 12

export function getRecentColors(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v))
  } catch {
    return []
  }
}

export function pushRecentColor(hex: string): string[] {
  if (typeof window === 'undefined') return []
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return getRecentColors()
  const normalized = hex.toLowerCase()
  const next = [normalized, ...getRecentColors().filter((c) => c !== normalized)].slice(0, RECENTS_LIMIT)
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    // localStorage full / disabled — drop silently
  }
  return next
}
