import { useEffect, useMemo, useState } from 'react'
import { fetchViolationEntries, type ViolationRow } from '../api/lists'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { Button } from '../components/ui/Button'
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { StatsCards } from '../components/ui/StatsCards'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { formatAppDate } from '../lib/dateFormat'
import { sortRowsLatestFirst } from '../lib/tableRowSort'
import {
  VIOLATION_STATUS_FILTER_OPTIONS,
  violationStatusPresentation,
} from '../lib/violationEntryPresentation'

export function ViolationEntriesPage() {
  const [rows, setRows] = useState<ViolationRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table
  const statusFilter = filters.status ?? ''

  useEffect(() => {
    void fetchViolationEntries()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matched = rows.filter((v) => {
      if (statusFilter && v.monitoring_status !== statusFilter) return false
      if (!q) return true
      return (
        v.entry_number.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        (v.region_name ?? '').toLowerCase().includes(q) ||
        v.monitoring_status.toLowerCase().includes(q)
      )
    })
    return sortRowsLatestFirst(matched, (v) => v.event_date || v.id)
  }, [rows, search, statusFilter])

  const { pageRows } = useMemo(
    () => derivePaginatedRows(filtered, page, pageSize),
    [filtered, page, pageSize],
  )

  const statusStats = useMemo(() => {
    const open = rows.filter((v) => {
      const s = v.monitoring_status.toLowerCase()
      return s === 'in-progress' || s === 'in_progress' || s === 'open' || s === 'pending'
    }).length
    const resolved = rows.filter((v) => v.monitoring_status.toLowerCase() === 'resolved').length
    return [
      { label: 'Total entries', value: filtered.length },
      { label: 'Open', value: open },
      { label: 'Resolved', value: resolved },
    ]
  }, [rows, filtered.length])

  return (
    <PageSection title="Violation Entries">
      {error && <p className="login-error">{error}</p>}

      <div style={{ marginTop: 16 }}>
        <StatsCards items={statusStats} />
      </div>

      <TableToolbar>
        <input
          type="search"
          placeholder="Search entry #, title, region…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search violations"
        />
        <select
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
          aria-label="Filter by status"
        >
          {VIOLATION_STATUS_FILTER_OPTIONS.map((opt) => (
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
              <th>Entry #</th>
              <th>Title</th>
              <th>Region</th>
              <th>Event date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((v) => {
              const status = violationStatusPresentation(v.monitoring_status)
              return (
                <tr key={v.id}>
                  <td>{v.entry_number}</td>
                  <td>{v.title}</td>
                  <td>{v.region_name}</td>
                  <td>{formatAppDate(v.event_date)}</td>
                  <td>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </td>
                </tr>
              )
            })}
            {pageRows.length === 0 && (
              <EmptyStateRow
                colSpan={5}
                message={
                  search.trim() || statusFilter
                    ? 'No violation entries match your filters.'
                    : 'No violation entries available.'
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
