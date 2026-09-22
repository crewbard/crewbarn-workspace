import { useState, useMemo } from 'react'
import {
  useSubcontractors,
  useDeleteSubcontractor,
} from '@/hooks/useSubcontractors'
import { SubcontractorEditor } from '@/components/subs/SubcontractorEditor'
import type { Subcontractor, SubPaymentTerms } from '@/types/subcontractor'

/**
 * Tool Shed → Subcontractors. Tenant-wide CRUD list of every sub
 * registered to this tenant. Quick-edit lands in the inline
 * SubcontractorEditor modal (same component the picker uses for
 * inline "+ Add new"). Soft-delete via the deleteSubcontractor
 * mutation; deleted rows stay in the DB but disappear from the list.
 */

const TERMS_LABEL: Record<SubPaymentTerms, string> = {
  on_receipt: 'On receipt',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_60: 'Net 60',
}

export function SubcontractorsPage() {
  const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Subcontractor | null>(null)

  const params = useMemo(() => {
    if (filter === 'all') return { q: search || undefined }
    return { active: filter === 'active', q: search || undefined }
  }, [filter, search])

  const subsQ = useSubcontractors(params)
  const subs = subsQ.data ?? []
  const deleteMutation = useDeleteSubcontractor()

  function handleEdit(sub: Subcontractor) {
    setEditing(sub)
    setEditorOpen(true)
  }

  function handleAdd() {
    setEditing(null)
    setEditorOpen(true)
  }

  function handleDelete(sub: Subcontractor) {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate(sub.id)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Subcontractors</h1>
          <p className="text-sm text-slate-500 mt-1">
            Vendor partners you outsource WOs to. Link each one to a customer-portal user
            so they can see assigned jobs + submit invoices in the portal.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md"
        >
          + Add subcontractor
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, contact, email, partner #…"
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500 w-72"
        />
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
          {(['active', 'inactive', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium capitalize ${
                filter === f
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {subsQ.isLoading && (
          <span className="text-xs text-slate-500">Loading…</span>
        )}
      </div>

      {subs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <div className="text-3xl mb-2">🤝</div>
          <p className="text-sm font-semibold text-slate-800">
            {search ? 'No matches.' : 'No subcontractors yet.'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Add one to start outsourcing WOs. Subs see their assigned jobs in
            the customer portal under <strong>Subbed jobs</strong>.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Business</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Contact</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Phone</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-slate-600">Portal access</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-slate-600">Compliance</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Terms</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => (
                <tr
                  key={sub.id}
                  className={`border-b border-slate-100 last:border-b-0 ${sub.active ? '' : 'opacity-60'} hover:bg-slate-50`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">{sub.business_name}</div>
                    {sub.vendor_partner_number && (
                      <div className="text-xs text-slate-500 font-mono">#{sub.vendor_partner_number}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {sub.contact_name || <span className="text-slate-400">—</span>}
                    {sub.email && (
                      <div className="text-xs text-slate-500 truncate max-w-[200px]" title={sub.email}>
                        {sub.email}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 tabular-nums text-xs">
                    {sub.phone || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {sub.portal_account_id ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800"
                        title={sub.portal_account_email ?? sub.portal_account_id}
                      >
                        ✓ Linked
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                        Not linked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs">
                    <div className="inline-flex gap-1">
                      <Pill on={sub.w9_on_file}>W-9</Pill>
                      <Pill on={sub.coi_on_file}>COI</Pill>
                      <Pill on={sub.license_on_file}>Lic.</Pill>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">{TERMS_LABEL[sub.default_payment_terms]}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(sub)}
                        className="text-xs text-amber-700 hover:text-amber-800 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sub)}
                        disabled={deleteMutation.isPending}
                        className="text-xs text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SubcontractorEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        subcontractor={editing}
      />
    </div>
  )
}

function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
        on ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
      }`}
      title={on ? 'On file' : 'Not on file'}
    >
      {children}
    </span>
  )
}
