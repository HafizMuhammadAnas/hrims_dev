import type { AuthUser } from '../types/auth'

export function canManageHrRequests(user: AuthUser | null): boolean {
  if (!user) return false
  return user.roles.some(
    (r) => r.slug === 'federal_admin' || r.slug === 'regional_admin',
  )
}

/** Regional admins keep requests in their assigned region; federal users have no lock. */
export function hrRequestLockedRegionId(user: AuthUser | null): number | null {
  if (!user) return null
  const isRegional = user.roles.some((r) => r.slug === 'regional_admin')
  if (!isRegional) return null
  return user.region?.id ?? null
}
