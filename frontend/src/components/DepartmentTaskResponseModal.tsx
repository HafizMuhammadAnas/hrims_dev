import { useEffect, useMemo, useState } from 'react'
import type { DepartmentTaskRow } from '../api/lists'
import { fetchHrRequest } from '../api/hrRequests'
import { buildDepartmentForwardedViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'
import { hasDepartmentResponse, workflowPresentation } from '../lib/departmentTaskWorkflow'
import type { HrRequestRow } from '../types/hrRequest'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { ModalActions } from './ui/ModalChrome'
import { StatusBadge } from './ui/StatusBadge'

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
  const [tab, setTab] = useState<'request' | 'response'>('response')
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
    if (!task || tab !== 'request') return
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
  }, [task?.id, task?.req_id, tab])

  const forwardedTemplateProps = useMemo(
    () => (reqRow && task ? buildDepartmentForwardedViewTemplateProps(reqRow, task) : null),
    [reqRow, task],
  )

  if (!task) return null

  const wf = workflowPresentation(task)
  const responded = hasDepartmentResponse(task)
  const showReviewForm = Boolean(review && (!showReviewWhenResponded || responded))

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card modal-card-wide dept-task-response-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head dept-task-response-modal__head">
          <div>
            <h3>Department submission</h3>
            <p className="dept-task-response-modal__head-meta muted small">
              Task <strong>{task.id}</strong> · Request <strong>{task.req_id}</strong>
              {task.region_name ? (
                <>
                  {' '}
                  · <strong>{task.region_name}</strong>
                </>
              ) : null}
              <br />
              {task.department_name ?? task.department_id}
              <span style={{ marginLeft: 8 }}>
                <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
              </span>
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

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
          ) : (
            <div className="dept-task-response-modal__panel">
              <div className="form-row dept-task-response-modal__response-block">
                <label className="dept-task-response-modal__block-label">Department response</label>
                {responded ? (
                  <DepartmentResponseDisplay responseData={task.response_data} attachmentUrl={task.attachment_url} />
                ) : (
                  <p className="muted">The department has not submitted a response yet.</p>
                )}
              </div>

              {showReviewForm && review ? (
                <>
                  <div className="form-row">
                    <label htmlFor="dept-review-comments">Notes to department (required for modification)</label>
                    <textarea
                      id="dept-review-comments"
                      rows={4}
                      value={review.comments}
                      onChange={(e) => review.onCommentsChange(e.target.value)}
                      placeholder="e.g. Please add disaggregated data for female respondents."
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  {review.error ? <p className="login-error">{review.error}</p> : null}
                  <ModalActions>
                    <Button variant="secondary" compact disabled={review.saving} onClick={onClose}>
                      Close
                    </Button>
                    <Button
                      variant="primary"
                      compact
                      disabled={review.saving}
                      onClick={() => void review.onAccept()}
                    >
                      {review.saving ? 'Saving…' : 'Accept'}
                    </Button>
                    <Button
                      variant="secondary"
                      compact
                      disabled={review.saving}
                      onClick={() => void review.onRequestModification()}
                    >
                      Request modification
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
          )}
        </div>
      </div>
    </div>
  )
}
