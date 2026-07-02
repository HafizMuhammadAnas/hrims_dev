import type { DepartmentTaskRow } from '../api/lists'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'
import { StatusBadge } from './ui/StatusBadge'
import { formatAppDate } from '../lib/dateFormat'
import { hasDepartmentResponse, workflowPresentation } from '../lib/departmentTaskWorkflow'

type Props = {
  tasksForDetail: DepartmentTaskRow[]
  reqId: string
  /** Issue indicators (for year/gender matrix when viewing structured department responses). */
  issueIndicators?: HrRequestIssueIndicator[]
  /** Only show tasks whose region matches (federal consolidated view per province). */
  filterByRegionName?: string | null
  filterByRegionId?: number | null
  /** When the parent already provides a section title (e.g. modal card). */
  omitHeading?: boolean
  /** Show task id and submission date on cards when omitHeading is set. */
  showCardMeta?: boolean
  /** Hide per-task workflow badge (e.g. federal modal hero already shows review status). */
  hideStatusBadge?: boolean
  /** When set, only list tasks that have a submitted response. */
  onlyWithSubmission?: boolean
}

export function DepartmentSubmissionsForRequest({
  tasksForDetail,
  reqId,
  issueIndicators,
  filterByRegionName,
  filterByRegionId,
  omitHeading = false,
  showCardMeta = false,
  hideStatusBadge = false,
  onlyWithSubmission = false,
}: Props) {
  const scoped = (() => {
    let rows = tasksForDetail
    if (filterByRegionId != null) {
      rows = rows.filter((t) => t.region_id === filterByRegionId)
    } else if (filterByRegionName !== undefined) {
      const want = (filterByRegionName ?? '').trim()
      rows = rows.filter((t) => (t.region_name ?? '').trim() === want)
    }
    if (onlyWithSubmission) {
      rows = rows.filter((t) => hasDepartmentResponse(t))
    }
    return rows
  })()

  if (scoped.length === 0) {
    if (filterByRegionId != null || filterByRegionName !== undefined) {
      const regionLabel =
        filterByRegionName?.trim() ||
        tasksForDetail.find((t) => t.region_id === filterByRegionId)?.region_name?.trim() ||
        '—'
      return (
        <p className="muted" style={{ margin: '12px 0' }}>
          No distributed department tasks for region <strong>{regionLabel}</strong> on request{' '}
          <strong>{reqId}</strong>.
        </p>
      )
    }
    return (
      <p className="muted" style={{ margin: '12px 0' }}>
        No distributed department tasks found for this request. Department submissions will appear here when tasks exist for{' '}
        <strong>{reqId}</strong>.
      </p>
    )
  }
  return (
    <div
      className={
        'submission-history-dept-sections' + (omitHeading ? ' submission-history-dept-sections--flat' : '')
      }
    >
      {!omitHeading ? (
        <h4 className="dept-submissions-heading">
          Department submissions
          {filterByRegionName !== undefined ? (
            <>
              {' '}
              — <strong>{filterByRegionName?.trim() || '—'}</strong>
            </>
          ) : null}
        </h4>
      ) : null}
      {scoped.map((t) => {
        const wf = workflowPresentation(t)
        return (
          <article key={t.id} className="dept-submission-card">
            <header className="dept-submission-card__head">
              <strong className="dept-submission-card__dept">{t.department_name ?? t.department_id}</strong>
              {!hideStatusBadge ? <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge> : null}
            </header>
            {(!omitHeading || showCardMeta) && (t.id || t.submission_date) ? (
              <p className="muted small dept-submission-card__meta">
                Task {t.id}
                {t.submission_date ? ` · Submitted ${formatAppDate(t.submission_date)}` : ''}
              </p>
            ) : null}
            {hasDepartmentResponse(t) ? (
            <DepartmentResponseDisplay
              responseData={t.response_data}
              attachmentUrl={t.attachment_url}
              issueIndicators={issueIndicators}
              locationRegionIds={[t.region_id]}
            />
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                No submission recorded for this department yet.
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}
