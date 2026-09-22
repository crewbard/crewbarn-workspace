import { StatusIcon } from '@/lib/statusIcons'

/**
 * The shared job-type identity chip and its named-color palette.
 *
 * A type's icon (a curated Tabler line-icon name) sits on a soft tint of the
 * type's chosen color. One source of truth so the settings list, the schedule,
 * dispatch, and the calendar all render the same chip.
 */
export const JOB_TYPE_COLOR_OPTIONS: Array<{ value: string; label: string; hex: string }> = [
  { value: 'navy', label: 'Navy', hex: '#1e293b' },
  { value: 'blue', label: 'Blue', hex: '#3b82f6' },
  { value: 'green', label: 'Green', hex: '#10b981' },
  { value: 'amber', label: 'Amber', hex: '#f59e0b' },
  { value: 'red', label: 'Red', hex: '#ef4444' },
  { value: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { value: 'pink', label: 'Pink', hex: '#ec4899' },
  { value: 'teal', label: 'Teal', hex: '#14b8a6' },
  { value: 'slate', label: 'Slate', hex: '#64748b' },
]

/** Resolve a named color ("amber") to its hex; passes an already-hex value through. */
export function jobTypeHex(color: string | null | undefined): string {
  if (!color) return '#64748b'
  return JOB_TYPE_COLOR_OPTIONS.find((o) => o.value === color)?.hex ?? color
}

export function JobTypeChip({
  color,
  icon,
  size = 34,
  className = '',
}: {
  color: string | null | undefined
  icon: string | null | undefined
  size?: number
  className?: string
}) {
  const hex = jobTypeHex(color)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size, background: hex + '22', color: hex }}
    >
      {icon ? (
        <StatusIcon name={icon} size={Math.round(size * 0.52)} />
      ) : (
        <span className="rounded-full" style={{ width: size * 0.3, height: size * 0.3, background: hex }} />
      )}
    </span>
  )
}
