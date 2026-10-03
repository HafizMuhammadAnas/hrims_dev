export interface UrgentRequestRow {
  id: string
  title: string
  status: string
  date: string
  region_name: string | null
}

/** Open department tasks needing action (assigned or regional revision). */
export interface UrgentDepartmentTaskRow {
  task_id: string
  id: string
  title: string
  status: string
  date: string | null
  region_name: string | null
}

export interface MonthCountPoint {
  month: string
  label: string
  count: number
}

export interface DueDateAlertRow {
  id: string
  title: string
  date: string | null
  urgency: 'overdue' | 'due_today' | 'due_soon' | string
  region_name: string | null
  kind: 'request' | 'department_task' | string
  department_name?: string | null
}

export interface DashboardSummary {
  hr_requests_total: number
  by_status: Record<string, number>
  urgent_requests: UrgentRequestRow[]
  /** Recent in-scope HR requests (not limited to overdue / draft). */
  recent_requests?: UrgentRequestRow[]
  /** Overdue or due within 7 days — federal & regional dashboards. */
  due_date_alerts?: DueDateAlertRow[]
  requests_created_by_month: MonthCountPoint[]
  regional_responses_total?: number
  regional_responses_by_review?: Record<string, number>
  /** Assigned provinces (ICT excluded) that have not submitted a compilation yet. */
  regional_responses_pending_submission?: number
  compiled_records_total?: number
  hr_requests_pending_federal?: number
  clarifications_pending_federal?: number
  department_tasks_total?: number
  department_tasks_by_status?: Record<string, number>
  /** Pending / Pending Validation / Validator Revision / Under Review / Regional Revision / Accepted */
  department_tasks_by_workflow?: {
    in_process: number
    pending_validation?: number
    validator_revision?: number
    responded: number
    revision: number
    accepted: number
  }
  department_tasks_by_month?: MonthCountPoint[]
  urgent_department_tasks?: UrgentDepartmentTaskRow[]
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch('/api/v1/dashboard/summary', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Failed to load dashboard (${res.status})`)
  }
  const json = (await res.json()) as { data: DashboardSummary }
  return json.data
}
