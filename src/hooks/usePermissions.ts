import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { readSnapshot, writeSnapshot } from '@/lib/snapshots'

/**
 * usePermissions — current user's effective permissions, cached for the session.
 *
 * Returns:
 *   - has(key)             check a single permission
 *   - hasAny([...])        check if any of the keys match
 *   - role_slug            'owner' / 'admin' / 'dispatcher' / 'office' / 'tech' / 'viewer'
 *   - isPlatformAdmin      bypass flag — always treated as full grant
 *   - isLoading            true on first load
 *
 * Cached for 5 minutes by default; invalidated on role changes by the
 * Roles & Permissions page after save.
 *
 * Designed as a single source of truth for nav gating, button visibility,
 * and page-level guards. Backend still enforces — this is UX.
 */
export interface PermissionsResponse {
  data: {
    account_id: string | null
    role_slug: string | null
    is_platform_admin: boolean
    permissions: string[]
    data_scopes: Record<string, 'all' | 'own'>
    catalog: string[]
    // Platform/management role + capabilities (empty for tenant users).
    platform_role?: string | null
    platform_capabilities?: string[]
  }
}

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'permissions'],
    queryFn: async () => {
      const res = await apiRequest<PermissionsResponse>('/v1/me/permissions')
      writeSnapshot('permissions', res)
      return res
    },
    staleTime: 5 * 60 * 1000,  // 5 min
    // First frame uses the last-known answer so gated nav items don't pop in
    // a beat after the page paints; the fetch replaces it silently.
    placeholderData: () => readSnapshot<PermissionsResponse>('permissions'),
  })

  const isPlatformAdmin = !!data?.data?.is_platform_admin
  const permissions = data?.data?.permissions ?? []
  const dataScopes = data?.data?.data_scopes ?? {}
  const permSet = new Set(permissions)

  function has(key: string): boolean {
    if (isPlatformAdmin) return true
    return permSet.has(key)
  }

  function hasAny(keys: string[]): boolean {
    if (isPlatformAdmin) return true
    return keys.some((k) => permSet.has(k))
  }

  function hasAll(keys: string[]): boolean {
    if (isPlatformAdmin) return true
    return keys.every((k) => permSet.has(k))
  }

  /**
   * Data scope for an entity: 'all' | 'own'. Defaults to 'all' (least
   * surprising — readers see everything unless the role narrows them).
   */
  function scope(entity: string): 'all' | 'own' {
    if (isPlatformAdmin) return 'all'
    return dataScopes[entity] ?? 'all'
  }

  return {
    has,
    hasAny,
    hasAll,
    scope,
    accountId: data?.data?.account_id ?? null,
    role_slug: data?.data?.role_slug ?? null,
    isPlatformAdmin,
    permissions,
    isLoading,
    // Platform/management capabilities (for the /admin console).
    platformRole: data?.data?.platform_role ?? null,
    platformCapabilities: data?.data?.platform_capabilities ?? [],
    hasPlatform: (cap: string): boolean =>
      (data?.data?.platform_capabilities ?? []).includes(cap),
  }
}

/** Centralized permission keys — mirrors App\Auth\Permissions::ALL. */
export const PERM = {
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_EDIT: 'customers.edit',
  CALLS_VIEW: 'calls.view',
  CUSTOMER_SECURE_FILES_LIST: 'customers.secure_files.list',
  CUSTOMER_SECURE_FILES_REQUEST_ACCESS: 'customers.secure_files.request_access',
  CUSTOMER_SECURE_FILES_VERIFY_ACCESS: 'customers.secure_files.verify_access',
  CUSTOMER_SECURE_FILES_VIEW: 'customers.secure_files.view',
  CUSTOMER_SECURE_FILES_DOWNLOAD: 'customers.secure_files.download',
  CUSTOMER_SECURE_FILES_CREATE: 'customers.secure_files.create',
  CUSTOMER_SECURE_FILES_UPLOAD: 'customers.secure_files.upload',
  CUSTOMER_SECURE_FILES_DELETE: 'customers.secure_files.delete',
  CUSTOMER_SECURE_FILES_AUDIT: 'customers.secure_files.audit',
  CUSTOMER_SECURE_FILES_MANAGE: 'customers.secure_files.manage',
  COMPANY_SECURE_FILES_LIST: 'company.secure_files.list',
  COMPANY_SECURE_FILES_REQUEST_ACCESS: 'company.secure_files.request_access',
  COMPANY_SECURE_FILES_VERIFY_ACCESS: 'company.secure_files.verify_access',
  COMPANY_SECURE_FILES_VIEW: 'company.secure_files.view',
  COMPANY_SECURE_FILES_DOWNLOAD: 'company.secure_files.download',
  COMPANY_SECURE_FILES_CREATE: 'company.secure_files.create',
  COMPANY_SECURE_FILES_UPLOAD: 'company.secure_files.upload',
  COMPANY_SECURE_FILES_DELETE: 'company.secure_files.delete',
  COMPANY_SECURE_FILES_AUDIT: 'company.secure_files.audit',
  COMPANY_SECURE_FILES_MANAGE: 'company.secure_files.manage',
  JOBS_VIEW: 'jobs.view',
  JOBS_EDIT: 'jobs.edit',
  TASKS_VIEW: 'tasks.view',
  TASKS_EDIT: 'tasks.edit',
  INVOICES_VIEW: 'invoices.view',
  INVOICES_EDIT: 'invoices.edit',
  REVENUE_VIEW: 'revenue.view',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_EDIT: 'inventory.edit',
  CATALOG_VIEW: 'catalog.view',
  CATALOG_EDIT: 'catalog.edit',
  PARTS_IDENTIFY_WITH_AI: 'parts.identify_with_ai',
  PARTS_CONFIRM_AI_MATCH: 'parts.confirm_ai_match',
  PARTS_ADD_TO_JOB: 'parts.add_to_job',
  ASSETS_VIEW: 'assets.view',
  ASSETS_EDIT: 'assets.edit',
  WARRANTIES_VIEW: 'warranties.view',
  WARRANTIES_EDIT: 'warranties.edit',
  TEMPLATES_VIEW: 'templates.view',
  TEMPLATES_EDIT: 'templates.edit',
  STAFF_VIEW: 'staff.view',
  STAFF_EDIT: 'staff.edit',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  AI_USE: 'ai.use',
  MOBILE_ACCESS: 'mobile.access',
} as const
