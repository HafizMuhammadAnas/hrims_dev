import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../../api/lists'
import { Button } from '../../components/ui/Button'
import { EmptyStateRow } from '../../components/ui/EmptyStateRow'
import { RowActionsMenu } from '../../components/ui/RowActionsMenu'
import { PageSection } from '../../components/ui/PageSection'
import { PaginationBar } from '../../components/ui/PaginationBar'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { TableToolbar } from '../../components/ui/TableToolbar'
import { derivePaginatedRows, useClientTableState } from '../../hooks/useClientTableState'
import { formatAppDate } from '../../lib/dateFormat'
import {
  countDepartmentTasksByWorkflow,
  workflowPresentation,
} from '../../lib/departmentTaskWorkflow'
import {
  filterDepartmentTasks,
  WORKFLOW_BUCKET_FILTER_OPTIONS,
} from '../../lib/departmentTaskTableFilters'
import { LABEL_TOTAL_TASKS } from '../../lib/uiLabels'
type Props = {
  title: string
}

export function DepartmentMonitoringPage({ title }: Props) {
  const navigate = useNavigate()
  const federalIctScope = title.toLowerCase().includes('federal')
  const fromPath = federalIctScope ? '/federal-department-requests' : '/region-monitoring'
  const fromParam = encodeURIComponent(fromPath)
  const [rows, setRows] = useState<DepartmentTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table

  async function load() {
    const data = await fetchDepartmentTasks()
    setRows(data)
  }

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const requestIds = useMemo(() => Array.from(new Set(rows.map((r) => r.req_id))).sort(), [rows])
  const requestFilter = filters.requestId ?? ''
  const workflowFilter = filters.workflow ?? ''
  const filtered = useMemo(
    () =>
      filterDepartmentTasks(rows, {
        search,
        workflowFilter,
        reqIdFilter: requestFilter || undefined,
      }),
    [rows, requestFilter, search, workflowFilter],
  )
  const { pageRows } = useMemo(
    () => derivePaginatedRows(filtered, page, pageSize),
    [filtered, page, pageSize],
  )

  const workflowCounts = useMemo(() => countDepartmentTasksByWorkflow(filtered), [filtered])

  return (
    <PageSection title={title}>
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
          placeholder="Search task ID, request ID, department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search department tasks"
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
                  <td>{t.department_name ?? t.department_id}</td>
                  <td>
                    <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
                  </td>
                  <td>{formatAppDate(t.assigned_date)}</td>
                  <td>{formatAppDate(t.submission_date)}</td>
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
            {pageRows.length === 0 && <EmptyStateRow colSpan={7} message="No department tasks found." />}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
    </PageSection>
  )
}
