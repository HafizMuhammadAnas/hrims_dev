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
