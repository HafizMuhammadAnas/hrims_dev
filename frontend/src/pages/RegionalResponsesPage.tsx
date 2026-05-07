import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchDepartmentTasks, fetchRegionalResponses, type DepartmentTaskRow, type RegionalResponseRow } from '../api/lists'
import { updateRegionalReview } from '../api/workflows'
import { useAuth } from '../auth/AuthContext'
import { DepartmentSubmissionsForRequest } from '../components/DepartmentSubmissionsForRequest'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { ModalActions, ModalHeader } from '../components/ui/ModalChrome'
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { SortColumnHeader } from '../components/ui/SortColumnHeader'
import { StatsCards } from '../components/ui/StatsCards'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { useNotify } from '../context/NotificationsContext'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { isFederalAdmin, isSuperAdmin } from '../lib/roles'

function sortTasksByDept(a: DepartmentTaskRow, b: DepartmentTaskRow): number {
  const an = (a.department_name ?? a.department_id).toLowerCase()
  const bn = (b.department_name ?? b.department_id).toLowerCase()
  return an.localeCompare(bn)
}

const REVIEW_STATUSES = ['pending', 'accepted', 'needs-modification', 'rejected'] as const
type ReviewStatus = (typeof REVIEW_STATUSES)[number]

function federalReviewTone(
  status: string,
): 'pending' | 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'accepted') return 'success'
  if (status === 'needs-modification') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'pending'
}

export function RegionalResponsesPage() {
  const { user } = useAuth()
  const notify = useNotify()
  const federal = isFederalAdmin(user)
  const superUser = isSuperAdmin(user)
  const canReviewFederal = federal || superUser
  const [rows, setRows] = useState<RegionalResponseRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
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

  const [searchParams] = useSearchParams()
  const reqIdFromUrl = useMemo(() => searchParams.get('reqId')?.trim() ?? '', [searchParams])

  useEffect(() => {
    if (reqIdFromUrl) {
      setFilter('reqId', reqIdFromUrl)
    }
  }, [reqIdFromUrl, setFilter])

  useEffect(() => {
    void Promise.all([fetchRegionalResponses(), fetchDepartmentTasks()])
      .then(([respRows, taskRows]) => {
        setRows(respRows)
        setTasks(taskRows)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  const reqIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.req_id))).sort(),
    [rows],
  )

  const statusFilter = filters.status ?? ''
  const reqIdFilter = filters.reqId ?? ''

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    let data = [...rows]
    if (q) {
      data = data.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.req_id.toLowerCase().includes(q) ||
          (r.region_name ?? '').toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q),
      )
    }
    if (statusFilter) data = data.filter((r) => r.review_status === statusFilter)
    if (reqIdFilter) data = data.filter((r) => r.req_id === reqIdFilter)

    const key = sortKey ?? 'submission_date'
    data.sort((a, b) => {
      const av = String(a[key] ?? '')
      const bv = String(b[key] ?? '')
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [rows, search, statusFilter, reqIdFilter, sortKey, sortDir])

  const tasksForViewing = useMemo(() => {
    if (!viewing) return []
    return tasks.filter((t) => t.req_id === viewing.req_id).sort(sortTasksByDept)
  }, [tasks, viewing])

  const allResponsesForRequest = useMemo(() => {
    if (!viewing) return []
    return rows
      .filter((r) => r.req_id === viewing.req_id)
      .sort((a, b) => (a.region_name ?? '').localeCompare(b.region_name ?? '') || a.id.localeCompare(b.id))
  }, [rows, viewing])

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

  async function reloadResponses() {
    const list = await fetchRegionalResponses()
    setRows(list)
  }

  async function persistReview(status: ReviewStatus, comments: string) {
    if (!viewing) return
    const idSaved = viewing.id
    setSaving(true)
    setError(null)
    try {
      const saved = await updateRegionalReview(idSaved, status, comments)
      setRows((prev) => prev.map((r) => (r.id === saved.id ? { ...r, ...saved } : r)))
      await reloadResponses()
      setViewing(null)
      notify.success(status === 'accepted' ? 'Response accepted.' : 'Review saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  async function saveReview() {
    await persistReview(reviewStatus, reviewComments)
  }

  async function acceptResponse() {
    await persistReview('accepted', reviewComments)
  }

  function exportCsv() {
    if (!processed.length) return
    const headers = ['Response ID', 'Request ID', 'Region', 'Title', 'Submission Date', 'Review Status']
    const body = processed.map((r) =>
      [r.id, r.req_id, r.region_name ?? '', `"${r.title.replaceAll('"', '""')}"`, r.submission_date, r.review_status].join(','),
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

  return (
    <PageSection
      title="Regional responses"
      subtitle={
        <>
          Each province submits one consolidated response per HR request. Several regions can answer the same request—use the
          request filter to compare them. Accept responses when ready, then build the national record in{' '}
          <Link to="/compilation">Compilation center</Link>.
        </>
      }
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
        <select value={reqIdFilter} onChange={(e) => setFilter('reqId', e.target.value)}>
          <option value="">All request IDs</option>
          {reqIds.map((id) => (
            <option key={id} value={id}>
              {id} ({rows.filter((r) => r.req_id === id).length} regional)
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
                <td className="table-actions">
                  <Button variant="secondary" compact onClick={() => openView(r)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <EmptyStateRow colSpan={6} message="No responses match current filters." />
            )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />

      {viewing && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewing(null)}>
          <div
            className="modal-card modal-card-wide regional-responses-full-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader
              title={`HR request ${viewing.req_id}`}
              onClose={() => setViewing(null)}
            />
            <div className="modal-form">
              <p className="muted" style={{ marginTop: 0 }}>
                Consolidated regional compilations and underlying department submissions for this request.
                Federal review applies to one region at a time (highlighted below).
              </p>
              <p style={{ margin: '0 0 16px' }}>
                <Link
                  className="btn btn-secondary btn-compact"
                  to={`/requests/${encodeURIComponent(viewing.req_id)}?from=${encodeURIComponent('/responses')}`}
                >
                  Open full HR request record
                </Link>
              </p>

              <div className="regional-responses-stacked">
                {allResponsesForRequest.map((resp) => {
                  const isFocus = resp.id === viewing.id
                  return (
                    <section
                      key={resp.id}
                      className={`regional-request-region-card${isFocus ? ' regional-request-region-card--focus' : ''}`}
                      aria-labelledby={`region-card-${resp.id}`}
                    >
                      <div className="regional-request-region-card__top">
                        <h3 id={`region-card-${resp.id}`} className="regional-request-region-card__title">
                          {resp.region_name ?? 'Region'}
                        </h3>
                        <div className="regional-request-region-card__badges">
                          <StatusBadge tone={federalReviewTone(resp.review_status)}>
                            Federal: {resp.review_status.replace('-', ' ')}
                          </StatusBadge>
                          {isFocus ? (
                            <span className="regional-request-region-card__pill">Federal review target</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="form-grid regional-request-region-card__meta">
                        <div className="form-row">
                          <label>Response ID</label>
                          <input value={resp.id} readOnly disabled />
                        </div>
                        <div className="form-row">
                          <label>Title</label>
                          <input value={resp.title} readOnly disabled />
                        </div>
                        <div className="form-row">
                          <label>Submitted</label>
                          <input value={resp.submission_date} readOnly disabled />
                        </div>
                        {resp.comments ? (
                          <div className="form-row">
                            <label>Existing federal feedback (read-only)</label>
                            <textarea readOnly rows={2} value={resp.comments} />
                          </div>
                        ) : null}
                      </div>

                      <DepartmentSubmissionsForRequest
                        tasksForDetail={tasksForViewing}
                        reqId={viewing.req_id}
                        filterByRegionName={resp.region_name}
                      />

                      <div className="form-row" style={{ marginTop: 12 }}>
                        <label>Compiled regional response</label>
                        <textarea
                          readOnly
                          rows={10}
                          value={resp.content?.trim() ? resp.content : '—'}
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>

                      {!isFocus && canReviewFederal && (
                        <div className="regional-request-region-card__switch">
                          <Button variant="secondary" compact type="button" onClick={() => openView(resp)}>
                            Review this region
                          </Button>
                        </div>
                      )}

                      {isFocus && canReviewFederal && (
                        <div className="regional-request-region-card__federal">
                          <h4 className="regional-request-region-card__federal-title">Federal review (this region)</h4>
                          <div className="form-grid">
                            <div className="form-row">
                              <label>Review status</label>
                              <select
                                value={reviewStatus}
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
                              <label>Federal feedback</label>
                              <textarea
                                rows={4}
                                value={reviewComments}
                                onChange={(e) => setReviewComments(e.target.value)}
                                placeholder="Comments to the region (e.g. modification instructions)…"
                              />
                            </div>
                          </div>
                          {viewing.review_status !== 'accepted' && (
                            <div className="regional-response-accept-panel">
                              <Button
                                variant="primary"
                                compact
                                type="button"
                                disabled={saving}
                                onClick={() => void acceptResponse()}
                              >
                                {saving ? 'Saving…' : 'Accept response'}
                              </Button>
                              <p className="muted small" style={{ margin: 0 }}>
                                Accept records this regional compilation as approved for national compilation.
                              </p>
                            </div>
                          )}
                          {viewing.review_status === 'accepted' && (
                            <p className="muted small" style={{ marginTop: 12 }}>
                              Already <strong>accepted</strong>. Change the status above and use <strong>Save review</strong> if
                              needed.
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>

              <ModalActions>
                <Button variant="secondary" compact onClick={() => setViewing(null)}>
                  Close
                </Button>
                {canReviewFederal && (
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
