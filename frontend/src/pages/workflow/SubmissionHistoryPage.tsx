import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LABEL_TOTAL_COMPILATIONS } from '../../lib/uiLabels'
import { fetchDepartmentTasks, fetchRegionalResponses, type DepartmentTaskRow, type RegionalResponseRow } from '../../api/lists'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { EmptyStateRow } from '../../components/ui/EmptyStateRow'
import { RowActionsMenu } from '../../components/ui/RowActionsMenu'
import { PageSection } from '../../components/ui/PageSection'
import { PaginationBar } from '../../components/ui/PaginationBar'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { TableToolbar } from '../../components/ui/TableToolbar'
import { TableExportButton } from '../../components/ui/TableExportButton'
import { derivePaginatedRows, useClientTableState } from '../../hooks/useClientTableState'
import { REGIONAL_RESPONSE_EXPORT_COLUMNS } from '../../lib/tableExportColumns'
import { formatAppDate } from '../../lib/dateFormat'
import { sortRowsLatestFirst } from '../../lib/tableRowSort'
import {
  countDepartmentTasksByWorkflow,
  hasDepartmentResponse,
  workflowPresentation,
} from '../../lib/departmentTaskWorkflow'
import {
  filterDepartmentTasks,
  WORKFLOW_BUCKET_FILTER_OPTIONS,
} from '../../lib/departmentTaskTableFilters'
import { isIctRegionalResponseRow } from '../../lib/ictRegion'
import { regionalResponseReviewPresentation } from '../../lib/regionalResponseReviewStatus'
import { isDepartmentAdmin, isFederalAdmin, isRegionalAdmin, isViewer } from '../../lib/roles'
import { regionalCompilationViewPath } from '../../lib/workflowNavigation'

const REVIEW_STATUSES = ['pending', 'accepted', 'needs-modification', 'rejected'] as const

type Props = {
  title: string
}

export function SubmissionHistoryPage({ title }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const regional = isRegionalAdmin(user)
  const deptHistoryUser =
    (isDepartmentAdmin(user) || isViewer(user)) && user?.department != null
  const [rows, setRows] = useState<RegionalResponseRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)

  const deptTable = useClientTableState({ pageSize: 10 })
  const respTable = useClientTableState({ pageSize: 10 })

  const reload = useCallback(async () => {
    const taskRows = await fetchDepartmentTasks()
    setTasks(taskRows)
    if (deptHistoryUser) {
      setRows([])
      return
    }
    let respRows = await fetchRegionalResponses()
    if (isFederalAdmin(user)) {
      respRows = respRows.filter((r) => isIctRegionalResponseRow(r))
    }
    setRows(respRows.sort((a, b) => b.submission_date.localeCompare(a.submission_date)))
  }, [deptHistoryUser, user])

  useEffect(() => {
    void reload().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [reload])

  const submittedDeptTasks = useMemo(() => {
    return tasks
      .filter((t) => hasDepartmentResponse(t))
      .sort((a, b) => (b.submission_date ?? '').localeCompare(a.submission_date ?? ''))
  }, [tasks])

  const fromHistory = encodeURIComponent('/department-history')
  const historyFrom = location.pathname

  const deptWorkflowFilter = deptTable.filters.workflow ?? ''
  const filteredDeptTasks = useMemo(
    () =>
      filterDepartmentTasks(submittedDeptTasks, {
        search: deptTable.search,
        workflowFilter: deptWorkflowFilter,
      }),
    [submittedDeptTasks, deptTable.search, deptWorkflowFilter],
  )

  const deptPage = useMemo(
    () => derivePaginatedRows(filteredDeptTasks, deptTable.page, deptTable.pageSize),
    [filteredDeptTasks, deptTable.page, deptTable.pageSize],
  )

  const deptWorkflowCounts = useMemo(
    () => countDepartmentTasksByWorkflow(filteredDeptTasks),
    [filteredDeptTasks],
  )

  const reviewStatusFilter = respTable.filters.status ?? ''
  const filteredResponses = useMemo(() => {
    const q = respTable.search.trim().toLowerCase()
    const matched = rows.filter((r) => {
      if (reviewStatusFilter && r.review_status !== reviewStatusFilter) return false
      if (!q) return true
      return (
        r.id.toLowerCase().includes(q) ||
        r.req_id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.region_name ?? '').toLowerCase().includes(q)
      )
    })
    return sortRowsLatestFirst(matched, (r) => r.submission_date || r.id)
  }, [rows, respTable.search, reviewStatusFilter])

  const respPage = useMemo(
    () => derivePaginatedRows(filteredResponses, respTable.page, respTable.pageSize),
    [filteredResponses, respTable.page, respTable.pageSize],
  )

  const reviewStats = useMemo(
    () =>
      REVIEW_STATUSES.map((status) => ({
        label: regionalResponseReviewPresentation(status).label,
        count: rows.filter((r) => r.review_status === status).length,
      })),
    [rows],
  )

  return (
    <PageSection title={title}>
      {error && <p className="login-error">{error}</p>}

      {deptHistoryUser && (
        <>
          <div style={{ marginTop: 16 }}>
            <StatsCards
              items={[
                { label: 'Submitted', value: filteredDeptTasks.length },
                { label: 'Pending', value: deptWorkflowCounts.in_process },
                { label: 'Under Review', value: deptWorkflowCounts.responded },
                { label: 'Revision', value: deptWorkflowCounts.revision },
                { label: 'Accepted', value: deptWorkflowCounts.accepted },
              ]}
            />
          </div>

          <TableToolbar>
            <input
              type="search"
              placeholder="Search task ID, request…"
              value={deptTable.search}
              onChange={(e) => deptTable.setSearch(e.target.value)}
              aria-label="Search submissions"
            />
            <select
              value={deptWorkflowFilter}
              onChange={(e) => deptTable.setFilter('workflow', e.target.value)}
              aria-label="Filter by status"
            >
              {WORKFLOW_BUCKET_FILTER_OPTIONS.map((opt) => (
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
                deptTable.setSearch('')
                deptTable.resetFilters()
              }}
            >
              Reset filters
            </Button>
          </TableToolbar>

          <TableCard>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Request</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th className="table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deptPage.pageRows.map((t) => {
                  const wf = workflowPresentation(t)
                  return (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{t.req_id}</td>
                      <td>{formatAppDate(t.submission_date)}</td>
                      <td>
                        <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
                      </td>
                      <td className="table-actions">
                        <RowActionsMenu
                          isOpen={openActionId === `task-${t.id}`}
                          onOpenChange={(open) => setOpenActionId(open ? `task-${t.id}` : null)}
                        >
                          <Button
                            variant="link"
                            onClick={() => {
                              navigate(
                                `/requests/${encodeURIComponent(t.req_id)}?task=${encodeURIComponent(t.id)}&from=${fromHistory}`,
                              )
                              setOpenActionId(null)
                            }}
                          >
                            View response
                          </Button>
                        </RowActionsMenu>
                      </td>
                    </tr>
                  )
                })}
                {deptPage.pageRows.length === 0 && (
                  <EmptyStateRow
                    colSpan={5}
                    message={
                      deptTable.search.trim() || deptWorkflowFilter
                        ? 'No submissions match your filters.'
                        : 'No submitted tasks yet.'
                    }
                  />
                )}
              </tbody>
            </table>
          </TableCard>
          <PaginationBar
            page={deptTable.page}
            pageSize={deptTable.pageSize}
            totalItems={filteredDeptTasks.length}
            onPageChange={deptTable.setPage}
          />
        </>
      )}

      {!deptHistoryUser && (
        <>
          <div style={{ marginTop: 16 }}>
            <StatsCards
              items={[
                { label: LABEL_TOTAL_COMPILATIONS, value: rows.length },
                ...reviewStats.map((s) => ({ label: s.label, value: s.count })),
              ]}
            />
          </div>

          <TableToolbar>
            <input
              type="search"
              placeholder="Search response ID, request, title…"
              value={respTable.search}
              onChange={(e) => respTable.setSearch(e.target.value)}
              aria-label="Search compilations"
            />
            <select
              value={reviewStatusFilter}
              onChange={(e) => respTable.setFilter('status', e.target.value)}
              aria-label="Filter by review status"
            >
              <option value="">All statuses</option>
              {REVIEW_STATUSES.map((status) => {
                const { label } = regionalResponseReviewPresentation(status)
                return (
                  <option key={status} value={status}>
                    {label}
                  </option>
                )
              })}
            </select>
            <Button
              variant="secondary"
              compact
              type="button"
              onClick={() => {
                respTable.setSearch('')
                respTable.resetFilters()
              }}
            >
              Reset filters
            </Button>
            <TableExportButton
              fileBaseName="response-history"
              columns={REGIONAL_RESPONSE_EXPORT_COLUMNS}
              rows={filteredResponses}
              worksheetName="Responses"
            />
          </TableToolbar>

          <TableCard>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Response ID</th>
                  <th>Request</th>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {respPage.pageRows.map((r) => {
                  const review = regionalResponseReviewPresentation(r.review_status)
                  return (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.req_id}</td>
                      <td>{r.title}</td>
                      <td>{formatAppDate(r.submission_date)}</td>
                      <td>
                        <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
                      </td>
                      <td className="table-actions">
                        <RowActionsMenu
                          isOpen={openActionId === `resp-${r.id}`}
                          onOpenChange={(open) => setOpenActionId(open ? `resp-${r.id}` : null)}
                        >
                          <Button
                            variant="link"
                            onClick={() => {
                              navigate(regionalCompilationViewPath(r.id, historyFrom))
                              setOpenActionId(null)
                            }}
                          >
                            View compilation
                          </Button>
                          {regional && r.review_status === 'needs-modification' ? (
                            <Button
                              variant="link"
                              onClick={() => {
                                navigate(regionalCompilationViewPath(r.id, historyFrom, { edit: true }))
                                setOpenActionId(null)
                              }}
                            >
                              Edit compilation
                            </Button>
                          ) : null}
                        </RowActionsMenu>
                      </td>
                    </tr>
                  )
                })}
                {respPage.pageRows.length === 0 && (
                  <EmptyStateRow
                    colSpan={6}
                    message={
                      respTable.search.trim() || reviewStatusFilter
                        ? 'No compilations match your filters.'
                        : 'No history found.'
                    }
                  />
                )}
              </tbody>
            </table>
          </TableCard>
          <PaginationBar
            page={respTable.page}
            pageSize={respTable.pageSize}
            totalItems={filteredResponses.length}
            onPageChange={respTable.setPage}
          />
        </>
      )}
    </PageSection>
  )
}
