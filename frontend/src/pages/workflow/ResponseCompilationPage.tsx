import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { fetchHrRequest, fetchHrRequests } from '../../api/hrRequests'
import { fetchDepartmentTasks, fetchRegionalResponses, type DepartmentTaskRow } from '../../api/lists'
import { fetchRegions } from '../../api/regions'
import { createRegionalResponse } from '../../api/workflows'
import { hrRequestViewPath } from '../../lib/workflowNavigation'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { DepartmentSubmissionsForRequest } from '../../components/DepartmentSubmissionsForRequest'
import {
  countDepartmentTasksByWorkflow,
  hasDepartmentResponse,
  workflowPresentation,
} from '../../lib/departmentTaskWorkflow'
import { isIctLineTask, isIctRegionalResponseRow, isIctRegionSlug } from '../../lib/ictRegion'
import { isFederalAdmin, isRegionalAdmin } from '../../lib/roles'
import type { HrRequestIssueIndicator, HrRequestRow } from '../../types/hrRequest'

function taskListSignature(tasks: DepartmentTaskRow[]): string {
  return [...tasks.map((t) => t.id)].sort().join('\u001f')
}

export type ResponseCompilationScope = 'regional' | 'ict'

type Props = {
  title: string
  nextPath: string
  scope: ResponseCompilationScope
}

export function ResponseCompilationPage({ title, nextPath, scope }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const ictScope = scope === 'ict'

  const [requests, setRequests] = useState<HrRequestRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [ictRegionId, setIctRegionId] = useState<number | null>(null)
  const [compiledReqIds, setCompiledReqIds] = useState<Set<string>>(() => new Set())
  const [selectedReqId, setSelectedReqId] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [includedTaskIds, setIncludedTaskIds] = useState<string[]>([])
  const [hrDetail, setHrDetail] = useState<HrRequestRow | null>(null)
  const compilationFrom = ictScope ? '/federal-compilation' : '/region-compilation'

  useEffect(() => {
    void Promise.all([
      fetchHrRequests(),
      fetchDepartmentTasks(),
      fetchRegionalResponses(),
      ictScope ? fetchRegions() : Promise.resolve([]),
    ])
      .then(([reqs, taskRows, regionalRows, regionRows]) => {
        setRequests(reqs)
        setTasks(taskRows)

        if (ictScope) {
          const ict = regionRows.find((r) => isIctRegionSlug(r.slug))
          setIctRegionId(ict?.id ?? null)
          setCompiledReqIds(
            new Set(regionalRows.filter((r) => isIctRegionalResponseRow(r)).map((r) => r.req_id)),
          )
        } else if (isRegionalAdmin(user) && user?.region != null) {
          setCompiledReqIds(new Set(regionalRows.map((r) => r.req_id)))
        } else {
          setCompiledReqIds(new Set())
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [user?.id, user?.region?.id, ictScope])

  const scopedTasks = useMemo(
    () => (ictScope ? tasks.filter((t) => isIctLineTask(t)) : tasks),
    [tasks, ictScope],
  )

  const reqIdsWithScopedTasks = useMemo(
    () => new Set(scopedTasks.map((t) => t.req_id)),
    [scopedTasks],
  )

  const requestsForCompilationSelect = useMemo(() => {
    return requests
      .filter((r) => {
        if (compiledReqIds.has(r.id)) return false
        if (ictScope) return reqIdsWithScopedTasks.has(r.id)
        return true
      })
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [requests, compiledReqIds, ictScope, reqIdsWithScopedTasks])

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

  useEffect(() => {
    if (!selectedReqId) {
      setHrDetail(null)
      return
    }
    let cancelled = false
    void fetchHrRequest(selectedReqId)
      .then((r) => {
        if (!cancelled) setHrDetail(r)
      })
      .catch(() => {
        if (!cancelled) setHrDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedReqId])

  const selectedTasks = useMemo(
    () => scopedTasks.filter((t) => t.req_id === selectedReqId),
    [scopedTasks, selectedReqId],
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

  function toggleTaskInclusion(taskId: string) {
    setIncludedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    )
  }

  const showCompilationStats =
    (ictScope && isFederalAdmin(user)) || (!ictScope && isRegionalAdmin(user))

  async function submit() {
    if (!selectedReq) {
      setError('Select a request first.')
      return
    }
    if (ictScope && ictRegionId == null) {
      setError('ICT region is not configured in the system.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createRegionalResponse({
        hr_request_id: selectedReq.id,
        title: `${selectedReq.title} - consolidated response`,
        content: content.trim() || '',
        ...(ictScope && ictRegionId != null ? { region_id: ictRegionId } : {}),
      })
      navigate(nextPath)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  const distributionLabel = ictScope ? 'Departmental responses' : 'Request distribution'
  const distributionPath = ictScope ? '/federal-department-requests' : '/region-distribution'
  const alreadyCompiledLabel = ictScope ? 'Already compiled (ICT)' : 'Already compiled (this region)'

  return (
    <PageSection title={title}>
      {error && <p className="login-error">{error}</p>}
      {showCompilationStats && (
        <CompilationSummaryStats
          openCount={requestsForCompilationSelect.length}
          compiledCount={compiledReqIds.size}
          alreadyCompiledLabel={alreadyCompiledLabel}
        />
      )}
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
        {selectedReq && (
          <CompilationDeptBlock
            selectedTasks={selectedTasks}
            includedTaskIds={includedTaskIds}
            includedSet={includedSet}
            ictScope={ictScope}
            distributionPath={distributionPath}
            distributionLabel={distributionLabel}
            issueIndicators={hrDetail?.issue?.indicators}
            onSelectAll={() => setIncludedTaskIds(selectedTasks.map((t) => t.id))}
            onClearAll={() => setIncludedTaskIds([])}
            onToggle={toggleTaskInclusion}
            onOpenTask={(t) => navigate(hrRequestViewPath(t.req_id, compilationFrom, t.id))}
          />
        )}

        <label className="muted">Compiled response content (optional)</label>
        <textarea
          rows={8}
          style={{ width: '100%', marginTop: 6 }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Summarize department submissions, issues, and final response narrative."
        />
        <CompilationSubmitButton saving={saving} onSubmit={() => void submit()} />
      </TableCard>

    </PageSection>
  )
}

function CompilationSummaryStats({
  openCount,
  compiledCount,
  alreadyCompiledLabel,
}: {
  openCount: number
  compiledCount: number
  alreadyCompiledLabel: string
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <StatsCards
        items={[
          { label: 'Open for compilation', value: openCount },
          ...(compiledCount > 0 ? [{ label: alreadyCompiledLabel, value: compiledCount }] : []),
        ]}
      />
    </div>
  )
}

function CompilationDeptBlock({
  selectedTasks,
  includedTaskIds,
  includedSet,
  ictScope,
  distributionPath,
  distributionLabel,
  issueIndicators,
  onSelectAll,
  onClearAll,
  onToggle,
  onOpenTask,
}: {
  selectedTasks: DepartmentTaskRow[]
  includedTaskIds: string[]
  includedSet: Set<string>
  ictScope: boolean
  distributionPath: string
  distributionLabel: string
  issueIndicators?: HrRequestIssueIndicator[]
  onSelectAll: () => void
  onClearAll: () => void
  onToggle: (id: string) => void
  onOpenTask: (t: DepartmentTaskRow) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {selectedTasks.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No departments have been assigned to this request yet. Use <Link to={distributionPath}>{distributionLabel}</Link>{' '}
          first.
        </p>
      ) : (
        <>
          <p className="muted text-compact" style={{ margin: '0 0 8px' }}>
            <strong>{selectedTasks.length}</strong> department
            {selectedTasks.length === 1 ? '' : 's'} — breakdown above.{' '}
            <strong>{includedTaskIds.length}</strong> included in compilation draft.
          </p>
          <CompilationDeptToolbar onSelectAll={onSelectAll} onClearAll={onClearAll} />
          <CompilationDeptGrid
            selectedTasks={selectedTasks}
            includedSet={includedSet}
            ictScope={ictScope}
            onToggle={onToggle}
            onOpenTask={onOpenTask}
          />
          {selectedTasks.some((t) => hasDepartmentResponse(t)) ? (
            <section className="hr-request-view-template__card" style={{ marginTop: 16, padding: 14 }}>
              <h4 className="card-section-heading" style={{ marginTop: 0 }}>
                Department submissions
              </h4>
              <DepartmentSubmissionsForRequest
                tasksForDetail={selectedTasks}
                reqId={selectedTasks[0]?.req_id ?? ''}
                issueIndicators={issueIndicators}
                omitHeading
                onlyWithSubmission
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function CompilationDeptToolbar({
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
        Select all
      </button>
      <button type="button" className="link-button" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  )
}

function CompilationDeptGrid({
  selectedTasks,
  includedSet,
  ictScope,
  onToggle,
  onOpenTask,
}: {
  selectedTasks: DepartmentTaskRow[]
  includedSet: Set<string>
  ictScope: boolean
  onToggle: (id: string) => void
  onOpenTask: (t: DepartmentTaskRow) => void
}) {
  return (
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
                onChange={() => onToggle(t.id)}
                aria-label={`Include ${t.department_name ?? t.department_id} in compilation`}
              />
            </label>
            <button
              type="button"
              className="compilation-dept-status-row__body"
              onClick={() => onOpenTask(t)}
              title="Open department submission"
            >
              <span className="compilation-dept-status-row__label">
                {!ictScope && t.region_name ? (
                  <>
                    <span className="compilation-dept-status-row__region">{t.region_name}</span>
                    <span className="compilation-dept-status-row__sep">—</span>
                  </>
                ) : null}
                <span className="compilation-dept-status-row__dept">{t.department_name ?? t.department_id}</span>
              </span>
              <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
            </button>
          </div>
        )
      })}
    </div>
  )
}

function CompilationSubmitButton({ saving, onSubmit }: { saving: boolean; onSubmit: () => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <Button variant="primary" compact disabled={saving} onClick={onSubmit}>
        {saving ? 'Submitting...' : 'Submit compiled response'}
      </Button>
    </div>
  )
}
