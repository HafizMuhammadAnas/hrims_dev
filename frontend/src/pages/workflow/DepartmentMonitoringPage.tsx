import { useEffect, useMemo, useState } from 'react'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../../api/lists'
import { Button } from '../../components/ui/Button'
import { EmptyStateRow } from '../../components/ui/EmptyStateRow'
import { PageSection } from '../../components/ui/PageSection'
import { PaginationBar } from '../../components/ui/PaginationBar'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { TableToolbar } from '../../components/ui/TableToolbar'
import { derivePaginatedRows, useClientTableState } from '../../hooks/useClientTableState'

type Props = {
  title: string
}

export function DepartmentMonitoringPage({ title }: Props) {
  const [rows, setRows] = useState<DepartmentTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table

  useEffect(() => {
    void fetchDepartmentTasks()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
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
  const submitted = filtered.filter((r) => r.status === 'submitted').length
  const inProgress = filtered.filter((r) => r.status === 'in-progress' || r.status === 'assigned').length

  return (
    <PageSection
      title={title}
      subtitle="Track department progress by request, completion, and submission dates."
    >
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'Tasks in scope', value: filtered.length },
            { label: 'Submitted', value: submitted },
            { label: 'In progress', value: inProgress },
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
              <th>Status</th>
              <th>Assigned</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.req_id}</td>
                <td>{t.department_name ?? t.department_id}</td>
                <td>
                  <StatusBadge tone={t.status === 'submitted' ? 'success' : 'pending'}>
                    {t.status}
                  </StatusBadge>
                </td>
                <td>{t.assigned_date}</td>
                <td>{t.submission_date ?? '—'}</td>
              </tr>
            ))}
            {pageRows.length === 0 && <EmptyStateRow colSpan={6} message="No department tasks found." />}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
    </PageSection>
  )
}
