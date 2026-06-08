import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchCompiledRecords, type CompiledRecordRow } from '../api/lists'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { SortColumnHeader } from '../components/ui/SortColumnHeader'
import { StatsCards } from '../components/ui/StatsCards'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { compiledRecordViewPath } from '../lib/workflowNavigation'
import { formatAppDate } from '../lib/dateFormat'
import type { StatusBadgeTone } from '../lib/statusBadgeTone'

type CompiledSortKey = 'id' | 'req_id' | 'title' | 'status' | 'compilation_date'

function compiledStatusTone(status: string): StatusBadgeTone {
  if (status === 'submitted') return 'success'
  if (status === 'draft') return 'warning'
  return 'default'
}

function formatCompiledStatusLabel(status: string): string {
  if (status === 'submitted') return 'Submitted'
  if (status === 'draft') return 'Draft'
  const s = status.replace(/-/g, ' ')
  if (!s) return status
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function CompiledRecordsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [rows, setRows] = useState<CompiledRecordRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)

  const table = useClientTableState<CompiledSortKey>({
    pageSize: 10,
    initialSortKey: 'compilation_date',
    initialSortDir: 'desc',
  })

  const {
    pageSize,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilter,
    resetFilters,
    sortKey,
    sortDir,
    toggleSort,
  } = table

  useEffect(() => {
    void fetchCompiledRecords()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  const statusFilter = filters.status ?? ''

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    let data = [...rows]
    if (q) {
      data = data.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          (r.req_id ?? '').toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          (r.region_names ?? []).some((n) => n.toLowerCase().includes(q)),
      )
    }
    if (statusFilter) data = data.filter((r) => r.status === statusFilter)

    const key = sortKey ?? 'compilation_date'
    data.sort((a, b) => {
      let av: string
      let bv: string
      if (key === 'req_id') {
        av = a.req_id ?? ''
        bv = b.req_id ?? ''
      } else {
        av = String(a[key] ?? '')
        bv = String(b[key] ?? '')
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [rows, search, statusFilter, sortKey, sortDir])

  const { pageRows } = useMemo(
    () => derivePaginatedRows(processed, page, pageSize),
    [processed, page, pageSize],
  )

  const statsItems = useMemo(
    () => [
      { label: 'Total records', value: rows.length },
      { label: 'Submitted', value: rows.filter((r) => r.status === 'submitted').length },
      { label: 'Draft', value: rows.filter((r) => r.status === 'draft').length },
    ],
    [rows],
  )

  const fromPath = encodeURIComponent(location.pathname)

  return (
    <PageSection title="Compiled records">
      {error && (
        <Alert variant="error" title="Something went wrong" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div style={{ marginTop: 16 }}>
        <StatsCards items={statsItems} />
      </div>

      <TableToolbar className="compiled-records-toolbar">
        <input
          type="search"
          placeholder="Search ID, request, title, regions, status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
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
              <SortColumnHeader
                label="Record ID"
                active={sortKey === 'id'}
                direction={sortDir}
                onSort={() => toggleSort('id')}
              />
              <SortColumnHeader
                label="HR request"
                active={sortKey === 'req_id'}
                direction={sortDir}
                onSort={() => toggleSort('req_id')}
              />
              <SortColumnHeader
                label="Title"
                active={sortKey === 'title'}
                direction={sortDir}
                onSort={() => toggleSort('title')}
              />
              <th>Regions</th>
              <SortColumnHeader
                label="Status"
                active={sortKey === 'status'}
                direction={sortDir}
                onSort={() => toggleSort('status')}
              />
              <SortColumnHeader
                label="Compilation date"
                active={sortKey === 'compilation_date'}
                direction={sortDir}
                onSort={() => toggleSort('compilation_date')}
              />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>
                  {r.req_id ? (
                    <Link to={`/requests/${encodeURIComponent(r.req_id)}?from=${fromPath}`}>{r.req_id}</Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{r.title}</td>
                <td>{r.region_names?.length ? r.region_names.join(', ') : '—'}</td>
                <td>
                  <StatusBadge tone={compiledStatusTone(r.status)}>{formatCompiledStatusLabel(r.status)}</StatusBadge>
                </td>
                <td>{formatAppDate(r.compilation_date)}</td>
                <td className="table-actions">
                  <RowActionsMenu
                    isOpen={openActionId === r.id}
                    onOpenChange={(open) => setOpenActionId(open ? r.id : null)}
                  >
                    <Button
                      variant="link"
                      type="button"
                      onClick={() => {
                        navigate(compiledRecordViewPath(r.id, location.pathname))
                        setOpenActionId(null)
                      }}
                    >
                      View
                    </Button>
                  </RowActionsMenu>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <EmptyStateRow colSpan={7} message="No compiled records match the current filters." />
            )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />

    </PageSection>
  )
}
