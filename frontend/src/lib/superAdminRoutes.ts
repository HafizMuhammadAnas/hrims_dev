/**
 * Super-admin UI paths. Use `/catalog-mgmt` instead of `/admin` in the browser —
 * FortiGate on hrims.mohr.gov.pk blocks hard refresh (GET) on `/admin/*` (Attack ID 20000007).
 * API routes remain `/api/v1/admin/...`.
 */
export const SUPER_ADMIN_PREFIX = '/catalog-mgmt'

export const SUPER_ADMIN_ISSUES = `${SUPER_ADMIN_PREFIX}/issues`
export const SUPER_ADMIN_REGIONS_DISTRICTS = `${SUPER_ADMIN_PREFIX}/regions-districts`
export const SUPER_ADMIN_CONVENTIONS = `${SUPER_ADMIN_PREFIX}/conventions`
export const SUPER_ADMIN_GOVERNANCE_CHARTS = `${SUPER_ADMIN_PREFIX}/governance-charts`
export const SUPER_ADMIN_INDICATOR_WISE_DATA = `${SUPER_ADMIN_PREFIX}/indicator-wise-data`
export const SUPER_ADMIN_SDG_NODES = `${SUPER_ADMIN_PREFIX}/sdg-nodes`
export const SUPER_ADMIN_UPR_RECOMMENDATIONS = `${SUPER_ADMIN_PREFIX}/upr-recommendations`

export function superAdminConventionsNewPath(): string {
  return `${SUPER_ADMIN_CONVENTIONS}/new`
}

export function superAdminConventionEditPath(conventionId: number | string): string {
  return `${SUPER_ADMIN_CONVENTIONS}/${conventionId}/edit`
}

export function superAdminIssueViewPath(issueId: number): string {
  return `${SUPER_ADMIN_ISSUES}/view/${issueId}`
}

export function superAdminIssueEditPath(issueId: number): string {
  return `${SUPER_ADMIN_ISSUES}/edit/${issueId}`
}

export function superAdminArticleViewPath(articleId: number): string {
  return `${SUPER_ADMIN_ISSUES}/articles/view/${articleId}`
}

export function superAdminIssuesArticlesPath(): string {
  return `${SUPER_ADMIN_ISSUES}/articles`
}

export function superAdminRegionsDistrictsDistrictsPath(): string {
  return `${SUPER_ADMIN_REGIONS_DISTRICTS}/districts`
}

/** Client-side redirect from legacy `/admin/*` bookmarks (hard refresh on /admin still blocked by WAF). */
export function legacyAdminPathToCatalogMgmt(pathname: string, search = ''): string {
  if (!pathname.startsWith('/admin')) return pathname
  return pathname.replace(/^\/admin/, SUPER_ADMIN_PREFIX) + search
}
