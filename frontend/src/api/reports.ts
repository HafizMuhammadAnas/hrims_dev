import { ApiError, parseApiErrorResponse } from './apiError'

export type ReportLookupConvention = {
  id: number
  code: string
  name: string
}

export type ReportLookupCategory = {
  id: number
  name: string
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
  return (await res.json()) as T
}

export async function fetchReportConventions(): Promise<ReportLookupConvention[]> {
  const json = await getJson<{ data: ReportLookupConvention[] }>('/api/v1/report-form/conventions')
  return json.data
}

export async function fetchReportIssueCategories(): Promise<ReportLookupCategory[]> {
  const json = await getJson<{ data: ReportLookupCategory[] }>('/api/v1/report-form/issue-categories')
  return json.data
}
