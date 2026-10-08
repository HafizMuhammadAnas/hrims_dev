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

export function isFederalSubAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'federal_sub_admin')
}

/** Federal operational access (full admin or sub-admin). */
export function isFederalStaff(user: AuthUser | null): boolean {
  return isFederalAdmin(user) || isFederalSubAdmin(user)
}

export function isRegionalAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'regional_admin')
}

/** Departmental administrator (slug department_admin). */
export function isDepartmentAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'department_admin')
}

/** Department workspace (admin). */
export function isDepartmentStaff(user: AuthUser | null): boolean {
  return isDepartmentAdmin(user)
}

export function isViewer(user: AuthUser | null): boolean {
  return hasRole(user, 'viewer')
}
