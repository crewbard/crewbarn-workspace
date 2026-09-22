import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  HELP_CATEGORIES,
  HELP_HOME_TOPIC_ID,
  HELP_TOPICS,
  OPEN_HELP_EVENT,
  type HelpTopic,
} from '@/lib/helpTopics'
import {
  getAiHelpEnabled,
  setAiHelpEnabled,
  onAiHelpEnabledChange,
} from '@/lib/aiHelp'

/**
 * Slide-over help panel. Opens from the right with a category sidebar and
 * markdown-rendered topic body. Search filters across titles + bodies.
 *
 * Open externally via:
 *   - "?" button in TopBar
 *   - `?` keyboard shortcut from anywhere
 *   - URL ?openHelp=<topic-id> deep link (handled in this component)
 */
export function HelpPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { account } = useAuth()
  const isTester = account?.role === 'tester'
  const isPlatformAdmin = !!account?.is_platform_admin

  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [aiHelpOn, setAiHelpOn] = useState(getAiHelpEnabled())
  useEffect(() => onAiHelpEnabledChange(setAiHelpOn), [])

  useEffect(() => {
    const handleOpenTopic = (event: Event) => {
      const topicId = (event as CustomEvent<string>).detail
      if (!HELP_TOPICS.some((topic) => topic.id === topicId)) return
      setSearch('')
      setActiveId(topicId)
    }
    window.addEventListener(OPEN_HELP_EVENT, handleOpenTopic)
    return () => window.removeEventListener(OPEN_HELP_EVENT, handleOpenTopic)
  }, [])

  // Filter topics by audience + search
  const visibleTopics = useMemo(() => {
    return HELP_TOPICS.filter((t) => {
      if (t.audience === 'tester' && !isTester) return false
      if (t.audience === 'platform_admin' && !isPlatformAdmin) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    })
  }, [search, isTester, isPlatformAdmin])

  // Group by category, preserving HELP_CATEGORIES order
  const grouped = useMemo(() => {
    const map = new Map<string, HelpTopic[]>()
    visibleTopics.forEach((t) => {
      const arr = map.get(t.category) ?? []
      arr.push(t)
      map.set(t.category, arr)
    })
    return HELP_CATEGORIES
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, topics: map.get(c) ?? [] }))
  }, [visibleTopics])

  // Default to first visible topic when opening or when search changes the set
  useEffect(() => {
    if (!open) return
    if (visibleTopics.length === 0) {
      setActiveId(null)
      return
    }
    if (!visibleTopics.find((t) => t.id === activeId)) {
      setActiveId(visibleTopics[0].id)
    }
  }, [open, visibleTopics, activeId])

  // Deep-link via ?openHelp=<id>
  useEffect(() => {
    if (!open) return
    const url = new URL(window.location.href)
    const wanted = url.searchParams.get('openHelp')
    if (wanted) {
      const found = HELP_TOPICS.find((t) => t.id === wanted)
      if (found) setActiveId(found.id)
      url.searchParams.delete('openHelp')
      window.history.replaceState({}, '', url.toString())
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const activeTopic = visibleTopics.find((t) => t.id === activeId) ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex no-print"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="ml-auto relative w-full max-w-6xl h-full bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
          <div className="min-w-fit">
            <h2 className="text-lg font-semibold text-slate-900">CrewBarn Help</h2>
            <p className="hidden text-xs text-slate-500 lg:block">Instructions, examples, and links to the tools</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help…"
            className="flex-1 max-w-md text-sm px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            autoFocus
          />
          <span className="text-xs text-slate-400 hidden sm:inline">Esc to close</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-1"
            aria-label="Close help"
          >
            ×
          </button>
        </div>

        {/* AI Help toggle — per-user. Controls the floating AI Help bubble. */}
        <label className="px-5 py-2 border-b border-slate-100 flex items-center gap-2 text-sm text-slate-700 cursor-pointer bg-amber-50/40">
          <input
            type="checkbox"
            checked={aiHelpOn}
            onChange={(e) => setAiHelpEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span>
            Show the floating <strong>CBI</strong> button on every page
          </span>
          <span className="text-xs text-slate-400 ml-auto hidden sm:inline">
            Ask CBI about the screen you are viewing
          </span>
        </label>

        <div className="border-b border-slate-200 p-3 sm:hidden">
          <label className="block text-xs font-medium text-slate-600">
            Help topic
            <select
              value={activeId ?? ''}
              onChange={(event) => setActiveId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {grouped.map(({ category, topics }) => (
                <optgroup key={category} label={category}>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <nav className="hidden w-64 shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50 sm:block">
            {grouped.length === 0 && (
              <div className="px-4 py-6 text-sm text-slate-500">
                No topics match.
              </div>
            )}
            {grouped.map(({ category, topics }) => (
              <div key={category} className="py-2">
                <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {category}
                </div>
                <ul>
                  {topics.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(t.id)}
                        className={`w-full text-left px-4 py-1.5 text-sm ${
                          activeId === t.id
                            ? 'bg-amber-100 text-amber-900 font-medium'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {t.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
            {activeTopic ? (
              <article className="max-w-4xl text-slate-700">
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                  {activeTopic.category}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mt-0 mb-4">
                  {activeTopic.title}
                </h1>
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <h2 className="mb-2 mt-7 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900 first:mt-0">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-1.5 mt-5 text-sm font-semibold text-slate-900">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="my-2 text-sm leading-6 text-slate-700">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="my-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="my-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-700">{children}</ol>
                    ),
                    li: ({ children }) => <li className="pl-1">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                    blockquote: ({ children }) => (
                      <blockquote className="my-3 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-2 text-amber-950">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => href?.startsWith('/') ? (
                      <Link
                        to={href}
                        onClick={onClose}
                        className={String(children).startsWith('Open ')
                          ? 'mt-5 inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-amber-700'
                          : 'font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-800'}
                      >
                        {children}
                      </Link>
                    ) : (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-800"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {activeTopic.body}
                </ReactMarkdown>
              </article>
            ) : (
              <div className="text-sm text-slate-500 mt-12 text-center">
                {search.trim() ? 'No topics match your search.' : 'Pick a topic from the left.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Global "?" keyboard shortcut + open-state. Mount once at the layout level.
 * Pass [open, setOpen] to a button that should toggle it.
 */
export function useHelpKeyboardShortcut(setOpen: (v: boolean) => void, contextTopicId?: string) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger inside text inputs / textareas / contenteditable
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent<string>(OPEN_HELP_EVENT, {
          detail: contextTopicId ?? HELP_HOME_TOPIC_ID,
        }))
      }
    }
    const openFromContext = () => setOpen(true)
    window.addEventListener('keydown', handler)
    window.addEventListener(OPEN_HELP_EVENT, openFromContext)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener(OPEN_HELP_EVENT, openFromContext)
    }
  }, [setOpen, contextTopicId])
}
