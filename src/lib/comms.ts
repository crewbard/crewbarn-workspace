import { apiRequest, API_URL, getStoredToken, getActingTenant } from '@/lib/api'

export type CommsDirection = 'inbound' | 'outbound'

export interface CommsConversation {
  id: string
  channel: string
  provider: string | null
  external_number: string
  internal_number: string
  external_email: string | null
  internal_email: string | null
  subject: string | null
  customer_id: string | null
  customer_name: string | null
  customer_avatar_preset?: string | null
  customer_avatar_url?: string | null
  caller_id_name: string | null
  caller_id_number: string | null
  work_order_id: string | null
  work_order: { id: string; display_number: string; title: string } | null
  last_message_at: string | null
  last_direction: CommsDirection | null
  last_message_preview: string | null
  unread_count: number
  /**
   * Unread for whoever is asking, rather than for the office as a whole.
   * Optional so an older backend degrades to unread_count instead of to
   * "nothing is ever unread".
   */
  unread_for_me?: boolean
  assigned_to_account_id?: string | null
  assigned_to?: { id: string; name: string } | null
  handled_at?: string | null
}

export interface CommsMessage {
  id: string
  conversation_id?: string
  direction: CommsDirection
  channel: string
  provider: string | null
  body: string | null
  subject: string | null
  media_urls: string[]
  /** Speaker turns for a call transcript. Absent on older calls. */
  transcript_segments?: Array<{ speaker: 'office' | 'customer' | 'unknown'; text: string; voice?: number | null; source?: 'audio'; start?: number; end?: number }> | null
  recording_url: string | null
  transcription_status: string | null
  meta?: Record<string, unknown> | null
  call_event?: string | null
  from_number: string | null
  to_number: string | null
  from_email: string | null
  to_email: string | null
  status: string | null
  error: string | null
  opened_at: string | null
  open_count: number
  sent_by_account_id: string | null
  /** Staff member who placed/sent an outbound message. Null for inbound. */
  sent_by: { id: string; name: string } | null
  read_at: string | null
  created_at: string | null
  intake?: MessageIntakeSummary | null
}

/** Compact AI intake summary shown in the thread's "What they need" card. */
export interface MessageIntakeSummary {
  id: string
  classification: 'job' | 'estimate' | string | null
  status: string | null
  confidence: number | null
  service: string | null
  summary: string | null
  priority: string | null
  area: string | null
  created_work_order_id: string | null
}

export interface CommsImageAnalysisMatch {
  confidence: number
  reason: string
  part: {
    id: string
    part_number: string | null
    model_number: string | null
    sku: string | null
    upc: string | null
    manufacturer: string | null
    brand: string | null
    category: string | null
    description: string | null
    catalog_name: string | null
  }
}

export interface CommsImageAnalysisStock {
  catalog_item_id: string
  name: string
  sku: string | null
  qty_on_hand: number
  qty_available: number
  matched_part_id: string | null
}

export interface CommsImageAnalysis {
  source_url?: string
  status: string
  summary: string | null
  description: string | null
  visible_text: string[]
  likely_terms: string[]
  matches: CommsImageAnalysisMatch[]
  stock: CommsImageAnalysisStock[]
  provider: string | null
  model: string | null
  error?: string | null
  latest_feedback?: {
    outcome: string
    confirmed_part_id: string | null
    rejected_part_id: string | null
    notes: string | null
    confirmed_by_account_id: string | null
    confirmed_at: string | null
  } | null
}

/** One reader's place in the thread: they have seen everything up to here. */
export interface ThreadReader {
  account_id: string
  name: string
  last_read_at: string | null
}

export interface ConversationThread {
  conversation: CommsConversation
  messages: CommsMessage[]
  /** Absent on an older backend, which is why every use guards for it. */
  read_by?: ThreadReader[]
}

export interface ReplyResult {
  sent: boolean
  error?: string | null
  message?: CommsMessage | null
}

export interface AiIntakeDraft {
  supports_local_correction?: boolean
  created_work_order_id?: string | null
  approved_at?: string | null
  id: string
  status: string
  source?: string | null
  classification: string | null
  confidence: number | null
  matched_customer_id?: string | null
  matched_location_id?: string | null
  transcript_text?: string | null
  extracted_json?: Record<string, unknown> | null
  proposed_customer_json?: Record<string, unknown> | null
  proposed_location_json?: Record<string, unknown> | null
  proposed_job_json?: Record<string, unknown> | null
  proposed_estimate_json?: Record<string, unknown> | null
  error?: string | null
  created_at?: string | null
  updated_at?: string | null
  comms_message?: CommsMessage & {
    conversation?: CommsConversation & {
      customer?: { id: string; display_name?: string | null; name?: string | null } | null
    }
  }
  matched_customer?: { id: string; display_name?: string | null; name?: string | null } | null
  matched_location?: { id: string; nickname?: string | null; formatted_address?: string | null } | null
}

export interface AiIntakeDraftPage {
  data: AiIntakeDraft[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

/** List conversations, newest first. Optional text search + unread filter,
 *  optionally scoped to a single customer and/or job. */
export async function listConversations(params?: {
  q?: string
  unread?: boolean
  filter?: 'action' | 'unread' | 'needs_response' | 'unknown' | 'today' | 'calls' | 'all'
  channel?: 'text' | 'call' | 'email'
  direction?: 'inbound' | 'outbound'
  /** Only calls placed from the mobile app (meta.source = mobile_dialer). */
  fromApp?: boolean
  date?: string
  dateFrom?: string
  dateTo?: string
  customerId?: string
  workOrderId?: string
  /** Include threads already attached to a job (normally hidden from the
   *  unscoped inbox). Used so search spans the full history. */
  includeLinked?: boolean
  /** Only threads assigned to the current dispatcher. */
  assignedToMe?: boolean
  /** Newest-first (default) or oldest-first. Time order either way. */
  sortDirection?: 'desc' | 'asc'
}): Promise<CommsConversation[]> {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.sortDirection === 'asc') qs.set('direction', 'asc')
  if (params?.unread) qs.set('unread', '1')
  if (params?.includeLinked) qs.set('include_linked', '1')
  if (params?.assignedToMe) qs.set('assigned_to', 'me')
  if (params?.filter && params.filter !== 'all') qs.set('filter', params.filter)
  if (params?.channel) qs.set('channel', params.channel)
  if (params?.direction) qs.set('direction', params.direction)
  if (params?.fromApp) qs.set('from_app', '1')
  if (params?.date) qs.set('date', params.date)
  if (params?.dateFrom) qs.set('date_from', params.dateFrom)
  if (params?.dateTo) qs.set('date_to', params.dateTo)
  if (params?.customerId) qs.set('customer_id', params.customerId)
  if (params?.workOrderId) qs.set('work_order_id', params.workOrderId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await apiRequest<{ data: CommsConversation[] }>(
    `/v1/comms/conversations${suffix}`
  )
  return res.data
}

export interface InboxCounts {
  needs_action: number
  unread: number
  unknown_calls: number
  assigned: number
  texts: number
  calls: number
  emails: number
}

/** Badge counts for the triage sidebar. `weekStart` (ISO) scopes the channel
 *  counts to the current week; queue counts span all time. */
export async function getInboxCounts(weekStart?: string): Promise<InboxCounts> {
  const qs = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : ''
  const res = await apiRequest<{ data: InboxCounts }>(`/v1/comms/inbox-counts${qs}`)
  return res.data
}

/** A per-job grouping of a customer's threads for the Messages tab. */
export interface MessageCard {
  work_order_id: string | null
  work_order: { id: string; display_number: string; title: string } | null
  conversations: CommsConversation[]
  unread_count: number
  last_message_at: string | null
}

/** Fetch a customer's threads grouped into per-job "message cards". */
export async function getCustomerMessageCards(
  customerId: string
): Promise<MessageCard[]> {
  const res = await apiRequest<{ data: { customer_id: string; cards: MessageCard[] } }>(
    `/v1/customers/${customerId}/message-cards`
  )
  return res.data.cards
}

/** A reusable text/email template for the reply-box picker. */
export interface MessageTemplate {
  id: string
  name: string
  category: string
  /** Filled in lazily when the template is selected. */
  body?: string
  subject?: string
}

/** List active SMS templates (id/name/category only — body fetched on pick). */
export async function listSmsTemplates(): Promise<MessageTemplate[]> {
  const res = await apiRequest<{ data: MessageTemplate[] }>(
    `/v1/sms-templates?active=1`
  )
  return res.data
}

/** Fetch one SMS template with its body (for inserting into the draft). */
export async function getSmsTemplateBody(id: string): Promise<string> {
  const res = await apiRequest<{ data: MessageTemplate }>(`/v1/sms-templates/${id}`)
  return res.data.body ?? ''
}

/** Fetch a thread (also marks inbound messages read server-side). */
export async function getConversation(id: string): Promise<ConversationThread> {
  const res = await apiRequest<{ data: ConversationThread }>(
    `/v1/comms/conversations/${id}`
  )
  return res.data
}

/** Send a reply (text and/or images) through the tenant's active provider. */
export async function replyToConversation(
  id: string,
  body: string,
  mediaUrls: string[] = []
): Promise<ReplyResult> {
  return apiRequest<ReplyResult>(`/v1/comms/conversations/${id}/reply`, {
    method: 'POST',
    body: { body, media_urls: mediaUrls },
  })
}

/** Link (or unlink) a conversation to a work order. Pass null to unlink. */
export async function linkConversation(
  id: string,
  workOrderId: string | null
): Promise<CommsConversation> {
  const res = await apiRequest<{ data: CommsConversation }>(
    `/v1/comms/conversations/${id}/link`,
    { method: 'POST', body: { work_order_id: workOrderId } }
  )
  return res.data
}

/**
 * Attach an unknown thread to a customer (or detach with null). By default the
 * caller's number is saved onto that customer so future calls auto-match.
 */
export async function linkConversationCustomer(
  id: string,
  customerId: string | null,
  saveNumber = true,
): Promise<CommsConversation> {
  const res = await apiRequest<{ data: CommsConversation }>(
    `/v1/comms/conversations/${id}/customer`,
    { method: 'POST', body: { customer_id: customerId, save_number: saveNumber } },
  )
  return res.data
}

/** Assign a thread to a dispatcher (or unassign with null). */
export async function assignConversation(
  id: string,
  accountId: string | null,
): Promise<CommsConversation> {
  const res = await apiRequest<{ data: CommsConversation }>(
    `/v1/comms/conversations/${id}/assign`,
    { method: 'POST', body: { account_id: accountId } },
  )
  return res.data
}

/** Mark a thread handled (done) or reopen it. */
export async function setConversationDone(
  id: string,
  done: boolean,
): Promise<CommsConversation> {
  const res = await apiRequest<{ data: CommsConversation }>(
    `/v1/comms/conversations/${id}/done`,
    { method: 'POST', body: { done } },
  )
  return res.data
}

/** Send an email reply within an existing email thread. */
export async function sendEmailReply(
  id: string,
  subject: string,
  body: string
): Promise<ReplyResult> {
  return apiRequest<ReplyResult>(`/v1/comms/conversations/${id}/reply`, {
    method: 'POST',
    body: { subject, body },
  })
}

export interface ComposeEmailResult {
  sent: boolean
  error?: string | null
  conversation?: CommsConversation | null
  message?: CommsMessage | null
}

export interface ComposeSmsResult {
  sent: boolean
  error?: string | null
  conversation?: CommsConversation | null
  message?: CommsMessage | null
}

export interface ClickToCallResult {
  started: boolean
  provider: string | null
  provider_call_id: string | null
  provider_request_id: string | null
  error: string | null
  from_phone: string | null
  staff_phone: string | null
  to_phone: string | null
  message_id: string | null
  conversation_id: string | null
}

export interface VoiceSdkTokenResult {
  token: string
  identity: string
  expires_at: string
  provider: 'twilio' | 'twilio_hosted'
}

export type VoiceDialerSession =
  | VoiceSdkTokenResult
  | {
      provider: 'net2phone'
      from_phone: string | null
    }

/** Start (or continue) an email thread with a customer. */
export async function composeEmail(params: {
  toEmail: string
  customerId?: string | null
  workOrderId?: string | null
  subject?: string
  body: string
}): Promise<ComposeEmailResult> {
  return apiRequest<ComposeEmailResult>(`/v1/comms/email`, {
    method: 'POST',
    body: {
      to_email: params.toEmail,
      customer_id: params.customerId ?? null,
      work_order_id: params.workOrderId ?? null,
      subject: params.subject ?? '',
      body: params.body,
    },
  })
}

/** Start (or continue) an SMS thread with a customer. */
export async function composeSms(params: {
  toPhone: string
  customerId?: string | null
  workOrderId?: string | null
  body: string
}): Promise<ComposeSmsResult> {
  return apiRequest<ComposeSmsResult>(`/v1/comms/sms`, {
    method: 'POST',
    body: {
      to_phone: params.toPhone,
      customer_id: params.customerId ?? null,
      work_order_id: params.workOrderId ?? null,
      body: params.body,
    },
  })
}

/** Start an outbound bridge call through CrewBarn's active voice provider. */
export async function clickToCall(params: {
  toPhone: string
  callbackPhone?: string | null
  customerId?: string | null
  workOrderId?: string | null
}): Promise<ClickToCallResult> {
  return apiRequest<ClickToCallResult>(`/v1/comms/calls`, {
    method: 'POST',
    body: {
      to_phone: params.toPhone,
      callback_phone: params.callbackPhone ?? null,
      customer_id: params.customerId ?? null,
      work_order_id: params.workOrderId ?? null,
    },
  })
}

export async function getVoiceSdkToken(): Promise<VoiceSdkTokenResult> {
  return apiRequest<VoiceSdkTokenResult>('/v1/comms/voice/token')
}

export async function getVoiceDialerSession(): Promise<VoiceDialerSession> {
  return apiRequest<VoiceDialerSession>('/v1/comms/voice/session')
}

export async function recordVoiceDialerEvent(params: {
  provider: 'net2phone'
  call_id: string
  state?: string | null
  result?: string | null
  direction?: 'inbound' | 'outbound' | null
  from?: string | null
  to?: string | null
  caller_display_name?: string | null
}): Promise<{ recorded: boolean; message_id: string | null }> {
  return apiRequest<{ recorded: boolean; message_id: string | null }>('/v1/comms/voice/events', {
    method: 'POST',
    body: params,
  })
}

/** List active email templates (subject included; body fetched on pick). */
export async function listEmailTemplates(): Promise<MessageTemplate[]> {
  const res = await apiRequest<{ data: MessageTemplate[] }>(`/v1/email-templates?active=1`)
  return res.data
}

/** Fetch one email template's subject + body (for inserting into a draft). */
export async function getEmailTemplate(id: string): Promise<{ subject: string; body: string }> {
  const res = await apiRequest<{ data: MessageTemplate }>(`/v1/email-templates/${id}`)
  return { subject: res.data.subject ?? '', body: res.data.body ?? '' }
}

/**
 * Render a saved template against a real customer/job so merge tags ({{...}})
 * fill in before the composer inserts it (instead of going out raw). Binds the
 * work order when given (full tags), else the customer (customer + company).
 */
export async function renderTemplateForComposer(params: {
  channel: 'email' | 'sms'
  template_id: string
  customer_id?: string | null
  work_order_id?: string | null
}): Promise<{ subject?: string; body: string }> {
  const res = await apiRequest<{ data: { subject?: string; body?: string } }>(
    '/v1/templates/render',
    { method: 'POST', body: params },
  )
  return { subject: res.data.subject, body: res.data.body ?? '' }
}

/** Upload an image for an outbound reply; returns its public URL. */
export async function uploadCommsImage(id: string, file: File): Promise<string> {
  const fd = new FormData()
  fd.append('image', file)

  const token = getStoredToken()
  const tenant = getActingTenant()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenant) headers['X-Act-As-Tenant'] = tenant

  const res = await fetch(`${API_URL}/v1/comms/conversations/${id}/upload`, {
    method: 'POST',
    headers,
    body: fd,
  })
  if (!res.ok) {
    let msg = 'Upload failed.'
    try {
      const j = await res.json()
      msg = j.message || j.error || msg
    } catch {
      // keep default
    }
    throw new Error(msg)
  }
  const json = (await res.json()) as { url: string }
  return json.url
}

export async function submitPartMatchFeedback(params: {
  messageId: string
  outcome: 'confirmed' | 'corrected' | 'rejected' | 'no_match' | 'annotated'
  photoUrl?: string
  finish?: string
  confirmedPartId?: string | null
  rejectedPartId?: string | null
  notes?: string | null
}): Promise<{ data: CommsMessage; ai_memory?: { created: boolean; discarded: boolean; reason: string | null; id?: string | null; status?: string | null; active?: boolean } }> {
  return apiRequest(`/v1/comms/messages/${encodeURIComponent(params.messageId)}/part-match-feedback`, {
    method: 'POST',
    body: {
      outcome: params.outcome,
      photo_url: params.photoUrl,
      finish: params.finish,
      confirmed_part_id: params.confirmedPartId ?? null,
      rejected_part_id: params.rejectedPartId ?? null,
      notes: params.notes ?? null,
    },
  })
}

export interface CommsTextReading {
  text: string
  kind: string | null
  confidence: number | null
  alternatives: string[]
  note: string | null
}
export interface CommsTextReadingEntry {
  url: string
  readings: CommsTextReading[]
  notes: string | null
  model: string | null
  read_by: string | null
  read_at: string | null
}

/**
 * Read the codes in one of a message's photos with the tenant's AI. `view` is
 * what the photo viewer is showing (crop as 0–1 fractions, rotation, clean-up)
 * so the model reads the zoomed-in stamping rather than the whole photo.
 */
export async function readImageText(
  messageId: string,
  url: string,
  view: { crop: { x: number; y: number; w: number; h: number }; rotate: number; sharpen: number; brightness: number; contrast: number; bw: boolean; expect?: string },
): Promise<{ data: { readings: CommsTextReading[]; notes: string | null; model: string | null; read_at: string; source_px: { w: number; h: number } | null; preview: string | null } }> {
  return apiRequest(`/v1/comms/messages/${encodeURIComponent(messageId)}/read-text`, {
    method: 'POST',
    body: { url, ...view },
  })
}

/** Ask AI to create a dispatcher-reviewed intake draft from a call transcript. */
export async function createAiIntakeDraftFromMessage(messageId: string): Promise<AiIntakeDraft> {
  const res = await apiRequest<{ data: AiIntakeDraft }>(`/v1/ai/intake/transcript`, {
    method: 'POST',
    body: { comms_message_id: messageId, source: 'call' },
  })
  return res.data
}

export async function getAiIntakeDraft(id: string): Promise<AiIntakeDraft> {
  const res = await apiRequest<{ data: AiIntakeDraft }>(`/v1/ai/intake/drafts/${encodeURIComponent(id)}`)
  return res.data
}

export interface ConvertIntakeDraftPayload {
  customer_type: 'residential' | 'commercial' | 'government'
  lead_tech_account_id?: string | null
  source_conversation_id?: string | null
  status_id?: string
  title?: string
  description?: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  latitude?: number | null
  longitude?: number | null
  scheduled_date?: string
  scheduled_start_time?: string
  scheduled_end_time?: string
}

/** Quick-create a scheduled job straight from a reviewed draft (skips the full
 *  form). Save the draft's corrections first, then call this. */
export async function convertIntakeDraft(
  id: string,
  payload: ConvertIntakeDraftPayload,
): Promise<{ work_order_id: string; work_order_number: number; lead_tech_account_id: string | null }> {
  const res = await apiRequest<{
    data: { work_order_id: string; work_order_number: number; lead_tech_account_id: string | null }
  }>(`/v1/ai/intake/drafts/${encodeURIComponent(id)}/convert`, {
    method: 'POST',
    body: payload,
  })
  return res.data
}

export async function listAiIntakeDrafts(params?: {
  status?: 'pending' | 'reviewed' | 'approved' | 'dismissed' | 'failed' | 'all'
  profile?: 'intake'
  perPage?: number
  page?: number
}): Promise<AiIntakeDraftPage> {
  const qs = new URLSearchParams()
  if (params?.status && params.status !== 'all') qs.set('status', params.status)
  if (params?.profile) qs.set('profile', params.profile)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.perPage) qs.set('per_page', String(params.perPage))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiRequest<AiIntakeDraftPage>(`/v1/ai/intake/drafts${suffix}`)
}

/** Count of pending intake drafts — powers the live "Intake" nav badge. */
export async function getIntakePendingCount(): Promise<number> {
  const res = await apiRequest<{ data: { count: number } }>('/v1/ai/intake/pending-count')
  return res.data.count
}

export async function updateAiIntakeDraft(
  id: string,
  input: Partial<Pick<
    AiIntakeDraft,
    | 'classification'
    | 'confidence'
    | 'matched_customer_id'
    | 'matched_location_id'
    | 'proposed_customer_json'
    | 'proposed_location_json'
    | 'proposed_job_json'
    | 'proposed_estimate_json'
    | 'status'
  >>,
): Promise<AiIntakeDraft> {
  const res = await apiRequest<{ data: AiIntakeDraft }>(`/v1/ai/intake/drafts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  })
  return res.data
}

export async function dismissAiIntakeDraft(id: string): Promise<AiIntakeDraft> {
  const res = await apiRequest<{ data: AiIntakeDraft }>(`/v1/ai/intake/drafts/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
  })
  return res.data
}

export interface IntakeResearchedPart {
  part_number: string
  fcc_id: string | null
  type: string | null
  buttons: number | null
  /** Which vehicles/years/body style THIS part is for — the split-year answer. */
  fits: string | null
  catalog_sku: string | null
  confidence: number | null
}

export interface IntakePartResearch {
  ok: boolean
  v: number
  parts: IntakeResearchedPart[]
  /** What settles it when more than one part could apply — usually the VIN. */
  decider: string | null
  no_part_needed: boolean
  reasoning: string | null
  cautions: string | null
  sources: Array<{ url: string; title: string | null }>
  searched_web: boolean
  researched_at: string
  error: string | null
}

/**
 * Research what part this job actually needs. A proposal only — it prefills the
 * correction for a human to approve, edit, or discard, and never writes a
 * correction or a memory itself. Cached on the draft; pass refresh to re-run.
 */
export async function researchAiIntakePart(
  id: string,
  refresh = false,
): Promise<IntakePartResearch> {
  const res = await apiRequest<{ data: IntakePartResearch }>(
    `/v1/ai/intake/drafts/${encodeURIComponent(id)}/part-research`,
    { method: 'POST', body: { refresh } },
  )
  return res.data
}

export interface IntakeAvailablePart {
  catalog_item_id: string
  name: string
  sku: string | null
  matched_by: string
  /** Which vehicles this one is for — carried from the correction. */
  fits: string | null
  in_stock: boolean
  total_available: number
  locations: Array<{
    location: string | null
    location_type: string | null
    bin: string | null
    qty_available: number
    tech: { id: string; name: string } | null
    link: string | null
  }>
}

export interface IntakePartAvailability {
  parts: IntakeAvailablePart[]
  programmers: Array<{ tech: { id: string; name: string }; asset: string; capabilities: string[] }>
  /** What picks between the parts — without it, stock reads as "we have it". */
  decider: string | null
  note: string | null
}

/**
 * Do we have this part, whose truck is it on, who can program it. Read live —
 * stock and truck contents move all day, so this is never cached onto the draft.
 */
export async function getAiIntakePartAvailability(id: string): Promise<IntakePartAvailability> {
  const res = await apiRequest<{ data: IntakePartAvailability }>(
    `/v1/ai/intake/drafts/${encodeURIComponent(id)}/part-availability`,
  )
  return res.data
}

export interface IntakeCorrectionPart {
  label: string
  /** Which vehicles/years/body style this one is for. */
  fits?: string | null
  /** Set when picked off the catalog — makes the stock lookup exact. */
  catalog_item_id?: string | null
}

/**
 * Tell the AI its part guess was wrong and what the right parts are. Records the
 * correction on the draft AND teaches it to the tenant's AI memory, so the next
 * call about the same vehicle is guessed correctly.
 *
 * A LIST, not one part: on a changeover year several parts are all correct and
 * something else (usually the VIN) picks between them. `decider` records what
 * that is — it's what teaches CBI to ask instead of guess.
 */
export async function correctAiIntakePart(
  id: string,
  input: { parts: IntakeCorrectionPart[]; decider?: string | null; notes?: string | null; remember?: boolean },
): Promise<AiIntakeDraft> {
  const res = await apiRequest<{ data: AiIntakeDraft }>(
    `/v1/ai/intake/drafts/${encodeURIComponent(id)}/part-correction`,
    { method: 'POST', body: input },
  )
  return res.data
}

export async function retryAiIntakeDraft(id: string): Promise<AiIntakeDraft> {
  const res = await apiRequest<{ data: AiIntakeDraft }>(`/v1/ai/intake/drafts/${encodeURIComponent(id)}/retry`, {
    method: 'POST',
  })
  return res.data
}

export function hasCallRecordingCandidate(message: CommsMessage): boolean {
  const meta = message.meta ?? {}
  const providerRecordingUrl = typeof meta.provider_recording_url === 'string'
    ? meta.provider_recording_url.trim()
    : ''
  const callId = typeof meta.call_id === 'string' ? meta.call_id.trim() : ''
  const audioMessageId = meta.audio_message_id
  const callEvent = String(message.call_event || meta.type || '').toLowerCase()

  return !!message.recording_url
    || providerRecordingUrl !== ''
    || (
      message.provider === 'net2phone'
      && callId !== ''
      && (
        callEvent === 'call_recorded'
        || (typeof audioMessageId === 'string' && audioMessageId.trim() !== '')
        || (typeof audioMessageId === 'number' && Number.isFinite(audioMessageId))
      )
    )
}

export function recordingPlaybackUrl(message: CommsMessage): string | null {
  if (!hasCallRecordingCandidate(message)) {
    return null
  }

  /*
   * A bare URL. It used to carry ?access_token=<session token>, because a
   * plain <audio src> cannot send an Authorization header — which put a full
   * API token into browser history, access logs, proxy logs and any Referer
   * from that tab. Whoever came by the URL held the session, not one call.
   *
   * AuthedAudio fetches this with the header and plays it from a blob, so
   * the credential never appears in a URL at all.
   */
  return `${API_URL}/v1/comms/messages/${encodeURIComponent(message.id)}/recording`
}

/** Format an E.164 US number for display: +13211234567 → (321) 123-4567. */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length === 10) {
    return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
  }
  return raw
}
