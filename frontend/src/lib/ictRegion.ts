import type { DepartmentTaskRow } from '../api/lists'

/** ICT replaced the former “federal” region slug in some datasets. */
export function isIctRegionSlug(slug: string | null | undefined): boolean {
  return slug === 'ict' || slug === 'federal'
}

export function isIctLineTask(t: DepartmentTaskRow): boolean {
  return isIctRegionSlug(t.region_slug ?? null)
}

export function isIctRegionalResponseRow(r: {
  region_slug?: string | null
  region_name?: string | null
}): boolean {
  if (isIctRegionSlug(r.region_slug ?? null)) return true
  const name = (r.region_name ?? '').trim().toLowerCase()
  return name === 'ict' || name === 'federal'
}

/** Department admin on the ICT / national-line (not a provincial region). */
export function isIctDepartmentPortalUser(
  user: { region?: { slug?: string | null } | null; department?: unknown } | null,
): boolean {
  return Boolean(user?.department != null && isIctRegionSlug(user.region?.slug ?? null))
}

export function reviewFeedbackLabelForTask(t: DepartmentTaskRow): string {
  return isIctLineTask(t) ? 'Federal review' : 'Regional review'
}
