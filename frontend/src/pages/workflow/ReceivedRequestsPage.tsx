import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LABEL_DELETE_REQUEST, LABEL_RECEIVED_REQUESTS } from '../../lib/uiLabels'
import {
  deleteHrRequest,
  fetchHrRequestFormConventions,
  fetchHrRequestFormUprCatalog,
  fetchHrRequests,
  type KnowledgeConventionRow,
} from '../../api/hrRequests'
import { fetchClarifications, type HrRequestClarificationRow } from '../../api/clarifications'
import { fetchDepartmentTasks, fetchRegionalResponses, type DepartmentTaskRow, type RegionalResponseRow } from '../../api/lists'
import { useAuth } from '../../auth/AuthContext'
import { canManageHrRequests } from '../../auth/rbac'
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
import { TableExportButton } from '../../components/ui/TableExportButton'
import { derivePaginatedRows, useClientTableState } from '../../hooks/useClientTableState'
import { RECEIVED_REQUEST_EXPORT_COLUMNS } from '../../lib/tableExportColumns'
import { formatAppDate } from '../../lib/dateFormat'
import { pickActivityTimestamp, sortRowsLatestFirst } from '../../lib/tableRowSort'
import {
  RECEIVED_REQUEST_STATUS_FILTER_OPTIONS,
  receivedRequestStatusPresentation,
  type ReceivedRequestWorkflowStatus,
} from '../../lib/receivedRequestWorkflow'
import { isRegionalAdmin } from '../../lib/roles'
import {
  buildConventionFilterOptions,
  buildCycleFilterOptions,
  conventionOrCycleLabel,
  rowMatchesConventionCycleFilters,
  type ConventionCycleKindFilter,
} from '../../lib/hrRequestConventionCycleFilter'
import type { HrRequestUprCycle } from '../../lib/hrRequestUprForm'
import { hrRequestEditPath } from '../../lib/workflowNavigation'
import { hrRequestAllowsEditDelete, type HrRequestRow } from '../../types/hrRequest'

type Props = {
  title: string
  distributionPath: string
  monitoringPath: string
  historyPath: string
  enableRequestCrud?: boolean
}

type RowStatus = ReceivedRequestWorkflowStatus

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
  const [rows, setRows] = useState<HrRequestRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [responses, setResponses] = useState<RegionalResponseRow[]>([])
  const [clarifications, setClarifications] = useState<HrRequestClarificationRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HrRequestRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [conventions, setConventions] = useState<KnowledgeConventionRow[]>([])
  const [uprCycles, setUprCycles] = useState<HrRequestUprCycle[]>([])
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, setFilters, resetFilters, page, setPage, pageSize } =
    table

  const load = useCallback(async () => {
    const [reqs, deptTasks, resp, clarRows] = await Promise.all([
      fetchHrRequests(),
      fetchDepartmentTasks(),
      fetchRegionalResponses(),
      isRegionalAdmin(user) ? fetchClarifications() : Promise.resolve([]),
    ])
    setRows(reqs)
    setTasks(deptTasks)
    setResponses(resp)
    setClarifications(clarRows)
  }, [enableRequestCrud, user])

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
    let cancelled = false
    void Promise.all([
      fetchHrRequestFormConventions().catch(() => [] as KnowledgeConventionRow[]),
      fetchHrRequestFormUprCatalog().catch(() => null),
    ]).then(([convRows, uprCatalog]) => {
      if (cancelled) return
      setConventions(convRows)
      setUprCycles(uprCatalog?.cycles ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const mapped = useMemo(() => {
    const scopedRows = enableRequestCrud
      ? rows.filter((r) => (r.departments?.length ?? 0) > 0)
      : rows
    const clarByRequest = new Map(
      clarifications.map((c) => [c.hr_request_id, c] as const),
    )
    return scopedRows.map((r) => {
      const reqTasks = tasks.filter((t) => t.req_id === r.id)
      const reqResp = responses.find((x) => x.req_id === r.id)
      const clar = clarByRequest.get(r.id)
      let status: RowStatus = 'pending'
      if (reqResp) {
        status = 'Response Delivered'
      } else if (reqTasks.length > 0) {
        status = reqTasks.some((t) => t.status === 'submitted') ? 'In Process' : 'Distributed'
      } else if (clar?.status === 'pending_federal') {
        status = 'Clarification pending'
      } else if (clar?.status === 'pending_region') {
        status = 'Clarification answered'
      }
      return { ...r, _status: status }
    })
  }, [rows, tasks, responses, clarifications])

  const regionalMode = isRegionalAdmin(user)

  const statusCounts = useMemo(
    () =>
      RECEIVED_REQUEST_STATUS_FILTER_OPTIONS.map((opt) => ({
        label: opt.label,
        count: mapped.filter((x) => x._status === opt.value).length,
      })),
    [mapped],
  )

  function actionPath(status: RowStatus): string {
    if (status === 'pending') return regionalMode ? monitoringPath : distributionPath
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

  /** Primary link in the row menu — must match the navigate target in the click handler. */
  function actionLabel(status: RowStatus): string {
    if (regionalMode) {
      if (status === 'Distributed' || status === 'In Process') return 'View / redistribute'
      return 'View HR request'
    }
    if (status === 'Response Delivered') return 'View response history'
    if (status === 'pending' && distributionPath !== monitoringPath) return 'Distribute to departments'
    if (status === 'pending') return 'Open department workspace'
    return 'View department tasks'
  }

  function regionalRequestViewUrl(requestId: string): string {
    return `/requests/${encodeURIComponent(requestId)}?from=${encodeURIComponent('/region-received')}`
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
  const conventionCycleKind = (filters.convention_cycle_kind ?? '') as ConventionCycleKindFilter
  const conventionCycleValue = filters.convention_cycle ?? ''

  const conventionFilterOptions = useMemo(
    () => buildConventionFilterOptions(conventions, mapped),
    [conventions, mapped],
  )
  const cycleFilterOptions = useMemo(
    () => buildCycleFilterOptions(uprCycles, mapped),
    [uprCycles, mapped],
  )
  const secondaryFilterOptions =
    conventionCycleKind === 'convention'
      ? conventionFilterOptions
      : conventionCycleKind === 'cycle'
        ? cycleFilterOptions
        : []

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = mapped.filter((r) => {
      if (statusFilter && r._status !== statusFilter) return false
      if (!rowMatchesConventionCycleFilters(r, conventionCycleKind, conventionCycleValue)) {
        return false
      }
      if (!q) return true
      const convCycle = conventionOrCycleLabel(r)
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        convCycle.toLowerCase().includes(q) ||
        r.date.toLowerCase().includes(q)
      )
    })
    return sortRowsLatestFirst(filtered, (r) =>
      pickActivityTimestamp(r.updated_at, r.created_at, r.date, r.id),
    )
  }, [mapped, search, statusFilter, conventionCycleKind, conventionCycleValue])
  const { pageRows } = useMemo(
    () => derivePaginatedRows(filteredRows, page, pageSize),
    [filteredRows, page, pageSize],
  )

  return (
    <PageSection
      title={title}
    >
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards items={statusCounts.map((s) => ({ label: s.label, value: s.count }))} />
      </div>
      <TableToolbar className="active-requests-toolbar">
        <input
          type="search"
          placeholder="Search ID, title, convention/UPR, date..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search active requests"
        />
        <select
          value={conventionCycleKind}
          onChange={(e) => {
            const next = e.target.value as ConventionCycleKindFilter
            setFilters((prev) => ({
              ...prev,
              convention_cycle_kind: next,
              convention_cycle: '',
            }))
          }}
          aria-label="Filter by convention or UPR"
        >
          <option value="">Convention / UPR</option>
          <option value="convention">Convention</option>
          <option value="cycle">UPR</option>
        </select>
        {conventionCycleKind ? (
          <select
            value={conventionCycleValue}
            onChange={(e) => setFilter('convention_cycle', e.target.value)}
            aria-label={
              conventionCycleKind === 'convention'
                ? 'Filter by convention name'
                : 'Filter by UPR'
            }
          >
            <option value="">
              {conventionCycleKind === 'convention' ? 'All conventions' : 'All UPRs'}
            </option>
            {secondaryFilterOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}
        <select value={statusFilter} onChange={(e) => setFilter('status', e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {RECEIVED_REQUEST_STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
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
        <TableExportButton
          fileBaseName="received-requests"
          columns={RECEIVED_REQUEST_EXPORT_COLUMNS}
          rows={filteredRows}
          worksheetName={LABEL_RECEIVED_REQUESTS}
        />
      </TableToolbar>
      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Title</th>
              <th>Convention/UPR</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const status = receivedRequestStatusPresentation(r._status)
              return (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{conventionOrCycleLabel(r)}</td>
                <td>{formatAppDate(r.date)}</td>
                <td>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </td>
                <td className="table-actions">
                  <RowActionsMenu
                    isOpen={openActionId === r.id}
                    onOpenChange={(open) => setOpenActionId(open ? r.id : null)}
                    triggerLabel="Actions"
                  >
                    {enableRequestCrud && (
                      <Button
                        variant="link"
                        onClick={() => {
                          navigate(regionalRequestViewUrl(r.id))
                          setOpenActionId(null)
                        }}
                      >
                        View
                      </Button>
                    )}
                    {enableRequestCrud && canManage && hrRequestAllowsEditDelete(r.status) ? (
                      <Button
                        variant="link"
                        onClick={() => {
                          navigate(hrRequestEditPath(r.id, '/region-received'))
                          setOpenActionId(null)
                        }}
                      >
                        Edit
                      </Button>
                    ) : null}
                    {enableRequestCrud && canManage && hrRequestAllowsEditDelete(r.status) ? (
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
                    ) : null}
                    <Button
                      variant="link"
                      onClick={() => {
                        if (regionalMode) {
                          navigate(regionalRequestViewUrl(r.id))
                          setOpenActionId(null)
                          return
                        }
                        navigate(workflowNavigateUrl(r._status, r.id))
                        setOpenActionId(null)
                      }}
                    >
                      {actionLabel(r._status)}
                    </Button>
                  </RowActionsMenu>
                </td>
              </tr>
            )})}
            {pageRows.length === 0 && <EmptyStateRow colSpan={6} message="No requests found in current scope." />}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={filteredRows.length} onPageChange={setPage} />
      {user?.region && <p className="muted" style={{ marginTop: 10 }}>Scope: {user.region.name}</p>}

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

    </PageSection>
  )
}
