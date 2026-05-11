import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { fetchHrRequests } from '../../api/hrRequests'
import { fetchDepartmentTasks, fetchRegionalResponses, type DepartmentTaskRow } from '../../api/lists'
import { createRegionalResponse } from '../../api/workflows'
import { DepartmentTaskResponseModal } from '../../components/DepartmentTaskResponseModal'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { formatDepartmentResponseAsPlaintext } from '../../lib/departmentTaskResponseFormat'
import { countDepartmentTasksByWorkflow, workflowPresentation } from '../../lib/departmentTaskWorkflow'
import { isRegionalAdmin } from '../../lib/roles'
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
  const { user } = useAuth()
  const [requests, setRequests] = useState<HrRequestRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  /** For regional admins: request IDs that already have a regional compilation (API is scoped to their region). */
  const [compiledReqIds, setCompiledReqIds] = useState<Set<string>>(() => new Set())
  const [selectedReqId, setSelectedReqId] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** Department task IDs to pull into the compilation draft (checkboxes). */
  const [includedTaskIds, setIncludedTaskIds] = useState<string[]>([])
  const [viewingTask, setViewingTask] = useState<DepartmentTaskRow | null>(null)

  useEffect(() => {
    void Promise.all([fetchHrRequests(), fetchDepartmentTasks(), fetchRegionalResponses()])
      .then(([reqs, taskRows, regionalRows]) => {
        setRequests(reqs)
        setTasks(taskRows)
        if (isRegionalAdmin(user) && user?.region != null) {
          setCompiledReqIds(new Set(regionalRows.map((r) => r.req_id)))
        } else {
          setCompiledReqIds(new Set())
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [user?.id, user?.region?.id])

  const requestsForCompilationSelect = useMemo(
    () => requests.filter((r) => !compiledReqIds.has(r.id)),
    [requests, compiledReqIds],
  )

  useEffect(() => {
    if (selectedReqId && compiledReqIds.has(selectedReqId)) {
      setSelectedReqId('')
      setContent('')
    }
  }, [selectedReqId, compiledReqIds])

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
          `\n${formatDepartmentResponseAsPlaintext(t.response_data, t.attachment_url)}`
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
        <StatsCards
          items={[
            {
              label: isRegionalAdmin(user) ? 'Open for compilation' : 'HR requests (list)',
              value: isRegionalAdmin(user) ? requestsForCompilationSelect.length : requests.length,
            },
            ...(isRegionalAdmin(user) && compiledReqIds.size > 0
              ? [{ label: 'Already compiled (this region)', value: compiledReqIds.size }]
              : []),
          ]}
        />
      </div>
      {selectedReqId && workflowCounts && (
        <div style={{ marginTop: 14 }}>
          <p className="muted font-semibold text-compact" style={{ margin: '0 0 8px' }}>
            Distribution progress for <strong>{selectedReqId}</strong>
          </p>
          <StatsCards
            items={[
              { label: 'Departments distributed', value: selectedTasks.length },
              { label: 'Pending submission', value: workflowCounts.in_process },
              { label: 'Pending regional review', value: workflowCounts.responded },
              { label: 'Resubmission requested', value: workflowCounts.revision },
              { label: 'Accepted by region', value: workflowCounts.accepted },
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
          {requestsForCompilationSelect.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} — {r.title}
            </option>
          ))}
        </select>
        {isRegionalAdmin(user) && requests.length > 0 && requestsForCompilationSelect.length === 0 ? (
          <p className="muted text-compact" style={{ margin: '0 0 12px' }}>
            Every listed request already has a regional compilation from your province. Manage or review it under{' '}
            <Link to="/responses">Regional responses</Link> or <Link to="/region-history">submission history</Link>.
          </p>
        ) : null}

        {selectedReq && (
          <div style={{ marginBottom: 14 }}>
            {selectedTasks.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No departments have been assigned to this request yet. Use <strong>Request distribution</strong> first.
              </p>
            ) : (
              <>
                <p className="muted text-compact" style={{ margin: '0 0 8px' }}>
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
                      <div key={t.id} className="compilation-dept-status-row">
                        <label className="compilation-dept-status-row__check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTaskInclusion(t.id)}
                            aria-label={`Include ${t.department_name ?? t.department_id} in compilation`}
                          />
                        </label>
                        <button
                          type="button"
                          className="compilation-dept-status-row__body"
                          onClick={() => setViewingTask(t)}
                          title="Open department submission"
                        >
                          <span className="compilation-dept-status-row__label">
                            {t.region_name ? (
                              <>
                                <span className="compilation-dept-status-row__region">{t.region_name}</span>
                                <span className="compilation-dept-status-row__sep">—</span>
                              </>
                            ) : null}
                            <span className="compilation-dept-status-row__dept">
                              {t.department_name ?? t.department_id}
                            </span>
                          </span>
                          <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
                        </button>
                      </div>
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
                  <p className="muted small" style={{ margin: '8px 0 0' }}>
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

      <DepartmentTaskResponseModal task={viewingTask} onClose={() => setViewingTask(null)} />
    </PageSection>
  )
}
