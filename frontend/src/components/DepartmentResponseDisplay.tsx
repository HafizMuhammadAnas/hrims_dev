import { parseDepartmentTaskResponseData } from '../lib/departmentTaskResponseFormat'

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
}

export function DepartmentResponseDisplay({
  responseData,
  attachmentUrl,
  onlyIndicatorIds,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {entries.map(([id, bundle]) => {
        const title = bundle.indicator_label?.trim() || `Indicator #${id}`
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
                <div className="muted small" style={{ marginBottom: 6 }}>
                  Quantitative
                </div>
                <div className="text-sm">Number: {bundle.quantitative.value}</div>
                {bundle.quantitative.comment ? (
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
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

