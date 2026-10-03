import type { AuthUser } from '../types/auth'
import {
  isDepartmentAdmin,
  isDepartmentValidator,
  isFederalAdmin,
  isFederalSubAdmin,
  isRegionalAdmin,
  isSuperAdmin,
  isViewer,
  primaryRoleSlug,
} from './roles'

/** Portal account name — strips Super prefix and "Regional" before Admin titles. */
export function formatAccountDisplayName(name: string): string {
  return name
    .replace(/^Super\s+/i, '')
    .replace(/\s+Regional\s+(?=Admin(?:istrator)?\b)/i, ' ')
    .replace(/\bRegional\s+(Admin(?:istrator)?)\b/gi, '$1')
}

/** Display label for a role slug (keeps legacy slug department_admin in APIs/DB). */
export function formatRoleSlugLabel(slug: string | null | undefined): string {
  if (!slug) return 'User'
  switch (slug) {
    case 'regional_admin':
      return 'Regional administrator'
    case 'federal_admin':
      return 'Federal administrator'
    case 'federal_sub_admin':
      return 'Federal sub user'
    case 'super_admin':
      return 'Super administrator'
    case 'department_admin':
      return 'Departmental data entry operator'
    case 'department_validator':
      return 'Departmental validator'
    case 'viewer':
      return 'Viewer'
    default:
      return slug.replace(/_/g, ' ')
  }
}

/** Prefer mapped label for known slugs; fall back to API role name. */
export function formatRoleLabel(role: { slug: string; name?: string | null }): string {
  const mapped = formatRoleSlugLabel(role.slug)
  if (role.slug === 'department_admin' || role.slug === 'federal_sub_admin') return mapped
  const apiName = role.name?.trim()
  if (apiName && !/department(?:al)?\s+admin/i.test(apiName)) return apiName
  return mapped
}

export function formatUserRolesLabel(roles: Array<{ slug: string; name?: string | null }>): string {
  if (!roles.length) return '—'
  return roles.map((r) => formatRoleLabel(r)).join(', ')
}

/** Primary role label for portal UI (e.g. regional_admin → "Punjab Admin"). */
export function formatPrimaryRoleLabel(user: AuthUser | null): string {
  const slug = primaryRoleSlug(user)
  if (!slug) return 'User'

  if (slug === 'regional_admin') {
    const regionName = user?.region?.name?.trim()
    return regionName ? `${regionName} Admin` : 'Admin'
  }
  if (slug === 'federal_admin') return 'Federal Admin'
  if (slug === 'federal_sub_admin') return 'Federal sub user'
  if (slug === 'super_admin') return 'Super Admin'
  return formatRoleSlugLabel(slug)
}

/** Header subtitle under the signed-in account name. */
export function accountPortalSubtitle(user: AuthUser): string {
  if (isSuperAdmin(user)) return 'System-wide access'
  if (isFederalAdmin(user) || isFederalSubAdmin(user)) return 'Federal workspace'
  if (isRegionalAdmin(user)) {
    const regionName = user.region?.name?.trim()
    return regionName ? `${regionName} Admin` : 'Admin portal'
  }
  if (isDepartmentValidator(user)) return user.department?.name ?? 'Department validation'
  if (isDepartmentAdmin(user)) return user.department?.name ?? 'Department workspace'
  if (isViewer(user)) return user.department?.name ?? user.region?.name ?? 'Read-only access'

  const role = primaryRoleSlug(user)
  return role?.replace(/_/g, ' ') ?? 'user'
}
