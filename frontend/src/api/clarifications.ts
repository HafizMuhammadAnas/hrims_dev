import { apiJsonHeaders, apiMultipartHeaders, ensureCsrfCookie } from './client'
import { ApiError, parseApiErrorResponse } from './apiError'
import type { HrRequestRow } from '../types/hrRequest'
import type { StatusBadgeTone } from '../lib/statusBadgeTone'

export type ClarificationStatus = 'pending_federal' | 'pending_region' | 'closed'

export type ClarificationAttachment = {
  id: number
  side: 'region' | 'federal'
  original_name: string
  mime: string | null
  size: number | null
  url: string
}

export type HrRequestClarificationRow = {
  id: number
  hr_request_id: string
  region_id: number
  status: ClarificationStatus
  region_message: string
  federal_response: string | null
  region_submitted_at: string | null
  federal_responded_at: string | null
  created_at: string | null
  updated_at: string | null
  region_name?: string | null
  requested_by_name?: string | null
  responded_by_name?: string | null
  hr_request?: HrRequestRow | null
  attachments?: ClarificationAttachment[]
}

export const CLARIFICATION_STATUS_LABELS: Record<ClarificationStatus, string> = {
  pending_federal: 'Awaiting federal',
  pending_region: 'Awaiting region',
  closed: 'Closed',
}

export function clarificationStatusPresentation(status: ClarificationStatus): {
  label: string
  tone: StatusBadgeTone
} {
  if (status === 'pending_federal') {
    return { label: CLARIFICATION_STATUS_LABELS.pending_federal, tone: 'warning' }
  }
  if (status === 'pending_region') {
    return { label: CLARIFICATION_STATUS_LABELS.pending_region, tone: 'pending' }
  }
  return { label: CLARIFICATION_STATUS_LABELS.closed, tone: 'success' }
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
}

export async function fetchClarifications(params?: {
  status?: ClarificationStatus
  hr_request_id?: string
}): Promise<HrRequestClarificationRow[]> {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.hr_request_id) q.set('hr_request_id', params.hr_request_id)
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await fetch(`/api/v1/hr-request-clarifications${suffix}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestClarificationRow[] }
  return json.data ?? []
}

export async function fetchPendingFederalClarificationCount(): Promise<number> {
  const res = await fetch('/api/v1/hr-request-clarifications/pending-federal-count', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: { count: number } }
  return json.data?.count ?? 0
}

export async function fetchActiveClarificationForRequest(
  hrRequestId: string,
): Promise<HrRequestClarificationRow | null> {
  const res = await fetch(
    `/api/v1/hr-request-clarifications/for-request/${encodeURIComponent(hrRequestId)}`,
    {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  )
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestClarificationRow | null }
  return json.data ?? null
}

export async function fetchClarification(id: number): Promise<HrRequestClarificationRow> {
  const res = await fetch(`/api/v1/hr-request-clarifications/${id}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestClarificationRow }
  return json.data
}

export async function submitClarificationRequest(
  hrRequestId: string,
  regionMessage: string,
  attachment?: File | null,
): Promise<HrRequestClarificationRow> {
  await ensureCsrfCookie()
  const form = new FormData()
  form.append('hr_request_id', hrRequestId)
  form.append('region_message', regionMessage)
  if (attachment) form.append('attachment', attachment)
  const res = await fetch('/api/v1/hr-request-clarifications', {
    method: 'POST',
    credentials: 'include',
    headers: apiMultipartHeaders(),
    body: form,
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestClarificationRow }
  return json.data
}

export async function respondToClarification(
  id: number,
  federalResponse: string,
  attachment?: File | null,
): Promise<HrRequestClarificationRow> {
  await ensureCsrfCookie()
  const form = new FormData()
  form.append('federal_response', federalResponse)
  if (attachment) form.append('attachment', attachment)
  const res = await fetch(`/api/v1/hr-request-clarifications/${id}/respond`, {
    method: 'POST',
    credentials: 'include',
    headers: apiMultipartHeaders(),
    body: form,
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestClarificationRow }
  return json.data
}

export async function closeClarification(id: number): Promise<HrRequestClarificationRow> {
  await ensureCsrfCookie()
  const res = await fetch(`/api/v1/hr-request-clarifications/${id}/close`, {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify({}),
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestClarificationRow }
  return json.data
}
