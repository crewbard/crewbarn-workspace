import type { DocumentTab, TabColor } from '@/lib/referenceCards'

/**
 * Index-tab colours, as printed catalogues use them: strong enough to
 * find with a thumb, each with the text colour that reads on it.
 */
export const SWATCH: Record<TabColor, { bg: string; fg: string; name: string }> = {
  slate: { bg: '#5b6576', fg: '#ffffff', name: 'Grey' },
  blue: { bg: '#2563c9', fg: '#ffffff', name: 'Blue' },
  green: { bg: '#2f8a3e', fg: '#ffffff', name: 'Green' },
  yellow: { bg: '#f2c230', fg: '#2b2410', name: 'Yellow' },
  orange: { bg: '#e8742a', fg: '#ffffff', name: 'Orange' },
  red: { bg: '#cf3a2f', fg: '#ffffff', name: 'Red' },
  navy: { bg: '#1f3a73', fg: '#ffffff', name: 'Navy' },
  teal: { bg: '#178a87', fg: '#ffffff', name: 'Teal' },
  purple: { bg: '#6d4bc4', fg: '#ffffff', name: 'Purple' },
  pink: { bg: '#cc4a8c', fg: '#ffffff', name: 'Pink' },
}

/** A tab with no colour of its own takes the next one round. */
const ROUND: TabColor[] = ['blue', 'green', 'yellow', 'orange', 'red', 'teal', 'purple', 'pink', 'navy', 'slate']

export function colorOf(tab: DocumentTab, index: number): TabColor {
  return tab.color ?? ROUND[index % ROUND.length]
}
