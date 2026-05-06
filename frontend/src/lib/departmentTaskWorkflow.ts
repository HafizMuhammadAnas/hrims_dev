import type { DepartmentTaskRow } from '../api/lists'

export function hasDepartmentResponse(t: DepartmentTaskRow): boolean {
  return Boolean(t.submission_date) || t.status === 'submitted'
}

/** Mutually exclusive buckets for a distributed department task. */
export type DepartmentTaskWorkflowBucket = 'in_process' | 'responded' | 'revision' | 'accepted'

export function departmentTaskWorkflowBucket(t: DepartmentTaskRow): DepartmentTaskWorkflowBucket {
  if (!hasDepartmentResponse(t)) return 'in_process'
  if (t.regional_review_status === 'needs-modification') return 'revision'
  if (t.regional_review_status === 'accepted') return 'accepted'
  return 'responded'
}

export function countDepartmentTasksByWorkflow(
  tasks: DepartmentTaskRow[],
): Record<DepartmentTaskWorkflowBucket, number> {
  const counts: Record<DepartmentTaskWorkflowBucket, number> = {
    in_process: 0,
    responded: 0,
    revision: 0,
    accepted: 0,
  }
  for (const t of tasks) {
    counts[departmentTaskWorkflowBucket(t)]++
  }
  return counts
}

export function workflowPresentation(t: DepartmentTaskRow): {
  label: string
  tone: 'pending' | 'success' | 'warning' | 'danger' | 'default'
} {
  const b = departmentTaskWorkflowBucket(t)
  if (b === 'in_process') return { label: 'In process', tone: 'pending' }
  if (b === 'revision') return { label: 'Revision', tone: 'warning' }
  if (b === 'accepted') return { label: 'Responded · Accepted', tone: 'success' }
  return { label: 'Responded', tone: 'default' }
}
