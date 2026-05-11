import { Calendar, CheckCircle2, MapPin, User } from 'lucide-react'
import type { HrRequestAttachmentRow, HrRequestIssueArticle, HrRequestStatus } from '../types/hrRequest'
import { StatusBadge } from './ui/StatusBadge'

export type HrRequestViewIndicatorRow = {
  id: number
  indicator_text: string
  disaggregation: string | null
  hasQuantitative: boolean
  hasQualitative: boolean
  quantitative_value: number | null | undefined
  qualitative_text: string | null | undefined
}

type Props = {
  requestId: string
  title: string
  status: HrRequestStatus
  dueDate: string
  /** Region names for this request */
  regionNames: string[]
  /** When false, hides the third meta item (regional assignee / multi-region summary). */
  showMetaAssigneeRow?: boolean
  conventionLabel: string
  issueTitle: string
  categoryName: string
  /** Catalog issue narrative (Super Admin → Issues), distinct from per-request details below. */
  issueDescription?: string | null
  /** Federal / HR request notes (not shown to department portal when regionalInstructionsOnly is set). */
  description: string
  /** When true, the prose block shows regional assignment instructions instead of federal request description. */
  regionalInstructionsOnly?: boolean
  /** Text from regional admin when assigning the task (may be empty). */
  regionalInstructionsText?: string | null
  articles: HrRequestIssueArticle[]
  indicators: HrRequestViewIndicatorRow[]
  attachments?: HrRequestAttachmentRow[] | null
}

function formatDueDisplay(iso: string): string {
  if (!iso?.trim()) return '—'
  const d = new Date(`${iso.trim()}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusDisplayLabel(status: HrRequestStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'active':
      return 'Active'
    default:
      return status
  }
}

function statusTone(status: HrRequestStatus): 'pending' | 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'draft':
      return 'pending'
    case 'active':
      return 'success'
    default:
      return 'default'
  }
}

function metaAssigneeLine(regionNames: string[]): string {
  if (regionNames.length === 0) return '—'
  if (regionNames.length === 1) return `${regionNames[0]} regional admin`
  return `${regionNames.length} regions`
}

export function HrRequestViewTemplate({
  requestId,
  title,
  status,
  dueDate,
  regionNames,
  showMetaAssigneeRow = true,
  conventionLabel,
  issueTitle,
  categoryName,
  issueDescription = null,
  description,
  regionalInstructionsOnly = false,
  regionalInstructionsText = null,
  articles,
  indicators,
  attachments,
}: Props) {
  const metaIconSize = 18
  const regionLine = regionNames.length > 0 ? regionNames.join(', ') : '—'

  return (
    <div className="hr-request-view-template">
      <header className="hr-request-view-template__hero">
        <div className="hr-request-view-template__hero-top">
          <div>
            <div className="hr-request-view-template__kicker">Request ID</div>
            <div className="hr-request-view-template__req-id">{requestId}</div>
          </div>
          <StatusBadge tone={statusTone(status)}>{statusDisplayLabel(status)}</StatusBadge>
        </div>
        <h1 className="hr-request-view-template__title">{title.trim() || '—'}</h1>
        <div className="hr-request-view-template__meta-row">
          <span className="hr-request-view-template__meta-item">
            <Calendar size={metaIconSize} aria-hidden className="hr-request-view-template__meta-icon" />
            Due: {formatDueDisplay(dueDate)}
          </span>
          <span className="hr-request-view-template__meta-item">
            <MapPin size={metaIconSize} aria-hidden className="hr-request-view-template__meta-icon" />
            {regionLine}
          </span>
          {showMetaAssigneeRow ? (
            <span className="hr-request-view-template__meta-item">
              <User size={metaIconSize} aria-hidden className="hr-request-view-template__meta-icon" />
              {metaAssigneeLine(regionNames)}
            </span>
          ) : null}
        </div>
      </header>

      <section className="hr-request-view-template__card" aria-labelledby="hr-vt-conv-issue">
        <h2 id="hr-vt-conv-issue" className="card-section-heading">
          Convention &amp; issue
        </h2>
        <div className="hr-request-view-template__grid2">
          <div>
            <div className="hr-request-view-template__field-label">Convention</div>
            <p className="hr-request-view-template__field-value">{conventionLabel}</p>
          </div>
          <div>
            <div className="hr-request-view-template__field-label">Issue</div>
            <p className="hr-request-view-template__field-value">{issueTitle}</p>
          </div>
          <div className="hr-request-view-template__grid2-full">
            <div className="hr-request-view-template__field-label">Category</div>
            <p className="hr-request-view-template__field-value">{categoryName}</p>
          </div>
          <div className="hr-request-view-template__grid2-full">
            <div className="hr-request-view-template__field-label">Issue description</div>
            {issueDescription?.trim() ? (
              <p
                className="hr-request-view-template__field-value"
                style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
              >
                {issueDescription.trim()}
              </p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                —
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="hr-request-view-template__card" aria-labelledby="hr-vt-art-ind">
        <h2 id="hr-vt-art-ind" className="card-section-heading">
          Articles &amp; indicators
        </h2>
        <div className="hr-request-view-template__field-label" style={{ marginBottom: 10 }}>
          Relevant articles
        </div>
        {articles.length === 0 ? (
          <p className="muted" style={{ marginTop: 0 }}>
            —
          </p>
        ) : (
          <ul className="hr-request-view-template__article-pills">
            {articles.map((a) => (
              <li key={a.id}>
                <span className="hr-request-view-template__article-pill">{a.article_name}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="hr-request-view-template__field-label" style={{ margin: '18px 0 10px' }}>
          Indicators for this request
        </div>
        <div className="hr-request-view-template__indicators-box">
          {indicators.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              —
            </p>
          ) : (
            <ul className="hr-request-view-template__indicator-list">
              {indicators.map((ind) => {
                const typeBits = [
                  ind.hasQuantitative ? 'Quantitative' : null,
                  ind.hasQualitative ? 'Qualitative' : null,
                ].filter(Boolean) as string[]
                const hasFedQuant =
                  ind.quantitative_value != null && !Number.isNaN(Number(ind.quantitative_value))
                const hasFedQual = Boolean(ind.qualitative_text?.trim())
                return (
                  <li key={ind.id} className="hr-request-view-template__indicator-item">
                    <div className="hr-request-view-template__indicator-row">
                      <CheckCircle2
                        className="hr-request-view-template__check"
                        size={22}
                        aria-hidden
                        strokeWidth={2.25}
                      />
                      <div className="hr-request-view-template__indicator-main">
                        <div className="hr-request-view-template__indicator-title-line">
                          <span className="hr-request-view-template__indicator-text">
                            {ind.indicator_text}
                          </span>
                          {typeBits.map((t) => (
                            <span key={t} className="hr-request-view-template__type-pill">
                              {t}
                            </span>
                          ))}
                        </div>
                        {ind.disaggregation?.trim() ? (
                          <p className="muted small" style={{ margin: '6px 0 0' }}>
                            {ind.disaggregation}
                          </p>
                        ) : null}
                        {(hasFedQuant || hasFedQual) && (
                          <div className="hr-request-view-template__federal-values muted small">
                            {hasFedQuant ? <div>Request quantitative: {ind.quantitative_value}</div> : null}
                            {hasFedQual ? (
                              <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                Request qualitative: {ind.qualitative_text}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="hr-request-view-template__field-label" style={{ margin: '22px 0 10px' }}>
          {regionalInstructionsOnly
            ? 'Instructions from your regional administration'
            : 'Request description'}
        </div>
        <div className="hr-request-view-template__prose-box">
          {regionalInstructionsOnly ? (
            regionalInstructionsText?.trim() ? (
              <p className="hr-request-view-template__prose">{regionalInstructionsText.trim()}</p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                No instructions were provided by your regional administration for this assignment.
              </p>
            )
          ) : description?.trim() ? (
            <p className="hr-request-view-template__prose">{description.trim()}</p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No additional description was provided for this request.
            </p>
          )}
        </div>
      </section>

      {attachments && attachments.length > 0 ? (
        <section className="hr-request-view-template__card" aria-labelledby="hr-vt-files">
          <h2 id="hr-vt-files" className="card-section-heading">
            Uploaded files
          </h2>
          <ul className="hr-request-attachments-list">
            {attachments.map((a) => (
              <li key={a.id} className="hr-request-attachments-list__item">
                <span className="hr-request-attachments-list__name">{a.original_name}</span>
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-compact"
                  >
                    View
                  </a>
                ) : (
                  <span className="muted small">Preview not available</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
