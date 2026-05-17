const USER_EDIT_PATH = /\/(\d+)\/edit\/?$/

export type UsersMgmtView = 'list' | 'new' | 'edit'

export function usersMgmtBasePath(pathname: string): '/federal-users-mgmt' | '/regional-users-mgmt' {
  return pathname.includes('/regional-users-mgmt') ? '/regional-users-mgmt' : '/federal-users-mgmt'
}

export function resolveUsersMgmtView(pathname: string): UsersMgmtView {
  if (USER_EDIT_PATH.test(pathname)) return 'edit'
  if (pathname.endsWith('/new')) return 'new'
  return 'list'
}

export function usersMgmtEditUserId(pathname: string): number | null {
  const m = pathname.match(USER_EDIT_PATH)
  return m ? Number(m[1]) : null
}

export function usersMgmtEditPath(
  basePath: '/federal-users-mgmt' | '/regional-users-mgmt',
  userId: number,
): string {
  return `${basePath}/${userId}/edit`
}

export function usersMgmtTabs(basePath: '/federal-users-mgmt' | '/regional-users-mgmt', createLabel: string) {
  return [
    { view: 'list' as const, to: basePath, label: 'Users list', end: true },
    { view: 'new' as const, to: `${basePath}/new`, label: createLabel },
  ]
}
