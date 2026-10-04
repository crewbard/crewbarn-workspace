import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReferencedText } from '@/components/ReferencedText'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IntakeDraftHandoff } from './IntakeDraftHandoff'
import { PhotoTeachingNotes } from './PhotoTeachingNotes'
import { SafeHtml } from '@/components/SafeHtml'
import { ApiError } from '@/lib/api'
import { AuthedAudio } from './AuthedAudio'
import { CallJobLink } from './CallJobLink'
import { verifyAddress } from '@/lib/verifyAddress'
import {
  convertIntakeDraft,
  createAiIntakeDraftFromMessage,
  formatPhone,
  getConversation,
  getEmailTemplate,
  getSmsTemplateBody,
  hasCallRecordingCandidate,
  listEmailTemplates,
  listSmsTemplates,
  readImageText,
  recordingPlaybackUrl,
  renderTemplateForComposer,
  replyToConversation,
  sendEmailReply,
  submitPartMatchFeedback,
  updateAiIntakeDraft,
  uploadCommsImage,
  type AiIntakeDraft,
  type CommsImageAnalysis,
  type CommsMessage,
  type CommsTextReadingEntry,
  type ThreadReader,
} from '@/lib/comms'
import { suggestTechsForLocation } from '@/lib/dispatch'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { EmojiBar } from '@/components/comms/EmojiBar'
import { ImageLightbox } from '@/components/images/ImageLightbox'
import { useCustomers } from '@/hooks/useCustomers'
import { useJobStatuses } from '@/hooks/useJobStatuses'

const threadKey = (id: string) => ['comms', 'conversation', id] as const

/**
 * ConversationThread — a single threaded conversation with a reply box and a
 * template picker. Channel-aware: SMS threads get a text reply box (+ image
 * attach + SMS templates); email threads get a subject + body composer (+
 * email templates). Reused by the customer-account and work-order Messages
 * tabs. `onChanged` fires after sends / read-marking so the caller can refresh
 * list badges.
 */
export function ConversationThread({
  conversationId,
  onChanged,
  showHeader = true,
  showTemplates = true,
}: {
  conversationId: string
  onChanged?: () => void
  showHeader?: boolean
  showTemplates?: boolean
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [handoffParams] = useSearchParams()
  const handoffId = handoffParams.get('intake_follow_up')
  const [emailSubject, setEmailSubject] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  // Whether the reader is sitting at the newest message. Starts true so a
  // freshly opened thread lands on the latest, and goes false the moment they
  // scroll up to read history — nothing yanks the view out from under them.
  const pinnedRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const threadQuery = useQuery({
    queryKey: threadKey(conversationId),
    queryFn: () => getConversation(conversationId),
    refetchInterval: 10000,
  })

  useEffect(() => {
    onChanged?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const messages = (threadQuery.data?.messages ?? []).filter(shouldShowMessage)
  const conversation = threadQuery.data?.conversation
  const readers = threadQuery.data?.read_by ?? []
  const isEmail = conversation?.channel === 'email'
  const isCallThread = conversation?.channel === 'call' || conversation?.channel === 'voicemail'

  // Switching threads is a fresh read: back to the newest message.
  useEffect(() => {
    pinnedRef.current = true
  }, [conversationId])

  // Before paint, so the thread is never briefly shown at the top.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages.length, conversationId])

  /**
   * A thread full of texted photos doesn't reach its final height until the
   * images decode, which happens well after the effect above runs — so on the
   * threads that need this most, a one-shot scroll lands part way up. Watching
   * the content box instead keeps the bottom pinned through every reflow.
   */
  useEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [conversationId])

  const replyMutation = useMutation({
    mutationFn: (vars: { body: string; media: string[]; subject: string }) =>
      isEmail
        ? sendEmailReply(conversationId, vars.subject, vars.body)
        : replyToConversation(conversationId, vars.body, vars.media),
    onSuccess: () => {
      setDraft('')
      setEmailSubject('')
      setPendingImages([])
      setSendError(null)
      queryClient.invalidateQueries({ queryKey: threadKey(conversationId) })
      onChanged?.()
    },
    onError: (err) => {
      setSendError(err instanceof ApiError ? err.message : 'Send failed.')
      queryClient.invalidateQueries({ queryKey: threadKey(conversationId) })
    },
  })

  const title = conversation?.customer_name
    || conversation?.external_email
    || formatPhone(conversation?.external_number)

  const handleSend = () => {
    const body = draft.trim()
    if (replyMutation.isPending) return
    if (isEmail) {
      if (body === '') return
      replyMutation.mutate({ body, media: [], subject: emailSubject.trim() })
    } else {
      if (body === '' && pendingImages.length === 0) return
      replyMutation.mutate({ body, media: pendingImages, subject: '' })
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setSendError(null)
    try {
      for (const file of Array.from(files)) {
        const url = await uploadCommsImage(conversationId, file)
        setPendingImages((prev) => [...prev, url])
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const insertTemplate = (t: { subject?: string; body: string }) => {
    if (isEmail && t.subject) {
      setEmailSubject((prev) => (prev.trim() === '' ? t.subject! : prev))
    }
    setDraft((prev) => (prev.trim() === '' ? t.body : `${prev}\n${t.body}`))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-navy-900">{title || '—'}</div>
            <div className="truncate text-xs text-slate-500">
              {isEmail
                ? conversation?.external_email
                : `${formatPhone(conversation?.external_number)}${conversation?.internal_number ? ` · via ${formatPhone(conversation.internal_number)}` : ''}`}
            </div>
          </div>
          <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {isEmail ? 'Email' : isCallThread ? 'Call' : 'Text'}
          </span>
        </div>
      )}

      {/* Messages */}
      {handoffId && <IntakeDraftHandoff key={`${conversationId}:${handoffId}`} intakeId={handoffId} conversationId={conversationId} recipient={conversation?.external_email || conversation?.external_number || ''} onLoad={text => {
        if ((draft.trim() || pendingImages.length) && !window.confirm('Replace the current message and remove its attachments with the saved intake draft?')) return false
        setDraft(text); setPendingImages([]); setSendError(null)
        return true
      }} />}
      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current
          if (!el) return
          // A little slack, so a stray wheel tick doesn't count as "reading
          // history" and stop new replies from scrolling into view.
          pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4"
      >
        <div ref={contentRef} className="space-y-3">
          {threadQuery.isLoading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-slate-500">No messages yet.</div>
          ) : (
            <ReadersContext.Provider value={readers}>
              {messages.map((m) => <MessageBubble key={m.id} message={m} conversationId={conversationId} />)}
            </ReadersContext.Provider>
          )}
        </div>
      </div>

      {/* Reply box */}
      <div className="border-t border-slate-200 bg-white p-3">
        {sendError && (
          <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {sendError}
          </div>
        )}

        {isEmail ? (
          <div className="space-y-2">
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={conversation?.subject ? `Re: ${conversation.subject}` : 'Subject (optional)'}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Write your email…"
              className="block w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <EmojiBar onPick={(emoji) => setDraft((prev) => `${prev}${emoji}`)} />
            <div className="flex items-center justify-between gap-2">
              {showTemplates ? (
                <TemplatePicker
                  channel="email"
                  onPick={insertTemplate}
                  disabled={replyMutation.isPending}
                  customerId={conversation?.customer_id ?? null}
                  workOrderId={conversation?.work_order_id ?? null}
                />
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={draft.trim() === '' || replyMutation.isPending}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {replyMutation.isPending ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {(pendingImages.length > 0 || uploading) && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pendingImages.map((url, i) => (
                  <div key={url} className="relative">
                    <img src={url} alt="attachment" className="h-16 w-16 rounded-md border border-slate-200 object-cover" />
                    <button
                      type="button"
                      onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-slate-700 text-xs leading-none text-white hover:bg-slate-900"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {uploading && (
                  <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-500">
                    …
                  </div>
                )}
              </div>
            )}
            <div className="mb-2">
              <EmojiBar onPick={(emoji) => setDraft((prev) => `${prev}${emoji}`)} />
            </div>
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || replyMutation.isPending}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Attach image"
                title="Attach image"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path
                    d="M14 7l-5.5 5.5a2 2 0 11-2.83-2.83l5.66-5.66a3.5 3.5 0 114.95 4.95l-6.36 6.36a5 5 0 11-7.07-7.07L9 4.1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {showTemplates && (
                <TemplatePicker
                  channel="sms"
                  onPick={insertTemplate}
                  disabled={replyMutation.isPending}
                  customerId={conversation?.customer_id ?? null}
                  workOrderId={conversation?.work_order_id ?? null}
                />
              )}
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                rows={2}
                placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={(draft.trim() === '' && pendingImages.length === 0) || replyMutation.isPending}
                className="flex-shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {replyMutation.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Dropdown that inserts a saved template into the draft. */
function TemplatePicker({
  channel,
  onPick,
  disabled,
  customerId,
  workOrderId,
}: {
  channel: 'sms' | 'email'
  onPick: (t: { subject?: string; body: string }) => void
  disabled?: boolean
  customerId?: string | null
  workOrderId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  const templatesQuery = useQuery({
    queryKey: ['msg-templates', channel, 'picker'],
    queryFn: channel === 'email' ? listEmailTemplates : listSmsTemplates,
    enabled: open,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = async (id: string) => {
    setLoadingId(id)
    try {
      // Render merge tags against this thread's customer/job so the inserted
      // copy fills in instead of dropping raw {{tags}} into the reply.
      try {
        const r = await renderTemplateForComposer({
          channel,
          template_id: id,
          customer_id: customerId ?? null,
          work_order_id: workOrderId ?? null,
        })
        onPick({ subject: r.subject, body: r.body })
      } catch {
        // Fall back to the raw template if rendering fails.
        if (channel === 'email') {
          const { subject, body } = await getEmailTemplate(id)
          onPick({ subject, body })
        } else {
          const body = await getSmsTemplateBody(id)
          onPick({ body })
        }
      }
      setOpen(false)
    } catch {
      /* ignore — picker just won't insert */
    } finally {
      setLoadingId(null)
    }
  }

  const templates = templatesQuery.data ?? []

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex h-10 items-center gap-1 rounded-md border border-slate-300 px-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        title="Insert a saved template"
        aria-label="Insert a saved template"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M4 4h12v12H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Template</span>
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 z-20 max-h-72 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {templatesQuery.isLoading ? (
            <div className="px-3 py-2 text-xs text-slate-500">Loading…</div>
          ) : templates.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">No {channel === 'email' ? 'email' : 'SMS'} templates yet.</div>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t.id)}
                disabled={loadingId !== null}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50 disabled:opacity-50"
              >
                <span className="truncate">{t.name}</span>
                {loadingId === t.id ? (
                  <span className="text-[11px] text-slate-500">…</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{t.category}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Cursors for this thread, so every bubble can work out its own receipt
 * without each one being handed a list of names.
 */
const ReadersContext = createContext<ThreadReader[]>([])

function MessageBubble({ message, conversationId }: { message: CommsMessage; conversationId: string }) {
  const queryClient = useQueryClient()
  const feedbackMutation = useMutation({
    mutationFn: (vars: { outcome: 'confirmed' | 'rejected'; partId?: string | null }) =>
      submitPartMatchFeedback({
        messageId: message.id,
        outcome: vars.outcome,
        confirmedPartId: vars.outcome === 'confirmed' ? vars.partId ?? null : null,
        rejectedPartId: vars.outcome === 'rejected' ? vars.partId ?? null : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadKey(conversationId) })
    },
  })
  // Which of this message's photos is open in the viewer (index into imageUrls).
  const [viewer, setViewer] = useState<number | null>(null)

  if (message.channel === 'call' || message.channel === 'voicemail') {
    return <CallEntry message={message} />
  }
  if (message.channel === 'email') {
    return <EmailEntry message={message} />
  }

  const outbound = message.direction === 'outbound'
  const failed = message.status === 'failed'
  const parsedBody = splitBodyImageUrls(message.body)
  const hasBody = parsedBody.body.trim() !== ''
  const media = uniqueUrls([...(message.media_urls ?? []), ...parsedBody.imageUrls])
  const imageAnalysis = getImageAnalysis(message)
  const imageTitle = imageAnalysis?.summary || imageAnalysis?.description || undefined
  const bestMatch = imageAnalysis?.matches?.[0] ?? null
  const imageUrls = media.filter((u) => mediaKind(u) === 'image')

  return (
    <div className={`flex items-end gap-3 ${outbound ? 'justify-end' : 'justify-start'}`}>
      {outbound && <ReadBy message={message} align="left" />}
      <div className="max-w-[75%] space-y-1">
        {(hasBody || media.length === 0) && (
          <div
            className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
              outbound
                ? failed
                  ? 'rounded-br-sm bg-red-100 text-red-900'
                  : 'rounded-br-sm bg-amber-500 text-white'
                : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
            }`}
          >
            {/*
              A customer naming their car in a text is the commonest
              place a vehicle appears. Rendered around the spans the
              detector reports, so the message itself is never
              rewritten.
            */}
            <ReferencedText text={parsedBody.body} />
          </div>
        )}
        {media.map((url) => {
          const kind = mediaKind(url)
          if (kind === 'video') {
            return (
              <video key={url} controls preload="metadata" src={url} className={`max-h-60 max-w-[14rem] rounded-lg border border-slate-200 ${outbound ? 'ml-auto' : ''}`}>
                <a href={url} target="_blank" rel="noreferrer">Open video</a>
              </video>
            )
          }
          if (kind === 'audio') {
            return <audio key={url} controls preload="none" src={url} className={`w-56 ${outbound ? 'ml-auto' : ''}`} />
          }
          if (kind === 'file') {
            return (
              <a key={url} href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 ${outbound ? 'ml-auto' : ''}`}>
                📎 Media attachment
              </a>
            )
          }
          return (
            <div key={url} className={`relative w-fit ${outbound ? 'ml-auto' : ''}`}>
            <button
              type="button"
              onClick={() => setViewer(imageUrls.indexOf(url))}
              title="Open photo viewer"
              className={`relative block cursor-zoom-in rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${outbound ? 'ml-auto' : ''}`}
            >
              <img
                src={url}
                alt="attachment"
                className="max-h-60 max-w-[14rem] rounded-lg border border-slate-200 object-cover"
              />
            </button>
            {!outbound && <PhotoTeachingNotes message={message} url={url} analysis={imageAnalysis} photoNumber={imageUrls.indexOf(url) + 1} photoCount={imageUrls.length} images={imageUrls} />}
            </div>
          )
        })}
        {imageUrls.length > 0 && <SavedReadings message={message} />}
        {imageUrls.length > 0 && (
          <ImageLightbox
            images={imageUrls}
            index={viewer}
            onClose={() => setViewer(null)}
            onIndexChange={setViewer}
            title={imageTitle ?? (message.from_number ? `Photo from ${formatPhone(message.from_number)}` : 'Photo')}
            onReadText={async (url, view) => {
              const res = await readImageText(message.id, url, view)
              queryClient.invalidateQueries({ queryKey: threadKey(conversationId) })
              return res.data
            }}
          />
        )}
        {!outbound && imageAnalysis && (
          <PartMatchFeedbackActions
            analysis={imageAnalysis}
            bestPartId={bestMatch?.part.id ?? null}
            pending={feedbackMutation.isPending}
            onConfirm={() => bestMatch && feedbackMutation.mutate({ outcome: 'confirmed', partId: bestMatch.part.id })}
            onReject={() => feedbackMutation.mutate({ outcome: 'rejected', partId: bestMatch?.part.id ?? null })}
          />
        )}
        <div className={`text-[11px] text-slate-500 ${outbound ? 'text-right' : 'text-left'}`}>
          {message.from_number && (
            <>
              From <span className="font-mono">{formatPhone(message.from_number)}</span>
              {' · '}
            </>
          )}
          <span title={fullStamp(message.created_at)}>{messageStamp(message.created_at)}</span>
          {failed && <span className="text-red-500"> · failed{message.error ? `: ${message.error}` : ''}</span>}
        </div>
      </div>
      {!outbound && <ReadBy message={message} align="right" />}
    </div>
  )
}

/**
 * Who in the office has seen this message.
 *
 * A reader's cursor says they have read everything up to a moment, so a
 * message is read by them when it arrived at or before it. That is why the
 * thread sends cursors and not a list of names per message.
 *
 * The author of an outbound message is not told they read their own text.
 */
function ReadBy({ message, align }: { message: CommsMessage; align: 'left' | 'right' }) {
  const readers = useContext(ReadersContext)
  const sentAt = message.created_at ? new Date(message.created_at).getTime() : null
  if (sentAt === null) return null

  const seen = readers.filter((r) => {
    if (!r.last_read_at) return false
    if (message.sent_by_account_id && r.account_id === message.sent_by_account_id) return false
    return new Date(r.last_read_at).getTime() >= sentAt
  })
  if (seen.length === 0) return null

  const names = seen.map((r) => r.name)
  const label = names.length <= 2
    ? names.join(' and ')
    : `${names.slice(0, 2).join(', ')} +${names.length - 2}`

  return (
    <span
      title={`Read by ${names.join(', ')}`}
      className={`min-w-0 shrink select-none truncate pb-5 text-[11px] text-slate-400 ${
        align === 'right' ? 'text-left' : 'text-right'
      }`}
    >
      Read by {label}
    </span>
  )
}

function PartMatchFeedbackActions({
  analysis,
  bestPartId,
  pending,
  onConfirm,
  onReject,
}: {
  analysis: CommsImageAnalysis
  bestPartId: string | null
  pending: boolean
  onConfirm: () => void
  onReject: () => void
}) {
  const feedback = analysis.latest_feedback
  if (feedback?.outcome) {
    return (
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-emerald-700">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold">
          AI match {feedback.outcome}
        </span>
      </div>
    )
  }

  if (!bestPartId && analysis.status !== 'ready') return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      {bestPartId && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          Confirm match
        </button>
      )}
      <button
        type="button"
        onClick={onReject}
        disabled={pending}
        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  )
}

/** What AI last read off each photo (from the viewer's "Read text") — kept on the message. */
function SavedReadings({ message }: { message: CommsMessage }) {
  const raw = message.meta?.ai_text_readings
  if (!Array.isArray(raw) || raw.length === 0) return null
  // Newest first; one line per photo.
  const seen = new Set<string>()
  const latest = (raw as CommsTextReadingEntry[]).filter((e) => {
    if (!e || typeof e !== 'object' || seen.has(e.url)) return false
    seen.add(e.url)
    return true
  })
  const rows = latest.flatMap((e) => (Array.isArray(e.readings) ? e.readings : []).map((r) => ({ ...r, url: e.url })))
  if (rows.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
      <span className="text-slate-500">AI read:</span>
      {rows.slice(0, 6).map((r, i) => (
        <span key={`${r.url}-${i}`} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5">
          <span className="font-mono font-semibold tracking-wide text-slate-900">{r.text}</span>
          {r.kind && <span className="text-slate-400">{String(r.kind).replace(/_/g, ' ')}</span>}
          {r.confidence !== null && r.confidence !== undefined && <span className="text-slate-400">{r.confidence}%</span>}
        </span>
      ))}
    </div>
  )
}


function getImageAnalysis(message: CommsMessage): CommsImageAnalysis | null {
  const raw = message.meta?.ai_image_analysis
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<CommsImageAnalysis>
  return {
    status: String(value.status ?? 'unknown'),
    summary: typeof value.summary === 'string' ? value.summary : null,
    description: typeof value.description === 'string' ? value.description : null,
    visible_text: Array.isArray(value.visible_text) ? value.visible_text.map(String) : [],
    likely_terms: Array.isArray(value.likely_terms) ? value.likely_terms.map(String) : [],
    matches: Array.isArray(value.matches) ? value.matches as CommsImageAnalysis['matches'] : [],
    stock: Array.isArray(value.stock) ? value.stock as CommsImageAnalysis['stock'] : [],
    provider: typeof value.provider === 'string' ? value.provider : null,
    model: typeof value.model === 'string' ? value.model : null,
    error: typeof value.error === 'string' ? value.error : null,
    latest_feedback: value.latest_feedback && typeof value.latest_feedback === 'object'
      ? value.latest_feedback as CommsImageAnalysis['latest_feedback']
      : null,
  }
}


function splitBodyImageUrls(body: string | null | undefined): { body: string; imageUrls: string[] } {
  if (!body) return { body: '', imageUrls: [] }

  const imageUrls: string[] = []
  const withoutImageUrls = body.replace(/https?:\/\/[^\s<>"']+/gi, (raw) => {
    const url = raw.replace(/[)\].,;!?]+$/g, '')
    if (!isMediaUrl(url)) return raw
    imageUrls.push(url)
    return ''
  })

  return {
    body: withoutImageUrls.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    imageUrls,
  }
}

/** Classify an MMS/media URL so a .3gp video or .amr audio renders as a player
 *  instead of a broken <img>, and an opaque S3 attachment shows as a card. */
function mediaKind(url: string): 'image' | 'video' | 'audio' | 'file' {
  const clean = url.split('?')[0]
  if (/\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(clean)) return 'image'
  if (/\.(mp4|mov|3gp|3g2|webm|m4v|mkv)$/i.test(clean)) return 'video'
  if (/\.(mp3|m4a|amr|ogg|oga|wav|aac)$/i.test(clean)) return 'audio'
  return 'file'
}

function isMediaUrl(url: string): boolean {
  const clean = url.split('?')[0]
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|mp4|mov|3gp|3g2|webm|m4v|mkv|mp3|m4a|amr|ogg|oga|wav|aac)$/i.test(clean)
    // Carrier MMS lands in S3 with an opaque key (no extension) — still media.
    || /amazonaws\.com\/[^\s]+/i.test(clean)
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function sanitizeEmailHtml(html: string): string {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return escapeHtml(html)
  }

  const doc = new window.DOMParser().parseFromString(html, 'text/html')
  const blockedTags = new Set([
    'base',
    'button',
    'embed',
    'form',
    'iframe',
    'input',
    'link',
    'math',
    'meta',
    'object',
    'script',
    'select',
    'style',
    'svg',
    'textarea',
  ])

  doc.body.querySelectorAll('*').forEach((node) => {
    const el = node as HTMLElement
    if (blockedTags.has(el.tagName.toLowerCase())) {
      el.remove()
      return
    }

    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()

      if (name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name)
        return
      }

      if ((name === 'href' || name === 'src') && (value.startsWith('javascript:') || value.startsWith('data:'))) {
        el.removeAttribute(attr.name)
        return
      }

      if (name === 'target' && attr.value === '_blank') {
        el.setAttribute('rel', 'noreferrer noopener')
      }
    })
  })

  return doc.body.innerHTML
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)))
}

/** Email entry — full-width card with subject + body. */
function EmailEntry({ message }: { message: CommsMessage }) {
  const outbound = message.direction === 'outbound'
  const failed = message.status === 'failed'
  const body = message.body ?? ''
  const opened = Boolean(message.opened_at)
  const htmlBody = body && looksLikeHtml(body) ? sanitizeEmailHtml(body) : null

  return (
    <div className={`rounded-xl border px-4 py-3 ${outbound ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="font-medium text-slate-500">
          {outbound ? `You → ${message.to_email ?? ''}` : `${message.from_email ?? ''} → you`}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {outbound && (
            <span
              className={`inline-flex items-center rounded px-3 py-1 text-xs font-bold ring-1 ring-inset ${
                failed
                  ? 'bg-rose-100 text-rose-800 ring-rose-200'
                  : opened
                    ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                    : 'bg-rose-100 text-rose-800 ring-rose-200'
              }`}
              title={
                failed
                  ? message.error ?? 'The email failed to send.'
                  : opened && message.opened_at
                    ? `First opened ${fullStamp(message.opened_at)}`
                    : 'No tracked open yet. Some email apps block tracking images.'
              }
            >
              {failed ? 'Failed' : opened ? 'Opened' : 'Not opened'}
            </span>
          )}
          <span title={fullStamp(message.created_at)}>{messageStamp(message.created_at)}</span>
        </div>
      </div>
      {message.subject && <div className="mt-1 text-sm font-semibold text-navy-900">{message.subject}</div>}
      {body && (
        htmlBody ? (
          // Inbound customer email is attacker-controlled — anyone who knows the
          // address can send it. Sanitize before it reaches staff's session.
          <SafeHtml
            className="mt-2 max-w-full overflow-x-auto rounded-lg bg-white/80 px-3 py-2 text-sm leading-relaxed text-slate-700 [&_a]:text-amber-700 [&_a]:underline [&_img]:max-w-full [&_img]:rounded-md [&_p]:my-2 [&_table]:max-w-full"
            html={htmlBody}
          />
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{body}</p>
        )
      )}
      {failed && (
        <p className="mt-1 text-[11px] text-red-500">failed{message.error ? `: ${message.error}` : ''}</p>
      )}
    </div>
  )
}

/** Call / voicemail entry — card with transcript + recording player. */
function IntakeChip({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-semibold ${urgent ? 'text-red-600' : 'text-slate-800'}`} title={value}>
        {value}
      </div>
    </div>
  )
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Urgency that should read as hot (red) rather than routine. */
function isUrgentPriority(value: string): boolean {
  return /urgent|emergency|today|asap|now/i.test(value)
}

/** Call length as "4:12", from whichever key the provider stamped on meta. */
function callDurationLabel(meta: Record<string, unknown> | null | undefined): string {
  const raw = meta?.duration ?? meta?.call_duration ?? meta?.recording_duration
  const secs = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(secs) || secs <= 0) return ''
  return `${Math.floor(secs / 60)}:${String(Math.floor(secs) % 60).padStart(2, '0')}`
}

/**
 * A call transcript with the two sides told apart.
 *
 * whisper returns one undivided string, so a two-party call reads as a wall of
 * text and a dispatcher has to work out who is speaking from the words. Where
 * we have speaker turns, each side gets its own shade.
 *
 * Colour is never the only signal — every turn carries a written label too, so
 * this still works printed, in greyscale, and for anyone who cannot separate
 * the two hues.
 *
 * No segments (an older call, a short voicemail, a labelling pass that failed
 * its own sanity check) falls back to exactly what this showed before.
 */
export function CallTranscript({ message }: { message: CommsMessage }) {
  const segments = message.transcript_segments
  const [view, setView] = useState<'conversation' | 'original'>('conversation')

  if (!segments || segments.length === 0) {
    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
        {message.body}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2" role="group" aria-label="Transcript view">
        {(['conversation', 'original'] as const).map(value => <button key={value} type="button"
          aria-pressed={view === value} onClick={() => setView(value)}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${view === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
          {value === 'conversation' ? 'Conversation' : 'Original'}
        </button>)}
      </div>
      {view === 'original' ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{typeof message.meta?.original_transcript === 'string' ? message.meta.original_transcript : message.body}</p> : <>
      <p className="text-[11px] text-slate-500">{segments.some(s => s.source === 'audio') ? 'Voices separated from audio. Customer/dispatch roles are not verified. Check the recording for uncertain words.' : 'Speaker roles are inferred from the words, not verified from voices. Check the recording when attribution matters.'}</p>
      {segments.map((seg, i) => {
        const office = seg.speaker === 'office'
        const customer = seg.speaker === 'customer'
        return (
          <div
            key={i}
            className={[
              'w-fit max-w-[92%] rounded-xl border px-3 py-2 text-sm leading-relaxed sm:max-w-[80%]',
              office || (!customer && seg.source === 'audio' && seg.voice === 2)
                ? 'ml-auto border-amber-200 bg-amber-50/60 text-slate-800'
                : customer || (seg.source === 'audio' && seg.voice === 1)
                  ? 'mr-auto border-sky-200 bg-sky-50/60 text-slate-800'
                  // Unlabelled on purpose rather than guessed: the labeller is
                  // told to say "unknown" instead of inventing an attribution.
                  : 'mx-auto border-slate-200 bg-slate-50 text-slate-600',
            ].join(' ')}
          >
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {office ? 'Dispatch · inferred' : customer ? 'Customer · inferred' : seg.voice ? `Speaker ${seg.voice}` : 'Speaker unclear'}
              {seg.start != null && <span className="ml-2 font-normal">{Math.floor(seg.start / 60)}:{String(Math.floor(seg.start % 60)).padStart(2, '0')}</span>}
            </span>
            <span className="whitespace-pre-wrap break-words">
              <ReferencedText text={seg.text} />
            </span>
          </div>
        )
      })}</>}
    </div>
  )
}

function CallEntry({ message }: { message: CommsMessage }) {
  const navigate = useNavigate()
  const isVoicemail = message.channel === 'voicemail'
  const inbound = message.direction === 'inbound'
  const label = isVoicemail ? 'Voicemail' : inbound ? 'Inbound call' : 'Outbound call'
  const icon = isVoicemail ? '🎙️' : '📞'
  const hasBody = !!message.body && message.body.trim() !== ''
  const playbackUrl = recordingPlaybackUrl(message)
  const hasRecording = hasCallRecordingCandidate(message)
  // Quick view: creating the AI draft opens a review drawer (verify the parse +
  // play the recording) instead of jumping straight to the create form.
  const [previewDraft, setPreviewDraft] = useState<AiIntakeDraft | null>(null)
  const intakeMutation = useMutation({
    mutationFn: () => createAiIntakeDraftFromMessage(message.id),
    onSuccess: (draft) => setPreviewDraft(draft),
  })

  const [showTranscript, setShowTranscript] = useState(false)
  const [showPlayer, setShowPlayer] = useState(false)
  const intake = message.intake ?? null
  const durationLabel = callDurationLabel(message.meta)
  // With an AI summary the raw transcript is secondary — keep it behind a
  // button instead of dumping a wall of text into the thread. Long transcripts
  // collapse too, even without a summary.
  const collapsibleTranscript = hasBody && (!!intake || !!message.transcript_segments?.length || (message.body?.length ?? 0) > 280)

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span aria-hidden>{icon}</span>
          <span>{label}</span>
          <span className="ml-auto text-[11px] font-normal text-slate-400" title={fullStamp(message.created_at)}>
            {messageStamp(message.created_at)}{durationLabel && ` · ${durationLabel}`}
          </span>
        </div>
        {message.from_number && (
          <div className="mt-0.5 text-[11px] text-slate-500">
            From <span className="font-mono">{formatPhone(message.from_number)}</span>
            {message.to_number && <> → <span className="font-mono">{formatPhone(message.to_number)}</span></>}
          </div>
        )}
        {!inbound && message.sent_by?.name && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy-800">
            <span aria-hidden>👤</span> Called by {message.sent_by.name}
          </div>
        )}
        {/* What the caller needs leads — it's what dispatch acts on. */}
        {intake && (
          <div className="mt-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">What they need</div>
            {intake.summary && (
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {/* The call summary names the vehicle more often than anything else does. */}
                <ReferencedText text={intake.summary} />
              </p>
            )}
            {(intake.service || intake.priority || intake.area) && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {intake.service && <IntakeChip label="Service" value={intake.service} />}
                {intake.priority && (
                  <IntakeChip label="Urgency" value={titleCase(intake.priority)} urgent={isUrgentPriority(intake.priority)} />
                )}
                {intake.area && <IntakeChip label="Area" value={intake.area} />}
              </div>
            )}
          </div>
        )}

        {/* A short transcript with no summary reads fine inline; anything
            longer sits behind "Read transcript". */}
        {hasBody && !collapsibleTranscript && (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
            <ReferencedText text={message.body} />
          </p>
        )}

        {(hasBody || playbackUrl) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {message.conversation_id && <CallJobLink conversationId={message.conversation_id} />}
            {intake?.created_work_order_id ? (
              <button
                type="button"
                onClick={() => navigate(`/jobs/${intake.created_work_order_id}`)}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                View job →
              </button>
            ) : hasBody ? (
              <button
                type="button"
                onClick={() => intakeMutation.mutate()}
                disabled={intakeMutation.isPending}
                className="rounded-md bg-amber-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {intakeMutation.isPending
                  ? 'Reading call…'
                  : `Create ${intake?.classification === 'estimate' ? 'estimate' : 'job'} from this call`}
              </button>
            ) : null}
            {playbackUrl && (
              <button
                type="button"
                onClick={() => setShowPlayer((open) => !open)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                ▶ {showPlayer ? 'Hide recording' : 'Play recording'}
              </button>
            )}
            {collapsibleTranscript && (
              <button
                type="button"
                onClick={() => setShowTranscript((open) => !open)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {showTranscript ? 'Hide transcript' : 'Read transcript'}
              </button>
            )}
            {intake?.confidence != null && (
              <span className="text-[11px] text-slate-400" title="AI estimate for extracted intake details, not voice identification or transcript accuracy">Intake confidence: {Math.round(intake.confidence * 100)}%</span>
            )}
          </div>
        )}
        {intakeMutation.isError && (
          <span className="mt-1 block text-xs text-red-600">
            {intakeMutation.error instanceof ApiError ? intakeMutation.error.message : 'Could not create AI draft.'}
          </span>
        )}
        {showPlayer && playbackUrl && (
          <AuthedAudio src={playbackUrl} autoPlay className="mt-3 w-full" />
        )}
        {showTranscript && collapsibleTranscript && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <CallTranscript message={message} />
          </div>
        )}
        <CallIntakePreviewDrawer
          draft={previewDraft}
          playbackUrl={playbackUrl}
          sourceConversationId={message.conversation_id ?? null}
          onClose={() => setPreviewDraft(null)}
          onCreate={(draft) => {
            const params = new URLSearchParams({
              ai_intake_draft_id: draft.id,
              kind: draft.classification === 'estimate' ? 'estimate' : 'job',
            })
            if (draft.matched_customer_id) params.set('customer_id', draft.matched_customer_id)
            // Pass the source thread explicitly so the created job can move it
            // out of the inbox — more reliable than the draft's nested relation.
            if (message.conversation_id) params.set('source_conversation_id', message.conversation_id)
            navigate(`/${draft.classification === 'estimate' ? 'estimates' : 'jobs'}/new?${params}`)
          }}
        />
        {!hasBody && (message.transcription_status === 'pending' || message.transcription_status === 'processing') && (
          <p className="mt-2 text-xs italic text-slate-400">Transcribing recording...</p>
        )}
        {!hasBody && message.transcription_status === 'failed' && (
          <p className="mt-2 text-xs italic text-slate-400">Transcript unavailable.</p>
        )}
        {!hasBody && !hasRecording && (
          <p className="mt-1 text-xs text-slate-500">No transcript or recording.</p>
        )}
      </div>
    </div>
  )
}

function intakeStr(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  return ''
}
function intakeName(c: Record<string, unknown>): string {
  return intakeStr(c.display_name)
    || [intakeStr(c.first_name), intakeStr(c.last_name)].filter(Boolean).join(' ')
    || intakeStr(c.business_name)
}
/** Show a clean 24h "HH:MM" as standard 12h "h:MM AM/PM"; leave anything else. */
/** Convert "3:00 PM" back to "15:00" for the form's time field; leave free-form. */
function to24Hour(raw: string): string {
  const s = raw.trim()
  const m = s.match(/^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i)
  if (!m) return s
  let h = parseInt(m[1], 10) % 12
  if (/p/i.test(m[3])) h += 12
  return `${String(h).padStart(2, '0')}:${m[2]}`
}
/** "15:00" → "16:00" — a default 1-hour window when the caller only gave a
 *  start time, so the quick-created job shows as a real block on the calendar. */
function addOneHour(hhmm: string): string {
  const m = hhmm.match(/^(\d{2}):(\d{2})/)
  if (!m) return hhmm
  const h = (parseInt(m[1], 10) + 1) % 24
  return `${String(h).padStart(2, '0')}:${m[2]}`
}
/** Normalize any heard time ("3:00 PM", "15:00:00") to a 24h "HH:MM" the
 *  native <input type="time"> accepts, or "" if it isn't a time. */
function toTimeInput(raw: string): string {
  const m = to24Hour(raw.trim()).match(/^(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}
/** Keep only a valid ISO date for <input type="date">; drop "tomorrow" etc. */
function toDateInput(raw: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : ''
}
/** Today's date "YYYY-MM-DD" (local) — default schedule for a new job. */
function todayLocalDate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** Current time "HH:MM" (local) — default start time for a new job. */
function nowLocalTime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/**
 * Quick view before creating a job/estimate from a call: play the recording,
 * eyeball what the AI heard, then push through to the pre-filled form (where
 * anything can be corrected). Peek-style slide-in; Esc closes.
 */
function CallIntakePreviewDrawer({
  draft,
  playbackUrl,
  sourceConversationId,
  onClose,
  onCreate,
}: {
  draft: AiIntakeDraft | null
  playbackUrl: string | null
  sourceConversationId: string | null
  onClose: () => void
  onCreate: (draft: AiIntakeDraft) => void
}) {
  useEffect(() => {
    if (!draft) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, onClose])

  if (!draft) return null

  // A draft can come back FAILED on a perfectly successful request — the AI
  // call worked but produced nothing usable. Rendering the editor anyway
  // gives a panel of blank fields, which reads as "the button did nothing".
  // Say what happened instead, and offer the retry.
  const readFailed = draft.status === 'failed'

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end" role="dialog" aria-modal="true" aria-label="Review before creating">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/30" />
      {readFailed ? (
        <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-slate-900">Couldn't read this call</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            The recording came through, but the AI didn't return anything we could turn into a job. Nothing was created.
          </p>
          {draft.error && (
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{draft.error}</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Try again — if it keeps happening, check Tool Shed &rarr; CBI AI Settings, or read the transcript and create the job by hand.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        /* key by draft id so the editable fields re-seed for each new draft. */
        <CallIntakeEditor key={draft.id} draft={draft} playbackUrl={playbackUrl} sourceConversationId={sourceConversationId} onClose={onClose} onCreate={onCreate} />
      )}
    </div>,
    document.body,
  )
}

function PeekInput({ label, value, onChange, className = '', placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </label>
  )
}

/** Editable review before creating a job/estimate: correct the common fields
 *  here (saved back onto the AI draft), then push into the pre-filled form. */
function CallIntakeEditor({
  draft,
  playbackUrl,
  sourceConversationId,
  onClose,
  onCreate,
}: {
  draft: AiIntakeDraft
  playbackUrl: string | null
  sourceConversationId: string | null
  onClose: () => void
  onCreate: (draft: AiIntakeDraft) => void
}) {
  const navigate = useNavigate()
  const c = (draft.proposed_customer_json ?? {}) as Record<string, unknown>
  const l = (draft.proposed_location_json ?? {}) as Record<string, unknown>
  const j = (draft.proposed_job_json ?? {}) as Record<string, unknown>
  const est = (draft.proposed_estimate_json ?? {}) as Record<string, unknown>
  const isEstimate = draft.classification === 'estimate'
  const kindNoun = isEstimate ? 'estimate' : 'job'
  const isBusiness = !!intakeStr(c.business_name)
  const confidencePct = typeof draft.confidence === 'number' ? Math.round(draft.confidence * 100) : null

  const [name, setName] = useState(intakeName(c))
  const [phone, setPhone] = useState(intakeStr(c.phone))
  const [email, setEmail] = useState(intakeStr(c.email))
  // For a customer already on file, start the address blank so leaving it that
  // way means "use their address on file"; the AI's heard address only seeds
  // the field when we're creating a brand-new customer.
  const initiallyLinked = !!draft.matched_customer_id
  const [street, setStreet] = useState(initiallyLinked ? '' : intakeStr(l.street_address))
  const [city, setCity] = useState(initiallyLinked ? '' : intakeStr(l.city))
  const [region, setRegion] = useState(initiallyLinked ? '' : intakeStr(l.state))
  const [zip, setZip] = useState(initiallyLinked ? '' : intakeStr(l.postal_code))
  // Verified coords from Google autocomplete — power the best-tech ranking and
  // give the job a mappable location. Null until an address is picked.
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [addressVerified, setAddressVerified] = useState(false)
  const [autoVerified, setAutoVerified] = useState(false)
  // Verify the address the AI heard, once, without anyone touching it.
  //
  // A caller says "8200 Canaveral Boulevard" and the transcript has no ZIP and
  // no pin, so the job could not be mapped or ranked for the nearest tech until
  // somebody re-typed the street and picked from the dropdown — for an address
  // that was already correct.
  //
  // The rule for what counts as verified lives in lib/verifyAddress, shared
  // with the full job form so the same address cannot be accepted in one and
  // questioned in the other.
  useEffect(() => {
    if (initiallyLinked || addressVerified || !street.trim()) return
    let cancelled = false
    ;(async () => {
      const outcome = await verifyAddress({ street, city, state: region, zip })
      if (cancelled || outcome.status !== 'verified') return
      const a = outcome.address
      if (a.street) setStreet(a.street)
      if (a.city) setCity(a.city)
      if (a.state) setRegion(a.state)
      if (a.zip) setZip(a.zip)
      setLat(a.lat)
      setLng(a.lng)
      setAddressVerified(true)
      setAutoVerified(true)
    })()
    return () => { cancelled = true }
    // Once per overlay, on the address the AI heard. Re-running as somebody
    // edits would fight their typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [service, setService] = useState(intakeStr(j.requested_service) || intakeStr(j.title) || intakeStr(est.title))
  // Jobs default to now so a quick-created job always lands on the calendar;
  // the AI's heard date/time wins when it parsed one. Estimates aren't
  // auto-scheduled.
  const [reqDate, setReqDate] = useState(toDateInput(intakeStr(j.requested_date)) || (isEstimate ? '' : todayLocalDate()))
  const [reqTime, setReqTime] = useState(toTimeInput(intakeStr(j.requested_time)) || (isEstimate ? '' : nowLocalTime()))
  const [scope, setScope] = useState(intakeStr(j.description) || intakeStr(est.scope))
  // Commercial vs personal — seeded from whether the AI heard a business name.
  const [customerType, setCustomerType] = useState<'residential' | 'commercial' | 'government'>(isBusiness ? 'commercial' : 'residential')
  // Assigned tech for the quick-create path. Pre-filled from the best-tech
  // suggestion once it loads, unless the dispatcher has already chosen.
  const [leadTechId, setLeadTechId] = useState('')
  const [techTouched, setTechTouched] = useState(false)
  // Job status for the quick-create path. Defaults to the tenant's initial
  // status once loaded; dispatcher can override.
  const jobStatusesQuery = useJobStatuses({ active: true, per_page: 100 })
  const jobStatuses = jobStatusesQuery.data?.data ?? []
  const [statusId, setStatusId] = useState('')
  const [statusTouched, setStatusTouched] = useState(false)
  useEffect(() => {
    if (statusTouched || statusId || jobStatuses.length === 0) return
    const initial = jobStatuses.find((s) => s.is_initial) ?? jobStatuses[0]
    if (initial) setStatusId(initial.id)
  }, [jobStatuses, statusId, statusTouched])

  // Duplicate-catch: link to an existing customer instead of minting a new one.
  const [linkedId, setLinkedId] = useState<string | null>(draft.matched_customer_id ?? null)
  const [linkedName, setLinkedName] = useState<string>(intakeStr(draft.matched_customer?.display_name))
  const [term, setTerm] = useState(name.trim())
  useEffect(() => {
    const t = setTimeout(() => setTerm(name.trim()), 300)
    return () => clearTimeout(t)
  }, [name])
  const custSearch = useCustomers(
    { q: term, fuzzy: true, per_page: 6, sort: 'display_name', direction: 'asc' },
    { enabled: !linkedId && term.length >= 2 },
  )
  const matches = !linkedId && term.length >= 2 ? (custSearch.data?.data ?? []) : []

  // Phone is a stronger signal than name — surface an existing customer with
  // this number even when the AI didn't match it (e.g. outbound calls).
  const phoneDigits = phone.replace(/\D+/g, '')
  const phoneSearch = useCustomers(
    { phone: phoneDigits, per_page: 3 },
    { enabled: !linkedId && phoneDigits.length >= 7 },
  )
  const phoneMatches = !linkedId && phoneDigits.length >= 7 ? (phoneSearch.data?.data ?? []) : []

  // Best-tech ranking — the same dispatch scoring the board uses. Re-ranks by
  // proximity once an address is verified; before that it ranks by availability
  // so there's always a usable, best-first list to choose from.
  const techQuery = useQuery({
    queryKey: ['intake-tech-suggest', lat, lng],
    queryFn: () => suggestTechsForLocation(lat, lng),
    staleTime: 30_000,
  })
  const techSuggestions = techQuery.data ?? []
  // Pre-select the top suggestion until the dispatcher picks one themselves.
  useEffect(() => {
    if (techTouched) return
    if (techSuggestions.length > 0) setLeadTechId(techSuggestions[0].account_id)
  }, [techSuggestions, techTouched])

  // Persist the overlay's corrections back onto the draft — shared by "open
  // full form" (which reads the draft) and quick-create (belt-and-suspenders).
  function buildDraftPatch(): Parameters<typeof updateAiIntakeDraft>[1] {
    const jobJson = { ...j, requested_service: service, requested_date: reqDate, requested_time: to24Hour(reqTime), description: scope }
    // Linked to an existing customer → reuse it (no duplicate). The form
    // ignores the customer/location proposal when matched_customer_id is set.
    if (linkedId) {
      return { matched_customer_id: linkedId, proposed_job_json: jobJson }
    }
    // Otherwise merge edits onto the proposal, preserving every other key the
    // form reads (vehicle, key_fob, …). For a personal name we also rewrite
    // first/last (the form reads those before display_name).
    const nameParts = name.trim().split(/\s+/)
    const customer: Record<string, unknown> = { ...c, phone, email }
    if (isBusiness) {
      customer.business_name = name
      customer.display_name = name
    } else {
      customer.display_name = name
      customer.first_name = nameParts[0] ?? ''
      customer.last_name = nameParts.slice(1).join(' ')
    }
    return {
      matched_customer_id: null,
      proposed_customer_json: customer,
      proposed_location_json: { ...l, street_address: street, city, state: region, postal_code: zip },
      proposed_job_json: jobJson,
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => updateAiIntakeDraft(draft.id, buildDraftPatch()),
    onSuccess: (updated) => onCreate(updated),
  })

  // Turn the reviewed draft straight into a scheduled job — no full form. Saves
  // corrections first, then converts (which links the thread + notifies the
  // assigned tech). Jobs only; estimates always go through the full form.
  const quickCreateMutation = useMutation({
    mutationFn: async () => {
      await updateAiIntakeDraft(draft.id, buildDraftPatch())
      const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(reqDate.trim())
      const start = to24Hour(reqTime)
      const startTime = /^\d{2}:\d{2}/.test(start) ? start.slice(0, 5) : undefined
      // New customer → always send the address (it becomes their location).
      // Matched customer → only send it as an override when they actually
      // entered one; leaving it blank keeps their location on file.
      const sendAddress = !linkedId || !!street
      return convertIntakeDraft(draft.id, {
        customer_type: customerType,
        lead_tech_account_id: leadTechId || null,
        source_conversation_id: sourceConversationId,
        status_id: statusId || undefined,
        title: service || undefined,
        description: scope || undefined,
        street_address: sendAddress ? street || undefined : undefined,
        city: sendAddress ? city || undefined : undefined,
        state: sendAddress ? region || undefined : undefined,
        postal_code: sendAddress ? zip || undefined : undefined,
        latitude: sendAddress ? lat : undefined,
        longitude: sendAddress ? lng : undefined,
        scheduled_date: hasDate ? reqDate.trim() : undefined,
        scheduled_start_time: hasDate ? startTime : undefined,
        scheduled_end_time: hasDate && startTime ? addOneHour(startTime) : undefined,
      })
    },
    onSuccess: (res) => {
      onClose()
      navigate(`/jobs/${res.work_order_id}`)
    },
  })

  return (
    <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Review &amp; correct</div>
          <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">{name || `New ${kindNoun}`}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold capitalize text-slate-600">{draft.classification ?? 'job'}</span>
            {confidencePct !== null && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{confidencePct}% sure</span>}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {playbackUrl && (
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Recording</div>
            <AuthedAudio src={playbackUrl} className="w-full" />
          </div>
        )}

        {linkedId ? (
          // Linked to an existing customer — no duplicate will be created.
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Using existing customer</div>
            <div className="mt-0.5 text-sm font-semibold text-emerald-900">{linkedName || 'Existing customer'}</div>
            <button
              type="button"
              onClick={() => { setLinkedId(null); setLinkedName('') }}
              className="mt-1 text-xs font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800"
            >
              Not them — create a new customer instead
            </button>
          </div>
        ) : (
          <>
            {phoneMatches.length > 0 && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-rose-800">
                  <span aria-hidden>📞</span> This number is already on file — same customer?
                </div>
                <div className="space-y-1">
                  {phoneMatches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setLinkedId(m.id); setLinkedName(m.display_name) }}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent bg-white/70 px-2.5 py-1.5 text-left hover:border-rose-300 hover:bg-white"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-slate-800">{m.display_name}</span>
                      <span className="shrink-0 text-[11px] font-bold text-rose-700">Use this →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <PeekInput label={isBusiness ? 'Business name' : 'Customer name'} value={name} onChange={setName} />
            {matches.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
                  <span aria-hidden>⚠️</span> Similar customers already exist — link instead of duplicating?
                </div>
                <div className="space-y-1">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setLinkedId(m.id); setLinkedName(m.display_name) }}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent bg-white/70 px-2.5 py-1.5 text-left hover:border-amber-300 hover:bg-white"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-slate-800">{m.display_name}</span>
                      <span className="shrink-0 text-[11px] font-bold text-amber-700">Use this →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <PeekInput label="Phone" value={phone} onChange={setPhone} />
              <PeekInput label="Email" value={email} onChange={setEmail} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Customer type</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['residential', 'commercial', 'government'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCustomerType(t)}
                    className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold ${customerType === t ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {t === 'residential' ? 'Personal' : t === 'commercial' ? 'Commercial' : 'Government'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {/* Service address always shows — Google-verified so quick create is
            reliable even for an existing customer with no location on file.
            Leaving it blank for a matched customer uses their address on file. */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Service address
            {addressVerified && (
              <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                {autoVerified ? '✓ auto-verified' : '✓ verified'}
              </span>
            )}
          </span>
          <AddressAutocomplete
            value={street}
            onChange={(v) => { setStreet(v); setAddressVerified(false); setAutoVerified(false); setLat(null); setLng(null) }}
            onPlaceSelected={(p) => {
              const line = `${p.street_number ?? ''} ${p.route ?? ''}`.trim()
              setStreet(line || p.formatted_address)
              if (p.city) setCity(p.city)
              if (p.state) setRegion(p.state)
              if (p.postal_code) setZip(p.postal_code)
              setLat(p.lat)
              setLng(p.lng)
              setAddressVerified(true)
              setAutoVerified(false)
            }}
            placeholder="Start typing an address…"
            className="mt-0.5 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {linkedId && !street && (
            <p className="mt-1 text-[11px] text-slate-400">
              Using {linkedName || 'this customer'}&rsquo;s address on file — or pick a Google address to override.
            </p>
          )}
          {!linkedId && street && !addressVerified && (
            <p className="mt-1 text-[11px] text-amber-600">Pick the address from the dropdown to verify it.</p>
          )}
          {autoVerified && (
            <p className="mt-1 text-[11px] text-slate-500">
              Matched to one exact address on the map — city, ZIP and pin filled in. Retype the
              street if that&rsquo;s the wrong building.
            </p>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <PeekInput label="City" value={city} onChange={setCity} className="col-span-2" />
          <PeekInput label="State" value={region} onChange={setRegion} />
          <PeekInput label="ZIP" value={zip} onChange={setZip} />
        </div>
        <PeekInput label="Service" value={service} onChange={setService} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Date</span>
            <input
              type="date"
              value={reqDate}
              onChange={(e) => setReqDate(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Start time</span>
            <input
              type="time"
              value={reqTime}
              onChange={(e) => setReqTime(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </label>
        </div>
        {!isEstimate && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</span>
            <select
              value={statusId}
              onChange={(e) => { setStatusId(e.target.value); setStatusTouched(true) }}
              className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {jobStatuses.length === 0 && <option value="">Default</option>}
              {jobStatuses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        {!isEstimate && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Assign tech
              {addressVerified && <span className="ml-1 font-medium normal-case text-slate-400">· nearest available first</span>}
            </span>
            <select
              value={leadTechId}
              onChange={(e) => { setLeadTechId(e.target.value); setTechTouched(true) }}
              className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">Unassigned</option>
              {techSuggestions.map((t, i) => (
                <option key={t.account_id} value={t.account_id}>
                  {i === 0 ? '★ ' : ''}{t.name}{t.reason ? ` — ${t.reason}` : ''}
                </option>
              ))}
            </select>
            {leadTechId && (
              <p className="mt-1 text-[11px] text-slate-400">Creating the job texts this tech that it's theirs.</p>
            )}
          </div>
        )}
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Scope / notes</span>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={3}
            className="mt-0.5 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>

        {draft.transcript_text && (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700">Full transcript</summary>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
              <ReferencedText text={draft.transcript_text} />
            </p>
          </details>
        )}
      </div>

      <div className="border-t border-slate-200 px-5 py-3">
        {(saveMutation.isError || quickCreateMutation.isError) && (
          <p className="mb-2 text-xs text-red-600">
            {(() => {
              const err = quickCreateMutation.error ?? saveMutation.error
              return err instanceof ApiError ? err.message : 'Could not create the job.'
            })()}
          </p>
        )}
        {!isEstimate && (
          <button
            type="button"
            onClick={() => quickCreateMutation.mutate()}
            disabled={quickCreateMutation.isPending || saveMutation.isPending}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {quickCreateMutation.isPending ? 'Creating…' : leadTechId ? 'Quick create + send tech' : 'Quick create job'}
          </button>
        )}
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || quickCreateMutation.isPending}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-300 ${isEstimate ? 'bg-navy-900 text-white hover:bg-navy-800' : 'mt-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {saveMutation.isPending ? 'Saving…' : isEstimate ? 'Create estimate →' : 'Open full form →'}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          {isEstimate
            ? 'Corrections save onto the draft, then open the estimate form to finish. Esc closes.'
            : 'Quick create books the scheduled job now. Full form adds line items & pricing. Esc closes.'}
        </p>
      </div>
    </aside>
  )
}

function shouldShowMessage(message: CommsMessage): boolean {
  if (message.channel !== 'call' && message.channel !== 'voicemail') {
    return true
  }

  if (message.channel === 'voicemail') {
    return true
  }

  const hasTranscript = !!message.body && message.body.trim() !== ''
  const hasRecording = hasCallRecordingCandidate(message)
  if (hasTranscript || hasRecording || message.transcription_status === 'pending' || message.transcription_status === 'processing') {
    return true
  }

  const event = String(message.call_event || message.meta?.type || '').toLowerCase()
  return event === 'call_ringing' || event === ''
}

/**
 * Per-message stamp: time only for today ("3:42 PM"), "Yesterday, 3:42 PM",
 * else "Jun 16, 3:42 PM" (year added when it's a prior year).
 */
export function messageStamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`

  const sameYear = d.getFullYear() === now.getFullYear()
  const date = d.toLocaleDateString(
    undefined,
    sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' },
  )
  return `${date}, ${time}`
}

/** Full date + time for the hover tooltip on a message stamp. */
export function fullStamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Compact relative time: "now", "5m", "3h", "2d", else a date. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return new Date(iso).toLocaleDateString()
}

export default ConversationThread
