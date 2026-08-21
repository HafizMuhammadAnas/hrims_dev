import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { fetchHrRequest } from '../api/hrRequests'
import type { DepartmentTaskRow, RegionalResponseRow } from '../api/lists'
import { updateRegionalReview } from '../api/workflows'
import { downloadElementAsPdf } from '../lib/downloadElementAsPdf'
import { downloadElementAsWord } from '../lib/downloadElementAsWord'
import { buildFederalOriginalRequestViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'
import { regionalResponseFederalReviewPath } from '../lib/workflowNavigation'
import { regionalResponseReviewPresentation } from '../lib/regionalResponseReviewStatus'
import type { HrRequestRow } from '../types/hrRequest'
import { DepartmentSubmissionsForRequest } from './DepartmentSubmissionsForRequest'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
import { RegionalFederalReviewFeedback } from './RegionalFederalReviewFeedback'
import { RegionalCompilationChangesTab } from './RegionalCompilationChangesTab'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/StatusBadge'
import { WorkflowActionFootback, type WorkflowActionFeedback } from './WorkflowActionFootback'
import { loiLegacyFormatMessage } from '../lib/issueEntryKind'
import { WorkflowModalHero } from './ui/WorkflowModalHero'

type Tab = 'responses' | 'request' | 'changes'

type ReviewStatus = 'pending' | 'accepted' | 'needs-modification'

type Props = {
  viewing: RegionalResponseRow
  allResponses: RegionalResponseRow[]
  tasks: DepartmentTaskRow[]
  canReviewFederal: boolean
  fromPath: string
  onReviewSaved?: () => void
}

export function RegionalResponseFederalReviewView({
  viewing,
  allResponses,
  tasks,
  canReviewFederal,
  fromPath,
  onReviewSaved,
}: Props) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('responses')
  const [viewingRow, setViewingRow] = useState(viewing)
  const [hrDetail, setHrDetail] = useState<HrRequestRow | null>(null)
  const [hrLoading, setHrLoading] = useState(false)
  const [hrError, setHrError] = useState<string | null>(null)
  const [reviewComments, setReviewComments] = useState(viewing.comments ?? '')
  const [actionFeedback, setActionFeedback] = useState<WorkflowActionFeedback | null>(null)
  const [saving, setSaving] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [wordLoading, setWordLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const isUnderReview = viewingRow.review_status === 'pending'

  useEffect(() => {
    setViewingRow(viewing)
    setReviewComments(viewing.comments ?? '')
    setTab('responses')
    setActionFeedback(null)
    setExportError(null)
  }, [viewing.id])

  useEffect(() => {
    if (!viewingRow.req_id) {
      setHrDetail(null)
      setHrError(null)
      setHrLoading(false)
      return
    }
    let cancelled = false
    setHrLoading(true)
    setHrError(null)
    void fetchHrRequest(viewingRow.req_id)
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
  }, [viewingRow.req_id])

  const tasksForViewing = useMemo(() => {
    const regionId = viewingRow.region_id
    const filtered =
      regionId != null
        ? tasks.filter((t) => t.req_id === viewingRow.req_id && t.region_id === regionId)
        : tasks.filter((t) => t.req_id === viewingRow.req_id)
    return filtered.sort((a, b) => {
      const an = (a.department_name ?? a.department_id).toLowerCase()
      const bn = (b.department_name ?? b.department_id).toLowerCase()
      return an.localeCompare(bn)
    })
  }, [tasks, viewingRow.req_id, viewingRow.region_id])

  const allResponsesForRequest = useMemo(
    () =>
      allResponses
        .filter((r) => r.req_id === viewingRow.req_id)
        .sort(
          (a, b) =>
            (a.region_name ?? '').localeCompare(b.region_name ?? '') || a.id.localeCompare(b.id),
        ),
    [allResponses, viewingRow.req_id],
  )

  const federalRequestTemplateProps = useMemo(
    () => (hrDetail ? buildFederalOriginalRequestViewTemplateProps(hrDetail) : null),
    [hrDetail],
  )

  async function persistReview(status: ReviewStatus, comments: string) {
    setSaving(true)
    setActionFeedback(null)
    try {
      await updateRegionalReview(viewingRow.id, status, comments)
      onReviewSaved?.()
      navigate(fromPath.startsWith('/') ? fromPath : `/${fromPath}`)
    } catch (e) {
      setActionFeedback({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to save review',
      })
    } finally {
      setSaving(false)
    }
  }

  function switchRegion(resp: RegionalResponseRow) {
    navigate(regionalResponseFederalReviewPath(resp.id, fromPath))
  }

  function exportFilenameBase(): string {
    return [
      viewingRow.req_id,
      viewingRow.region_name?.trim() || 'region',
      viewingRow.title?.trim() || viewingRow.id,
    ]
      .filter(Boolean)
      .join(' — ')
  }

  async function handleDownloadPdf() {
    const el = exportRef.current
    if (!el) return
    setPdfLoading(true)
    setExportError(null)
    try {
      await downloadElementAsPdf(el, exportFilenameBase(), {
        captureClass: 'regional-response-export-capture',
        marginMm: 10,
        headerTitle: exportFilenameBase(),
      })
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Could not generate PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleDownloadWord() {
    const el = exportRef.current
    if (!el) return
    setWordLoading(true)
    setExportError(null)
    try {
      await downloadElementAsWord(el, exportFilenameBase(), {
        captureClass: 'regional-response-export-capture',
        documentTitle: exportFilenameBase(),
      })
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Could not generate Word document.')
    } finally {
      setWordLoading(false)
    }
  }

  return (
    <div className="modal-card modal-card-wide regional-responses-full-modal regional-response-detail-modal hr-request-dept-portal-tabs workflow-tabbed-card">
      <WorkflowModalHero
        eyebrow="Federal review"
        title={viewingRow.region_name ?? 'Regional response'}
        embedded
      >
        <StatusBadge tone={regionalResponseReviewPresentation(viewingRow.review_status).tone}>
          {regionalResponseReviewPresentation(viewingRow.review_status).label}
        </StatusBadge>
        <span className="workflow-modal-hero__chip">{viewingRow.req_id}</span>
      </WorkflowModalHero>

      <nav
        className="compiled-record-modal-tabs dept-task-response-modal__tabs"
        aria-label="Regional response and request"
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
        <button
          type="button"
          className={'compiled-record-modal-tab' + (tab === 'changes' ? ' compiled-record-modal-tab--active' : '')}
          onClick={() => setTab('changes')}
        >
          Changes
        </button>
      </nav>

      <div className="modal-form regional-response-detail-modal__form dept-task-response-modal__body regional-response-detail-modal__form--flat">
        {tab === 'responses' ? (
          <>
            {isUnderReview ? (
              <div className="compiled-record-pdf-toolbar regional-response-detail-modal__download-toolbar">
                <Button
                  variant="secondary"
                  compact
                  type="button"
                  disabled={pdfLoading || wordLoading || hrLoading}
                  onClick={() => void handleDownloadPdf()}
                >
                  <Download size={16} strokeWidth={2} aria-hidden style={{ marginRight: 6 }} />
                  {pdfLoading ? 'Generating PDF…' : 'Download PDF'}
                </Button>
                <Button
                  variant="secondary"
                  compact
                  type="button"
                  disabled={pdfLoading || wordLoading || hrLoading}
                  onClick={() => void handleDownloadWord()}
                >
                  <Download size={16} strokeWidth={2} aria-hidden style={{ marginRight: 6 }} />
                  {wordLoading ? 'Generating Word…' : 'Download Word'}
                </Button>
                {exportError ? <span className="login-error small">{exportError}</span> : null}
              </div>
            ) : null}

            <div ref={exportRef} className="regional-response-detail-modal__export-body">
              <h2 className="card-section-heading">Department submissions</h2>
              <DepartmentSubmissionsForRequest
                tasksForDetail={tasksForViewing}
                reqId={viewingRow.req_id}
                issueIndicators={hrDetail?.issue?.indicators}
                filterByRegionId={viewingRow.region_id ?? undefined}
                omitHeading
                showCardMeta
                hideStatusBadge
              />

              <h2 className="card-section-heading">Summary</h2>
              <div className="hr-request-view-template__prose-box">
                {viewingRow.content?.trim() ? (
                  <p className="hr-request-view-template__prose regional-response-detail-modal__summary">
                    {viewingRow.content.trim()}
                  </p>
                ) : (
                  <p className="muted regional-response-detail-modal__summary-empty">—</p>
                )}
              </div>
            </div>

            {canReviewFederal && isUnderReview ? (
              <div className="form-row regional-response-detail-modal__feedback-field">
                <label htmlFor="regional-fed-review-comments">Feedback to the region</label>
                <textarea
                  id="regional-fed-review-comments"
                  rows={4}
                  value={reviewComments}
                  onChange={(e) => {
                    setReviewComments(e.target.value)
                    if (actionFeedback) setActionFeedback(null)
                  }}
                  placeholder="Optional for acceptance. Required when requesting modification."
                  aria-invalid={actionFeedback?.kind === 'validation' ? true : undefined}
                />
              </div>
            ) : null}

            {canReviewFederal && !isUnderReview ? (
              <RegionalFederalReviewFeedback row={viewingRow} />
            ) : null}

            {canReviewFederal &&
            allResponsesForRequest.length > 1 &&
            allResponsesForRequest.some((r) => r.id !== viewingRow.id) ? (
              <div className="regional-responses-others">
                <p className="regional-responses-others__label muted small">Other regions on this request</p>
                <div className="regional-responses-others__actions">
                  {allResponsesForRequest
                    .filter((r) => r.id !== viewingRow.id)
                    .map((resp) => (
                      <Button
                        key={resp.id}
                        variant="secondary"
                        compact
                        type="button"
                        onClick={() => switchRegion(resp)}
                      >
                        {resp.region_name ?? 'Region'}
                      </Button>
                    ))}
                </div>
              </div>
            ) : null}

            {canReviewFederal && isUnderReview ? (
              <WorkflowActionFootback
                feedback={actionFeedback}
                onDismiss={() => setActionFeedback(null)}
                style={{ marginTop: 8 }}
              >
                <Button
                  variant="primary"
                  compact
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setActionFeedback(null)
                    void persistReview('accepted', reviewComments)
                  }}
                >
                  {saving ? 'Saving…' : 'Accept response'}
                </Button>
                <Button
                  variant="secondary"
                  compact
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (!reviewComments.trim()) {
                      setActionFeedback({
                        kind: 'validation',
                        message: 'Add feedback for the region when requesting modification.',
                      })
                      return
                    }
                    void persistReview('needs-modification', reviewComments)
                  }}
                >
                  {saving ? 'Saving…' : 'Request modification'}
                </Button>
              </WorkflowActionFootback>
            ) : null}
          </>
        ) : null}

        {tab === 'request' ? (
          <>
            {hrLoading ? <p className="muted">Loading request…</p> : null}
            {hrError ? (
              <Alert variant="warning" title="Could not load the HR request">
                <p style={{ margin: 0 }}>{hrError}</p>
              </Alert>
            ) : null}
            {!hrLoading && !hrError && federalRequestTemplateProps ? (
              <HrRequestViewTemplate {...federalRequestTemplateProps} />
            ) : null}
            {!hrLoading && !hrError && hrDetail && !federalRequestTemplateProps ? (
              <p className="muted small" style={{ margin: 0 }}>
                {loiLegacyFormatMessage()}
              </p>
            ) : null}
          </>
        ) : null}

        {tab === 'changes' ? (
          <RegionalCompilationChangesTab
            regionalResponseId={viewingRow.id}
            currentTitle={viewingRow.title}
            currentContent={viewingRow.content}
            tasks={tasksForViewing}
            issueIndicators={hrDetail?.issue?.indicators}
            audience="federal"
          />
        ) : null}
      </div>
    </div>
  )
}
