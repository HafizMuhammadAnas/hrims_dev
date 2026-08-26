import { apiJsonHeaders, apiMultipartHeaders, ensureCsrfCookie } from './client'
import { ApiError, parseApiErrorResponse } from './apiError'
import type { HrRequestIssueDetail, HrRequestRow, HrRequestType } from '../types/hrRequest'
import type { HrReportingFramework } from '../lib/hrRequestReportingFramework'
import { coerceHrRequestStatus } from '../types/hrRequest'

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
}

function withCoercedStatus(row: HrRequestRow): HrRequestRow {
  return { ...row, status: coerceHrRequestStatus(row.status) }
}

export type KnowledgeConventionRow = {
  id: number
  code: string
  name: string
}

export async function fetchKnowledgeConventions(): Promise<KnowledgeConventionRow[]> {
  const res = await fetch('/api/v1/knowledge/conventions', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: KnowledgeConventionRow[] }
  return json.data
}

/** Full convention catalog for HR request create/edit (not limited to knowledge-hub `is_active`). */
export async function fetchHrRequestFormConventions(): Promise<KnowledgeConventionRow[]> {
  const res = await fetch('/api/v1/hr-request-form/conventions', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: KnowledgeConventionRow[] }
  return json.data
}

export async function fetchHrRequestFormIssues(
  conventionId: number,
): Promise<HrRequestFormIssuesResult> {
  const q = new URLSearchParams({ convention_id: String(conventionId) })
  const res = await fetch(`/api/v1/hr-request-form/issues?${q}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as {
    data: HrRequestIssueDetail[]
    meta?: { collection_years?: HrRequestFormCollectionYear[] }
  }
  return {
    issues: json.data,
    collectionYears: json.meta?.collection_years ?? [],
  }
}

export type FederalDepartmentOption = {
  id: number
  code: string
  name: string
}

export async function fetchHrRequestFormFederalDepartments(): Promise<FederalDepartmentOption[]> {
  const res = await fetch('/api/v1/hr-request-form/federal-departments', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: FederalDepartmentOption[] }
  return json.data
}

export async function fetchHrRequests(): Promise<HrRequestRow[]> {
  const res = await fetch('/api/v1/hr-requests', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestRow[] }
  return json.data.map(withCoercedStatus)
}

export async function fetchHrRequest(id: string): Promise<HrRequestRow> {
  const res = await fetch(`/api/v1/hr-requests/${encodeURIComponent(id)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestRow }
  return withCoercedStatus(json.data)
}

export type HrRequestIndicatorResponseInput = {
  issue_indicator_id: number
  quantitative_value?: number | null
  qualitative_text?: string | null
  quantitative_year_ids?: number[]
  qualitative_year_ids?: number[]
}

export type HrRequestFormCollectionYear = {
  id: number
  label: string
}

export type HrRequestFormIssuesResult = {
  issues: HrRequestIssueDetail[]
  collectionYears: HrRequestFormCollectionYear[]
}

export type HrRequestCreateFromIssueFormInput = {
  title: string
  reporting_framework: HrReportingFramework
  /** Required for treaty body; optional primary for Other Issues. */
  convention_id?: number | null
  /** Other Issues: optional multi-select. Treaty body: omit or send the single id. */
  convention_ids?: number[]
  request_type: HrRequestType
  issue_id?: number | null
  other_issue_text?: string | null
  upr?: string | null
  upr_indicator?: string | null
  date: string
  status: HrRequestRow['status']
  details?: string | null
  region_ids: number[]
  department_ids: number[]
  indicator_responses: HrRequestIndicatorResponseInput[]
  attachments: File[]
}

export async function createHrRequestFromIssueForm(
  input: HrRequestCreateFromIssueFormInput,
): Promise<HrRequestRow> {
  await ensureCsrfCookie()
  const fd = new FormData()
  fd.append('title', input.title)
  fd.append('reporting_framework', input.reporting_framework)
  if (input.convention_id != null) {
    fd.append('convention_id', String(input.convention_id))
  }
  for (const cid of input.convention_ids ?? []) {
    fd.append('convention_ids[]', String(cid))
  }
  fd.append('request_type', input.request_type)
  if (input.issue_id != null) fd.append('issue_id', String(input.issue_id))
  if (input.other_issue_text?.trim()) fd.append('other_issue_text', input.other_issue_text.trim())
  if (input.upr?.trim()) fd.append('upr', input.upr.trim())
  if (input.upr_indicator?.trim()) fd.append('upr_indicator', input.upr_indicator.trim())
  fd.append('date', input.date)
  fd.append('status', input.status)
  if (input.details != null && input.details !== '') {
    fd.append('details', input.details)
  }
  for (const rid of input.region_ids) {
    fd.append('region_ids[]', String(rid))
  }
  for (const did of input.department_ids) {
    fd.append('department_ids[]', String(did))
  }
  if (input.indicator_responses.length > 0) {
    fd.append('indicator_responses', JSON.stringify(input.indicator_responses))
  }
  for (const file of input.attachments) {
    fd.append('attachments[]', file)
  }

  const res = await fetch('/api/v1/hr-requests', {
    method: 'POST',
    credentials: 'include',
    headers: apiMultipartHeaders(),
    body: fd,
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestRow }
  return withCoercedStatus(json.data)
}

/** @deprecated Legacy JSON create (tests / old clients). Prefer `createHrRequestFromIssueForm`. */
export type HrRequestWriteBody = {
  id?: string
  title: string
  conv: string
  region_id: number | null
  date: string
  status: HrRequestRow['status']
  details?: string | null
  attachment_file_name?: string | null
  recommendation_id?: string | null
  sdg?: string | null
  sdg_indicator?: string | null
  upr?: string | null
  upr_indicator?: string | null
  issue_cards?: unknown
}

export async function createHrRequest(body: HrRequestWriteBody & { id: string }): Promise<HrRequestRow> {
  await ensureCsrfCookie()
  const res = await fetch('/api/v1/hr-requests', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify({
      ...body,
      recommendation_id: body.recommendation_id || null,
      details: body.details ?? null,
      attachment_file_name: body.attachment_file_name || null,
      sdg: body.sdg || null,
      sdg_indicator: body.sdg_indicator || null,
      upr: body.upr || null,
      upr_indicator: body.upr_indicator || null,
    }),
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestRow }
  return withCoercedStatus(json.data)
}

export type HrRequestPatchBody = {
  title?: string
  conv?: string
  convention_id?: number
  reporting_framework?: HrReportingFramework
  request_type?: HrRequestType
  issue_id?: number | null
  other_issue_text?: string | null
  region_id?: number | null
  region_ids?: number[]
  department_ids?: number[]
  date?: string
  status?: HrRequestRow['status']
  details?: string | null
  attachment_file_name?: string | null
  recommendation_id?: string | null
  sdg?: string | null
  sdg_indicator?: string | null
  upr?: string | null
  upr_indicator?: string | null
  indicator_responses?: HrRequestIndicatorResponseInput[]
}

export async function updateHrRequest(id: string, body: HrRequestPatchBody): Promise<HrRequestRow> {
  await ensureCsrfCookie()
  // POST: FortiGate blocks HTTP PATCH on live (Attack ID 20000001).
  const res = await fetch(`/api/v1/hr-requests/${encodeURIComponent(id)}/update`, {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestRow }
  return withCoercedStatus(json.data)
}

/** Same fields as create, but uses multipart so new attachments can be uploaded while editing. */
export type HrRequestUpdateFromIssueFormInput = Omit<HrRequestCreateFromIssueFormInput, 'attachments'> & {
  attachments?: File[]
}

export async function updateHrRequestFromIssueForm(
  id: string,
  input: HrRequestUpdateFromIssueFormInput,
): Promise<HrRequestRow> {
  await ensureCsrfCookie()
  const fd = new FormData()
  fd.append('title', input.title)
  fd.append('reporting_framework', input.reporting_framework)
  if (input.convention_id != null) {
    fd.append('convention_id', String(input.convention_id))
  } else {
    fd.append('convention_id', '')
  }
  if (input.reporting_framework === 'other_issue') {
    const ids = input.convention_ids ?? []
    if (ids.length === 0) {
      fd.append('convention_ids', '')
    } else {
      for (const cid of ids) {
        fd.append('convention_ids[]', String(cid))
      }
    }
  } else {
    for (const cid of input.convention_ids ?? []) {
      fd.append('convention_ids[]', String(cid))
    }
  }
  fd.append('request_type', input.request_type)
  if (input.issue_id != null) fd.append('issue_id', String(input.issue_id))
  if (input.other_issue_text?.trim()) fd.append('other_issue_text', input.other_issue_text.trim())
  if (input.upr?.trim()) fd.append('upr', input.upr.trim())
  else fd.append('upr', '')
  if (input.upr_indicator?.trim()) fd.append('upr_indicator', input.upr_indicator.trim())
  else fd.append('upr_indicator', '')
  fd.append('date', input.date)
  fd.append('status', input.status)
  if (input.details != null && input.details !== '') {
    fd.append('details', input.details)
  }
  for (const rid of input.region_ids) {
    fd.append('region_ids[]', String(rid))
  }
  for (const did of input.department_ids) {
    fd.append('department_ids[]', String(did))
  }
  if (input.indicator_responses.length > 0) {
    fd.append('indicator_responses', JSON.stringify(input.indicator_responses))
  }
  for (const file of input.attachments ?? []) {
    fd.append('attachments[]', file)
  }

  // POST: FortiGate blocks HTTP PATCH on live (Attack ID 20000001).
  const res = await fetch(`/api/v1/hr-requests/${encodeURIComponent(id)}/update`, {
    method: 'POST',
    credentials: 'include',
    headers: apiMultipartHeaders(),
    body: fd,
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: HrRequestRow }
  return withCoercedStatus(json.data)
}

export async function deleteHrRequest(id: string): Promise<void> {
  await ensureCsrfCookie()
  const res = await fetch(`/api/v1/hr-requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: apiJsonHeaders(),
  })
  await throwIfNotOk(res)
}

export async function deleteHrRequestAttachment(hrRequestId: string, attachmentId: number): Promise<void> {
  await ensureCsrfCookie()
  const res = await fetch(
    `/api/v1/hr-requests/${encodeURIComponent(hrRequestId)}/attachments/${encodeURIComponent(String(attachmentId))}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: apiJsonHeaders(),
    },
  )
  await throwIfNotOk(res)
}
