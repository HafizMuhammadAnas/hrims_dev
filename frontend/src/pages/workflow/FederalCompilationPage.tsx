import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchHrRequests } from '../../api/hrRequests'
import { createCompiledRecord } from '../../api/workflows'
import {
  fetchCompiledRecords,
  fetchDepartmentTasks,
  fetchRegionalResponses,
  type CompiledRecordRow,
  type DepartmentTaskRow,
  type RegionalResponseRow,
} from '../../api/lists'
import { CompiledRecordsWorkflowNav, isFromCompiledRecordsPath } from '../../components/CompiledRecordsWorkflowNav'
import { MergeCompiledRecordsSection } from '../../components/MergeCompiledRecordsSection'
import { TemporaryFederalCompilationPreviewCard } from '../../components/TemporaryFederalCompilationPreviewCard'
import { RegionalSubmissionCoverageBar } from '../../components/RegionalSubmissionCoverageBar'
import { regionalResponseFederalReviewPath } from '../../lib/workflowNavigation'
import { hasDepartmentResponse } from '../../lib/departmentTaskWorkflow'
import { isIctRegionSlug } from '../../lib/ictRegion'
import {
  buildProvincialSubmissionCoverage,
  countProvincialSubmissionCoverage,
} from '../../lib/regionalSubmissionCoverage'
import { regionalResponseReviewPresentation } from '../../lib/regionalResponseReviewStatus'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { LABEL_COMPILATION_CENTER, LABEL_DEPARTMENTAL_RESPONSES, LABEL_REGIONAL_RESPONSES } from '../../lib/uiLabels'
import { pickActivityTimestamp, sortRowsLatestFirst } from '../../lib/tableRowSort'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import type { HrRequestRow } from '../../types/hrRequest'

function reviewStatusPresentation(status: string) {
  return regionalResponseReviewPresentation(status)
}

function sortTasksByDept(a: DepartmentTaskRow, b: DepartmentTaskRow): number {
  const an = (a.department_name ?? a.department_id).toLowerCase()
  const bn = (b.department_name ?? b.department_id).toLowerCase()
  return an.localeCompare(bn)
}

function isIctLineTask(t: DepartmentTaskRow): boolean {
  return isIctRegionSlug(t.region_slug ?? null)
}

function responseIdsSignature(ids: string[]): string {
  return [...ids].sort().join('\u001f')
}

export function FederalCompilationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [requests, setRequests] = useState<HrRequestRow[]>([])
  const [responses, setResponses] = useState<RegionalResponseRow[]>([])
  const [deptTasks, setDeptTasks] = useState<DepartmentTaskRow[]>([])
  const [selectedReqId, setSelectedReqId] = useState('')
  const [includedResponseIds, setIncludedResponseIds] = useState<string[]>([])
  const [ictIncluded, setIctIncluded] = useState(false)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'draft' | 'submitted' | null>(null)
  const [compiledRecords, setCompiledRecords] = useState<CompiledRecordRow[]>([])

  useEffect(() => {
    void Promise.all([
      fetchHrRequests(),
      fetchRegionalResponses(),
      fetchDepartmentTasks(),
      fetchCompiledRecords(),
    ])
      .then(([reqRows, responseRows, taskRows, compiledRows]) => {
        setError(null)
        setRequests(reqRows)
        setResponses(responseRows)
        setDeptTasks(taskRows)
        setCompiledRecords(compiledRows)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load compilation data'))
  }, [])

  useEffect(() => {
    const from = searchParams.get('from') ?? ''
    const req = searchParams.get('reqId')?.trim() ?? ''
    if (!isFromCompiledRecordsPath(from) || !req) return
    setSelectedReqId(req)
  }, [searchParams])

  /** Requests that have any regional compilation row, or any submitted ICT / national-line department task. */
  const reqIdsForPicker = useMemo(() => {
    const s = new Set<string>()
    for (const r of responses) s.add(r.req_id)
    for (const t of deptTasks) {
      if (isIctLineTask(t) && hasDepartmentResponse(t)) s.add(t.req_id)
    }
    return [...s].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  }, [responses, deptTasks])

  /** Requests already submitted from this center — hide from the picker. */
  const reqIdsNationallySubmitted = useMemo(() => {
    const s = new Set<string>()
    for (const c of compiledRecords) {
      if (c.status === 'submitted' && c.req_id) s.add(c.req_id)
    }
    return s
  }, [compiledRecords])

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
    }
  }, [selectedReqId, reqIdsNationallySubmitted])

  useEffect(() => {
    if (!selectedReqId) return
    const refresh = () => {
      void Promise.all([fetchRegionalResponses(), fetchDepartmentTasks()])
        .then(([responseRows, taskRows]) => {
          setResponses(responseRows)
          setDeptTasks(taskRows)
        })
        .catch(() => {})
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [selectedReqId])

  const selectedReq = useMemo(
    () => requests.find((r) => r.id === selectedReqId) ?? null,
    [requests, selectedReqId],
  )

  const selectedResponses = useMemo(
    () => responses.filter((r) => r.req_id === selectedReqId).sort((a, b) => (a.region_name ?? '').localeCompare(b.region_name ?? '')),
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
  const selectedIctAcceptedCount = useMemo(
    () => selectedIctSubmitted.filter((t) => t.regional_review_status === 'accepted').length,
    [selectedIctSubmitted],
  )
  const ictLineReadyForCompilation =
    selectedIctSubmitted.length > 0 && selectedIctAcceptedCount === selectedIctSubmitted.length

  const provinceCoverage = useMemo(() => {
    if (!selectedReq) return []
    return buildProvincialSubmissionCoverage(selectedReq.regions, selectedResponses)
  }, [selectedReq, selectedResponses])

  const provinceCounts = useMemo(
    () => countProvincialSubmissionCoverage(provinceCoverage),
    [provinceCoverage],
  )

  const responseCounts = useMemo(() => {
    const counts = { pending: 0, accepted: 0, needs_modification: 0, rejected: 0 }
    for (const r of selectedResponses) {
      if (r.review_status === 'accepted') counts.accepted++
      else if (r.review_status === 'needs-modification') counts.needs_modification++
      else if (r.review_status === 'rejected') counts.rejected++
      else counts.pending++
    }
    return counts
  }, [selectedResponses])

  const ictRegionName = useMemo(() => {
    const fromReq = selectedReq?.regions?.find((r) => isIctRegionSlug(r.slug))?.name
    if (fromReq) return fromReq
    const fromTask = selectedIctTasks[0]?.region_name
    return fromTask?.trim() || 'ICT'
  }, [selectedReq, selectedIctTasks])

  const includableAcceptedResponses = useMemo(
    () =>
      provinceCoverage.filter(
        (item) => item.response != null && item.response.review_status === 'accepted',
      ),
    [provinceCoverage],
  )

  const includableResponseIdKey = useMemo(
    () => responseIdsSignature(includableAcceptedResponses.map((item) => item.response!.id)),
    [includableAcceptedResponses],
  )

  useEffect(() => {
    if (!selectedReqId) {
      setIncludedResponseIds([])
      setIctIncluded(false)
      return
    }
    const ids = includableResponseIdKey ? includableResponseIdKey.split('\u001f') : []
    setIncludedResponseIds(ids)
    setIctIncluded(ictLineReadyForCompilation)
  }, [selectedReqId, includableResponseIdKey, ictLineReadyForCompilation])

  const includedResponseSet = useMemo(() => new Set(includedResponseIds), [includedResponseIds])

  const selectedRegionNames = useMemo(() => {
    const names: string[] = []
    for (const item of provinceCoverage) {
      const resp = item.response
      if (resp && includedResponseSet.has(resp.id)) {
        names.push(item.regionName)
      }
    }
    if (ictIncluded && ictLineReadyForCompilation && !names.includes(ictRegionName)) {
      names.push(ictRegionName)
    }
    return names.sort((a, b) => a.localeCompare(b))
  }, [
    provinceCoverage,
    includedResponseSet,
    ictIncluded,
    ictLineReadyForCompilation,
    ictRegionName,
  ])

  function toggleResponseInclusion(responseId: string) {
    setIncludedResponseIds((prev) =>
      prev.includes(responseId) ? prev.filter((id) => id !== responseId) : [...prev, responseId],
    )
  }

  function selectAllAcceptedProvinces() {
    setIncludedResponseIds(includableAcceptedResponses.map((item) => item.response!.id))
    if (ictLineReadyForCompilation) setIctIncluded(true)
  }

  function clearAllInclusions() {
    setIncludedResponseIds([])
    setIctIncluded(false)
  }

  const canPersistCompilation = Boolean(selectedReqId && selectedRegionNames.length > 0)

  async function save(status: 'draft' | 'submitted') {
    if (!selectedReq || selectedRegionNames.length === 0) {
      setError(
        'Select at least one accepted provincial compilation (checkbox) or include the ICT national line, then save.',
      )
      return
    }
    setSaving(status)
    setError(null)
    try {
      await createCompiledRecord({
        hr_request_id: selectedReq.id,
        title: `Compiled Report - ${selectedReq.title}`,
        region_names: selectedRegionNames,
        summary: summary || null,
        status,
        submitted_to: status === 'submitted' ? 'Compilation Center' : null,
      })
      setSummary('')
      setSelectedReqId('')
      setIncludedResponseIds([])
      setIctIncluded(false)
      void fetchCompiledRecords().then(setCompiledRecords).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(null)
    }
  }

  const fromCompiledRecords = isFromCompiledRecordsPath(searchParams.get('from'))

  return (
    <PageSection title={LABEL_COMPILATION_CENTER}>
      {fromCompiledRecords && selectedReqId ? (
        <CompiledRecordsWorkflowNav reqId={selectedReqId} activeTab="compilation" />
      ) : null}
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'Available for Compilation', value: requestsForSelect.length },
            { label: 'Compiled', value: reqIdsNationallySubmitted.size },
          ]}
        />
      </div>
      <TableCard padded>
        <label className="muted">HR request</label>
        {requestsForSelect.length === 0 && reqIdsForPicker.length === 0 ? (
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            No data yet for national compilation: provinces submit from <Link to="/region-compilation">Response compilation</Link>,
            and national-line departments submit under ICT assignments from{' '}
            <Link to="/federal-department-requests">{LABEL_DEPARTMENTAL_RESPONSES}</Link>.
          </p>
        ) : null}
        {requestsForSelect.length === 0 && reqIdsForPicker.length > 0 ? (
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            Every request that still had an open national compilation has already been{' '}
            <strong>submitted</strong> from this center. Open{' '}
            <Link to="/compiled-records">Compiled records</Link> to review saved national records.
          </p>
        ) : null}
        <select
          style={{ width: '100%', marginTop: 6, marginBottom: 12 }}
          value={selectedReqId}
          onChange={(e) => {
            setError(null)
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
            <StatusBadge tone="success">
              Included in national compile: {selectedRegionNames.length}
            </StatusBadge>
            {selectedRegionNames.map((name) => (
                <StatusBadge key={name}>{name}</StatusBadge>
            ))}
          </div>
        ) : null}
        {selectedReqId &&
          !canPersistCompilation &&
          selectedResponses.length > 0 &&
          responseCounts.accepted === 0 && (
            <Alert variant="warning" title="Accept a regional response first" className="compilation-gate-alert">
              <p style={{ margin: 0 }}>
                This request has regional compilations, but none are <strong>accepted</strong> yet. Draft and submitted
                national records only include <strong>accepted</strong> provinces. Go to{' '}
                <Link to="/responses">{LABEL_REGIONAL_RESPONSES}</Link>, open each row, set review status to{' '}
                <strong>accepted</strong>, and save—then return here and select provinces to include.
              </p>
            </Alert>
          )}
        {selectedReqId &&
          !canPersistCompilation &&
          selectedResponses.length === 0 &&
          selectedIctSubmitted.length > 0 &&
          !ictLineReadyForCompilation && (
            <Alert variant="warning" title="Accept all ICT departmental responses" className="compilation-gate-alert">
              <p style={{ margin: 0 }}>
                This request uses national-line (ICT) departments. The national preview includes ICT only after{' '}
                <strong>every</strong> submitted departmental response is accepted. Open{' '}
                <Link to="/federal-department-requests">{LABEL_DEPARTMENTAL_RESPONSES}</Link>, review each task, and accept—then
                refresh this page if the preview is still empty.
              </p>
            </Alert>
          )}
        {selectedReqId && provinceCoverage.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p className="muted font-semibold text-compact" style={{ margin: '0 0 8px' }}>
              Provincial submissions for <strong>{selectedReqId}</strong> —{' '}
              <strong>{provinceCounts.submitted}</strong> of <strong>{provinceCounts.assigned}</strong> submitted
              {provinceCounts.pending > 0 ? (
                <>
                  {' '}
                  · <strong>{provinceCounts.pending}</strong> awaiting submission
                </>
              ) : null}
            </p>
            <StatsCards
              items={[
                { label: 'Provinces Assigned', value: provinceCounts.assigned },
                { label: 'Submitted', value: provinceCounts.submitted },
                { label: 'Pending', value: provinceCounts.pending },
                { label: 'Accepted (Review)', value: provinceCounts.accepted },
                ...(selectedResponses.length > 0
                  ? [
                      { label: 'Pending Review', value: responseCounts.pending },
                      { label: 'Needs Modification', value: responseCounts.needs_modification },
                      { label: 'Rejected', value: responseCounts.rejected },
                    ]
                  : []),
              ]}
            />
            <div style={{ marginTop: 10 }}>
              <RegionalSubmissionCoverageBar items={provinceCoverage} />
            </div>
          </div>
        )}
        {selectedReqId && (
          <div style={{ marginBottom: 14 }}>
            {selectedIctSubmitted.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <p className="muted font-semibold text-compact" style={{ margin: '0 0 8px' }}>
                  National-line (ICT) departmental tasks
                </p>
                <p className="muted text-compact" style={{ margin: '0 0 8px' }}>
                  {selectedIctAcceptedCount} of {selectedIctSubmitted.length} submitted task
                  {selectedIctSubmitted.length === 1 ? '' : 's'} accepted ·{' '}
                  {ictLineReadyForCompilation ? (
                    <strong>
                      ICT line complete — use the checkbox below to include {ictRegionName} in the national record.
                    </strong>
                  ) : (
                    <strong>Accept every submitted national-line task before ICT can be included.</strong>
                  )}
                </p>
                <div className="compilation-dept-status-grid">
                  {selectedIctSubmitted.map((t) => {
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
                          <StatusBadge tone={accepted ? 'success' : 'in-progress'}>
                            {accepted ? 'Accepted' : 'Pending review'}
                          </StatusBadge>
                        </div>
                      </div>
                    )
                  })}
                  {ictLineReadyForCompilation ? (
                    <div className="compilation-dept-status-row">
                      <label className="compilation-dept-status-row__check">
                        <input
                          type="checkbox"
                          checked={ictIncluded}
                          onChange={() => setIctIncluded((v) => !v)}
                          aria-label={`Include ${ictRegionName} national line in compilation`}
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
                  ? 'No provincial regions assigned on this request (ICT-only path is fine if the preview above lists ICT).'
                  : 'No provincial regions assigned and no ICT departmental submissions for this request yet.'}
              </p>
            ) : (
              <>
                {includableAcceptedResponses.length > 0 ? (
                  <FederalCompilationInclusionToolbar
                    onSelectAll={selectAllAcceptedProvinces}
                    onClearAll={clearAllInclusions}
                  />
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
                    const review = reviewStatusPresentation(r.review_status)
                    const canInclude = r.review_status === 'accepted'
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
                            aria-label={`Include ${item.regionName} in national compilation`}
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
        )}
        <label className="muted">Federal summary</label>
        <textarea
          rows={8}
          style={{ width: '100%', marginTop: 6 }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Write the federal administrator’s summary. Source material: provincial rows above when present, and national-line (ICT) departmental submissions accepted under Departmental responses."
        />
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Button
            variant="secondary"
            compact
            disabled={saving !== null || !canPersistCompilation}
            onClick={() => void save('draft')}
          >
            {saving === 'draft' ? 'Saving draft...' : 'Save draft'}
          </Button>
          <Button
            variant="primary"
            compact
            disabled={saving !== null || !canPersistCompilation}
            onClick={() => void save('submitted')}
          >
            {saving === 'submitted' ? 'Submitting...' : 'Submit'}
          </Button>
          {!canPersistCompilation && selectedReqId ? (
            <span className="muted small" style={{ flex: '1 1 200px' }}>
              Select at least one accepted province (checkbox) or include the ICT national line, then save.
            </span>
          ) : null}
        </div>
      </TableCard>

      <div style={{ marginTop: 20 }}>
        <TemporaryFederalCompilationPreviewCard
          requests={requests}
          responses={responses}
          deptTasks={deptTasks}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <MergeCompiledRecordsSection records={compiledRecords} />
      </div>
    </PageSection>
  )
}

function FederalCompilationInclusionToolbar({
  onSelectAll,
  onClearAll,
}: {
  onSelectAll: () => void
  onClearAll: () => void
}) {
  return (
    <div
      className="compilation-dept-toolbar"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginBottom: 10 }}
    >
      <button type="button" className="link-button" onClick={onSelectAll}>
        Select all accepted
      </button>
      <button type="button" className="link-button" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  )
}
