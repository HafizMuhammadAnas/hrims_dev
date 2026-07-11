import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  deleteHrRequest,
  fetchHrRequests,
} from '../api/hrRequests'
import { fetchRegions } from '../api/regions'
import { useAuth } from '../auth/AuthContext'
import { canManageHrRequests, hrRequestLockedRegionId } from '../auth/rbac'
import { HrRequestModal } from '../components/HrRequestModal'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { ModalActions, ModalHeader } from '../components/ui/ModalChrome'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { TableCard } from '../components/ui/TableCard'
import { StatsCards } from '../components/ui/StatsCards'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableToolbar } from '../components/ui/TableToolbar'
import { TableExportButton } from '../components/ui/TableExportButton'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { HR_REQUEST_EXPORT_COLUMNS } from '../lib/tableExportColumns'
import { formatAppDate, formatAppDateTime } from '../lib/dateFormat'
import { sortRowsLatestFirst } from '../lib/tableRowSort'
import { hrRequestListStats, hrRequestStatusPresentation } from '../lib/hrRequestListMetrics'
import { hrRequestAllowsEditDelete, type HrRequestRow } from '../types/hrRequest'
import {
  CLARIFICATION_STATUS_LABELS,
  clarificationStatusPresentation,
  fetchClarifications,
  fetchPendingFederalClarificationCount,
  type ClarificationStatus,
  type HrRequestClarificationRow,
} from '../api/clarifications'
import { ClarificationFederalViewPanel } from '../components/ClarificationFederalViewPanel'
import { RegionalResponsesPage } from './RegionalResponsesPage'
import { hrRequestEditPath, hrRequestViewPath } from '../lib/workflowNavigation'
import {
  LABEL_DELETE_REQUEST,
  LABEL_NEW_REQUEST,
  LABEL_REGIONAL_RESPONSES,
  LABEL_REQUEST_MANAGEMENT,
  LABEL_REQUESTS_LIST,
} from '../lib/uiLabels'

type RequestsTab = 'list' | 'new' | 'clarifications' | 'regional-responses'

const REQUESTS_TABS: { view: RequestsTab; to: string; label: string; end?: boolean }[] = [
  { view: 'list', to: '/requests', label: LABEL_REQUESTS_LIST, end: true },
  { view: 'new', to: '/requests/new', label: LABEL_NEW_REQUEST },
  { view: 'clarifications', to: '/requests/clarifications', label: 'Clarifications' },
  { view: 'regional-responses', to: '/requests/regional-responses', label: LABEL_REGIONAL_RESPONSES },
]

function resolveRequestsTab(pathname: string): RequestsTab {
  if (pathname.endsWith('/new')) return 'new'
  if (pathname.endsWith('/clarifications')) return 'clarifications'
  if (pathname.endsWith('/regional-responses')) return 'regional-responses'
  return 'list'
}

export function FederalRequestManagementPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = resolveRequestsTab(location.pathname)
  const { user } = useAuth()
  const canManage = canManageHrRequests(user)
  const lockedRegionId = hrRequestLockedRegionId(user)

  const [rows, setRows] = useState<HrRequestRow[]>([])
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HrRequestRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [pendingClarificationCount, setPendingClarificationCount] = useState(0)
  const [clarifications, setClarifications] = useState<HrRequestClarificationRow[]>([])
  const [viewingClarificationId, setViewingClarificationId] = useState<number | null>(null)
  const [clarOpenActionId, setClarOpenActionId] = useState<number | null>(null)
  const clarTable = useClientTableState({ pageSize: 10 })

  const reload = useCallback(async () => {
    const [reqRows, regRows] = await Promise.all([fetchHrRequests(), fetchRegions()])
    setRows(reqRows)
    setRegions(regRows)
  }, [])

  const refreshClarifications = useCallback(async () => {
    const [rows, count] = await Promise.all([
      fetchClarifications(),
      fetchPendingFederalClarificationCount(),
    ])
    setClarifications(rows)
    setPendingClarificationCount(count)
  }, [])

  useEffect(() => {
    if (view !== 'clarifications') return
    const raw = searchParams.get('id')
    if (!raw) return
    const id = Number(raw)
    if (!Number.isFinite(id) || id <= 0) return
    setViewingClarificationId(id)
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next, { replace: true })
  }, [view, searchParams, setSearchParams])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void Promise.all([reload(), refreshClarifications()])
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reload, refreshClarifications])

  useEffect(() => {
    setShowCreateForm(view === 'new' && canManage)
  }, [view, canManage])

  const statusFilter = filters.status ?? ''

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false
      if (!q) return true
      const regionBlob =
        (r.regions?.length ? r.regions.map((x) => x.name).join(' ') : r.region_name) ?? ''
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.conv.toLowerCase().includes(q) ||
        regionBlob.toLowerCase().includes(q)
      )
    })
    return sortRowsLatestFirst(filtered, (r) => r.id)
  }, [rows, search, statusFilter])

  const { pageRows } = useMemo(
    () => derivePaginatedRows(filteredRows, table.page, table.pageSize),
    [filteredRows, table.page, table.pageSize],
  )

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setDeleting(true)
    try {
      await deleteHrRequest(deleteTarget.id)
      setDeleteTarget(null)
      await reload()
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const filteredClarifications = useMemo(() => {
    const q = clarTable.search.trim().toLowerCase()
    let data = [...clarifications]
    const statusFilter = clarTable.filters.status ?? ''
    if (statusFilter) data = data.filter((c) => c.status === statusFilter)
    if (q) {
      data = data.filter(
        (c) =>
          String(c.id).includes(q) ||
          c.hr_request_id.toLowerCase().includes(q) ||
          (c.region_name ?? '').toLowerCase().includes(q) ||
          c.region_message.toLowerCase().includes(q),
      )
    }
    return sortRowsLatestFirst(data, (c) => c.updated_at ?? c.created_at ?? c.id)
  }, [clarifications, clarTable.search, clarTable.filters.status])

  const { pageRows: clarPageRows } = useMemo(
    () => derivePaginatedRows(filteredClarifications, clarTable.page, clarTable.pageSize),
    [filteredClarifications, clarTable.page, clarTable.pageSize],
  )

  return (
    <div className="page-shell">
      {error && (
        <Alert variant="error" title="Could not load requests" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label={`${LABEL_REQUEST_MANAGEMENT} sections`}>
        {REQUESTS_TABS.map((tab) => (
          <NavLink
            key={tab.view}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `compiled-record-modal-tab issues-admin-tab${isActive ? ' compiled-record-modal-tab--active' : ''}`
            }
          >
            <span className="issues-admin-tab__label">
              {tab.label}
              {tab.view === 'clarifications' && pendingClarificationCount > 0 ? (
                <span className="issues-admin-tab-badge">
                  {pendingClarificationCount > 99 ? '99+' : pendingClarificationCount}
                </span>
              ) : null}
            </span>
          </NavLink>
        ))}
      </nav>

      {view === 'list' && (
        <>
      {!loading && !error && (
        <div style={{ marginTop: 16 }}>
          <StatsCards items={hrRequestListStats(rows)} />
        </div>
      )}

      <TableToolbar className="hr-requests-toolbar">
        <input
          type="search"
          placeholder="Search ID, title, convention, region…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search requests"
        />
        <select
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
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
        <TableExportButton
          fileBaseName="hr-requests"
          columns={HR_REQUEST_EXPORT_COLUMNS}
          rows={filteredRows}
          worksheetName="HR requests"
        />
      </TableToolbar>

      {loading && <p>Loading…</p>}
      {!loading && !error && (
        <div style={{ marginTop: 2 }}>
          <TableCard>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Convention</th>
                  <th>Region(s)</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const status = hrRequestStatusPresentation(r.status)
                  return (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.title}</td>
                    <td>{r.conv}</td>
                    <td>
                      {r.regions?.length
                        ? r.regions.map((x) => x.name).join(', ')
                        : (r.region_name ?? '—')}
                    </td>
                    <td>{formatAppDate(r.date)}</td>
                    <td>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </td>
                    <td className="table-actions">
                      <RowActionsMenu
                        isOpen={openActionId === r.id}
                        onOpenChange={(open) => setOpenActionId(open ? r.id : null)}
                      >
                        <Button
                          variant="link"
                          onClick={() => {
                            navigate(hrRequestViewPath(r.id, '/requests'))
                            setOpenActionId(null)
                          }}
                        >
                          View
                        </Button>
                        {canManage && hrRequestAllowsEditDelete(r.status) ? (
                          <>
                            <Button
                              variant="link"
                              onClick={() => {
                                navigate(hrRequestEditPath(r.id, '/requests'))
                                setOpenActionId(null)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              dangerLink
                              onClick={() => {
                                setDeleteError(null)
                                setDeleteTarget(r)
                                setOpenActionId(null)
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        ) : null}
                      </RowActionsMenu>
                    </td>
                  </tr>
                  )
                })}
                {pageRows.length === 0 && (
                  <EmptyStateRow colSpan={7} message="No requests match your filters." />
                )}
              </tbody>
            </table>
          </TableCard>
        </div>
      )}
      {!loading && !error && (
        <PaginationBar page={page} pageSize={pageSize} totalItems={filteredRows.length} onPageChange={setPage} />
      )}
        </>
      )}

      {view === 'new' && showCreateForm && (
        <HrRequestModal
          mode="create"
          detail={null}
          detailLoading={false}
          detailError={null}
          regions={regions}
          canManage={canManage}
          lockedRegionId={lockedRegionId}
          layout="page"
          onClose={() => navigate('/requests')}
          onSaved={() => {
            void reload()
            navigate('/requests')
          }}
        />
      )}

      {view === 'clarifications' && (
        <>
          {viewingClarificationId != null ? (
            <ClarificationFederalViewPanel
              clarificationId={viewingClarificationId}
              onClose={() => setViewingClarificationId(null)}
              onResponded={() => {
                setViewingClarificationId(null)
                void refreshClarifications()
              }}
            />
          ) : (
            <>
              <div style={{ marginTop: 16 }}>
                <StatsCards
                  items={[
                    { label: 'Total', value: clarifications.length },
                    {
                      label: 'Federal',
                      value: clarifications.filter((c) => c.status === 'pending_federal').length,
                    },
                    {
                      label: 'Region',
                      value: clarifications.filter((c) => c.status === 'pending_region').length,
                    },
                    { label: 'Closed', value: clarifications.filter((c) => c.status === 'closed').length },
                  ]}
                />
              </div>

              <TableToolbar className="issues-list-toolbar">
                <input
                  type="search"
                  placeholder="Search request ID, region, message…"
                  value={clarTable.search}
                  onChange={(e) => clarTable.setSearch(e.target.value)}
                  aria-label="Search clarifications"
                />
                <select
                  value={clarTable.filters.status ?? ''}
                  onChange={(e) => clarTable.setFilter('status', e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  {(Object.keys(CLARIFICATION_STATUS_LABELS) as ClarificationStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {CLARIFICATION_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  compact
                  onClick={() => {
                    clarTable.setSearch('')
                    clarTable.resetFilters()
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
                      <th>Region</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th className="table-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clarPageRows.length === 0 ? (
                      <EmptyStateRow
                        colSpan={6}
                        message={
                          clarTable.search.trim() || clarTable.filters.status
                            ? 'No clarifications match your filters.'
                            : 'No clarification requests yet.'
                        }
                      />
                    ) : (
                      clarPageRows.map((c) => {
                        const clarStatus = clarificationStatusPresentation(c.status)
                        return (
                        <tr key={c.id}>
                          <td>{c.id}</td>
                          <td>{c.hr_request_id}</td>
                          <td>{c.region_name ?? c.region_id}</td>
                          <td>
                            <StatusBadge tone={clarStatus.tone}>{clarStatus.label}</StatusBadge>
                          </td>
                          <td>
                            {c.region_submitted_at
                              ? formatAppDateTime(c.region_submitted_at)
                              : '—'}
                          </td>
                          <td className="table-actions">
                            <RowActionsMenu
                              isOpen={clarOpenActionId === c.id}
                              onOpenChange={(open) => setClarOpenActionId(open ? c.id : null)}
                            >
                              <Button
                                variant="link"
                                onClick={() => {
                                  setViewingClarificationId(c.id)
                                  setClarOpenActionId(null)
                                }}
                              >
                                View
                              </Button>
                            </RowActionsMenu>
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </TableCard>
              <PaginationBar
                page={clarTable.page}
                pageSize={clarTable.pageSize}
                totalItems={filteredClarifications.length}
                onPageChange={clarTable.setPage}
              />
            </>
          )}
        </>
      )}

      {view === 'regional-responses' && (
        <RegionalResponsesPage embedded fromPath="/requests/regional-responses" />
      )}

      {deleteTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card modal-card-narrow" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={LABEL_DELETE_REQUEST} onClose={() => setDeleteTarget(null)} />
            <div className="pad-modal">
              <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
                Delete <strong>{deleteTarget.id}</strong> — {deleteTarget.title}? This cannot be undone.
              </p>
              {deleteError && <p className="login-error">{deleteError}</p>}
              <ModalActions>
                <Button variant="secondary" compact onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button variant="danger" compact onClick={() => void confirmDelete()} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </ModalActions>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
