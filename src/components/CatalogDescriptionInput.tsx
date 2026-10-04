import { useEffect, useId, useState, type InputHTMLAttributes } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listCatalogItems } from '@/lib/catalogItems'
import type { CatalogItem } from '@/types/catalogItem'

export function CatalogDescriptionInput({ onPick, ...props }: InputHTMLAttributes<HTMLInputElement> & { onPick: (item: CatalogItem) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(-1)
  const id = useId()
  const text = String(props.value ?? '').trim()
  useEffect(() => { const timer = setTimeout(() => setQuery(text), 250); setIndex(-1); return () => clearTimeout(timer) }, [text])
  const results = useQuery({ queryKey: ['catalog-description', query], queryFn: () => listCatalogItems({ q: query, active: true, per_page: 8 }), enabled: open && !props.disabled && query.length >= 2 })
  const items = query === text ? (results.data?.data ?? []).filter(item => item.type !== 'bundle') : []
  const visible = open && !props.disabled && text.length >= 2
  function pick(item: CatalogItem) { setOpen(false); onPick(item) }
  return <div className="relative min-w-0 flex-1">
    <input {...props} className={`${props.className ?? ''} w-full`} role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? id : undefined} aria-activedescendant={visible && index >= 0 && items[index] ? `${id}-${index}` : undefined}
      onFocus={event => { setOpen(true); props.onFocus?.(event) }}
      onChange={event => { setOpen(true); props.onChange?.(event) }}
      onBlur={event => { setOpen(false); props.onBlur?.(event) }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
        if (visible && items.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setIndex(current => event.key === 'ArrowDown' ? Math.min(items.length - 1, current + 1) : Math.max(0, current - 1)) }
        if (visible && event.key === 'Enter' && items[index]) { event.preventDefault(); pick(items[index]) }
      }} />
    {visible && <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full min-w-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
      <p className="px-3 py-2 text-xs text-slate-500">Products & services · select a match or keep your own text</p>
      <div role="listbox" id={id} aria-label="Catalog suggestions">{items.map((item, i) => <button key={item.id} id={`${id}-${i}`} role="option" aria-selected={index === i} type="button" onMouseDown={event => event.preventDefault()} onClick={() => pick(item)} className={`block w-full px-3 py-2 text-left text-sm hover:bg-amber-50 ${index === i ? 'bg-amber-50' : ''}`}><strong className="block">{item.name}</strong><span className="text-xs text-slate-500">{item.type} · {item.sku} · {item.pricing.customer_cost_formatted}</span></button>)}</div>
      {results.isError ? <p role="status" className="p-3 text-xs text-red-700">Catalog unavailable. You can still enter a custom description.</p> : !items.length && <p role="status" className="p-3 text-xs text-slate-500">{results.isFetching || text !== query ? 'Searching…' : 'No matches. Keep typing a custom description.'}</p>}
    </div>}
  </div>
}
