import { useMemo } from 'react'
import type { DepartmentTaskRow } from '../api/lists'
import { clubbedResponseDataJson, clubDepartmentTaskResponses } from '../lib/clubDepartmentResponses'
import { hasDepartmentResponse } from '../lib/departmentTaskWorkflow'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'

type Props = {
  tasks: DepartmentTaskRow[]
  issueIndicators?: HrRequestIssueIndicator[]
  filterByRegionId?: number | null
  filterByRegionName?: string | null
  regionLabel?: string | null
  /** When false, omit the section heading (e.g. parent already titled the region). */
  showHeading?: boolean
}

/**
 * Federal view: one clubbed regional response —
 * quantitative cells summed; qualitative merged as separate paragraphs.
 * Does not list department names or per-department cards.
 */
export function ClubbedRegionDepartmentResponses({
  tasks,
  issueIndicators = [],
  filterByRegionId,
  filterByRegionName,
  regionLabel,
  showHeading = true,
}: Props) {
  const scopedTasks = useMemo(() => {
    let rows = tasks
    if (filterByRegionId != null) {
      rows = rows.filter((t) => t.region_id === filterByRegionId)
    } else if (filterByRegionName !== undefined) {
      const want = (filterByRegionName ?? '').trim()
      rows = rows.filter((t) => (t.region_name ?? '').trim() === want)
    }
    return rows.filter((t) => hasDepartmentResponse(t))
  }, [tasks, filterByRegionId, filterByRegionName])

  const clubbed = useMemo(() => clubDepartmentTaskResponses(scopedTasks), [scopedTasks])

  const locationRegionIds = useMemo(() => {
    if (filterByRegionId != null) return [filterByRegionId]
    const ids = [
      ...new Set(
        scopedTasks.map((t) => t.region_id).filter((id): id is number => id != null && id > 0),
      ),
    ]
    return ids
  }, [filterByRegionId, scopedTasks])

  if (!clubbed) {
    const label =
      regionLabel?.trim() ||
      filterByRegionName?.trim() ||
      scopedTasks[0]?.region_name?.trim() ||
      'this region'
    return (
      <p className="muted" style={{ margin: '0 0 12px' }}>
        No clubbed response data is available for <strong>{label}</strong> yet.
      </p>
    )
  }

  const label =
    regionLabel?.trim() ||
    filterByRegionName?.trim() ||
    scopedTasks[0]?.region_name?.trim() ||
    'Region'

  return (
    <section className="clubbed-region-responses">
      {showHeading ? (
        <>
          <h2 className="card-section-heading">Clubbed regional response</h2>
          <p className="muted small" style={{ marginTop: 0, marginBottom: 12 }}>
            Combined response for <strong>{label}</strong>: numeric values are summed; qualitative
            narratives appear as separate paragraphs.
          </p>
        </>
      ) : null}
      <div className="dept-submission-card clubbed-region-responses__card">
        <DepartmentResponseDisplay
          responseData={clubbedResponseDataJson(clubbed.payload)}
          issueIndicators={issueIndicators}
          locationRegionIds={locationRegionIds}
        />
      </div>
    </section>
  )
}
