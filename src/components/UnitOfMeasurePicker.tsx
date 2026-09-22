import { useState } from 'react'
import { UOM_GROUPS, UOM_PRESETS } from '@/lib/unitsOfMeasure'

/**
 * Catalog item unit-of-measure picker. Renders a grouped dropdown of common
 * presets (each/lbs/gal/etc.) with a "Custom…" escape hatch for shops that
 * need an obscure unit. Uses an <optgroup> for visual grouping; falls back
 * to a text input when "Custom…" is selected.
 *
 * Stores the unit as a plain string on the catalog item — backend doesn't
 * care about the distinction; display + qty-step behavior is derived from
 * the value via lib/unitsOfMeasure.
 */
export function UnitOfMeasurePicker({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  const trimmed = value.trim()
  const isPreset = UOM_PRESETS.includes(trimmed)
  const [customMode, setCustomMode] = useState(!isPreset && trimmed !== '')

  if (customMode) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="custom unit"
          className={
            className ??
            'flex-1 text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500'
          }
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setCustomMode(false)
            onChange('each')
          }}
          className="text-xs text-slate-500 hover:text-slate-800 underline"
        >
          Use preset
        </button>
      </div>
    )
  }

  return (
    <select
      value={isPreset ? trimmed : ''}
      onChange={(e) => {
        const v = e.target.value
        if (v === '__custom__') {
          setCustomMode(true)
          onChange('')
          return
        }
        onChange(v)
      }}
      className={
        className ??
        'w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white'
      }
    >
      {!isPreset && <option value="">— Pick a unit —</option>}
      {UOM_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.units.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </optgroup>
      ))}
      <option value="__custom__">Custom…</option>
    </select>
  )
}
