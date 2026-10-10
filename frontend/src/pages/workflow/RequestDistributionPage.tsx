import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchHrRequests } from '../../api/hrRequests'
import { coerceHrRequestStatus } from '../../types/hrRequest'
import {
  fetchDepartmentTasks,
  fetchRegionalResponses,
  type DepartmentTaskRow,
} from '../../api/lists'
import { createDepartmentTask, fetchDepartments, type DepartmentRow } from '../../api/workflows'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { TableCard } from '../../components/ui/TableCard'
import { indicatorsScopedToRequest } from '../../lib/hrRequestIndicatorScope'

type Props = {
  title: string
  nextPath: string
}

export function RequestDistributionPage({ title, nextPath }: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectReqId = searchParams.get('req')
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof fetchHrRequests>>>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [departments, setDepartments] = useState<DepartmentRow[]>([])
  const [compiledReqIds, setCompiledReqIds] = useState<Set<string>>(() => new Set())
  const [selectedReq, setSelectedReq] = useState<string>('')
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([])
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const [reqs, taskRows, deptRows, regionalRows] = await Promise.all([
      fetchHrRequests(),
      fetchDepartmentTasks(),
      fetchDepartments(),
      fetchRegionalResponses(),
    ])
    setRequests(reqs)
    setTasks(taskRows)
    setDepartments(deptRows)
    setCompiledReqIds(new Set(regionalRows.map((r) => r.req_id)))
  }

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  /** Active requests that are not yet compiled — may already have some department assignments. */
  const openRequests = useMemo(() => {
    return requests.filter(
      (r) => coerceHrRequestStatus(r.status) === 'active' && !compiledReqIds.has(r.id),
    )
  }, [requests, compiledReqIds])

  const undistributedCount = useMemo(
    () => openRequests.filter((r) => !tasks.some((t) => t.req_id === r.id)).length,
    [openRequests, tasks],
  )

  useEffect(() => {
    if (!preselectReqId) return
    if (!openRequests.some((r) => r.id === preselectReqId)) return
    setSelectedReq(preselectReqId)
  }, [preselectReqId, openRequests])

  const selectedRequest = useMemo(
    () => openRequests.find((r) => r.id === selectedReq) ?? null,
    [openRequests, selectedReq],
  )
  const selectedRequestLabel = selectedRequest?.title ?? ''
  const requestDueDate = selectedRequest?.date?.trim() || ''

  const tasksForSelected = useMemo(
    () => (selectedReq ? tasks.filter((t) => t.req_id === selectedReq) : []),
    [tasks, selectedReq],
  )

  /** Task `department_id` is usually the department code, not the numeric DB id. */
  const availableDepartments = useMemo(() => {
    const assignedKeys = new Set<string>()
    for (const t of tasksForSelected) {
      const code = String(t.department_id ?? '')
        .trim()
        .toLowerCase()
      if (code) assignedKeys.add(`code:${code}`)
      const name = t.department_name?.trim().toLowerCase()
      if (name) assignedKeys.add(`name:${name}`)
    }
    return departments.filter((d) => {
      const code = (d.code ?? '').trim().toLowerCase()
      if (code && assignedKeys.has(`code:${code}`)) return false
      if (assignedKeys.has(`code:${String(d.id)}`)) return false
      const name = d.name.trim().toLowerCase()
      if (name && assignedKeys.has(`name:${name}`)) return false
      return true
    })
  }, [departments, tasksForSelected])

  const isRedistribute = Boolean(selectedReq && tasksForSelected.length > 0)

  useEffect(() => {
    if (!selectedReq) {
      setDueDate('')
      setSelectedDeptIds([])
      return
    }
    setDueDate(requestDueDate)
    setSelectedDeptIds([])
  }, [selectedReq, requestDueDate])

  const preselectUnavailable = useMemo(() => {
    if (!preselectReqId || requests.length === 0) return false
    if (openRequests.some((r) => r.id === preselectReqId)) return false
    return requests.some((r) => r.id === preselectReqId)
  }, [preselectReqId, requests, openRequests])

  async function assign() {
    if (!selectedReq) {
      setError('Select a request first.')
      return
    }
    if (selectedDeptIds.length === 0) {
      setError('Select at least one department.')
      return
    }
    if (!dueDate.trim()) {
      setError('Set a department due date.')
      return
    }
    if (requestDueDate && dueDate.trim() > requestDueDate) {
      setError(`Department due date must be on or before the request due date (${requestDueDate}).`)
      return
    }
    const indicatorIds = indicatorsScopedToRequest(selectedRequest ?? undefined).map((i) => i.id)
    if (indicatorIds.length === 0) {
      setError('This request has no indicators to assign.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      for (const id of selectedDeptIds) {
        await createDepartmentTask(selectedReq, id, {
          due_date: dueDate.trim(),
          issue_indicator_ids: indicatorIds,
        })
      }
      setSelectedReq('')
      setSelectedDeptIds([])
      setDueDate('')
      await load()
      navigate(nextPath)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageSection title={title}>
      {error && <p className="login-error">{error}</p>}
      {preselectUnavailable && (
        <p className="muted" style={{ marginTop: 12 }}>
          Request <strong>{preselectReqId}</strong> is not available for distribution
          {compiledReqIds.has(preselectReqId ?? '')
            ? ' (it has already been compiled).'
            : '.'}{' '}
          Choose another request below.
        </p>
      )}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'Open for distribution', value: openRequests.length },
            { label: 'Not yet assigned', value: undistributedCount },
            { label: 'Available departments', value: availableDepartments.length },
            { label: 'Selected assignees', value: selectedDeptIds.length },
          ]}
        />
      </div>

      <TableCard padded>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          You can assign or redistribute departments until a regional compilation is submitted for the
          request.
        </p>
        <label className="muted">Select request</label>
        <select
          style={{ width: '100%', marginTop: 6, marginBottom: 14 }}
          value={selectedReq}
          onChange={(e) => setSelectedReq(e.target.value)}
        >
          <option value="">-- choose --</option>
          {openRequests.map((r) => {
            const assigned = tasks.some((t) => t.req_id === r.id)
            return (
              <option key={r.id} value={r.id}>
                {r.id} — {r.title}
                {assigned ? ' (redistribute)' : ''}
              </option>
            )
          })}
        </select>
        {selectedReq && (
          <p className="muted" style={{ margin: '0 0 10px' }}>
            Selected request: <strong>{selectedReq}</strong> — {selectedRequestLabel}
            {requestDueDate ? (
              <>
                {' '}
                (request due: <strong>{requestDueDate}</strong>)
              </>
            ) : null}
            {isRedistribute ? (
              <>
                {' '}
                — <strong>{tasksForSelected.length}</strong> department
                {tasksForSelected.length === 1 ? '' : 's'} already assigned
              </>
            ) : null}
          </p>
        )}

        {selectedReq && (
          <div className="form-row" style={{ marginBottom: 14 }}>
            <label className="muted" htmlFor="dist-due-date">
              Department due date
              {requestDueDate ? ` (on or before ${requestDueDate})` : ''}
            </label>
            <input
              id="dist-due-date"
              type="date"
              required
              value={dueDate}
              max={requestDueDate || undefined}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: '100%', maxWidth: 280, marginTop: 6 }}
            />
          </div>
        )}

        <label className="muted">
          {isRedistribute ? 'Assign additional departments' : 'Assign departments'}
        </label>
        {selectedReq && availableDepartments.length === 0 ? (
          <p className="muted" style={{ margin: '8px 0 0' }}>
            All region departments are already assigned to this request. Redistribution stays open until
            the response is compiled — add departments under <strong>Manage departments</strong> if needed.
          </p>
        ) : (
          <div className="checkbox-grid" style={{ marginTop: 8 }}>
            {availableDepartments.map((d) => (
              <label key={d.id} className="checkbox-card">
                <input
                  type="checkbox"
                  checked={selectedDeptIds.includes(d.id)}
                  onChange={(e) =>
                    setSelectedDeptIds((prev) =>
                      e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id),
                    )
                  }
                />
                <span className="checkbox-card-label">
                  {d.code ? `${d.code} — ` : ''}
                  {d.name}
                </span>
              </label>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <Button
            variant="primary"
            compact
            disabled={saving || availableDepartments.length === 0}
            onClick={() => void assign()}
          >
            {saving
              ? 'Assigning...'
              : isRedistribute
                ? 'Redistribute to selected departments'
                : 'Assign selected departments'}
          </Button>
        </div>
      </TableCard>
    </PageSection>
  )
}
