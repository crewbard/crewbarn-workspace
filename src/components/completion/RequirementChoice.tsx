/**
 * One completion requirement on a customer account or a job type: its own
 * rule (Required / Not required, or a number of photos), or Default — the
 * next layer's rule. For a customer that is its parent account's, then the
 * job type's, then the company's (Preferences); for a job type, the company's.
 */

// One width for every choice, so the dropdowns line up in a column whatever
// their options say ("Not required" is wider than "This many").
const selectClass =
  'w-36 shrink-0 text-sm rounded border border-navy-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500'

export function RequirementToggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  value: boolean | null
  onChange: (value: boolean | null) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-navy-800">{label}</div>
        {hint && <div className="text-xs text-navy-500">{hint}</div>}
      </div>
      <select
        aria-label={label}
        disabled={disabled}
        value={value === null ? 'default' : value ? 'yes' : 'no'}
        onChange={(e) => onChange(e.target.value === 'default' ? null : e.target.value === 'yes')}
        className={selectClass}
      >
        <option value="default">Default</option>
        <option value="yes">Required</option>
        <option value="no">Not required</option>
      </select>
    </div>
  )
}

export function RequirementCount({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-navy-800">{label}</div>
        {hint && <div className="text-xs text-navy-500">{hint}</div>}
      </div>
      {/* The number sits left of the dropdown, so the dropdown stays in line with the rest. */}
      <div className="flex items-center gap-2">
        {value !== null && (
          <input
            type="number"
            min={0}
            max={50}
            aria-label={label}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(Math.min(50, Math.max(0, Number(e.target.value || 0))))}
            className="w-20 text-sm rounded border border-navy-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        )}
        <select
          aria-label={`${label}: default or this many`}
          disabled={disabled}
          value={value === null ? 'default' : 'own'}
          onChange={(e) => onChange(e.target.value === 'default' ? null : value ?? 0)}
          className={selectClass}
        >
          <option value="default">Default</option>
          <option value="own">This many</option>
        </select>
      </div>
    </div>
  )
}
