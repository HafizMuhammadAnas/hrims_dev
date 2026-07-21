import { useEffect, useMemo, useState } from 'react'
import { fetchHrRequest } from '../api/hrRequests'
import {
  fetchDepartmentTasks,
  fetchRegionalResponses,
  type CompiledRecordRow,
  type DepartmentTaskRow,
} from '../api/lists'
import {
  loadCompiledRecordRegionBlocks,
  type CompiledRecordRegionBlock,
} from '../lib/compiledRecordDepartmentTasks'
import { buildFederalOriginalRequestViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'
import { loiLegacyFormatMessage } from '../lib/issueEntryKind'
import type { HrRequestRow } from '../types/hrRequest'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
import { Alert } from './ui/Alert'
import { StatusBadge } from './ui/StatusBadge'
import { WorkflowModalHero } from './ui/WorkflowModalHero'

type Props = {
  record: CompiledRecordRow
  /** Fired when request + responses have finished loading (success or empty). */
  onReadyChange?: (ready: boolean) => void
}

function compiledStatusTone(status: string): 'success' | 'warning' | 'default' {
  if (status === 'submitted') return 'success'
  if (status === 'draft') return 'warning'
  return 'default'
}

function formatCompiledStatusLabel(status: string): string {
  if (status === 'submitted') return 'Submitted'
  if (status === 'draft') return 'Draft'
  const s = status.replace(/-/g, ' ')
  if (!s) return status
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Full compiled-record document body (request + regional responses + summary)
 * used for single-record view and multi-record merge export.
 */
export function CompiledRecordPrintDocument({ record, onReadyChange }: Props) {
  const regions = record.region_names ?? []
  const regionKey = regions.join('\u0001')
  const [hrDetail, setHrDetail] = useState<HrRequestRow | null>(null)
  const [hrLoading, setHrLoading] = useState(false)
  const [hrError, setHrError] = useState<string | null>(null)
  const [regionBlocks, setRegionBlocks] = useState<CompiledRecordRegionBlock[]>([])
  const [responsesLoading, setResponsesLoading] = useState(false)
  const [responsesError, setResponsesError] = useState<string | null>(null)

  useEffect(() => {
    const reqId = record.req_id
    if (!reqId) {
      setHrDetail(null)
      setHrError(null)
      setHrLoading(false)
      return
    }
    let cancelled = false
    setHrLoading(true)
    setHrError(null)
    void fetchHrRequest(reqId)
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
  }, [record.req_id])

  useEffect(() => {
    const reqId = record.req_id
    if (!reqId || regions.length === 0) {
      setRegionBlocks([])
      setResponsesError(null)
      setResponsesLoading(false)
      return
    }
    let cancelled = false
    setResponsesLoading(true)
    setResponsesError(null)
    void (async () => {
      try {
        const [regionalResponses, indexTasks] = await Promise.all([
          fetchRegionalResponses(),
          fetchDepartmentTasks(),
        ])
        if (cancelled) return
        const blocks = await loadCompiledRecordRegionBlocks(
          record,
          regionalResponses,
          indexTasks as DepartmentTaskRow[],
        )
        if (!cancelled) setRegionBlocks(blocks)
      } catch (e: unknown) {
        if (!cancelled) {
          setResponsesError(e instanceof Error ? e.message : 'Failed to load responses')
        }
      } finally {
        if (!cancelled) setResponsesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [record.id, record.req_id, regionKey])

  const ready = !hrLoading && !responsesLoading

  useEffect(() => {
    onReadyChange?.(ready)
  }, [ready, onReadyChange])

  const requestTemplateProps = useMemo(
    () => (hrDetail ? buildFederalOriginalRequestViewTemplateProps(hrDetail) : null),
    [hrDetail],
  )

  return (
    <div className="ministry-compiled-print-document">
      <WorkflowModalHero
        eyebrow="National compilation"
        title={record.title?.trim() || 'Compiled record'}
        embedded
      >
        <StatusBadge tone={compiledStatusTone(record.status)}>
          {formatCompiledStatusLabel(record.status)}
        </StatusBadge>
        {record.req_id ? <span className="workflow-modal-hero__chip">{record.req_id}</span> : null}
      </WorkflowModalHero>

      <div className="ministry-compiled-modal__body ministry-compiled-single__body">
        <article className="ministry-compiled-region-card ministry-compiled-request-card">
          <h2 className="ministry-compiled-region-card__title">Original request</h2>
          {hrLoading ? <p className="muted">Loading request…</p> : null}
          {hrError ? (
            <Alert variant="warning" title="Could not load the HR request">
              <p style={{ margin: 0 }}>{hrError}</p>
            </Alert>
          ) : null}
          {!hrLoading && !hrError && requestTemplateProps ? (
            <div className="ministry-compiled-embedded-request">
              <HrRequestViewTemplate
                {...requestTemplateProps}
                className="hr-request-view-template--ministry-document"
              />
            </div>
          ) : null}
          {!hrLoading && !hrError && hrDetail && !requestTemplateProps ? (
            <p className="muted small" style={{ margin: 0 }}>
              {loiLegacyFormatMessage()}
            </p>
          ) : null}
        </article>

        {responsesLoading ? <p className="muted">Loading provincial responses…</p> : null}
        {responsesError ? <p className="login-error">{responsesError}</p> : null}

        {!responsesLoading && !responsesError ? (
          regions.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No provinces are listed on this record.
            </p>
          ) : (
            <div className="ministry-compiled-regions-stack">
              {regionBlocks.map(({ regionName, tasks }) => (
                <article key={regionName} className="ministry-compiled-region-card">
                  <h2 className="ministry-compiled-region-card__title">{regionName}</h2>
                  <h3 className="ministry-compiled-region-card__section-label">Responses</h3>
                  {tasks.length === 0 ? (
                    <p className="muted small ministry-compiled-region-card__empty">—</p>
                  ) : (
                    <div className="ministry-compiled-region-card__responses">
                      {tasks.map((t) => (
                        <div key={t.id} className="ministry-compiled-dept-response-item">
                          <DepartmentResponseDisplay
                            responseData={t.response_data}
                            attachmentUrl={t.attachment_url}
                            issueIndicators={hrDetail?.issue?.indicators}
                            locationRegionIds={[t.region_id]}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )
        ) : null}

        <article className="ministry-compiled-region-card ministry-compiled-summary-card">
          <h2 className="ministry-compiled-region-card__title">Summary</h2>
          <div className="ministry-compiled-summary-card__body">
            {record.summary?.trim() ? (
              <p className="hr-request-view-template__prose ministry-compiled-summary-card__prose">
                {record.summary.trim()}
              </p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                No federal summary was saved for this record.
              </p>
            )}
          </div>
        </article>
      </div>
    </div>
  )
}
