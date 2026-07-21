import { Building2, Calendar, CheckCircle2, MapPin } from 'lucide-react'
import type { IndicatorCollectionDisaggregation } from '../lib/indicatorCollectionDisplay'
import {
  coerceIssueEntryKind,
  hrViewIssueDescriptionLabel,
  hrViewIssueTitleLabel,
} from '../lib/issueEntryKind'
import type {
  HrRequestAttachmentRow,
  HrRequestIssueArticle,
  HrRequestStatus,
  HrRequestType,
} from '../types/hrRequest'
import type { IssueEntryKind } from '../lib/issueEntryKind'
import type { StatusBadgeTone } from '../lib/statusBadgeTone'
import { formatAppDate } from '../lib/dateFormat'
import { StatusBadge } from './ui/StatusBadge'
import { IndicatorYearGenderHint } from './IndicatorYearGenderHint'

export { formatAppDate, formatAppDate as formatDueDisplay } from '../lib/dateFormat'

export type HrRequestViewIndicatorRow = {
  id: number
  indicator_text: string
  disaggregation: string | null
  hasQuantitative: boolean
  hasQualitative: boolean
  collectionDisaggregation?: IndicatorCollectionDisaggregation
  quantitative_value: number | null | undefined
  qualitative_text: string | null | undefined
}

type Props = {
  requestId: string
  title: string
  status: HrRequestStatus
  dueDate: string
  /** Region names for this request (shown as pills). */
  regionNames: string[]
  /** @deprecated No longer used; kept for call-site compatibility. */
  showMetaAssigneeRow?: boolean
  /** ICT national-line departments when this request includes ICT; omit or null to hide. */
  ictDepartmentNames?: string[] | null
  /** Direct ICT department assignment (departmental requests); shows instead of region pills. */
  assignedDepartmentNames?: string[] | null
  conventionLabel: string
  issueTitle: string
  /** Issue vs recommendation (from issue catalog). */
  issueEntryKind?: IssueEntryKind | null
  requestType?: HrRequestType | null
  otherIssueText?: string | null
  categoryName: string
  issueDescription?: string | null
  description: string
  regionalInstructionsOnly?: boolean
  regionalInstructionsText?: string | null
  /** When set with `regionalInstructionsOnly`, replaces the default regional heading. */
  instructionsHeading?: string | null
  articles: HrRequestIssueArticle[]
  indicators: HrRequestViewIndicatorRow[]
  attachments?: HrRequestAttachmentRow[] | null
  /** Modifier class on root (e.g. external gradient hero). */
  className?: string
}

export function statusDisplayLabel(status: HrRequestStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'active':
      return 'Active'
    default:
      return status
  }
}

export function statusTone(status: HrRequestStatus): StatusBadgeTone {
  switch (status) {
    case 'draft':
      return 'warning'
    case 'active':
      return 'success'
    default:
      return 'default'
  }
}

export function HrRequestViewTemplate({
  requestId,
  title,
  status,
  dueDate,
  regionNames,
  ictDepartmentNames = null,
  assignedDepartmentNames = null,
  conventionLabel,
  issueTitle,
  issueEntryKind = null,
  requestType = null,
  otherIssueText = null,
  categoryName,
  issueDescription = null,
  description,
  regionalInstructionsOnly = false,
  regionalInstructionsText = null,
  instructionsHeading = null,
  articles,
  indicators,
  attachments,
  className,
}: Props) {
  const metaIconSize = 18
  const isRecommendation = coerceIssueEntryKind(issueEntryKind) === 'recommendation'
  const isOtherIssue = requestType === 'other_issue'
  const ictDepts = (ictDepartmentNames ?? []).filter((n) => n.trim().length > 0)
  const assignedDepts = (assignedDepartmentNames ?? []).filter((n) => n.trim().length > 0)
  const showIctDeptRow = ictDepts.length > 0 && assignedDepts.length === 0

  return (
    <div
      className={
        'hr-request-view-template' + (className?.trim() ? ` ${className.trim()}` : '')
      }
    >
      <header className="hr-request-view-template__hero">
        <div className="hr-request-view-template__hero-top">
          <div>
            <div className="hr-request-view-template__kicker">Request ID</div>
            <div className="hr-request-view-template__req-id">{requestId}</div>
          </div>
          <StatusBadge tone={statusTone(status)}>{statusDisplayLabel(status)}</StatusBadge>
        </div>
        <h1 className="hr-request-view-template__title">{title.trim() || '—'}</h1>

        <div className="hr-request-view-template__hero-meta">
          <div className="hr-request-view-template__meta-chip">
            <Calendar size={metaIconSize} aria-hidden className="hr-request-view-template__meta-icon" />
            <span>
              <span className="hr-request-view-template__meta-chip-label">Due:</span>{' '}
              {formatAppDate(dueDate)}
            </span>
          </div>

          {regionNames.length > 0 ? (
            <div className="hr-request-view-template__meta-block hr-request-view-template__meta-block--regions">
              <div className="hr-request-view-template__meta-block-heading">
                <MapPin size={metaIconSize} aria-hidden className="hr-request-view-template__meta-icon" />
                <span>Assigned regions</span>
              </div>
              <ul className="hr-request-view-template__meta-pills" aria-label="Assigned regions">
                {regionNames.map((name) => (
                  <li key={name}>
                    <span className="hr-request-view-template__meta-pill">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {assignedDepts.length > 0 ? (
            <div className="hr-request-view-template__meta-block hr-request-view-template__meta-block--ict">
              <div className="hr-request-view-template__meta-block-heading">
                <Building2 size={metaIconSize} aria-hidden className="hr-request-view-template__meta-icon" />
                <span>Assigned departments</span>
              </div>
              <ul className="hr-request-view-template__meta-pills" aria-label="Assigned departments">
                {assignedDepts.map((name) => (
                  <li key={name}>
                    <span className="hr-request-view-template__meta-pill hr-request-view-template__meta-pill--ict">
                      {name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showIctDeptRow ? (
            <div className="hr-request-view-template__meta-block hr-request-view-template__meta-block--ict">
              <div className="hr-request-view-template__meta-block-heading">
                <Building2 size={metaIconSize} aria-hidden className="hr-request-view-template__meta-icon" />
                <span>ICT departments</span>
              </div>
              <ul className="hr-request-view-template__meta-pills" aria-label="ICT departments">
                {ictDepts.map((name) => (
                  <li key={name}>
                    <span className="hr-request-view-template__meta-pill hr-request-view-template__meta-pill--ict">
                      {name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </header>

      <section className="hr-request-view-template__card" aria-labelledby="hr-vt-conv-issue">
        <h2 id="hr-vt-conv-issue" className="card-section-heading">
          Convention &amp; {isOtherIssue ? 'Other Issues' : hrViewIssueTitleLabel(issueEntryKind)}
        </h2>
        <div className="hr-request-view-template__grid2">
          <div>
            <div className="hr-request-view-template__field-label">Convention</div>
            <p className="hr-request-view-template__field-value">{conventionLabel}</p>
          </div>
          {isOtherIssue ? null : isRecommendation ? (
            /* Concluding observations have no title — category is the identifying field. */
            <div>
              <div className="hr-request-view-template__field-label">Category</div>
              <p className="hr-request-view-template__field-value">{categoryName}</p>
            </div>
          ) : (
            <>
              <div>
                <div className="hr-request-view-template__field-label">
                  {hrViewIssueTitleLabel(issueEntryKind)}
                </div>
                <p className="hr-request-view-template__field-value">{issueTitle}</p>
              </div>
              <div className="hr-request-view-template__grid2-full">
                <div className="hr-request-view-template__field-label">Category</div>
                <p className="hr-request-view-template__field-value">{categoryName}</p>
              </div>
            </>
          )}
          <div className="hr-request-view-template__grid2-full">
            <div className="hr-request-view-template__field-label">
              {isOtherIssue ? 'Other issue details' : hrViewIssueDescriptionLabel(issueEntryKind)}
            </div>
            {(isOtherIssue ? otherIssueText : issueDescription)?.trim() ? (
              <p
                className="hr-request-view-template__field-value"
                style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
              >
                {(isOtherIssue ? otherIssueText : issueDescription)!.trim()}
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
        {!isOtherIssue ? (
          <>
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
          <ul className="hr-request-view-template__article-list">
            {articles.map((a) => (
              <li key={a.id} className="hr-request-view-template__article-item">
                <span className="hr-request-view-template__article-pill">{a.article_name}</span>
                {a.description?.trim() ? (
                  <p className="hr-request-view-template__article-desc muted">{a.description.trim()}</p>
                ) : null}
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
                        <IndicatorYearGenderHint
                          indicator={
                            ind.collectionDisaggregation ?? {
                              disaggregation: ind.disaggregation,
                            }
                          }
                          style={{ margin: '6px 0 0' }}
                        />
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
          </>
        ) : (
          <h2 id="hr-vt-art-ind" className="card-section-heading">
            Request information
          </h2>
        )}

        <div className="hr-request-view-template__field-label" style={{ margin: '22px 0 10px' }}>
          {regionalInstructionsOnly
            ? instructionsHeading?.trim() || 'Instructions from your regional administration'
            : 'Request description'}
        </div>
        <div className="hr-request-view-template__prose-box">
          {regionalInstructionsOnly ? (
            regionalInstructionsText?.trim() ? (
              <p className="hr-request-view-template__prose">{regionalInstructionsText.trim()}</p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                No assignment instructions were provided for this task.
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
