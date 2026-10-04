import { useEffect, useRef, useState } from 'react'

import { API_URL, getActingTenant, getStoredToken } from '@/lib/api'

/**
 * Audio from an endpoint that needs our credentials.
 *
 * A plain `<audio src>` cannot send an Authorization header, so the recording
 * URL used to carry `?access_token=<the user's session token>` instead. That
 * worked, and it put a full API token — not a scoped, short-lived one — into
 * browser history, server access logs, proxy logs and any Referer sent from
 * that tab. Anyone who came by that URL held the whole session, not one call.
 *
 * So the audio is fetched the way every other authenticated request is, with
 * the header, and played from a blob that exists only in this tab's memory.
 * Nothing shareable is ever produced: no URL to leak, nothing to screenshot,
 * no entry in a log.
 *
 * Deliberately lazy. Call recordings are large and most are never played, so
 * nothing is fetched until somebody asks for it.
 */
export function AuthedAudio({
  src,
  className,
  autoPlay,
}: {
  /** Absolute URL on our own API. Credentials are never sent elsewhere. */
  src: string
  className?: string
  autoPlay?: boolean
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const created = useRef<string | null>(null)

  // Revoke on unmount and whenever a new one replaces it; a blob that is
  // never revoked holds the whole file in memory for the life of the tab.
  useEffect(() => {
    return () => {
      if (created.current) URL.revokeObjectURL(created.current)
    }
  }, [])

  useEffect(() => {
    if (created.current) {
      URL.revokeObjectURL(created.current)
      created.current = null
    }
    setObjectUrl(null)
    setError(null)
  }, [src])

  const load = async () => {
    if (loading || objectUrl) return
    setLoading(true)
    setError(null)
    try {
      // The token goes only to our own API. A provider link is a third party.
      if (!src.startsWith(API_URL)) {
        throw new Error('Refusing to send credentials off-site.')
      }
      const headers: Record<string, string> = { Accept: 'audio/*' }
      const token = getStoredToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const tenant = getActingTenant()
      if (tenant) headers['X-Act-As-Tenant'] = tenant

      const res = await fetch(src, { headers })
      if (!res.ok) throw new Error(`Recording unavailable (${res.status})`)

      const url = URL.createObjectURL(await res.blob())
      created.current = url
      setObjectUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recording unavailable.')
    } finally {
      setLoading(false)
    }
  }

  if (objectUrl) {
    return <audio controls autoPlay={autoPlay} src={objectUrl} className={className} />
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? 'Loading…' : '▶ Play recording'}
      </button>
      {error && <p className="mt-1 text-[12px] font-semibold text-rose-700">{error}</p>}
    </div>
  )
}
