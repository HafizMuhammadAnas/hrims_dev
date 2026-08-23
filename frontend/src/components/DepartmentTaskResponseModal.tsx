import { useEffect, useMemo, useState } from 'react'
import type { DepartmentTaskRow } from '../api/lists'
import { fetchHrRequest } from '../api/hrRequests'
import { formatAppDate } from '../lib/dateFormat'
import { buildDepartmentForwardedViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'
import {
  inferReportingFramework,
  reportingFrameworkLabel,
} from '../lib/hrRequestReportingFramework'
import {
  canAcceptDepartmentTaskReview,
  canRequestDepartmentTaskModification,
  canShowDepartmentTaskReviewActions,
  departmentTaskWorkflowBucket,
  hasDepartmentResponse,
  workflowPresentation,
} from '../lib/departmentTaskWorkflow'
import { isIctLineTask, reviewFeedbackLabelForTask } from '../lib/ictRegion'
import type { HrRequestRow } from '../types/hrRequest'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
import { ResponseRevisionChangesPanel } from './ResponseRevisionChangesPanel'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { WorkflowActionAlert } from './WorkflowActionFootback'
import { ModalActions } from './ui/ModalChrome'
import { StatusBadge } from './ui/StatusBadge'
import { WorkflowModalHero } from './ui/WorkflowModalHero'

function reviewErrorAsFeedback(error: string) {
  const validation = /required|note|feedback|describe|add a short/i.test(error)
  return {
    kind: validation ? ('validation' as const) : ('error' as const),
    message: error,
  }
}

export type DepartmentTaskResponseModalReviewProps = {
  comments: string
  onCommentsChange: (v: string) => void
  onAccept: () => void
  onRequestModification: () => void
  saving: boolean
  error: string | null
}

type Props = {
  task: DepartmentTaskRow | null
  onClose: () => void
  /** When set, show regional review actions (department monitoring). */
  review?: DepartmentTaskResponseModalReviewProps | null
  /** If true, show review UI only when the department has submitted. */
  showReviewWhenResponded?: boolean
}

export function DepartmentTaskResponseModal({
  task,
  onClose,
  review,
  showReviewWhenResponded = true,
}: Props) {
  const [tab, setTab] = useState<'request' | 'response' | 'changes'>('response')
  const [reqRow, setReqRow] = useState<HrRequestRow | null>(null)
  const [reqLoading, setReqLoading] = useState(false)
  const [reqErr, setReqErr] = useState<string | null>(null)

  useEffect(() => {
    if (!task) return
    setTab('response')
    setReqRow(null)
    setReqErr(null)
  }, [task?.id])

  useEffect(() => {
    if (!task) return
    let cancelled = false
    setReqLoading(true)
    setReqErr(null)
    void fetchHrRequest(task.req_id)
      .then((r) => {
        if (!cancelled) setReqRow(r)
      })
      .catch((e: unknown) => {
        if (!cancelled) setReqErr(e instanceof Error ? e.message : 'Could not load request')
      })
      .finally(() => {
        if (!cancelled) setReqLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [task?.id, task?.req_id])

  const forwardedTemplateProps = useMemo(
    () => (reqRow && task ? buildDepartmentForwardedViewTemplateProps(reqRow, task) : null),
    [reqRow, task],
  )

  if (!task) return null

  const wf = workflowPresentation(task)
  const ictLine = isIctLineTask(task)
  const reviewFeedbackLabel = reviewFeedbackLabelForTask(task)
  const responded = hasDepartmentResponse(task)
  const bucket = departmentTaskWorkflowBucket(task)
  const showReviewActions = Boolean(
    review && (!showReviewWhenResponded || responded) && canShowDepartmentTaskReviewActions(task),
  )
  const showAcceptAction = showReviewActions && canAcceptDepartmentTaskReview(task)
  const showModificationAction = showReviewActions && canRequestDepartmentTaskModification(task)
  const showReviewOutcomeBanner = Boolean(
    review && responded && !showReviewActions && bucket === 'revision',
  )

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal-card modal-card-wide dept-task-response-modal workflow-tabbed-card"
        onClick={(e) => e.stopPropagation()}
      >
        <WorkflowModalHero
          eyebrow={ictLine ? 'National line' : 'Department submission'}
          title={String(task.department_name ?? task.department_id)}
          onClose={onClose}
        >
          {reportingFrameworkLabel(inferReportingFramework(reqRow)) ? (
            <StatusBadge tone="pending">
              {reportingFrameworkLabel(inferReportingFramework(reqRow))}
            </StatusBadge>
          ) : null}
          <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
          <span className="workflow-modal-hero__chip">Task {task.id}</span>
          <span className="workflow-modal-hero__chip">{task.req_id}</span>
          {!ictLine && task.region_name ? (
            <span className="workflow-modal-hero__chip">{task.region_name}</span>
          ) : null}
        </WorkflowModalHero>

        <nav className="compiled-record-modal-tabs dept-task-response-modal__tabs" aria-label="Submission views">
          <button
            type="button"
            className={
              'compiled-record-modal-tab' + (tab === 'response' ? ' compiled-record-modal-tab--active' : '')
            }
            onClick={() => setTab('response')}
          >
            Response
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
          <button
            type="button"
            className={
              'compiled-record-modal-tab' + (tab === 'changes' ? ' compiled-record-modal-tab--active' : '')
            }
            onClick={() => setTab('changes')}
          >
            Changes
          </button>
        </nav>

        <div className="modal-form dept-task-response-modal__body">
          {tab === 'request' ? (
            <>
              <div className="dept-task-response-modal__panel">
                {reqLoading ? <p className="muted">Loading request…</p> : null}
                {reqErr ? <p className="login-error">{reqErr}</p> : null}
                {!reqLoading && !reqErr && reqRow && forwardedTemplateProps ? (
                  <div className="hr-request-view-template-modal dept-task-response-modal__request-template">
                    <HrRequestViewTemplate {...forwardedTemplateProps} />
                  </div>
                ) : null}
                {!reqLoading && !reqErr && reqRow && !forwardedTemplateProps ? (
                  <Alert variant="warning" title="Request format not supported in this preview">
                    <p style={{ margin: 0 }}>
                      This HR request is not using the current convention/issue workflow, or issue details are missing
                      from the API. Open the full request from the HR requests list to view everything.
                    </p>
                  </Alert>
                ) : null}
              </div>
              <ModalActions>
                <Button variant="secondary" compact onClick={onClose}>
                  Close
                </Button>
              </ModalActions>
            </>
          ) : null}

          {tab === 'response' ? (
            <div className="dept-task-response-modal__panel">
              {responded ? (
                <>
                  {task.submission_date ? (
                    <p className="muted small" style={{ margin: '0 0 12px' }}>
                      Submitted {formatAppDate(task.submission_date)}
                    </p>
                  ) : null}
                  {task.regional_review_comments?.trim() ? (
                    <p className="muted small" style={{ margin: '0 0 12px' }}>
                      <strong>{reviewFeedbackLabel}:</strong> {task.regional_review_comments}
                    </p>
                  ) : null}
                  <DepartmentResponseDisplay
                    responseData={task.response_data}
                    attachmentUrl={task.attachment_url}
                    issueIndicators={reqRow?.issue?.indicators}
                    locationRegionIds={[task.region_id]}
                  />
                </>
              ) : (
                <p className="muted">The department has not submitted a response yet.</p>
              )}

              {showReviewActions && review ? (
                <>
                  <div className="form-row">
                    <label htmlFor="dept-review-comments">Notes to department (optional)</label>
                    <textarea
                      id="dept-review-comments"
                      rows={4}
                      value={review.comments}
                      onChange={(e) => review.onCommentsChange(e.target.value)}
                      placeholder="e.g. Please add disaggregated data for female respondents."
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  {review.error ? (
                    <WorkflowActionAlert
                      feedback={reviewErrorAsFeedback(review.error)}
                      className="workflow-action-footback__alert"
                    />
                  ) : null}
                  <ModalActions className="workflow-action-footback__actions">
                    <Button variant="secondary" compact disabled={review.saving} onClick={onClose}>
                      Close
                    </Button>
                    {showAcceptAction ? (
                      <Button
                        variant="primary"
                        compact
                        disabled={review.saving}
                        onClick={() => void review.onAccept()}
                      >
                        {review.saving ? 'Saving…' : 'Accept'}
                      </Button>
                    ) : null}
                    {showModificationAction ? (
                      <Button
                        variant="secondary"
                        compact
                        disabled={review.saving}
                        onClick={() => void review.onRequestModification()}
                      >
                        Request modification
                      </Button>
                    ) : null}
                  </ModalActions>
                </>
              ) : showReviewOutcomeBanner ? (
                <>
                  <Alert variant="warning" title="Resubmission requested">
                    <p style={{ margin: 0 }}>
                      The department must submit an updated response before you can accept or request changes again.
                    </p>
                    {task.regional_review_comments?.trim() ? (
                      <p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>
                        <strong>Feedback sent to the department:</strong> {task.regional_review_comments}
                      </p>
                    ) : null}
                  </Alert>
                  <ModalActions>
                    <Button variant="secondary" compact onClick={onClose}>
                      Close
                    </Button>
                  </ModalActions>
                </>
              ) : (
                <ModalActions>
                  <Button variant="secondary" compact onClick={onClose}>
                    Close
                  </Button>
                </ModalActions>
              )}
            </div>
          ) : null}

          {tab === 'changes' ? (
            <div className="dept-task-response-modal__panel">
              <ResponseRevisionChangesPanel
                kind="department"
                departmentTaskId={task.id}
                currentResponseData={task.response_data}
                currentAttachmentUrl={task.attachment_url}
                issueIndicators={reqRow?.issue?.indicators}
                locationRegionIds={[task.region_id]}
              />
              <ModalActions>
                <Button variant="secondary" compact onClick={onClose}>
                  Close
                </Button>
              </ModalActions>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
