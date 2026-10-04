/** Individual access choices shared by staff controls and every Connect directory. */
export const INDIVIDUAL_SETTINGS = [
  { scope: 'settings_modules', label: 'Modules', route: '/tool-shed/modules' },
  { scope: 'settings_warranty', label: 'Warranty settings', route: '/tool-shed/warranty-settings' },
  { scope: 'settings_company', label: 'Company Info', route: '/tool-shed/company-info' },
  { scope: 'settings_preferences', label: 'Shop Rules', route: '/tool-shed/preferences' },
] as const

export function canViewSetting(route: string, has: (permission: string) => boolean): boolean {
  const cleanPath = route.split(/[?#]/)[0]
  const path = cleanPath === '/tool-shed/settings-location' ? '/tool-shed/preferences' : cleanPath
  const setting = INDIVIDUAL_SETTINGS.find(item => item.route === path || path.startsWith(item.route + '/'))
  return !setting || has(`${setting.scope}.view`)
}
