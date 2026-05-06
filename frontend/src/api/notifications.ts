import { ApiError, parseApiErrorResponse } from './apiError'
import { apiJsonHeaders, ensureCsrfCookie } from './client'
import type { NotificationListResponse } from '../types/notification'

export async function fetchNotifications(limit = 10): Promise<NotificationListResponse> {
  const res = await fetch(`/api/v1/notifications?limit=${limit}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new ApiError(await parseApiErrorResponse(res))
  }
  return (await res.json()) as NotificationListResponse
}

export async function markNotificationRead(id: number): Promise<void> {
  await ensureCsrfCookie()
  const res = await fetch(`/api/v1/notifications/${id}/read`, {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
  })
  if (!res.ok) {
    throw new ApiError(await parseApiErrorResponse(res))
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  await ensureCsrfCookie()
  const res = await fetch('/api/v1/notifications/read-all', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
  })
  if (!res.ok) {
    throw new ApiError(await parseApiErrorResponse(res))
  }
}
