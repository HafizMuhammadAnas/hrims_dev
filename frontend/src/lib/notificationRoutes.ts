import type { AuthUser } from '../types/auth'
import type { AppNotification } from '../types/notification'
import {
  isDepartmentAdmin,
  isNationalWorkflowAdmin,
  isRegionalAdmin,
  isSuperAdmin,
  isViewer,
} from './roles'

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key]
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

/**
 * Map stored notification routes to the correct portal detail page for the signed-in user.
 * Keeps legacy rows (list/module paths) working when opened from the bell or notifications page.
 */
export function resolveNotificationRoute(
  item: AppNotification,
  user: AuthUser | null | undefined,
): string | null {
  if (!user) return item.route

  const entityId = item.entity_id?.trim() || null
  const hrRequestId = metaString(item.meta ?? {}, 'hr_request_id')
  const federal = isSuperAdmin(user) || isNationalWorkflowAdmin(user)
  const regional = isRegionalAdmin(user)
  const department = isDepartmentAdmin(user) || isViewer(user)
  const ictDept = Boolean(
    user.department && (user.region?.slug === 'ict' || user.region?.slug === 'federal'),
  )

  if (item.entity_type === 'hr_request' && entityId) {
    if (regional) return `/requests/${encodeURIComponent(entityId)}?from=${encodeURIComponent('/region-received')}`
    if (department) {
      const from = ictDept ? '/federal-department-requests' : '/department-tasks'
      return `/requests/${encodeURIComponent(entityId)}?from=${encodeURIComponent(from)}`
    }
    return `/requests/${encodeURIComponent(entityId)}?from=${encodeURIComponent('/requests')}`
  }

  if (item.entity_type === 'regional_response' && entityId) {
    if (regional) {
      return `/regional-compilations/${encodeURIComponent(entityId)}?from=${encodeURIComponent('/region-history')}`
    }
    if (federal) {
      return `/regional-responses/${encodeURIComponent(entityId)}?from=${encodeURIComponent('/responses')}`
    }
  }

  if (item.entity_type === 'department_task' && entityId) {
    const requestId = hrRequestId
    if (requestId) {
      if (regional) {
        return `/requests/${encodeURIComponent(requestId)}?task=${encodeURIComponent(entityId)}&from=${encodeURIComponent('/region-monitoring')}`
      }
      if (department) {
        const from = ictDept ? '/federal-department-requests' : '/department-tasks'
        return `/requests/${encodeURIComponent(requestId)}?task=${encodeURIComponent(entityId)}&from=${encodeURIComponent(from)}`
      }
      if (federal) {
        return `/requests/${encodeURIComponent(requestId)}?task=${encodeURIComponent(entityId)}&from=${encodeURIComponent('/federal-department-requests')}`
      }
    }
  }

  if (item.entity_type === 'user' && entityId) {
    if (regional) return `/regional-users-mgmt/${encodeURIComponent(entityId)}/edit`
    if (federal) return `/federal-users-mgmt/${encodeURIComponent(entityId)}/edit`
  }

  // Legacy list/module paths → best detail/list for this portal
  const route = item.route ?? ''
  if (route === '/responses' || route.startsWith('/responses?')) {
    if (federal && entityId) {
      return `/regional-responses/${encodeURIComponent(entityId)}?from=${encodeURIComponent('/responses')}`
    }
    if (regional && entityId) {
      return `/regional-compilations/${encodeURIComponent(entityId)}?from=${encodeURIComponent('/region-history')}`
    }
  }
  if (route === '/department-tasks' || route.startsWith('/department-tasks?')) {
    if (hrRequestId && entityId) {
      const from = department && ictDept ? '/federal-department-requests' : '/department-tasks'
      if (department || regional || federal) {
        const taskFrom = regional ? '/region-monitoring' : federal && !department ? '/federal-department-requests' : from
        return `/requests/${encodeURIComponent(hrRequestId)}?task=${encodeURIComponent(entityId)}&from=${encodeURIComponent(taskFrom)}`
      }
    }
  }

  return item.route
}
