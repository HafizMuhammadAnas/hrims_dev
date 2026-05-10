import { useEffect, useMemo, useState } from 'react'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../../api/lists'
import { updateDepartmentTaskReview } from '../../api/workflows'
import { useAuth } from '../../auth/AuthContext'
import { DepartmentTaskResponseModal } from '../../components/DepartmentTaskResponseModal'
import { Button } from '../../components/ui/Button'
import { EmptyStateRow } from '../../components/ui/EmptyStateRow'
import { PageSection } from '../../components/ui/PageSection'
import { PaginationBar } from '../../components/ui/PaginationBar'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { TableToolbar } from '../../components/ui/TableToolbar'
import { derivePaginatedRows, useClientTableState } from '../../hooks/useClientTableState'
import {
  countDepartmentTasksByWorkflow,
  workflowPresentation,
} from '../../lib/departmentTaskWorkflow'
import { isFederalAdmin, isRegionalAdmin } from '../../lib/roles'
import type { AuthUser } from '../../types/auth'

type Props = {
  title: string
}

function userMayReviewTask(user: AuthUser | null, t: DepartmentTaskRow): boolean {
  if (!user) return false
  if (isFederalAdmin(user)) return true
  if (isRegionalAdmin(user) && user.region && user.region.id === t.region_id) return true
  return false
}

export function DepartmentMonitoringPage({ title }: Props) {
  const { user } = useAuth()
  const [rows, setRows] = useState<DepartmentTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<DepartmentTaskRow | null>(null)
  const [reviewComments, setReviewComments] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [savingReview, setSavingReview] = useState(false)
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table

  async function load() {
    const data = await fetchDepartmentTasks()
    setRows(data)
  }

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const requestIds = useMemo(() => Array.from(new Set(rows.map((r) => r.req_id))), [rows])
  const requestFilter = filters.requestId ?? ''
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (requestFilter && r.req_id !== requestFilter) return false
        const q = search.trim().toLowerCase()
        if (!q) return true
        return (
          r.id.toLowerCase().includes(q) ||
          r.req_id.toLowerCase().includes(q) ||
          String(r.department_name ?? r.department_id).toLowerCase().includes(q)
        )
      }),
    [rows, requestFilter, search],
  )
  const { pageRows } = useMemo(
    () => derivePaginatedRows(filtered, page, pageSize),
    [filtered, page, pageSize],
  )

  const workflowCounts = useMemo(() => countDepartmentTasksByWorkflow(filtered), [filtered])

  function openView(row: DepartmentTaskRow) {
    setViewing(row)
    setReviewComments(row.regional_review_comments ?? '')
    setReviewError(null)
  }

  async function submitReview(status: 'accepted' | 'needs-modification') {
    if (!viewing) return
    if (status === 'needs-modification' && !reviewComments.trim()) {
      setReviewError('Add a short note for the department when requesting changes.')
      return
    }
    setSavingReview(true)
    setReviewError(null)
    try {
      const updated = await updateDepartmentTaskReview(viewing.id, {
        regional_review_status: status,
        regional_review_comments: reviewComments.trim() || null,
      })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setViewing(null)
      setReviewComments('')
      setReviewError(null)
    } catch (e: unknown) {
      setReviewError(e instanceof Error ? e.message : 'Could not save review')
    } finally {
      setSavingReview(false)
    }
  }

  return (
    <PageSection
      title={title}
      subtitle="Distributed requests by department: track progress, read submissions, and accept or request changes."
    >
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'Pending submission', value: workflowCounts.in_process },
            { label: 'Pending regional review', value: workflowCounts.responded },
            { label: 'Resubmission requested', value: workflowCounts.revision },
            { label: 'Accepted by region', value: workflowCounts.accepted },
          ]}
        />
      </div>

      <TableToolbar>
        <input
          type="search"
          placeholder="Search task ID, request ID, department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search department tasks"
        />
        <select value={requestFilter} onChange={(e) => setFilter('requestId', e.target.value)}>
          <option value="">All request IDs</option>
          {requestIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          compact
          onClick={() => {
            setSearch('')
            resetFilters()
          }}
        >
          Reset filters
        </Button>
      </TableToolbar>

      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>Task ID</th>
              <th>Request</th>
              <th>Department</th>
              <th>Workflow</th>
              <th>Assigned</th>
              <th>Submitted</th>
              <th className="table-actions">Task details</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => {
              const wf = workflowPresentation(t)
              return (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.req_id}</td>
                  <td>{t.department_name ?? t.department_id}</td>
                  <td>
                    <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
                  </td>
                  <td>{t.assigned_date}</td>
                  <td>{t.submission_date ?? '—'}</td>
                  <td className="table-actions">
                    <Button variant="primary" compact onClick={() => openView(t)}>
                      Open task
                    </Button>
                  </td>
                </tr>
              )
            })}
            {pageRows.length === 0 && <EmptyStateRow colSpan={7} message="No department tasks found." />}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />

      <DepartmentTaskResponseModal
        task={viewing}
        onClose={() => {
          setViewing(null)
          setReviewComments('')
          setReviewError(null)
        }}
        review={
          viewing && userMayReviewTask(user, viewing)
            ? {
                comments: reviewComments,
                onCommentsChange: setReviewComments,
                onAccept: () => void submitReview('accepted'),
                onRequestModification: () => void submitReview('needs-modification'),
                saving: savingReview,
                error: reviewError,
              }
            : undefined
        }
      />
    </PageSection>
  )
}
