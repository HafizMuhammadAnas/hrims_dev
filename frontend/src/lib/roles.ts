import type { AuthUser } from '../types/auth'

export function primaryRoleSlug(user: AuthUser | null): string | null {
  return user?.roles?.[0]?.slug ?? null
}

export function hasRole(user: AuthUser | null, slug: string): boolean {
  return user?.roles.some((r) => r.slug === slug) ?? false
}

export function isSuperAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'super_admin')
}

export function isFederalAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'federal_admin')
}

export function isConventionAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'convention_admin')
}

/** Federal-style national workflow operators (federal + convention portals). */
export function isNationalWorkflowAdmin(user: AuthUser | null): boolean {
  return isFederalAdmin(user) || isConventionAdmin(user)
}

export function isRegionalAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'regional_admin')
}

export function isDepartmentAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'department_admin')
}

export function isViewer(user: AuthUser | null): boolean {
  return hasRole(user, 'viewer')
}
