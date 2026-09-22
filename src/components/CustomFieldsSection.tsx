import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * CustomFieldsSection — drop-in section that renders the tenant's
 * custom fields for a given entity_type as form inputs. Parent owns
 * the values dict (keyed by custom_field_id) and a setter; this
 * component is dumb-presentational beyond the field-definitions fetch.
 *
 * After the parent saves its entity and has an entity_id, it should
 * POST the values to /v1/custom-fields/values via uploadCustomValues
 * below.
 */

export interface CustomFieldDef {
  id: string
  entity_type: string
  key: string
  label: string
  field_type: 'text' | 'longtext' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'url'
  options: Array<{ value: string; label: string }>
  default_value: string | null
  required: boolean
  placeholder: string | null
  help_text: string | null
  sort_order: number
  active: boolean
  merge_tag: string
}

/**
 * Per-field value shape — keyed by custom_field_id. We carry both
 * `text` (always present for the merge-tag string fallback) and the
 * typed value (number / date / bool / json[]) so the upsert endpoint
 * can persist into the right column.
 */
export interface CustomValueShape {
  text?: string | null
  number?: number | null
  date?: string | null
  bool?: boolean | null
  json?: string[] | null
}
export type CustomValues = Record<string, CustomValueShape>

export function CustomFieldsSection({
  entityType,
  entityId,
  values,
  onChange,
}: {
  entityType: 'work_order' | 'customer' | 'asset'
  /** When set, also seed the values from /v1/custom-fields/values for editing existing rows. */
  entityId?: string | null
  values: CustomValues
  onChange: (next: CustomValues) => void
}) {
  // Definitions (always fetched). When entityId is set, also fetch
  // existing values to pre-populate the form on edit.
  const defs = useQuery({
    queryKey: ['custom-fields', entityType],
    queryFn: () =>
      apiRequest<{ data: CustomFieldDef[] }>(`/v1/custom-fields?entity_type=${entityType}&active=true`),
    staleTime: 60_000,
  })
  const existing = useQuery({
    queryKey: ['custom-field-values', entityType, entityId],
    queryFn: () =>
      apiRequest<{
        data: Array<{ field: CustomFieldDef; value: CustomValueShape | null }>
      }>(`/v1/custom-fields/values?entity_type=${entityType}&entity_id=${entityId}`),
    enabled: !!entityId,
  })

  // On first definition load, seed defaults for unset fields. On
  // existing-values load (edit mode), hydrate values from server.
  useEffect(() => {
    if (!defs.data) return
    const next = { ...values }
    let dirty = false
    for (const f of defs.data.data) {
      if (next[f.id]) continue
      if (f.default_value) {
        next[f.id] = { text: f.default_value }
        dirty = true
      }
    }
    if (dirty) onChange(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defs.data])

  useEffect(() => {
    if (!existing.data) return
    const next = { ...values }
    let dirty = false
    for (const row of existing.data.data) {
      if (row.value && !next[row.field.id]) {
        next[row.field.id] = row.value
        dirty = true
      }
    }
    if (dirty) onChange(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data])

  const fields = defs.data?.data ?? []
  if (defs.isLoading) {
    return (
      <div className="p-3 text-xs text-slate-500 italic">Loading custom fields…</div>
    )
  }
  if (fields.length === 0) {
    return null  // Tenant hasn't defined any custom fields for this entity yet
  }

  function setValue(fieldId: string, patch: CustomValueShape) {
    onChange({ ...values, [fieldId]: { ...values[fieldId], ...patch } })
  }

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.id}>
          <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
            {f.label}
            {f.required && <span className="text-red-600 ml-0.5">*</span>}
            <span className="ml-2 font-mono text-[10px] text-slate-400 normal-case tracking-normal">
              {f.merge_tag}
            </span>
          </label>
          <FieldInput field={f} value={values[f.id]} onChange={(patch) => setValue(f.id, patch)} />
          {f.help_text && (
            <p className="text-[11px] text-slate-500 mt-1">{f.help_text}</p>
          )}
        </div>
      ))}
    </div>
  )
}

const inputCls =
  'w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDef
  value: CustomValueShape | undefined
  onChange: (patch: CustomValueShape) => void
}) {
  const v = value ?? {}

  switch (field.field_type) {
    case 'longtext':
      return (
        <textarea
          value={v.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={field.placeholder ?? ''}
          rows={3}
          className={inputCls + ' resize-y'}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          value={v.number ?? ''}
          onChange={(e) => {
            const n = e.target.value === '' ? null : Number(e.target.value)
            onChange({ number: n, text: e.target.value })
          }}
          placeholder={field.placeholder ?? ''}
          className={inputCls}
        />
      )
    case 'date':
      return (
        <input
          type="date"
          value={v.date ?? ''}
          onChange={(e) => onChange({ date: e.target.value || null, text: e.target.value || null })}
          className={inputCls}
        />
      )
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!v.bool}
            onChange={(e) => onChange({ bool: e.target.checked, text: e.target.checked ? 'Yes' : 'No' })}
            className="rounded text-amber-600 focus:ring-amber-500"
          />
          <span>{field.placeholder || 'Yes'}</span>
        </label>
      )
    case 'select':
      return (
        <select
          value={v.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          className={inputCls}
        >
          <option value="">{field.placeholder || '— pick one —'}</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    case 'multiselect': {
      const picked = new Set(v.json ?? [])
      return (
        <div className="space-y-1">
          {field.options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={picked.has(o.value)}
                onChange={(e) => {
                  const next = new Set(picked)
                  if (e.target.checked) next.add(o.value)
                  else next.delete(o.value)
                  const arr = Array.from(next)
                  onChange({ json: arr, text: arr.join(', ') })
                }}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              {o.label}
            </label>
          ))}
        </div>
      )
    }
    case 'url':
      return (
        <input
          type="url"
          value={v.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={field.placeholder ?? 'https://…'}
          className={inputCls}
        />
      )
    case 'text':
    default:
      return (
        <input
          type="text"
          value={v.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={field.placeholder ?? ''}
          className={inputCls}
        />
      )
  }
}

/**
 * Helper for parents: POST the bag of values up to the backend once
 * the parent has an entity_id (i.e. after the host entity is saved).
 */
export async function uploadCustomValues(
  entityType: string,
  entityId: string,
  values: CustomValues,
): Promise<void> {
  const rows = Object.entries(values).map(([custom_field_id, v]) => ({
    custom_field_id,
    text: v.text ?? null,
    number: v.number ?? null,
    date: v.date ?? null,
    bool: v.bool ?? null,
    json: v.json ?? null,
  }))
  if (rows.length === 0) return
  await apiRequest('/v1/custom-fields/values', {
    method: 'POST',
    body: {
      entity_type: entityType,
      entity_id: entityId,
      values: rows,
    },
  })
}
