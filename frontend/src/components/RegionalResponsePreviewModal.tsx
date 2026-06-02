import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { fetchHrRequest } from '../api/hrRequests'
import type { DepartmentTaskRow, RegionalResponseRow } from '../api/lists'
import { buildFederalOriginalRequestViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'
import type { HrRequestRow } from '../types/hrRequest'
import { DepartmentSubmissionsForRequest } from './DepartmentSubmissionsForRequest'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
import { RegionalFederalReviewFeedback } from './RegionalFederalReviewFeedback'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/StatusBadge'
import { WorkflowModalHero } from './ui/WorkflowModalHero'
import { regionalResponseReviewPresentation } from '../lib/regionalResponseReviewStatus'

type PreviewTab = 'responses' | 'request'

type Props = {
  row: RegionalResponseRow | null
  tasksForDetail: DepartmentTaskRow[]
  onClose: () => void
  footerExtra?: ReactNode
}

type ViewProps = {
  row: RegionalResponseRow
  tasksForDetail: DepartmentTaskRow[]
  embedded?: boolean
  onClose?: () => void
  footerExtra?: ReactNode
}

export function RegionalResponsePreviewView({
  row,
  tasksForDetail,
  embedded = false,
  onClose,
  footerExtra,
}: ViewProps) {
  const [tab, setTab] = useState<PreviewTab>('responses')
  const [hrDetail, setHrDetail] = useState<HrRequestRow | null>(null)
  const [hrLoading, setHrLoading] = useState(false)
  const [hrError, setHrError] = useState<string | null>(null)

  useEffect(() => {
    setTab('responses')
  }, [row.id])

  useEffect(() => {
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

  const federalTemplateProps = useMemo(
    () => (hrDetail ? buildFederalOriginalRequestViewTemplateProps(hrDetail) : null),
    [hrDetail],
  )

  return (
    <div className="modal-card modal-card-wide regional-response-detail-modal workflow-tabbed-card">
      <WorkflowModalHero
        eyebrow="Regional compilation"
        title={row.region_name ?? 'Regional compilation'}
        onClose={embedded ? undefined : onClose}
        embedded={embedded}
      >
        {row.review_status !== 'pending' ? (
          <StatusBadge tone={regionalResponseReviewPresentation(row.review_status).tone}>
            {regionalResponseReviewPresentation(row.review_status).label}
          </StatusBadge>
        ) : null}
        <span className="workflow-modal-hero__chip">{row.req_id}</span>
      </WorkflowModalHero>

      <RegionalFederalReviewFeedback row={row} className="regional-federal-review-feedback--hero-gap" />

      <nav
        className="compiled-record-modal-tabs dept-task-response-modal__tabs"
        aria-label="Compilation preview"
      >
        <button
          type="button"
          className={'compiled-record-modal-tab' + (tab === 'responses' ? ' compiled-record-modal-tab--active' : '')}
          onClick={() => setTab('responses')}
        >
          Responses
        </button>
        <button
          type="button"
          className={'compiled-record-modal-tab' + (tab === 'request' ? ' compiled-record-modal-tab--active' : '')}
          onClick={() => setTab('request')}
        >
          Request
        </button>
      </nav>

      <div className="modal-form regional-response-detail-modal__form dept-task-response-modal__body regional-response-detail-modal__form--flat">
        {tab === 'responses' ? (
          <>
            <h2 className="card-section-heading">Responses</h2>
            <DepartmentSubmissionsForRequest
              tasksForDetail={tasksForDetail}
              reqId={row.req_id}
              issueIndicators={hrDetail?.issue?.indicators}
              filterByRegionName={row.region_name ?? undefined}
              omitHeading
              hideStatusBadge
            />
            <h2 className="card-section-heading">Summary</h2>
            <div className="hr-request-view-template__prose-box">
              {row.content?.trim() ? (
                <p className="hr-request-view-template__prose regional-response-detail-modal__summary">
                  {row.content.trim()}
                </p>
              ) : (
                <p className="muted regional-response-detail-modal__summary-empty">—</p>
              )}
            </div>
          </>
        ) : (
          <>
            {hrLoading ? <p className="muted">Loading request…</p> : null}
            {hrError ? (
              <Alert variant="warning" title="Could not load the HR request">
                <p style={{ margin: 0 }}>{hrError}</p>
              </Alert>
            ) : null}
            {!hrLoading && !hrError && federalTemplateProps ? (
              <HrRequestViewTemplate {...federalTemplateProps} />
            ) : null}
            {!hrLoading && !hrError && hrDetail && !federalTemplateProps ? (
              <p className="muted small" style={{ margin: 0 }}>
                This request is not in the current issue-based format, or issue data is missing from the API.
              </p>
            ) : null}
          </>
        )}
        {!embedded && onClose ? (
          <div className="hr-request-view-footback hr-request-view-footback--actions" style={{ marginTop: 16 }}>
            {footerExtra}
            <Button variant="secondary" compact onClick={onClose}>
              Close
            </Button>
          </div>
        ) : footerExtra ? (
          <div className="hr-request-view-footback hr-request-view-footback--actions" style={{ marginTop: 16 }}>
            {footerExtra}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function RegionalResponsePreviewModal({ row, tasksForDetail, onClose, footerExtra }: Props) {
  if (!row) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <RegionalResponsePreviewView
          row={row}
          tasksForDetail={tasksForDetail}
          onClose={onClose}
          footerExtra={footerExtra}
        />
      </div>
    </div>
  )
}
