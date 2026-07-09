import { LABEL_CREATE_DEPARTMENT, LABEL_DEPARTMENTS_LIST } from './uiLabels'

const DEPT_EDIT_PATH = /\/(\d+)\/edit\/?$/

export type DepartmentsMgmtView = 'list' | 'new' | 'edit'

export function departmentsMgmtBasePath(
  pathname: string,
): '/federal-departments-mgmt' | '/regional-departments-mgmt' {
  return pathname.includes('/regional-departments-mgmt')
    ? '/regional-departments-mgmt'
    : '/federal-departments-mgmt'
}

export function resolveDepartmentsMgmtView(pathname: string): DepartmentsMgmtView {
  if (DEPT_EDIT_PATH.test(pathname)) return 'edit'
  if (pathname.endsWith('/new')) return 'new'
  return 'list'
}

export function departmentsMgmtEditId(pathname: string): number | null {
  const m = pathname.match(DEPT_EDIT_PATH)
  return m ? Number(m[1]) : null
}

export function departmentsMgmtEditPath(
  basePath: '/federal-departments-mgmt' | '/regional-departments-mgmt',
  departmentId: number,
): string {
  return `${basePath}/${departmentId}/edit`
}

export function departmentsMgmtTabs(
  basePath: '/federal-departments-mgmt' | '/regional-departments-mgmt',
) {
  return [
    { view: 'list' as const, to: basePath, label: LABEL_DEPARTMENTS_LIST, end: true },
    { view: 'new' as const, to: `${basePath}/new`, label: LABEL_CREATE_DEPARTMENT },
  ]
}
