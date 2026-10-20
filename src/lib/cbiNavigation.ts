/** Keep these route homes in parity with scripts/lib/app-slice.mjs (tested). */
export const CBI_ALSO_CONNECT = ['/connect', '/website-builder', '/catalog/tax-classes', '/onboarding', '/franchise-support',
  '/catalog/services', '/catalog/products', '/catalog/categories', '/catalog/product-categories', '/vendors', '/asset-types',
  '/asset-access-requests', '/company-assets', '/reference-cards', '/custom-documents', '/settings/google-reviews',
  '/settings/ai', '/settings/communication', '/settings/integrations', '/settings/inventory', '/settings/warranty']
export const CBI_STAY_IN_WORK = ['/tool-shed/company-files', '/tool-shed/appearance', '/tool-shed/label-printer', '/catalogs']

export interface CbiNavigationContext {
  application: 'work' | 'connect'
  workspaceUrl?: string | null
  currentOrigin: string
  connectUrl?: string
}

export function cbiConnectPath(path: string): boolean {
  const belongs = (prefix: string) => path === prefix || path.startsWith(prefix + '/')
  return !CBI_STAY_IN_WORK.some(belongs) && (belongs('/tool-shed') || CBI_ALSO_CONNECT.some(belongs))
}

/** No hosted-workspace fallback: an undeployed self-hosted workspace has no destination. */
export function resolveCbiNavigation(raw: string, context: CbiNavigationContext): string | null {
  if (!raw || raw.includes('\\') || [...raw].some(character => character.charCodeAt(0) < 32) || raw.startsWith('//')) return null
  let url: URL
  try { url = new URL(raw, context.currentOrigin) } catch { return null }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
  const rooted = raw.startsWith('/')
  if (!rooted && !/^https?:\/\//i.test(raw)) return null
  let connectOrigin: string | null = null
  try { if (context.connectUrl) connectOrigin = new URL(context.connectUrl).origin } catch { /* unavailable */ }
  const local = rooted || url.origin === context.currentOrigin
  const fromConnect = connectOrigin !== null && url.origin === connectOrigin
  // Older guide text may contain hosted origins. Treat them as app identity,
  // never as a fallback destination for a self-hosted company.
  const legacyApp = ['app.crewbarn.com', 'connect.crewbarn.com'].includes(url.hostname)
  const path = url.pathname + url.search + url.hash
  if (context.application === 'connect' && (local || fromConnect || legacyApp)) {
    if (cbiConnectPath(url.pathname)) return path
    if (!context.workspaceUrl) return null
    try {
      const workspace = new URL(context.workspaceUrl)
      if (!['https:', 'http:'].includes(workspace.protocol) || workspace.username || workspace.password || workspace.origin === context.currentOrigin) return null
      return new URL(path, workspace.origin).href
    } catch { return null }
  }
  return local ? path : url.href
}
