import { useEffect, useMemo, useState } from 'react'
import { fetchFederalGroups, type FederalGroupRow } from '../../api/federalGroups'
import { createCompiledRecord, fetchCompilationPreview } from '../../api/workflows'
import { fetchRegionalResponses, type RegionalResponseRow } from '../../api/lists'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'

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
  const [groups, setGroups] = useState<FederalGroupRow[]>([])
  const [responses, setResponses] = useState<RegionalResponseRow[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [preview, setPreview] = useState<{ region_names: string[]; response_count: number } | null>(null)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'draft' | 'submitted' | null>(null)
  /** Regional response IDs included in summary prefill. */
  const [includedResponseIds, setIncludedResponseIds] = useState<string[]>([])

  useEffect(() => {
    void Promise.all([fetchFederalGroups(), fetchRegionalResponses()])
      .then(([groupRows, responseRows]) => {
        setGroups(groupRows)
        setResponses(responseRows)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load federal groups'))
  }, [])

  useEffect(() => {
    if (!selectedGroupId) {
      setPreview(null)
      return
    }
    void fetchCompilationPreview(selectedGroupId)
      .then(setPreview)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to preview'))
  }, [selectedGroupId])

  const selected = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )
  const selectedResponses = useMemo(
    () => responses.filter((r) => r.federal_id === selectedGroupId),
    [responses, selectedGroupId],
  )
  const selectedResponseKey = useMemo(() => responseListSignature(selectedResponses), [selectedResponses])
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
  const prefillSummary = useMemo(() => {
    const picked = selectedResponses.filter((r) => includedSet.has(r.id))
    if (!picked.length) return ''
    return picked
      .map((r) => {
        const status = reviewStatusPresentation(r.review_status)
        return `[${r.region_name ?? 'Unknown region'}]` + `\nReview: ${status.label}` + `\n${r.content?.trim() || 'No response content.'}`
      })
      .join('\n\n')
  }, [selectedResponses, includedSet])

  useEffect(() => {
    if (!selectedGroupId) {
      setIncludedResponseIds([])
      return
    }
    setIncludedResponseIds(selectedResponses.map((r) => r.id))
  }, [selectedGroupId, selectedResponseKey])

  function toggleResponseInclusion(responseId: string) {
    setIncludedResponseIds((prev) =>
      prev.includes(responseId) ? prev.filter((id) => id !== responseId) : [...prev, responseId],
    )
  }

  async function save(status: 'draft' | 'submitted') {
    if (!selected || !preview || preview.region_names.length === 0) {
      setError('Pick a federal group with accepted regional responses first.')
      return
    }
    setSaving(status)
    setError(null)
    try {
      await createCompiledRecord({
        federal_group_id: selected.id,
        title: `Compiled Report - ${selected.title}`,
        region_names: preview.region_names,
        summary: summary || null,
        status,
        submitted_to: status === 'submitted' ? 'Ministry of Human Rights' : null,
      })
      setSummary('')
      setSelectedGroupId('')
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
      subtitle="Federal compilation of accepted regional responses into draft/submitted national records."
    >
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'Federal groups', value: groups.length },
            { label: 'Responses in group', value: selectedResponses.length },
            { label: 'Accepted responses (selected)', value: preview?.response_count ?? 0 },
            { label: 'Regions included', value: preview?.region_names.length ?? 0 },
          ]}
        />
      </div>
      <TableCard padded>
        <label className="muted">Federal group</label>
        <select
          style={{ width: '100%', marginTop: 6, marginBottom: 12 }}
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
        >
          <option value="">-- choose --</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.id} — {g.title}
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
        {selectedGroupId && (
          <div style={{ marginBottom: 14 }}>
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
              Response progress for <strong>{selectedGroupId}</strong>
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
        {selectedGroupId && (
          <div style={{ marginBottom: 14 }}>
            {selectedResponses.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No regional responses are linked to this federal group yet.
              </p>
            ) : (
              <>
                <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
                  <strong>{selectedResponses.length}</strong> regional responses —{' '}
                  <strong>{includedResponseIds.length}</strong> included in draft prefill.
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
                          aria-label={`Include ${r.region_name ?? 'region'} in federal compilation`}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>
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
          placeholder="Write a federal compilation summary..."
        />
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <Button variant="secondary" compact disabled={saving !== null} onClick={() => void save('draft')}>
            {saving === 'draft' ? 'Saving draft...' : 'Save draft'}
          </Button>
          <Button variant="primary" compact disabled={saving !== null} onClick={() => void save('submitted')}>
            {saving === 'submitted' ? 'Submitting...' : 'Submit to ministry'}
          </Button>
        </div>
      </TableCard>
    </PageSection>
  )
}
