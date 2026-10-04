import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ToastPrefToggle } from '@/components/ToastPrefToggle'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import './comms-easy.css'
import { useTenantAccounts } from '@/hooks/useTenantAccounts'
import { useRealtimeComms } from '@/hooks/useRealtimeComms'
import { formatPhone, listConversations, getInboxCounts, assignConversation, setConversationDone, linkConversation, linkConversationCustomer, type CommsConversation, type InboxCounts } from '@/lib/comms'
import { listWorkOrders } from '@/lib/workOrders'
import { useCustomers } from '@/hooks/useCustomers'
import { ConversationThread } from '@/components/comms/ConversationThread'
import { NewConversationModal } from '@/components/comms/NewConversationModal'
import { Avatar } from '@/components/Avatar'
import {
  IconAdjustments, IconArchive, IconArrowUpRight, IconBolt, IconDeviceMobile,
  IconInbox, IconMail, IconMailOpened, IconMessage, IconPhone, IconUser, IconUserQuestion,
} from '@tabler/icons-react'
import type { ComponentType } from 'react'

type RailIcon = ComponentType<{ size?: number | string; stroke?: number; className?: string }>

const LIST_KEY = ['comms', 'conversations'] as const
const COUNTS_KEY = ['comms', 'inbox-counts'] as const
const threadKey = (id: string) => ['comms', 'conversation', id] as const

/** The left-rail selection. `inbox` + the channel views are week-scoped and
 *  grouped Today / Earlier this week; queues span all time; archive is older
 *  than this week. */
type View =
  | 'inbox'
  | 'needs_action'
  | 'unread'
  | 'unknown_calls'
  | 'assigned'
  | 'texts'
  | 'calls'
  | 'emails'
  | 'app_calls'
  | 'all_outbound'
  | 'archive'

type ChannelKind = 'text' | 'call' | 'email'

const WEEK_VIEWS = new Set<View>(['inbox', 'texts', 'calls', 'emails'])

const VIEW_TITLE: Record<View, string> = {
  inbox: 'Inbox',
  needs_action: 'Needs action',
  unread: 'Unread',
  unknown_calls: 'Unknown callers',
  assigned: 'Assigned to me',
  texts: 'Texts',
  calls: 'Calls',
  emails: 'Emails',
  app_calls: 'Outbound · from the app',
  all_outbound: 'Outbound · all',
  archive: 'Archive',
}

export function CommsPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [view, setView] = useState<View>('inbox')
  const [weekExpanded, setWeekExpanded] = useState(false)
  const [dateFilter, setDateFilter] = useState('')
  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Newest-first by default: the inbox is read top-down for what just came in.
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [archiveYear, setArchiveYear] = useState(String(new Date().getFullYear()))
  const [archiveMonth, setArchiveMonth] = useState('')
  const [archiveWeek, setArchiveWeek] = useState('')
  const [archiveDay, setArchiveDay] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('conversation'))
  const selectedIdRef = useRef<string | null>(selectedId)

  // Start of the current week (Monday, local) — the inbox window. Everything
  // before it is Archive; Sunday midnight it rolls over on its own.
  const weekStart = useMemo(() => startOfWeekIso(), [])
  const archiveYears = useMemo(() => archiveYearOptions(), [])
  const archiveWeeks = useMemo(() => archiveWeekOptions(archiveYear, archiveMonth), [archiveYear, archiveMonth])
  const archiveDays = useMemo(() => archiveDayOptions(archiveYear, archiveMonth, archiveWeek), [archiveYear, archiveMonth, archiveWeek])
  const archiveBounds = useMemo(
    () => archivePeriodBounds(archiveYear, archiveMonth, archiveWeek, archiveDay, weekStart),
    [archiveYear, archiveMonth, archiveWeek, archiveDay, weekStart],
  )

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const conversationId = searchParams.get('conversation')
    if (conversationId && conversationId !== selectedIdRef.current) {
      setSelectedId(conversationId)
    }
  }, [searchParams])

  const { account } = useAuth()
  // Live inbox over Reverb — a new message refreshes the list, its counts, and
  // the open thread.
  useRealtimeComms(account, 'comms', (payload) => {
    queryClient.invalidateQueries({ queryKey: LIST_KEY })
    queryClient.invalidateQueries({ queryKey: COUNTS_KEY })
    if (payload.conversation_id && payload.conversation_id === selectedIdRef.current) {
      queryClient.invalidateQueries({ queryKey: threadKey(payload.conversation_id) })
    }
  })

  const countsQuery = useQuery({
    queryKey: [...COUNTS_KEY, weekStart],
    queryFn: () => getInboxCounts(weekStart),
    refetchInterval: 30000,
  })
  const counts = countsQuery.data

  // An advanced date/time filter overrides the view into a flat, scoped fetch.
  const advActive = dateFilter !== '' || fromTime !== '' || toTime !== ''
  const advBounds = localInstantBounds(dateFilter, fromTime, toTime)

  const listParams = useMemo((): Parameters<typeof listConversations>[0] => {
    if (debounced) return { q: debounced, includeLinked: true } // search spans everything, incl. archive + job-linked
    if (advActive) {
      return { channel: channelForView(view), dateFrom: advBounds.from, dateTo: advBounds.to }
    }
    switch (view) {
      case 'needs_action': return { filter: 'action' }
      case 'unread': return { filter: 'unread' }
      case 'unknown_calls': return { filter: 'unknown', channel: 'call' }
      case 'texts': return { channel: 'text', dateFrom: weekStart }
      case 'calls': return { channel: 'call', dateFrom: weekStart }
      case 'emails': return { channel: 'email', dateFrom: weekStart }
      case 'app_calls': return { channel: 'call', fromApp: true }
      case 'all_outbound': return { channel: 'call', direction: 'outbound' }
      case 'archive': return { dateFrom: archiveBounds.from, dateTo: archiveBounds.to }
      case 'assigned': return { assignedToMe: true }
      case 'inbox':
      default: return { dateFrom: weekStart }
    }
  }, [view, debounced, advActive, advBounds.from, advBounds.to, archiveBounds.from, archiveBounds.to, weekStart])

  const listQuery = useQuery({
    queryKey: [...LIST_KEY, view, debounced, advBounds.from, advBounds.to, archiveBounds.from, archiveBounds.to, weekStart, sortDirection],
    queryFn: () => listConversations({ ...listParams, sortDirection }),
    refetchInterval: 15000,
  })

  const conversations = useMemo(() => listQuery.data ?? [], [listQuery.data])
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  // Week views split into Today (expanded) + Earlier this week (collapsible);
  // everything else is a flat, recency-sorted list.
  const grouped = useMemo(() => {
    if (WEEK_VIEWS.has(view) && !debounced && !advActive) {
      const startOfToday = new Date().setHours(0, 0, 0, 0)
      const today: CommsConversation[] = []
      const earlier: CommsConversation[] = []
      for (const c of conversations) {
        const t = c.last_message_at ? new Date(c.last_message_at).getTime() : 0
        ;(t >= startOfToday ? today : earlier).push(c)
      }
      return { mode: 'week' as const, today, earlier }
    }
    return { mode: 'flat' as const }
  }, [view, debounced, advActive, conversations])

  const selectConversation = (id: string) => {
    setSelectedId(id)
    const next = new URLSearchParams(searchParams)
    next.set('conversation', id)
    setSearchParams(next, { replace: true })
  }

  const pick = (next: View) => {
    setView(next)
    setSearch('')
    setDebounced('')
    setDateFilter('')
    setFromTime('')
    setToTime('')
    setFiltersOpen(false)
    setSelectedId(null)
    const params = new URLSearchParams(searchParams)
    params.delete('conversation')
    setSearchParams(params, { replace: true })
  }

  return (
    // overflow-hidden is what makes the three panes scroll SEPARATELY. Without
    // it the column heights below leaked past this box, the document itself
    // grew, and one page scrollbar moved the rail, the list and the thread
    // together — you could not read a conversation without losing your place
    // in the list.
    <div data-easy-comms={easy ? '' : undefined} className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden bg-slate-100 text-slate-900">
      <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[15rem_25rem_minmax(0,1fr)]">
        <InboxViews view={view} counts={counts} onPick={pick} onNewMessage={() => setComposerOpen(true)} />

        <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
          <div className="shrink-0 border-b border-slate-200 p-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all messages, incl. archive…"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {debounced ? 'Search results' : VIEW_TITLE[view]}
              </div>
              <button
                type="button"
                onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
                title={sortDirection === 'desc' ? 'Newest first — click for oldest first' : 'Oldest first — click for newest first'}
                aria-label={sortDirection === 'desc' ? 'Sorted newest first' : 'Sorted oldest first'}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  {sortDirection === 'desc' ? (
                    <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
                {sortDirection === 'desc' ? 'Newest' : 'Oldest'}
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                  filtersOpen || advActive
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <IconAdjustments size={14} aria-hidden="true" />
                Date
                {advActive && <span className="rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-none text-white">ON</span>}
              </button>
            </div>

            {view === 'archive' && !debounced && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
                <ArchiveSelect
                  label="Year"
                  value={archiveYear}
                  onChange={(value) => { setArchiveYear(value); setArchiveMonth(''); setArchiveWeek(''); setArchiveDay(''); setSelectedId(null) }}
                  options={archiveYears}
                />
                <ArchiveSelect
                  label="Month"
                  value={archiveMonth}
                  onChange={(value) => { setArchiveMonth(value); setArchiveWeek(''); setArchiveDay(''); setSelectedId(null) }}
                  options={archiveMonthOptions()}
                  disabled={!archiveYear}
                />
                <ArchiveSelect
                  label="Week"
                  value={archiveWeek}
                  onChange={(value) => { setArchiveWeek(value); setArchiveDay(''); setSelectedId(null) }}
                  options={archiveWeeks}
                  disabled={!archiveYear || !archiveMonth}
                />
                <ArchiveSelect
                  label="Day"
                  value={archiveDay}
                  onChange={(value) => { setArchiveDay(value); setSelectedId(null) }}
                  options={archiveDays}
                  disabled={!archiveYear || !archiveMonth}
                />
                <p className="col-span-2 text-[11px] leading-relaxed text-slate-500">
                  {archivePeriodLabel(archiveYear, archiveMonth, archiveWeek, archiveDay)}
                </p>
              </div>
            )}
            {filtersOpen && (
              <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => { setDateFilter(e.target.value); setSelectedId(null) }}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  aria-label="Filter by date"
                />
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="shrink-0">Time</span>
                  <input type="time" value={fromTime} onChange={(e) => { setFromTime(e.target.value); setSelectedId(null) }} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" aria-label="From time" />
                  <span className="shrink-0">to</span>
                  <input type="time" value={toTime} onChange={(e) => { setToTime(e.target.value); setSelectedId(null) }} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" aria-label="To time" />
                </div>
                {advActive && (
                  <button type="button" onClick={() => { setDateFilter(''); setFromTime(''); setToTime('') }} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    Clear date filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Measured, not guessed: this was h-[calc(100%-5.5rem)], and the
              header is taller than 5.5rem whenever the date filter or the
              archive selects are open — so the bottom of the list fell off
              the pane exactly when someone was filtering it. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {listQuery.isLoading ? (
              <ListSkeleton />
            ) : grouped.mode === 'week' ? (
              <WeekList
                today={grouped.today}
                earlier={grouped.earlier}
                expanded={weekExpanded}
                onToggle={() => setWeekExpanded((v) => !v)}
                selectedId={selectedId}
                onSelect={selectConversation}
                onArchive={() => pick('archive')}
              />
            ) : conversations.length === 0 ? (
              <EmptyList view={view} hasSearch={debounced !== ''} />
            ) : (
              <FlatList conversations={conversations} selectedId={selectedId} onSelect={selectConversation} groupByDay={view === 'archive'} />
            )}
          </div>
        </aside>

        {/* Every link in this chain needs a height, or the thread falls back to
            "as tall as its messages": the section had no flex-1, so it grew,
            the thread's own scroll box never had anything to scroll, and its
            scroll-to-latest had no effect — which is why opening a call landed
            you at the top of the conversation instead of the newest message. */}
        <main className="hidden min-h-0 min-w-0 flex-col lg:flex">
          {selectedId ? (
            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
              <ConversationContext conversation={selected} />
              <div className="min-h-0 flex-1">
                <ConversationThread key={selectedId} conversationId={selectedId} showHeader={false} showTemplates={false} onChanged={() => { queryClient.invalidateQueries({ queryKey: LIST_KEY }); queryClient.invalidateQueries({ queryKey: COUNTS_KEY }) }} />
              </div>
            </section>
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">Select a thread to view the conversation.</div>
          )}
        </main>
      </div>

      <NewConversationModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSent={(id) => {
          queryClient.invalidateQueries({ queryKey: LIST_KEY })
          queryClient.invalidateQueries({ queryKey: COUNTS_KEY })
          pick('inbox')
          selectConversation(id)
        }}
      />
    </div>
  )
}

function InboxViews({ view, counts, onPick, onNewMessage }: {
  view: View
  counts: InboxCounts | undefined
  onPick: (view: View) => void
  onNewMessage: () => void
}) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <aside className="hidden min-h-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="text-lg font-bold text-slate-950">Messages</div>
        <div className="mt-0.5 text-xs text-slate-500">{today}</div>
        <div className="mt-2">
          <ToastPrefToggle area="messages" label="New message" />
        </div>
        <button type="button" onClick={onNewMessage} className="mt-3 w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600">+ New message</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* Home view — the way back to today's threads from any other queue. */}
        <div className="mb-5">
          <RailItem icon={IconInbox} label="Inbox · today" active={view === 'inbox'} onClick={() => onPick('inbox')} />
        </div>

        <RailGroup label="My queue">
          <RailItem icon={IconBolt} label="Needs action" active={view === 'needs_action'} count={counts?.needs_action} onClick={() => onPick('needs_action')} />
          <RailItem icon={IconMailOpened} label="Unread" active={view === 'unread'} count={counts?.unread} onClick={() => onPick('unread')} />
          <RailItem icon={IconUserQuestion} label="Unknown callers" active={view === 'unknown_calls'} count={counts?.unknown_calls} onClick={() => onPick('unknown_calls')} />
          <RailItem icon={IconUser} label="Assigned to me" active={view === 'assigned'} count={counts?.assigned} onClick={() => onPick('assigned')} />
        </RailGroup>

        <RailGroup label="Channels">
          <RailItem icon={IconMessage} label="Texts" active={view === 'texts'} count={counts?.texts} onClick={() => onPick('texts')} />
          <RailItem icon={IconPhone} label="Calls" active={view === 'calls'} count={counts?.calls} onClick={() => onPick('calls')} />
          <RailItem icon={IconMail} label="Emails" active={view === 'emails'} count={counts?.emails} onClick={() => onPick('emails')} />
        </RailGroup>

        <RailGroup label="Outbound">
          <RailItem icon={IconDeviceMobile} label="From the app" active={view === 'app_calls'} onClick={() => onPick('app_calls')} />
          <RailItem icon={IconArrowUpRight} label="All outbound" active={view === 'all_outbound'} onClick={() => onPick('all_outbound')} />
        </RailGroup>

        <div className="mt-6">
          <RailItem icon={IconArchive} label="Archive" active={view === 'archive'} onClick={() => onPick('archive')} />
          <p className="mt-2 px-3 text-[11px] leading-relaxed text-slate-400">
            Threads auto-archive Sunday night. Nothing is lost — every message stays on its job and customer record.
          </p>
        </div>
      </div>
    </aside>
  )
}

function RailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function RailItem({ icon: Icon, label, active, count, onClick }: {
  icon: RailIcon
  label: string
  active?: boolean
  count?: number
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
        active ? 'bg-amber-500 font-semibold text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
      }`}
    >
      <Icon size={17} stroke={1.8} className={`shrink-0 ${active ? '' : 'text-slate-400'}`} />
      <span className="flex-1 truncate">{label}</span>
      {count != null && count > 0 && (
        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function WeekList({ today, earlier, expanded, onToggle, selectedId, onSelect, onArchive }: {
  today: CommsConversation[]
  earlier: CommsConversation[]
  expanded: boolean
  onToggle: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  onArchive: () => void
}) {
  const todayLabel = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const range = weekRangeLabel()
  const openCount = today.filter((c) => !c.handled_at).length
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-2 text-white">
        <span className="text-[11px] font-bold uppercase tracking-wide">Today · {todayLabel}</span>
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold">{openCount} open</span>
      </div>
      {today.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">Nothing today yet.</div>
      ) : (
        today.map((c) => (
          <ConversationRow key={c.id} conversation={c} active={c.id === selectedId} onClick={() => onSelect(c.id)} />
        ))
      )}

      {earlier.length > 0 && (
        <>
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between border-y border-slate-200 bg-slate-50 px-4 py-2 text-left hover:bg-slate-100"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <span aria-hidden>{expanded ? '▾' : '▸'}</span>
              Earlier this week{range ? ` · ${range}` : ''}
            </span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">{earlier.length}</span>
          </button>
          {expanded && earlier.map((c) => (
            <ConversationRow key={c.id} conversation={c} active={c.id === selectedId} onClick={() => onSelect(c.id)} />
          ))}
        </>
      )}

      <button type="button" onClick={onArchive} className="block w-full px-4 py-3 text-left">
        <span className="text-sm font-semibold text-amber-600 hover:text-amber-700">Search the archive →</span>
        <span className="mt-0.5 block text-[11px] text-slate-400">Before this week · still on the job &amp; customer</span>
      </button>
    </div>
  )
}

function FlatList({ conversations, selectedId, onSelect, groupByDay = false }: {
  conversations: CommsConversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  groupByDay?: boolean
}) {
  let lastBucket = ''
  return (
    <>
      {conversations.map((c) => {
        const bucket = dateBucket(c.last_message_at, groupByDay)
        const showHeader = bucket.key !== lastBucket
        lastBucket = bucket.key
        return (
          <Fragment key={c.id}>
            {showHeader && (
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur">
                {bucket.label}
              </div>
            )}
            <ConversationRow conversation={c} active={c.id === selectedId} onClick={() => onSelect(c.id)} />
          </Fragment>
        )
      })}
    </>
  )
}

function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: CommsConversation
  active: boolean
  onClick: () => void
}) {
  const title = conversation.customer_name
    || normalizeText(conversation.caller_id_name)
    || conversation.external_email
    || formatPhone(conversation.external_number)
    || 'Unknown contact'
  const unread = conversation.unread_for_me ?? conversation.unread_count > 0
  /*
   * The badge is only on screen because something is unread, so zero
   * is the one number it cannot truthfully show. unread_for_me is a
   * read-receipt check and unread_count is counted separately; when
   * they disagree, the badge used to read "0".
   */
  const unreadShown = Math.max(1, conversation.unread_count ?? 0)
  const needsReply = conversation.last_direction === 'inbound'
  const unknown = !conversation.customer_id
  const done = !!conversation.handled_at
  const channel = conversationChannelMeta(conversation)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`w-full cursor-pointer border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400 ${
        active ? 'border-l-4 border-l-amber-500 bg-amber-50 pl-3' : ''
      } ${done ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        {conversation.customer_id ? (
          <Avatar
            name={conversation.customer_name || title}
            colorKey={conversation.customer_id}
            preset={conversation.customer_avatar_preset}
            imageUrl={conversation.customer_avatar_url}
            size={40}
            className="mt-0.5 shrink-0"
          />
        ) : (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-hidden>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M10 10a3 3 0 100-6 3 3 0 000 6zm-6 8a6 6 0 1112 0H4z" />
            </svg>
          </span>
        )}
        <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`truncate text-sm ${unread || needsReply ? 'font-semibold text-navy-900' : 'font-medium text-slate-700'}`}>
              {title}
            </span>
            <ChannelBadge conversation={conversation} />
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500">
            {channel.detail}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span
            className="whitespace-nowrap text-xs text-slate-500"
            title={fullStamp(conversation.last_message_at)}
          >
            {formatStamp(conversation.last_message_at)}
          </span>
          {unread && (
            <span
              className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold leading-5 text-white"
              title={`${unreadShown} new message${unreadShown === 1 ? '' : 's'}`}
            >
              {unreadShown}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {done && <Badge tone="green">✓ done</Badge>}
        {!done && needsReply && <Badge tone="blue">needs reply</Badge>}
        {unknown && <Badge tone="slate">unknown</Badge>}
        {conversation.assigned_to && (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            → {conversation.assigned_to.name}
          </span>
        )}
        {conversation.work_order && (
          <Link
            to={`/jobs/${conversation.work_order.id}?tab=messages`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 shadow-sm hover:border-emerald-400 hover:bg-emerald-100 hover:text-emerald-900"
            title={`Open ${conversation.work_order.display_number} - ${conversation.work_order.title}`}
          >
            {conversation.work_order.display_number}
          </Link>
        )}
      </div>

      <div className={`mt-2 truncate text-xs ${unread || needsReply ? 'text-slate-800' : 'text-slate-500'}`}>
        {conversation.last_direction === 'outbound' ? 'You: ' : ''}
        {conversation.last_message_preview || 'No preview'}
      </div>
        </div>
      </div>
    </div>
  )
}

function ConversationContext({ conversation }: { conversation: CommsConversation | null }) {
  const queryClient = useQueryClient()
  const staffQuery = useTenantAccounts('', 100)
  const staff = staffQuery.data ?? []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: LIST_KEY })
    queryClient.invalidateQueries({ queryKey: COUNTS_KEY })
    if (conversation) queryClient.invalidateQueries({ queryKey: threadKey(conversation.id) })
  }
  const assignMutation = useMutation({
    mutationFn: (accountId: string | null) => assignConversation(conversation!.id, accountId),
    onSuccess: refresh,
  })
  const doneMutation = useMutation({
    mutationFn: (done: boolean) => setConversationDone(conversation!.id, done),
    onSuccess: refresh,
  })

  const title = conversation?.customer_name
    || conversation?.external_email
    || formatPhone(conversation?.external_number)
    || 'Conversation'
  const channel = conversation ? conversationChannelMeta(conversation) : null
  const done = !!conversation?.handled_at
  const busy = assignMutation.isPending || doneMutation.isPending

  return (
    // shrink-0: this header wraps onto two rows on a narrow window, and as a
    // flex child it would otherwise be squeezed instead of taking the room.
    <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-navy-900">{title}</span>
            {conversation && <ChannelBadge conversation={conversation} />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{channel ? `${channel.label} thread` : 'Thread'}</span>
            {conversation?.work_order && (
              <>
                <span>|</span>
                <Link
                  to={`/jobs/${conversation.work_order.id}?tab=messages`}
                  className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  {conversation.work_order.display_number} - {conversation.work_order.title}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {conversation?.external_number && (
            <a
              href={`tel:${conversation.external_number}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              title={`Call ${formatPhone(conversation.external_number)}`}
            >
              Call back
            </a>
          )}
          {conversation && (
            <select
              value={conversation.assigned_to_account_id ?? ''}
              disabled={busy}
              onChange={(e) => assignMutation.mutate(e.target.value || null)}
              title="Assign this thread"
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          {conversation && (
            <button
              type="button"
              disabled={busy}
              onClick={() => doneMutation.mutate(!done)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                done
                  ? 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {done ? 'Reopen' : 'Mark done'}
            </button>
          )}
          {conversation && !conversation.customer_id && (
            <LinkToCustomerControl conversation={conversation} onDone={refresh} />
          )}
          {conversation?.customer_id && (
            <Link
              to={`/customers/${conversation.customer_id}?tab=messages`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Customer
            </Link>
          )}
          {conversation && <LinkToJobControl conversation={conversation} onDone={refresh} />}
        </div>
      </div>
    </div>
  )
}

/**
 * Attach an unknown caller to a customer. Saving the number onto that customer
 * is the point — inbound matching runs off their contact phones, so without it
 * the same number is "unknown" again on the next call.
 */
function LinkToCustomerControl({ conversation, onDone }: { conversation: CommsConversation; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  const customersQuery = useCustomers(
    { q: debouncedTerm, fuzzy: true, per_page: 8, sort: 'display_name', direction: 'asc' },
    { enabled: open && debouncedTerm.length >= 2 },
  )
  const customers = debouncedTerm.length >= 2 ? (customersQuery.data?.data ?? []) : []

  const linkMutation = useMutation({
    mutationFn: (customerId: string) => linkConversationCustomer(conversation.id, customerId, true),
    onSuccess: () => {
      setOpen(false)
      setTerm('')
      onDone()
    },
  })

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
      >
        + Link to customer
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <input
            autoFocus
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search customer name…"
            className="mb-2 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <div className="max-h-64 overflow-y-auto">
            {debouncedTerm.length < 2 ? (
              <div className="px-2 py-3 text-xs text-slate-400">Type at least 2 letters.</div>
            ) : customersQuery.isLoading ? (
              <div className="px-2 py-3 text-xs text-slate-400">Searching…</div>
            ) : customers.length === 0 ? (
              <div className="px-2 py-3 text-xs text-slate-400">No customers match.</div>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => linkMutation.mutate(customer.id)}
                  disabled={linkMutation.isPending}
                  className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {customer.display_name}
                </button>
              ))
            )}
          </div>
          {linkMutation.isError && (
            <p className="mt-1 px-1 text-[11px] text-red-600">Could not link that customer.</p>
          )}
          <p className="mt-1 border-t border-slate-100 px-1 pt-1 text-[10px] text-slate-400">
            Saves {formatPhone(conversation.external_number)} to them, so their next call is recognized.
          </p>
        </div>
      )}
    </span>
  )
}

/**
 * Attach a thread to a job (or detach a mislinked one). Linking moves the
 * thread onto the job — which also takes it out of the Messages inbox — so
 * detach is offered right next to it.
 *
 * With a known customer the picker opens on THEIR recent jobs; typing
 * searches every job (so a job number from a sub-account still resolves).
 */
function LinkToJobControl({ conversation, onDone }: { conversation: CommsConversation; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  const jobsQuery = useQuery({
    queryKey: ['comms', 'link-jobs', conversation.customer_id, debouncedTerm],
    queryFn: () => listWorkOrders({
      q: debouncedTerm || undefined,
      // Default to this customer's jobs; a typed search goes tenant-wide.
      service_customer_id: debouncedTerm ? undefined : (conversation.customer_id ?? undefined),
      per_page: 8,
    }),
    enabled: open,
  })
  const jobs = jobsQuery.data?.data ?? []

  const linkMutation = useMutation({
    mutationFn: (workOrderId: string | null) => linkConversation(conversation.id, workOrderId),
    onSuccess: () => {
      setOpen(false)
      setTerm('')
      onDone()
    },
  })

  if (conversation.work_order_id) {
    return (
      <span className="inline-flex items-center gap-1">
        <Link
          to={`/jobs/${conversation.work_order_id}?tab=messages`}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          {conversation.work_order?.display_number ?? 'Job'}
        </Link>
        <button
          type="button"
          onClick={() => linkMutation.mutate(null)}
          disabled={linkMutation.isPending}
          title="Detach this thread from the job (returns it to the inbox)"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
        >
          Unlink
        </button>
      </span>
    )
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
      >
        + Link to job
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <input
            autoFocus
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search job # or title…"
            className="mb-2 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {!debouncedTerm && conversation.customer_name && (
            <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {conversation.customer_name}&rsquo;s jobs
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {jobsQuery.isLoading ? (
              <div className="px-2 py-3 text-xs text-slate-400">Loading…</div>
            ) : jobs.length === 0 ? (
              <div className="px-2 py-3 text-xs text-slate-400">
                {debouncedTerm ? 'No jobs match.' : 'No recent jobs — search by number or title.'}
              </div>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => linkMutation.mutate(job.id)}
                  disabled={linkMutation.isPending}
                  className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="block text-xs font-bold text-slate-800">{job.display_number}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {job.title}
                    {job.service_customer?.display_name ? ` · ${job.service_customer.display_name}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
          {linkMutation.isError && (
            <p className="mt-1 px-1 text-[11px] text-red-600">Could not link that job.</p>
          )}
          <p className="mt-1 border-t border-slate-100 px-1 pt-1 text-[10px] text-slate-400">
            Linking moves this thread onto the job and out of the inbox.
          </p>
        </div>
      )}
    </span>
  )
}

function Badge({ children, tone }: { children: ReactNode; tone: 'amber' | 'blue' | 'green' | 'slate' }) {
  const cls = {
    amber: 'border-amber-300 bg-amber-100 text-amber-800 shadow-sm',
    blue: 'border-sky-300 bg-sky-100 text-sky-800 shadow-sm',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }[tone]

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-48 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

function channelForView(view: View): ChannelKind | undefined {
  if (view === 'texts') return 'text'
  if (view === 'calls' || view === 'app_calls' || view === 'all_outbound' || view === 'unknown_calls') return 'call'
  if (view === 'emails') return 'email'
  return undefined
}

function conversationChannel(conversation: CommsConversation): ChannelKind {
  const channel = conversation.channel.toLowerCase()
  if (channel === 'email') return 'email'
  if (channel === 'call' || channel === 'voicemail') return 'call'
  return 'text'
}

function conversationChannelMeta(conversation: CommsConversation): {
  label: string
  detail: string
  badgeClass: string
} {
  const channel = conversationChannel(conversation)
  if (channel === 'email') {
    return {
      label: 'Email',
      detail: [conversation.external_email, conversation.subject].filter(Boolean).join(' · ') || 'Email thread',
      badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    }
  }
  if (channel === 'call') {
    const phoneLine = `${formatPhone(conversation.external_number)}${conversation.internal_number ? ` via ${formatPhone(conversation.internal_number)}` : ''}`
    const callerIdName = normalizeText(conversation.caller_id_name)
    const callerIdNumber = normalizeText(conversation.caller_id_number)
    const callerLabel = callerIdName && callerIdName !== conversation.customer_name
      ? `Caller ID: ${callerIdName}`
      : ''
    const callerNumber = callerIdNumber && callerIdNumber !== conversation.external_number
      ? formatPhone(callerIdNumber)
      : ''
    return {
      label: conversation.channel === 'voicemail' ? 'Voicemail' : 'Call',
      detail: [callerLabel, callerNumber, phoneLine].filter(Boolean).join(' · ') || 'Call thread',
      badgeClass: 'border-pink-200 bg-pink-50 text-pink-700',
    }
  }
  return {
    label: 'Text',
    detail: `${formatPhone(conversation.external_number)}${conversation.internal_number ? ` via ${formatPhone(conversation.internal_number)}` : ''}` || 'Text thread',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
}

function ChannelBadge({ conversation }: { conversation: CommsConversation }) {
  const meta = conversationChannelMeta(conversation)
  return (
    <span className={`inline-flex flex-shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}>
      {meta.label}
    </span>
  )
}

function EmptyList({ view, hasSearch }: { view: View; hasSearch: boolean }) {
  return (
    <div className="p-6 text-center text-sm font-medium text-slate-500">
      {hasSearch ? 'No conversations match your search.' : `Nothing in ${VIEW_TITLE[view].toLowerCase()} right now.`}
    </div>
  )
}

type ArchiveOption = { value: string; label: string }

function ArchiveSelect({ label, value, options, disabled, onChange }: {
  label: string
  value: string
  options: ArchiveOption[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function archiveYearOptions(): ArchiveOption[] {
  const current = new Date().getFullYear()
  return Array.from({ length: 16 }, (_, index) => {
    const year = String(current - index)
    return { value: year, label: year }
  })
}

function archiveMonthOptions(): ArchiveOption[] {
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: new Date(2024, index, 1).toLocaleDateString(undefined, { month: 'long' }),
  }))
}

function archiveWeekOptions(yearValue: string, monthValue: string): ArchiveOption[] {
  const year = Number(yearValue)
  const month = Number(monthValue) - 1
  if (!Number.isInteger(year) || month < 0 || month > 11) return []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const options: ArchiveOption[] = []
  let cursor = new Date(first)
  let index = 1
  while (cursor <= last) {
    const end = new Date(Math.min(new Date(year, month, cursor.getDate() + 6).getTime(), last.getTime()))
    options.push({
      value: localDay(cursor),
      label: `Week ${index} · ${cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    })
    cursor = new Date(year, month, cursor.getDate() + 7)
    index += 1
  }
  return options
}

function archiveDayOptions(yearValue: string, monthValue: string, weekValue: string): ArchiveOption[] {
  const year = Number(yearValue)
  const month = Number(monthValue) - 1
  if (!Number.isInteger(year) || month < 0 || month > 11) return []
  const monthEnd = new Date(year, month + 1, 0)
  const start = weekValue ? new Date(`${weekValue}T00:00:00`) : new Date(year, month, 1)
  const end = weekValue ? new Date(Math.min(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6).getTime(), monthEnd.getTime())) : monthEnd
  const options: ArchiveOption[] = []
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)) {
    options.push({ value: localDay(cursor), label: cursor.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) })
  }
  return options
}

function archivePeriodBounds(yearValue: string, monthValue: string, weekValue: string, dayValue: string, archiveCutoff: string): { from?: string; to: string } {
  const cutoff = new Date(archiveCutoff)
  let start: Date | null = null
  let end = new Date(cutoff.getTime() - 1)
  if (dayValue) {
    start = new Date(`${dayValue}T00:00:00`)
    end = new Date(`${dayValue}T23:59:59.999`)
  } else if (weekValue) {
    start = new Date(`${weekValue}T00:00:00`)
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
    end = new Date(end.getTime() - 1)
  } else if (yearValue && monthValue) {
    const year = Number(yearValue)
    const month = Number(monthValue) - 1
    start = new Date(year, month, 1)
    end = new Date(year, month + 1, 1)
    end = new Date(end.getTime() - 1)
  } else if (yearValue) {
    const year = Number(yearValue)
    start = new Date(year, 0, 1)
    end = new Date(year + 1, 0, 1)
    end = new Date(end.getTime() - 1)
  }
  // Keep the broad/default year view limited to messages older than this week.
  // Once a month, week, or day is explicitly selected, preserve that exact
  // period just like the advanced Date filter does. Clamping an explicit
  // current-week day made `from` later than `to`, yielding an empty list.
  const hasExplicitPeriod = monthValue !== '' || weekValue !== '' || dayValue !== ''
  if (!hasExplicitPeriod && end >= cutoff) end = new Date(cutoff.getTime() - 1)
  return { from: start?.toISOString(), to: end.toISOString() }
}

function archivePeriodLabel(yearValue: string, monthValue: string, weekValue: string, dayValue: string): string {
  if (dayValue) return `Showing archives from ${new Date(`${dayValue}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`
  if (weekValue) return `Showing the selected week in ${new Date(`${weekValue}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.`
  if (yearValue && monthValue) return `Showing ${new Date(Number(yearValue), Number(monthValue) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.`
  if (yearValue) return `Showing archives from ${yearValue}.`
  return 'Showing all archived messages.'
}
function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (['anonymous', 'restricted', 'unavailable', 'unknown'].includes(trimmed.toLowerCase())) return null
  return trimmed
}

/** Local YYYY-MM-DD for a Date (used to anchor the time-of-day window to a day). */
function localDay(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Monday 00:00 (local) of the current week, as a UTC ISO instant. */
function startOfWeekIso(): string {
  const now = new Date()
  const diff = (now.getDay() + 6) % 7 // days since Monday (Sun=0 → 6)
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
  return monday.toISOString()
}

/** "Mon Jul 21 – Fri Jul 24" for the Earlier-this-week header (Mon → yesterday). */
function weekRangeLabel(): string {
  const now = new Date()
  const diff = (now.getDay() + 6) % 7
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (yesterday.getTime() < monday.getTime()) return '' // today is Monday
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(yesterday)}`
}

/**
 * Absolute UTC instant bounds for the advanced date/time filter, derived from
 * the user's LOCAL clock so "a picked date" and a time window match the user's
 * day rather than the server's timezone.
 */
function localInstantBounds(date: string, fromTime: string, toTime: string): { from?: string; to?: string } {
  const day = date || localDay(new Date())
  if (fromTime || toTime) {
    return {
      from: fromTime ? new Date(`${day}T${fromTime}`).toISOString() : undefined,
      to: toTime ? new Date(`${day}T${toTime}`).toISOString() : undefined,
    }
  }
  if (date) {
    return {
      from: new Date(`${date}T00:00:00`).toISOString(),
      to: new Date(`${date}T23:59:59.999`).toISOString(),
    }
  }
  return {}
}

/** Date-section bucket for grouping the recency-sorted flat list. */
function dateBucket(iso?: string | null, exactOlderDay = false): { key: string; label: string } {
  if (!iso) return { key: 'unknown', label: 'No date' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { key: 'unknown', label: 'No date' }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dayMs = 86_400_000
  const t = d.getTime()

  if (t >= startOfToday) return { key: 'today', label: 'Today' }
  if (t >= startOfToday - dayMs) return { key: 'yesterday', label: 'Yesterday' }
  if (t >= startOfToday - 6 * dayMs) return { key: 'week', label: 'Earlier this week' }
  if (exactOlderDay) {
    return {
      key: localDay(d),
      label: d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    }
  }
  return { key: 'older', label: 'Older' }
}

/** Compact stamp: time only for today, else "Jun 16, 3:42 PM" (+ year if old). */
function formatStamp(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time

  const sameYear = d.getFullYear() === now.getFullYear()
  const date = d.toLocaleDateString(
    undefined,
    sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' },
  )
  return `${date}, ${time}`
}

/** Full date + time for the hover tooltip. */
function fullStamp(iso?: string | null): string {
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

export default CommsPage
