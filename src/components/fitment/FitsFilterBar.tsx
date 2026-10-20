import { useEffect, useState } from 'react'
import '@/components/inventory/bins/bins.css'
import { FilterChip } from '@/components/ui/FilterChip'
import { useFitmentProfile, useFitmentValues, type FitmentField, type FitmentSubject } from '@/lib/fitment'
import { DraftBadge } from '@/components/fitment/FitsSection'

/**
 * The Product catalog's Fits filter: pick what the part must fit (Vehicle,
 * Lock, Unit…), then the fields the profile marks as filters. The list is
 * filtered on the server (GET /v1/catalog-items?fits[...]), so paging and
 * totals stay right. Must sit inside [data-bins-ui].
 */

const box = 'rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2 py-1 text-[13px] text-[var(--bins-text)] placeholder:text-[var(--bins-muted)] focus:border-[var(--bins-accent)] focus:outline-none'
const input = `w-36 ${box}`

function FilterField({ subject, field, value, narrow, onChange }: {
  subject: FitmentSubject
  field: FitmentField
  value: string
  narrow: Record<string, string>
  onChange: (v: string) => void
}) {
  // Typed text is applied after a pause, so the list doesn't reload on every key.
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  useEffect(() => {
    if (text === value) return
    const t = setTimeout(() => onChange(text.trim()), 350)
    return () => clearTimeout(t)
  }, [text, value, onChange])
  const [focused, setFocused] = useState(false)
  const suggest = useFitmentValues(subject.key, field.key, text, narrow, focused && field.type !== 'choice' && field.type !== 'year_range' && field.type !== 'number')
  const listId = `fits-filter-${subject.key}-${field.key}`

  if (field.type === 'choice') {
    return (
      <select aria-label={field.label} data-fits-filter={field.key} className={box} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.label}: any</option>
        {(field.choices ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    )
  }
  return (
    <>
      <input
        aria-label={field.label}
        data-fits-filter={field.key}
        className={input}
        value={text}
        placeholder={field.type === 'year_range' ? `${field.label === 'Years' ? 'Year' : field.label}, e.g. 2016` : field.label}
        inputMode={field.type === 'year_range' || field.type === 'number' ? 'numeric' : undefined}
        list={suggest.data?.length ? listId : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => setText(e.target.value)}
      />
      {suggest.data && suggest.data.length > 0 && (
        <datalist id={listId}>{suggest.data.map((s) => <option key={s.value} value={s.value} />)}</datalist>
      )}
    </>
  )
}

export function FitsFilterBar({ value, onChange, onOpenProfile }: {
  /** {subject, ...field: value}; empty = no Fits filter. */
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
  /** Opens Product catalog → Fitment (the fields). */
  onOpenProfile?: () => void
}) {
  const { data } = useFitmentProfile()
  if (!data || data.status === 'off') return null
  const subjects = data.profile.subjects
  if (subjects.length === 0) return null
  const picked = subjects.find((s) => s.key === value.subject)
  const fields = picked ? picked.fields.filter((f) => f.filter) : []
  const narrow: Record<string, string> = {}
  if (value.make) narrow.make = value.make
  if (value.brand) narrow.brand = value.brand

  return (
    <div data-tour="prod-fits-filter" data-fits-filter-bar="" className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-medium text-[var(--bins-text-2)]">Fits</span>
      {data.status === 'draft' && <DraftBadge />}
      {subjects.map((s) => (
        <FilterChip
          key={s.key}
          chip={`fits-${s.key}`}
          active={picked?.key === s.key}
          label={s.label}
          onClick={() => onChange(picked?.key === s.key ? {} : { subject: s.key })}
        />
      ))}
      {picked && fields.map((f) => (
        <FilterField
          key={`${picked.key}-${f.key}`}
          subject={picked}
          field={f}
          value={value[f.key] ?? ''}
          narrow={f.key === 'model' ? narrow : {}}
          onChange={(v) => {
            const next = { ...value }
            if (v) next[f.key] = v
            else delete next[f.key]
            onChange(next)
          }}
        />
      ))}
      {picked && (
        <button type="button" onClick={() => onChange({})} className="text-[13px] font-medium text-[var(--bins-accent-ink)] hover:underline">
          Clear
        </button>
      )}
      {onOpenProfile && (
        <button type="button" data-fitment-open="" onClick={onOpenProfile} className="ml-auto text-[13px] font-medium text-[var(--bins-text-2)] hover:text-[var(--bins-accent-ink)] hover:underline">
          Fitment fields
        </button>
      )}
    </div>
  )
}
