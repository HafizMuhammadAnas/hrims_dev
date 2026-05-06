import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteHrRequest, fetchHrRequest, fetchHrRequests } from '../../api/hrRequests'
import { fetchDepartmentTasks, fetchRegionalResponses, type DepartmentTaskRow, type RegionalResponseRow } from '../../api/lists'
import { fetchRegions } from '../../api/regions'
import { useAuth } from '../../auth/AuthContext'
import { canManageHrRequests, hrRequestLockedRegionId } from '../../auth/rbac'
import { HrRequestModal } from '../../components/HrRequestModal'
import { Button } from '../../components/ui/Button'
import { EmptyStateRow } from '../../components/ui/EmptyStateRow'
import { ModalActions, ModalHeader } from '../../components/ui/ModalChrome'
import { PageSection } from '../../components/ui/PageSection'
import { PaginationBar } from '../../components/ui/PaginationBar'
import { RowActionsMenu } from '../../components/ui/RowActionsMenu'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { TableToolbar } from '../../components/ui/TableToolbar'
import { derivePaginatedRows, useClientTableState } from '../../hooks/useClientTableState'
import type { HrRequestRow } from '../../types/hrRequest'

type Props = {
  title: string
  distributionPath: string
  monitoringPath: string
  historyPath: string
  enableRequestCrud?: boolean
}

type RowStatus = 'pending' | 'Distributed' | 'In Process' | 'Response Delivered'

export function ReceivedRequestsPage({
  title,
  distributionPath,
  monitoringPath,
  historyPath,
  enableRequestCrud = false,
}: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const canManage = canManageHrRequests(user)
  const lockedRegionId = hrRequestLockedRegionId(user)
  const [rows, setRows] = useState<HrRequestRow[]>([])
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [responses, setResponses] = useState<RegionalResponseRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'view' | 'edit'; id: string } | null>(null)
  const [detail, setDetail] = useState<HrRequestRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HrRequestRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table

  const load = useCallback(async () => {
    const [reqs, regRows, deptTasks, resp] = await Promise.all([
      fetchHrRequests(),
      enableRequestCrud ? fetchRegions() : Promise.resolve([]),
      fetchDepartmentTasks(),
      fetchRegionalResponses(),
    ])
    setRows(reqs)
    setRegions(regRows)
    setTasks(deptTasks)
    setResponses(resp)
  }, [enableRequestCrud])

  useEffect(() => {
    let cancelled = false
    void load()
      .then(() => {
        if (cancelled) return
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [load])

  useEffect(() => {
    if (!modal) {
      setDetail(null)
      setDetailLoading(false)
      setDetailError(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    setDetailError(null)
    void fetchHrRequest(modal.id)
      .then((row) => {
        if (!cancelled) setDetail(row)
      })
      .catch((e: unknown) => {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : 'Failed to load request')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [modal])

  const mapped = useMemo(() => {
    const scopedRows = enableRequestCrud
      ? rows.filter((r) => (r.departments?.length ?? 0) > 0)
      : rows
    return scopedRows.map((r) => {
      const reqTasks = tasks.filter((t) => t.req_id === r.id)
      const reqResp = responses.find((x) => x.req_id === r.id)
      let status: RowStatus = 'pending'
      if (reqResp) {
        status = 'Response Delivered'
      } else if (reqTasks.length > 0) {
        status = reqTasks.some((t) => t.status === 'submitted') ? 'In Process' : 'Distributed'
      }
      return { ...r, _status: status }
    })
  }, [rows, tasks, responses])

  const statusCounts = useMemo(
    () => [
      { label: 'pending', count: mapped.filter((x) => x._status === 'pending').length },
      { label: 'Distributed', count: mapped.filter((x) => x._status === 'Distributed').length },
      { label: 'In process', count: mapped.filter((x) => x._status === 'In Process').length },
      { label: 'Delivered', count: mapped.filter((x) => x._status === 'Response Delivered').length },
    ],
    [mapped],
  )

  function actionPath(status: RowStatus): string {
    if (status === 'pending') return distributionPath
    if (status === 'Response Delivered') return historyPath
    return monitoringPath
  }

  /** Regional flow: pending rows open distribution with ?req= so the request is pre-selected. */
  function workflowNavigateUrl(status: RowStatus, requestId: string): string {
    const path = actionPath(status)
    if (status === 'pending' && distributionPath !== monitoringPath) {
      return `${path}?req=${encodeURIComponent(requestId)}`
    }
    return path
  }

  function actionLabel(status: RowStatus): string {
    if (status === 'Response Delivered') return 'Compiled and submitted'
    if (status === 'pending' && distributionPath !== monitoringPath) return 'Distribute request'
    return 'View progress'
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setDeleting(true)
    try {
      await deleteHrRequest(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const statusFilter = filters.status ?? ''
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return mapped.filter((r) => {
      if (statusFilter && r._status !== statusFilter) return false
      if (!q) return true
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.conv.toLowerCase().includes(q) ||
        r.date.toLowerCase().includes(q)
      )
    })
  }, [mapped, search, statusFilter])
  const { pageRows } = useMemo(
    () => derivePaginatedRows(filteredRows, page, pageSize),
    [filteredRows, page, pageSize],
  )

  return (
    <PageSection
      title={title}
      subtitle="Master list of requests with workflow-state intelligence and direct action routing."
    >
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards items={statusCounts.map((s) => ({ label: s.label, value: s.count }))} />
      </div>
      <TableToolbar className="active-requests-toolbar">
        <input
          type="search"
          placeholder="Search ID, title, convention, date..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search active requests"
        />
        <select value={statusFilter} onChange={(e) => setFilter('status', e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="pending">pending</option>
          <option value="Distributed">Distributed</option>
          <option value="In Process">In Process</option>
          <option value="Response Delivered">Response Delivered</option>
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
              <th>Request ID</th>
              <th>Title</th>
              <th>Convention</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.conv}</td>
                <td>{r.date}</td>
                <td>
                  <StatusBadge
                    tone={
                      r._status === 'Response Delivered'
                        ? 'success'
                        : r._status === 'In Process'
                          ? 'warning'
                          : r._status === 'Distributed'
                            ? 'pending'
                            : 'default'
                    }
                  >
                    {r._status}
                  </StatusBadge>
                </td>
                <td className="table-actions">
                  <RowActionsMenu
                    isOpen={openActionId === r.id}
                    onOpenChange={(open) => setOpenActionId(open ? r.id : null)}
                  >
                    {enableRequestCrud && (
                      <Button
                        variant="link"
                        onClick={() => {
                          setModal({ mode: 'view', id: r.id })
                          setOpenActionId(null)
                        }}
                      >
                        View
                      </Button>
                    )}
                    {enableRequestCrud && canManage && (
                      <Button
                        variant="link"
                        onClick={() => {
                          setModal({ mode: 'edit', id: r.id })
                          setOpenActionId(null)
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    {enableRequestCrud && canManage && (
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
                    )}
                    <Button
                      variant="link"
                      onClick={() => {
                        navigate(workflowNavigateUrl(r._status, r.id))
                        setOpenActionId(null)
                      }}
                    >
                      {actionLabel(r._status)}
                    </Button>
                  </RowActionsMenu>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && <EmptyStateRow colSpan={6} message="No requests found in current scope." />}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={filteredRows.length} onPageChange={setPage} />
      {user?.region && <p className="muted" style={{ marginTop: 10 }}>Scope: {user.region.name}</p>}

      {modal && (
        <HrRequestModal
          mode={modal.mode}
          detail={detail}
          detailLoading={detailLoading}
          detailError={detailError}
          regions={regions}
          canManage={canManage}
          lockedRegionId={lockedRegionId}
          onClose={() => setModal(null)}
          onSaved={() => void load()}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card modal-card-narrow" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Delete request" onClose={() => setDeleteTarget(null)} />
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
    </PageSection>
  )
}
