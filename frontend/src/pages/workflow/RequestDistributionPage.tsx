import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchHrRequests } from '../../api/hrRequests'
import { coerceHrRequestStatus } from '../../types/hrRequest'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../../api/lists'
import { createDepartmentTask, fetchDepartments, type DepartmentRow } from '../../api/workflows'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { TableCard } from '../../components/ui/TableCard'

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
  const [selectedReq, setSelectedReq] = useState<string>('')
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const [reqs, taskRows, deptRows] = await Promise.all([
      fetchHrRequests(),
      fetchDepartmentTasks(),
      fetchDepartments(),
    ])
    setRequests(reqs)
    setTasks(taskRows)
    setDepartments(deptRows)
  }

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const openRequests = useMemo(() => {
    return requests.filter(
      (r) => coerceHrRequestStatus(r.status) === 'active' && !tasks.some((t) => t.req_id === r.id),
    )
  }, [requests, tasks])

  useEffect(() => {
    if (!preselectReqId) return
    if (!openRequests.some((r) => r.id === preselectReqId)) return
    setSelectedReq(preselectReqId)
  }, [preselectReqId, openRequests])

  const selectedRequestLabel = useMemo(
    () => openRequests.find((r) => r.id === selectedReq)?.title ?? '',
    [openRequests, selectedReq],
  )

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
    setSaving(true)
    setError(null)
    try {
      for (const id of selectedDeptIds) {
        await createDepartmentTask(selectedReq, id)
      }
      setSelectedReq('')
      setSelectedDeptIds([])
      await load()
      navigate(nextPath)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageSection
      title={title}
    >
      {error && <p className="login-error">{error}</p>}
      {preselectUnavailable && (
        <p className="muted" style={{ marginTop: 12 }}>
          Request <strong>{preselectReqId}</strong> is not in the undistributed list (it may already be assigned).
          Choose another request below.
        </p>
      )}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'Undistributed requests', value: openRequests.length },
            { label: 'Available departments', value: departments.length },
            { label: 'Selected assignees', value: selectedDeptIds.length },
          ]}
        />
      </div>

      <TableCard padded>
        <label className="muted">Select request</label>
        <select
          style={{ width: '100%', marginTop: 6, marginBottom: 14 }}
          value={selectedReq}
          onChange={(e) => setSelectedReq(e.target.value)}
        >
          <option value="">-- choose --</option>
          {openRequests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} — {r.title}
            </option>
          ))}
        </select>
        {selectedReq && (
          <p className="muted" style={{ margin: '0 0 10px' }}>
            Selected request: <strong>{selectedReq}</strong> — {selectedRequestLabel}
          </p>
        )}

        <label className="muted">Assign departments</label>
        <div className="checkbox-grid" style={{ marginTop: 8 }}>
          {departments.map((d) => (
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

        <div style={{ marginTop: 14 }}>
          <Button variant="primary" compact disabled={saving} onClick={() => void assign()}>
            {saving ? 'Assigning...' : 'Assign selected departments'}
          </Button>
        </div>
      </TableCard>
    </PageSection>
  )
}
