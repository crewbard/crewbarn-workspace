import { apiRequest } from '@/lib/api'

/**
 * Recorded voice clips for the guided page tours.
 *
 * The server lists every recording by a key made from the line's own text
 * (first 16 hex characters of its SHA-1, OnboardingNarration::textKey), so a
 * line that was edited after it was recorded never plays the old words: it
 * has no match and is spoken live instead.
 */
let clips: Promise<Record<string, string>> | null = null

function loadClips(): Promise<Record<string, string>> {
  if (!clips) {
    clips = apiRequest<{ data: Record<string, string> }>('/v1/guided-tours/clips')
      .then((res) => res?.data ?? {})
      .catch(() => {
        clips = null // try again on the next tour
        return {}
      })
  }
  return clips
}

async function textKey(text: string): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(text.trim())
    const digest = await crypto.subtle.digest('SHA-1', bytes)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  } catch {
    return null // no crypto.subtle (plain http): speak live
  }
}

/** The recorded clip for this exact line, if there is one. */
export async function tourClipFor(text: string): Promise<string | null> {
  const [all, key] = await Promise.all([loadClips(), textKey(text)])
  return key ? all[key] ?? null : null
}

/** Start loading the clip list early (e.g. when Help opens). */
export function warmTourClips() {
  void loadClips()
}
