/** Colours and number formatting for the Bins screen (from the approved mockup). */
import type { CSSProperties } from 'react'
import { FILL_LABELS, RELATIVE_LABELS, type NodeType, type Tone } from '@/lib/binTree'

/**
 * The type colours, as theme variables (bins.css) so a theme can retune
 * them. A location is drawn in the theme's own dark chrome colour.
 */
export const TYPE_COLOR: Record<NodeType, string> = {
  location: 'var(--bins-dark, #0F1A2E)',
  rack: 'var(--bins-type-rack, #7C5CE0)',
  shelf: 'var(--bins-type-shelf, #2F7FD8)',
  bin: 'var(--bins-type-bin, #D06A0C)',
  row: 'var(--bins-type-row, #5B677C)',
  other: 'var(--bins-type-other, #5B677C)',
}

export const TYPE_LABEL: Record<NodeType, string> = {
  location: 'Location',
  rack: 'Racks',
  shelf: 'Shelves',
  bin: 'Bins',
  row: 'Rows',
  other: 'Other',
}

/** Fill colours, light to full. Empty is striped, not coloured. */
export const FILL_BG = {
  empty: '#EEF0F4',
  light: '#D7F0E0',
  healthy: '#7FD39D',
  well: '#22A35A',
  near: '#F2A54A',
  over: '#E5484D',
  some: '#D7F0E0',
  more: '#7FD39D',
} as const

export const HATCH: CSSProperties = {
  backgroundColor: FILL_BG.empty,
  backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 5px, rgba(152,162,182,.28) 5px 6px)',
}

export function toneStyle(tone: Tone): CSSProperties {
  if (tone.bucket === 'empty') return HATCH
  return { backgroundColor: FILL_BG[tone.bucket] }
}

/** Dark text on light fills, white on the strong ones. */
export function toneInk(tone: Tone): string {
  return tone.bucket === 'well' || tone.bucket === 'over' ? '#FFFFFF' : '#0B1220'
}

export function toneLabel(tone: Tone): string {
  return tone.mode === 'capacity' ? FILL_LABELS[tone.bucket] : RELATIVE_LABELS[tone.bucket]
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

