import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api'

/**
 * PortalUserPicker — typeahead for selecting a portal user (a row in
 * platform_customers) to link a subcontractor to. When linked, that
 * portal user sees the sub's assigned WOs in the customer portal's
 * Subbed Jobs section.
 *
 * Backend: GET /v1/subcontractors/portal-users?q=email-or-name
 */

interface PortalUserOption {
  id: string
  email: string | null
  display_name: string | null
}

interface SearchEnvelope { data: PortalUserOption[] }

interface Props {
  value: { id: string; email?: string | null } | null
  onChange: (v: { id: string; email?: string | null } | null) => void
  disabled?: boolean
}

export function PortalUserPicker({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PortalUserOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!open) return
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiRequest<SearchEnvelope>(
          `/v1/subcontractors/portal-users${query ? `?q=${encodeURIComponent(query)}` : ''}`,
        )
        setResults(res.data ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [query, open])

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'

  if (value) {
    return (
      <div className="flex items-center justify-between px-3 py-2 border border-slate-300 bg-slate-50 rounded-md">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-900 truncate">{value.email ?? '(no email)'}</div>
          <div className="text-[11px] text-slate-500">Linked portal user</div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setQuery('')
            }}
            className="ml-3 text-xs text-slate-500 hover:text-red-600 underline shrink-0"
          >
            Unlink
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search portal users by email…"
        disabled={disabled}
        className={inputCls}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">
              {query.trim()
                ? `No portal user matches "${query}". They need to sign up first at portal.crewbarn.com.`
                : 'Start typing an email or name to search.'}
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChange({ id: r.id, email: r.email })
                  setQuery('')
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-slate-100 last:border-b-0"
              >
                <div className="text-sm text-slate-900">{r.email ?? '(no email)'}</div>
                {r.display_name && (
                  <div className="text-xs text-slate-500">{r.display_name}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
