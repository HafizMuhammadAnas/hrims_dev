import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { fetchDepartmentTasks, fetchRegionalResponses, type DepartmentTaskRow, type RegionalResponseRow } from '../api/lists'
import { updateRegionalReview } from '../api/workflows'
import { useAuth } from '../auth/AuthContext'
import { CompiledRecordsWorkflowNav, isFromCompiledRecordsPath } from '../components/CompiledRecordsWorkflowNav'
import { DepartmentSubmissionsForRequest } from '../components/DepartmentSubmissionsForRequest'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { ModalActions } from '../components/ui/ModalChrome'
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

function formatReviewStatusLabel(status: string): string {
  if (status === 'needs-modification') return 'Needs modification'
  const s = status.replace(/-/g, ' ')
  if (!s) return status
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function RegionalResponsesPage() {
  const { user } = useAuth()
  const location = useLocation()
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

  const fromWorkflow = searchParams.get('from') ?? ''
  const workflowReqId = (reqIdFromUrl || reqIdFilter).trim()
  const showCompiledWorkflowNav = isFromCompiledRecordsPath(fromWorkflow) && Boolean(workflowReqId)

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
    setError(null)
    setViewing(row)
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

  async function acceptResponse() {
    await persistReview('accepted', reviewComments)
  }

  async function requestModification() {
    if (!reviewComments.trim()) {
      setError('Add feedback for the region when requesting modification.')
      return
    }
    await persistReview('needs-modification', reviewComments)
  }

  async function rejectResponse() {
    if (!reviewComments.trim()) {
      setError('Add a short note to the region when rejecting.')
      return
    }
    await persistReview('rejected', reviewComments)
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
      {showCompiledWorkflowNav ? (
        <CompiledRecordsWorkflowNav reqId={workflowReqId} activeTab="responses" />
      ) : null}
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
            className="modal-card modal-card-wide regional-responses-full-modal regional-response-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head dept-task-response-modal__head">
              <div>
                <h3>Regional responses</h3>
                <p className="dept-task-response-modal__head-meta muted small">
                  Request <strong>{viewing.req_id}</strong> ·{' '}
                  <strong>{allResponsesForRequest.length}</strong> provincial compilation
                  {allResponsesForRequest.length === 1 ? '' : 's'}
                  <br />
                  <span className="muted">The highlighted card is the one you opened. Switch region below if needed.</span>
                </p>
              </div>
              <button type="button" className="modal-close" onClick={() => setViewing(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="modal-form regional-response-detail-modal__form">
              <p className="muted small regional-response-detail-modal__intro" style={{ marginTop: 0 }}>
                Each card is one province&apos;s consolidated submission and underlying department inputs. Use the actions at
                the bottom of the highlighted card to record federal review — no separate status menu.
              </p>
              <p style={{ margin: '0 0 12px' }}>
                <Link
                  className="btn btn-secondary btn-compact"
                  to={`/requests/${encodeURIComponent(viewing.req_id)}?from=${encodeURIComponent(location.pathname)}`}
                >
                  Open full HR request
                </Link>
              </p>

              <div className="dept-task-response-modal__panel regional-response-detail-modal__panel regional-responses-stacked">
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
                            {formatReviewStatusLabel(resp.review_status)}
                          </StatusBadge>
                          {isFocus ? (
                            <span className="regional-request-region-card__pill">Review target</span>
                          ) : null}
                        </div>
                      </div>

                      <section
                        className="hr-request-view-template__card regional-response-detail-modal__section"
                        style={{ marginBottom: 14 }}
                      >
                        <h2 className="hr-request-view-template__section-title" style={{ fontSize: 14 }}>
                          Overview
                        </h2>
                        <div className="regional-response-detail-modal__grid">
                          <div>
                            <div className="hr-request-view-template__field-label">Response ID</div>
                            <p className="regional-response-detail-modal__value">{resp.id}</p>
                          </div>
                          <div>
                            <div className="hr-request-view-template__field-label">Submitted</div>
                            <p className="regional-response-detail-modal__value">{resp.submission_date}</p>
                          </div>
                          <div className="regional-response-detail-modal__grid-full">
                            <div className="hr-request-view-template__field-label">Compilation title</div>
                            <p className="regional-response-detail-modal__value">{resp.title || '—'}</p>
                          </div>
                          <div>
                            <div className="hr-request-view-template__field-label">Federal review</div>
                            <p className="regional-response-detail-modal__value" style={{ marginBottom: 0 }}>
                              <StatusBadge tone={federalReviewTone(resp.review_status)}>
                                {formatReviewStatusLabel(resp.review_status)}
                              </StatusBadge>
                            </p>
                          </div>
                        </div>
                      </section>

                      {resp.comments?.trim() ? (
                        <section
                          className="hr-request-view-template__card regional-response-detail-modal__section"
                          style={{ marginBottom: 14 }}
                          aria-labelledby={`fed-prev-${resp.id}`}
                        >
                          <h2 id={`fed-prev-${resp.id}`} className="hr-request-view-template__section-title" style={{ fontSize: 14 }}>
                            Federal feedback on record
                          </h2>
                          <div className="regional-response-detail-modal__feedback">{resp.comments.trim()}</div>
                        </section>
                      ) : null}

                      <section
                        className="hr-request-view-template__card regional-response-detail-modal__section"
                        style={{ marginBottom: 14 }}
                      >
                        <h2 className="hr-request-view-template__section-title" style={{ fontSize: 14 }}>
                          Department submissions
                        </h2>
                        <DepartmentSubmissionsForRequest
                          tasksForDetail={tasksForViewing}
                          reqId={viewing.req_id}
                          filterByRegionName={resp.region_name}
                          omitHeading
                        />
                      </section>

                      <section className="hr-request-view-template__card regional-response-detail-modal__section">
                        <h2 className="hr-request-view-template__section-title" style={{ fontSize: 14 }}>
                          Compiled regional response
                        </h2>
                        <div className="hr-request-view-template__prose-box">
                          {resp.content?.trim() ? (
                            <p className="hr-request-view-template__prose" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                              {resp.content.trim()}
                            </p>
                          ) : (
                            <p className="muted" style={{ margin: 0 }}>
                              —
                            </p>
                          )}
                        </div>
                      </section>

                      {!isFocus && canReviewFederal && (
                        <div className="regional-request-region-card__switch">
                          <Button variant="secondary" compact type="button" onClick={() => openView(resp)}>
                            Review this region
                          </Button>
                        </div>
                      )}

                      {isFocus && canReviewFederal && (
                        <div className="regional-request-region-card__federal">
                          <h4 className="hr-request-view-template__section-title" style={{ fontSize: 14, marginBottom: 12 }}>
                            Federal review — {resp.region_name ?? 'this region'}
                          </h4>
                          {resp.review_status === 'accepted' ? (
                            <p className="muted small" style={{ margin: 0 }}>
                              This response is <strong>accepted</strong> and is eligible for national compilation. Further
                              federal actions are not available unless the record is changed elsewhere in the workflow.
                            </p>
                          ) : (
                            <>
                              <div className="form-row">
                                <label htmlFor="regional-fed-review-comments">Feedback to the region</label>
                                <textarea
                                  id="regional-fed-review-comments"
                                  rows={5}
                                  value={reviewComments}
                                  onChange={(e) => setReviewComments(e.target.value)}
                                  placeholder="Use this box for acceptance notes, modification instructions, or rejection reasons. Request modification and rejection require text here."
                                  style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                              </div>
                              <div className="regional-response-federal-actions">
                                <Button
                                  variant="primary"
                                  compact
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void acceptResponse()}
                                >
                                  {saving ? 'Saving…' : 'Accept response'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  compact
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void requestModification()}
                                >
                                  {saving ? 'Saving…' : 'Request modification'}
                                </Button>
                                <Button
                                  variant="danger"
                                  compact
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void rejectResponse()}
                                >
                                  {saving ? 'Saving…' : 'Reject'}
                                </Button>
                              </div>
                              <p className="muted small" style={{ margin: '12px 0 0' }}>
                                <strong>Accept</strong> approves this province for national compilation. <strong>Request
                                modification</strong> and <strong>Reject</strong> require feedback in the box above.
                              </p>
                            </>
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
              </ModalActions>
            </div>
          </div>
        </div>
      )}
    </PageSection>
  )
}
