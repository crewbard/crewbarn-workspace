import type { AssetType, AssetCustomField } from '@/types/assetType'

export function normalizeAssetCustomFields(
  values: Record<string, unknown>,
  assetType?: AssetType | null
): Record<string, unknown> {
  const allowedKeys = assetType ? new Set((assetType.custom_field_schema ?? []).map((field) => field.key)) : null
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => {
      if (allowedKeys && !allowedKeys.has(key)) return false
      return value !== '' && value !== null && value !== undefined
    })
  )
}

export function assetCustomFieldsAreValid(
  assetType: AssetType | null | undefined,
  values: Record<string, unknown>
): boolean {
  const fields = assetType?.custom_field_schema ?? []
  return fields.every((field) => !field.required || customFieldHasValue(field, values[field.key]))
}

function customFieldHasValue(field: AssetCustomField, value: unknown): boolean {
  if (field.type === 'boolean') return typeof value === 'boolean'
  if (field.type === 'number') return value !== '' && value !== null && value !== undefined && !Number.isNaN(Number(value))
  return value !== '' && value !== null && value !== undefined
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function numberValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return String(value)
}

function setFieldValue(
  values: Record<string, unknown>,
  field: AssetCustomField,
  rawValue: string | boolean
): Record<string, unknown> {
  if (field.type === 'boolean') {
    return { ...values, [field.key]: Boolean(rawValue) }
  }

  if (field.type === 'number') {
    if (rawValue === '') return { ...values, [field.key]: '' }
    const parsed = Number(rawValue)
    return { ...values, [field.key]: Number.isFinite(parsed) ? parsed : rawValue }
  }

  return { ...values, [field.key]: rawValue }
}

export function AssetCustomFieldsForm({
  assetType,
  values,
  onChange,
}: {
  assetType: AssetType | null | undefined
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
}) {
  const fields = assetType?.custom_field_schema ?? []

  if (!assetType || fields.length === 0) return null

  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="mb-3">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide">
          {assetType.name} details
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          These fields come from the selected asset type, so a fire door, camera, safe, or access panel can capture the right details.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((field) => {
          const value = values[field.key]
          return (
            <div key={field.key} className={field.type === 'boolean' ? 'md:col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
                {field.label || field.key}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.type === 'boolean' ? (
                <label className="inline-flex items-center gap-2 min-h-[38px] text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => onChange(setFieldValue(values, field, event.target.checked))}
                    className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span>{field.help_text || field.label || field.key}</span>
                </label>
              ) : field.type === 'select' ? (
                <select
                  value={displayValue(value)}
                  onChange={(event) => onChange(setFieldValue(values, field, event.target.value))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
                >
                  <option value="">- Select -</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                  value={field.type === 'number' ? numberValue(value) : displayValue(value)}
                  onChange={(event) => onChange(setFieldValue(values, field, event.target.value))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                />
              )}
              {field.help_text && field.type !== 'boolean' && (
                <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
