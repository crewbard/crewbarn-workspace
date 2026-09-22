import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listCatalogItems } from '@/lib/catalogItems'
import { listInventoryLocations } from '@/lib/inventoryLocations'
import { listInventoryBins } from '@/lib/inventoryBins'
import { listInventoryUnits } from '@/lib/inventoryUnits'

/**
 * One box that finds a thing anywhere in inventory.
 *
 * Composed from the four list endpoints that already support ?q — items,
 * locations, bins and serial units — rather than a new search endpoint. They are
 * already tenant-scoped, permission-gated and tested; a fifth endpoint doing the
 * same joins would be a second thing to keep correct for no gain.
 *
 * Movements are deliberately absent. The endpoint has no ?q, and adding one is
 * the wrong shape anyway: you look for a THING and then read its history, so the
 * route to a movement is through the item or the bin that moved. The Movements
 * tab keeps its own filters.
 */

type TabKey = 'locations' | 'bins' | 'stock' | 'units' | 'movements' | 'reconciliation' | 'settings'

export function GlobalInventorySearch({ onGoToTab }: { onGoToTab: (tab: TabKey) => void }) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  // Four requests per keystroke would be four times the noise; 250ms is about
  // where typing stops feeling watched.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  // Two characters before anything fires. One letter matches most of the
  // catalog and tells you nothing.
  const on = debounced.length >= 2

  // useQuery directly rather than the shared list hooks: those have no `enabled`
  // option, so using them here fired all four requests with an empty query on
  // every visit to the page whether or not anyone searched. This costs nothing
  // until someone types.
  //
  // Written out four times on purpose. Wrapping them in a local helper works —
  // same order, every render — but it calls a hook from a plain function, which
  // is a rule violation waiting to become a real bug the first time someone adds
  // a condition around it.
  const common = { enabled: on, staleTime: 30_000 } as const

  const items = useQuery({
    queryKey: ['inventory-search', 'items', debounced],
    queryFn: () => listCatalogItems({ q: debounced, per_page: 5 }),
    ...common,
  })
  const units = useQuery({
    queryKey: ['inventory-search', 'units', debounced],
    queryFn: () => listInventoryUnits({ q: debounced, per_page: 5 }),
    ...common,
  })
  const bins = useQuery({
    queryKey: ['inventory-search', 'bins', debounced],
    queryFn: () => listInventoryBins({ q: debounced, per_page: 5 }),
    ...common,
  })
  const locations = useQuery({
    queryKey: ['inventory-search', 'locations', debounced],
    queryFn: () => listInventoryLocations({ q: debounced, per_page: 5 }),
    ...common,
  })

  const itemRows = on ? items.data?.data ?? [] : []
  const locationRows = on ? locations.data?.data ?? [] : []
  const binRows = on ? bins.data?.data ?? [] : []
  const unitRows = on ? units.data?.data ?? [] : []

  const loading = on && (items.isLoading || locations.isLoading || bins.isLoading || units.isLoading)
  const total = itemRows.length + locationRows.length + binRows.length + unitRows.length

  return (
    <div>
      <div className="relative">
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search items, SKUs, serial numbers, bins, locations…"
          aria-label="Search inventory"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-12 text-base shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <span className="pointer-events-none absolute left-4 top-3.5 text-slate-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
        {term !== '' && (
          <button
            type="button"
            onClick={() => setTerm('')}
            aria-label="Clear search"
            className="absolute right-3 top-3 rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
          >
            Clear
          </button>
        )}
      </div>

      {!on && (
        <p className="mt-1.5 px-1 text-xs text-slate-500">
          Finds items, SKUs, serial numbers, bins and locations. Movements are on their own tab.
        </p>
      )}

      {on && (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading && total === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">Searching…</p>
          )}
          {!loading && total === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">
              Nothing matches “{debounced}”.
            </p>
          )}

          <Group title="Items" count={itemRows.length}>
            {itemRows.map((it) => (
              <Row
                key={it.id}
                label={it.name}
                hint={it.sku ?? undefined}
                onClick={() => onGoToTab('stock')}
              />
            ))}
          </Group>

          <Group title="Serial units" count={unitRows.length}>
            {unitRows.map((u) => (
              <Row
                key={u.id}
                label={u.serial_number}
                // No nested item on the unit payload — status is the useful
                // second line anyway when you searched by serial.
                hint={u.status}
                onClick={() => onGoToTab('units')}
              />
            ))}
          </Group>

          <Group title="Bins" count={binRows.length}>
            {binRows.map((b) => (
              <Row
                key={b.id}
                label={b.path_label || b.name || b.bin_code || b.id}
                hint={b.bin_code ?? undefined}
                onClick={() => onGoToTab('bins')}
              />
            ))}
          </Group>

          <Group title="Locations" count={locationRows.length}>
            {locationRows.map((l) => (
              <Row key={l.id} label={l.name} hint={l.type} onClick={() => onGoToTab('locations')} />
            ))}
          </Group>
        </div>
      )}
    </div>
  )
}

/** Nothing is rendered for an empty group — a heading over no rows reads as broken. */
function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <p className="bg-slate-50 px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
        {title} <span className="tabular-nums text-slate-400">{count}</span>
      </p>
      {children}
    </div>
  )
}

function Row({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-amber-50"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{label}</span>
      {hint && <span className="shrink-0 truncate font-mono text-xs text-slate-400">{hint}</span>}
    </button>
  )
}
