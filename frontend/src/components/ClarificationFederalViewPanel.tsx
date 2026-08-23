import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  clarificationStatusPresentation,
  fetchClarification,
  respondToClarification,
  type HrRequestClarificationRow,
} from '../api/clarifications'
import { isApiError } from '../api/apiError'
import { formatAppDateTime } from '../lib/dateFormat'
import { ClarificationThreadCard } from './ClarificationThreadCard'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { PendingFileAttachmentRow } from './PendingFileAttachmentRow'
import { StatusBadge } from './ui/StatusBadge'
import {
  ictDepartmentNamesForRequest,
  regionNamesForFederalOriginalView,
} from '../lib/hrRequestForwardedViewTemplateProps'
import { indicatorsScopedToRequest } from '../lib/hrRequestIndicatorScope'
import { issueEntryPrimaryText } from '../lib/issueEntryKind'
import { inferReportingFramework } from '../lib/hrRequestReportingFramework'
import type { HrRequestRow } from '../types/hrRequest'

type Props = {
  clarificationId: number
  onClose: () => void
  onResponded: () => void
}

function conventionLabel(hr: HrRequestRow): string {
  if (hr.convention) return `${hr.convention.code} — ${hr.convention.name}`
  return hr.conv || '—'
}

function formatClarificationMeta(row: HrRequestClarificationRow, side: 'region' | 'federal'): string | null {
  const parts: string[] = []
  if (side === 'region') {
    if (row.requested_by_name) parts.push(`Submitted by ${row.requested_by_name}`)
    if (row.region_submitted_at) parts.push(formatAppDateTime(row.region_submitted_at))
  } else {
    if (row.responded_by_name) parts.push(`Responded by ${row.responded_by_name}`)
    if (row.federal_responded_at) parts.push(formatAppDateTime(row.federal_responded_at))
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function ClarificationFederalViewPanel({ clarificationId, onClose, onResponded }: Props) {
  const [row, setRow] = useState<HrRequestClarificationRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [federalResponse, setFederalResponse] = useState('')
  const [federalFile, setFederalFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchClarification(clarificationId)
      .then((data) => {
        if (!cancelled) {
          setRow(data)
          setFederalResponse(data.federal_response ?? '')
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clarificationId])

  const hrRequest = row?.hr_request ?? null
  const regionAttachments = row?.attachments?.filter((a) => a.side === 'region') ?? []
  const federalAttachments = row?.attachments?.filter((a) => a.side === 'federal') ?? []
  const canRespond = row?.status === 'pending_federal'

  const viewTemplateProps = useMemo(() => {
    if (!hrRequest?.issue) return null
    const issue = hrRequest.issue
    const regionNames = regionNamesForFederalOriginalView(hrRequest)
    return {
      requestId: hrRequest.id,
      title: hrRequest.title,
      status: hrRequest.status,
      dueDate: hrRequest.date,
      regionNames,
      ictDepartmentNames: hrRequest ? ictDepartmentNamesForRequest(hrRequest) : null,
      conventionLabel: conventionLabel(hrRequest),
      issueTitle: issueEntryPrimaryText(issue),
      issueEntryKind:
        issue.entry_kind === 'recommendation' ? ('recommendation' as const) : ('issue' as const),
      requestType: hrRequest.request_type,
      reportingFramework: inferReportingFramework(hrRequest) || null,
      otherIssueText: hrRequest.other_issue_text?.trim() || null,
      categoryName: issue.category?.name ?? '—',
      issueDescription: issue.description ?? null,
      description: hrRequest.details ?? '',
      articles: issue.articles ?? [],
      indicators: indicatorsScopedToRequest(hrRequest).map((ind) => {
        const resp = hrRequest.indicator_responses?.find((r) => r.issue_indicator_id === ind.id)
        return {
          id: ind.id,
          indicator_text: ind.indicator_text,
          disaggregation: ind.disaggregation,
          hasQuantitative: Boolean(ind.has_quantitative),
          hasQualitative: Boolean(ind.has_qualitative),
          quantitative_value: resp?.quantitative_value,
          qualitative_text: resp?.qualitative_text,
        }
      }),
      attachments: hrRequest.attachments,
    }
  }, [hrRequest])

  return (
    <div className="clarification-federal-view">
      <div className="clarification-federal-view__toolbar">
        <Button variant="link" compact onClick={onClose}>
          ← Back to clarifications list
        </Button>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && (
        <Alert variant="error" title="Could not load clarification" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!loading && row && (
        <div className="modal-card modal-card-wide hr-request-modal--page clarification-federal-view__card">
          <div className="clarification-federal-view__header pad-modal">
            <div className="clarification-federal-view__header-row">
              <h3 className="clarification-federal-view__heading">Clarification — {row.hr_request_id}</h3>
              <StatusBadge tone={clarificationStatusPresentation(row.status).tone}>
                {clarificationStatusPresentation(row.status).label}
              </StatusBadge>
            </div>
            {row.region_name ? <p className="muted text-compact clarification-federal-view__region">{row.region_name}</p> : null}
          </div>

          <div className="modal-form hr-request-view-template-modal clarification-federal-view__body">
            {viewTemplateProps ? (
              <>
                <h4 className="hr-request-view-template__field-label clarification-federal-view__section-label">
                  Original request
                </h4>
                <HrRequestViewTemplate {...viewTemplateProps} />
              </>
            ) : hrRequest ? (
              <Alert variant="warning" title="Limited request data">
                <Link to={`/requests/${encodeURIComponent(hrRequest.id)}?from=/requests/clarifications`}>
                  Open full request view
                </Link>
              </Alert>
            ) : null}

            <div className="hr-request-view-template-modal__workflow">
              <ClarificationThreadCard
                variant="region"
                title="Regional clarification request"
                meta={formatClarificationMeta(row, 'region')}
                message={row.region_message}
                attachments={regionAttachments}
              />

              {row.federal_response && !canRespond ? (
                <ClarificationThreadCard
                  variant="federal"
                  title="Federal response sent"
                  meta={formatClarificationMeta(row, 'federal')}
                  message={row.federal_response}
                  attachments={federalAttachments}
                />
              ) : null}

              {canRespond && (
                <section className="hr-request-view-template__card clarification-thread-card clarification-thread-card--federal-form">
                  <h4 className="clarification-thread-card__title">Federal clarification response</h4>
                  <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
                    Explain what the region needs to know so they can proceed with departmental assignment.
                  </p>
                  <div className="form-row">
                    <label htmlFor="federal-clarification-response">Response</label>
                    <textarea
                      id="federal-clarification-response"
                      rows={8}
                      value={federalResponse}
                      onChange={(e) => setFederalResponse(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="form-row" style={{ marginTop: 12 }}>
                    <label htmlFor="federal-clarification-file">Attachment (optional)</label>
                    <input
                      id="federal-clarification-file"
                      type="file"
                      onChange={(e) => {
                        setFederalFile(e.target.files?.[0] ?? null)
                        e.target.value = ''
                      }}
                    />
                  </div>
                  {federalFile && <PendingFileAttachmentRow file={federalFile} onRemove={() => setFederalFile(null)} />}
                  {submitError && <p className="login-error">{submitError}</p>}
                  <div style={{ marginTop: 16 }}>
                    <Button
                      variant="primary"
                      compact
                      disabled={submitting}
                      onClick={() => {
                        void (async () => {
                          setSubmitting(true)
                          setSubmitError(null)
                          try {
                            await respondToClarification(row.id, federalResponse.trim(), federalFile)
                            onResponded()
                          } catch (e: unknown) {
                            setSubmitError(isApiError(e) ? e.message : 'Submit failed')
                          } finally {
                            setSubmitting(false)
                          }
                        })()
                      }}
                    >
                      {submitting ? 'Sending…' : 'Send clarification to region'}
                    </Button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
