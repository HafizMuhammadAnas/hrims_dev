import { useEffect, useMemo, useState } from 'react'
import { fetchRegionalResponses, type RegionalResponseRow } from '../api/lists'
import { updateRegionalReview } from '../api/workflows'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { ModalActions, ModalHeader } from '../components/ui/ModalChrome'
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { SortColumnHeader } from '../components/ui/SortColumnHeader'
import { StatsCards } from '../components/ui/StatsCards'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { useNotify } from '../context/NotificationsContext'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { isFederalAdmin } from '../lib/roles'

const REVIEW_STATUSES = ['pending', 'accepted', 'needs-modification', 'rejected'] as const
type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export function RegionalResponsesPage() {
  const { user } = useAuth()
  const notify = useNotify()
  const federal = isFederalAdmin(user)
  const [rows, setRows] = useState<RegionalResponseRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const table = useClientTableState<keyof RegionalResponseRow>({
    pageSize: 10,
    initialSortKey: 'submission_date',
    initialSortDir: 'desc',
  })
  const [viewing, setViewing] = useState<RegionalResponseRow | null>(null)
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('pending')
  const [reviewComments, setReviewComments] = useState('')
  const [saving, setSaving] = useState(false)
  const [openActionId, setOpenActionId] = useState<string | null>(null)

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
    void fetchRegionalResponses()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  const federalIds = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.federal_id).filter((v): v is string => Boolean(v)))).sort(),
    [rows],
  )

  const statusFilter = filters.status ?? ''
  const federalIdFilter = filters.federalId ?? ''

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    let data = [...rows]
    if (q) {
      data = data.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.req_id.toLowerCase().includes(q) ||
          (r.federal_id ?? '').toLowerCase().includes(q) ||
          (r.region_name ?? '').toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q),
      )
    }
    if (statusFilter) data = data.filter((r) => r.review_status === statusFilter)
    if (federalIdFilter) data = data.filter((r) => r.federal_id === federalIdFilter)

    const key = sortKey ?? 'submission_date'
    data.sort((a, b) => {
      const av = String(a[key] ?? '')
      const bv = String(b[key] ?? '')
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [rows, search, statusFilter, federalIdFilter, sortKey, sortDir])

  const { pageRows } = useMemo(
    () => derivePaginatedRows(processed, page, pageSize),
    [processed, page, pageSize],
  )
  const statusCounts = useMemo(
    () =>
      REVIEW_STATUSES.map((status) => ({
        status,
        count: rows.filter((r) => r.review_status === status).length,
      })),
    [rows],
  )

  function openView(row: RegionalResponseRow) {
    setViewing(row)
    setReviewStatus(
      REVIEW_STATUSES.includes(row.review_status as ReviewStatus)
        ? (row.review_status as ReviewStatus)
        : 'pending',
    )
    setReviewComments(row.comments ?? '')
  }

  async function saveReview() {
    if (!viewing) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateRegionalReview(viewing.id, reviewStatus, reviewComments)
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setViewing(null)
      notify.success('Review saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  function exportCsv() {
    if (!processed.length) return
    const headers = ['Response ID', 'Request ID', 'Federal ID', 'Region', 'Title', 'Submission Date', 'Review Status']
    const body = processed.map((r) =>
      [r.id, r.req_id, r.federal_id ?? '', r.region_name ?? '', `"${r.title.replaceAll('"', '""')}"`, r.submission_date, r.review_status].join(','),
    )
    const csv = [headers.join(','), ...body].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `regional-responses-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function statusTone(status: string): 'pending' | 'success' | 'warning' | 'danger' {
    if (status === 'accepted') return 'success'
    if (status === 'rejected') return 'danger'
    if (status === 'needs-modification') return 'warning'
    return 'pending'
  }

  return (
    <PageSection
      title="Regional responses"
      subtitle="Review pipeline with filters, quality checks, and export-ready data."
    >
      {error && (
        <Alert variant="error" title="Action required" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={statusCounts.map((s) => ({
            label: s.status.replace('-', ' '),
            value: s.count,
          }))}
        />
      </div>

      <TableToolbar className="review-responses-toolbar">
        <input
          type="search"
          placeholder="Search IDs, region, title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">All review statuses</option>
          <option value="pending">pending</option>
          <option value="accepted">accepted</option>
          <option value="needs-modification">needs-modification</option>
          <option value="rejected">rejected</option>
        </select>
        <select
          value={federalIdFilter}
          onChange={(e) => setFilter('federalId', e.target.value)}
        >
          <option value="">All federal IDs</option>
          {federalIds.map((id) => (
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
        <Button variant="secondary" compact className="review-responses-toolbar__export" onClick={exportCsv}>
          Export CSV
        </Button>
      </TableToolbar>
      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <SortColumnHeader
                label="ID"
                active={sortKey === 'id'}
                direction={sortDir}
                onSort={() => toggleSort('id')}
              />
              <SortColumnHeader
                label="Request"
                active={sortKey === 'req_id'}
                direction={sortDir}
                onSort={() => toggleSort('req_id')}
              />
              <SortColumnHeader
                label="Region"
                active={sortKey === 'region_name'}
                direction={sortDir}
                onSort={() => toggleSort('region_name')}
              />
              <th>Title</th>
              <SortColumnHeader
                label="Submitted"
                active={sortKey === 'submission_date'}
                direction={sortDir}
                onSort={() => toggleSort('submission_date')}
              />
              <SortColumnHeader
                label="Review"
                active={sortKey === 'review_status'}
                direction={sortDir}
                onSort={() => toggleSort('review_status')}
              />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.req_id}</td>
                <td>{r.region_name}</td>
                <td>{r.title}</td>
                <td>{r.submission_date}</td>
                <td>
                  <StatusBadge tone={statusTone(r.review_status)}>
                    {r.review_status.replace('-', ' ')}
                  </StatusBadge>
                </td>
                <td className="table-actions">
                  <RowActionsMenu
                    isOpen={openActionId === r.id}
                    onOpenChange={(open) => setOpenActionId(open ? r.id : null)}
                  >
                    <Button
                      variant="link"
                      onClick={() => {
                        openView(r)
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
              <EmptyStateRow colSpan={7} message="No responses match current filters." />
            )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />

      {viewing && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewing(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Review response" onClose={() => setViewing(null)} />
            <div className="modal-form">
              <div className="form-grid">
                <div className="form-row">
                  <label>Response ID</label>
                  <input value={viewing.id} disabled />
                </div>
                <div className="form-row">
                  <label>Request ID</label>
                  <input value={viewing.req_id} disabled />
                </div>
                <div className="form-row">
                  <label>Title</label>
                  <input value={viewing.title} disabled />
                </div>
                <div className="form-row">
                  <label>Response content</label>
                  <textarea rows={7} value={viewing.content} disabled />
                </div>
                <div className="form-row">
                  <label>Review status</label>
                  <select
                    value={reviewStatus}
                    disabled={!federal}
                    onChange={(e) => setReviewStatus(e.target.value as ReviewStatus)}
                  >
                    {REVIEW_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Comments</label>
                  <textarea
                    rows={4}
                    value={reviewComments}
                    disabled={!federal}
                    onChange={(e) => setReviewComments(e.target.value)}
                  />
                </div>
              </div>
              <ModalActions>
                <Button variant="secondary" compact onClick={() => setViewing(null)}>
                  Close
                </Button>
                {federal && (
                  <Button variant="primary" compact disabled={saving} onClick={() => void saveReview()}>
                    {saving ? 'Saving...' : 'Save review'}
                  </Button>
                )}
              </ModalActions>
            </div>
          </div>
        </div>
      )}
    </PageSection>
  )
}
