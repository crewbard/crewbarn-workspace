import { Link } from 'react-router-dom'

/**
 * Tool Shed → Lists → Customer Types.
 *
 * Customer type is a fixed schema enum that drives form behaviour
 * (residential needs first/last name; organization types need a business
 * or agency name). This page documents what
 * each type means so a tenant admin can hand it to staff. Not editable —
 * adding more types would require a real backend change (we'd add a
 * customer_types table and refactor the enum into a foreign key).
 */

const TYPES = [
  {
    value: 'residential',
    label: 'Residential',
    color: '#3b82f6',
    description: 'A household customer — billed to a named person.',
    fields: [
      'First name + last name required',
      'Optional: cell phone, alternate phone, email',
      'Billing address defaults to the service location',
    ],
    examples: 'Homeowners, renters, condo owners.',
  },
  {
    value: 'commercial',
    label: 'Commercial',
    color: '#10b981',
    description: 'A business customer — billed to a company.',
    fields: [
      'Business name required',
      'Optional: AP contact, tax-exempt flag, primary contact',
      'Often has multiple service locations under one account',
    ],
    examples: 'Property managers, retailers, offices, restaurants, schools.',
  },
  {
    value: 'government',
    label: 'Government',
    color: '#8b5cf6',
    description: 'A public agency or government organization — billed to the agency.',
    fields: [
      'Agency or organization name required',
      'Optional: department, AP contact, tax-exempt certificate, PO details',
      'Supports multiple contacts and service locations',
    ],
    examples: 'Cities, counties, school districts, public authorities, and state agencies.',
  },
]

export function CustomerTypesPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Customer Types</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every customer is one of three types. The type is set when a customer
          is created and drives which fields are required.
        </p>
      </div>

      <div className="space-y-4">
        {TYPES.map((t) => (
          <div key={t.value} className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: t.color }}
              />
              <h2 className="text-lg font-bold text-slate-900">{t.label}</h2>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {t.value}
              </span>
            </div>
            <p className="text-sm text-slate-700 mb-3">{t.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Required fields
                </div>
                <ul className="text-slate-700 space-y-1 ml-4 list-disc">
                  {t.fields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Typical examples
                </div>
                <p className="text-slate-700">{t.examples}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        Need another classification that does not change required fields? Use{' '}
        <Link to="/tool-shed/tags" className="text-blue-700 hover:underline font-medium">Tags</Link>{' '}
        to organize customers without changing their billing identity.
      </div>
    </div>
  )
}
