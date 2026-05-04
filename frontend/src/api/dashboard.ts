export interface UrgentRequestRow {
  id: string
  title: string
  status: string
  date: string
  region_name: string | null
}

export interface MonthCountPoint {
  month: string
  label: string
  count: number
}

export interface DashboardSummary {
  hr_requests_total: number
  by_status: Record<string, number>
  urgent_requests: UrgentRequestRow[]
  requests_created_by_month: MonthCountPoint[]
  regional_responses_total?: number
  regional_responses_by_review?: Record<string, number>
  department_tasks_total?: number
  department_tasks_by_status?: Record<string, number>
  department_tasks_by_month?: MonthCountPoint[]
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
