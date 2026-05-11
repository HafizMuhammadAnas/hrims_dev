import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteHrRequest,
  fetchHrRequest,
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
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { HR_REQUEST_STATUS_LABELS } from '../data/hrRequestFormLookups'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import type { HrRequestRow } from '../types/hrRequest'

export function HrRequestsPage() {
  const { user } = useAuth()
  const canManage = canManageHrRequests(user)
  const lockedRegionId = hrRequestLockedRegionId(user)

  const [rows, setRows] = useState<HrRequestRow[]>([])
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table

  const [modal, setModal] = useState<{
    mode: 'create' | 'edit' | 'view'
    id: string | null
  } | null>(null)
  const [detail, setDetail] = useState<HrRequestRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HrRequestRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openActionId, setOpenActionId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [reqRows, regRows] = await Promise.all([fetchHrRequests(), fetchRegions()])
    setRows(reqRows)
    setRegions(regRows)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void reload()
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  useEffect(() => {
    if (!modal || modal.mode === 'create') {
      setDetail(null)
      setDetailLoading(false)
      setDetailError(null)
      return
    }
    if (!modal.id) return
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    setDetailError(null)
    void fetchHrRequest(modal.id)
      .then((row) => {
        if (!cancelled) setDetail(row)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDetailError(e instanceof Error ? e.message : 'Failed to load request')
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [modal])

  const refreshModalDetail = useCallback(async () => {
    if (modal?.id) {
      const row = await fetchHrRequest(modal.id)
      setDetail(row)
    }
  }, [modal?.id])

  const statusFilter = filters.status ?? ''

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
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

  return (
    <PageSection
      title="Request management"
      subtitle="Search and filter requests. Federal and regional administrators can create, edit, and delete; regional users only see and manage their own region."
    >
      {error && (
        <Alert variant="error" title="Could not load requests" onDismiss={() => setError(null)}>
          {error}
        </Alert>
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
        {canManage && (
          <Button variant="primary" compact onClick={() => setModal({ mode: 'create', id: null })}>
            New request
          </Button>
        )}
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
                {pageRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.title}</td>
                    <td>{r.conv}</td>
                    <td>
                      {r.regions?.length
                        ? r.regions.map((x) => x.name).join(', ')
                        : (r.region_name ?? '—')}
                    </td>
                    <td>{r.date}</td>
                    <td>{HR_REQUEST_STATUS_LABELS[r.status] ?? r.status}</td>
                    <td className="table-actions">
                      <RowActionsMenu
                        isOpen={openActionId === r.id}
                        onOpenChange={(open) => setOpenActionId(open ? r.id : null)}
                      >
                        <Button
                          variant="link"
                          onClick={() => {
                            setModal({ mode: 'view', id: r.id })
                            setOpenActionId(null)
                          }}
                        >
                          View
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              variant="link"
                              onClick={() => {
                                setModal({ mode: 'edit', id: r.id })
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
                        )}
                      </RowActionsMenu>
                    </td>
                  </tr>
                ))}
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
          onSaved={() => void reload()}
          onDetailRefresh={refreshModalDetail}
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
