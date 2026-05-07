import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchHrRequests } from '../../api/hrRequests'
import { createCompiledRecord, fetchCompilationPreview } from '../../api/workflows'
import { fetchRegionalResponses, type RegionalResponseRow } from '../../api/lists'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import type { HrRequestRow } from '../../types/hrRequest'

function responseListSignature(rows: RegionalResponseRow[]): string {
  return [...rows.map((r) => r.id)].sort().join('\u001f')
}

function reviewStatusPresentation(status: string): {
  label: string
  tone: 'pending' | 'success' | 'warning' | 'danger' | 'default'
} {
  if (status === 'accepted') return { label: 'Accepted', tone: 'success' }
  if (status === 'needs-modification') return { label: 'Needs modification', tone: 'warning' }
  if (status === 'rejected') return { label: 'Rejected', tone: 'danger' }
  return { label: 'Pending', tone: 'pending' }
}

export function FederalCompilationPage() {
  const [requests, setRequests] = useState<HrRequestRow[]>([])
  const [responses, setResponses] = useState<RegionalResponseRow[]>([])
  const [selectedReqId, setSelectedReqId] = useState('')
  const [preview, setPreview] = useState<{ region_names: string[]; response_count: number } | null>(null)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'draft' | 'submitted' | null>(null)
  const [includedResponseIds, setIncludedResponseIds] = useState<string[]>([])

  useEffect(() => {
    void Promise.all([fetchHrRequests(), fetchRegionalResponses()])
      .then(([reqRows, responseRows]) => {
        setError(null)
        setRequests(reqRows)
        setResponses(responseRows)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load compilation data'))
  }, [])

  const reqIdsWithResponses = useMemo(() => {
    const ids = [...new Set(responses.map((r) => r.req_id))]
    ids.sort((a, b) => a.localeCompare(b))
    return ids
  }, [responses])

  const requestsForSelect = useMemo(() => {
    const allowed = new Set(reqIdsWithResponses)
    return requests.filter((r) => allowed.has(r.id)).sort((a, b) => a.id.localeCompare(b.id))
  }, [requests, reqIdsWithResponses])

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

  const viewResponseKey = useMemo(() => responseListSignature(selectedResponses), [selectedResponses])
  const includedSet = useMemo(() => new Set(includedResponseIds), [includedResponseIds])

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

  const prefillSummary = useMemo(() => {
    const picked = selectedResponses.filter((r) => includedSet.has(r.id))
    if (!picked.length) return ''
    return picked
      .map((r) => {
        const status = reviewStatusPresentation(r.review_status)
        return (
          `[${r.req_id}] [${r.region_name ?? 'Unknown region'}]` +
          `\nReview: ${status.label}` +
          `\n${r.content?.trim() || 'No response content.'}`
        )
      })
      .join('\n\n')
  }, [selectedResponses, includedSet])

  useEffect(() => {
    if (!selectedReqId) {
      setIncludedResponseIds([])
      return
    }
    setIncludedResponseIds(selectedResponses.map((r) => r.id))
  }, [selectedReqId, viewResponseKey])

  function toggleResponseInclusion(responseId: string) {
    setIncludedResponseIds((prev) =>
      prev.includes(responseId) ? prev.filter((id) => id !== responseId) : [...prev, responseId],
    )
  }

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(null)
    }
  }

  return (
    <PageSection
      title="Compilation center"
      subtitle={
        <>
          National record: only <strong>accepted</strong> regional compilations count toward the preview below. Review and accept
          each province’s submission in <Link to="/responses">Regional responses</Link>, then prefill from those responses here.
          Saved records appear under <Link to="/compiled-records">Compiled records</Link>.
        </>
      }
    >
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
        {requestsForSelect.length === 0 ? (
          <p className="muted" style={{ margin: '8px 0 12px', fontSize: 13 }}>
            No regional compilations are in the system yet for any request. Provinces submit from <Link to="/region-compilation">Response compilation</Link>, then return here to build the national record.
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
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
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
                <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
                  <strong>{selectedResponses.length}</strong> regional response{selectedResponses.length === 1 ? '' : 's'} —{' '}
                  <strong>{selectedResponses.filter((r) => includedSet.has(r.id)).length}</strong> included in draft prefill.
                </p>
                <div
                  className="compilation-dept-toolbar"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginBottom: 10 }}
                >
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setIncludedResponseIds(selectedResponses.map((r) => r.id))}
                  >
                    Select all
                  </button>
                  <button type="button" className="link-button" onClick={() => setIncludedResponseIds([])}>
                    Clear all
                  </button>
                </div>
                <div className="compilation-dept-status-grid" style={{ marginBottom: 10 }}>
                  {selectedResponses.map((r) => {
                    const review = reviewStatusPresentation(r.review_status)
                    const checked = includedSet.has(r.id)
                    return (
                      <label
                        key={r.id}
                        className="compilation-dept-status-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '8px 10px',
                          border: '1px solid var(--field-border, #e1e7f5)',
                          borderRadius: 8,
                          marginBottom: 6,
                          background: '#fafbfd',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleResponseInclusion(r.id)}
                          aria-label={`Include ${r.region_name ?? 'region'} in national compilation for ${r.req_id}`}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>
                          <span className="muted small" style={{ display: 'block', fontWeight: 500 }}>
                            {r.title?.trim() || r.req_id}
                          </span>
                          {r.region_name ?? 'Unknown region'}
                        </span>
                        <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
                      </label>
                    )
                  })}
                </div>
                <Button
                  variant="secondary"
                  compact
                  disabled={includedResponseIds.length === 0}
                  onClick={() => setSummary(prefillSummary)}
                >
                  {summary.trim() ? 'Replace summary from selected responses' : 'Prefill from selected responses'}
                </Button>
                {includedResponseIds.length === 0 && (
                  <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                    Select at least one response to build summary text.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        <label className="muted">Compilation summary</label>
        <textarea
          rows={8}
          style={{ width: '100%', marginTop: 6 }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Write a national compilation summary..."
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
            <span className="muted" style={{ fontSize: 12, flex: '1 1 200px' }}>
              Save is available after at least one region is <strong>accepted</strong> for this request.
            </span>
          ) : null}
        </div>
      </TableCard>
    </PageSection>
  )
}
