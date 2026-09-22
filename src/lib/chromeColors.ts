/**
 * Chrome colors — the dark surface color of the app's navigation chrome
 * (the pro Sidebar + the top bar, in both classic and pro themes). Only
 * the chrome is colored; the page body always stays light.
 *
 * Each preset is a single dark base hex. Hover / active / border / muted
 * states are expressed as white-alpha overlays (bg-white/10, text-white/70,
 * …) in the components, so every color stays legible with white text
 * without needing a hand-tuned shade ramp per option.
 *
 * Applied by writing `--chrome-bg` onto <html> (see useTheme). A matching
 * default lives in index.css so there's no flash before JS runs.
 */
export interface ChromeColor {
  id: string
  name: string
  /** Base surface hex — must be dark enough for white text to read on it. */
  hex: string
}

export const CHROME_COLORS: ChromeColor[] = [
  { id: 'navy', name: 'Navy', hex: '#0F1A2E' },
  { id: 'slate', name: 'Slate', hex: '#1E293B' },
  { id: 'charcoal', name: 'Charcoal', hex: '#1C1C1E' },
  { id: 'forest', name: 'Forest', hex: '#0B3D2E' },
  { id: 'teal', name: 'Teal', hex: '#0E3D40' },
  { id: 'ocean', name: 'Ocean', hex: '#0C3A66' },
  { id: 'indigo', name: 'Indigo', hex: '#2B2A6B' },
  { id: 'plum', name: 'Plum', hex: '#3C1D54' },
  { id: 'burgundy', name: 'Burgundy', hex: '#4C1326' },
]

export const DEFAULT_CHROME = 'navy'

export function chromeHex(id: string): string {
  if (/^#[0-9a-f]{6}$/i.test(id)) {
    return id
  }

  return (CHROME_COLORS.find((c) => c.id === id) ?? CHROME_COLORS[0]).hex
}

export function isCustomChromeColor(id: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(id)
}
