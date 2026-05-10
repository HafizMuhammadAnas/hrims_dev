import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchCompiledRecords, fetchDepartmentTasks, type CompiledRecordRow, type DepartmentTaskRow } from '../api/lists'
import { formatDepartmentResponseAsPlaintext } from '../lib/departmentTaskResponseFormat'
import { hasDepartmentResponse } from '../lib/departmentTaskWorkflow'
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
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'

type CompiledSortKey = 'id' | 'req_id' | 'title' | 'status' | 'compilation_date'

function compiledStatusTone(status: string): 'pending' | 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'submitted') return 'success'
  if (status === 'draft') return 'pending'
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
  const [rows, setRows] = useState<CompiledRecordRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<CompiledRecordRow | null>(null)
  const [detailDeptTasks, setDetailDeptTasks] = useState<DepartmentTaskRow[]>([])
  const [detailDeptLoading, setDetailDeptLoading] = useState(false)
  const [detailDeptError, setDetailDeptError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!detail?.req_id) {
      setDetailDeptTasks([])
      setDetailDeptError(null)
      setDetailDeptLoading(false)
      return
    }
    const reqId = detail.req_id
    const regionNames = detail.region_names ?? []
    let cancelled = false
    setDetailDeptLoading(true)
    setDetailDeptError(null)
    void fetchDepartmentTasks()
      .then((all) => {
        if (cancelled) return
        const nameSet = new Set(regionNames)
        const matched = all.filter(
          (t) => t.req_id === reqId && nameSet.has(t.region_name ?? '') && hasDepartmentResponse(t),
        )
        matched.sort((a, b) => {
          const reg = (a.region_name ?? '').localeCompare(b.region_name ?? '')
          if (reg !== 0) return reg
          const da = (a.department_name ?? a.department_id).toLowerCase()
          const db = (b.department_name ?? b.department_id).toLowerCase()
          return da.localeCompare(db)
        })
        setDetailDeptTasks(matched)
      })
      .catch((e: unknown) => {
        if (!cancelled) setDetailDeptError(e instanceof Error ? e.message : 'Failed to load department tasks')
      })
      .finally(() => {
        if (!cancelled) setDetailDeptLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detail?.id, detail?.req_id])

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
    <PageSection
      title="Compilation records"
      subtitle={
        <>
          National compilation snapshots saved from the{' '}
          <Link to="/compilation">Compilation center</Link>. Open a row for the full summary and quick links to the HR
          request and <Link to="/responses">Regional responses</Link>.
        </>
      }
    >
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
                <td>{r.compilation_date ?? '—'}</td>
                <td className="table-actions">
                  <Button variant="secondary" compact type="button" onClick={() => setDetail(r)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <EmptyStateRow colSpan={7} message="No compilation records match the current filters." />
            )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />

      {detail && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div
            className="modal-card modal-card-wide regional-response-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head dept-task-response-modal__head">
              <div>
                <h3>Compilation record</h3>
                <p className="dept-task-response-modal__head-meta muted small">
                  Record <strong>{detail.id}</strong>
                  {detail.req_id ? (
                    <>
                      {' '}
                      · Request <strong>{detail.req_id}</strong>
                    </>
                  ) : null}
                  <br />
                  <StatusBadge tone={compiledStatusTone(detail.status)}>
                    {formatCompiledStatusLabel(detail.status)}
                  </StatusBadge>
                </p>
              </div>
              <button type="button" className="modal-close" onClick={() => setDetail(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="modal-form regional-response-detail-modal__form">
              <p className="muted small regional-response-detail-modal__intro" style={{ marginTop: 0 }}>
                This is the saved national record. Provincial inputs are reviewed per region on{' '}
                <strong>Regional responses</strong> before they feed compilation.
              </p>

              <section className="hr-request-view-template__card regional-response-detail-modal__section">
                <h2 className="hr-request-view-template__section-title" style={{ fontSize: 14 }}>
                  Record details
                </h2>
                <div className="regional-response-detail-modal__grid">
                  <div>
                    <div className="hr-request-view-template__field-label">Record ID</div>
                    <p className="regional-response-detail-modal__value">{detail.id}</p>
                  </div>
                  <div>
                    <div className="hr-request-view-template__field-label">HR request</div>
                    <p className="regional-response-detail-modal__value">{detail.req_id ?? '—'}</p>
                  </div>
                  <div className="regional-response-detail-modal__grid-full">
                    <div className="hr-request-view-template__field-label">Title</div>
                    <p className="regional-response-detail-modal__value">{detail.title || '—'}</p>
                  </div>
                  <div>
                    <div className="hr-request-view-template__field-label">Status</div>
                    <p className="regional-response-detail-modal__value" style={{ marginBottom: 0 }}>
                      <StatusBadge tone={compiledStatusTone(detail.status)}>
                        {formatCompiledStatusLabel(detail.status)}
                      </StatusBadge>
                    </p>
                  </div>
                  <div>
                    <div className="hr-request-view-template__field-label">Compilation date</div>
                    <p className="regional-response-detail-modal__value">{detail.compilation_date ?? '—'}</p>
                  </div>
                  {detail.submission_date ? (
                    <div>
                      <div className="hr-request-view-template__field-label">Submission date</div>
                      <p className="regional-response-detail-modal__value">{detail.submission_date}</p>
                    </div>
                  ) : null}
                  {detail.submitted_to ? (
                    <div className="regional-response-detail-modal__grid-full">
                      <div className="hr-request-view-template__field-label">Submitted to</div>
                      <p className="regional-response-detail-modal__value">{detail.submitted_to}</p>
                    </div>
                  ) : null}
                  {detail.attachment ? (
                    <div className="regional-response-detail-modal__grid-full">
                      <div className="hr-request-view-template__field-label">Attachment</div>
                      <p className="regional-response-detail-modal__value">{detail.attachment}</p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="hr-request-view-template__card regional-response-detail-modal__section">
                <h2 className="hr-request-view-template__section-title" style={{ fontSize: 14 }}>
                  Department responses by region
                </h2>
                <p className="muted small" style={{ margin: '0 0 12px' }}>
                  Each province lists <strong>department</strong> submissions only. The regional admin’s consolidated
                  compilation is not shown here.
                </p>
                {detailDeptLoading ? <p className="muted">Loading department responses…</p> : null}
                {detailDeptError ? <p className="login-error">{detailDeptError}</p> : null}
                {!detailDeptLoading && !detailDeptError ? (
                  (detail.region_names ?? []).length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      —
                    </p>
                  ) : (
                    (detail.region_names ?? []).map((regionName) => {
                      const forRegion = detailDeptTasks.filter((t) => (t.region_name ?? '') === regionName)
                      return (
                        <div key={regionName} className="compiled-record-region-block">
                          <div className="hr-request-view-template__field-label compiled-record-region-block__title">
                            {regionName}
                          </div>
                          <div className="hr-request-view-template__field-label compiled-record-region-block__responses-label">
                            Responses
                          </div>
                          {forRegion.length === 0 ? (
                            <p className="muted" style={{ margin: '4px 0 0' }}>
                              No department submissions on file for this region.
                            </p>
                          ) : (
                            <ul className="compiled-record-regional-response-list">
                              {forRegion.map((t) => (
                                <li key={t.id}>
                                  <div className="compiled-record-dept-bullet">
                                    <div className="compiled-record-dept-bullet__name">
                                      {t.department_name?.trim() || t.department_id}
                                    </div>
                                    <div className="compiled-record-regional-response-list__text">
                                      {formatDepartmentResponseAsPlaintext(t.response_data, t.attachment_url)}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })
                  )
                ) : null}
              </section>

              <section className="hr-request-view-template__card regional-response-detail-modal__section">
                <h2 className="hr-request-view-template__section-title" style={{ fontSize: 14 }}>
                  Federal administrator summary (ministry)
                </h2>
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  Only this field is saved as the national submission summary. It is written by the federal administrator and
                  is not assembled from regional compilations.
                </p>
                <textarea
                  className="compiled-record-federal-summary-field"
                  readOnly
                  rows={8}
                  value={detail.summary?.trim() ? detail.summary : ''}
                  placeholder="No federal summary was saved for this record."
                />
              </section>

              <ModalActions>
                <Button variant="secondary" compact type="button" onClick={() => setDetail(null)}>
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
