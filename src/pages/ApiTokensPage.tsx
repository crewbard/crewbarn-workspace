import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { Link } from 'react-router-dom'

/**
 * Tool Shed → Connections → API Tokens.
 *
 * Personal access tokens for the current account, scoped to the 'api'
 * ability (so login doesn't revoke them). The plaintext token is shown
 * exactly once — after that only metadata is queryable.
 */

interface TokenRecord {
  id: number | string
  name: string
  abilities: string[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string | null
}

interface CreateResponse {
  data: {
    token: string
    record: TokenRecord
  }
}

// No "never": a token nobody remembers is the one that leaks. Ten years is
// the ceiling for the integration that truly can't rotate.
const EXPIRY_PRESETS: { label: string; days: number | null }[] = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
  { label: '3 years', days: 1095 },
  { label: '10 years', days: 3650 },
]

function relTime(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

export function ApiTokensPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['api-tokens'],
    queryFn: () => apiRequest<{ data: TokenRecord[] }>('/v1/tenant-settings/api-tokens'),
  })
  const tokens = query.data?.data ?? []

  const create = useMutation({
    mutationFn: (payload: { name: string; expires_in_days: number | null }) =>
      apiRequest<CreateResponse>('/v1/tenant-settings/api-tokens', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: (res) => {
      setRevealedToken(res.data.token)
      setCreateOpen(false)
      qc.invalidateQueries({ queryKey: ['api-tokens'] })
    },
  })

  const revoke = useMutation({
    mutationFn: (id: string | number) =>
      apiRequest(`/v1/tenant-settings/api-tokens/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-tokens'] }),
  })

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API Tokens</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Long-lived bearer tokens for external integrations. Send as{' '}
            <code className="text-[11px] bg-slate-100 px-1 rounded">
              Authorization: Bearer &lt;token&gt;
            </code>{' '}
            on requests to the CrewBarn API. Tokens are tied to <em>your</em>{' '}
            account and inherit your permissions — only create them with names
            you'll remember (the value is shown once and never again).
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/tool-shed/api-endpoints" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Endpoint guide
          </Link>
          <button type="button" onClick={() => setCreateOpen(true)} className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium">
            + New token
          </button>
        </div>
      </div>

      {query.isLoading && <p className="text-sm text-slate-400 italic">Loading…</p>}

      {!query.isLoading && tokens.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          No API tokens yet. Create one to integrate an external script or
          webhook with the CrewBarn API.
        </div>
      )}

      {tokens.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {tokens.map((t) => {
              const expired = t.expires_at && new Date(t.expires_at) < new Date()
              return (
                <li key={t.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {t.name}
                      {expired && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-red-700 font-bold">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 space-x-2">
                      <span>Created {relTime(t.created_at)}</span>
                      <span>·</span>
                      <span>Last used {relTime(t.last_used_at)}</span>
                      {t.expires_at && (
                        <>
                          <span>·</span>
                          <span>
                            {expired ? 'Expired' : 'Expires'}{' '}
                            {new Date(t.expires_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Revoke token "${t.name}"? Anything using it will start getting 401s on its next request.`)) {
                        revoke.mutate(t.id)
                      }
                    }}
                    disabled={revoke.isPending}
                    className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-900 leading-relaxed">
        <strong>Single-session note:</strong> tokens here are <em>API tokens</em>{' '}
        and survive web/phone login. The token your browser uses to talk to the
        API is a separate <em>session token</em> that's revoked every time you
        sign in somewhere new.
      </div>

      {createOpen && (
        <CreateTokenModal
          onClose={() => setCreateOpen(false)}
          onCreate={(payload) => create.mutate(payload)}
          busy={create.isPending}
          error={create.error ? (create.error as Error).message : null}
        />
      )}

      {revealedToken && (
        <RevealTokenModal
          token={revealedToken}
          onClose={() => setRevealedToken(null)}
        />
      )}
    </div>
  )
}

function CreateTokenModal({
  onClose,
  onCreate,
  busy,
  error,
}: {
  onClose: () => void
  onCreate: (p: { name: string; expires_in_days: number | null }) => void
  busy: boolean
  error: string | null
}) {
  const [name, setName] = useState('')
  const [days, setDays] = useState<number | null>(365)
  const [nameError, setNameError] = useState<string | null>(null)

  const submit = () => {
    setNameError(null)
    if (!name.trim()) {
      setNameError('Give the token a name so you can identify it later.')
      return
    }
    onCreate({ name: name.trim(), expires_in_days: days })
  }

  return (
    <Modal isOpen onClose={onClose} title="Create API token" size="md">
      <Modal.Body className="space-y-4">
        {error && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Token name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Zapier production"'
            maxLength={120}
            autoFocus
            disabled={busy}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          {nameError && <p className="text-[11px] text-red-600 mt-1">{nameError}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Expires
          </label>
          <div className="flex flex-wrap gap-2">
            {EXPIRY_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDays(p.days)}
                className={[
                  'text-xs px-3 py-1.5 rounded-full border transition',
                  days === p.days
                    ? 'bg-amber-500 border-amber-500 text-white font-semibold'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Shorter expirations are safer. "Never" is fine for trusted server-side
            integrations, but rotate them periodically.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="px-4 py-2 text-sm rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create token'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function RevealTokenModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore — fallback is to select the text manually
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Token created"
      subtitle="This is the only time you'll see it. Copy and save it somewhere safe now."
      size="md"
      disableBackdropClose
    >
      <Modal.Body className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
          ⚠ The token will <strong>not be shown again</strong>. Treat it like a
          password — anyone with it can act as your account.
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Bearer token
          </label>
          <textarea
            readOnly
            value={token}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md bg-slate-50 break-all"
          />
        </div>
        <button
          type="button"
          onClick={copy}
          className={[
            'text-sm px-4 py-2 rounded-md font-medium w-full',
            copied
              ? 'bg-emerald-500 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white',
          ].join(' ')}
        >
          {copied ? '✓ Copied!' : 'Copy to clipboard'}
        </button>
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-md border border-slate-300"
        >
          I've saved it
        </button>
      </Modal.Footer>
    </Modal>
  )
}
