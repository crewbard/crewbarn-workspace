import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'

/**
 * Tool Shed → Lists → Service Locations.
 *
 * Tenant-wide flat list of every service location, joined to the owning
 * customer. Read-only directory view — locations are still created /
 * edited from the customer detail page (nested under each customer).
 *
 * Source: GET /v1/customer-service-locations?q=&customer_id=
 */

interface ServiceLocation {
  id: string
  nickname: string | null
  position: number
  address: {
    street_address: string | null
    apt_unit: string | null
    city: string | null
    state: string | null
    postal_code: string | null
    formatted: string | null
  }
  is_primary: boolean
  is_secured: boolean
  location_code: string | null
  active: boolean
  customer_id: string | null
  customer: { id: string; display_name: string } | null
}

interface Response {
  data: ServiceLocation[]
  meta: { current_page: number; last_page: number; total: number }
}

export function ServiceLocationsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['service-locations', search, page],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: '50', page: String(page) })
      if (search.trim()) params.set('q', search.trim())
      return apiRequest<Response>(`/v1/customer-service-locations?${params.toString()}`)
    },
  })

  const rows = query.data?.data ?? []

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Service Locations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every service location across all customers. Use the search to find a
          house, building, or unit by nickname or address. Locations are created
          and edited from the customer detail page.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search nickname, street, city, ZIP…"
          className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {query.isLoading && <p className="text-sm text-slate-500 italic">Loading…</p>}
      {query.isError && (
        <p className="text-sm text-red-700">
          {(query.error as Error).message ?? 'Failed to load.'}
        </p>
      )}

      {!query.isLoading && rows.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          {search ? `No service locations match "${search}".` : 'No service locations yet.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {rows.map((loc) => (
                <li key={loc.id} className="px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {loc.nickname || loc.address.street_address || 'Untitled location'}
                        </span>
                        {loc.is_primary && (
                          <span className="text-[10px] uppercase tracking-wide text-amber-700 font-bold">
                            Primary
                          </span>
                        )}
                        {loc.is_secured && (
                          <span className="text-[10px] uppercase tracking-wide text-red-700 font-bold">
                            🔒 Secured
                          </span>
                        )}
                        {!loc.active && (
                          <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-slate-500 mt-0.5 truncate">
                        {loc.address.formatted ??
                          [loc.address.street_address, loc.address.city, loc.address.state]
                            .filter(Boolean)
                            .join(', ')}
                      </div>
                      {loc.customer && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Customer:{' '}
                          <Link
                            to={`/customers/${loc.customer.id}`}
                            className="text-amber-700 hover:underline font-medium"
                          >
                            {loc.customer.display_name}
                          </Link>
                        </div>
                      )}
                    </div>
                    {loc.customer && (
                      <Link
                        to={`/customers/${loc.customer.id}`}
                        className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0"
                      >
                        Open customer →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {query.data && query.data.meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
              <span>
                Page {query.data.meta.current_page} of {query.data.meta.last_page} ·{' '}
                {query.data.meta.total.toLocaleString()} locations
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || query.isFetching}
                  className="px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= query.data.meta.last_page || query.isFetching}
                  className="px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
