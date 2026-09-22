import { useState, useMemo, useRef, useEffect } from 'react'
import { useSubcontractors } from '@/hooks/useSubcontractors'
import { SubcontractorEditor } from '@/components/subs/SubcontractorEditor'
import type { Subcontractor } from '@/types/subcontractor'

/**
 * SubcontractorPicker — typeahead picker for selecting a sub on a
 * sub-job form. Mirrors CustomerPicker's style (recent list + filter
 * + click-to-pick) but simpler: subs are a smaller dataset so we
 * fetch everything active and filter client-side.
 *
 * Includes an inline "+ Add new subcontractor" button that opens
 * SubcontractorEditor pre-seeded with the typed query as the business
 * name. The new sub is selected automatically after save.
 */

interface Props {
  value: Subcontractor | null
  onChange: (sub: Subcontractor | null) => void
  error?: string
  disabled?: boolean
  placeholder?: string
}

export function SubcontractorPicker({
  value,
  onChange,
  error,
  disabled,
  placeholder = 'Search subs by name, contact, or partner #…',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: subs = [], isLoading } = useSubcontractors({ active: true })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return subs.slice(0, 50)
    return subs
      .filter((s) => {
        const hay = [
          s.business_name,
          s.contact_name,
          s.email,
          s.vendor_partner_number,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 50)
  }, [subs, query])

  // Close the dropdown on outside click.
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

  function handlePick(sub: Subcontractor) {
    onChange(sub)
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    onChange(null)
    setQuery('')
    setOpen(true)
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'

  return (
    <div ref={containerRef} className="relative">
      {value ? (
        <div className={`flex items-center justify-between px-3 py-2 border ${error ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'} rounded-md`}>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">{value.business_name}</div>
            <div className="text-xs text-slate-600 truncate">
              {value.contact_name || '(no contact)'}
              {value.phone && <> · {value.phone}</>}
              {value.email && <> · {value.email}</>}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="ml-3 text-xs text-slate-500 hover:text-red-600 underline shrink-0"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={`${inputCls} ${error ? 'border-red-300' : ''}`}
          />
          {open && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
              {isLoading ? (
                <div className="px-3 py-2 text-xs text-slate-500">Loading subs…</div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500">
                  No subs match. Click below to add one.
                </div>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handlePick(s)}
                    className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-slate-900">{s.business_name}</div>
                    <div className="text-xs text-slate-500">
                      {s.contact_name || '(no contact)'}
                      {s.phone && <> · {s.phone}</>}
                    </div>
                  </button>
                ))
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setEditorOpen(true)
                }}
                className="w-full text-left px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 border-t border-slate-200 bg-amber-50/50"
              >
                + Add new subcontractor{query.trim() ? ` "${query.trim()}"` : ''}
              </button>
            </div>
          )}
        </>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <SubcontractorEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        seed={query.trim() ? { business_name: query.trim() } : undefined}
        onSaved={(sub) => {
          handlePick(sub)
        }}
      />
    </div>
  )
}
