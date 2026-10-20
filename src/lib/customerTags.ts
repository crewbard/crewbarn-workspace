import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Customer tags come from the company's Tags library (Tool Shed → Tags).
 * A customer carries the tag names; the library supplies which can be
 * chosen and their colors.
 */
export interface CustomerTagChoice {
  id: string
  name: string
  color: string
}

/** The library's colors, by the name Tool Shed → Tags stores. */
export const TAG_COLOR_OPTIONS = [
  { value: 'slate', label: 'Slate', hex: '#64748b' },
  { value: 'blue', label: 'Blue', hex: '#3b82f6' },
  { value: 'green', label: 'Green', hex: '#10b981' },
  { value: 'amber', label: 'Amber', hex: '#f59e0b' },
  { value: 'red', label: 'Red', hex: '#ef4444' },
  { value: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { value: 'pink', label: 'Pink', hex: '#ec4899' },
  { value: 'teal', label: 'Teal', hex: '#14b8a6' },
]

export function tagHex(color: string | null | undefined): string {
  return TAG_COLOR_OPTIONS.find((o) => o.value === color)?.hex ?? color ?? '#64748b'
}

/** The active library tags a customer can be given. */
export function useCustomerTags() {
  return useQuery({
    queryKey: ['customer-tags'],
    queryFn: () => apiRequest<{ data: CustomerTagChoice[] }>('/v1/customer-tags'),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/** A tag's color from the library; a tag that left the library is slate. */
export function useCustomerTagColor(): (name: string) => string {
  const tags = useCustomerTags().data?.data ?? []
  return (name: string) => tagHex(tags.find((t) => t.name === name)?.color ?? 'slate')
}
