import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  listFeedback,
  createFeedback,
  voteFeedback,
  setFeedbackStatus,
  type FeedbackPost,
  type FeedbackStatus,
} from '@/lib/feedback'

/**
 * Bugs & Ideas — a shared CrewBarn feedback board. Any signed-in member can
 * post a bug or an idea and upvote others; the most-wanted rises to the top.
 * Platform admins can set each item's status.
 */
const STATUS_META: Record<FeedbackStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-slate-100 text-slate-600' },
  planned: { label: 'Planned', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In progress', cls: 'bg-amber-100 text-amber-800' },
  done: { label: 'Shipped', cls: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Not planned', cls: 'bg-slate-100 text-slate-400' },
}
const STATUSES: FeedbackStatus[] = ['open', 'planned', 'in_progress', 'done', 'declined']

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`
}

export function FeedbackPortalPage() {
  const qc = useQueryClient()
  const [type, setType] = useState<'all' | 'bug' | 'idea'>('all')
  const [sort, setSort] = useState<'top' | 'new'>('top')

  const q = useQuery({
    queryKey: ['feedback', type, sort],
    queryFn: () => listFeedback({ type, sort }),
  })
  const posts = q.data?.data ?? []
  const isAdmin = q.data?.is_admin ?? false
  const invalidate = () => qc.invalidateQueries({ queryKey: ['feedback'] })

  const voteMut = useMutation({ mutationFn: (id: string) => voteFeedback(id), onSuccess: invalidate })
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) => setFeedbackStatus(id, status),
    onSuccess: invalidate,
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 p-6 text-white sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">CrewBarn feedback</div>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Bugs &amp; Ideas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
          Hit a bug or have an idea to make CrewBarn better? Post it here and upvote what matters most — the
          most-wanted rises to the top and shapes what we build next.
        </p>
      </div>

      <SubmitForm onCreated={invalidate} />

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          {(['all', 'bug', 'idea'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${type === t ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {t === 'all' ? 'All' : t === 'bug' ? 'Bugs' : 'Ideas'}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          {(['top', 'new'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${sort === s ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {s === 'top' ? 'Top voted' : 'Newest'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <section className="mt-4 space-y-3">
        {q.isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Nothing here yet — be the first to post a {type === 'bug' ? 'bug' : type === 'idea' ? 'idea' : 'bug or idea'}.
          </div>
        ) : (
          posts.map((p) => (
            <PostRow
              key={p.id}
              post={p}
              isAdmin={isAdmin}
              voting={voteMut.isPending}
              onVote={() => voteMut.mutate(p.id)}
              onStatus={(status) => statusMut.mutate({ id: p.id, status })}
            />
          ))
        )}
      </section>
    </div>
  )
}

function PostRow({
  post,
  isAdmin,
  voting,
  onVote,
  onStatus,
}: {
  post: FeedbackPost
  isAdmin: boolean
  voting: boolean
  onVote: () => void
  onStatus: (s: FeedbackStatus) => void
}) {
  const st = STATUS_META[post.status]
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <button
        type="button"
        onClick={onVote}
        disabled={voting}
        className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border px-2 py-1.5 transition disabled:opacity-50 ${
          post.voted ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
        }`}
        title={post.voted ? 'Remove your vote' : 'Upvote'}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
          <path d="M10 4l6 7H4l6-7z" fill="currentColor" />
        </svg>
        <span className="mt-0.5 text-sm font-bold">{post.vote_count}</span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${post.type === 'bug' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}
          >
            {post.type === 'bug' ? 'Bug' : 'Idea'}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
          <span className="font-semibold text-navy-950">{post.title}</span>
        </div>
        {post.body && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{post.body}</p>}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
          <span>{post.author_display ?? 'Member'}</span>
          <span>·</span>
          <span>{timeAgo(post.created_at)}</span>
          {isAdmin && (
            <select
              value={post.status}
              onChange={(e) => onStatus(e.target.value as FeedbackStatus)}
              className="ml-auto rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600"
              title="Set status (admin)"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  )
}

function SubmitForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<'bug' | 'idea'>('idea')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: () => createFeedback({ type, title: title.trim(), body: body.trim() || undefined }),
    onSuccess: () => {
      setTitle('')
      setBody('')
      setError(null)
      onCreated()
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not post — try again.'),
  })

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm">
          {(['idea', 'bug'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-md px-3 py-1.5 font-semibold capitalize transition ${
                type === t
                  ? t === 'bug'
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-500 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'bug' ? 'Report a bug' : 'Suggest an idea'}
            </button>
          ))}
        </div>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={type === 'bug' ? 'What’s broken? (short summary)' : 'What should we build?'}
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Add details — steps to reproduce, or why it'd help. Optional."
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!title.trim() || mut.isPending}
          onClick={() => mut.mutate()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {mut.isPending ? 'Posting…' : 'Post it'}
        </button>
      </div>
    </div>
  )
}
