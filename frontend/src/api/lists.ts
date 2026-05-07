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
  region_name: string | null
  department_id: string
  department_name: string | null
  status: string
  regional_review_status?: string | null
  regional_review_comments?: string | null
  assigned_date: string
  submission_date?: string | null
  response_data?: string | null
  attachment_url?: string | null
}

export async function fetchDepartmentTasks(): Promise<DepartmentTaskRow[]> {
  const j = await getData<{ data: DepartmentTaskRow[] }>('/api/v1/department-tasks')
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
