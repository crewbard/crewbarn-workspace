import { API_URL, getActingTenant, getFranchiseActAs, getStoredToken } from '@/lib/api'

/**
 * One spoken line for the guided tours, with live caption progress.
 *
 * Order of preference:
 *  1. A pre-recorded clip (natural voice, recorded once into R2) — works for a
 *     brand-new shop that hasn't connected any AI account yet.
 *  2. The shop's own server read-back (/v1/ai/speech), when it has a key.
 *  3. The best-sounding voice the browser has. Edge's "Natural" voices and
 *     Chrome's Google voices are far less robotic than the system default
 *     that speechSynthesis picks on its own.
 */

export type LineResult = 'ended' | 'cancelled'

type Active = { stop: () => void }
let active: Active | null = null

export function stopLine() {
  const current = active
  active = null
  current?.stop()
  try { window.speechSynthesis?.cancel() } catch { /* no speech */ }
}

const prefetched = new Map<string, HTMLAudioElement>()
export function prefetchClip(url?: string | null) {
  if (!url || prefetched.has(url)) return
  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = url
  prefetched.set(url, audio)
}

export async function speakLine(options: {
  text: string
  clipUrl?: string | null
  voice?: string
  onProgress?: (fraction: number) => void
}): Promise<LineResult> {
  stopLine()
  const text = options.text.replace(/[*_`#>]/g, '').trim()
  if (!text) return 'ended'
  const token: Active = { stop: () => {} }
  active = token
  const live = () => active === token

  if (options.clipUrl) {
    const result = await playUrl(options.clipUrl, token, options.onProgress)
    if (result !== 'failed' || !live()) return result === 'failed' ? 'cancelled' : result
  }

  // Shared with prefetchSpeech(), so a line fetched ahead plays at once.
  const pending = serverSpeech(text, options.voice ?? 'marin')
  const blob = await new Promise<Blob | null>((resolve) => {
    token.stop = () => resolve(null)
    void pending.then(resolve)
  })
  if (!live()) return 'cancelled'
  if (blob) {
    const url = URL.createObjectURL(blob)
    const result = await playUrl(url, token, options.onProgress)
    URL.revokeObjectURL(url)
    if (result !== 'failed' || !live()) return result === 'failed' ? 'cancelled' : result
  }

  return speakWithBrowser(text, token, options.onProgress)
}

function playUrl(url: string, token: Active, onProgress?: (fraction: number) => void): Promise<LineResult | 'failed'> {
  return new Promise((resolve) => {
    const audio = prefetched.get(url) ?? new Audio(url)
    prefetched.delete(url)
    let frame = 0
    let settled = false
    const finish = (result: LineResult | 'failed') => {
      if (settled) return
      settled = true
      cancelAnimationFrame(frame)
      audio.onended = null
      audio.onerror = null
      resolve(result)
    }
    const tick = () => {
      if (audio.duration && Number.isFinite(audio.duration)) onProgress?.(Math.min(1, audio.currentTime / audio.duration))
      frame = requestAnimationFrame(tick)
    }
    token.stop = () => { audio.pause(); finish('cancelled') }
    audio.onended = () => { onProgress?.(1); finish('ended') }
    audio.onerror = () => finish('failed')
    audio.currentTime = 0
    audio.play().then(() => { frame = requestAnimationFrame(tick) }).catch((error: Error) => {
      // Autoplay refusal is not a broken clip; report it as cancelled so the
      // tour simply waits for the next click instead of trying other voices.
      finish(error?.name === 'NotAllowedError' ? 'cancelled' : 'failed')
    })
  })
}

// Live-speech results by text, newest last. Fetching ahead (prefetchSpeech)
// and speaking share the same request, so nothing is fetched twice.
const speechCache = new Map<string, Promise<Blob | null>>()
const SPEECH_CACHE_LIMIT = 30

function serverSpeech(text: string, voice: string): Promise<Blob | null> {
  const key = `${voice}|${text}`
  const cached = speechCache.get(key)
  if (cached) return cached
  const pending = fetchServerSpeech(text, voice).then((blob) => {
    if (!blob) speechCache.delete(key) // try again next time rather than remember a failure
    return blob
  })
  speechCache.set(key, pending)
  while (speechCache.size > SPEECH_CACHE_LIMIT) {
    const oldest = speechCache.keys().next().value
    if (oldest === undefined) break
    speechCache.delete(oldest)
  }
  return pending
}

/** Start fetching a line's live speech now, so it plays without a wait when its turn comes. */
export function prefetchSpeech(text: string, voice = 'marin') {
  const clean = text.replace(/[*_`#>]/g, '').trim()
  if (clean) void serverSpeech(clean, voice)
}

async function fetchServerSpeech(text: string, voice: string): Promise<Blob | null> {
  if (!getStoredToken()) return null
  try {
    const headers: Record<string, string> = { Accept: 'audio/*', 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` }
    const acting = getActingTenant()
    if (acting) headers['X-Act-As-Tenant'] = acting
    const franchise = getFranchiseActAs()
    if (franchise) headers['X-Franchise-Act-As'] = franchise.id
    const response = await fetch(`${API_URL}/v1/ai/speech`, { method: 'POST', headers, body: JSON.stringify({ text, voice, speed: 1 }) })
    if (!response.ok) return null
    return await response.blob()
  } catch {
    return null
  }
}

/**
 * Split a line into pieces the browser voice will finish. Chrome's voices
 * stop part-way through anything longer than about 15 seconds, so a long
 * line is spoken a sentence at a time, and a very long sentence is split
 * at its commas.
 */
function speechChunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+(?:[.!?]+["”’)]*|$)\s*/g)?.map((part) => part.trim()).filter(Boolean) ?? [text]
  const chunks: string[] = []
  for (const sentence of sentences) {
    if (sentence.length <= 180) { chunks.push(sentence); continue }
    let current = ''
    for (const piece of sentence.split(/(?<=[,;:—])\s+/)) {
      if (current && (current + ' ' + piece).length > 180) { chunks.push(current); current = piece }
      else current = current ? `${current} ${piece}` : piece
    }
    if (current) chunks.push(current)
  }
  return chunks.length ? chunks : [text]
}

// Chrome can drop a speaking utterance that nothing references, and then its
// end event never fires. Keep the current one here.
let speaking: SpeechSynthesisUtterance | null = null

function speakWithBrowser(text: string, token: Active, onProgress?: (fraction: number) => void): Promise<LineResult> {
  const synth = window.speechSynthesis
  if (!synth) return Promise.resolve('ended')
  const chunks = speechChunks(text)
  const total = chunks.reduce((n, chunk) => n + chunk.length, 0) || 1
  const voice = pickNaturalVoice()
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: LineResult) => {
      if (settled) return
      settled = true
      if (speaking) speaking.onend = null
      speaking = null
      resolve(result)
    }
    token.stop = () => { synth.cancel(); finish('cancelled') }
    synth.cancel()
    let done = 0
    const speakChunk = (index: number) => {
      if (settled) return
      if (index >= chunks.length) { onProgress?.(1); finish('ended'); return }
      const chunk = chunks[index]
      const utterance = new SpeechSynthesisUtterance(chunk)
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang }
      utterance.rate = voice && /natural|neural|online/i.test(voice.name) ? 1 : 0.96
      utterance.pitch = 1
      utterance.onboundary = (event) => onProgress?.(Math.min(1, (done + event.charIndex + (event.charLength || 0)) / total))
      utterance.onend = () => { done += chunk.length; onProgress?.(Math.min(1, done / total)); speakChunk(index + 1) }
      utterance.onerror = (event) => {
        // "interrupted"/"canceled" mean we stopped it on purpose.
        if (event.error === 'interrupted' || event.error === 'canceled') finish('cancelled')
        else { done += chunk.length; speakChunk(index + 1) }
      }
      speaking = utterance
      synth.speak(utterance)
    }
    speakChunk(0)
  })
}

/** Pick the most human-sounding English voice this browser offers. */
export function pickNaturalVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? []
  if (!voices.length) return null
  const english = voices.filter((voice) => /^en[-_]/i.test(voice.lang))
  const score = (voice: SpeechSynthesisVoice) => {
    const name = voice.name
    let points = 0
    if (/natural/i.test(name)) points += 60 // Edge: "Microsoft Ava Online (Natural)"
    if (/neural|premium|enhanced/i.test(name)) points += 45
    if (/^Google US English/i.test(name)) points += 40
    if (/Google/i.test(name)) points += 25
    if (/\b(Ava|Aria|Jenny|Emma|Andrew|Brian|Guy|Samantha|Allison|Evan|Zoe)\b/i.test(name)) points += 10
    if (/en[-_]US/i.test(voice.lang)) points += 8
    if (/compact|eloquence|espeak|robot|zarvox|whisper|bad news|bells|boing|bubbles|cellos|trinoids|albert|jester|organ|superstar|wobble/i.test(name)) points -= 80
    if (/Microsoft (David|Mark|Zira) Desktop/i.test(name)) points -= 15
    return points
  }
  return [...(english.length ? english : voices)].sort((a, b) => score(b) - score(a))[0] ?? null
}

// Voices load asynchronously in Chrome; touching the list early warms it up.
try { window.speechSynthesis?.getVoices() } catch { /* no speech */ }
