import type { HrRequestIssueIndicator, HrRequestRow } from '../types/hrRequest'

/**
 * Indicators a department (or region) must address for this request.
 * When the federal request includes `indicator_responses`, only those issue indicators apply.
 * Otherwise (legacy / empty) all issue indicators that collect Q/L data apply.
 */
export function indicatorsScopedToRequest(detail: HrRequestRow | null | undefined): HrRequestIssueIndicator[] {
  if (!detail?.issue?.indicators?.length) return []
  const collecting = detail.issue.indicators.filter((i) => i.has_quantitative || i.has_qualitative)
  const rows = detail.indicator_responses ?? []
  if (rows.length === 0) {
    return collecting
  }
  const selected = new Set(rows.map((r) => r.issue_indicator_id))
  return collecting.filter((i) => selected.has(i.id))
}

/**
 * Further narrow request indicators to those assigned on a department task.
 * Legacy tasks with no `assigned_indicator_ids` keep the full request scope.
 */
export function indicatorsScopedToDepartmentTask(
  detail: HrRequestRow | null | undefined,
  assignedIndicatorIds: number[] | null | undefined,
): HrRequestIssueIndicator[] {
  const scoped = indicatorsScopedToRequest(detail)
  if (!assignedIndicatorIds || assignedIndicatorIds.length === 0) return scoped
  const allowed = new Set(assignedIndicatorIds)
  return scoped.filter((i) => allowed.has(i.id))
}

/** 1-based ordinals matching regional assign UI (#1, #2, …) for the request indicator list. */
export function indicatorOrdinalsForRequest(
  detail: HrRequestRow | null | undefined,
): Record<number, number> {
  const scoped = indicatorsScopedToRequest(detail)
  const out: Record<number, number> = {}
  scoped.forEach((ind, index) => {
    out[ind.id] = index + 1
  })
  return out
}
