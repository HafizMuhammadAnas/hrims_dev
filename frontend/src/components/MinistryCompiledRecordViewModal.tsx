import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { isApiError } from '../api/apiError'
import { fetchHrRequest } from '../api/hrRequests'
import {
  fetchDepartmentTasks,
  fetchRegionalResponseDepartmentTasks,
  fetchRegionalResponses,
  type CompiledRecordRow,
  type DepartmentTaskRow,
  type RegionalResponseRow,
} from '../api/lists'
import { updateCompiledRecord } from '../api/workflows'
import { downloadElementAsPdf } from '../lib/downloadElementAsPdf'
import { hasDepartmentResponse } from '../lib/departmentTaskWorkflow'
import type { StatusBadgeTone } from '../lib/statusBadgeTone'
import { buildFederalOriginalRequestViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { ModalActions } from './ui/ModalChrome'
import { StatusBadge } from './ui/StatusBadge'
import { WorkflowModalHero } from './ui/WorkflowModalHero'

type Props = {
  record: CompiledRecordRow
  onClose?: () => void
  canFinalize: boolean
  onRecordUpdated: (record: CompiledRecordRow) => void
  fromPath: string
  layout?: 'modal' | 'page'
}

type RegionResponseBlock = {
  regionName: string
  tasks: DepartmentTaskRow[]
}

function compiledStatusTone(status: string): StatusBadgeTone {
  if (status === 'submitted') return 'success'
  if (status === 'draft') return 'warning'
  return 'default'
}

function formatCompiledStatusLabel(status: string): string {
  if (status === 'submitted') return 'Submitted to ministry'
  if (status === 'draft') return 'Draft'
  const s = status.replace(/-/g, ' ')
  if (!s) return status
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function findRegionalResponseForRegion(
  responses: RegionalResponseRow[],
  reqId: string,
  regionName: string,
): RegionalResponseRow | null {
  const want = regionName.trim().toLowerCase()
  return (
    responses.find(
      (r) =>
        r.req_id === reqId && (r.region_name ?? '').trim().toLowerCase() === want,
    ) ?? null
  )
}

async function loadDepartmentTasksForRegion(
  reqId: string,
  regionName: string,
  responsesForReq: RegionalResponseRow[],
  ictFallbackTasks: DepartmentTaskRow[],
): Promise<DepartmentTaskRow[]> {
  const regional = findRegionalResponseForRegion(responsesForReq, reqId, regionName)
  if (regional) {
    const tasks = await fetchRegionalResponseDepartmentTasks(regional.id)
    return tasks.filter((t) => hasDepartmentResponse(t))
  }
  const key = regionName.trim()
  return ictFallbackTasks.filter(
    (t) => t.req_id === reqId && (t.region_name ?? '').trim() === key && hasDepartmentResponse(t),
  )
}

export function MinistryCompiledRecordViewModal({
  record,
  onClose,
  canFinalize,
  onRecordUpdated,
  fromPath,
  layout = 'modal',
}: Props) {
  const isPage = layout === 'page'
  const printRef = useRef<HTMLDivElement>(null)
  const [hrDetail, setHrDetail] = useState<Awaited<ReturnType<typeof fetchHrRequest>> | null>(null)
  const [hrLoading, setHrLoading] = useState(false)
  const [hrError, setHrError] = useState<string | null>(null)
  const [regionBlocks, setRegionBlocks] = useState<RegionResponseBlock[]>([])
  const [responsesLoading, setResponsesLoading] = useState(false)
  const [responsesError, setResponsesError] = useState<string | null>(null)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const regions = record.region_names ?? []
  const regionKey = regions.join('\u0001')

  useEffect(() => {
    setFinalizeError(null)
    setPdfError(null)
  }, [record.id])

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
        const responsesForReq = regionalResponses.filter((r) => r.req_id === reqId)
        const blocks = await Promise.all(
          regions.map(async (regionName) => {
            const tasks = await loadDepartmentTasksForRegion(
              reqId,
              regionName,
              responsesForReq,
              indexTasks,
            )
            return { regionName: regionName.trim(), tasks }
          }),
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

  const requestTemplateProps = useMemo(
    () => (hrDetail ? buildFederalOriginalRequestViewTemplateProps(hrDetail) : null),
    [hrDetail],
  )

  async function submitToMinistry() {
    if (record.status !== 'draft' || !canFinalize) return
    setFinalizing(true)
    setFinalizeError(null)
    try {
      const updated = await updateCompiledRecord(record.id, { status: 'submitted' })
      onRecordUpdated(updated)
    } catch (e: unknown) {
      setFinalizeError(isApiError(e) ? e.message : 'Could not submit this record.')
    } finally {
      setFinalizing(false)
    }
  }

  async function handleDownloadPdf() {
    const el = printRef.current
    if (!el) return
    setPdfLoading(true)
    setPdfError(null)
    try {
      const base = [record.req_id, record.title?.trim() || record.id].filter(Boolean).join(' — ')
      await downloadElementAsPdf(el, base, { captureClass: 'ministry-compiled-pdf-capture', marginMm: 12 })
    } catch (e: unknown) {
      setPdfError(e instanceof Error ? e.message : 'Could not generate PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  const card = (
    <div
      className={
        'modal-card modal-card-wide ministry-compiled-modal ministry-compiled-single' +
        (isPage ? ' hr-request-modal--page' : '')
      }
    >
      <div ref={printRef} className="ministry-compiled-print-root">
        <WorkflowModalHero
          eyebrow="National compilation | Ministry submission"
          title={record.title?.trim() || 'Compiled record'}
          titleId="ministry-compiled-title"
          onClose={isPage ? undefined : onClose}
          embedded={isPage}
        >
          <StatusBadge tone={compiledStatusTone(record.status)}>
            {formatCompiledStatusLabel(record.status)}
          </StatusBadge>
          {record.req_id ? <span className="workflow-modal-hero__chip">{record.req_id}</span> : null}
        </WorkflowModalHero>

        <div className="ministry-compiled-modal__body ministry-compiled-single__body">
          {record.status === 'draft' && canFinalize ? (
            <Alert variant="info" title="Draft record" className="ministry-compiled-draft-alert">
              <p style={{ margin: 0 }}>
                This compilation is not yet marked as sent. Review the request, provincial responses, and summary
                below, then use <strong>Submit to ministry</strong> when ready.
                {record.req_id ? (
                  <>
                    {' '}
                    You can also open the{' '}
                    <Link
                      to={`/compilation?from=${fromPath}&reqId=${encodeURIComponent(record.req_id)}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Compilation center
                    </Link>{' '}
                    to revise the summary.
                  </>
                ) : null}
              </p>
            </Alert>
          ) : null}

          <article className="ministry-compiled-region-card ministry-compiled-request-card">
            <h2 className="ministry-compiled-region-card__title">Original request</h2>
            {hrLoading ? <p className="muted">Loading request…</p> : null}
            {hrError ? (
              <Alert variant="warning" title="Could not load the HR request">
                <p style={{ margin: 0 }}>{hrError}</p>
              </Alert>
            ) : null}
            {!hrLoading && !hrError && requestTemplateProps ? (
              <div
                className={
                  isPage
                    ? 'ministry-compiled-embedded-request'
                    : 'regional-preview-embedded-request regional-preview-embedded-request--tab'
                }
              >
                <HrRequestViewTemplate
                  {...requestTemplateProps}
                  className={isPage ? 'hr-request-view-template--ministry-document' : undefined}
                />
              </div>
            ) : null}
            {!hrLoading && !hrError && hrDetail && !requestTemplateProps ? (
              <p className="muted small" style={{ margin: 0 }}>
                This request is not in the current issue-based format, or issue data is missing from the API.
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
                            <p className="ministry-compiled-dept-response-item__dept">
                              {t.department_name ?? t.department_id}
                            </p>
                            <DepartmentResponseDisplay
                              responseData={t.response_data}
                              attachmentUrl={t.attachment_url}
                              issueIndicators={hrDetail?.issue?.indicators}
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

      {isPage ? (
        <div className="ministry-compiled-single__toolbar compiled-record-pdf-toolbar">
          <Button
            variant="secondary"
            compact
            type="button"
            disabled={pdfLoading || responsesLoading || hrLoading}
            onClick={() => void handleDownloadPdf()}
          >
            <Download size={16} strokeWidth={2} aria-hidden style={{ marginRight: 6 }} />
            {pdfLoading ? 'Generating PDF…' : 'Download PDF'}
          </Button>
          {pdfError ? <span className="login-error small">{pdfError}</span> : null}
        </div>
      ) : null}

      {finalizeError ? <p className="login-error ministry-compiled-modal__error">{finalizeError}</p> : null}

      <ModalActions className="ministry-compiled-modal__actions">
        {!isPage && onClose ? (
          <Button variant="secondary" compact type="button" onClick={onClose}>
            Close
          </Button>
        ) : null}
        {record.status === 'draft' && canFinalize ? (
          <Button variant="primary" compact type="button" disabled={finalizing} onClick={() => void submitToMinistry()}>
            {finalizing ? 'Submitting…' : 'Submit to ministry'}
          </Button>
        ) : null}
      </ModalActions>
    </div>
  )

  if (isPage) {
    return card
  }

  return (
    <div
      className="modal-overlay ministry-compiled-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ministry-compiled-title"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{card}</div>
    </div>
  )
}
