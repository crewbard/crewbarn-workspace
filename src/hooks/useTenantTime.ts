import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

type TenantCompanyResponse = {
  data: {
    timezone?: string | null
  }
}

export function useTenantTimezone(): string {
  const query = useQuery({
    queryKey: ['tenant-company'],
    queryFn: () => apiRequest<TenantCompanyResponse>('/v1/tenant-settings/company'),
    staleTime: 5 * 60_000,
  })

  return query.data?.data.timezone
    || Intl.DateTimeFormat().resolvedOptions().timeZone
    || 'UTC'
}

export function tenantDate(timezone: string, addDays = 0, instant = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const value = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const date = new Date(Date.UTC(value('year'), value('month') - 1, value('day') + addDays))

  return date.toISOString().slice(0, 10)
}

export function tenantCalendarDate(timezone: string, instant = new Date()): Date {
  const [year, month, day] = tenantDate(timezone, 0, instant).split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}
export function formatDateValue(
  value: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' },
  locale?: string,
): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12))
    : new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(locale, {
    ...options,
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  }).format(date)
}
