/** Encode list/page path for `?from=` on workflow detail routes. */
export function encodeWorkflowFrom(path: string): string {
  return encodeURIComponent(path || '/')
}

/** Human-readable back button label from `?from=` path. */
export function workflowBackLabel(from: string): string {
  const f = decodeURIComponent(from || '')
  if (f === '/' || f === '') return 'Back to dashboard'
  if (f.includes('region-received')) return 'Back to received requests'
  if (f.includes('region-history')) return 'Back to submission history'
  if (f.includes('department-history')) return 'Back to submission history'
  if (f.includes('department-tasks')) return 'Back to assigned tasks'
  if (f.includes('region-monitoring') || f.includes('federal-department-requests')) {
    return 'Back to departmental responses'
  }
  if (f.includes('region-compilation') || f.includes('federal-compilation')) {
    return 'Back to response compilation'
  }
  if (f.includes('compilation') && !f.includes('compiled-records')) return 'Back to compilation center'
  if (f.includes('compiled-records')) return 'Back to compiled records'
  if (f.includes('regional-responses')) return 'Back to regional responses'
  if (f.includes('requests/clarifications')) return 'Back to clarifications'
  if (f.includes('requests/new')) return 'Back to new request'
  if (f.includes('/edit')) return 'Back to list'
  if (f.includes('federal-users-mgmt') || f.includes('regional-users-mgmt')) return 'Back to users list'
  if (f.includes('federal-departments-mgmt') || f.includes('regional-departments-mgmt')) {
    return 'Back to departments list'
  }
  if (f.includes('catalog-mgmt/issues')) return 'Back to issues list'
  if (f.includes('catalog-mgmt/regions-districts')) return 'Back to regions & districts'
  if (f.includes('requests')) return 'Back to request management'
  if (f.includes('responses')) return 'Back to regional responses'
  if (f.includes('federal-history')) return 'Back to compiled responses'
  return 'Back'
}

/** Federal request list/detail from Request management (not regional-responses tab). */
export function isFederalRequestManagementView(from: string): boolean {
  const path = (from || '').split('?')[0].replace(/\/+$/, '') || '/'
  return path === '/requests'
}

export function hrRequestViewPath(requestId: string, from: string, taskId?: string | null): string {
  const q = new URLSearchParams()
  q.set('from', from)
  if (taskId) q.set('task', taskId)
  return `/requests/${encodeURIComponent(requestId)}?${q.toString()}`
}

export function hrRequestEditPath(requestId: string, from: string): string {
  return `/requests/${encodeURIComponent(requestId)}/edit?from=${encodeWorkflowFrom(from)}`
}

export function regionalResponseFederalReviewPath(responseId: string, from: string): string {
  return `/regional-responses/${encodeURIComponent(responseId)}?from=${encodeWorkflowFrom(from)}`
}

export function regionalCompilationViewPath(
  responseId: string,
  from: string,
  options?: { edit?: boolean },
): string {
  const q = new URLSearchParams()
  q.set('from', from)
  if (options?.edit) q.set('edit', '1')
  return `/regional-compilations/${encodeURIComponent(responseId)}?${q.toString()}`
}

export function compiledRecordViewPath(recordId: string, from: string): string {
  return `/compiled-records/${encodeURIComponent(recordId)}?from=${encodeWorkflowFrom(from)}`
}
