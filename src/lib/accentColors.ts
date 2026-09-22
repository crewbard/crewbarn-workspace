/**
 * Accent (brand) colors — the app's single accent hue: primary buttons, the
 * active nav bar, focus rings, "on site"/status-soft badges, links, etc.
 *
 * Every accent surface in the app is painted with an `amber-*` Tailwind
 * utility, and Tailwind v4 compiles those to `var(--color-amber-<shade>)`.
 * So instead of editing hundreds of components, the accent is applied by
 * pointing `--color-amber-<shade>` at `--accent-<shade>` (see index.css) and
 * letting the theme provider rewrite `--accent-*` on <html> from the tenant's
 * choice. Amber stays the seeded default, so the default look is unchanged.
 *
 * Each preset defines a full 11-stop ramp so EVERY amber shade in use
 * (50–950) shifts together and stays in-hue. The four named roles the
 * Branding UI/preview speak in — base / soft / border / text — map to
 * 500 / 50 / 200 / 700, matching the design handoff palette.
 *
 * Per-browser like chrome color: persisted in localStorage by useTheme, no
 * backend. A matching default lives in index.css so there's no flash.
 */
export type AccentShade =
  | '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950'

export interface AccentColor {
  id: string
  name: string
  /** Full light→dark ramp; drives every remapped amber-* utility. */
  ramp: Record<AccentShade, string>
}

/** The shades the branding swatches + preview reference by role. */
export const ACCENT_ROLE_SHADE = {
  base: '500',
  soft: '50',
  border: '200',
  text: '700',
} as const

export const ACCENT_COLORS: AccentColor[] = [
  {
    id: 'amber',
    name: 'Amber',
    // EXACT current amber ramp — keeps the default look pixel-identical.
    ramp: {
      '50': '#FDF7EE', '100': '#FAEBD3', '200': '#F4D7A1', '300': '#EEBD6F',
      '400': '#EAA947', '500': '#E8902C', '600': '#C57519', '700': '#9C5C14',
      '800': '#75450F', '900': '#4F2E0A', '950': '#451A03',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    ramp: {
      '50': '#E7F5EC', '100': '#C7E7D2', '200': '#A7D9B8', '300': '#76BB8F',
      '400': '#469E66', '500': '#15803D', '600': '#167339', '700': '#166534',
      '800': '#124C29', '900': '#0F3821', '950': '#0D291B',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    ramp: {
      '50': '#E8EEFD', '100': '#CEDAF9', '200': '#B3C6F5', '300': '#819EEB',
      '400': '#4F76E2', '500': '#1D4ED8', '600': '#1E47C4', '700': '#1E40AF',
      '800': '#183182', '900': '#13255F', '950': '#0F1C45',
    },
  },
  {
    id: 'teal',
    name: 'Teal',
    ramp: {
      '50': '#E4F3F1', '100': '#C2E4E0', '200': '#9FD5CE', '300': '#6FB5AE',
      '400': '#3F968E', '500': '#0F766E', '600': '#106A64', '700': '#115E59',
      '800': '#0E4644', '900': '#0D3434', '950': '#0B2728',
    },
  },
  {
    id: 'violet',
    name: 'Violet',
    ramp: {
      '50': '#F0E9FB', '100': '#DFD0F6', '200': '#CDB6F0', '300': '#AD87E8',
      '400': '#8D57E1', '500': '#6D28D9', '600': '#6425C8', '700': '#5B21B6',
      '800': '#441B87', '900': '#321662', '950': '#241247',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    ramp: {
      '50': '#FBE8ED', '100': '#F6CED7', '200': '#F0B3C1', '300': '#DF7D95',
      '400': '#CF4868', '500': '#BE123C', '600': '#AF123B', '700': '#9F1239',
      '800': '#75102D', '900': '#540E24', '950': '#3B0D1D',
    },
  },
]

export const DEFAULT_ACCENT = 'amber'

const ACCENT_SHADES: AccentShade[] =
  ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

export function accentById(id: string): AccentColor {
  return ACCENT_COLORS.find((a) => a.id === id) ?? ACCENT_COLORS[0]
}

/**
 * The `--accent-<shade>` CSS variables for an accent id, ready to write onto
 * <html>. Mirrors chromeHex()'s job for the chrome color.
 */
export function accentVars(id: string): Record<string, string> {
  const { ramp } = accentById(id)
  const vars: Record<string, string> = {}
  for (const shade of ACCENT_SHADES) {
    vars[`--accent-${shade}`] = ramp[shade]
  }
  return vars
}

/** The base swatch color for an accent (used by the picker circles). */
export function accentBase(id: string): string {
  return accentById(id).ramp[ACCENT_ROLE_SHADE.base]
}
