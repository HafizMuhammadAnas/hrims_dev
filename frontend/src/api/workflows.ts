import { apiJsonHeaders, ensureCsrfCookie } from './client'
import { ApiError, parseApiErrorResponse } from './apiError'
import type { DepartmentTaskRow, RegionalResponseRow } from './lists'

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
}

export type DepartmentRow = {
  id: number
  code: string | null
  name: string
  type: string | null
  region_id: number | null
  region_ids?: number[]
  region_slug?: string | null
  region_name?: string | null
}

export async function fetchDepartments(): Promise<DepartmentRow[]> {
  const res = await fetch('/api/v1/departments', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: DepartmentRow[] }
  return json.data
}

export async function createDepartmentTask(
  hr_request_id: string,
  department_id: number,
): Promise<DepartmentTaskRow> {
  await ensureCsrfCookie()
  const res = await fetch('/api/v1/department-tasks', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify({ hr_request_id, department_id }),
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: DepartmentTaskRow }
  return json.data
}

export async function createRegionalResponse(body: {
  hr_request_id: string
  title: string
  content: string
  federal_group_id?: string | null
}): Promise<RegionalResponseRow> {
  await ensureCsrfCookie()
  const res = await fetch('/api/v1/regional-responses', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: RegionalResponseRow }
  return json.data
}

export async function updateRegionalReview(
  id: string,
  review_status: 'pending' | 'accepted' | 'needs-modification' | 'rejected',
  comments: string,
): Promise<RegionalResponseRow> {
  await ensureCsrfCookie()
  const res = await fetch(`/api/v1/regional-responses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify({ review_status, comments }),
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: RegionalResponseRow }
  return json.data
}

export type CompilationPreview = {
  region_names: string[]
  response_count: number
}

export async function fetchCompilationPreview(
  federal_group_id: string,
): Promise<CompilationPreview> {
  const url = `/api/v1/compiled-records/preview?federal_group_id=${encodeURIComponent(federal_group_id)}`
  const res = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: CompilationPreview }
  return json.data
}

export async function createCompiledRecord(body: {
  federal_group_id: string
  title: string
  region_names: string[]
  summary?: string | null
  status: 'draft' | 'submitted'
  submitted_to?: string | null
}) {
  await ensureCsrfCookie()
  const res = await fetch('/api/v1/compiled-records', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)
  return (await res.json()) as { data: unknown }
}
