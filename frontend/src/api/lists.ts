import { ApiError, parseApiErrorResponse } from './apiError'

async function getData<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
  return (await res.json()) as T
}

export type RegionalResponseRow = {
  id: string
  req_id: string
  region_id?: number | null
  region_slug?: string | null
  region_name: string | null
  title: string
  submission_date: string
  review_status: string
  comments: string | null
  content: string
}

export async function fetchRegionalResponses(): Promise<RegionalResponseRow[]> {
  const j = await getData<{ data: RegionalResponseRow[] }>('/api/v1/regional-responses')
  return j.data
}

export type CompiledRecordRow = {
  id: string
  req_id: string | null
  title: string
  region_names: string[]
  compilation_date: string | null
  status: string
  submitted_to?: string | null
  submission_date?: string | null
  attachment?: string | null
  summary?: string | null
}

export async function fetchCompiledRecords(): Promise<CompiledRecordRow[]> {
  const j = await getData<{ data: CompiledRecordRow[] }>('/api/v1/compiled-records')
  return j.data
}

export type DepartmentTaskRow = {
  id: string
  req_id: string
  region_id: number
  /** Present when API includes it; used to detect ICT / national-line tasks. */
  region_slug?: string | null
  region_name: string | null
  department_id: string
  department_name: string | null
  status: string
  regional_review_status?: string | null
  regional_review_comments?: string | null
  assigned_date: string
  assignment_instructions?: string | null
  /** Issue indicator IDs this department must respond to; null/omitted = full request scope (legacy). */
  assigned_indicator_ids?: number[] | null
  submission_date?: string | null
  response_data?: string | null
  attachment_url?: string | null
}

export async function fetchDepartmentTasks(options?: {
  /** Federal/national dashboards: include all regions (not only ICT). Ignored for regional users. */
  scope?: 'all' | 'national'
}): Promise<DepartmentTaskRow[]> {
  const qs =
    options?.scope === 'all' || options?.scope === 'national'
      ? '?scope=all'
      : ''
  const j = await getData<{ data: DepartmentTaskRow[] }>(`/api/v1/department-tasks${qs}`)
  return j.data
}

/** Public: active default (mode 2) governance charts configured by Super Admin. */
export type GovernanceDefaultChartRow = {
  id: number
  sort_order: number
  kind: 'trend' | 'comparison' | 'dimension_totals'
  title: string
  shape: 'line' | 'bar' | 'area' | 'step' | 'pie' | 'composed'
  series_a_key: string
  series_a_label: string
  series_a_indicator_id: number | null
  series_a_indicator_text: string | null
  series_b_key: string | null
  series_b_label: string | null
  series_b_indicator_id: number | null
  series_b_indicator_text: string | null
  is_active: boolean
}

export async function fetchGovernanceDefaultCharts(): Promise<GovernanceDefaultChartRow[]> {
  const j = await getData<{ data: GovernanceDefaultChartRow[] }>('/api/v1/governance/default-charts')
  return j.data
}

/** Provincial department tasks for federal review of a regional compilation. */
export async function fetchRegionalResponseDepartmentTasks(
  regionalResponseId: string,
): Promise<DepartmentTaskRow[]> {
  const j = await getData<{ data: DepartmentTaskRow[] }>(
    `/api/v1/regional-responses/${encodeURIComponent(regionalResponseId)}/department-tasks`,
  )
  return j.data
}

export type ViolationRow = {
  id: string
  entry_number: string
  title: string
  region_name: string | null
  event_date: string
  monitoring_status: string
}

export async function fetchViolationEntries(): Promise<ViolationRow[]> {
  const j = await getData<{ data: ViolationRow[] }>('/api/v1/violation-entries')
  return j.data
}
