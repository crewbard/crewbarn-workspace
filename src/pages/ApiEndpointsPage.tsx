import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface ApiParameter {
  name: string
  type: string
  required?: boolean
  defaultValue?: string
  example?: string
  description: string
  values?: string
}

interface ResponseField {
  name: string
  type: string
  description: string
}

interface Endpoint {
  method: Method
  path: string
  title: string
  description: string
  returns?: string
  body?: string
  traits?: string[]
  parameters?: ApiParameter[]
  responseFields?: ResponseField[]
  exampleResponse?: string
}

interface EndpointGroup {
  id: string
  label: string
  description: string
  scope: string
  endpoints: Endpoint[]
}

const GROUPS: EndpointGroup[] = [
  {
    id: 'customers',
    label: 'Customers',
    description: 'Customer profiles, contacts, service locations, documents, balances, and credits.',
    scope: 'customers.view / customers.edit',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/customers',
        title: 'List customers',
        description: 'List every customer matching the supplied query criteria. With no filters, returns the complete tenant customer directory in pages.',
        returns: 'Identity, account number, customer type, contact email, status, billing and tax settings, notes, tags, lifetime value, activity counts, and field-service requirements.',
        traits: ['customer-fieldable', 'customer-sortable', 'customer-filterable', 'paginated', 'tenant-scoped'],
        parameters: [
          { name: 'q', type: 'string', example: 'Acme', description: 'Search display name, business name, account number, and contact name, email, or phone.' },
          { name: 'phone', type: 'string', example: '3215551212', description: 'Match a main or alternate contact phone by normalized digits.' },
          { name: 'fuzzy', type: 'boolean', defaultValue: 'false', description: 'Enable typo-tolerant name matching when q contains at least three characters.' },
          { name: 'customer_type', type: 'string · enum', values: 'residential, commercial, government', description: 'Return only one customer type.' },
          { name: 'filing_letter', type: 'string · enum', values: '#, A–Z', description: 'Return customers filed under a specific initial.' },
          { name: 'has_tag', type: 'string', example: 'priority', description: 'Return customers containing the supplied tag.' },
          { name: 'vip', type: 'boolean', description: 'Filter by VIP status.' },
          { name: 'active', type: 'boolean', description: 'Filter by active status.' },
          { name: 'sort', type: 'string · enum', defaultValue: 'display_name', values: 'display_name, account_number, last_contact_at, lifetime_value_cents, created_at, updated_at', description: 'Field used to order the result.' },
          { name: 'direction', type: 'string · enum', values: 'asc, desc', description: 'Sort direction. Defaults to ascending for names and account numbers, descending otherwise.' },
          { name: 'page', type: 'integer', defaultValue: '1', example: '2', description: 'One-based page number.' },
          { name: 'per_page', type: 'integer', defaultValue: '25', example: '50', description: 'Items per page. Minimum 1, maximum 100.' },
        ],
        responseFields: [
          { name: 'data[].id', type: 'string', description: 'Stable CrewBarn customer identifier.' },
          { name: 'data[].account_number', type: 'string', description: 'Tenant-facing customer account number.' },
          { name: 'data[].display_name', type: 'string', description: 'Display or filing name.' },
          { name: 'data[].customer_type', type: 'enum', description: 'residential, commercial, or government.' },
          { name: 'data[].business_name', type: 'string | null', description: 'Legal or trading name for a commercial customer.' },
          { name: 'data[].first_name / last_name', type: 'string | null', description: 'Residential customer name fields.' },
          { name: 'data[].email', type: 'string | null', description: 'Email derived from the main contact.' },
          { name: 'data[].active / vip', type: 'boolean', description: 'Customer status flags.' },
          { name: 'data[].payment_term_id', type: 'string | null', description: 'Assigned payment term; null uses the tenant default.' },
          { name: 'data[].taxable', type: 'boolean', description: 'Whether transactions are normally taxable.' },
          { name: 'data[].tags', type: 'string[]', description: 'Tenant business classification tags.' },
          { name: 'data[].lifetime_value_cents', type: 'integer', description: 'Lifetime value in minor currency units.' },
          { name: 'data[].open_jobs_count', type: 'integer', description: 'Open service jobs for this customer.' },
          { name: 'data[].pending_estimates_count', type: 'integer', description: 'Draft or sent estimates awaiting a decision.' },
          { name: 'data[].responsible_unpaid_cents', type: 'integer', description: 'Outstanding amount including jobs billed to this customer.' },
          { name: 'data[].created_at / updated_at', type: 'ISO 8601', description: 'Record timestamps.' },
          { name: 'meta', type: 'object', description: 'Laravel pagination information and navigation links.' },
          { name: 'tab_counts', type: 'object', description: 'Counts for all, residential, commercial, and government tabs.' },
          { name: 'filing_counts', type: 'object', description: 'Counts for # and A–Z filing groups.' },
        ],
        exampleResponse: `{
  "data": [
    {
      "id": "cus_01J...",
      "account_number": "10042",
      "display_name": "Acme Properties",
      "customer_type": "commercial",
      "business_name": "Acme Properties",
      "email": "manager@acme.example",
      "active": true,
      "vip": false,
      "tags": ["commercial", "recurring"],
      "lifetime_value_cents": 253400,
      "open_jobs_count": 3,
      "pending_estimates_count": 1,
      "responsible_unpaid_cents": 48500,
      "created_at": "2026-01-12T14:30:00Z",
      "updated_at": "2026-09-20T16:05:00Z"
    }
  ],
  "meta": { "current_page": 1, "last_page": 4, "per_page": 25, "total": 84 },
  "tab_counts": { "all": 84, "residential": 45, "commercial": 31, "government": 8 }
}`,
      },
      { method: 'POST', path: '/v1/customers', title: 'Create a customer', description: 'Create a residential, commercial, or government customer, optionally with contacts and service locations.', body: '{ "display_name": "City of Melbourne", "customer_type": "government", "business_name": "City of Melbourne" }' },
      { method: 'GET', path: '/v1/customers/{customer}', title: 'Get a customer', description: 'Retrieve one customer with nested contacts and service locations.', returns: 'The complete business customer record. Tenant IDs, deleted records, payment credentials, and encrypted secure-file contents are never returned.' },
      { method: 'PATCH', path: '/v1/customers/{customer}', title: 'Update a customer', description: 'Update customer identity, billing, tax, notes, consent, and operating-policy fields.' },
      { method: 'GET', path: '/v1/customers/{customer}/contacts', title: 'List contacts', description: 'Get names, titles, departments, email, phone, mailing address, contact roles, consent, and active status.' },
      { method: 'POST', path: '/v1/customers/{customer}/contacts', title: 'Create a contact', description: 'Add a main, billing, service, or intake contact.' },
      { method: 'GET', path: '/v1/customers/{customer}/service-locations', title: 'List service locations', description: 'Get address, coordinates, nickname, primary status, location contact, and service-access policy.' },
      { method: 'POST', path: '/v1/customers/{customer}/service-locations', title: 'Create a service location', description: 'Add an address at which the customer receives service.' },
      { method: 'GET', path: '/v1/customers/{customer}/documents', title: 'List customer documents', description: 'List contracts, certificates, and ordinary customer attachments. Encrypted secure files use a separate protected workflow.' },
      { method: 'GET', path: '/v1/customers/{customer}/invoice-summary', title: 'Get invoice summary', description: 'Retrieve billing totals and invoice activity for a customer.' },
      { method: 'GET', path: '/v1/customers/{customer}/outstanding-invoices', title: 'Get outstanding invoices', description: 'Retrieve invoices that still have a balance due.' },
      { method: 'GET', path: '/v1/customers/{customer}/credits', title: 'List customer credits', description: 'Retrieve available, applied, and refunded customer credits.' },
    ],
  },
  {
    id: 'jobs', label: 'Jobs', description: 'Work orders, line items, visits, scheduling, assignments, status, media, and closeout.', scope: 'jobs.view / jobs.edit', endpoints: [
      { method: 'GET', path: '/v1/work-orders', title: 'List jobs', description: 'Filter and page through tenant work orders.' },
      { method: 'POST', path: '/v1/work-orders', title: 'Create a job', description: 'Create work for a customer and service location.' },
      { method: 'GET', path: '/v1/work-orders/{workOrder}', title: 'Get a job', description: 'Retrieve the job, customer, schedule, assignments, status, pricing, requirements, and related activity.' },
      { method: 'PATCH', path: '/v1/work-orders/{workOrder}', title: 'Update a job', description: 'Change schedule, description, assignment, priority, or status when permitted.' },
      { method: 'GET', path: '/v1/work-orders/{workOrder}/line-items', title: 'List job line items', description: 'Retrieve labor, service, product, quantity, price, cost, discount, and tax details.' },
      { method: 'POST', path: '/v1/work-orders/{workOrder}/line-items', title: 'Add a line item', description: 'Add a service, product, labor, or custom charge to a job.' },
      { method: 'GET', path: '/v1/work-orders/{workOrder}/visits', title: 'List visits', description: 'Retrieve appointment windows and field visit activity.' },
      { method: 'GET', path: '/v1/work-orders/{workOrder}/signatures', title: 'List signatures', description: 'Retrieve customer signature records attached to the job.' },
    ],
  },
  {
    id: 'estimates', label: 'Estimates', description: 'Quotes, line items, approvals, customer delivery, contracts, and conversion.', scope: 'jobs.view / jobs.edit', endpoints: [
      { method: 'GET', path: '/v1/estimates', title: 'List estimates', description: 'Retrieve estimates with customer, status, dates, and totals.' },
      { method: 'POST', path: '/v1/estimates', title: 'Create an estimate', description: 'Create a quote for a customer or job.' },
      { method: 'GET', path: '/v1/estimates/{estimate}', title: 'Get an estimate', description: 'Retrieve estimate details, pricing, taxes, discounts, status, and related records.' },
      { method: 'PATCH', path: '/v1/estimates/{estimate}', title: 'Update an estimate', description: 'Update an estimate while its current status allows editing.' },
      { method: 'GET', path: '/v1/estimates/{estimate}/line-items', title: 'List estimate lines', description: 'Retrieve quoted services, products, quantities, prices, discounts, and tax.' },
    ],
  },
  {
    id: 'invoices', label: 'Invoices & payments', description: 'Invoices, balances, payments, refunds, and credits—never card credentials.', scope: 'invoices.view / invoices.edit', endpoints: [
      { method: 'GET', path: '/v1/invoices', title: 'List invoices', description: 'Retrieve invoices by customer, job, status, date, or balance state.' },
      { method: 'POST', path: '/v1/invoices', title: 'Create an invoice', description: 'Create an invoice from approved business data.' },
      { method: 'GET', path: '/v1/invoices/{invoice}', title: 'Get an invoice', description: 'Retrieve lines, totals, tax, payments, balance, due date, and status.' },
      { method: 'PATCH', path: '/v1/invoices/{invoice}', title: 'Update an invoice', description: 'Update an editable invoice.' },
      { method: 'GET', path: '/v1/payments', title: 'List payments', description: 'Retrieve payment records and settlement status without payment credentials.' },
      { method: 'POST', path: '/v1/payments', title: 'Record a payment', description: 'Record an authorized external, cash, check, ACH, or other supported payment.' },
      { method: 'POST', path: '/v1/payments/{id}/refund', title: 'Refund a payment', description: 'Issue an authorized refund. Restrict this permission carefully.' },
    ],
  },
  {
    id: 'catalog', label: 'Catalog & pricing', description: 'Services, products, bundles, categories, taxes, discounts, and payment terms.', scope: 'catalog.view / catalog.edit', endpoints: [
      { method: 'GET', path: '/v1/catalog-items', title: 'List catalog items', description: 'Retrieve services, products, bundles, pricing, cost, SKU, tax, and inventory behavior.' },
      { method: 'POST', path: '/v1/catalog-items', title: 'Create a catalog item', description: 'Create a service, product, or bundle.' },
      { method: 'GET', path: '/v1/catalog-categories', title: 'List service categories', description: 'Retrieve service catalog organization.' },
      { method: 'GET', path: '/v1/product-categories', title: 'List product categories', description: 'Retrieve product catalog organization.' },
      { method: 'GET', path: '/v1/tax-classes', title: 'List tax classes', description: 'Retrieve reusable tax classes and their components.' },
      { method: 'GET', path: '/v1/discounts', title: 'List discounts', description: 'Retrieve tenant-approved discount definitions.' },
      { method: 'GET', path: '/v1/payment-terms', title: 'List payment terms', description: 'Retrieve due-on-receipt, Net 30, and other tenant terms.' },
    ],
  },
  {
    id: 'inventory', label: 'Inventory', description: 'Locations, bins, quantities, serialized units, movements, transfers, returns, and reconciliation.', scope: 'inventory.view / inventory.edit', endpoints: [
      { method: 'GET', path: '/v1/inventory-locations', title: 'List stock locations', description: 'Retrieve warehouses, trucks, and other stock locations.' },
      { method: 'GET', path: '/v1/inventory-bins', title: 'List bins', description: 'Retrieve bins within stock locations.' },
      { method: 'GET', path: '/v1/inventory-stock-levels', title: 'Get stock levels', description: 'Retrieve on-hand, reserved, and available quantities.' },
      { method: 'GET', path: '/v1/inventory-units', title: 'List serialized units', description: 'Retrieve tracked serial-number units and their status.' },
      { method: 'POST', path: '/v1/inventory-movements', title: 'Record a movement', description: 'Receive, transfer, issue, install, return, adjust, or write off stock.' },
      { method: 'GET', path: '/v1/inventory-reconciliations', title: 'List reconciliations', description: 'Retrieve unresolved and completed stock reconciliation records.' },
    ],
  },
  {
    id: 'assets', label: 'Assets & inspections', description: 'Customer assets, company assets, groups, documents, checklists, and inspection records.', scope: 'assets.view / assets.edit', endpoints: [
      { method: 'GET', path: '/v1/assets', title: 'List customer assets', description: 'Retrieve customer equipment, location, type, status, and service references.' },
      { method: 'POST', path: '/v1/assets', title: 'Create an asset', description: 'Register a customer asset or piece of equipment.' },
      { method: 'GET', path: '/v1/assets/{asset}', title: 'Get an asset', description: 'Retrieve the asset record and authorized related business data.' },
      { method: 'GET', path: '/v1/company-assets', title: 'List company assets', description: 'Retrieve tenant vehicles, tools, equipment, and assigned custody.' },
      { method: 'GET', path: '/v1/asset-types', title: 'List asset types', description: 'Retrieve tenant-defined asset classifications.' },
      { method: 'GET', path: '/v1/inspection-checklists', title: 'List inspection checklists', description: 'Retrieve reusable checklist definitions.' },
      { method: 'GET', path: '/v1/work-orders/{workOrder}/inspections', title: 'List job inspections', description: 'Retrieve inspection status, findings, and finalized record references for a job.' },
    ],
  },
  {
    id: 'purchasing', label: 'Purchasing', description: 'Vendors, purchase orders, expenses, bills, and subcontractor payouts.', scope: 'inventory.view / revenue.view', endpoints: [
      { method: 'GET', path: '/v1/vendors', title: 'List vendors', description: 'Retrieve vendor contact, terms, status, and purchasing information.' },
      { method: 'GET', path: '/v1/purchase-orders', title: 'List purchase orders', description: 'Retrieve purchase orders, vendor, lines, totals, receiving, and status.' },
      { method: 'POST', path: '/v1/purchase-orders', title: 'Create a purchase order', description: 'Create a purchase order for an approved vendor.' },
      { method: 'GET', path: '/v1/expenses', title: 'List expenses', description: 'Retrieve tenant business expenses and supporting metadata.' },
      { method: 'GET', path: '/v1/vendor-bills', title: 'List vendor bills', description: 'Retrieve accounts-payable bills, amounts, dates, and payment status.' },
      { method: 'GET', path: '/v1/sub-payouts', title: 'List subcontractor payouts', description: 'Retrieve authorized subcontractor payout records.' },
    ],
  },
  {
    id: 'workforce', label: 'Staff & scheduling', description: 'Staff directory, crews, schedules, time clock, and time off. Sensitive identity data is excluded.', scope: 'staff.view / jobs.view', endpoints: [
      { method: 'GET', path: '/v1/staff', title: 'List staff', description: 'Retrieve business directory and assignment-safe staff information.' },
      { method: 'GET', path: '/v1/crews', title: 'List crews', description: 'Retrieve crews and authorized membership information.' },
      { method: 'GET', path: '/v1/visits', title: 'List scheduled visits', description: 'Retrieve job appointments and assignments.' },
      { method: 'GET', path: '/v1/time-clock', title: 'Read time-clock records', description: 'Retrieve authorized work-time entries without private payroll credentials.' },
      { method: 'GET', path: '/v1/time-off-requests', title: 'List time-off requests', description: 'Retrieve workforce availability requests and status.' },
    ],
  },
  {
    id: 'communications', label: 'Communications', description: 'Customer messages, calls, delivery status, and reusable templates.', scope: 'customers.view / calls.view', endpoints: [
      { method: 'GET', path: '/v1/comms/conversations', title: 'List conversations', description: 'Retrieve authorized customer communication threads and message status.' },
      { method: 'GET', path: '/v1/comms/recent-incoming-calls', title: 'Recent incoming calls', description: 'Retrieve recent tenant call activity.' },
      { method: 'GET', path: '/v1/email-templates', title: 'List email templates', description: 'Retrieve tenant-owned customer email templates.' },
      { method: 'GET', path: '/v1/sms-templates', title: 'List SMS templates', description: 'Retrieve tenant-owned customer SMS templates.' },
      { method: 'GET', path: '/v1/document-templates', title: 'List document templates', description: 'Retrieve tenant-owned estimate, invoice, job, and business templates.' },
    ],
  },
  {
    id: 'cbi', label: 'CBI — CrewBarn Intelligence', description: 'Ask CrewBarn a question or give it an instruction in plain English. CBI answers from your data and can act — schedule a job, add a note, create a task — using the same tools as the ask box in the app. Needs AI switched on for your company (Tool Shed → CBI AI Settings) and the ai.use permission on the token\'s account.', scope: 'ai.use', endpoints: [
      {
        method: 'POST',
        path: '/v1/ai/chat',
        title: 'Ask CBI',
        description: 'Send one message. CBI decides which tools to call (schedule, customers, jobs, invoices, stock, call transcripts…), runs them as the token\'s user, and replies in plain English. Anything it writes — a booked job, a note, a task — is done with that user\'s permissions, exactly as if they typed it in the app. Rate limit: 30 requests per minute per user.',
        returns: 'The reply text, which tools ran, links to any records it touched, and cost/latency for the call. Each call is billed to your own AI provider key, not to CrewBarn.',
        traits: ['writable', 'tool-loop', 'tenant-scoped', 'permission-controlled', 'rate-limited · 30/min'],
        body: '{ "prompt": "Book a lock rekey for Acme Properties tomorrow at 2 pm with Mike", "history": [], "context": { "session_id": "my-integration-1" } }',
        parameters: [
          { name: 'prompt', type: 'string', required: true, example: 'What is on the schedule today?', description: 'The message. Up to 2,000 characters. Do not paste untrusted text (a customer\'s email, a web form) straight in as the prompt — CBI can act on what it reads.' },
          { name: 'history', type: 'array', description: 'Earlier turns of the same conversation, oldest first, up to 40. Each is { "role": "user" | "assistant", "content": "…" }. Send back what CBI said so it can carry on (\'yes, book it\'). Tool results are not replayed — each call reads current data.' },
          { name: 'context.session_id', type: 'string', description: 'A stable id you choose for one conversation. Lets learning settle once per conversation instead of once per message.' },
          { name: 'context.work_order_id', type: 'string', description: 'The job this conversation is about, so \'add a note to this job\' needs no name.' },
          { name: 'context.record_type / record_id', type: 'string', values: 'work_order, estimate, invoice, asset, catalog_item, customer', description: 'The record the caller is looking at, if any.' },
          { name: 'context.lat / lng / accuracy_m', type: 'number', description: 'Caller\'s live GPS. A status change spoken from the field is geotagged like a tap in the app.' },
        ],
        responseFields: [
          { name: 'data.ok', type: 'boolean', description: 'False when the AI provider refused or errored; see data.error.' },
          { name: 'data.text', type: 'string', description: 'CBI\'s reply in plain English.' },
          { name: 'data.tools_used', type: 'string[]', description: 'Names of the tools CBI ran for this answer, e.g. schedule_job, get_today_schedule.' },
          { name: 'data.tool_calls[]', type: 'object[]', description: '{ name, blocked, error } per call. blocked = the token\'s user lacks the permission that tool needs.' },
          { name: 'data.resource_links[]', type: 'object[]', description: 'Records CBI touched or referred to — { label, to } paths inside CrewBarn.' },
          { name: 'data.navigation_links[]', type: 'object[]', description: 'Pages CBI suggests opening.' },
          { name: 'data.action', type: 'object | null', description: 'A navigate/act intent for a client app to carry out; null for plain answers.' },
          { name: 'data.model / input_tokens / output_tokens / cost_usd / latency_ms', type: 'mixed', description: 'What the call cost on your provider key and how long it took.' },
          { name: 'data.memories_used[]', type: 'object[]', description: 'Approved company memories CBI drew on: { id, category, title }.' },
        ],
        exampleResponse: `{
  "data": {
    "ok": true,
    "text": "Booked. Acme Properties, 12 Harbor Way, tomorrow at 2:00 PM with Mike — lock rekey.",
    "tools_used": ["schedule_job"],
    "tool_calls": [{ "name": "schedule_job", "blocked": false, "error": null }],
    "resource_links": [{ "label": "Job #1042", "to": "/jobs/wo_01J..." }],
    "navigation_links": [],
    "action": null,
    "model": "claude-sonnet-5",
    "input_tokens": 3120,
    "output_tokens": 184,
    "cost_usd": 0.0121,
    "latency_ms": 2870,
    "memories_used": []
  }
}`,
      },
      {
        method: 'POST',
        path: '/v1/ai/voice',
        title: 'Ask CBI by voice',
        description: 'Same as Ask CBI, but you send an audio clip instead of text. The server transcribes it and runs the identical tool loop. multipart/form-data with an "audio" file (m4a, mp3, mp4, wav, webm, ogg, flac; up to 25 MB) plus optional "history" and "context" as JSON strings. Needs a transcription key on the account (Communication settings). Rate limit: 30 per minute per user.',
        returns: 'Everything Ask CBI returns, plus data.transcript — what the server heard.',
        traits: ['writable', 'tool-loop', 'multipart', 'tenant-scoped', 'permission-controlled', 'rate-limited · 30/min'],
      },
      {
        method: 'POST',
        path: '/v1/ai/speech',
        title: 'Read a reply aloud',
        description: 'Text-to-speech for CBI answers so every client gets the same voice. Send { "text": "…" } (up to 4,000 characters); optional "voice" and "speed" (0.75, 1, 1.25, 1.5). Returns an MP3 body, or JSON { data: { ok: false, error } } when speech is not set up on the account. Rate limit: 60 per minute per user.',
        returns: 'audio/mpeg.',
        traits: ['readable', 'audio', 'tenant-scoped', 'permission-controlled', 'rate-limited · 60/min'],
        body: '{ "text": "Your next job is at 2 PM with Acme Properties.", "voice": "marin", "speed": 1 }',
      },
      { method: 'GET', path: '/v1/settings/ai', title: 'Is CBI on?', description: 'Whether AI is enabled for the company and which provider and model it uses (the key itself is never returned — only whether one is present and its last 4). Needs the settings permission; without it, just call Ask CBI and handle the 422.' },
    ],
  },
  {
    id: 'reports', label: 'Reports', description: 'Read-only operational and financial reporting scoped to the tenant.', scope: 'revenue.view / inventory.view', endpoints: [
      { method: 'GET', path: '/v1/reports/revenue', title: 'Revenue report', description: 'Retrieve revenue results for an authorized date range.' },
      { method: 'GET', path: '/v1/reports/ar-aging', title: 'Accounts receivable aging', description: 'Retrieve unpaid customer balances by aging bucket.' },
      { method: 'GET', path: '/v1/reports/job-profitability', title: 'Job profitability', description: 'Retrieve authorized job revenue, cost, and margin information.' },
      { method: 'GET', path: '/v1/reports/tech-performance', title: 'Technician performance', description: 'Retrieve operational technician results.' },
      { method: 'GET', path: '/v1/reports/inventory-valuation', title: 'Inventory valuation', description: 'Retrieve current inventory value.' },
      { method: 'GET', path: '/v1/reports/sales-tax', title: 'Sales tax report', description: 'Retrieve taxable sales and collected-tax totals.' },
    ],
  },
]

const METHOD_STYLES: Record<Method, string> = {
  GET: 'bg-emerald-100 text-emerald-800 border-emerald-200', POST: 'bg-blue-100 text-blue-800 border-blue-200', PATCH: 'bg-amber-100 text-amber-900 border-amber-200', DELETE: 'bg-red-100 text-red-800 border-red-200',
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(children); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
  return <div className="relative overflow-hidden rounded-lg bg-slate-950 text-slate-100"><button type="button" onClick={copy} className="absolute right-2 top-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300 hover:text-white">{copied ? 'Copied' : 'Copy'}</button><pre className="overflow-x-auto p-4 pr-16 text-xs leading-6"><code>{children}</code></pre></div>
}

function ParameterTable({ title, parameters }: { title: string; parameters: ApiParameter[] }) {
  return <div className="mt-6"><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">{title}</h4><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[640px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Parameter</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Default</th><th className="px-3 py-2.5">Description</th></tr></thead><tbody className="divide-y divide-slate-100">{parameters.map((parameter) => <tr key={parameter.name} className="align-top"><td className="px-3 py-3"><code className="font-semibold text-slate-900">{parameter.name}</code>{parameter.required && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">Required</span>}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-violet-700">{parameter.type}</td><td className="px-3 py-3 text-slate-500">{parameter.defaultValue ?? '—'}</td><td className="px-3 py-3 leading-5 text-slate-600">{parameter.description}{parameter.values && <div className="mt-1"><span className="font-medium text-slate-700">Values:</span> <code className="text-[10px]">{parameter.values}</code></div>}{parameter.example && <div className="mt-1"><span className="font-medium text-slate-700">Example:</span> <code className="text-[10px]">{parameter.example}</code></div>}</td></tr>)}</tbody></table></div></div>
}

function EndpointCard({ endpoint, scope }: { endpoint: Endpoint; scope: string }) {
  const [open, setOpen] = useState(false)
  const pathParameters: ApiParameter[] = [...endpoint.path.matchAll(/\{([^}]+)\}/g)].map((match) => ({ name: match[1], type: 'string', required: true, example: `${match[1]}_01J...`, description: `CrewBarn identifier for the ${match[1].replace(/([A-Z])/g, ' $1').toLowerCase()}.` }))
  const traits = endpoint.traits ?? [endpoint.method === 'GET' ? 'readable' : 'writable', endpoint.path.includes('{') ? 'resource-addressable' : 'collection', 'tenant-scoped', 'permission-controlled']
  const samplePath = endpoint.path.replace(/\{([^}]+)\}/g, '$1_01J...')
  const curl = `curl ${endpoint.method !== 'GET' ? '-X ' + endpoint.method + ' ' : ''}"https://api.crewbarn.com${samplePath}" \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -H "Accept: application/json"${endpoint.body ? ' \\\n  -H "Content-Type: application/json" \\\n  -d \'' + endpoint.body + "'" : ''}`
  return <article className="border-b border-slate-200 last:border-b-0">
    <button type="button" onClick={() => setOpen((value) => !value)} className="w-full px-4 py-5 text-left hover:bg-slate-50/80 sm:px-6"><div className="flex items-start gap-3"><span className={`mt-0.5 w-16 shrink-0 rounded border px-2 py-1 text-center font-mono text-[10px] font-bold ${METHOD_STYLES[endpoint.method]}`}>{endpoint.method}</span><div className="min-w-0 flex-1"><code className="block break-all text-sm font-semibold text-slate-900">{endpoint.path}</code><p className="mt-1 text-xs text-slate-500">{endpoint.title}</p></div><span className="text-lg leading-5 text-slate-400">{open ? '−' : '+'}</span></div></button>
    {open && <div className="border-t border-slate-100 bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-5xl">
        <div className="flex flex-wrap gap-1.5">{traits.map((trait) => <span key={trait} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-mono text-[10px] text-violet-700">{trait}</span>)}</div>
        <p className="mt-4 text-sm font-semibold leading-6 text-slate-900">{endpoint.description}</p>
        {endpoint.returns && <p className="mt-2 text-sm leading-6 text-slate-600"><strong>Data available:</strong> {endpoint.returns}</p>}

        <h3 className="mt-7 border-b border-slate-200 pb-2 text-lg font-bold text-slate-950">Request</h3>
        <div className="mt-4 flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white"><span className={`flex w-20 shrink-0 items-center justify-center border-r px-3 font-mono text-xs font-bold ${METHOD_STYLES[endpoint.method]}`}>{endpoint.method}</span><code className="overflow-x-auto px-4 py-3 text-xs font-semibold text-slate-800">https://api.crewbarn.com{endpoint.path}</code></div>
        {pathParameters.length > 0 && <ParameterTable title="URI parameters" parameters={pathParameters} />}
        {endpoint.parameters && <ParameterTable title="Query parameters" parameters={endpoint.parameters} />}

        <div className="mt-6"><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Headers</h4><div className="overflow-hidden rounded-lg border border-slate-200"><div className="grid grid-cols-[140px_1fr] border-b border-slate-100 p-3 text-xs"><div><code className="font-semibold">Authorization</code><div className="mt-1 text-[9px] font-bold uppercase text-red-700">Required</div></div><div className="leading-5 text-slate-600"><code>Bearer YOUR_TOKEN</code><br />A tenant API token created by an authorized CrewBarn account.</div></div><div className="grid grid-cols-[140px_1fr] p-3 text-xs"><code className="font-semibold">Accept</code><div className="text-slate-600"><code>application/json</code></div></div></div></div>
        {endpoint.body && <div className="mt-6"><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">JSON request body</h4><CodeBlock>{endpoint.body}</CodeBlock></div>}
        <div className="mt-6"><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">cURL example</h4><CodeBlock>{curl}</CodeBlock></div>

        <h3 className="mt-8 border-b border-slate-200 pb-2 text-lg font-bold text-slate-950">Response</h3>
        <div className="mt-4 flex flex-wrap gap-2">{['200 Success', endpoint.method === 'POST' ? '201 Created' : null, '401 Unauthenticated', '403 Forbidden', '404 Not found', '422 Validation error', '429 Rate limited', '500 Server error'].filter(Boolean).map((status, index) => <span key={status} className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold ${index === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{status}</span>)}</div>
        <div className="mt-6"><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Response headers</h4><div className="overflow-hidden rounded-lg border border-slate-200 text-xs"><div className="grid grid-cols-[180px_1fr] border-b border-slate-100 p-3"><code className="font-semibold">Content-Type</code><code className="text-slate-600">application/json</code></div><div className="grid grid-cols-[180px_1fr] border-b border-slate-100 p-3"><code className="font-semibold">X-RateLimit-Limit</code><span className="text-slate-600">Maximum requests allowed in the current window.</span></div><div className="grid grid-cols-[180px_1fr] p-3"><code className="font-semibold">X-RateLimit-Remaining</code><span className="text-slate-600">Requests remaining in the current window.</span></div></div></div>
        {endpoint.responseFields && <div className="mt-6"><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">application/json schema</h4><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Field</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Description</th></tr></thead><tbody className="divide-y divide-slate-100">{endpoint.responseFields.map((field) => <tr key={field.name} className="align-top"><td className="px-3 py-3"><code className="font-semibold text-slate-900">{field.name}</code></td><td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-violet-700">{field.type}</td><td className="px-3 py-3 leading-5 text-slate-600">{field.description}</td></tr>)}</tbody></table></div></div>}
        {endpoint.exampleResponse && <div className="mt-6"><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">200 response example</h4><CodeBlock>{endpoint.exampleResponse}</CodeBlock></div>}
        {!endpoint.responseFields && <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">The response is JSON containing only tenant-scoped business data allowed by <code>{scope}</code>. Platform configuration, credentials, cross-tenant identifiers, and internal security state are excluded.</div>}
      </div>
    </div>}
  </article>
}

export function ApiEndpointsPage() {
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState('all')
  const normalized = query.trim().toLowerCase()
  const visibleGroups = useMemo(() => GROUPS.map((group) => ({ ...group, endpoints: group.endpoints.filter((endpoint) => !normalized || [group.label, endpoint.method, endpoint.path, endpoint.title, endpoint.description, endpoint.returns ?? ''].some((value) => value.toLowerCase().includes(normalized))) })).filter((group) => group.endpoints.length > 0 && (activeGroup === 'all' || group.id === activeGroup)), [activeGroup, normalized])
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.endpoints.length, 0)
  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 px-5 py-8 text-white sm:px-8"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-3 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Tenant Business API</div><h1 className="text-3xl font-bold tracking-tight">API endpoint guide</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Connect your own systems to the business data your CrewBarn account is allowed to use. This guide excludes platform administration, authentication internals, credentials, and provider callbacks.</p></div><Link to="/tool-shed/api-tokens" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400">Manage API tokens →</Link></div></div>
      <div className="grid gap-6 border-b border-slate-200 bg-slate-50 px-5 py-6 sm:px-8 lg:grid-cols-3">{[['1','Create a token','Create a named token from API Tokens. It inherits the creator’s tenant and permissions.'],['2','Send it as a bearer token','Keep it on your server. Never put a token in browser code, URLs, emails, or public repositories.'],['3','Follow IDs to related data','List a resource, take its returned ID, then place that ID into a detail or nested endpoint.']].map(([n,title,text]) => <div key={n}><div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{n}</div><h2 className="text-sm font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>)}</div>
      <div className="grid gap-6 px-5 py-7 sm:px-8 lg:grid-cols-2"><section><h2 className="text-sm font-bold text-slate-900">Make your first request</h2><p className="mb-3 mt-1 text-xs leading-5 text-slate-500">Replace <code>YOUR_TOKEN</code> with the value shown when you created the token.</p><CodeBlock>{`curl https://api.crewbarn.com/v1/customers?per_page=25 \\\n+  -H "Authorization: Bearer YOUR_TOKEN" \\\n+  -H "Accept: application/json"`}</CodeBlock></section><section><h2 className="text-sm font-bold text-slate-900">Reach related customer data</h2><ol className="mt-3 space-y-2 text-xs leading-5 text-slate-600"><li><strong className="text-slate-800">1.</strong> Call <code>GET /v1/customers</code> and copy a customer <code>id</code>.</li><li><strong className="text-slate-800">2.</strong> Call <code>GET /v1/customers/{'{customer}'}</code> for the complete record.</li><li><strong className="text-slate-800">3.</strong> Use the same ID in <code>/contacts</code>, <code>/service-locations</code>, <code>/documents</code>, or <code>/outstanding-invoices</code>.</li></ol><div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">A token can never cross into another tenant. It also cannot exceed the permissions of the account that created it.</div></section></div>
    </div>
    <div className="sticky top-0 z-10 mt-6 border-y border-slate-200 bg-slate-50/95 py-3 backdrop-blur"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search endpoints or data…" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 sm:max-w-xs" /><div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0"><button type="button" onClick={() => setActiveGroup('all')} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${activeGroup === 'all' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>All</button>{GROUPS.map((group) => <button key={group.id} type="button" onClick={() => setActiveGroup(group.id)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${activeGroup === group.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>{group.label}</button>)}</div></div></div>
    <div className="mt-5 space-y-5">{visibleGroups.map((group) => <section key={group.id} id={group.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:px-5"><div><h2 className="text-base font-bold text-slate-900">{group.label}</h2><p className="mt-0.5 text-xs text-slate-500">{group.description}</p></div><span className="w-fit rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[10px] text-slate-500">{group.scope}</span></div>{group.endpoints.map((endpoint) => <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} scope={group.scope} />)}</section>)}{visibleCount === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">No business endpoints match that search.</div>}</div>
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-900 px-5 py-5 text-slate-200 sm:px-6"><h2 className="text-sm font-bold text-white">Access and data boundaries</h2><p className="mt-2 text-xs leading-5 text-slate-400">API tokens are limited to your company's CrewBarn data and inherit the permissions of the account that created them. Some sensitive actions require additional permissions and may not be available through the API. CBI calls run on your own AI provider key and act as the token's user — treat a token that can reach CBI like a staff login, not a read-only feed.</p></div>
  </div>
}
