import { Link, useLocation } from 'react-router-dom'

// Map each Tool Shed slug -> human-readable name + planned stage
// Mirrors the items in ToolShedMenu.tsx
const TOOL_SHED_META: Record<string, { name: string; stage: string }> = {
  'company-info': { name: 'Company Info', stage: 'Stage 7' },
  'preferences': { name: 'Company Preferences', stage: 'Stage 7' },
  'brand': { name: 'Brand & Logo', stage: 'Stage 7' },
  'custom-fields': { name: 'Custom Fields', stage: 'Stage 8' },
  'custom-documents': { name: 'Templates & Forms', stage: 'Stage 8' },
  'job-types': { name: 'Job Types', stage: 'Stage 7' },
  'job-statuses': { name: 'Job Statuses', stage: 'Stage 7' },
  'tags': { name: 'Tags', stage: 'Stage 7' },
  'customer-types': { name: 'Customer Types', stage: 'Stage 7' },
  'service-locations': { name: 'Service Locations', stage: 'Stage 7' },
  'service-catalog': { name: 'Service Catalog', stage: 'Stage 9' },
  'product-catalog': { name: 'Product Catalog', stage: 'Stage 9' },
  'pricing': { name: 'Pricing & Discounts', stage: 'Stage 9' },
  'tax-classes': { name: 'Tax Classes', stage: 'Stage 7' },
  'stock': { name: 'Stock Levels', stage: 'Stage 9' },
  'warehouses': { name: 'Warehouses', stage: 'Stage 9' },
  'purchase-orders': { name: 'Purchase Orders', stage: 'Stage 9' },
  'vendors': { name: 'Vendors', stage: 'Stage 9' },
  'staff': { name: 'Staff & Crews', stage: 'Stage 6' },
  'roles': { name: 'Roles & Permissions', stage: 'Stage 6' },
  'time-off': { name: 'Time Off', stage: 'Stage 8' },
  'integrations': { name: 'Integrations', stage: 'Day 7 priority — building soon' },
  'api-tokens': { name: 'API Tokens', stage: 'Stage 11' },
  'webhooks': { name: 'Webhooks', stage: 'Stage 11' },
  'connected-apps': { name: 'Connected Apps', stage: 'Stage 11' },
  'billing': { name: 'Billing & Plan', stage: 'Stage 10' },
  'usage': { name: 'Usage & Limits', stage: 'Stage 10' },
  'audit-log': { name: 'Audit Log', stage: 'Stage 8' },
  'data-export': { name: 'Data Export', stage: 'Stage 8' },
}

export function ToolShedPlaceholderPage() {
  const location = useLocation()
  // Extract the slug from /tool-shed/<slug>
  const slug = location.pathname.replace(/^\/tool-shed\//, '').replace(/\/$/, '')
  const meta = TOOL_SHED_META[slug] ?? { name: 'Tool Shed', stage: 'Coming soon' }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="text-center">
        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wide rounded-full mb-4">
          Tool Shed
        </span>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">{meta.name}</h1>
        <p className="text-amber-700 font-medium text-sm mb-6">{meta.stage}</p>
        <p className="text-slate-600 mb-8 leading-relaxed">
          This Tool Shed item is a placeholder. The page gets wired up as its underlying system is built. Track build progress in the project roadmap.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-navy-700 hover:text-navy-900"
        >
          <span>&larr;</span> Back to dashboard
        </Link>
      </div>
    </div>
  )
}
