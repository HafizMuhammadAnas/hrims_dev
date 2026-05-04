import { useEffect, useMemo, useState } from 'react'
import { fetchFederalGroups, type FederalGroupRow } from '../../api/federalGroups'
import { createCompiledRecord, fetchCompilationPreview } from '../../api/workflows'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'

export function FederalCompilationPage() {
  const [groups, setGroups] = useState<FederalGroupRow[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [preview, setPreview] = useState<{ region_names: string[]; response_count: number } | null>(null)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'draft' | 'submitted' | null>(null)

  useEffect(() => {
    void fetchFederalGroups()
      .then(setGroups)
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
          <div className="chip-list">
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
