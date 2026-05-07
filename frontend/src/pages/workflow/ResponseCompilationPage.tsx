import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchHrRequests } from '../../api/hrRequests'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../../api/lists'
import { createRegionalResponse } from '../../api/workflows'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { countDepartmentTasksByWorkflow, workflowPresentation } from '../../lib/departmentTaskWorkflow'
import type { HrRequestRow } from '../../types/hrRequest'

function taskListSignature(tasks: DepartmentTaskRow[]): string {
  return [...tasks.map((t) => t.id)].sort().join('\u001f')
}

type Props = {
  title: string
  nextPath: string
}

export function ResponseCompilationPage({ title, nextPath }: Props) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<HrRequestRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [selectedReqId, setSelectedReqId] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** Department task IDs to pull into the compilation draft (checkboxes). */
  const [includedTaskIds, setIncludedTaskIds] = useState<string[]>([])

  useEffect(() => {
    void Promise.all([fetchHrRequests(), fetchDepartmentTasks()])
      .then(([reqs, taskRows]) => {
        setRequests(reqs)
        setTasks(taskRows)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const selectedReq = useMemo(
    () => requests.find((r) => r.id === selectedReqId) ?? null,
    [requests, selectedReqId],
  )
  const selectedTasks = useMemo(
    () => tasks.filter((t) => t.req_id === selectedReqId),
    [tasks, selectedReqId],
  )
  const workflowCounts = useMemo(
    () => (selectedReqId ? countDepartmentTasksByWorkflow(selectedTasks) : null),
    [selectedReqId, selectedTasks],
  )

  const selectedTaskIdKey = useMemo(() => taskListSignature(selectedTasks), [selectedTasks])

  useEffect(() => {
    if (!selectedReqId) {
      setIncludedTaskIds([])
      return
    }
    setIncludedTaskIds(selectedTasks.map((t) => t.id))
  }, [selectedReqId, selectedTaskIdKey])

  const includedSet = useMemo(() => new Set(includedTaskIds), [includedTaskIds])

  const prefill = useMemo(() => {
    const picked = selectedTasks.filter((t) => includedSet.has(t.id))
    if (!picked.length) return ''
    return picked
      .map((t) => {
        const wf = workflowPresentation(t)
        return (
          `[${t.department_name ?? t.department_id}]` +
          `\nProgress: ${wf.label}` +
          `\n${t.response_data ?? 'No response data yet.'}`
        )
      })
      .join('\n\n')
  }, [selectedTasks, includedSet])

  function toggleTaskInclusion(taskId: string) {
    setIncludedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    )
  }

  async function submit() {
    if (!selectedReq) {
      setError('Select a request first.')
      return
    }
    if (!content.trim()) {
      setError('Compiled response content is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createRegionalResponse({
        hr_request_id: selectedReq.id,
        title: `${selectedReq.title} - consolidated response`,
        content: content.trim(),
      })
      navigate(nextPath)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageSection
      title={title}
      subtitle={
        <>
          Compile department inputs into one regional submission for this request. After you submit, federal reviewers see it in{' '}
          <Link to="/responses">Regional responses</Link> (national users) and may accept it or request changes.
        </>
      }
    >
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards items={[{ label: 'Requests available', value: requests.length }]} />
      </div>
      {selectedReqId && workflowCounts && (
        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
            Distribution progress for <strong>{selectedReqId}</strong>
          </p>
          <StatsCards
            items={[
              { label: 'Departments distributed', value: selectedTasks.length },
              { label: 'In process', value: workflowCounts.in_process },
              { label: 'Responded', value: workflowCounts.responded },
              { label: 'Revision', value: workflowCounts.revision },
              { label: 'Accepted', value: workflowCounts.accepted },
            ]}
          />
        </div>
      )}

      <TableCard padded>
        <label className="muted">Select request ID</label>
        <select
          style={{ width: '100%', marginTop: 6, marginBottom: 12 }}
          value={selectedReqId}
          onChange={(e) => setSelectedReqId(e.target.value)}
        >
          <option value="">-- choose --</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} — {r.title}
            </option>
          ))}
        </select>

        {selectedReq && (
          <div style={{ marginBottom: 14 }}>
            {selectedTasks.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No departments have been assigned to this request yet. Use <strong>Request distribution</strong> first.
              </p>
            ) : (
              <>
                <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
                  <strong>{selectedTasks.length}</strong> department
                  {selectedTasks.length === 1 ? '' : 's'} — breakdown above.{' '}
                  <strong>{includedTaskIds.length}</strong> included in compilation draft.
                </p>
                <div
                  className="compilation-dept-toolbar"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginBottom: 10 }}
                >
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setIncludedTaskIds(selectedTasks.map((t) => t.id))}
                  >
                    Select all
                  </button>
                  <button type="button" className="link-button" onClick={() => setIncludedTaskIds([])}>
                    Clear all
                  </button>
                </div>
                <div className="compilation-dept-status-grid" style={{ marginBottom: 10 }}>
                  {selectedTasks.map((t) => {
                    const wf = workflowPresentation(t)
                    const checked = includedSet.has(t.id)
                    return (
                      <label
                        key={t.id}
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
                          onChange={() => toggleTaskInclusion(t.id)}
                          aria-label={`Include ${t.department_name ?? t.department_id} in compilation`}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>
                          {t.department_name ?? t.department_id}
                        </span>
                        <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
                      </label>
                    )
                  })}
                </div>
                <Button
                  variant="secondary"
                  compact
                  disabled={includedTaskIds.length === 0}
                  onClick={() => setContent(prefill)}
                >
                  {content.trim() ? 'Replace draft with selected departments' : 'Prefill from selected departments'}
                </Button>
                {includedTaskIds.length === 0 && (
                  <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                    Select at least one department to build text from task notes.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <label className="muted">Compiled response content</label>
        <textarea
          rows={8}
          style={{ width: '100%', marginTop: 6 }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Summarize department submissions, issues, and final response narrative."
        />
        <div style={{ marginTop: 12 }}>
          <Button variant="primary" compact disabled={saving} onClick={() => void submit()}>
            {saving ? 'Submitting...' : 'Submit compiled response'}
          </Button>
        </div>
      </TableCard>
    </PageSection>
  )
}
