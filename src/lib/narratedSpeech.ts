import { API_URL, getActingTenant, getFranchiseActAs, getStoredToken } from '@/lib/api'
import { getReadbackSpeed, getReadbackVoice, type ReadbackSpeed, type ReadbackVoice } from '@/lib/aiHelp'

let activeAudio: HTMLAudioElement | null = null
let activeAudioUrl: string | null = null
let activeRequest: AbortController | null = null

export function stopNarration() {
  activeRequest?.abort()
  activeRequest = null
  activeAudio?.pause()
  activeAudio = null
  if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl)
  activeAudioUrl = null
  window.speechSynthesis?.cancel()
}

export async function narrate(text: string, voice: ReadbackVoice = getReadbackVoice(), speed: ReadbackSpeed = getReadbackSpeed()): Promise<'server' | 'device' | 'cancelled'> {
  const clean = text.replace(/[*_`#>]/g, '').trim()
  if (!clean) return 'device'
  stopNarration()
  const controller = new AbortController()
  activeRequest = controller
  try {
    const headers: Record<string, string> = { Accept: 'audio/*', 'Content-Type': 'application/json' }
    const token = getStoredToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const actingTenant = getActingTenant()
    if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
    const franchiseActAs = getFranchiseActAs()
    if (franchiseActAs) headers['X-Franchise-Act-As'] = franchiseActAs.id
    const response = await fetch(`${API_URL}/v1/ai/speech`, { method: 'POST', headers, signal: controller.signal, body: JSON.stringify({ text: clean, voice, speed }) })
    if (!response.ok) return speakWithDevice(clean, speed)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    activeAudio = audio
    activeAudioUrl = url
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null
      if (activeAudioUrl === url) activeAudioUrl = null
      URL.revokeObjectURL(url)
    }
    await audio.play()
    return 'server'
  } catch (error) {
    if (controller.signal.aborted || (error as Error).name === 'AbortError') return 'cancelled'
    return speakWithDevice(clean, speed)
  }
}

function speakWithDevice(text: string, speed: ReadbackSpeed): 'device' {
  const synth = window.speechSynthesis
  if (!synth) return 'device'
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = speed
  synth.speak(utterance)
  return 'device'
}
