/** Individual access choices shared by staff controls and every Connect directory. */
export const INDIVIDUAL_SETTINGS = [
  { scope: 'settings_modules', label: 'Modules', route: '/tool-shed/modules' },
  { scope: 'settings_warranty', label: 'Warranty settings', route: '/tool-shed/warranty-settings' },
  { scope: 'settings_company', label: 'Company Info', route: '/tool-shed/company-info' },
  { scope: 'settings_preferences', label: 'Shop Rules', route: '/tool-shed/preferences' },
] as const

export function canViewSetting(route: string, has: (permission: string) => boolean): boolean {
  const cbi = cbiLearningAccess(route, has)
  if (cbi !== undefined) return cbi
  const cleanPath = route.split(/[?#]/)[0]
  const path = cleanPath === '/tool-shed/settings-location' ? '/tool-shed/preferences' : cleanPath
  const setting = INDIVIDUAL_SETTINGS.find(item => item.route === path || path.startsWith(item.route + '/'))
  return !setting || has(`${setting.scope}.view`)
}

/** Learning review is a business permission, separate from changing AI settings. */
export function cbiLearningAccess(route: string, has: (permission: string) => boolean): boolean | undefined {
  const path = route.split(/[?#]/)[0]
  if (path === '/tool-shed/ai/memory') return has('ai.use') && ['ai.learn.review', 'ai.learn.suggest'].some(has)
  if (path === '/tool-shed/ai/learning') return has('ai.use') && has('ai.learn.manage')
  if (path === '/tool-shed/ai/rules') return has('ai.use')
  return undefined
}
