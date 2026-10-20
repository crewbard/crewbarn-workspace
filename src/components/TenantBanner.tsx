import { appExtensions } from '@/lib/appExtensions'

/**
 * The strip above every signed-in page. Empty unless the full app has
 * registered one: CrewBarn's platform staff get their company picker there
 * (src/admin/components/TenantBanner.tsx).
 */
export function TenantBanner() {
  const Banner = appExtensions().Banner
  return Banner ? <Banner /> : null
}
