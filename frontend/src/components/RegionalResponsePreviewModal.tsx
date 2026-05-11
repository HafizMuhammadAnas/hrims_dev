import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { fetchHrRequest } from '../api/hrRequests'
import type { DepartmentTaskRow, RegionalResponseRow } from '../api/lists'
import { buildFederalOriginalRequestViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'
import type { HrRequestRow } from '../types/hrRequest'
import { DepartmentSubmissionsForRequest } from './DepartmentSubmissionsForRequest'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { ModalActions } from './ui/ModalChrome'
import { StatusBadge } from './ui/StatusBadge'

function federalReviewTone(
  status: string,
): 'pending' | 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'accepted') return 'success'
  if (status === 'needs-modification') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'pending'
}

function formatReviewStatusLabel(status: string): string {
  if (status === 'needs-modification') return 'Needs modification'
  const s = status.replace(/-/g, ' ')
  if (!s) return status
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type PreviewTab = 'responses' | 'request'

type Props = {
  row: RegionalResponseRow | null
  tasksForDetail: DepartmentTaskRow[]
  onClose: () => void
  /** Shown before the Close button (e.g. regional “Edit compilation”). */
  footerExtra?: ReactNode
  /** Override default intro on the Responses tab. */
  introText?: string
}

export function RegionalResponsePreviewModal({
  row,
  tasksForDetail,
  onClose,
  footerExtra,
  introText = 'Provincial consolidated submission for this HR request. Department submissions are scoped to this region.',
}: Props) {
  const [tab, setTab] = useState<PreviewTab>('responses')
  const [hrDetail, setHrDetail] = useState<HrRequestRow | null>(null)
  const [hrLoading, setHrLoading] = useState(false)
  const [hrError, setHrError] = useState<string | null>(null)

  useEffect(() => {
    setTab('responses')
  }, [row?.id])

  useEffect(() => {
    if (!row) {
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
  }, [row?.req_id])

  const federalTemplateProps = useMemo(
    () => (hrDetail ? buildFederalOriginalRequestViewTemplateProps(hrDetail) : null),
    [hrDetail],
  )

  if (!row) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal-card modal-card-wide regional-response-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head dept-task-response-modal__head">
          <div>
            <h3>Regional compilation</h3>
            <p className="dept-task-response-modal__head-meta muted small">
              Response <strong>{row.id}</strong> · Request <strong>{row.req_id}</strong>
              {row.region_name ? (
                <>
                  {' '}
                  · <strong>{row.region_name}</strong>
                </>
              ) : null}
              <br />
              Submitted <strong>{row.submission_date}</strong>
              <span style={{ marginLeft: 8 }}>
                <StatusBadge tone={federalReviewTone(row.review_status)}>
                  {formatReviewStatusLabel(row.review_status)}
                </StatusBadge>
              </span>
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <nav
          className="compiled-record-modal-tabs dept-task-response-modal__tabs"
          aria-label="Compilation preview"
        >
          <button
            type="button"
            className={
              'compiled-record-modal-tab' + (tab === 'responses' ? ' compiled-record-modal-tab--active' : '')
            }
            onClick={() => setTab('responses')}
          >
            Responses
          </button>
          <button
            type="button"
            className={
              'compiled-record-modal-tab' + (tab === 'request' ? ' compiled-record-modal-tab--active' : '')
            }
            onClick={() => setTab('request')}
          >
            Request
          </button>
        </nav>

        <div className="modal-form regional-response-detail-modal__form">
          {tab === 'responses' ? (
            <>
              <p className="muted small regional-response-detail-modal__intro" style={{ marginTop: 0 }}>
                {introText}
              </p>
              <div className="dept-task-response-modal__panel regional-response-detail-modal__panel">
                <section
                  className="hr-request-view-template__card regional-response-detail-modal__section"
                  aria-labelledby={`reg-preview-overview-${row.id}`}
                >
                  <h2 id={`reg-preview-overview-${row.id}`} className="card-section-heading">
                    Overview
                  </h2>
                  <div className="regional-response-detail-modal__grid">
                    <div>
                      <div className="hr-request-view-template__field-label">Compilation title</div>
                      <p className="regional-response-detail-modal__value">{row.title || '—'}</p>
                    </div>
                    <div>
                      <div className="hr-request-view-template__field-label">Federal review</div>
                      <p className="regional-response-detail-modal__value" style={{ marginBottom: 0 }}>
                        <StatusBadge tone={federalReviewTone(row.review_status)}>
                          {formatReviewStatusLabel(row.review_status)}
                        </StatusBadge>
                      </p>
                    </div>
                  </div>
                </section>

                {row.comments?.trim() ? (
                  <section
                    className="hr-request-view-template__card regional-response-detail-modal__section"
                    aria-labelledby={`reg-preview-feedback-${row.id}`}
                  >
                    <h2 id={`reg-preview-feedback-${row.id}`} className="card-section-heading">
                      Federal feedback
                    </h2>
                    <div className="regional-response-detail-modal__feedback">{row.comments.trim()}</div>
                  </section>
                ) : null}

                <section
                  className="hr-request-view-template__card regional-response-detail-modal__section"
                  aria-labelledby={`reg-preview-depts-${row.id}`}
                >
                  <h2 id={`reg-preview-depts-${row.id}`} className="card-section-heading">
                    Department submissions
                  </h2>
                  <DepartmentSubmissionsForRequest
                    tasksForDetail={tasksForDetail}
                    reqId={row.req_id}
                    filterByRegionName={row.region_name ?? undefined}
                    omitHeading
                  />
                </section>

                <section
                  className="hr-request-view-template__card regional-response-detail-modal__section"
                  aria-labelledby={`reg-preview-body-${row.id}`}
                >
                  <h2 id={`reg-preview-body-${row.id}`} className="card-section-heading">
                    Compiled regional response
                  </h2>
                  <div className="hr-request-view-template__prose-box">
                    {row.content?.trim() ? (
                      <p className="hr-request-view-template__prose" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {row.content.trim()}
                      </p>
                    ) : (
                      <p className="muted" style={{ margin: 0 }}>
                        —
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <>
              <p className="muted small regional-response-detail-modal__intro" style={{ marginTop: 0 }}>
                Original HR request as first issued from federal: convention, issue, indicators, description, and
                attachments.
              </p>
              <div className="dept-task-response-modal__panel regional-response-detail-modal__panel">
                {hrLoading ? <p className="muted">Loading request…</p> : null}
                {hrError ? (
                  <Alert variant="warning" title="Could not load the HR request">
                    <p style={{ margin: 0 }}>{hrError}</p>
                  </Alert>
                ) : null}
                {!hrLoading && !hrError && federalTemplateProps ? (
                  <div className="regional-preview-embedded-request regional-preview-embedded-request--tab">
                    <HrRequestViewTemplate {...federalTemplateProps} />
                  </div>
                ) : null}
                {!hrLoading && !hrError && hrDetail && !federalTemplateProps ? (
                  <p className="muted small" style={{ margin: 0 }}>
                    This request is not in the current issue-based format, or issue data is missing from the API.
                  </p>
                ) : null}
              </div>
            </>
          )}

          <ModalActions>
            {footerExtra}
            <Button variant="secondary" compact onClick={onClose}>
              Close
            </Button>
          </ModalActions>
        </div>
      </div>
    </div>
  )
}
