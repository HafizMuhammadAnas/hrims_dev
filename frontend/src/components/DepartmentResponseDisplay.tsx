import { DepartmentIndicatorDataMatrix } from './DepartmentIndicatorDataMatrix'
import {
  parseDepartmentTaskResponseData,
  type DepartmentIndicatorBundle,
  type DepartmentQuantitativeByYearGender,
} from '../lib/departmentTaskResponseFormat'
import { deptFormUsesIndicatorMatrix, indicatorUsesDataMatrix } from '../lib/indicatorMatrixColumns'
import type { HrRequestIssueIndicator } from '../types/hrRequest'

function bundleHasSupplementaryContent(bundle: DepartmentIndicatorBundle): boolean {
  const hasMatrix = Boolean(
    bundle.quantitative?.by_year_gender && Object.keys(bundle.quantitative.by_year_gender).length > 0,
  )
  if (bundle.qualitative?.text?.trim() || bundle.qualitative?.attachment_url?.trim()) return true
  if (bundle.quantitative?.comment?.trim() || bundle.quantitative?.attachment_url?.trim()) return true
  if (
    bundle.quantitative?.value != null &&
    !Number.isNaN(bundle.quantitative.value) &&
    !hasMatrix
  ) {
    return true
  }
  return false
}

export function AttachmentViewLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="dept-response-attachment-btn">
      View attachment
    </a>
  )
}

type Props = {
  responseData: string | null | undefined
  attachmentUrl?: string | null
  /** For structured payloads, only show these federal-scoped indicator ids (if non-empty). */
  onlyIndicatorIds?: number[]
  /** Issue indicators (for year/gender matrix labels when viewing structured responses). */
  issueIndicators?: HrRequestIssueIndicator[]
}

export function DepartmentResponseDisplay({
  responseData,
  attachmentUrl,
  onlyIndicatorIds,
  issueIndicators = [],
}: Props) {
  const parsed = parseDepartmentTaskResponseData(responseData, attachmentUrl)

  if (parsed.kind === 'legacy') {
    const text = parsed.text?.trim() ? parsed.text : '—'
    return (
      <>
        <textarea
          readOnly
          rows={8}
          value={text}
          className="hr-request-readonly-prose"
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        {parsed.attachmentUrl ? (
          <div style={{ marginTop: 10 }}>
            <AttachmentViewLink url={parsed.attachmentUrl} />
          </div>
        ) : null}
      </>
    )
  }

  let entries = Object.entries(parsed.payload.by_indicator).sort(([a], [b]) => Number(a) - Number(b))
  if (onlyIndicatorIds && onlyIndicatorIds.length > 0) {
    const allow = new Set(onlyIndicatorIds.map((id) => String(id)))
    entries = entries.filter(([id]) => allow.has(id))
  }
  if (entries.length === 0) {
    return <p className="muted">—</p>
  }

  const scopedIndicators =
    onlyIndicatorIds && onlyIndicatorIds.length > 0
      ? issueIndicators.filter((i) => onlyIndicatorIds.includes(i.id))
      : issueIndicators

  const savedByIndicator: Record<string, { by_year_gender?: DepartmentQuantitativeByYearGender | null }> = {}
  for (const [id, bundle] of entries) {
    if (bundle.quantitative?.by_year_gender) {
      savedByIndicator[id] = { by_year_gender: bundle.quantitative.by_year_gender }
    }
  }

  const matrixIndicatorIds = new Set(
    entries
      .filter(
        ([, bundle]) =>
          bundle.quantitative?.by_year_gender &&
          Object.keys(bundle.quantitative.by_year_gender).length > 0,
      )
      .map(([id]) => Number(id)),
  )
  const matrixIndicators = scopedIndicators.filter(
    (ind) => matrixIndicatorIds.has(ind.id) && indicatorUsesDataMatrix(ind),
  )
  const showMatrix =
    matrixIndicators.length > 0 && deptFormUsesIndicatorMatrix(matrixIndicators)

  const cardEntries = entries.filter(([, bundle]) => bundleHasSupplementaryContent(bundle))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {showMatrix ? (
        <>
          <h4 className="font-semibold text-compact" style={{ margin: 0 }}>
            Data by year and gender
          </h4>
          <DepartmentIndicatorDataMatrix
            indicators={matrixIndicators}
            cellValues={{}}
            readOnly
            savedByIndicator={savedByIndicator}
          />
        </>
      ) : null}
      {cardEntries.length > 0 ? (
        <h4 className="font-semibold text-compact" style={{ margin: showMatrix ? '8px 0 0' : 0 }}>
          Comments, narrative responses, and attachments
        </h4>
      ) : null}
      {cardEntries.map(([id, bundle]) => {
        const title = bundle.indicator_label?.trim() || `Indicator #${id}`
        const hasMatrix = Boolean(
          bundle.quantitative?.by_year_gender && Object.keys(bundle.quantitative.by_year_gender).length > 0,
        )
        return (
          <div
            key={id}
            style={{
              padding: 12,
              border: '1px solid var(--field-border, #e1e7f5)',
              borderRadius: 10,
              background: 'var(--field-bg, #fafbfd)',
            }}
          >
            <strong className="text-sm font-semibold" style={{ display: 'block', marginBottom: 10 }}>
              {title}
            </strong>
            {bundle.quantitative ? (
              <div style={{ marginBottom: bundle.qualitative ? 12 : 0 }}>
                {!hasMatrix ? (
                  <>
                    <div className="muted small" style={{ marginBottom: 6 }}>
                      Quantitative
                    </div>
                    <div className="text-sm">Number: {bundle.quantitative.value}</div>
                  </>
                ) : null}
                {bundle.quantitative.comment ? (
                  <p className="muted small" style={{ margin: hasMatrix ? '0 0 6px' : '6px 0 0' }}>
                    Comment: {bundle.quantitative.comment}
                  </p>
                ) : null}
                {bundle.quantitative.attachment_url ? (
                  <div style={{ marginTop: 8 }}>
                    <AttachmentViewLink url={bundle.quantitative.attachment_url} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {bundle.qualitative ? (
              <div>
                <div className="muted small" style={{ marginBottom: 6 }}>
                  Qualitative
                </div>
                {bundle.qualitative.text ? (
                  <p className="text-sm" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {bundle.qualitative.text}
                  </p>
                ) : (
                  <p className="muted small" style={{ margin: 0 }}>
                    (No narrative text)
                  </p>
                )}
                {bundle.qualitative.attachment_url ? (
                  <div style={{ marginTop: 8 }}>
                    <AttachmentViewLink url={bundle.qualitative.attachment_url} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
