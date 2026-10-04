import { useState, useRef, useEffect, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { useCustomers } from '@/hooks/useCustomers'
import type { Customer } from '@/types/customer'

/**
 * CustomerPicker — typeahead customer selector with hybrid client+server search.
 *
 * Search strategy:
 *   - On mount, fetches up to 50 most-recent customers (sort by last_contact_at).
 *   - Query length 0: shows the recent list as-is.
 *   - Query length 1: filters the recent list client-side (instant, no network).
 *   - Query length 2+: debounced (250ms) server search via /v1/customers?q=...
 *     to broaden the candidate pool, AND client-side display_name filter on
 *     top so the visible list only shows customers whose name actually
 *     contains the typed string. The server-side search matches across
 *     contact names too, which can surface unexpected customers (e.g. typing
 *     "James" matches Atlantic Auto Group because their contact is named
 *     James). The display filter keeps the visible list intuitive.
 */

interface CustomerPickerProps {
  value: Customer | null
  onChange: (customer: Customer | null) => void
  error?: string
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  id?: string
}

const DEBOUNCE_MS = 250
const RECENT_PAGE_SIZE = 50
const SEARCH_PAGE_SIZE = 50
const SERVER_SEARCH_THRESHOLD = 2

const RECENT_PARAMS = {
  per_page: RECENT_PAGE_SIZE,
  sort: 'last_contact_at' as const,
  direction: 'desc' as const,
}

function matchesQuery(customer: Customer, query: string): boolean {
  if (!query) return true
  const lower = query.toLowerCase()
  if (customer.display_name?.toLowerCase().includes(lower)) return true
  if (
    customer.account_number != null &&
    String(customer.account_number).includes(query)
  ) {
    return true
  }
  return false
}

export function CustomerPicker({
  value,
  onChange,
  error,
  disabled = false,
  placeholder = 'Start typing a customer name or account #…',
  autoFocus = false,
  id,
}: CustomerPickerProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ---------- Debounce query ----------
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  // ---------- Hybrid query: same hook, swapped params ----------
  const isServerSearching = debouncedQuery.length >= SERVER_SEARCH_THRESHOLD
  const params = isServerSearching
    ? { q: debouncedQuery, per_page: SEARCH_PAGE_SIZE }
    : RECENT_PARAMS
  const customersQuery = useCustomers(params)

  // ---------- Compute results ----------
  // Always apply client-side filter on top of whatever the server returned,
  // so the displayed list matches what the user typed (display_name + acct#).
  const results = useMemo(() => {
    const list = customersQuery.data?.data ?? []
    if (!query) return list
    return list.filter((c) => matchesQuery(c, query))
  }, [query, customersQuery.data])

  // Reset highlight when result set changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [results.length, debouncedQuery])

  // ---------- Click outside detection ----------
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ---------- Handlers ----------
  const handleSelect = (customer: Customer) => {
    onChange(customer)
    setQuery('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const c = results[highlightedIndex]
      if (c) handleSelect(c)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  const isLoading = customersQuery.isLoading
  const isSearchingInBackground =
    isServerSearching && customersQuery.isFetching && results.length > 0

  // ---------- Render: selected (collapsed) state ----------
  if (value && !isOpen) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          id={id}
          onClick={() => {
            if (disabled) return
            setIsOpen(true)
            setQuery('')
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          disabled={disabled}
          className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md text-left focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 ${
            error ? 'border-red-300' : 'border-slate-300'
          } ${disabled ? 'bg-slate-50 cursor-not-allowed' : 'bg-white hover:border-slate-400'}`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate text-slate-900">{value.display_name}</span>
            {value.account_number != null && (
              <span className="text-xs text-slate-500 flex-shrink-0">#{value.account_number}</span>
            )}
            {value.vip && (
              <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded flex-shrink-0">
                VIP
              </span>
            )}
          </span>
          <span className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                if (!disabled) handleClear()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!disabled) handleClear()
                }
              }}
              className="text-slate-400 hover:text-red-600 text-xs px-1 cursor-pointer"
              aria-label="Clear selection"
              title="Clear"
            >
              ✕
            </span>
            <span className="text-slate-400 text-xs">▼</span>
          </span>
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  // ---------- Render: editing state ----------
  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 ${
          error ? 'border-red-300' : 'border-slate-300'
        } ${disabled ? 'bg-slate-50 cursor-not-allowed' : 'bg-white'}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {isOpen && query.length > 0 && (
        <div
          id={id ? `${id}-listbox` : undefined}
          className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-auto"
        >
          {isLoading && results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500">Loading...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500">
              {query ? `No customers found for "${query}"` : 'No customers'}
            </div>
          ) : (
            <ul role="listbox" className="py-1">
              {results.map((customer, index) => {
                const isHighlighted = index === highlightedIndex
                return (
                  <li
                    key={customer.id}
                    role="option"
                    aria-selected={isHighlighted}
                    onClick={() => handleSelect(customer)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2 cursor-pointer text-sm border-l-2 ${
                      isHighlighted
                        ? 'bg-amber-50 border-amber-500'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    {/* The name WRAPS here rather than truncating. Two
                        customers whose names differ only past the cut both
                        render as the same "Gary Yeomans…", and picking
                        between them becomes a guess — which is the one
                        thing this list exists to prevent. The selected
                        value above still truncates: one line is right once
                        the choice is made. */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium break-words text-slate-900">
                        {customer.display_name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {customer.vip && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            VIP
                          </span>
                        )}
                        <span className="text-xs text-slate-500 capitalize">
                          {customer.customer_type}
                        </span>
                      </div>
                    </div>
                    {customer.account_number != null && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        Account #{customer.account_number}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {isSearchingInBackground && (
            <div className="px-3 py-1.5 text-xs text-slate-400 border-t border-slate-100">
              Searching...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
