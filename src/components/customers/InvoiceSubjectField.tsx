import { useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * The invoice email subject a customer asked for, built from a dropdown of
 * tags rather than typed codes. Picking one drops it in where the cursor is;
 * the line under it shows the subject with example values, so it reads as
 * the customer will see it. Tags with no value on a given invoice stop the
 * send rather than email an incomplete subject (CustomerInvoiceSubject).
 */

interface Tag {
  tag: string
  label: string
  example: string
}

/** Matches App\Services\CustomerInvoiceSubject::TAGS. */
const GROUPS: { label: string; tags: Tag[] }[] = [
  {
    label: 'Invoice',
    tags: [
      { tag: '{{invoice.number}}', label: 'Invoice number', example: '1042' },
      { tag: '{{invoice.total}}', label: 'Invoice total', example: '$485.00' },
      { tag: '{{invoice.due_date}}', label: 'Due date', example: 'Nov 8, 2026' },
    ],
  },
  {
    label: 'Their references',
    tags: [
      { tag: '{{job.their_work_order_number}}', label: 'Their work order number', example: 'WO-77812' },
      { tag: '{{job.their_po_number}}', label: 'Their PO number', example: 'PO-3341' },
    ],
  },
  {
    label: 'Job',
    tags: [
      { tag: '{{job.number}}', label: 'Your job number', example: '5581' },
      { tag: '{{job.title}}', label: 'Job title', example: 'No heat in unit 4B' },
      { tag: '{{service_location.name}}', label: 'Service location name', example: 'Building C' },
      { tag: '{{service_location.address}}', label: 'Service location address', example: '12 Dock St, Tampa' },
    ],
  },
  {
    label: 'Customer',
    tags: [
      { tag: '{{customer.name}}', label: 'Customer name', example: 'Harbor Point Properties' },
      { tag: '{{customer.account_number}}', label: 'Customer account number', example: 'HP-204' },
      { tag: '{{billing_customer.name}}', label: 'Who the bill goes to', example: 'Harbor Point Properties' },
    ],
  },
]

interface CustomFieldRow {
  id: string
  entity_type: string
  label: string
  merge_tag: string
  active?: boolean
}

export function InvoiceSubjectField({
  value,
  onChange,
  customerName,
}: {
  value: string
  onChange: (value: string) => void
  customerName?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const fields = useQuery({
    queryKey: ['custom-fields', 'all-for-merge-panel'],
    queryFn: () => apiRequest<{ data: CustomFieldRow[] }>('/v1/custom-fields'),
    staleTime: 60_000,
  })

  // Their own fields: the customer's, and the job's (a job field with the same key wins).
  const custom: { label: string; tags: Tag[] }[] = useMemo(() => {
    const rows = (fields.data?.data ?? []).filter((f) => (f.entity_type === 'customer' || f.entity_type === 'work_order') && f.active !== false)
    const of = (type: string, heading: string) => {
      const tags = rows.filter((f) => f.entity_type === type).map((f) => ({ tag: f.merge_tag, label: f.label, example: `(${f.label})` }))
      return tags.length ? [{ label: heading, tags }] : []
    }
    return [...of('customer', 'Customer fields you added'), ...of('work_order', 'Job fields you added')]
  }, [fields.data])

  const all = [...GROUPS, ...custom]
  const examples = useMemo(() => {
    const map: Record<string, string> = {}
    for (const g of [...GROUPS, ...custom]) for (const t of g.tags) map[t.tag.replace(/\s/g, '')] = t.example
    if (customerName) {
      map['{{customer.name}}'] = customerName
      map['{{billing_customer.name}}'] = customerName
    }
    return map
  }, [custom, customerName])

  const insert = (tag: string) => {
    const el = input.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? start
    const before = value.slice(0, start)
    const spacer = before && !/\s$/.test(before) ? ' ' : ''
    const next = (before + spacer + tag + value.slice(end)).slice(0, 200)
    onChange(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const at = Math.min(next.length, start + spacer.length + tag.length)
      el.setSelectionRange(at, at)
    })
  }

  const example = value.trim()
    ? value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (m) => examples[m.replace(/\s/g, '')] ?? '(unknown tag)')
    : ''
  const unknown = example.includes('(unknown tag)')

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={200}
          placeholder="Leave blank to use your normal invoice subject"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          data-tour="customer-invoice-subject-tags"
          value=""
          onChange={(e) => {
            if (e.target.value) insert(e.target.value)
            e.target.value = ''
          }}
          aria-label="Insert a tag"
          className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 sm:w-56"
        >
          <option value="">Insert a tag…</option>
          {all.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.tags.map((t) => (
                <option key={t.tag} value={t.tag}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {example && (
        <p className={`text-xs ${unknown ? 'text-red-700' : 'text-slate-600'}`}>
          {unknown ? 'This has a tag CrewBarn doesn’t know. Pick tags from the list. ' : 'Example: '}
          <span className="font-medium">{example}</span>
        </p>
      )}
      <p className="text-xs text-slate-500">
        Pick from <span className="font-medium">Insert a tag</span> to drop in the invoice number, their work order or PO number, the customer, or a field you added.
        If a tag has no value on an invoice (say, no PO number), the invoice isn’t emailed until it’s filled in, so an incomplete subject never goes out.
      </p>
    </div>
  )
}
