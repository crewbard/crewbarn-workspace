import { useCustomerTagColor } from '@/lib/customerTags'

/** The tag's color from the Tags library, as a small dot beside its name. */
export function CustomerTagDot({ name }: { name: string }) {
  const color = useCustomerTagColor()

  return <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color(name) }} />
}
