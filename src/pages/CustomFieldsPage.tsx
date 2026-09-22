import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * /tool-shed/custom-fields — manage tenant-defined extra fields on
 * jobs, customers, invoices, assets. Each row becomes a form input on
 * the matching entity edit page AND a `{{custom.<key>}}` merge tag in
 * templates.
 */

interface CustomField {
  id: string
  entity_type: 'work_order' | 'customer' | 'asset'
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

// Invoice deliberately omitted — job + customer fields already render
// through to invoice templates via {{custom.<key>}}, so a dedicated
// invoice scope would just duplicate the work.
const ENTITY_TYPES: Array<{ value: CustomField['entity_type']; label: string; hint: string }> = [
  { value: 'work_order', label: 'Job',      hint: 'Shown on the new-job form. Flows through to invoice / receipt / work-order templates for that job.' },
  { value: 'customer',   label: 'Customer', hint: 'Shown on the customer form. Available on every doc tied to that customer.' },
  { value: 'asset',      label: 'Asset',    hint: 'Shown on the asset form. Available on docs scoped to the asset.' },
]

const FIELD_TYPES: Array<{ value: CustomField['field_type']; label: string }> = [
  { value: 'text',         label: 'Single-line text' },
  { value: 'longtext',     label: 'Multi-line text' },
  { value: 'number',       label: 'Number' },
  { value: 'date',         label: 'Date' },
  { value: 'boolean',      label: 'Yes / No' },
  { value: 'select',       label: 'Dropdown (pick one)' },
  { value: 'multiselect',  label: 'Dropdown (pick many)' },
  { value: 'url',          label: 'URL' },
]

export function CustomFieldsPage() {
  const [entityType, setEntityType] = useState<CustomField['entity_type']>('work_order')
  const [editing, setEditing] = useState<CustomField | null>(null)
  const [creating, setCreating] = useState(false)

  const list = useQuery({
    queryKey: ['custom-fields', entityType],
    queryFn: () => apiRequest<{ data: CustomField[] }>(`/v1/custom-fields?entity_type=${entityType}`),
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold text-navy-900">Custom Fields</h1>
          <p className="text-sm text-slate-600 mt-1">
            Add your own fields to jobs, customers, invoices, and assets. Each one becomes
            a form input on the entity AND a{' '}
            <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{'{{custom.field_key}}'}</code>{' '}
            merge tag you can drop into any template.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setCreating(true)
          }}
          className="shrink-0 whitespace-nowrap text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
        >
          + New field
        </button>
      </div>

      {/* Entity-type tabs */}
      <div className="mt-6 border-b border-slate-200 flex flex-wrap gap-1">
        {ENTITY_TYPES.map((e) => (
          <button
            key={e.value}
            type="button"
            onClick={() => setEntityType(e.value)}
            className={[
              'relative px-4 py-2.5 text-sm font-medium transition-colors',
              entityType === e.value ? 'text-navy-900' : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {e.label}
            {entityType === e.value && (
              <span className="absolute left-3 right-3 -bottom-px h-[3px] bg-amber-500" />
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-3">
        {ENTITY_TYPES.find((e) => e.value === entityType)?.hint}
      </p>

      <div className="mt-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
        {list.isLoading && (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!list.isLoading && (list.data?.data?.length ?? 0) === 0 && (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No custom fields yet for {ENTITY_TYPES.find((e) => e.value === entityType)?.label}.
            Click + New field to add one.
          </div>
        )}
        {(list.data?.data?.length ?? 0) > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">Label</th>
                <th className="text-left px-4 py-2.5">Merge tag</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Required</th>
                <th className="text-right px-4 py-2.5">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data!.data.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => {
                    setCreating(false)
                    setEditing(f)
                  }}
                  className="cursor-pointer hover:bg-amber-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{f.label}</div>
                    {f.help_text && (
                      <div className="text-[11px] text-slate-500 italic">{f.help_text}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-amber-800">{f.merge_tag}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {FIELD_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{f.required ? 'Required' : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {f.active ? (
                      <span className="text-emerald-700 text-xs">●</span>
                    ) : (
                      <span className="text-slate-300 text-xs">○</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && (
        <CustomFieldEditor
          entityType={entityType}
          field={editing}
          isCreate={creating}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

// ---------- editor modal ----------

function CustomFieldEditor({
  entityType,
  field,
  isCreate,
  onClose,
}: {
  entityType: CustomField['entity_type']
  field: CustomField | null
  isCreate: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [label, setLabel] = useState(field?.label ?? '')
  const [key, setKey] = useState(field?.key ?? '')
  /**
   * Auto-sync the key from the label until the user manually edits the
   * key (or we're editing an existing field that already has a server-
   * set key locked). Once they touch the key field we stop overriding
   * so their custom value sticks.
   */
  const keyUserEdited = useRef(!isCreate || !!field?.key)
  const [fieldType, setFieldType] = useState<CustomField['field_type']>(field?.field_type ?? 'text')
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>(field?.options ?? [])
  const [defaultValue, setDefaultValue] = useState(field?.default_value ?? '')
  const [required, setRequired] = useState(!!field?.required)
  const [placeholder, setPlaceholder] = useState(field?.placeholder ?? '')
  const [helpText, setHelpText] = useState(field?.help_text ?? '')
  const [active, setActive] = useState(field ? field.active : true)
  const [sortOrder, setSortOrder] = useState(field?.sort_order ?? 0)

  // Auto-derive a slug from label.
  const derivedKey = useMemo(() => slugify(label), [label])
  const effectiveKey = key.trim() || derivedKey

  // While the user hasn't touched the key field (and we're not editing
  // an existing field), live-mirror the label into the key.
  useEffect(() => {
    if (keyUserEdited.current) return
    setKey(derivedKey)
  }, [derivedKey])

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        label,
        key: effectiveKey,
        field_type: fieldType,
        options: ['select', 'multiselect'].includes(fieldType) ? options : null,
        default_value: defaultValue || null,
        required,
        placeholder: placeholder || null,
        help_text: helpText || null,
        active,
        sort_order: sortOrder,
      }
      if (isCreate) payload.entity_type = entityType
      return apiRequest(isCreate ? '/v1/custom-fields' : `/v1/custom-fields/${field!.id}`, {
        method: isCreate ? 'POST' : 'PATCH',
        body: payload,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] })
      onClose()
    },
  })

  const del = useMutation({
    mutationFn: () => apiRequest(`/v1/custom-fields/${field!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] })
      onClose()
    },
  })

  const needsOptions = fieldType === 'select' || fieldType === 'multiselect'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy-900">
            {isCreate ? `New ${ENTITY_TYPES.find((e) => e.value === entityType)?.label} field` : `Edit ${field?.label}`}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <Row label="Label" required>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. PO Number"
              className={inputCls}
              autoFocus
            />
          </Row>
          <Row
            label="Merge tag key"
            hint={
              isCreate
                ? 'Auto-synced from the label — edit to override. Clear to re-link to the label.'
                : 'Locked once a field is saved — would orphan existing values otherwise.'
            }
          >
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs text-slate-500 shrink-0">{'{{custom.'}</code>
              <input
                type="text"
                value={key}
                disabled={!isCreate}
                onChange={(e) => {
                  const next = slugify(e.target.value)
                  setKey(next)
                  // Empty → resume auto-sync. Non-empty → user owns it.
                  keyUserEdited.current = next !== ''
                }}
                placeholder={derivedKey || 'po_number'}
                className={inputCls + ' font-mono text-xs disabled:bg-slate-50 disabled:text-slate-500'}
              />
              <code className="font-mono text-xs text-slate-500 shrink-0">{'}}'}</code>
            </div>
            {isCreate && keyUserEdited.current && key.trim() !== derivedKey && derivedKey && (
              <p className="text-[11px] text-amber-700 mt-1">
                Auto-sync paused — your custom key is locked in.
                <button
                  type="button"
                  onClick={() => {
                    keyUserEdited.current = false
                    setKey(derivedKey)
                  }}
                  className="ml-1 underline hover:text-amber-900"
                >
                  Re-link to label
                </button>
              </p>
            )}
          </Row>

          <Row label="Field type" required>
            <select value={fieldType} onChange={(e) => setFieldType(e.target.value as any)} className={inputCls}>
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Row>

          {needsOptions && (
            <Row label="Dropdown options">
              <div className="space-y-1.5">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => {
                        const next = [...options]
                        next[i] = { ...next[i], label: e.target.value, value: next[i].value || slugify(e.target.value) }
                        setOptions(next)
                      }}
                      placeholder="Option label"
                      className={inputCls + ' flex-1'}
                    />
                    <input
                      type="text"
                      value={opt.value}
                      onChange={(e) => {
                        const next = [...options]
                        next[i] = { ...next[i], value: e.target.value }
                        setOptions(next)
                      }}
                      placeholder="value"
                      className={inputCls + ' w-32 font-mono text-xs'}
                    />
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                      className="text-xs text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setOptions([...options, { value: '', label: '' }])}
                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                >
                  + Add option
                </button>
              </div>
            </Row>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Row label="Placeholder">
              <input type="text" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className={inputCls} />
            </Row>
            <Row label="Default value">
              <input type="text" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} className={inputCls} />
            </Row>
          </div>

          <Row label="Help text" hint="Small explanatory text shown under the field on the form.">
            <input type="text" value={helpText} onChange={(e) => setHelpText(e.target.value)} className={inputCls} />
          </Row>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              Required on the form
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              Active (shown on forms)
            </label>
          </div>

          <Row label="Sort order" hint="Lower numbers come first.">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))}
              className={inputCls + ' w-24'}
            />
          </Row>

          {save.isError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              {(save.error as Error).message}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
          <div>
            {!isCreate && (
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="text-sm px-3 py-2 text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending || !label.trim() || (needsOptions && options.length === 0)}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : isCreate ? 'Create field' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function slugify(input: string): string {
  let s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!/^[a-z]/.test(s) && s.length > 0) s = 'f_' + s
  return s.slice(0, 60)
}
