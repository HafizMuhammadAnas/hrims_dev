import { useMemo } from 'react'
import type { DepartmentTaskRow } from '../api/lists'
import { clubbedResponseDataJson, clubDepartmentTaskResponses } from '../lib/clubDepartmentResponses'
import { hasDepartmentResponse } from '../lib/departmentTaskWorkflow'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { AttachmentViewLink, DepartmentResponseDisplay } from './DepartmentResponseDisplay'

type Props = {
  tasks: DepartmentTaskRow[]
  issueIndicators?: HrRequestIssueIndicator[]
  filterByRegionId?: number | null
  filterByRegionName?: string | null
  regionLabel?: string | null
}

/**
 * Federal view: one clubbed regional response —
 * quantitative cells summed; qualitative merged as separate paragraphs;
 * all uploaded files listed anonymously (no department names).
 */
export function ClubbedRegionDepartmentResponses({
  tasks,
  issueIndicators = [],
  filterByRegionId,
  filterByRegionName,
  regionLabel,
}: Props) {
  const scopedTasks = useMemo(() => {
    let rows = tasks
    if (filterByRegionId != null) {
      rows = rows.filter((t) => t.region_id === filterByRegionId)
    } else if (filterByRegionName !== undefined) {
      const want = (filterByRegionName ?? '').trim()
      rows = rows.filter((t) => (t.region_name ?? '').trim() === want)
    }
    return rows.filter(
      (t) =>
        hasDepartmentResponse(t) ||
        Boolean(t.attachment_url?.trim()) ||
        Boolean(t.verification_file_url?.trim()),
    )
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

  const label =
    regionLabel?.trim() ||
    filterByRegionName?.trim() ||
    scopedTasks[0]?.region_name?.trim() ||
    'Region'

  if (!clubbed) {
    return (
      <p className="muted" style={{ margin: '0 0 12px' }}>
        No response data is available for <strong>{label}</strong> yet.
      </p>
    )
  }

  const hasPayloadContent =
    Object.keys(clubbed.payload.by_indicator ?? {}).length > 0 ||
    Boolean(clubbed.payload.challenges?.trim())

  return (
    <section className="clubbed-region-responses">
      {hasPayloadContent ? (
        <div className="dept-submission-card clubbed-region-responses__card">
          <DepartmentResponseDisplay
            responseData={clubbedResponseDataJson(clubbed.payload)}
            issueIndicators={issueIndicators}
            locationRegionIds={locationRegionIds}
          />
        </div>
      ) : null}
      {clubbed.attachmentUrls.length > 0 ? (
        <div className="clubbed-region-responses__files">
          <h3 className="clubbed-region-responses__files-title">Supporting documents</h3>
          <ul className="clubbed-region-responses__files-list">
            {clubbed.attachmentUrls.map((url, index) => (
              <li key={`${url}-${index}`}>
                <AttachmentViewLink url={url} />
                <span className="muted small" style={{ marginLeft: 8 }}>
                  Document {index + 1}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
