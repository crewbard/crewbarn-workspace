import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useCatalogItems } from '@/hooks/useCatalogItems'
import type { CatalogItem, CatalogItemType } from '@/types/catalogItem'

/**
 * CatalogItemPickerModal — pick a service or product/inventory item from
 * the tenant's catalog. Used by line-item editors (estimate + work order)
 * to seed a new line from a real catalog row instead of manual typing.
 *
 * Search runs server-side (FTS via useCatalogItems with `q`). Tabs filter
 * by `type`: All / Service / Product/Inventory.
 *
 * On pick: closes the modal and hands the full CatalogItem to the
 * parent. Parent decides whether to append a draft, POST a line, etc.
 */

type TabKey = 'all' | 'service' | 'product'

export function CatalogItemPickerModal({
  isOpen,
  onClose,
  onPick,
}: {
  isOpen: boolean
  onClose: () => void
  onPick: (item: CatalogItem) => void
}) {
  const [tab, setTab] = useState<TabKey>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setDebouncedQuery('')
    setTab('all')
  }, [isOpen])

  // 200ms debounce so we don't spam the server on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(t)
  }, [query])

  const typeFilter: CatalogItemType | undefined =
    tab === 'service' ? 'service' : tab === 'product' ? 'product' : undefined

  const { data, isLoading, isError } = useCatalogItems({
    q: debouncedQuery || undefined,
    type: typeFilter,
    active: true,
    per_page: 50,
  })
  const items = data?.data ?? []

  const counts = useMemo(() => {
    return {
      all: items.length,
      service: items.filter((i) => i.type === 'service').length,
      product: items.filter((i) => i.type === 'product').length,
    }
  }, [items])

  function formatMoney(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add from catalog"
      subtitle="Pick a service or product — pricing and description copy over."
      size="lg"
    >
      <Modal.Body>
        <div className="space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SKU, description…"
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            autoFocus
          />

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
              All {tab !== 'all' && counts.all > 0 ? `(${counts.all})` : ''}
            </TabButton>
            <TabButton active={tab === 'service'} onClick={() => setTab('service')}>
              Services
            </TabButton>
            <TabButton active={tab === 'product'} onClick={() => setTab('product')}>
              Products / inventory
            </TabButton>
          </div>

          {isLoading && (
            <div className="text-sm text-slate-500 py-4 text-center">Loading…</div>
          )}
          {isError && (
            <div className="text-sm text-red-600 py-4">Failed to load catalog.</div>
          )}

          {!isLoading && !isError && items.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-8">
              {debouncedQuery
                ? `No catalog items match "${debouncedQuery}".`
                : 'No catalog items yet — add some under Tool Shed → Products & Services.'}
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <ul className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => { onPick(item); onClose() }}
                    className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-3"
                  >
                    {item.images.thumb_url || item.images.medium_url ? (
                      <img
                        src={item.images.thumb_url || item.images.medium_url || ''}
                        alt={item.name}
                        className="w-10 h-10 rounded object-cover flex-shrink-0 bg-slate-100 border border-slate-200"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className={`w-10 h-10 rounded flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                          item.type === 'service'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.type === 'service' ? 'SVC' : 'PROD'}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {[item.sku, item.short_description, item.unit_label]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="text-sm font-mono text-slate-700 flex-shrink-0">
                      {formatMoney(item.pricing.customer_cost_cents)}
                      <span className="text-xs text-slate-400">
                        {item.unit_label ? ` / ${item.unit_label}` : ''}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-amber-500 text-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  )
}
