import type { DepartmentTaskRow } from '../api/lists'
import {
  departmentTaskWorkflowBucket,
  type DepartmentTaskWorkflowBucket,
} from './departmentTaskWorkflow'
import { pickActivityTimestamp, sortRowsLatestFirst } from './tableRowSort'

export const WORKFLOW_BUCKET_FILTER_OPTIONS: { value: DepartmentTaskWorkflowBucket | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'in_process', label: 'Pending' },
  { value: 'responded', label: 'Under Review' },
  { value: 'revision', label: 'Revision' },
  { value: 'accepted', label: 'Accepted' },
]

export function departmentTaskMatchesWorkflowFilter(
  task: DepartmentTaskRow,
  workflowFilter: string,
): boolean {
  if (!workflowFilter) return true
  return departmentTaskWorkflowBucket(task) === workflowFilter
}

export function filterDepartmentTasks(
  tasks: DepartmentTaskRow[],
  options: { search: string; workflowFilter: string; reqIdFilter?: string },
): DepartmentTaskRow[] {
  const q = options.search.trim().toLowerCase()
  const filtered = tasks.filter((t) => {
    if (options.reqIdFilter && t.req_id !== options.reqIdFilter) return false
    if (!departmentTaskMatchesWorkflowFilter(t, options.workflowFilter)) return false
    if (!q) return true
    return (
      t.id.toLowerCase().includes(q) ||
      t.req_id.toLowerCase().includes(q) ||
      String(t.department_name ?? t.department_id).toLowerCase().includes(q) ||
      (t.region_name ?? '').toLowerCase().includes(q)
    )
  })
  return sortRowsLatestFirst(filtered, (t) =>
    pickActivityTimestamp(t.assigned_date, t.submission_date, t.id),
  )
}
