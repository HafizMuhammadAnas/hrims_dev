import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import type { CompiledRecordRow, DepartmentTaskRow, RegionalResponseRow } from '../api/lists'
import { downloadElementAsPdf } from '../lib/downloadElementAsPdf'
import { downloadElementTablesAsExcel } from '../lib/downloadElementTablesAsExcel'
import { hasDepartmentResponse } from '../lib/departmentTaskWorkflow'
import { isIctRegionSlug } from '../lib/ictRegion'
import {
  buildProvincialSubmissionCoverage,
  countProvincialSubmissionCoverage,
} from '../lib/regionalSubmissionCoverage'
import { regionalResponseReviewPresentation } from '../lib/regionalResponseReviewStatus'
import { pickActivityTimestamp, sortRowsLatestFirst } from '../lib/tableRowSort'
import { LABEL_DEPARTMENTAL_RESPONSES, LABEL_REGIONAL_RESPONSES } from '../lib/uiLabels'
import { regionalResponseFederalReviewPath } from '../lib/workflowNavigation'
import type { HrRequestRow } from '../types/hrRequest'
import { CompiledRecordPrintDocument } from './CompiledRecordPrintDocument'
import { RegionalSubmissionCoverageBar } from './RegionalSubmissionCoverageBar'
import { ActionNoticeAlert, Alert, type ActionNotice } from './ui/Alert'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/StatusBadge'
import { TableCard } from './ui/TableCard'

type Props = {
  requests: HrRequestRow[]
  responses: RegionalResponseRow[]
  deptTasks: DepartmentTaskRow[]
  /** National compiled records — submitted ones are excluded from the temporary picker. */
  compiledRecords: CompiledRecordRow[]
}

function isPreviewIncludableReviewStatus(status: string): boolean {
  return status === 'accepted' || status === 'pending'
}

function isIctTaskPreviewIncludable(t: DepartmentTaskRow): boolean {
  const s = t.regional_review_status
  return s == null || s === '' || s === 'pending' || s === 'accepted'
}

function isIctLineTask(t: DepartmentTaskRow): boolean {
  return isIctRegionSlug(t.region_slug ?? null)
}

function sortTasksByDept(a: DepartmentTaskRow, b: DepartmentTaskRow): number {
  const an = (a.department_name ?? a.department_id).toLowerCase()
  const bn = (b.department_name ?? b.department_id).toLowerCase()
  return an.localeCompare(bn)
}

function responseIdsSignature(ids: string[]): string {
  return [...ids].sort().join('\u001f')
}

/**
 * Temporary national compile: Under Review + Accepted provinces only.
 * Downloads PDF/Excel at runtime; never persists to Compiled records.
 * Dropdown lists only requests that are not yet nationally submitted.
 */
export function TemporaryFederalCompilationPreviewCard({
  requests,
  responses,
  deptTasks,
  compiledRecords,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const printRef = useRef<HTMLDivElement>(null)

  const [selectedReqId, setSelectedReqId] = useState('')
  const [includedResponseIds, setIncludedResponseIds] = useState<string[]>([])
  const [ictIncluded, setIctIncluded] = useState(false)
  const [summary, setSummary] = useState('')
  const [docReady, setDocReady] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [exportNotice, setExportNotice] = useState<ActionNotice | null>(null)

  const reqIdsNationallySubmitted = useMemo(() => {
    const s = new Set<string>()
    for (const c of compiledRecords) {
      if (c.status === 'submitted' && c.req_id) s.add(c.req_id)
    }
    return s
  }, [compiledRecords])

  const reqIdsForPicker = useMemo(() => {
    const s = new Set<string>()
    for (const r of responses) {
      if (!reqIdsNationallySubmitted.has(r.req_id)) s.add(r.req_id)
    }
    for (const t of deptTasks) {
      if (
        isIctLineTask(t) &&
        hasDepartmentResponse(t) &&
        !reqIdsNationallySubmitted.has(t.req_id)
      ) {
        s.add(t.req_id)
      }
    }
    return [...s].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  }, [responses, deptTasks, reqIdsNationallySubmitted])

  const requestsForSelect = useMemo(() => {
    const allowed = new Set(reqIdsForPicker)
    return sortRowsLatestFirst(
      requests.filter((r) => allowed.has(r.id) && !reqIdsNationallySubmitted.has(r.id)),
      (r) => pickActivityTimestamp(r.updated_at, r.created_at, r.date, r.id),
    )
  }, [requests, reqIdsForPicker, reqIdsNationallySubmitted])

  useEffect(() => {
    if (selectedReqId && reqIdsNationallySubmitted.has(selectedReqId)) {
      setSelectedReqId('')
      setSummary('')
      setIncludedResponseIds([])
      setIctIncluded(false)
      setExportNotice(null)
    }
  }, [selectedReqId, reqIdsNationallySubmitted])

  const selectedReq = useMemo(
    () => requests.find((r) => r.id === selectedReqId) ?? null,
    [requests, selectedReqId],
  )

  const selectedResponses = useMemo(
    () =>
      responses
        .filter((r) => r.req_id === selectedReqId)
        .sort((a, b) => (a.region_name ?? '').localeCompare(b.region_name ?? '')),
    [responses, selectedReqId],
  )

  const selectedIctTasks = useMemo(
    () => deptTasks.filter((t) => t.req_id === selectedReqId && isIctLineTask(t)).sort(sortTasksByDept),
    [deptTasks, selectedReqId],
  )
  const selectedIctSubmitted = useMemo(
    () => selectedIctTasks.filter((t) => hasDepartmentResponse(t)),
    [selectedIctTasks],
  )
  const selectedIctPreviewOkCount = useMemo(
    () => selectedIctSubmitted.filter(isIctTaskPreviewIncludable).length,
    [selectedIctSubmitted],
  )
  const ictLineReadyForPreview =
    selectedIctSubmitted.length > 0 && selectedIctPreviewOkCount === selectedIctSubmitted.length

  const provinceCoverage = useMemo(() => {
    if (!selectedReq) return []
    return buildProvincialSubmissionCoverage(selectedReq.regions, selectedResponses)
  }, [selectedReq, selectedResponses])

  const provinceCounts = useMemo(
    () => countProvincialSubmissionCoverage(provinceCoverage),
    [provinceCoverage],
  )

  const ictRegionName = useMemo(() => {
    const fromReq = selectedReq?.regions?.find((r) => isIctRegionSlug(r.slug))?.name
    if (fromReq) return fromReq
    const fromTask = selectedIctTasks[0]?.region_name
    return fromTask?.trim() || 'ICT'
  }, [selectedReq, selectedIctTasks])

  const includablePreviewResponses = useMemo(
    () =>
      provinceCoverage.filter(
        (item) =>
          item.response != null && isPreviewIncludableReviewStatus(item.response.review_status),
      ),
    [provinceCoverage],
  )

  const includableResponseIdKey = useMemo(
    () => responseIdsSignature(includablePreviewResponses.map((item) => item.response!.id)),
    [includablePreviewResponses],
  )

  useEffect(() => {
    if (!selectedReqId) {
      setIncludedResponseIds([])
      setIctIncluded(false)
      return
    }
    const ids = includableResponseIdKey ? includableResponseIdKey.split('\u001f') : []
    setIncludedResponseIds(ids)
    setIctIncluded(ictLineReadyForPreview)
  }, [selectedReqId, includableResponseIdKey, ictLineReadyForPreview])

  const includedResponseSet = useMemo(() => new Set(includedResponseIds), [includedResponseIds])

  const selectedRegionNames = useMemo(() => {
    const names: string[] = []
    for (const item of provinceCoverage) {
      const resp = item.response
      if (resp && includedResponseSet.has(resp.id)) {
        names.push(item.regionName)
      }
    }
    if (ictIncluded && ictLineReadyForPreview && !names.includes(ictRegionName)) {
      names.push(ictRegionName)
    }
    return names.sort((a, b) => a.localeCompare(b))
  }, [
    provinceCoverage,
    includedResponseSet,
    ictIncluded,
    ictLineReadyForPreview,
    ictRegionName,
  ])

  const canDownload = selectedReqId !== '' && selectedRegionNames.length > 0

  const previewRecord = useMemo((): CompiledRecordRow | null => {
    if (!selectedReq || selectedRegionNames.length === 0) return null
    return {
      id: `TEMP-PREVIEW-${selectedReq.id}`,
      req_id: selectedReq.id,
      title: `Temporary compilation — ${selectedReq.title}`,
      region_names: selectedRegionNames,
      compilation_date: new Date().toISOString().slice(0, 10),
      status: 'draft',
      submitted_to: null,
      submission_date: null,
      attachment: null,
      summary: summary.trim() || null,
    }
  }, [selectedReq, selectedRegionNames, summary])

  useEffect(() => {
    setDocReady(false)
    setExportNotice(null)
  }, [previewRecord?.id, previewRecord?.region_names.join('\u0001'), previewRecord?.summary])

  function toggleResponseInclusion(responseId: string) {
    setIncludedResponseIds((prev) =>
      prev.includes(responseId) ? prev.filter((id) => id !== responseId) : [...prev, responseId],
    )
  }

  function selectAllIncludable() {
    setIncludedResponseIds(includablePreviewResponses.map((item) => item.response!.id))
    if (ictLineReadyForPreview) setIctIncluded(true)
  }

  function clearAllInclusions() {
    setIncludedResponseIds([])
    setIctIncluded(false)
  }

  async function handleDownloadPdf() {
    const el = printRef.current
    if (!el || !previewRecord || !docReady) return
    setPdfLoading(true)
    setExportNotice(null)
    try {
      const base = [previewRecord.req_id, previewRecord.title].filter(Boolean).join(' — ')
      await downloadElementAsPdf(el, base, {
        captureClass: 'ministry-compiled-pdf-capture',
        marginMm: 10,
        headerTitle: base,
      })
      setExportNotice({
        variant: 'info',
        title: 'PDF downloaded',
        message: 'Temporary compilation PDF was generated and downloaded on this page.',
      })
    } catch (e: unknown) {
      setExportNotice({
        variant: 'error',
        title: 'Could not generate PDF',
        message: e instanceof Error ? e.message : 'Could not generate PDF.',
      })
    } finally {
      setPdfLoading(false)
    }
  }

  function handleDownloadExcel() {
    const el = printRef.current
    if (!el || !previewRecord || !docReady) return
    setExcelLoading(true)
    setExportNotice(null)
    try {
      const base = [previewRecord.req_id, previewRecord.title].filter(Boolean).join(' — ')
      downloadElementTablesAsExcel(el, base, {
        sheetName: 'Temporary compilation',
        documentTitle: previewRecord.title,
      })
      setExportNotice({
        variant: 'info',
        title: 'Excel downloaded',
        message: 'Temporary compilation Excel file was generated and downloaded on this page.',
      })
    } catch (e: unknown) {
      setExportNotice({
        variant: 'error',
        title: 'Could not generate Excel',
        message: e instanceof Error ? e.message : 'Could not generate Excel file.',
      })
    } finally {
      setExcelLoading(false)
    }
  }

  const downloadBusy = pdfLoading || excelLoading
  const downloadEnabled = canDownload && docReady && !downloadBusy

  return (
    <TableCard padded className="temporary-federal-compilation-preview">
      <h3 className="temporary-federal-compilation-preview__title">
        Temporary compilation
      </h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        Compile every received provincial response that is still <strong>Under Review</strong> or already{' '}
        <strong>Accepted</strong> for requests that are <strong>not yet nationally compiled</strong>. This is for
        runtime PDF / Excel download only — nothing is saved to Compiled records.
      </p>
      <ActionNoticeAlert notice={exportNotice} onDismiss={() => setExportNotice(null)} />

      <label className="muted">HR request</label>
      {requestsForSelect.length === 0 ? (
        <p className="muted" style={{ margin: '8px 0 12px' }}>
          No uncompiled requests with regional or ICT submissions are available. Provinces submit from{' '}
          <Link to="/region-compilation">Response compilation</Link>; national-line departments submit from{' '}
          <Link to="/federal-department-requests">{LABEL_DEPARTMENTAL_RESPONSES}</Link>. Already submitted national
          compilations are listed under <Link to="/compiled-records">Compiled records</Link>.
        </p>
      ) : null}
      <select
        style={{ width: '100%', marginTop: 6, marginBottom: 12 }}
        value={selectedReqId}
        onChange={(e) => {
          setExportNotice(null)
          setSummary('')
          setSelectedReqId(e.target.value)
        }}
        disabled={requestsForSelect.length === 0}
      >
        <option value="">-- choose request --</option>
        {requestsForSelect.map((r) => {
          const cov = buildProvincialSubmissionCoverage(
            r.regions,
            responses.filter((x) => x.req_id === r.id),
          )
          const counts = countProvincialSubmissionCoverage(cov)
          const suffix =
            counts.assigned > 0 ? ` · ${counts.submitted}/${counts.assigned} provinces` : ''
          return (
            <option key={r.id} value={r.id}>
              {r.id} — {r.title}
              {suffix}
            </option>
          )
        })}
      </select>

      {selectedReqId && selectedRegionNames.length > 0 ? (
        <div className="chip-list" style={{ marginBottom: 10 }}>
          <StatusBadge tone="pending">Included in temporary compile: {selectedRegionNames.length}</StatusBadge>
          {selectedRegionNames.map((name) => (
            <StatusBadge key={name}>{name}</StatusBadge>
          ))}
        </div>
      ) : null}

      {selectedReqId && !canDownload && selectedResponses.length > 0 && includablePreviewResponses.length === 0 ? (
        <Alert variant="warning" title="No Under Review or Accepted responses" className="compilation-gate-alert">
          <p style={{ margin: 0 }}>
            This request has regional compilations, but none are <strong>Under Review</strong> or{' '}
            <strong>Accepted</strong>. Open <Link to="/responses">{LABEL_REGIONAL_RESPONSES}</Link> to check review
            status, then return here.
          </p>
        </Alert>
      ) : null}

      {selectedReqId && provinceCoverage.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <p className="muted font-semibold text-compact" style={{ margin: '0 0 8px' }}>
            Provincial submissions for <strong>{selectedReqId}</strong> —{' '}
            <strong>{provinceCounts.submitted}</strong> of <strong>{provinceCounts.assigned}</strong> submitted
          </p>
          <div style={{ marginTop: 10 }}>
            <RegionalSubmissionCoverageBar items={provinceCoverage} />
          </div>
        </div>
      ) : null}

      {selectedReqId ? (
        <div style={{ marginBottom: 14 }}>
          {selectedIctSubmitted.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <p className="muted font-semibold text-compact" style={{ margin: '0 0 8px' }}>
                National-line (ICT) departmental tasks
              </p>
              <p className="muted text-compact" style={{ margin: '0 0 8px' }}>
                {selectedIctPreviewOkCount} of {selectedIctSubmitted.length} submitted task
                {selectedIctSubmitted.length === 1 ? '' : 's'} Under Review or Accepted ·{' '}
                {ictLineReadyForPreview ? (
                  <strong>
                    ICT line ready — use the checkbox below to include {ictRegionName} in the temporary download.
                  </strong>
                ) : (
                  <strong>
                    Every submitted national-line task must be Under Review or Accepted before ICT can be included.
                  </strong>
                )}
              </p>
              <div className="compilation-dept-status-grid">
                {selectedIctSubmitted.map((t) => {
                  const ok = isIctTaskPreviewIncludable(t)
                  const accepted = t.regional_review_status === 'accepted'
                  return (
                    <div key={t.id} className="compilation-dept-status-row">
                      <span
                        className="compilation-dept-status-row__check compilation-dept-status-row__check--disabled"
                        aria-hidden
                      >
                        <input type="checkbox" disabled checked={false} tabIndex={-1} />
                      </span>
                      <div className="compilation-dept-status-row__body" style={{ cursor: 'default' }}>
                        <span className="compilation-dept-status-row__label compilation-dept-status-row__label--stacked">
                          <span className="compilation-dept-status-row__dept">
                            {t.department_name ?? t.department_id}
                          </span>
                        </span>
                        <StatusBadge tone={ok ? (accepted ? 'success' : 'pending') : 'warning'}>
                          {accepted ? 'Accepted' : ok ? 'Under Review' : 'Needs modification'}
                        </StatusBadge>
                      </div>
                    </div>
                  )
                })}
                {ictLineReadyForPreview ? (
                  <div className="compilation-dept-status-row">
                    <label className="compilation-dept-status-row__check">
                      <input
                        type="checkbox"
                        checked={ictIncluded}
                        onChange={() => setIctIncluded((v) => !v)}
                        aria-label={`Include ${ictRegionName} national line in temporary compilation`}
                      />
                    </label>
                    <div className="compilation-dept-status-row__body" style={{ cursor: 'default' }}>
                      <span className="compilation-dept-status-row__label compilation-dept-status-row__label--stacked">
                        <span className="compilation-dept-status-row__title-sub muted small">
                          National line (ICT)
                        </span>
                        <span className="compilation-dept-status-row__dept">{ictRegionName}</span>
                      </span>
                      <StatusBadge tone="success">Ready to include</StatusBadge>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {provinceCoverage.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {selectedIctSubmitted.length > 0
                ? 'No provincial regions assigned on this request (ICT-only path is fine if ICT is included below).'
                : 'No provincial regions assigned and no ICT departmental submissions for this request yet.'}
            </p>
          ) : (
            <>
              {includablePreviewResponses.length > 0 ? (
                <div
                  className="compilation-dept-toolbar"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginBottom: 10 }}
                >
                  <button type="button" className="link-button" onClick={selectAllIncludable}>
                    Select all Under Review / Accepted
                  </button>
                  <button type="button" className="link-button" onClick={clearAllInclusions}>
                    Clear all
                  </button>
                </div>
              ) : null}
              <div className="compilation-dept-status-grid" style={{ marginBottom: 10 }}>
                {provinceCoverage.map((item) => {
                  if (item.status === 'pending_submission') {
                    return (
                      <div key={item.regionId} className="compilation-dept-status-row">
                        <span
                          className="compilation-dept-status-row__check compilation-dept-status-row__check--disabled"
                          aria-hidden
                        >
                          <input type="checkbox" disabled checked={false} tabIndex={-1} />
                        </span>
                        <div className="compilation-dept-status-row__body" style={{ cursor: 'default' }}>
                          <span className="compilation-dept-status-row__label compilation-dept-status-row__label--stacked">
                            <span className="compilation-dept-status-row__title-sub muted small">
                              {selectedReq?.title?.trim() || selectedReqId}
                            </span>
                            <span className="compilation-dept-status-row__dept">{item.regionName}</span>
                          </span>
                          <StatusBadge tone="in-progress">Pending</StatusBadge>
                        </div>
                      </div>
                    )
                  }
                  const r = item.response!
                  const review = regionalResponseReviewPresentation(r.review_status)
                  const canInclude = isPreviewIncludableReviewStatus(r.review_status)
                  const checked = canInclude && includedResponseSet.has(r.id)
                  return (
                    <div key={r.id} className="compilation-dept-status-row">
                      <label
                        className={
                          'compilation-dept-status-row__check' +
                          (canInclude ? '' : ' compilation-dept-status-row__check--disabled')
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canInclude}
                          onChange={() => toggleResponseInclusion(r.id)}
                          aria-label={`Include ${item.regionName} in temporary compilation`}
                        />
                      </label>
                      <button
                        type="button"
                        className="compilation-dept-status-row__body"
                        onClick={() =>
                          navigate(regionalResponseFederalReviewPath(r.id, location.pathname))
                        }
                        title="Open federal review (same as Regional responses)"
                      >
                        <span className="compilation-dept-status-row__label compilation-dept-status-row__label--stacked">
                          <span className="compilation-dept-status-row__title-sub muted small">
                            {r.title?.trim() || r.req_id}
                          </span>
                          <span className="compilation-dept-status-row__dept">
                            {r.region_name ?? item.regionName}
                          </span>
                        </span>
                        <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      ) : null}

      <label className="muted">Federal summary (optional, download only)</label>
      <textarea
        rows={6}
        style={{ width: '100%', marginTop: 6 }}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Optional summary included in the PDF / Excel download. Not saved to the server."
        disabled={!selectedReqId}
      />

      <div
        className="compiled-record-pdf-toolbar"
        style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}
      >
        <Button
          variant="secondary"
          compact
          type="button"
          disabled={!downloadEnabled}
          onClick={() => void handleDownloadPdf()}
        >
          <Download size={16} strokeWidth={2} aria-hidden style={{ marginRight: 6 }} />
          {pdfLoading ? 'Generating PDF…' : !canDownload ? 'Select provinces' : !docReady ? 'Preparing…' : 'Download PDF'}
        </Button>
        <Button
          variant="secondary"
          compact
          type="button"
          disabled={!downloadEnabled}
          onClick={handleDownloadExcel}
        >
          <Download size={16} strokeWidth={2} aria-hidden style={{ marginRight: 6 }} />
          {excelLoading
            ? 'Generating Excel…'
            : !canDownload
              ? 'Select provinces'
              : !docReady
                ? 'Preparing…'
                : 'Download Excel'}
        </Button>
        {canDownload && !docReady ? (
          <span className="muted small">Preparing temporary document…</span>
        ) : null}
        {!canDownload && selectedReqId ? (
          <span className="muted small" style={{ flex: '1 1 200px' }}>
            Select at least one Under Review or Accepted province, or include the ICT national line.
          </span>
        ) : null}
      </div>

      {previewRecord ? (
        <div className="temporary-federal-compilation-preview__capture-host" aria-hidden>
          <div ref={printRef} className="temporary-federal-compilation-preview__capture-root">
            <CompiledRecordPrintDocument record={previewRecord} onReadyChange={setDocReady} />
          </div>
        </div>
      ) : null}
    </TableCard>
  )
}
