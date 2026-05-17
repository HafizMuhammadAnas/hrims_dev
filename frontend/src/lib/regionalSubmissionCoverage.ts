import type { RegionalResponseRow } from '../api/lists'
import type { HrRequestRow } from '../types/hrRequest'
import { isIctRegionSlug } from './ictRegion'

/** Client-side filter value for provinces with no regional compilation yet. */
export const AWAITING_SUBMISSION_REVIEW_FILTER = 'awaiting-submission'

export type RegionSubmissionCoverageItem = {
  regionId: number
  regionName: string
  response: RegionalResponseRow | null
  status: 'pending_submission' | 'submitted'
}

export function provincialRegionsFromRequest(
  regions: { id: number; name: string; slug?: string }[] | undefined,
): { id: number; name: string; slug?: string }[] {
  return (regions ?? []).filter((r) => !isIctRegionSlug(r.slug))
}

export function buildProvincialSubmissionCoverage(
  assignedRegions: { id: number; name: string; slug?: string }[] | undefined,
  responsesForRequest: RegionalResponseRow[],
): RegionSubmissionCoverageItem[] {
  const provincial = provincialRegionsFromRequest(assignedRegions)
  return provincial.map((region) => {
    const response =
      responsesForRequest.find(
        (r) =>
          (r.region_id != null && r.region_id === region.id) ||
          (r.region_name ?? '').trim().toLowerCase() === region.name.trim().toLowerCase(),
      ) ?? null
    return {
      regionId: region.id,
      regionName: region.name,
      response,
      status: response ? 'submitted' : 'pending_submission',
    }
  })
}

export function countProvincialSubmissionCoverage(items: RegionSubmissionCoverageItem[]): {
  assigned: number
  submitted: number
  pending: number
  accepted: number
} {
  let submitted = 0
  let pending = 0
  let accepted = 0
  for (const item of items) {
    if (item.status === 'submitted') {
      submitted++
      if (item.response?.review_status === 'accepted') accepted++
    } else {
      pending++
    }
  }
  return { assigned: items.length, submitted, pending, accepted }
}

export type PendingRegionDisplayRow = {
  kind: 'pending'
  regionId: number
  regionName: string
  reqId: string
  requestTitle: string
}

/** One row per assigned province that has not submitted a regional compilation. */
export function buildPendingRegionDisplayRows(
  requests: HrRequestRow[],
  submissions: RegionalResponseRow[],
  reqIdFilter = '',
): PendingRegionDisplayRow[] {
  const source = reqIdFilter ? requests.filter((r) => r.id === reqIdFilter) : requests
  const pending: PendingRegionDisplayRow[] = []
  for (const req of source) {
    const subs = submissions.filter((r) => r.req_id === req.id)
    const coverage = buildProvincialSubmissionCoverage(req.regions, subs)
    for (const item of coverage) {
      if (item.status !== 'pending_submission') continue
      pending.push({
        kind: 'pending',
        regionId: item.regionId,
        regionName: item.regionName,
        reqId: req.id,
        requestTitle: req.title?.trim() || req.id,
      })
    }
  }
  return pending
}

export function countAllPendingProvinces(
  requests: HrRequestRow[],
  submissions: RegionalResponseRow[],
): number {
  return buildPendingRegionDisplayRows(requests, submissions).length
}
