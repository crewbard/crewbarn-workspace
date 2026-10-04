import { AuthedAudio } from '@/components/comms/AuthedAudio'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { API_URL, apiRequest, getActingTenant, getFranchiseActAs, getStoredToken } from '@/lib/api'
import {
  setAiHelpOpener,
  setAiHelpPanelOpen,
  pageHelpSeed,
  getReadbackEnabled,
  getReadbackSpeed,
  getReadbackVoice,
  setReadbackEnabled,
  setReadbackSpeed,
  setReadbackVoice,
  type ReadbackSpeed,
  type ReadbackVoice,
} from '@/lib/aiHelp'
import { useAuth } from '@/hooks/useAuth'

interface AiStatus {
  ai_provider: string | null
  ai_key_present: boolean
  ai_enabled: boolean
}

interface ChatResp {
  ok: boolean
  text: string
  error: string | null
  model: string | null
  latency_ms: number | null
  cost_usd: number | null
  tools_used?: string[]
  supports_tools?: boolean
  call_recordings?: CallRecording[]
  navigation_links?: NavigationLink[]
  resource_links?: NavigationLink[]
}

interface NavigationLink {
  label: string
  to: string
  action_label?: string | null
  action_url?: string | null
}

interface CallRecording {
  call_id: string
  when: string | null
  customer: string | null
  phone: string | null
  direction: string | null
  has_recording: boolean
  customer_link: string | null
  create_job_link: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  tools_used?: string[]
  error?: string | null
  call_recordings?: CallRecording[]
  navigation_links?: NavigationLink[]
  resource_links?: NavigationLink[]
}

interface AiLearningCorrectionResp {
  data: {
    id: string
    category: string
    title: string
    status: 'confirmed' | 'suggested' | 'rejected' | 'inactive'
    active: boolean
    approved_at: string | null
  } | null
  discarded: boolean
  reason: string | null
  flags: {
    is_noise?: boolean
    is_duplicate?: boolean
    risk_level?: 'low' | 'medium' | 'high'
  }
  message: string
}

/**
 * Prebuilt prompts shown when the chat is empty. Click to send.
 */
const SUGGESTIONS: { label: string; prompt: string }[] = [
  { label: "How's the shop today?", prompt: "How's the shop today? Give me the key numbers." },
  { label: 'Show me open jobs', prompt: 'Show me my open jobs.' },
  { label: "What's scheduled today?", prompt: "What's on the schedule today, grouped by tech?" },
  { label: "Who's overdue?", prompt: "Show me overdue invoices, biggest first." },
  { label: 'Revenue this month', prompt: 'Give me revenue numbers for this month.' },
  { label: 'Warranties expiring soon', prompt: 'List warranties expiring in the next 30 days.' },
  { label: 'Low stock items', prompt: 'What inventory is low or out?' },
  { label: 'Approved estimates', prompt: 'Show me my approved estimates.' },
  { label: 'Sales pipeline', prompt: "What's in my sales pipeline?" },
  { label: 'Unbilled completed jobs', prompt: "Show me completed jobs that haven't been invoiced yet — what revenue is sitting unbilled?" },
  { label: 'Dormant jobs', prompt: 'What jobs are sitting dormant — open or in-progress with no update in over a week?' },
  { label: 'Past-due scheduled jobs', prompt: "Show me jobs scheduled in the past that aren't marked complete." },
  { label: 'Pending signatures', prompt: "What signature requests are still pending? Show me anything waiting more than a few days." },
  { label: 'Recent extracted docs', prompt: 'Show me the documents I extracted with AI recently.' },
]

const READBACK_VOICES: { value: ReadbackVoice; label: string }[] = [
  { value: 'marin', label: 'Marin' },
  { value: 'cedar', label: 'Cedar' },
  { value: 'alloy', label: 'Alloy' },
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'nova', label: 'Nova' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'sage', label: 'Sage' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'verse', label: 'Verse' },
]

const READBACK_SPEEDS: { value: ReadbackSpeed; label: string }[] = [
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
]

/**
 * HeaderAiInput — sparkle button in the top bar that opens a slide-out
 * chat panel. Multi-turn conversation: each new prompt includes prior
 * turns as plain-text context so the AI can follow up.
 *
 * Hidden entirely when AI is disabled / unconfigured / keyless.
 */
export function HeaderAiInput() {
  const [open, setOpen] = useState(false)
  // Seed prompt set when opened externally (the floating AI Help bubble).
  // null = opened normally (no auto-send). A bumping key forces a fresh
  // overlay so a new seed re-sends even if the panel was already open.
  const [seed, setSeed] = useState<{ prompt: string; display?: string; key: number } | null>(null)
  const { account } = useAuth()

  // Skip the query entirely if there's no concrete tenant context. The
  // /v1/settings/ai endpoint requires an acting tenant, so platform
  // admins in bypass mode would otherwise fire a 422 on every page —
  // ugly in the console and pointless work.
  const hasTenantContext = !!(account?.tenant?.id || getActingTenant())

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'ai'],
    queryFn: () => apiRequest<{ data: AiStatus }>('/v1/settings/ai'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: hasTenantContext,
  })

  const status = data?.data
  const visible = !!(status?.ai_enabled && status?.ai_provider && status?.ai_key_present)

  // Register the external opener whenever AI is available, so the floating
  // AI Help bubble (and per-page help) can open this same panel + seed a
  // first message. Cleared when AI isn't available.
  useEffect(() => {
    if (!visible) {
      setAiHelpOpener(null)
      return
    }
    setAiHelpOpener((seedPrompt?: string, seedDisplay?: string) => {
      setOpen(true)
      setSeed(seedPrompt ? { prompt: seedPrompt, display: seedDisplay, key: Date.now() } : null)
    })
    return () => setAiHelpOpener(null)
  }, [visible])

  // Publish open/closed so the floating AI Help bubble can hide while the
  // panel is up (otherwise the bubble overlaps the panel's send button).
  useEffect(() => {
    setAiHelpPanelOpen(open)
    return () => setAiHelpPanelOpen(false)
  }, [open])

  if (isLoading || !data) return null
  if (!visible) return null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSeed(null)
          setOpen(true)
        }}
        className="relative ml-3 mr-1 flex items-center justify-center w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 shadow-sm transition-colors"
        title="Open CBI — CrewBarn Intelligence"
      >
        <span className="text-[11px] font-extrabold tracking-tight text-[#0B1220]">CBI</span>
        <span className="absolute -top-0.5 right-0.5 text-[10px] font-bold leading-none text-[#FDE9C8]">✦</span>
      </button>

      {open && (
        <ChatOverlay
          key={seed?.key ?? 'manual'}
          seedPrompt={seed?.prompt ?? null}
          seedDisplay={seed?.display ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// ---------- Chat overlay ----------

function ChatOverlay({
  onClose,
  seedPrompt = null,
  seedDisplay = null,
}: {
  onClose: () => void
  /** When set (opened from the help bubble), auto-send this on mount. */
  seedPrompt?: string | null
  /** Clean text to SHOW as the user's bubble instead of the raw seedPrompt. */
  seedDisplay?: string | null
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState('')
  const [teachOpen, setTeachOpen] = useState(false)
  const [teachTitle, setTeachTitle] = useState('')
  const [teachContent, setTeachContent] = useState('')
  const [teachCategory, setTeachCategory] = useState('shop_policy')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seededRef = useRef(false)
  // Stable id for THIS conversation, reset on "New chat". Sent with each turn
  // so passive learning debounces to one extraction per conversation.
  const sessionIdRef = useRef<string>(newSessionId())
  const location = useLocation()
  // Read-back: when on, CBI speaks each new answer aloud.
  const [speakOn, setSpeakOn] = useState(getReadbackEnabled())
  const [readbackSettingsOpen, setReadbackSettingsOpen] = useState(false)
  const [readbackStatus, setReadbackStatus] = useState<string | null>(null)
  const [readbackVoice, setReadbackVoiceState] = useState<ReadbackVoice>(getReadbackVoice())
  const [readbackSpeed, setReadbackSpeedState] = useState<ReadbackSpeed>(getReadbackSpeed())
  const spokenCountRef = useRef(0)

  const send = useMutation({
    mutationFn: (text: string) => {
      // Replay prior text turns as history. Tool blocks aren't carried —
      // each turn re-runs tools fresh against current data.
      const history = messages
        .filter((m) => m.content.trim() !== '')
        .map((m) => ({ role: m.role, content: m.content }))
      return apiRequest<{ data: ChatResp }>('/v1/ai/chat', {
        method: 'POST',
        body: { prompt: text, history, context: { session_id: sessionIdRef.current } },
      })
    },
    onSuccess: (resp) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: resp.data.ok ? resp.data.text : '',
          tools_used: resp.data.tools_used,
          error: resp.data.ok ? null : (resp.data.error ?? 'AI call failed.'),
          call_recordings: resp.data.call_recordings,
          navigation_links: resp.data.navigation_links,
          resource_links: resp.data.resource_links,
        },
      ])
    },
    onError: (e: Error) => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', error: e.message },
      ])
    },
  })

  const teach = useMutation({
    mutationFn: () => {
      const sourceExcerpt = messages
        .slice(-6)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n\n')
        .slice(-1000)

      return apiRequest<AiLearningCorrectionResp>('/v1/ai/learning/corrections', {
        method: 'POST',
        body: {
          category: teachCategory,
          title: teachTitle.trim(),
          content: teachContent.trim(),
          source_excerpt: sourceExcerpt || null,
          source_payload: {
            source: 'header_ai_chat',
            messages: messages.slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
              tools_used: m.tools_used ?? [],
              error: m.error ?? null,
            })),
          },
        },
      })
    },
    onSuccess: (resp) => {
      setTeachOpen(false)
      setTeachTitle('')
      setTeachContent('')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: resp.message,
        },
      ])
    },
    onError: (e: Error) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          error: e.message,
        },
      ])
    },
  })

  function submit(text?: string, display?: string) {
    const value = (text ?? prompt).trim()
    if (!value || send.isPending) return
    // Show `display` (a clean question) when provided, but send `value`
    // (which may carry internal tool directives) to the AI.
    setMessages((prev) => [...prev, { role: 'user', content: (display ?? value).trim() }])
    setPrompt('')
    send.mutate(value)
  }

  function resetChat() {
    setMessages([])
    setPrompt('')
    sessionIdRef.current = newSessionId()
    inputRef.current?.focus()
  }

  // Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, send.isPending])

  // Auto-focus the input on open.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // If opened with a seed (from the CBI launcher), auto-send it once.
  useEffect(() => {
    if (seedPrompt && !seededRef.current) {
      seededRef.current = true
      submit(seedPrompt, seedDisplay ?? undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPrompt])

  // Speak the newest assistant answer when read-back is on. Advance the cursor
  // on EVERY new message, so toggling read-back on only affects future answers
  // (never replays past ones).
  useEffect(() => {
    if (messages.length <= spokenCountRef.current) return
    spokenCountRef.current = messages.length
    if (!speakOn) return
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && last.content) speak(last.content, readbackVoice, readbackSpeed)
  }, [messages, speakOn, readbackVoice, readbackSpeed])

  // Turning read-back off — or closing the panel — stops speech in progress.
  useEffect(() => {
    if (!speakOn) stopSpeech()
  }, [speakOn])
  useEffect(() => () => stopSpeech(), [])

  const isEmpty = messages.length === 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" aria-hidden />

      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <SparkleIcon />
            <h2 className="text-sm font-semibold text-navy-900" title="CrewBarn Intelligence">CBI</h2>
            {messages.length > 0 && (
              <>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {messages.filter((m) => m.role === 'user').length} turn
                  {messages.filter((m) => m.role === 'user').length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => setTeachOpen((v) => !v)}
                  className="text-[11px] px-2 py-1 rounded border border-amber-200 text-amber-800 hover:bg-amber-50"
                  title="Teach CBI a shop-specific correction from this chat"
                >
                  Teach CBI
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setReadbackSettingsOpen((open) => !open)}
              aria-expanded={readbackSettingsOpen}
              className="h-7 px-2 rounded text-[11px] font-medium text-slate-500 hover:text-amber-700 hover:bg-amber-50"
              title="Choose the CBI text-to-voice voice and speed"
            >
              T2V settings
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !speakOn
                setSpeakOn(next)
                setReadbackEnabled(next)
                if (!next) stopSpeech()
              }}
              aria-pressed={speakOn}
              title={speakOn ? 'Read-back on — CBI speaks answers aloud' : 'Read-back off — tap to have CBI read answers aloud'}
              className={`w-7 h-7 flex items-center justify-center rounded ${speakOn ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
            >
              <SpeakerIcon on={speakOn} />
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={resetChat}
                className="text-xs px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                title="Start a new chat"
              >
                New chat
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-lg w-6 h-6 flex items-center justify-center"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {readbackSettingsOpen && (
          <div className="px-5 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Voice</span>
              <select
                value={readbackVoice}
                onChange={(e) => {
                  const voice = e.target.value as ReadbackVoice
                  stopSpeech()
                  setReadbackVoiceState(voice)
                  setReadbackVoice(voice)
                  const voiceName = voice.charAt(0).toUpperCase() + voice.slice(1)
                  setReadbackStatus(null)
                  void speak("Hi, I'm " + voiceName + '. This is your CBI assistant.', voice, readbackSpeed)
                    .then((source) => {
                      if (source === 'cancelled') return
                      setReadbackStatus(source === 'server'
                        ? voiceName + ' preview played.'
                        : 'Server voice unavailable; using device voice.')
                    })
                }}
                className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-amber-500 focus:outline-none"
                aria-label="Read-back voice"
              >
                {READBACK_VOICES.map((voice) => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Speed</span>
              <select
                value={readbackSpeed}
                onChange={(e) => {
                  const speed = Number(e.target.value) as ReadbackSpeed
                  stopSpeech()
                  setReadbackSpeedState(speed)
                  setReadbackSpeed(speed)
                }}
                className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-amber-500 focus:outline-none"
                aria-label="Read-back speed"
              >
                {READBACK_SPEEDS.map((speed) => <option key={speed.value} value={speed.value}>{speed.label}</option>)}
              </select>
            </label>
            {readbackStatus && <span className="text-[11px] text-slate-500">{readbackStatus}</span>}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {isEmpty && (
            <div>
              {/* Merged from the old "CrewBarn Help" bubble — one tap gets
                  step-by-step help for whatever page you're on. */}
              <button
                type="button"
                onClick={() => {
                  const s = pageHelpSeed(location.pathname)
                  submit(s.prompt, s.display)
                }}
                className="w-full text-left mb-3 px-3 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm transition-colors"
              >
                ✨ Help me with this page
              </button>
              <p className="text-sm text-slate-600 mb-3">
                Or ask me about jobs, customers, invoices, schedule, inventory, or templates.
                I can pull live data and help draft messages.
              </p>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => submit(s.prompt)}
                    className="w-full text-left text-sm text-slate-700 hover:text-navy-900 hover:bg-amber-50 px-3 py-2 rounded border border-slate-200 hover:border-amber-300 transition-colors"
                  >
                    <span className="text-amber-600 mr-1">›</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              onLinkClick={() => undefined}
              onRetry={() => {
                const prior = [...messages.slice(0, i)].reverse().find((item) => item.role === 'user')
                if (prior) submit(prior.content)
              }}
              onCorrect={() => {
                setTeachOpen(true)
                setTeachTitle('Correct a CBI answer')
                setTeachContent('')
              }}
            />
          ))}

          {send.isPending && (
            <div className="text-sm text-slate-500 flex items-center gap-2 px-1 py-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Thinking…
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
          {teachOpen && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Teach CBI</div>
                  <p className="text-[11px] text-slate-500">Save a shop rule or correction. Learning settings decide whether it needs approval.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTeachOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Close teach CBI"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <select
                    value={teachCategory}
                    onChange={(e) => setTeachCategory(e.target.value)}
                    className="text-xs px-2 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="shop_policy">Shop policy</option>
                    <option value="pricing">Pricing</option>
                    <option value="dispatch_rules">Dispatch</option>
                    <option value="customer_preferences">Customer pref</option>
                    <option value="part_reference">Part reference</option>
                    <option value="part_matching">Part matching</option>
                  </select>
                  <input
                    value={teachTitle}
                    onChange={(e) => setTeachTitle(e.target.value)}
                    placeholder="Short title"
                    className="text-xs px-2 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
                  />
                </div>
                <textarea
                  value={teachContent}
                  onChange={(e) => setTeachContent(e.target.value)}
                  placeholder="Exact thing AI should remember..."
                  rows={3}
                  className="text-xs px-2 py-2 border border-slate-300 rounded-md resize-none focus:outline-none focus:border-amber-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => teach.mutate()}
                    disabled={teach.isPending || !teachTitle.trim() || !teachContent.trim()}
                    className="text-xs px-3 py-2 rounded-md bg-navy-900 text-white font-medium hover:bg-navy-800 disabled:opacity-50"
                  >
                    {teach.isPending ? 'Saving...' : 'Save learning'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={isEmpty ? 'Ask anything…' : 'Reply…'}
              rows={2}
              className="flex-1 resize-none text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
            />
            <button
              type="button"
              onClick={() => submit()}
              disabled={!prompt.trim() || send.isPending}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:hover:bg-amber-500 transition-colors shrink-0"
              title="Send (Enter)"
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Enter to send · Shift+Enter for newline · Esc to close
          </p>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  onLinkClick,
  onRetry,
  onCorrect,
}: {
  message: ChatMessage
  onLinkClick: () => void
  onRetry: () => void
  onCorrect: () => void
}) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={isUser ? 'max-w-[85%]' : 'max-w-full w-full'}>
        <div
          className={[
            'text-sm whitespace-pre-wrap rounded-lg px-3 py-2',
            isUser
              ? 'bg-amber-500 text-white'
              : message.error
              ? 'bg-red-50 border border-red-200 text-red-900'
              : 'bg-slate-100 text-slate-800',
          ].join(' ')}
        >
          {message.error ? (
            <span>✗ {message.error}</span>
          ) : message.call_recordings && message.call_recordings.length > 0 ? (
            <CallSummaryWithRecordings text={message.content} calls={message.call_recordings} onLinkClick={onLinkClick} />
          ) : (
            <RenderWithLinks text={message.content} onLinkClick={onLinkClick} />
          )}
          {!isUser && message.navigation_links?.map((link) => (
            <NavigationAction key={link.to} link={link} />
          ))}
          {!isUser && message.resource_links && message.resource_links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.resource_links.map((link) => (
                <Link key={link.to} to={link.to} className="rounded border border-amber-200 bg-white px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50">
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        {!isUser && message.error && (
          <button type="button" onClick={onRetry} className="mt-1 px-1 text-[11px] font-medium text-red-700 hover:underline">
            Retry request
          </button>
        )}
        {!isUser && !message.error && (
          <div className="mt-1 flex items-center gap-3 px-1 text-[11px] text-slate-500">
            <button type="button" onClick={() => void speak(message.content, getReadbackVoice(), getReadbackSpeed())} className="hover:text-amber-700">Read</button>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(message.content)} className="hover:text-amber-700">Copy</button>
            <button type="button" onClick={onRetry} className="hover:text-amber-700">Retry</button>
            <button type="button" onClick={onCorrect} className="hover:text-amber-700">Correct CBI</button>
          </div>
        )}
        {!isUser && message.tools_used && message.tools_used.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 pl-1">
            {message.tools_used.map((t) => (
              <span
                key={t}
                className="text-[10px] uppercase tracking-wide font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                title={`AI queried: ${t}`}
              >
                {t.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NavigationAction({ link }: { link: NavigationLink }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  async function runAction() {
    if (!link.action_url || status === 'sending') return
    setStatus('sending')
    try {
      await apiRequest(link.action_url, { method: 'POST' })
      setStatus('sent')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Link to={link.to} className="text-xs font-medium text-amber-700 hover:underline">
        {link.label}
      </Link>
      {link.action_url && (
        <button
          type="button"
          onClick={runAction}
          disabled={status === 'sending'}
          className="text-xs font-medium text-slate-600 hover:text-amber-700 disabled:opacity-50"
        >
          {status === 'sending' ? 'Requesting...' : status === 'sent' ? 'Location requested' : status === 'failed' ? 'Request failed - retry' : link.action_label}
        </button>
      )}
    </div>
  )
}

function CallSummaryWithRecordings({ text, calls, onLinkClick }: { text: string; calls: CallRecording[]; onLinkClick: () => void }) {
  const unmatched = new Set(calls.map((call) => call.call_id))
  const blocks = text.split(/\n\s*\n/).filter((block) => block.trim() !== '')
  const paired = blocks.map((block) => {
    const call = calls.find((candidate) => {
      if (!unmatched.has(candidate.call_id)) return false
      const time = candidate.when?.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)?.[0]
      return !!time && block.toLowerCase().includes(time.toLowerCase())
    })
    if (call) unmatched.delete(call.call_id)
    return { block, call }
  })

  const remaining = calls.filter((call) => unmatched.has(call.call_id))

  return (
    <div className="space-y-3">
      {paired.map(({ block, call }, index) => (
        <div key={index}>
          <RenderWithLinks text={block} onLinkClick={onLinkClick} />
          {call && <CallRecordingCard call={call} onLinkClick={onLinkClick} compact />}
        </div>
      ))}
      {remaining.length > 0 && <CallRecordingList calls={remaining} onLinkClick={onLinkClick} />}
    </div>
  )
}

function CallRecordingCard({ call, onLinkClick, compact = false }: { call: CallRecording; onLinkClick: () => void; compact?: boolean }) {
  const action = call.customer_link
    ? <Link to={call.customer_link} onClick={onLinkClick} className="text-amber-700 hover:underline">Customer</Link>
    : call.create_job_link
      ? <Link to={call.create_job_link} onClick={onLinkClick} className="text-amber-700 hover:underline">Create job</Link>
      : null

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-white p-2.5">
      {compact ? (
        action && <div className="mb-1 flex justify-end text-xs">{action}</div>
      ) : (
        <div className="flex items-start justify-between gap-2 text-xs">
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 truncate">{call.customer || call.phone || 'Unknown caller'}</div>
            <div className="text-slate-500">{call.when}{call.direction ? ' · ' + call.direction : ''}</div>
          </div>
          <div className="shrink-0">{action}</div>
        </div>
      )}
      {call.has_recording && (
        <AuthedAudio src={callRecordingUrl(call.call_id)} className={compact ? 'h-9 w-full' : 'mt-2 h-9 w-full'} />
      )}
    </div>
  )
}

function CallRecordingList({ calls, onLinkClick }: { calls: CallRecording[]; onLinkClick: () => void }) {
  return (
    <div className="mt-2 space-y-2">
      {calls.map((call) => <CallRecordingCard key={call.call_id} call={call} onLinkClick={onLinkClick} />)}
    </div>
  )
}
/*
 * A bare URL. This carried ?access_token=<session token> so a plain
 * <audio src> could authenticate — which put a full API token into browser
 * history, access logs, proxy logs and any Referer from the tab. AuthedAudio
 * fetches it with the header instead, so no credential rides in a URL.
 */
function callRecordingUrl(callId: string): string {
  return API_URL + '/v1/comms/messages/' + encodeURIComponent(callId) + '/recording'
}

// ---------- Helpers (icons + markdown renderer) ----------

/**
 * Speak CBI's answer aloud via the server TTS endpoint. Falls back to browser
 * speechSynthesis when the tenant is not configured for server read-back.
 */
let activeAudio: HTMLAudioElement | null = null
let activeAudioUrl: string | null = null
let activeSpeechRequest: AbortController | null = null

function stopSpeech() {
  activeSpeechRequest?.abort()
  activeSpeechRequest = null
  activeAudio?.pause()
  activeAudio = null
  if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl)
  activeAudioUrl = null
  window.speechSynthesis?.cancel()
}

async function speak(text: string, voice: ReadbackVoice, speed: ReadbackSpeed): Promise<'server' | 'device' | 'cancelled'> {
  const clean = cleanSpeechText(text)
  if (!clean) return 'device'
  stopSpeech()
  const controller = new AbortController()
  activeSpeechRequest = controller

  try {
    const headers: Record<string, string> = {
      Accept: 'audio/*',
      'Content-Type': 'application/json',
    }
    const token = getStoredToken()
    if (token) headers.Authorization = 'Bearer ' + token
    const actingTenant = getActingTenant()
    if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
    const franchiseActAs = getFranchiseActAs()
    if (franchiseActAs) headers['X-Franchise-Act-As'] = franchiseActAs.id

    const requests = splitSpeechForFastStart(clean).map((chunk) => fetch(API_URL + '/v1/ai/speech', {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({ text: chunk, voice, speed }),
    }))

    const response = await requests[0]
    if (!response.ok) {
      fallbackSpeak(clean, speed)
      return 'device'
    }

    const firstBlob = await response.blob()
    const remaining = Promise.all(requests.slice(1).map(async (request) => {
      const next = await request
      if (!next.ok) throw new Error('Speech continuation failed')
      return next.blob()
    }))

    await playSpeechBlob(firstBlob, controller, async () => {
      const rest = await remaining
      if (!controller.signal.aborted && rest[0]) await playSpeechBlob(rest[0], controller)
    })
    return 'server'
  } catch (error) {
    if (controller.signal.aborted || (error as Error).name === 'AbortError') return 'cancelled'
    fallbackSpeak(clean, speed)
    return 'device'
  }
}

async function playSpeechBlob(blob: Blob, controller: AbortController, onEnded?: () => Promise<void>) {
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  activeAudio = audio
  activeAudioUrl = url
  audio.onended = () => {
    if (activeAudio !== audio) return
    activeAudio = null
    if (activeAudioUrl === url) activeAudioUrl = null
    URL.revokeObjectURL(url)
    if (!controller.signal.aborted && onEnded) void onEnded()
  }
  await audio.play()
}

function splitSpeechForFastStart(text: string): string[] {
  if (text.length <= 320) return [text]
  const candidate = text.slice(80, 320)
  const sentenceEnd = candidate.search(/[.!?]\s/)
  const splitAt = sentenceEnd >= 0 ? 80 + sentenceEnd + 1 : text.lastIndexOf(' ', 240)
  if (splitAt < 80) return [text]
  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()].filter(Boolean)
}
function fallbackSpeak(clean: string, speed: ReadbackSpeed) {
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    if (clean) {
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = speed
      synth.speak(utterance)
    }
  } catch {
    /* no TTS available */
  }
}

function cleanSpeechText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\s*\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>]/g, '')
    .trim()
}

/** A fresh conversation id (falls back when crypto.randomUUID is unavailable). */
function newSessionId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3.5 4.5 6H2v4h2.5L8 12.5v-9z" fill="currentColor" stroke="none" />
      {on ? (
        <>
          <path d="M11 5.5a3.5 3.5 0 0 1 0 5" />
          <path d="M12.8 3.8a6 6 0 0 1 0 8.4" />
        </>
      ) : (
        <path d="M11.5 6.5l2.5 3M14 6.5l-2.5 3" />
      )}
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor">
      <path d="M8 1.5l1.4 3.6 3.6 1.4-3.6 1.4L8 11.5 6.6 7.9 3 6.5l3.6-1.4L8 1.5z" />
      <path d="M12.5 10l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l10 0M9 4l4 4-4 4" />
    </svg>
  )
}

/**
 * Normalize a URL the model emitted into a safe in-app relative path,
 * or null if it isn't one we should render as an internal link.
 *
 * Tolerates common model quirks:
 *   - angle-bracket wrapping: <​/customers/abc>
 *   - trailing punctuation:  /customers/abc).  → strips ).,;:!?
 *   - absolute same-origin URLs: https://app.crewbarn.com/customers/abc
 *   - protocol-relative //evil.com is rejected (not internal)
 */
function toInternalPath(raw: string): string | null {
  // Drop angle-bracket wrapping + trailing sentence punctuation the model
  // sometimes glues on. The capture group already excludes the closing ')'.
  const u = raw
    .trim()
    .replace(/^</, '')
    .replace(/>$/, '')
    // Strip backticks / quotes the model sometimes wraps the path in,
    // e.g. (`/customers/new`) or ("/jobs/abc").
    .replace(/^[`'"]+/, '')
    .replace(/[`'"]+$/, '')
    .replace(/[.,;:!?]+$/, '')
    .trim()

  // Absolute same-origin URL → relative path.
  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u)
      if (parsed.origin === window.location.origin) {
        return parsed.pathname + parsed.search + parsed.hash
      }
    } catch {
      /* fall through */
    }
    return null // external URL — not an internal link
  }

  // Relative in-app path (reject protocol-relative //host).
  if (u.startsWith('/') && !u.startsWith('//')) return u
  return null
}

/**
 * Render AI text with light markdown:
 *   - `[label](url)`  → React Router <Link> for in-app paths
 *   - `**bold**`      → <strong>
 *
 * Order matters: links first so a bold span can't swallow a `[..](..)`.
 * Allows optional whitespace between `]` and `(` (some models add it).
 */
function RenderWithLinks({ text, onLinkClick }: { text: string; onLinkClick?: () => void }) {
  const linkRegex = /\[([^\]]+)\]\s*\(\s*([^)]+?)\s*\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  function pushText(chunk: string) {
    if (!chunk) return
    parts.push(...renderTextChunk(chunk, () => key++, onLinkClick))
  }

  while ((match = linkRegex.exec(text)) !== null) {
    const [whole, label, url] = match
    if (match.index > lastIndex) {
      pushText(text.slice(lastIndex, match.index))
    }
    const path = toInternalPath(url)
    if (path) {
      parts.push(
        <Link
          key={key++}
          to={path}
          onClick={onLinkClick}
          className="text-amber-700 hover:text-amber-900 underline decoration-amber-300 hover:decoration-amber-600 underline-offset-2"
        >
          {label}
        </Link>,
      )
    } else {
      // Not an in-app link — render just the label (drop the raw URL noise)
      // so the user sees clean text instead of "Foo(https://…)".
      pushText(label)
    }
    lastIndex = match.index + whole.length
  }
  if (lastIndex < text.length) {
    pushText(text.slice(lastIndex))
  }
  return <>{parts}</>
}

/**
 * Render a plain-text chunk, auto-linkifying bare in-app paths and
 * same-origin URLs (e.g. "/jobs/new" or "https://app.crewbarn.com/customers")
 * the model emits WITHOUT markdown link syntax. Markdown links are handled
 * upstream in RenderWithLinks; this catches the common case where the AI
 * just drops a path inline. Non-link text still gets **bold** rendering.
 */
function renderTextChunk(
  chunk: string,
  nextKey: () => number,
  onLinkClick?: () => void,
): React.ReactNode[] {
  const out: React.ReactNode[] = []
  // boundary (start / whitespace / "(") + an http(s) URL or a /rooted path
  const re = /(^|[\s(])((?:https?:\/\/[^\s)]+)|(?:\/[A-Za-z][\w/-]*))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(chunk)) !== null) {
    const boundary = m[1]
    const rawToken = m[2]
    if (m.index > last) out.push(...renderBold(chunk.slice(last, m.index), nextKey))
    if (boundary) out.push(boundary)
    // Strip trailing sentence punctuation off the token before resolving.
    const trail = (rawToken.match(/[.,;:!?]+$/) || [''])[0]
    const core = trail ? rawToken.slice(0, rawToken.length - trail.length) : rawToken
    const path = toInternalPath(core)
    if (path) {
      out.push(
        <Link
          key={nextKey()}
          to={path}
          onClick={onLinkClick}
          className="text-amber-700 hover:text-amber-900 underline decoration-amber-300 hover:decoration-amber-600 underline-offset-2"
        >
          {path}
        </Link>,
      )
      if (trail) out.push(trail)
    } else {
      out.push(...renderBold(rawToken, nextKey))
    }
    last = m.index + m[0].length
  }
  if (last < chunk.length) out.push(...renderBold(chunk.slice(last), nextKey))
  return out
}

function renderBold(chunk: string, nextKey: () => number): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(chunk)) !== null) {
    if (m.index > last) out.push(chunk.slice(last, m.index))
    out.push(<strong key={nextKey()} className="font-semibold text-slate-900">{m[1]}</strong>)
    last = m.index + m[0].length
  }
  if (last < chunk.length) out.push(chunk.slice(last))
  return out
}
