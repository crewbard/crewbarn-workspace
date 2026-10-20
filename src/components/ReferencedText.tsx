import { FlashText } from '@/components/flash/FlashText'
import type { FlashSource } from '@/lib/flashWords'

/**
 * A job description, a note or a message, with the things it refers to
 * turned into links: the shop's part numbers (flash words), the words that
 * open its reference cards, and vehicles in the key reference.
 *
 * Kept as its own name because it is used in many places; FlashText does
 * the work. The text is never rewritten, and if finding mentions fails the
 * words show exactly as they came in. Tenant side only: the customer portal
 * renders the same text plain.
 */
export function ReferencedText({
  text,
  className,
  enabled = true,
  source = 'other',
}: {
  text: string | null | undefined
  className?: string
  enabled?: boolean
  /** A transcript has spoken part numbers ("S C one") recognised too. */
  source?: FlashSource
}) {
  return <FlashText text={text} className={className} enabled={enabled} source={source} />
}
