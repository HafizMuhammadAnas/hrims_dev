import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchHrRequests } from '../../api/hrRequests'
import { createCompiledRecord, fetchCompilationPreview } from '../../api/workflows'
import {
  fetchCompiledRecords,
  fetchDepartmentTasks,
  fetchRegionalResponses,
  type CompiledRecordRow,
  type DepartmentTaskRow,
  type RegionalResponseRow,
} from '../../api/lists'
import { CompiledRecordsWorkflowNav, isFromCompiledRecordsPath } from '../../components/CompiledRecordsWorkflowNav'
import { RegionalResponsePreviewModal } from '../../components/RegionalResponsePreviewModal'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import type { HrRequestRow } from '../../types/hrRequest'

function reviewStatusPresentation(status: string): {
  label: string
  tone: 'pending' | 'success' | 'warning' | 'danger' | 'default'
} {
  if (status === 'accepted') return { label: 'Accepted', tone: 'success' }
  if (status === 'needs-modification') return { label: 'Needs modification', tone: 'warning' }
  if (status === 'rejected') return { label: 'Rejected', tone: 'danger' }
  return { label: 'Pending', tone: 'pending' }
}

function sortTasksByDept(a: DepartmentTaskRow, b: DepartmentTaskRow): number {
  const an = (a.department_name ?? a.department_id).toLowerCase()
  const bn = (b.department_name ?? b.department_id).toLowerCase()
  return an.localeCompare(bn)
}

export function FederalCompilationPage() {
  const [searchParams] = useSearchParams()
  const [requests, setRequests] = useState<HrRequestRow[]>([])
  const [responses, setResponses] = useState<RegionalResponseRow[]>([])
  const [deptTasks, setDeptTasks] = useState<DepartmentTaskRow[]>([])
  const [viewingResponse, setViewingResponse] = useState<RegionalResponseRow | null>(null)
  const [selectedReqId, setSelectedReqId] = useState('')
  const [preview, setPreview] = useState<{ region_names: string[]; response_count: number } | null>(null)
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

  const reqIdsWithResponses = useMemo(() => {
    const ids = [...new Set(responses.map((r) => r.req_id))]
    ids.sort((a, b) => a.localeCompare(b))
    return ids
  }, [responses])

  /** Requests already submitted to the ministry from this center — hide from the picker. */
  const reqIdsNationallySubmitted = useMemo(() => {
    const s = new Set<string>()
    for (const c of compiledRecords) {
      if (c.status === 'submitted' && c.req_id) s.add(c.req_id)
    }
    return s
  }, [compiledRecords])

  const requestsForSelect = useMemo(() => {
    const allowed = new Set(reqIdsWithResponses)
    return requests
      .filter((r) => allowed.has(r.id) && !reqIdsNationallySubmitted.has(r.id))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [requests, reqIdsWithResponses, reqIdsNationallySubmitted])

  useEffect(() => {
    if (selectedReqId && reqIdsNationallySubmitted.has(selectedReqId)) {
      setSelectedReqId('')
      setSummary('')
      setPreview(null)
    }
  }, [selectedReqId, reqIdsNationallySubmitted])

  useEffect(() => {
    if (!selectedReqId) {
      setPreview(null)
      return
    }
    void fetchCompilationPreview(selectedReqId)
      .then(setPreview)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to preview'))
  }, [selectedReqId])

  useEffect(() => {
    if (!selectedReqId) return
    const refresh = () => {
      void fetchCompilationPreview(selectedReqId)
        .then(setPreview)
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

  const tasksForViewingResponse = useMemo(() => {
    if (!viewingResponse) return []
    return deptTasks.filter((t) => t.req_id === viewingResponse.req_id).sort(sortTasksByDept)
  }, [deptTasks, viewingResponse])

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

  /** Backend preview (and saved compiled records) only include regions with accepted regional responses. */
  const canPersistCompilation = Boolean(
    selectedReqId && preview && preview.region_names.length > 0,
  )

  async function save(status: 'draft' | 'submitted') {
    if (!selectedReq || !preview || preview.region_names.length === 0) {
      setError(
        'Cannot save yet: open Regional responses, set at least one province’s review status to Accepted for this request, then try again (refresh the page if you already accepted).',
      )
      return
    }
    setSaving(status)
    setError(null)
    try {
      await createCompiledRecord({
        hr_request_id: selectedReq.id,
        title: `Compiled Report - ${selectedReq.title}`,
        region_names: preview.region_names,
        summary: summary || null,
        status,
        submitted_to: status === 'submitted' ? 'Ministry of Human Rights' : null,
      })
      setSummary('')
      setSelectedReqId('')
      setPreview(null)
      void fetchCompiledRecords().then(setCompiledRecords).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(null)
    }
  }

  const fromCompiledRecords = isFromCompiledRecordsPath(searchParams.get('from'))

  return (
    <PageSection
      title="Compilation center"
      subtitle={
        <>
          National record: only <strong>accepted</strong> regional compilations count toward the preview below. Review and accept
          each province’s submission in <Link to="/responses">Regional responses</Link>, then prefill from those responses here.
          Saved records appear under <Link to="/compiled-records">Compilation records</Link>.
        </>
      }
    >
      {fromCompiledRecords && selectedReqId ? (
        <CompiledRecordsWorkflowNav reqId={selectedReqId} activeTab="compilation" />
      ) : null}
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'HR requests (with responses)', value: requestsForSelect.length },
            { label: 'Regional responses (selected)', value: selectedResponses.length },
            { label: 'Accepted (preview)', value: preview?.response_count ?? 0 },
            { label: 'Regions in preview', value: preview?.region_names.length ?? 0 },
          ]}
        />
      </div>
      <TableCard padded>
        <label className="muted">HR request</label>
        {requestsForSelect.length === 0 && reqIdsWithResponses.length === 0 ? (
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            No regional compilations are in the system yet for any request. Provinces submit from{' '}
            <Link to="/region-compilation">Response compilation</Link>, then return here to build the national record.
          </p>
        ) : null}
        {requestsForSelect.length === 0 && reqIdsWithResponses.length > 0 ? (
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            Every request with regional data has already been <strong>submitted to the ministry</strong> from this center.
            Open <Link to="/compiled-records">Compilation records</Link> to review saved national records.
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
          {requestsForSelect.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} — {r.title}
            </option>
          ))}
        </select>
        {preview && (
          <div className="chip-list" style={{ marginBottom: 10 }}>
            <StatusBadge tone="pending">Accepted responses: {preview.response_count}</StatusBadge>
            {preview.region_names.length > 0 ? (
              preview.region_names.map((name) => (
                <StatusBadge key={name}>{name}</StatusBadge>
              ))
            ) : (
              <span className="muted">No regions in preview.</span>
            )}
          </div>
        )}
        {selectedReqId &&
          preview &&
          !canPersistCompilation &&
          selectedResponses.length > 0 &&
          responseCounts.accepted === 0 && (
            <Alert variant="warning" title="Accept a regional response first" className="compilation-gate-alert">
              <p style={{ margin: 0 }}>
                This request has regional compilations, but none are <strong>accepted</strong> yet. Draft and submitted
                national records only include <strong>accepted</strong> provinces. Go to{' '}
                <Link to="/responses">Regional responses</Link>, open each row, set review status to{' '}
                <strong>accepted</strong>, and save—then return here (refresh if the preview still shows zero).
              </p>
            </Alert>
          )}
        {selectedReqId && (
          <div style={{ marginBottom: 14 }}>
            <p className="muted font-semibold text-compact" style={{ margin: '0 0 8px' }}>
              Response progress for <strong>{selectedReqId}</strong>
            </p>
            <StatsCards
              items={[
                { label: 'Pending', value: responseCounts.pending },
                { label: 'Accepted', value: responseCounts.accepted },
                { label: 'Needs modification', value: responseCounts.needs_modification },
                { label: 'Rejected', value: responseCounts.rejected },
              ]}
            />
          </div>
        )}
        {selectedReqId && (
          <div style={{ marginBottom: 14 }}>
            {selectedResponses.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No regional responses for this request yet.
              </p>
            ) : (
              <>
                <p className="muted text-compact" style={{ margin: '0 0 8px' }}>
                  <strong>{selectedResponses.length}</strong> regional response{selectedResponses.length === 1 ? '' : 's'} for
                  this request. Open a row to read the provincial compilation; the ministry summary below is written only by
                  federal staff (regional text is not copied in automatically).
                </p>
                <div className="compilation-dept-status-grid" style={{ marginBottom: 10 }}>
                  {selectedResponses.map((r) => {
                    const review = reviewStatusPresentation(r.review_status)
                    return (
                      <div key={r.id} className="compilation-dept-status-row">
                        <button
                          type="button"
                          className="compilation-dept-status-row__body"
                          onClick={() => setViewingResponse(r)}
                          title="View provincial compilation"
                        >
                          <span className="compilation-dept-status-row__label compilation-dept-status-row__label--stacked">
                            <span className="compilation-dept-status-row__title-sub muted small">
                              {r.title?.trim() || r.req_id}
                            </span>
                            <span className="compilation-dept-status-row__dept">
                              {r.region_name ?? 'Unknown region'}
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
        <label className="muted">Federal summary for ministry</label>
        <textarea
          rows={8}
          style={{ width: '100%', marginTop: 6 }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Write the federal administrator’s summary for ministry submission. Provincial narratives are not filled in here automatically—use each regional row above for source material."
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
            {saving === 'submitted' ? 'Submitting...' : 'Submit to ministry'}
          </Button>
          {!canPersistCompilation && selectedReqId ? (
            <span className="muted small" style={{ flex: '1 1 200px' }}>
              Save is available after at least one region is <strong>accepted</strong> for this request.
            </span>
          ) : null}
        </div>
      </TableCard>

      <RegionalResponsePreviewModal
        row={viewingResponse}
        tasksForDetail={tasksForViewingResponse}
        onClose={() => setViewingResponse(null)}
        introText="Provincial consolidated response received for national compilation. Department submissions below are limited to this region."
      />
    </PageSection>
  )
}
