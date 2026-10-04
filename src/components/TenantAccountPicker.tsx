import { useEffect, useMemo, useRef, useState } from 'react'
import { useTenantAccounts } from '@/hooks/useTenantAccounts'
import type { TenantAccount } from '@/lib/tenantAccounts'

/**
 * TenantAccountPicker — typeahead for staff accounts (assigned agent,
 * future lead-tech reassign, etc.).
 *
 * Lighter than CustomerPicker — the staff list is small enough that we
 * pull everything up to 50 on mount and filter client-side. Server-side
 * `q` kicks in when the dispatcher types.
 *
 * Opens as a dropdown on focus and stays searchable. Pre-populates
 * `value.name` if you pass it in (so the
 * collapsed "selected" state shows the right name on edit).
 */

interface Props {
  value: string | null | undefined
  valueLabel?: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  disabled?: boolean
  /** Limit the list to techs (app users) — used for lead-tech pickers. */
  techOnly?: boolean
}

export function TenantAccountPicker({
  value,
  valueLabel,
  onChange,
  placeholder = 'Start typing a name…',
  disabled,
  techOnly = false,
}: Props) {
  const [query, setQuery] = useState('')
  const [selectedLabel, setSelectedLabel] = useState<string | null>(valueLabel ?? null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useTenantAccounts(query, 50, techOnly)
  const results: TenantAccount[] = useMemo(
    () => (data ?? []).filter((a) => !techOnly || (a.is_field_technician && a.app_access)),
    [data, techOnly],
  )
  const selectedAccount = useMemo(
    () => results.find((a) => a.id === value) ?? null,
    [results, value],
  )

  useEffect(() => setHighlighted(0), [results.length])

  useEffect(() => {
    if (!value) setSelectedLabel(null)
    else if (valueLabel) setSelectedLabel(valueLabel)
  }, [value, valueLabel])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function selectAccount(a: TenantAccount) {
    setSelectedLabel(a.name)
    onChange(a.id)
    setQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function clear() {
    setSelectedLabel(null)
    onChange(null)
    setQuery('')
    setIsOpen(false)
  }

  // Collapsed "selected" state. Uses selectedLabel too so the pick shows
  // instantly even before the parent's value prop round-trips back.
  if ((value || selectedLabel) && !isOpen) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return
            setIsOpen(true)
            setQuery('')
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border border-slate-300 rounded-md text-left bg-white hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
        >
          <span className="font-medium truncate text-slate-900">
            {valueLabel || selectedAccount?.name || selectedLabel || value}
          </span>
          <span className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); if (!disabled) clear() }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                  e.preventDefault(); e.stopPropagation(); clear()
                }
              }}
              className="text-slate-400 hover:text-red-600 text-xs px-1 cursor-pointer"
              aria-label="Clear"
            >
              ✕
            </span>
            <span className="text-slate-400 text-xs">▼</span>
          </span>
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (!isOpen) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlighted((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlighted((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            const r = results[highlighted]
            if (r) selectAccount(r)
          } else if (e.key === 'Escape') {
            setIsOpen(false)
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
      />

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-auto">
          {isLoading ? (
            <div className="px-3 py-3 text-sm text-slate-500">Loading…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">
              {query ? <>No staff found for &ldquo;{query}&rdquo;</> : 'No staff found.'}
            </div>
          ) : (
            <ul role="listbox" className="py-1">
              {results.map((a, i) => (
                <li
                  key={a.id}
                  role="option"
                  aria-selected={i === highlighted}
                  // mousedown (not click) + preventDefault: fire the pick BEFORE
                  // the input blurs, so the selection always registers on the
                  // first tap instead of requiring a click-outside.
                  onMouseDown={(e) => { e.preventDefault(); selectAccount(a) }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`px-3 py-2 cursor-pointer text-sm border-l-2 ${
                    i === highlighted
                      ? 'bg-amber-50 border-amber-500'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium text-slate-900 truncate">{a.name}</div>
                  {a.email && (
                    <div className="text-xs text-slate-500 truncate">{a.email}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
