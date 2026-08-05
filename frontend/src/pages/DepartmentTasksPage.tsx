import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../api/lists'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { LABEL_ASSIGNED_TASKS, LABEL_DEPARTMENT_TASKS, LABEL_TOTAL_TASKS } from '../lib/uiLabels'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { StatsCards } from '../components/ui/StatsCards'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { formatAppDate } from '../lib/dateFormat'
import {
  countDepartmentTasksByWorkflow,
  workflowPresentation,
} from '../lib/departmentTaskWorkflow'
import {
  filterDepartmentTasks,
  WORKFLOW_BUCKET_FILTER_OPTIONS,
} from '../lib/departmentTaskTableFilters'
import { isIctDepartmentPortalUser } from '../lib/ictRegion'

export function DepartmentTasksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const ictDeptPortal = isIctDepartmentPortalUser(user)
  const [rows, setRows] = useState<DepartmentTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table
  const workflowFilter = filters.workflow ?? ''

  function reload() {
    return fetchDepartmentTasks()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }

  useEffect(() => {
    void reload()
  }, [])

  const filtered = useMemo(
    () => filterDepartmentTasks(rows, { search, workflowFilter }),
    [rows, search, workflowFilter],
  )

  const { pageRows } = useMemo(
    () => derivePaginatedRows(filtered, page, pageSize),
    [filtered, page, pageSize],
  )

  const workflowCounts = useMemo(() => countDepartmentTasksByWorkflow(filtered), [filtered])

  const fromParam = encodeURIComponent('/department-tasks')

  return (
    <PageSection title={ictDeptPortal ? LABEL_ASSIGNED_TASKS : LABEL_DEPARTMENT_TASKS}>
      {error && <p className="login-error">{error}</p>}

      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: LABEL_TOTAL_TASKS, value: filtered.length },
            { label: 'Pending', value: workflowCounts.in_process },
            { label: 'Under Review', value: workflowCounts.responded },
            { label: 'Revision', value: workflowCounts.revision },
            { label: 'Accepted', value: workflowCounts.accepted },
          ]}
        />
      </div>

      <TableToolbar>
        <input
          type="search"
          placeholder="Search task ID, request, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tasks"
        />
        <select
          value={workflowFilter}
          onChange={(e) => setFilter('workflow', e.target.value)}
          aria-label="Filter by status"
        >
          {WORKFLOW_BUCKET_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          compact
          type="button"
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
              <th>ID</th>
              <th>Request</th>
              {!ictDeptPortal ? <th>Region</th> : null}
              <th>Department</th>
              <th>Status</th>
              <th>Assigned</th>
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => {
              const wf = workflowPresentation(t)
              return (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.req_id}</td>
                  {!ictDeptPortal ? <td>{t.region_name}</td> : null}
                  <td>{t.department_name}</td>
                  <td>
                    <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
                  </td>
                  <td>{formatAppDate(t.assigned_date)}</td>
                  <td className="table-actions">
                    <RowActionsMenu
                      isOpen={openActionId === t.id}
                      onOpenChange={(open) => setOpenActionId(open ? t.id : null)}
                    >
                      <Button
                        variant="link"
                        onClick={() => {
                          navigate(
                            `/requests/${encodeURIComponent(t.req_id)}?task=${encodeURIComponent(t.id)}&from=${fromParam}`,
                          )
                          setOpenActionId(null)
                        }}
                      >
                        View and Respond
                      </Button>
                    </RowActionsMenu>
                  </td>
                </tr>
              )
            })}
            {pageRows.length === 0 && (
              <EmptyStateRow
                colSpan={ictDeptPortal ? 6 : 7}
                message={
                  search.trim() || workflowFilter
                    ? 'No tasks match your filters.'
                    : ictDeptPortal
                      ? 'No assigned tasks yet.'
                      : 'No department tasks available.'
                }
              />
            )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
    </PageSection>
  )
}
