import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * MergeTagPanel — full categorized + searchable list of every merge
 * tag the backend MergeTagContext resolves. Clicking inserts the tag
 * at the editor's current cursor; dragging works too (the contenteditable
 * onDrop handler accepts text/plain).
 *
 * Categories mirror the backend context object so what's listed here is
 * exactly what'll resolve when previewing against a real job.
 */

interface TagSpec {
  tag: string
  description: string
  example?: string
}

interface TagGroup {
  category: string
  items: TagSpec[]
}

const TAGS: TagGroup[] = [
  {
    category: 'Service Customer (who the work is for)',
    items: [
      { tag: '{{customer.name}}',                description: 'Full display name', example: 'Jane Doe' },
      { tag: '{{customer.first_name}}',          description: 'First name', example: 'Jane' },
      { tag: '{{customer.last_name}}',           description: 'Last name', example: 'Doe' },
      { tag: '{{customer.business_name}}',       description: 'Business name (commercial accounts)', example: 'Doe Properties LLC' },
      { tag: '{{customer.contact_name}}',        description: 'Primary contact name (for B2B — e.g. "Attn: John Smith")' },
      { tag: '{{customer.contact_first_name}}',  description: 'Primary contact first name' },
      { tag: '{{customer.contact_last_name}}',   description: 'Primary contact last name' },
      { tag: '{{customer.address}}',             description: 'Single-line address (formatted)' },
      { tag: '{{customer.street_address}}',      description: 'Street address line' },
      { tag: '{{customer.city}}',                description: 'City' },
      { tag: '{{customer.state}}',               description: 'State' },
      { tag: '{{customer.postal_code}}',         description: 'ZIP / postal code' },
      { tag: '{{customer.phone}}',               description: 'Primary contact phone' },
      { tag: '{{customer.email}}',               description: 'Primary contact email' },
    ],
  },
  {
    category: 'Billing Customer (who pays)',
    items: [
      { tag: '{{billing_customer.name}}',                description: 'Bill-to full display name — falls back to service customer if no separate billing override' },
      { tag: '{{billing_customer.first_name}}',          description: 'Bill-to first name' },
      { tag: '{{billing_customer.last_name}}',           description: 'Bill-to last name' },
      { tag: '{{billing_customer.business_name}}',       description: 'Bill-to business name', example: 'ABC Auto Dealership' },
      { tag: '{{billing_customer.contact_name}}',        description: 'Bill-to primary contact name', example: 'John Smith, Service Manager' },
      { tag: '{{billing_customer.contact_first_name}}',  description: 'Bill-to primary contact first name' },
      { tag: '{{billing_customer.contact_last_name}}',   description: 'Bill-to primary contact last name' },
      { tag: '{{billing_customer.address}}',             description: "Bill-to address (their HQ — different from service location for dealer / 3rd-party / property mgmt jobs)" },
      { tag: '{{billing_customer.street_address}}',      description: 'Bill-to street address line' },
      { tag: '{{billing_customer.city}}',                description: 'Bill-to city' },
      { tag: '{{billing_customer.state}}',               description: 'Bill-to state' },
      { tag: '{{billing_customer.postal_code}}',         description: 'Bill-to ZIP / postal code' },
      { tag: '{{billing_customer.phone}}',               description: 'Bill-to phone' },
      { tag: '{{billing_customer.email}}',               description: 'Bill-to email' },
      { tag: '{{billing_customer.is_same_as_service}}',  description: '"yes" or "no" — handy as an inline label' },
    ],
  },
  {
    category: 'Job',
    items: [
      { tag: '{{job.id}}',           description: 'Internal job ID', example: 'wo_abc123' },
      { tag: '{{job.number}}',       description: 'Tenant-visible job number', example: '101' },
      { tag: '{{job.title}}',        description: 'Job title' },
      { tag: '{{job.description}}',  description: 'Job description / scope' },
      { tag: '{{job.address}}',      description: 'Service location address' },
      { tag: '{{job.scheduled_at}}', description: 'Scheduled date' },
      { tag: '{{job.priority}}',     description: 'Priority level' },
      { tag: '{{job.status}}',       description: 'Current status label' },
      { tag: '{{job.type}}',         description: 'Job type label' },
      { tag: '{{job.portal_link}}',  description: 'The job page in the customer portal (added automatically to any job message that has no portal link)' },
      { tag: '{{job.portal_button}}', description: 'Ready-made "View this job in your portal" button (HTML)' },
    ],
  },
  {
    category: 'Appointment',
    items: [
      { tag: '{{appointment.at}}',   description: 'Date + time, formatted', example: 'May 13, 2026 2:00 PM' },
      { tag: '{{appointment.date}}', description: 'Date only' },
      { tag: '{{appointment.time}}', description: 'Time only', example: '2:00 PM' },
    ],
  },
  {
    category: 'Service Location',
    items: [
      { tag: '{{service_location.nickname}}',      description: 'Friendly label (e.g. "Lobby", "Building C")' },
      { tag: '{{service_location.street_address}}', description: 'Street address line' },
      { tag: '{{service_location.apt_unit}}',      description: 'Apt / suite / unit', example: 'Ste 200' },
      { tag: '{{service_location.city}}',          description: 'City' },
      { tag: '{{service_location.state}}',         description: 'State / region' },
      { tag: '{{service_location.postal_code}}',   description: 'ZIP / postal code' },
      { tag: '{{service_location.country}}',       description: 'Country' },
      { tag: '{{service_location.full_address}}',  description: 'Full formatted single-line address' },
      { tag: '{{service_location.notes}}',         description: 'Entry notes — gate code, dog, lockbox, where to park, etc.' },
      { tag: '{{service_location.gate_code}}',     description: 'Gate code only (use when the customer doc should not spell out all entry notes)' },
    ],
  },
  {
    category: 'Sub / Vendor Partner (when WO is subbed out)',
    items: [
      { tag: '{{sub.business_name}}',         description: 'Sub company name' },
      { tag: '{{sub.contact_name}}',          description: 'Primary contact at the sub' },
      { tag: '{{sub.phone}}',                 description: 'Sub phone' },
      { tag: '{{sub.email}}',                 description: 'Sub email' },
      { tag: '{{sub.full_address}}',          description: 'Sub mailing address, one line' },
      { tag: '{{sub.street_address}}',        description: 'Sub street address' },
      { tag: '{{sub.apt_unit}}',              description: 'Sub apt / suite' },
      { tag: '{{sub.city}}',                  description: 'Sub city' },
      { tag: '{{sub.state}}',                 description: 'Sub state' },
      { tag: '{{sub.postal_code}}',           description: 'Sub ZIP' },
      { tag: '{{sub.vendor_partner_number}}', description: 'Your internal partner # for this sub (if you assigned one)' },
      { tag: '{{sub_wo.number}}',             description: 'Sub-side WO number (e.g. SUB-2026-0001)' },
      { tag: '{{sub_wo.nte}}',                description: 'Authorized Not-To-Exceed amount (formatted, 2dp)' },
      { tag: '{{sub_wo.special_instructions}}', description: 'Free-text dispatcher instructions/internal notes for the sub' },
      { tag: '{{sub_wo.check_in_phone}}',     description: 'Office phone the sub should use for check-in' },
      { tag: '{{sub_wo.check_out_phone}}',    description: 'Office phone the sub should use for check-out' },
      { tag: '{{sub_wo.requirements}}',       description: 'Closeout requirements derived from the job policy' },
      { tag: '{{sub_wo.photo_requirements}}', description: 'Photo requirement text for this sub work order' },
      { tag: '{{sub_wo.signoff_requirements}}', description: 'Sign-off requirement text for this sub work order' },
      { tag: '{{sub_wo.dispatched_at}}',      description: 'Date the sub was dispatched' },
      { tag: '{{sub_wo.service_date}}',       description: 'Scheduled service date on the WO' },
      { tag: '{{sub_wo.status}}',             description: 'Current sub status (dispatched / in_progress_at_sub / completed_by_sub / paid_to_sub)' },
    ],
  },
  {
    category: 'Line items / Products',
    items: [
      { tag: '{{products.list}}',              description: 'Plain-text list, one item per line' },
      { tag: '{{products.table}}',             description: 'HTML table — description / qty / rate / total. No images.' },
      { tag: '{{products.compact_table}}',     description: 'Dense table for estimates/jobs/invoices with many line items.' },
      { tag: '{{products.table_with_images}}', description: 'Same table but with a thumbnail column when the line item links to a catalog item with an image.' },
      { tag: '{{products.cards}}',             description: 'Card grid — image on top, description + price below. Falls back to a placeholder for line items without an image.' },
      { tag: '{{products.cards_no_image}}',    description: 'Card grid without images — text-only, useful for service-only docs.' },
      { tag: '{{products.count}}',             description: 'Number of line items as a string' },
      { tag: '{{products.subtotal}}',          description: 'Pre-tax subtotal (formatted, 2dp)' },
      { tag: '{{products.tax}}',               description: 'Tax sum across all line items' },
      { tag: '{{products.total}}',             description: 'Grand total (subtotal + tax)' },
    ],
  },
  {
    category: 'Invoice',
    items: [
      { tag: '{{invoice.number}}',          description: 'Invoice number' },
      { tag: '{{invoice.total}}',           description: 'Total (formatted, 2dp)', example: '1,234.56' },
      { tag: '{{invoice.subtotal}}',        description: 'Pre-tax subtotal' },
      { tag: '{{invoice.tax}}',             description: 'Tax amount' },
      { tag: '{{invoice.balance}}',         description: 'Outstanding balance' },
      { tag: '{{invoice.balance_dollars}}', description: 'Same as balance — used by reminder emails' },
      { tag: '{{invoice.days_overdue}}',    description: 'Whole days past due' },
      { tag: '{{invoice.due_at}}',          description: 'Due date' },
      { tag: '{{invoice.issued_at}}',       description: 'Date issued' },
      { tag: '{{invoice.status}}',          description: 'Status (open / paid / etc.)' },
      { tag: '{{invoice.pay_link}}',        description: 'URL to pay this invoice online (customer portal)' },
      { tag: '{{invoice.pay_button}}',      description: 'Ready-made "Pay this invoice online" button (HTML)' },
      { tag: '{{invoice.portal_link}}',     description: 'Same portal invoice page (alias of pay_link)' },
    ],
  },
  {
    category: 'Customer portal',
    items: [
      { tag: '{{portal.url}}',          description: 'Customer portal — the job page when the message is about a job, else the portal home' },
      { tag: '{{portal.button}}',       description: 'Ready-made "Open customer portal" button (HTML)' },
      { tag: '{{company.portal_link}}', description: 'Same portal home URL (under the company namespace)' },
    ],
  },
  {
    category: 'Technician',
    items: [
      { tag: '{{technician.name}}', description: 'Lead tech display name' },
    ],
  },
  {
    category: 'Company',
    items: [
      { tag: '{{company.name}}',        description: 'Your company / shop name' },
      { tag: '{{company.phone}}',       description: 'Company phone' },
      { tag: '{{company.email}}',       description: 'Company email' },
      { tag: '{{company.address}}',     description: 'Company address' },
      { tag: '{{company.website}}',     description: 'Company website URL' },
      { tag: '{{company.logo}}',        description: 'Logo URL — use inside <img src="…">' },
      { tag: '{{company.logo_url}}',    description: 'Alias for logo' },
      { tag: '{{company.brand_color}}', description: 'Brand primary color (hex)' },
      { tag: '{{company.review_link}}', description: 'Review-collection URL' },
      { tag: '{{company.bank_transfer}}', description: 'Pay-by-bank-transfer block (bank, routing, account, memo). Empty unless turned on under Tool Shed → Payments' },
    ],
  },
  {
    category: 'Other',
    items: [
      { tag: '{{today}}', description: "Today's date, formatted" },
    ],
  },
  {
    category: 'Signature placeholders',
    items: [
      { tag: '[[signature:customer]]',   description: 'Customer signature slot' },
      { tag: '[[signature:company]]',    description: 'Company / owner signature slot' },
      { tag: '[[signature:technician]]', description: 'Technician sign-off slot' },
      { tag: '[[signature:witness]]',    description: 'Witness signature slot' },
    ],
  },
]

export function MergeTagPanel({ onInsert }: { onInsert: (text: string) => void }) {
  const [q, setQ] = useState('')

  // Pull the tenant's own custom-field definitions and surface them
  // as a dynamic group so users can drop them straight into a
  // template alongside the built-in tags.
  const customs = useQuery({
    queryKey: ['custom-fields', 'all-for-merge-panel'],
    queryFn: () =>
      apiRequest<{
        data: Array<{ id: string; entity_type: string; label: string; merge_tag: string; field_type: string }>
      }>('/v1/custom-fields'),
    staleTime: 60_000,
  })

  const dynamicGroups: TagGroup[] = useMemo(() => {
    const rows = customs.data?.data ?? []
    if (rows.length === 0) return []
    // Group customs by entity so users see "Custom · Job" / "Custom · Customer" etc.
    const buckets: Record<string, TagSpec[]> = {}
    const labelFor: Record<string, string> = {
      work_order: 'Custom · Job',
      customer: 'Custom · Customer',
      asset: 'Custom · Asset',
    }
    for (const r of rows) {
      const cat = labelFor[r.entity_type] ?? `Custom · ${r.entity_type}`
      ;(buckets[cat] ||= []).push({
        tag: r.merge_tag,
        description: `${r.label} (${r.field_type})`,
      })
    }
    return Object.entries(buckets).map(([category, items]) => ({ category, items }))
  }, [customs.data])

  const allGroups: TagGroup[] = useMemo(() => [...TAGS, ...dynamicGroups], [dynamicGroups])

  const filtered = useMemo(() => {
    if (!q.trim()) return allGroups
    const needle = q.trim().toLowerCase()
    return allGroups.map((group) => ({
      ...group,
      items: group.items.filter(
        (i) =>
          i.tag.toLowerCase().includes(needle) ||
          i.description.toLowerCase().includes(needle) ||
          group.category.toLowerCase().includes(needle),
      ),
    })).filter((g) => g.items.length > 0)
  }, [q, allGroups])

  function handleDragStart(e: React.DragEvent<HTMLButtonElement>, tag: string) {
    e.dataTransfer.setData('text/plain', tag)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200 bg-white shrink-0">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tags…"
          className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
        />
      </div>
      <div className="overflow-y-auto p-2">
        <p className="text-[10px] text-slate-500 italic px-2 py-1">
          Click to insert at cursor, or drag onto the editor.
        </p>
        {filtered.length === 0 && (
          <p className="text-xs text-slate-500 italic px-2 py-4 text-center">
            No tags match &ldquo;{q}&rdquo;.
          </p>
        )}
        {filtered.map((group) => (
          <div key={group.category} className="mb-3">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
              {group.category}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.tag)}
                  onClick={() => onInsert(item.tag)}
                  // mousedown preventDefault would kill the drag start —
                  // editor's saved-range mechanism handles cursor
                  // preservation for click-to-insert instead.
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-amber-50 border border-transparent hover:border-amber-200 cursor-grab active:cursor-grabbing group"
                >
                  <div className="font-mono text-[11px] text-amber-900 group-hover:text-amber-700">
                    {item.tag}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    {item.description}
                    {item.example && (
                      <span className="text-slate-400"> · e.g. {item.example}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Custom-field discovery: even when no fields are defined yet
            we surface the {{custom.<key>}} pattern so users know they
            can add them. Hidden while filtering since it'd never match. */}
        {!q.trim() && dynamicGroups.length === 0 && (
          <div className="mb-3">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
              Custom Fields
            </div>
            <div className="px-2 py-2 text-[11px] text-slate-500 italic border border-dashed border-slate-200 rounded">
              No custom fields defined yet. Set them up in{' '}
              <a
                href="/custom-fields"
                target="_blank"
                rel="noreferrer"
                className="text-amber-700 hover:underline"
              >
                Settings → Custom Fields
              </a>
              {' '}— then drop them into a template with{' '}
              <span className="font-mono">{'{{custom.<key>}}'}</span>.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
