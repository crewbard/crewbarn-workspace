export type CbiApplication = 'work' | 'connect'

/** UI hints only. The server resolves every ID with current authorization. */
export function cbiPageContext(application: CbiApplication, pathname: string, search = '', hash = ''): Record<string, string> {
  const path = pathname.replace(/\/$/, '') || '/'
  const context: Record<string, string> = {
    application,
    workspace: application === 'connect' ? 'Connect' : 'Work',
    path,
    // An identity for the current route, never a claim that an action exists.
    capability_id: `${application}:${path}`,
  }
  const params = new URLSearchParams(search)
  const safeId = (value: string | null) => value && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined
  const tab = safeId(params.get('tab')) || safeId(hash.replace(/^#/, ''))
  if (tab) context.tab = tab
  const match = path.match(/^\/(jobs|customers|estimates|invoices)\/([^/]+)$/)
  const kinds: Record<string, [string, string]> = {
    jobs: ['work_order', 'Job'], customers: ['customer', 'Customer'],
    estimates: ['estimate', 'Estimate'], invoices: ['invoice', 'Invoice'],
  }
  if (match && match[2] !== 'new' && safeId(match[2])) {
    const [type, label] = kinds[match[1]]
    Object.assign(context, { page_name: label, page_label: `${label} detail`, record_type: type, record_id: match[2] })
    context.capability_id = `${application}:${match[1]}.detail`
    if (type === 'work_order') context.work_order_id = match[2]
  }
  // Existing Assets deep links open a modal; do not invent an /assets/:id route.
  const assetId = path === '/assets' ? safeId(params.get('id')) : undefined
  if (assetId) Object.assign(context, { record_type: 'asset', record_id: assetId })
  // Only explicit stable selection IDs; signed URLs, keys and credentials are omitted.
  const fileId = safeId(params.get('file_id'))
  if (fileId) context.file_id = fileId
  return context
}
