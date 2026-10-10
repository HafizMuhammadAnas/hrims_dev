import { useEffect, useMemo, useState } from 'react'
import { fetchHrRequest } from '../api/hrRequests'
import { fetchDepartmentTasks, type DepartmentTaskRow, type RegionalResponseRow } from '../api/lists'
import { buildFederalOriginalRequestViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'
import { loiLegacyFormatMessage } from '../lib/issueEntryKind'
import { regionalResponseReviewPresentation } from '../lib/regionalResponseReviewStatus'
import type { HrRequestRow } from '../types/hrRequest'
import { DepartmentSubmissionsForRequest } from './DepartmentSubmissionsForRequest'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
import { Alert } from './ui/Alert'
import { StatusBadge } from './ui/StatusBadge'
import { WorkflowModalHero } from './ui/WorkflowModalHero'

type Props = {
  row: RegionalResponseRow
  /** Fired when request + department tasks have finished loading. */
  onReadyChange?: (ready: boolean) => void
}

/**
 * Full regional compilation document (request + department responses + summary)
 * for multi-record merge export on the regional Compilation Center.
 */
export function RegionalCompilationPrintDocument({ row, onReadyChange }: Props) {
  const [hrDetail, setHrDetail] = useState<HrRequestRow | null>(null)
  const [hrLoading, setHrLoading] = useState(false)
  const [hrError, setHrError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)

  useEffect(() => {
    if (!row.req_id) {
      setHrDetail(null)
      setHrError(null)
      setHrLoading(false)
      return
    }
    let cancelled = false
    setHrLoading(true)
    setHrError(null)
    void fetchHrRequest(row.req_id)
      .then((r) => {
        if (!cancelled) setHrDetail(r)
      })
      .catch((e: unknown) => {
        if (!cancelled) setHrError(e instanceof Error ? e.message : 'Failed to load HR request')
      })
      .finally(() => {
        if (!cancelled) setHrLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [row.req_id])

  useEffect(() => {
    if (!row.req_id) {
      setTasks([])
      setTasksError(null)
      setTasksLoading(false)
      return
    }
    let cancelled = false
    setTasksLoading(true)
    setTasksError(null)
    void fetchDepartmentTasks()
      .then((rows) => {
        if (cancelled) return
        setTasks(rows.filter((t) => t.req_id === row.req_id))
      })
      .catch((e: unknown) => {
        if (!cancelled) setTasksError(e instanceof Error ? e.message : 'Failed to load responses')
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [row.id, row.req_id])

  const ready = !hrLoading && !tasksLoading

  useEffect(() => {
    onReadyChange?.(ready)
  }, [ready, onReadyChange])

  const requestTemplateProps = useMemo(
    () => (hrDetail ? buildFederalOriginalRequestViewTemplateProps(hrDetail) : null),
    [hrDetail],
  )

  const review = regionalResponseReviewPresentation(row.review_status)

  return (
    <div className="ministry-compiled-print-document">
      <WorkflowModalHero
        eyebrow="Regional compilation"
        title={row.title?.trim() || row.region_name || 'Compiled response'}
        embedded
      >
        <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
        {row.req_id ? <span className="workflow-modal-hero__chip">{row.req_id}</span> : null}
        {row.region_name ? <span className="workflow-modal-hero__chip">{row.region_name}</span> : null}
      </WorkflowModalHero>

      <div className="ministry-compiled-modal__body ministry-compiled-single__body">
        <article className="ministry-compiled-region-card ministry-compiled-request-card">
          <h2 className="ministry-compiled-region-card__title">Original request</h2>
          {hrLoading ? <p className="muted">Loading request…</p> : null}
          {hrError ? (
            <Alert variant="warning" title="Could not load the HR request">
              <p style={{ margin: 0 }}>{hrError}</p>
            </Alert>
          ) : null}
          {!hrLoading && !hrError && requestTemplateProps ? (
            <div className="ministry-compiled-embedded-request">
              <HrRequestViewTemplate
                {...requestTemplateProps}
                className="hr-request-view-template--ministry-document"
              />
            </div>
          ) : null}
          {!hrLoading && !hrError && hrDetail && !requestTemplateProps ? (
            <p className="muted small" style={{ margin: 0 }}>
              {loiLegacyFormatMessage()}
            </p>
          ) : null}
        </article>

        <article className="ministry-compiled-region-card">
          <h2 className="ministry-compiled-region-card__title">Responses</h2>
          {tasksLoading ? <p className="muted">Loading department responses…</p> : null}
          {tasksError ? <p className="login-error">{tasksError}</p> : null}
          {!tasksLoading && !tasksError ? (
            <DepartmentSubmissionsForRequest
              tasksForDetail={tasks}
              reqId={row.req_id}
              issueIndicators={hrDetail?.issue?.indicators}
              filterByRegionId={row.region_id ?? undefined}
              filterByRegionName={row.region_id == null ? row.region_name : undefined}
              omitHeading
              hideStatusBadge
              onlyWithSubmission
            />
          ) : null}
        </article>

        <article className="ministry-compiled-region-card ministry-compiled-summary-card">
          <h2 className="ministry-compiled-region-card__title">Summary</h2>
          <div className="ministry-compiled-summary-card__body">
            {row.content?.trim() ? (
              <p className="hr-request-view-template__prose ministry-compiled-summary-card__prose">
                {row.content.trim()}
              </p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                No compilation summary was saved for this record.
              </p>
            )}
          </div>
        </article>
      </div>
    </div>
  )
}
