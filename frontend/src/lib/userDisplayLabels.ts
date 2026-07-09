import type { AuthUser } from '../types/auth'
import {
  isDepartmentAdmin,
  isFederalAdmin,
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

/** Primary role label for portal UI (e.g. regional_admin → "Punjab Admin"). */
export function formatPrimaryRoleLabel(user: AuthUser | null): string {
  const slug = primaryRoleSlug(user)
  if (!slug) return 'User'

  switch (slug) {
    case 'regional_admin': {
      const regionName = user?.region?.name?.trim()
      return regionName ? `${regionName} Admin` : 'Admin'
    }
    case 'federal_admin':
      return 'Federal Admin'
    case 'super_admin':
      return 'Super Admin'
    case 'department_admin':
      return 'Department Admin'
    case 'viewer':
      return 'Viewer'
    default:
      return slug.replace(/_/g, ' ')
  }
}

/** Header subtitle under the signed-in account name. */
export function accountPortalSubtitle(user: AuthUser): string {
  if (isSuperAdmin(user)) return 'System-wide access'
  if (isFederalAdmin(user)) return 'Federal workspace'
  if (isRegionalAdmin(user)) {
    const regionName = user.region?.name?.trim()
    return regionName ? `${regionName} Admin` : 'Admin portal'
  }
  if (isDepartmentAdmin(user)) return user.department?.name ?? 'Department workspace'
  if (isViewer(user)) return user.department?.name ?? user.region?.name ?? 'Read-only access'

  const role = primaryRoleSlug(user)
  return role?.replace(/_/g, ' ') ?? 'user'
}
