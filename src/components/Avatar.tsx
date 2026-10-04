import { useEffect, useState } from 'react'
import { IconPhone } from '@tabler/icons-react'

/**
 * Avatar — a round identity chip for a customer/contact. Precedence:
 *   1. uploaded photo (imageUrl)
 *   2. a chosen DiceBear illustrated avatar  (preset = "db:<style>")
 *   3. a chosen emoji                        (preset = the emoji)
 *   4. a chosen monogram color               (preset = "#rrggbb")
 *   5. auto monogram: initials on a color hashed from a stable key
 * Images fall back to the monogram if they fail to load.
 */

// Calmer, deeper palette. The monogram renders as a soft tint of the hue with
// a matching ring and the initials in the hue itself — used both for the auto
// default (hashed) and for a color the user picks.
const MONOGRAM_COLORS = [
  '#4F46E5', '#0D9488', '#B45309', '#BE123C', '#0369A1', '#6D28D9',
  '#0F766E', '#C2410C', '#BE185D', '#155E75', '#4D7C0F', '#A21CAF',
]

function hashIndex(s: string, mod: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % mod
}

/**
 * Initials for a monogram, or '' when the name has no letters in it.
 *
 * An unknown caller is identified by their number, and the first letter of
 * each of the first two "words" of "(321) 527-4637" is "(" and "5" — which
 * is what the incoming-call card was showing. A name with letters anywhere
 * in it behaves exactly as before, so "333 by the Sea" still reads "3B".
 */
export function initialsOf(name: string): string {
  if (!/\p{L}/u.test(name)) return ''
  const words = name.trim().split(/\s+/).filter(Boolean)
  const two = (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')
  return (two || name.slice(0, 2)).toUpperCase()
}

/** Pick the monogram color for a customer — chosen #color, else hashed from a stable key. */
export function monogramColor(key: string, preset?: string | null): string {
  if (preset && /^#[0-9a-fA-F]{6}$/.test(preset)) return preset
  return MONOGRAM_COLORS[hashIndex(key || 'x', MONOGRAM_COLORS.length)]
}

export const AVATAR_PRESET_COLORS = MONOGRAM_COLORS

/** DiceBear illustrated-avatar styles — stored as "db:<style>" in avatar_preset. */
export const AVATAR_STYLES = [
  'adventurer', 'avataaars', 'big-smile', 'bottts', 'fun-emoji', 'micah',
  'notionists', 'open-peeps', 'personas', 'pixel-art', 'lorelei', 'thumbs',
]

/** Deterministic illustrated avatar for a seed, in the given DiceBear style. */
export function dicebearUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed || 'x')}`
}

/** Legacy emoji set (still rendered if an old customer picked one). */
export const AVATAR_EMOJIS = [
  '😎', '🤠', '🥸', '🥷', '🧙', '🦸', '🦹', '🧛', '🐶', '🐱', '🦊', '🐻',
  '🦁', '🐯', '🐵', '👽', '🤖', '👻', '🔑', '🚗', '🏠', '⭐', '🔥', '🚀',
]

/**
 * Place avatars — what KIND of customer this is, or where they sit.
 *
 * Every DiceBear style is a person or a character, so a property management
 * company, a restaurant, or a condo association called "333 by the Sea" got a
 * cartoon face and nothing that looked like the account.
 *
 * Property and business types lead: a field service customer list is mostly
 * buildings — property managers, HOAs, restaurants, dealerships, institutions.
 * Coast and landscape follow, for accounts named after where they are.
 *
 * Building types live here rather than in a third row because they're the same
 * question ("what is this place"), and splitting them would have duplicated
 * half the icons across two rows.
 */
export const AVATAR_PLACE_EMOJIS = [
  // Property + housing
  '🏠', '🏘️', '🏢', '🏬', '🏨', '🏗️', '🅿️', '🏚️',
  // Business + institution
  '🏪', '🛒', '🍽️', '☕', '⛽', '🏦', '🏫', '🏥', '🏛️', '⛪', '🏭', '🎬',
  // Coast
  '🌊', '🏖️', '🏝️', '⛵', '⚓', '🐚', '🦀', '🐬', '🐟', '🕊️', '🗼', '🏰',
  // Sky + season
  '🌅', '🌄', '🌈', '☀️', '🌙', '⛈️', '❄️', '🍂',
  // Land
  '🌴', '🌲', '🌳', '🌵', '🏔️', '⛰️', '🏕️', '🌾', '🌻', '🌺', '🍀', '🪵',
]

/**
 * Trade avatars — the work itself, which is what most accounts are actually
 * about. Locks and keys lead because that's the shop this was built for, then
 * hand tools, vehicles, and the other trades CrewBarn serves (electrical,
 * plumbing, HVAC, security) so a tenant that isn't a locksmith still finds
 * something that fits.
 *
 * Same emoji preset path as AVATAR_PLACE_EMOJIS — no storage or render change.
 */
export const AVATAR_OBJECT_EMOJIS = [
  // Locks + keys
  '🔑', '🗝️', '🔒', '🔓', '🔐', '🔏', '🚪', '⛓️',
  // Tools
  '🔧', '🔨', '🪛', '🪚', '🪝', '🧰', '🪜', '⚙️', '🔩', '📏', '🧲', '🔦',
  // Vehicles
  '🚗', '🚙', '🛻', '🚚', '🚐', '🏍️',
  // Other trades
  '💡', '🔌', '🔋', '⚡', '🚿', '🌡️', '🧯', '🚨', '📹', '🛎️', '🪟', '🧱',
]

/** Resolve a "db:<style>[:<seed>]" preset to a DiceBear URL; seed falls back to the key. */
function dicebearFromPreset(preset: string | null | undefined, fallbackSeed: string): string | null {
  if (!preset || !preset.startsWith('db:')) return null
  const [style, seed] = preset.slice(3).split(':')
  return style ? dicebearUrl(style, seed || fallbackSeed) : null
}
function isEmojiPreset(preset?: string | null): boolean {
  return !!preset && !/^#[0-9a-fA-F]{6}$/.test(preset) && !preset.startsWith('db:')
}

export function Avatar({
  name,
  imageUrl,
  colorKey,
  preset,
  size = 32,
  className = '',
}: {
  name: string
  imageUrl?: string | null
  /** Stable key for the hashed color / DiceBear seed (customer id preferred). */
  colorKey?: string | null
  /** "#rrggbb" color, an emoji, or "db:<style>". */
  preset?: string | null
  size?: number
  className?: string
}) {
  const [imgErr, setImgErr] = useState(false)
  const dim = { width: `${size}px`, height: `${size}px` }

  const src = imageUrl || dicebearFromPreset(preset, colorKey || name || 'x')

  // Reset the error flag when the image source changes (switched avatar).
  useEffect(() => setImgErr(false), [src])

  if (src && !imgErr) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        onError={() => setImgErr(true)}
        style={dim}
        className={`inline-block rounded-full object-cover bg-slate-100 ${className}`}
      />
    )
  }

  if (isEmojiPreset(preset)) {
    return (
      <span
        aria-label={name}
        title={name}
        style={{ ...dim, fontSize: `${Math.round(size * 0.58)}px` }}
        className={`inline-flex items-center justify-center rounded-full bg-slate-100 leading-none select-none ${className}`}
      >
        {preset}
      </span>
    )
  }

  const hue = monogramColor(colorKey || name, preset)
  return (
    <span
      aria-label={name}
      title={name}
      style={{
        ...dim,
        backgroundColor: `${hue}1A`,
        color: hue,
        border: `1.5px solid ${hue}66`,
        fontSize: `${Math.round(size * 0.4)}px`,
      }}
      className={`inline-flex items-center justify-center rounded-full font-semibold leading-none select-none ${className}`}
    >
      {/* Digits but no letters is a phone number, so say so with the handset
          rather than with two characters of it. A name that is empty is not a
          phone number, and gets the plain circle it always got. */}
      {initialsOf(name) || (/\d/.test(name) ? <IconPhone size={Math.round(size * 0.5)} stroke={1.8} /> : null)}
    </span>
  )
}
