import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { readImage } from '@/lib/referenceCardDocuments'

/** A blob as something an <img> can show. Null until it is ready. */
export function useObjectUrl(blob: Blob | null): string | null {
  /*
   * A data URL rather than an object URL: nothing to revoke, so React's
   * double-run of effects in development cannot pull the picture out from
   * under the <img>. These are small pictures; the size does not matter.
   */
  const [read, setRead] = useState<{ blob: Blob; url: string } | null>(null)

  useEffect(() => {
    if (!blob) return
    let live = true
    const reader = new FileReader()
    reader.onload = () => live && setRead({ blob, url: String(reader.result) })
    reader.readAsDataURL(blob)
    return () => {
      live = false
    }
  }, [blob])

  return blob && read?.blob === blob ? read.url : null
}

/** A card's picture, streamed with the session. Null while loading or when it has none. */
export function useCardPicture(cardId: string | null, enabled = true): string | null {
  const q = useQuery({
    queryKey: ['reference-card-picture', cardId],
    queryFn: () => readImage(`/v1/reference-cards/${cardId}/picture`),
    enabled: enabled && !!cardId,
    staleTime: 5 * 60 * 1000,
  })
  return useObjectUrl(q.data ?? null)
}
