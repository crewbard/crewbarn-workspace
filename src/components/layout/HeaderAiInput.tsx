import { AuthedAudio } from '@/components/comms/AuthedAudio'
import { CbiReplyChip, type CbiReplyVerdict } from '@/components/cbi/CbiReplyChip'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { startWorkPageTour } from '@/components/guides/TutorialControls'
import { hasPageTour } from '@/lib/pageTours/available'
import { guidedTourForPath } from '@/lib/guidedTours'
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
import { FOCUS_CBI_EVENT } from '@/lib/shortcutBus'
import { cbiPageContext, type CbiApplication } from '@/lib/cbiContext'
import { ReferencedText } from '@/components/ReferencedText'
import { resolveCbiNavigation, type CbiNavigationContext } from '@/lib/cbiNavigation'
import type { SubscriptionSummary } from '@/types/subscription'

const CbiNavigation = createContext<CbiNavigationContext>({ application: 'work', currentOrigin: '' })

function CbiLink({ to, children, ...props }: { to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  const context = useContext(CbiNavigation)
  const href = resolveCbiNavigation(to, context)
  if (!href) return <span className={props.className} title="The Work workspace is not available yet.">{children}</span>
  return href.startsWith('/') ? <Link to={href} {...props}>{children}</Link> : <a href={href} {...props}>{children}</a>
}

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
  proposals?: Proposal[]
  /** start_walkthrough: open a page and walk it. */
  action?: { type?: string; path?: string; title?: string } | null
  walkthroughs?: Walkthrough[]
  form?: DoItForm | null
}

/** A page CBI explained, which a "Walk me through it" button opens and walks. */
interface Walkthrough {
  path: string
  title: string
}

/** "Or I can do it for you": what CBI needs to know, and a Go button (DoItForYou on the server). */
interface DoItForm {
  task: string
  title: string
  lead: string
  submit_label: string
  fields: { key: string; label: string; placeholder: string; required: boolean }[]
}

/** A change CBI proposed: it happens only when the person presses Confirm. */
interface Proposal {
  id: string
  tool: string
  summary: string
  expires_at: string
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
  proposals?: Proposal[]
  /** Photos sent with this question, as data URLs, shown in its bubble. */
  photos?: string[]
  walkthroughs?: Walkthrough[]
  form?: DoItForm | null
  /** Already read aloud while it was being written (streamed). */
  spoken?: boolean
  /** The answer to a correction: Saved, Sent to your admin, or Can't. */
  chip?: CbiReplyVerdict | null
}

/** A photo waiting to go with the next question. */
interface ChatPhoto {
  data: string
  media_type: string
  preview: string
}

/** Photos with one question (the server's AiChatController::MAX_PHOTOS). */
const MAX_PHOTOS = 3

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
  verdict?: CbiReplyVerdict
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
  { label: 'Find a company file', prompt: 'Search the current files I can access. Show the source and tell me if any file is not indexed.' },
  { label: 'Find a business address', prompt: 'Help me find a public business address. Ask for the business name, road and city, and let me choose if there is more than one match.' },
  { label: 'Research a part', prompt: 'Help research a replacement part. Ask for its manufacturer, model or markings, check our permitted catalog and cite public manufacturer evidence.' },
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
export function HeaderAiInput({ application = 'work' }: { application?: CbiApplication }) {
  const { account } = useAuth()
  const scope = [application, account?.id, account?.tenant?.id, getActingTenant(), getFranchiseActAs()?.id].join(':')
  const subscription = useQuery({
    queryKey: ['cbi-workspace', scope],
    queryFn: () => apiRequest<{ data: SubscriptionSummary }>('/v1/tenant-settings/subscription'),
    enabled: application === 'connect' && !!(account?.tenant?.id || getActingTenant()),
    staleTime: 5 * 60_000, retry: false,
  })
  return <CbiNavigation.Provider value={{ application, workspaceUrl: subscription.data?.data.workspace_url,
    currentOrigin: window.location.origin, connectUrl: import.meta.env.VITE_CONNECT_URL || 'https://connect.crewbarn.com' }}>
    <ScopedHeaderAiInput key={scope} application={application} scope={scope} />
  </CbiNavigation.Provider>
}

function ScopedHeaderAiInput({ application, scope }: { application: CbiApplication; scope: string }) {
  const [open, setOpen] = useState(false)
  // Out of the way while a walkthrough plays; the chat is kept for when they come back.
  const [tucked, setTucked] = useState(false)
  // CBI is working on an answer: its button glows (index.css .cbi-working).
  const [working, setWorking] = useState(false)
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
    queryKey: ['settings', 'ai', scope],
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
    setAiHelpPanelOpen(open && !tucked)
    return () => setAiHelpPanelOpen(false)
  }, [open, tucked])

  if (isLoading || !data) return null
  if (!visible) return null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Tucked away for a walkthrough: bring the same chat back.
          if (open && tucked) {
            setTucked(false)
            return
          }
          setSeed(null)
          setOpen(true)
        }}
        className={`relative ml-3 mr-1 flex items-center justify-center w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 shadow-sm transition-colors ${open && working ? 'cbi-working' : ''}`}
        title={open && working ? 'CBI is working on it…' : open && tucked ? 'Back to your CBI chat' : 'Open CBI — CrewBarn Intelligence'}
        aria-busy={open && working}
      >
        <span className="text-[11px] font-extrabold tracking-tight text-[#0B1220]">CBI</span>
        <span className="absolute -top-0.5 right-0.5 text-[10px] font-bold leading-none text-[#FDE9C8]">✦</span>
        {open && tucked && <span aria-hidden className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />}
      </button>

      {open && (
        <ChatOverlay
          key={seed?.key ?? 'manual'}
          application={application}
          seedPrompt={seed?.prompt ?? null}
          seedDisplay={seed?.display ?? null}
          tucked={tucked}
          onTuck={() => setTucked(true)}
          onWorking={setWorking}
          onClose={() => {
            setOpen(false)
            setTucked(false)
            setWorking(false)
          }}
        />
      )}
    </>
  )
}

// ---------- Chat overlay ----------

function ChatOverlay({
  application,
  onClose,
  onTuck,
  onWorking,
  tucked = false,
  seedPrompt = null,
  seedDisplay = null,
}: {
  application: CbiApplication
  onClose: () => void
  /** Get out of the way of a walkthrough, keeping the chat. */
  onTuck: () => void
  /** Tells the CBI button when an answer is being worked on (it pulses). */
  onWorking?: (working: boolean) => void
  tucked?: boolean
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
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<ChatPhoto[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  // The answer so far while it streams in (null when nothing is streaming).
  const [streamText, setStreamText] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const seededRef = useRef(false)
  // Stable id for THIS conversation, reset on "New chat". Sent with each turn
  // so passive learning debounces to one extraction per conversation.
  const sessionIdRef = useRef<string>(newSessionId())
  // The page beside the panel: it stays open while you browse, and a
  // question goes with whatever is open then.
  const location = useLocation()
  const navigate = useNavigate()
  const navigation = useContext(CbiNavigation)
  // Read-back: when on, CBI speaks each new answer aloud.
  const [speakOn, setSpeakOn] = useState(getReadbackEnabled())
  const [readbackSettingsOpen, setReadbackSettingsOpen] = useState(false)
  const [readbackStatus, setReadbackStatus] = useState<string | null>(null)
  const [readbackVoice, setReadbackVoiceState] = useState<ReadbackVoice>(getReadbackVoice())
  const [readbackSpeed, setReadbackSpeedState] = useState<ReadbackSpeed>(getReadbackSpeed())
  const spokenCountRef = useRef(0)
  const mounted = useRef(true)
  const requestScope = useRef(browserCbiScope())
  const isCurrent = () => mounted.current && requestScope.current === browserCbiScope()
  const streamAbort = useRef<AbortController | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // StrictMode replays effects on the same mounted chat in development.
      // Only abort when it really left, preserving a seeded first question.
      queueMicrotask(() => { if (!mounted.current) streamAbort.current?.abort() })
    }
  }, [])

  const send = useMutation({
    mutationFn: async ({ text, images }: { text: string; images: ChatPhoto[] }): Promise<{ data: ChatResp; spoken: boolean }> => {
      if (!isCurrent()) throw new Error('Company or session changed. Open a new CBI chat.')
      const controller = new AbortController()
      streamAbort.current = controller
      // Replay prior text turns as history. Tool blocks aren't carried —
      // each turn re-runs tools fresh against current data. Photos go with
      // their own question only.
      const history = messages
        .filter((m) => m.content.trim() !== '')
        .map((m) => ({ role: m.role, content: m.content }))
      const body = {
        prompt: text,
        history,
        context: { session_id: sessionIdRef.current, client: 'web', ...cbiPageContext(application, location.pathname, location.search, location.hash) },
        ...(images.length > 0 ? { images: images.map(({ data, media_type }) => ({ data, media_type })) } : {}),
      }
      // The answer as it is written: shown as it comes, and read aloud from
      // the first sentence. Anything wrong with the stream before a word
      // arrives falls back to the plain request.
      const speaker = speakOn ? new StreamSpeaker(readbackVoice, readbackSpeed) : null
      let written = ''
      const streamed = await streamChat(body, {
        onText: (piece) => {
          if (!isCurrent()) { controller.abort(); speaker?.stop(); return }
          written += piece
          setStreamText(written)
          speaker?.push(written)
        },
        onReset: () => {
          if (!isCurrent()) return
          written = ''
          setStreamText('')
          speaker?.reset()
        },
      }, controller.signal)
      if (!isCurrent() || controller.signal.aborted) {
        speaker?.stop()
        throw new Error('Company or session changed. Open a new CBI chat.')
      }
      setStreamText(null)
      if (streamed) {
        if (speaker) {
          if (streamed.data.ok) speaker.push(written, true)
          else speaker.stop()
        }
        return { data: streamed.data, spoken: !!speaker && streamed.data.ok }
      }
      speaker?.stop()
      const plain = await apiRequest<{ data: ChatResp }>('/v1/ai/chat', { method: 'POST', body })
      return { data: plain.data, spoken: false }
    },
    onSuccess: (resp) => {
      if (!isCurrent()) return
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          spoken: resp.spoken,
          content: resp.data.ok ? resp.data.text : '',
          tools_used: resp.data.tools_used,
          error: resp.data.ok ? null : (resp.data.error ?? 'AI call failed.'),
          call_recordings: resp.data.call_recordings,
          navigation_links: resp.data.navigation_links,
          resource_links: resp.data.resource_links,
          proposals: resp.data.proposals,
          walkthroughs: resp.data.walkthroughs,
          form: resp.data.form,
        },
      ])
      // "Yes, walk me through it" in words: CBI started one.
      if (resp.data.action?.type === 'start_walkthrough' && resp.data.action.path) {
        void walkThrough(resp.data.action.path)
      }
    },
    onError: (e: Error) => {
      if (!isCurrent()) return
      setStreamText(null)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', error: e.message },
      ])
    },
  })

  // While an answer is on its way, the CBI button pulses.
  useEffect(() => {
    onWorking?.(send.isPending)
  }, [send.isPending, onWorking])
  useEffect(() => () => onWorking?.(false), [onWorking])

  const teach = useMutation({
    mutationFn: () => {
      if (!isCurrent()) throw new Error('Company or session changed. Open a new CBI chat.')
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
      if (!isCurrent()) return
      setTeachOpen(false)
      setTeachTitle('')
      setTeachContent('')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: resp.message,
          chip: resp.verdict ?? null,
        },
      ])
    },
    onError: (e: Error) => {
      if (!isCurrent()) return
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
    // Photos go with what's typed (not with a suggestion or a retry).
    const images = text === undefined ? photos : []
    const value = (text ?? prompt).trim() || (images.length > 0 ? 'What is this?' : '')
    if (!value || send.isPending) return
    // Show `display` (a clean question) when provided, but send `value`
    // (which may carry internal tool directives) to the AI.
    setMessages((prev) => [...prev, {
      role: 'user',
      content: (display ?? value).trim(),
      ...(images.length > 0 ? { photos: images.map((p) => p.preview) } : {}),
    }])
    setPrompt('')
    if (images.length > 0) setPhotos([])
    send.mutate({ text: value, images })
  }

  /**
   * Open the page and walk it (the same tour as Help's "Show me this page"),
   * with CBI tucked out of the way until the CBI button brings it back.
   */
  async function walkThrough(path: string) {
    const destination = resolveCbiNavigation(path, navigation)
    if (!destination) {
      setMessages((previous) => [...previous, { role: 'assistant', content: 'The Work workspace is not available yet. Open Connect to finish setting up the workspace.' }])
      return
    }
    if (!destination.startsWith('/')) {
      window.location.assign(destination)
      return
    }
    path = destination
    stopSpeech()
    onTuck()
    if (window.location.pathname !== path) navigate(path)
    // Wait for that page to draw (its own first walkthrough part, not the
    // page being left) before the tour looks for its parts.
    const marker = guidedTourForPath(path)?.steps.find((step) => step.selector)?.selector ?? 'main [data-tour]'
    for (let waited = 0; waited < 6000; waited += 150) {
      await new Promise((resolve) => window.setTimeout(resolve, 150))
      if (window.location.pathname === path && document.querySelector(marker)) break
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    void startWorkPageTour()
  }

  async function addPhotos(files: FileList | File[]) {
    setPhotoError(null)
    const room = MAX_PHOTOS - photos.length
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (picked.length > room) setPhotoError(`Up to ${MAX_PHOTOS} photos with one question.`)
    const added: ChatPhoto[] = []
    for (const file of picked.slice(0, Math.max(0, room))) {
      try {
        added.push(await shrinkPhoto(file))
      } catch {
        setPhotoError("That photo couldn't be read.")
      }
    }
    if (added.length > 0) setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS))
  }

  function resetChat() {
    setMessages([])
    setPrompt('')
    sessionIdRef.current = newSessionId()
    inputRef.current?.focus()
  }

  // Esc closes, when it was pressed in CBI (or nowhere in particular): Esc
  // in a dialog on the page beside it is that dialog's.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || tucked) return
      const at = document.activeElement
      if (!at || at === document.body || panelRef.current?.contains(at)) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, tucked])

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

  // Alt Space (the CBI shortcut) with the panel already open: back to the box.
  useEffect(() => {
    const focusBox = () => inputRef.current?.focus()
    window.addEventListener(FOCUS_CBI_EVENT, focusBox)
    return () => window.removeEventListener(FOCUS_CBI_EVENT, focusBox)
  }, [])

  // While open, wide screens make room for the panel (index.css), so the
  // page beside it isn't hidden underneath.
  useEffect(() => {
    if (tucked) return
    document.documentElement.setAttribute('data-cbi-open', '')
    return () => document.documentElement.removeAttribute('data-cbi-open')
  }, [tucked])

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
    if (last?.role === 'assistant' && last.content && !last.spoken) speak(last.content, readbackVoice, readbackSpeed)
  }, [messages, speakOn, readbackVoice, readbackSpeed])

  // Turning read-back off — or closing the panel — stops speech in progress.
  useEffect(() => {
    if (!speakOn) stopSpeech()
  }, [speakOn])
  useEffect(() => () => stopSpeech(), [])

  const isEmpty = messages.length === 0

  return (
    // A side panel, not a modal: the page beside it stays usable, so a job
    // or customer CBI links to opens there while CBI stays open.
    <aside aria-label="CBI" hidden={tucked} className={`fixed inset-y-0 right-0 z-50 w-full max-w-md ${tucked ? 'hidden' : 'flex'}`}>
      <div ref={panelRef} className="relative w-full bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full">
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
              onWalk={(path) => void walkThrough(path)}
              onGo={(text) => submit(text)}
              busy={send.isPending}
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

          {send.isPending && streamText ? (
            // The answer so far, as CBI writes it.
            <div className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap">
              <RenderWithLinks text={streamText} onLinkClick={() => undefined} />
              <span aria-hidden className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-amber-400 align-middle" />
            </div>
          ) : send.isPending ? (
            <div className="text-sm text-slate-500 flex items-center gap-2 px-1 py-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Thinking…
            </div>
          ) : null}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
          {teachOpen && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Teach CBI</div>
                  <p className="text-[11px] text-slate-500">Save a shop rule or correction. CBI checks it against CrewBarn safety rules and your company rules first.</p>
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
          {photos.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.preview} alt={`Photo ${i + 1} to send`} className="h-14 w-14 rounded-md border border-slate-200 object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[11px] leading-none text-white hover:bg-slate-900"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {photoError && <p className="mb-1.5 text-[11px] text-red-700">{photoError}</p>}
          <div className="flex items-end gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addPhotos(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photos.length >= MAX_PHOTOS || send.isPending}
              className="flex items-center justify-center w-9 h-9 rounded-full text-slate-500 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-40 shrink-0"
              title="Add a photo for CBI to look at"
              aria-label="Add a photo"
            >
              <CameraIcon />
            </button>
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
                if (pasted.length > 0) {
                  e.preventDefault()
                  void addPhotos(pasted)
                }
              }}
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
              disabled={(!prompt.trim() && photos.length === 0) || send.isPending}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:hover:bg-amber-500 transition-colors shrink-0"
              title="Send (Enter)"
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Enter to send · Shift+Enter for newline · paste or add a photo · Esc to close
          </p>
        </div>
      </div>
    </aside>
  )
}

function MessageBubble({
  message,
  onLinkClick,
  onRetry,
  onCorrect,
  onWalk,
  onGo,
  busy,
}: {
  message: ChatMessage
  onLinkClick: () => void
  onRetry: () => void
  onCorrect: () => void
  onWalk: (path: string) => void
  onGo: (text: string) => void
  busy: boolean
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
          {message.photos && message.photos.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {message.photos.map((src, i) => (
                <img key={i} src={src} alt={`Photo ${i + 1} sent to CBI`} className="h-20 w-20 rounded object-cover" />
              ))}
            </div>
          )}
          {message.error ? (
            <span>✗ {message.error}</span>
          ) : message.call_recordings && message.call_recordings.length > 0 ? (
            <CallSummaryWithRecordings text={message.content} calls={message.call_recordings} onLinkClick={onLinkClick} />
          ) : (
            <RenderWithLinks text={message.content} onLinkClick={onLinkClick} references={!isUser} />
          )}
          {!isUser && message.navigation_links?.map((link) => (
            <NavigationAction key={link.to} link={link} />
          ))}
          {!isUser && message.proposals?.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
          {!isUser && message.walkthroughs?.filter((w) => hasPageTour(w.path)).map((w) => (
            <button
              key={w.path}
              type="button"
              onClick={() => onWalk(w.path)}
              className="mt-2 mr-1.5 inline-flex items-center gap-1.5 rounded-md bg-navy-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-800"
            >
              ▶ Walk me through it{w.title ? <span className="font-medium text-white/70">· {w.title}</span> : null}
            </button>
          ))}
          {!isUser && message.form && <DoItFormCard form={message.form} onGo={onGo} busy={busy} />}
          {!isUser && message.chip && <CbiReplyChip verdict={message.chip} />}
          {!isUser && message.resource_links && message.resource_links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.resource_links.map((link) => (
                <CbiLink key={link.to} to={link.to} className="rounded border border-amber-200 bg-white px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50">
                  {link.label}
                </CbiLink>
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

/**
 * A change CBI proposed -- a status, a booking, a rule to remember. The server
 * will not make it until the person presses Confirm here; nothing typed in
 * the chat, and nothing CBI reads, can stand in for this press.
 */
function ProposalCard({ proposal }: { proposal: Proposal }) {
  const scope = useRef(browserCbiScope())
  const [state, setState] = useState<'waiting' | 'working' | 'done' | 'cancelled' | 'failed'>('waiting')
  const [result, setResult] = useState<string | null>(null)

  async function decide(confirm: boolean) {
    if (state !== 'waiting') return
    if (scope.current !== browserCbiScope()) {
      setResult('Company or session changed. Ask CBI for a new proposal.')
      setState('failed')
      return
    }
    setState('working')
    try {
      const resp = await apiRequest<{ data: { ok?: boolean; message?: string } }>(
        `/v1/ai/proposals/${encodeURIComponent(proposal.id)}/${confirm ? 'confirm' : 'cancel'}`,
        { method: 'POST' },
      )
      setResult(confirm ? (resp.data.message ?? 'Done.') : null)
      setState(confirm ? 'done' : 'cancelled')
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'That did not go through.')
      setState('failed')
    }
  }

  return (
    <div className="mt-2 whitespace-normal rounded-lg border border-amber-300 bg-white p-2.5" role="group" aria-label="Change waiting for your confirmation">
      <p className="text-xs font-semibold text-slate-800">{proposal.summary}</p>
      {state === 'waiting' || state === 'working' ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void decide(true)}
            disabled={state === 'working'}
            className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {state === 'working' ? 'Working…' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => void decide(false)}
            disabled={state === 'working'}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className={`mt-1 text-xs ${state === 'failed' ? 'text-red-700' : 'text-slate-600'}`} role="status">
          {state === 'cancelled' ? 'Cancelled. Nothing was changed.' : result}
        </p>
      )}
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
      <CbiLink to={link.to} className="text-xs font-medium text-amber-700 hover:underline">
        {link.label}
      </CbiLink>
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
    ? <CbiLink to={call.customer_link} onClick={onLinkClick} className="text-amber-700 hover:underline">Customer</CbiLink>
    : call.create_job_link
      ? <CbiLink to={call.create_job_link} onClick={onLinkClick} className="text-amber-700 hover:underline">Create job</CbiLink>
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

    // The rest are being made while the first sentence plays; each plays
    // when the one before it ends.
    const later = requests.slice(1).map((request) => request.then((r) => (r.ok ? r.blob() : null)).catch(() => null))
    const playLater = async (i: number): Promise<void> => {
      if (controller.signal.aborted || i >= later.length) return
      const blob = await later[i]
      if (blob && !controller.signal.aborted) await playSpeechBlob(blob, controller, () => playLater(i + 1))
    }

    await playSpeechBlob(await response.blob(), controller, () => playLater(0))
    return 'server'
  } catch (error) {
    if (controller.signal.aborted || (error as Error).name === 'AbortError') return 'cancelled'
    fallbackSpeak(clean, speed)
    return 'device'
  }
}

/**
 * POST /v1/ai/chat/stream: the answer as server-sent events (delta, reset,
 * done, error). Returns the finished response, or null when the stream
 * couldn't be used before any of the answer arrived (then the caller asks
 * the plain way). A failure after words arrived is thrown, so the answer is
 * never asked for twice.
 */
async function streamChat(
  body: unknown,
  on: { onText: (piece: string) => void; onReset: () => void },
  signal?: AbortSignal,
): Promise<{ data: ChatResp } | null> {
  const headers: Record<string, string> = { Accept: 'text/event-stream', 'Content-Type': 'application/json' }
  const token = getStoredToken()
  if (token) headers.Authorization = 'Bearer ' + token
  const actingTenant = getActingTenant()
  if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
  const franchiseActAs = getFranchiseActAs()
  if (franchiseActAs) headers['X-Franchise-Act-As'] = franchiseActAs.id

  let response: Response
  try {
    response = await fetch(API_URL + '/v1/ai/chat/stream', { method: 'POST', headers, body: JSON.stringify(body), signal })
  } catch {
    return null
  }
  if (!response.ok || !response.body || !(response.headers.get('content-type') ?? '').includes('text/event-stream')) return null

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let heard = false
  let finished: { data: ChatResp } | null = null
  const handle = (chunk: string) => {
    let event = 'message'
    let data = ''
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    let payload: Record<string, unknown>
    try {
      payload = data ? (JSON.parse(data) as Record<string, unknown>) : {}
    } catch {
      return
    }
    if (event === 'delta' && typeof payload.text === 'string') {
      heard = true
      on.onText(payload.text)
    } else if (event === 'reset') {
      on.onReset()
    } else if (event === 'done') {
      finished = { data: (payload.data ?? payload) as ChatResp }
    } else if (event === 'error') {
      throw new Error(typeof payload.message === 'string' ? payload.message : 'CBI could not answer.')
    }
  }
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let at = buffer.indexOf('\n\n')
      while (at !== -1) {
        handle(buffer.slice(0, at))
        buffer = buffer.slice(at + 2)
        at = buffer.indexOf('\n\n')
      }
    }
    if (buffer.trim()) handle(buffer)
  } catch (error) {
    if (!heard) return null
    throw error
  }
  if (finished) return finished
  if (!heard) return null
  throw new Error('The answer was cut off. Try again.')
}

/**
 * Read-back while the answer is still being written: the first sentence is
 * sent to the voice as soon as it is complete, then larger pieces as they
 * fill up, each played when the one before ends. Shares stopSpeech() with
 * speak(), so Stop and closing the panel stop it too.
 */
class StreamSpeaker {
  private said = 0
  private queue: Promise<Blob | null>[] = []
  private playing = false
  private controller = new AbortController()
  private voice: ReadbackVoice
  private speed: ReadbackSpeed

  constructor(voice: ReadbackVoice, speed: ReadbackSpeed) {
    this.voice = voice
    this.speed = speed
    stopSpeech()
    activeSpeechRequest = this.controller
  }

  /** `text` is the whole answer so far; `final` sends whatever is left. */
  push(text: string, final = false) {
    if (this.controller.signal.aborted) return
    const fresh = text.slice(this.said)
    const cut = final ? fresh.length : nextSpeechCut(fresh, this.said === 0)
    if (cut <= 0) return
    this.said += cut
    const piece = cleanSpeechText(fresh.slice(0, cut))
    if (!piece) return
    this.queue.push(this.fetchVoice(piece))
    void this.playNext()
  }

  /** The answer started over (CBI went to a tool): what comes next is new. */
  reset() {
    this.said = 0
  }

  stop() {
    this.controller.abort()
  }

  private fetchVoice(text: string): Promise<Blob | null> {
    const headers: Record<string, string> = { Accept: 'audio/*', 'Content-Type': 'application/json' }
    const token = getStoredToken()
    if (token) headers.Authorization = 'Bearer ' + token
    const actingTenant = getActingTenant()
    if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
    const franchiseActAs = getFranchiseActAs()
    if (franchiseActAs) headers['X-Franchise-Act-As'] = franchiseActAs.id
    return fetch(API_URL + '/v1/ai/speech', {
      method: 'POST',
      headers,
      signal: this.controller.signal,
      body: JSON.stringify({ text, voice: this.voice, speed: this.speed }),
    })
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null)
  }

  private async playNext(): Promise<void> {
    if (this.playing || this.queue.length === 0 || this.controller.signal.aborted) return
    this.playing = true
    const blob = await this.queue.shift()!
    if (this.controller.signal.aborted) return
    if (!blob) {
      this.playing = false
      void this.playNext()
      return
    }
    try {
      await playSpeechBlob(blob, this.controller, async () => {
        this.playing = false
        await this.playNext()
      })
    } catch {
      this.playing = false
    }
  }
}

/** Where the next spoken piece ends: the first sentence, then roughly 200-character runs of sentences; 0 = not yet. */
function nextSpeechCut(fresh: string, first: boolean): number {
  if (!first && fresh.length < 200) return 0
  const ends = [...fresh.matchAll(/[.!?](?=\s)/g)].map((m) => (m.index ?? 0) + 1).filter((i) => i >= (first ? 12 : 0))
  if (ends.length === 0) return 0
  return first ? ends[0] : ends[ends.length - 1]
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

/**
 * The answer in pieces for read-back: the first sentence alone, so its audio
 * comes back quickly and CBI starts talking, then larger pieces, each made
 * while the one before plays. At most four requests an answer.
 */
function splitSpeechForFastStart(text: string): string[] {
  const chunks: string[] = []
  let rest = text.trim()
  while (chunks.length < 3) {
    const first = chunks.length === 0
    if (rest.length <= (first ? 160 : 700)) break
    const at = speechCut(rest, first ? 220 : 700, first)
    if (at < 0) break
    chunks.push(rest.slice(0, at).trim())
    rest = rest.slice(at).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

/** Where to cut within max characters: a sentence end (the first, or the last), else a space; -1 if neither. */
function speechCut(text: string, max: number, earliest: boolean): number {
  const head = text.slice(0, max)
  const ends = [...head.matchAll(/[.!?](?=\s)/g)].map((m) => (m.index ?? 0) + 1).filter((i) => i >= 20)
  if (ends.length) return earliest ? ends[0] : ends[ends.length - 1]
  const space = head.lastIndexOf(' ')
  return space >= 20 ? space : -1
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

/**
 * "Or I can do it for you": CBI's questions as a short form. Go sends the
 * answers to CBI as one message; it does the task from there, asking for
 * anything still missing.
 */
function DoItFormCard({ form, onGo, busy }: { form: DoItForm; onGo: (text: string) => void; busy: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)
  const missing = form.fields.filter((f) => f.required && !(values[f.key] ?? '').trim())
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (missing.length > 0 || sent || busy) return
        setSent(true)
        const answers = form.fields
          .filter((f) => (values[f.key] ?? '').trim() !== '')
          .map((f) => `- ${f.label}: ${values[f.key].trim()}`)
        onGo([form.lead, ...answers].join('\n'))
      }}
      className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-white p-3 whitespace-normal"
    >
      <p className="text-xs font-bold text-navy-900">{form.title}</p>
      {form.fields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-[11px] font-semibold text-slate-600">
            {f.label}
            {!f.required && <span className="font-normal text-slate-400"> (optional)</span>}
          </span>
          {f.key === 'address' ? (
            <AddressSuggestInput
              value={values[f.key] ?? ''}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
              placeholder={f.placeholder}
              disabled={sent}
            />
          ) : (
            <input
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              disabled={sent}
              className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50"
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={missing.length > 0 || sent || busy}
        className="rounded-md bg-amber-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40"
      >
        {sent ? 'Sent' : form.submit_label}
      </button>
    </form>
  )
}

interface AddressSuggestion {
  place_id: string
  label: string
  sublabel?: string | null
  description?: string | null
}

/**
 * An address box that suggests real addresses as you type (Google Places,
 * through /v1/geo/address-autocomplete, as the phone's new-customer form).
 * Picking one fills the whole address; what was typed stays if none is
 * picked, so a partial address still reaches CBI.
 */
function AddressSuggestInput({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder: string; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AddressSuggestion[]>([])
  // One Google billing session per address picked; made on first use.
  const session = useRef('')
  const query = value.trim()

  useEffect(() => {
    if (!open || query.length < 3) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (!session.current) session.current = newAddressSession()
      try {
        const res = await apiRequest<{ data: AddressSuggestion[] }>(
          `/v1/geo/address-autocomplete?q=${encodeURIComponent(query)}&session_token=${encodeURIComponent(session.current)}`,
        )
        if (!cancelled) setItems(res.data ?? [])
      } catch {
        if (!cancelled) setItems([])
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, open])

  const showing = open && query.length >= 3 && items.length > 0
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showing}
        aria-autocomplete="list"
        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50"
      />
      {showing && (
        <ul role="listbox" className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {items.map((it) => (
            <li key={it.place_id} role="option" aria-selected={false}>
              <button
                type="button"
                // Keep focus in the box so the click lands before blur closes the list.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(it.description || [it.label, it.sublabel].filter(Boolean).join(', '))
                  setOpen(false)
                  setItems([])
                  session.current = ''
                }}
                className="block w-full px-2 py-1.5 text-left hover:bg-amber-50 focus:bg-amber-50 focus:outline-none"
              >
                <span className="block text-xs font-semibold text-navy-900">{it.label}</span>
                {it.sublabel && <span className="block text-[11px] text-slate-500">{it.sublabel}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function newAddressSession(): string {
  return `addr_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h1.3l1-1.5h4.4l1 1.5h1.3A1.5 1.5 0 0 1 14 5.5v6A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z" />
      <circle cx="8" cy="8.5" r="2.5" />
    </svg>
  )
}

/**
 * A photo made ready to send: at most 1568 px on the long side (as large as
 * the AI looks at; bigger is only a slower upload) and a JPEG.
 */
async function shrinkPhoto(file: File): Promise<ChatPhoto> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const scale = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const preview = canvas.toDataURL('image/jpeg', 0.85)
    return { data: preview.slice(preview.indexOf(',') + 1), media_type: 'image/jpeg', preview }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Detect a changed browser identity even before the shell re-renders. */
function browserCbiScope(): string {
  // Kept in memory only; never sent as context or exposed in a route.
  return JSON.stringify([getStoredToken(), getActingTenant(), getFranchiseActAs()?.id])
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
 *   - angle-bracket wrapping: </customers/abc>
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

  // Preserve valid public sources and cross-workspace links; CbiLink resolves
  // application routes against the current company's configured workspace.
  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u)
      if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) return parsed.href
    } catch {
      /* fall through */
    }
    return null
  }

  // Relative in-app path (reject protocol-relative //host).
  if (u.startsWith('/') && !u.startsWith('//')) return u
  return null
}

/**
 * Render AI text with light markdown:
 *   - `[label](url)`  → React Router <CbiLink> for in-app paths
 *   - `**bold**`      → <strong>
 *
 * Order matters: links first so a bold span can't swallow a `[..](..)`.
 * Allows optional whitespace between `]` and `(` (some models add it).
 */
function RenderWithLinks({ text, onLinkClick, references = false }: { text: string; onLinkClick?: () => void; references?: boolean }) {
  const linkRegex = /\[([^\]]+)\]\s*\(\s*([^)]+?)\s*\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  function pushText(chunk: string) {
    if (!chunk) return
    parts.push(...renderTextChunk(chunk, () => key++, onLinkClick, references))
  }

  while ((match = linkRegex.exec(text)) !== null) {
    const [whole, label, url] = match
    if (match.index > lastIndex) {
      pushText(text.slice(lastIndex, match.index))
    }
    const path = toInternalPath(url)
    if (path) {
      parts.push(
        <CbiLink
          key={key++}
          to={path}
          onClick={onLinkClick}
          className="text-amber-700 hover:text-amber-900 underline decoration-amber-300 hover:decoration-amber-600 underline-offset-2"
        >
          {label}
        </CbiLink>,
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
  references = false,
): React.ReactNode[] {
  const out: React.ReactNode[] = []
  // boundary (start / whitespace / "(") + an http(s) URL or a /rooted path
  const re = /(^|[\s(])((?:https?:\/\/[^\s)<>]+)|(?:\/[A-Za-z][^\s)<>]*))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(chunk)) !== null) {
    const boundary = m[1]
    const rawToken = m[2]
    if (m.index > last) out.push(...renderBold(chunk.slice(last, m.index), nextKey, references))
    if (boundary) out.push(boundary)
    // Strip trailing sentence punctuation off the token before resolving.
    const trail = (rawToken.match(/[.,;:!?]+$/) || [''])[0]
    const core = trail ? rawToken.slice(0, rawToken.length - trail.length) : rawToken
    const path = toInternalPath(core)
    if (path) {
      out.push(
        <CbiLink
          key={nextKey()}
          to={path}
          onClick={onLinkClick}
          className="text-amber-700 hover:text-amber-900 underline decoration-amber-300 hover:decoration-amber-600 underline-offset-2"
        >
          {path}
        </CbiLink>,
      )
      if (trail) out.push(trail)
    } else {
      out.push(...renderBold(rawToken, nextKey, references))
    }
    last = m.index + m[0].length
  }
  if (last < chunk.length) out.push(...renderBold(chunk.slice(last), nextKey, references))
  return out
}

/**
 * Plain words of a CBI answer go through ReferencedText, so the parts, cards
 * and vehicles it names (a fitment answer's "Ford remote head key (KEY-R8)",
 * "2016 Ford F-150") link the way they do in notes and messages. The words
 * never change; when nothing is found they show as they came.
 */
function plain(text: string, nextKey: () => number, references: boolean): React.ReactNode {
  return references && text.trim() !== '' ? <ReferencedText key={nextKey()} text={text} /> : text
}

function renderBold(chunk: string, nextKey: () => number, references = false): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(chunk)) !== null) {
    if (m.index > last) out.push(plain(chunk.slice(last, m.index), nextKey, references))
    out.push(<strong key={nextKey()} className="font-semibold text-slate-900">{plain(m[1], nextKey, references)}</strong>)
    last = m.index + m[0].length
  }
  if (last < chunk.length) out.push(plain(chunk.slice(last), nextKey, references))
  return out
}
