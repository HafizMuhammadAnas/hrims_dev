import { ApiError, parseApiErrorResponse } from './apiError'

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
}

export type ActivityLogRow = {
  id: number
  user_id: number | null
  username: string | null
  user_name: string | null
  action: 'login' | 'logout' | 'download' | string
  file_name: string | null
  file_type: string | null
  source: string | null
  ip_address: string | null
  created_at: string | null
}

export type ActivityLogListMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export type ActivityLogFilters = {
  action?: '' | 'login' | 'logout' | 'download'
  q?: string
  from?: string
  to?: string
  page?: number
  per_page?: number
}

export async function adminFetchActivityLogs(
  filters: ActivityLogFilters = {},
): Promise<{ data: ActivityLogRow[]; meta: ActivityLogListMeta }> {
  const params = new URLSearchParams()
  if (filters.action) params.set('action', filters.action)
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.per_page) params.set('per_page', String(filters.per_page))

  const qs = params.toString()
  const res = await fetch(`/api/v1/admin/activity-logs${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  return (await res.json()) as { data: ActivityLogRow[]; meta: ActivityLogListMeta }
}
