import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchHrRequests } from '../api/hrRequests'
import { fetchRegionalResponses, type RegionalResponseRow } from '../api/lists'
import { CompiledRecordsWorkflowNav, isFromCompiledRecordsPath } from '../components/CompiledRecordsWorkflowNav'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { LABEL_REGIONAL_RESPONSES } from '../lib/uiLabels'
import { PaginationBar } from '../components/ui/PaginationBar'
import { SortColumnHeader } from '../components/ui/SortColumnHeader'
import { StatsCards } from '../components/ui/StatsCards'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { TableExportButton } from '../components/ui/TableExportButton'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { formatAppDate } from '../lib/dateFormat'
import { compareLatestFirst, compareStringValues } from '../lib/tableRowSort'
import { regionalResponseReviewPresentation } from '../lib/regionalResponseReviewStatus'
import {
  AWAITING_SUBMISSION_REVIEW_FILTER,
  buildPendingRegionDisplayRows,
  buildProvincialSubmissionCoverage,
  countAllPendingProvinces,
  countProvincialSubmissionCoverage,
  provincialRegionsFromRequest,
  type PendingRegionDisplayRow,
} from '../lib/regionalSubmissionCoverage'
import { hrRequestViewPath, regionalResponseFederalReviewPath } from '../lib/workflowNavigation'
import {
  mapRegionalResponseDisplayExportRow,
  REGIONAL_RESPONSE_DISPLAY_EXPORT_COLUMNS,
} from '../lib/tableExportColumns'
import type { HrRequestRow } from '../types/hrRequest'

const REVIEW_STATUSES = ['pending', 'accepted', 'needs-modification', 'rejected'] as const

type RegionalResponseDisplayRow =
  | { kind: 'submission'; row: RegionalResponseRow }
  | PendingRegionDisplayRow

function submissionMatchesSearch(r: RegionalResponseRow, q: string): boolean {
  return (
    r.id.toLowerCase().includes(q) ||
    r.req_id.toLowerCase().includes(q) ||
    (r.region_name ?? '').toLowerCase().includes(q) ||
    r.title.toLowerCase().includes(q)
  )
}

type Props = {
  /** Render table only (inside Request management tabs). */
  embedded?: boolean
  fromPath?: string
}

export function RegionalResponsesPage({ embedded = false, fromPath: fromPathProp }: Props) {
  const navigate = useNavigate()
  const listFromPath = fromPathProp ?? (embedded ? '/requests/regional-responses' : '/responses')
  const [rows, setRows] = useState<RegionalResponseRow[]>([])
  const [requests, setRequests] = useState<HrRequestRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const table = useClientTableState<keyof RegionalResponseRow>({
    pageSize: 10,
    initialSortKey: 'submission_date',
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

  const [searchParams] = useSearchParams()
  const reqIdFromUrl = useMemo(() => searchParams.get('reqId')?.trim() ?? '', [searchParams])

  useEffect(() => {
    if (reqIdFromUrl) {
      setFilter('reqId', reqIdFromUrl)
    }
  }, [reqIdFromUrl, setFilter])

  useEffect(() => {
    void Promise.all([fetchRegionalResponses(), fetchHrRequests()])
      .then(([responseRows, requestRows]) => {
        setRows(responseRows)
        setRequests(requestRows)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  const requestsById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests])

  const reqIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of rows) ids.add(r.req_id)
    for (const req of requests) {
      if (provincialRegionsFromRequest(req.regions).length > 0) ids.add(req.id)
    }
    return [...ids].sort()
  }, [rows, requests])

  const statusFilter = filters.status ?? ''
  const reqIdFilter = filters.reqId ?? ''

  const fromWorkflow = searchParams.get('from') ?? ''
  const workflowReqId = (reqIdFromUrl || reqIdFilter).trim()
  const showCompiledWorkflowNav = isFromCompiledRecordsPath(fromWorkflow) && Boolean(workflowReqId)

  const coverageForFilter = useMemo(() => {
    if (!reqIdFilter) return []
    const req = requestsById.get(reqIdFilter)
    const submissionsForReq = rows.filter((r) => r.req_id === reqIdFilter)
    return buildProvincialSubmissionCoverage(req?.regions, submissionsForReq)
  }, [reqIdFilter, requestsById, rows])

  const coverageCounts = useMemo(
    () => countProvincialSubmissionCoverage(coverageForFilter),
    [coverageForFilter],
  )

  const awaitingSubmissionCount = useMemo(
    () => countAllPendingProvinces(requests, rows),
    [requests, rows],
  )

  const displayRows = useMemo((): RegionalResponseDisplayRow[] => {
    const q = search.trim().toLowerCase()
    const awaitingOnly = statusFilter === AWAITING_SUBMISSION_REVIEW_FILTER

    let submissions = [...rows]
    if (q) submissions = submissions.filter((r) => submissionMatchesSearch(r, q))
    if (reqIdFilter) submissions = submissions.filter((r) => r.req_id === reqIdFilter)
    if (statusFilter && !awaitingOnly) {
      submissions = submissions.filter((r) => r.review_status === statusFilter)
    }
    if (awaitingOnly) submissions = []

    let pending = buildPendingRegionDisplayRows(requests, rows, reqIdFilter)
    if (q) {
      pending = pending.filter(
        (p) =>
          p.regionName.toLowerCase().includes(q) ||
          p.reqId.toLowerCase().includes(q) ||
          p.requestTitle.toLowerCase().includes(q),
      )
    }
    if (statusFilter && !awaitingOnly) pending = []

    const result: RegionalResponseDisplayRow[] = [
      ...submissions.map((r) => ({ kind: 'submission' as const, row: r })),
      ...pending,
    ]

    const key = sortKey ?? 'submission_date'
    const valueOf = (row: RegionalResponseDisplayRow): string => {
      if (row.kind === 'submission') return String(row.row[key] ?? '')
      return ''
    }
    result.sort((a, b) => {
      const av = valueOf(a)
      const bv = valueOf(b)
      if (av !== bv) {
        if (!av) return sortDir === 'desc' ? 1 : -1
        if (!bv) return sortDir === 'desc' ? -1 : 1
        return compareStringValues(av, bv, sortDir)
      }

      const aReq = a.kind === 'submission' ? a.row.req_id : a.reqId
      const bReq = b.kind === 'submission' ? b.row.req_id : b.reqId
      if (aReq !== bReq) return compareLatestFirst(aReq, bReq)

      const aRegion = a.kind === 'submission' ? (a.row.region_name ?? '') : a.regionName
      const bRegion = b.kind === 'submission' ? (b.row.region_name ?? '') : b.regionName
      return aRegion.localeCompare(bRegion, undefined, { numeric: true, sensitivity: 'base' })
    })
    return result
  }, [rows, search, statusFilter, reqIdFilter, sortKey, sortDir, requests])

  const { pageRows } = useMemo(
    () => derivePaginatedRows(displayRows, page, pageSize),
    [displayRows, page, pageSize],
  )

  const exportRows = useMemo(
    () => displayRows.map((entry) => mapRegionalResponseDisplayExportRow(entry)),
    [displayRows],
  )

  const statusCounts = useMemo(
    () =>
      REVIEW_STATUSES.map((status) => ({
        label: regionalResponseReviewPresentation(status).label,
        count: rows.filter((r) => r.review_status === status).length,
      })),
    [rows],
  )

  function openView(row: RegionalResponseRow) {
    navigate(regionalResponseFederalReviewPath(row.id, listFromPath))
  }

  const body = (
    <>
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
          items={
            reqIdFilter && coverageForFilter.length > 0
              ? [
                  { label: 'Provinces Assigned', value: coverageCounts.assigned },
                  { label: 'Submitted', value: coverageCounts.submitted },
                  { label: 'Awaiting Submission', value: coverageCounts.pending },
                  { label: 'Accepted', value: coverageCounts.accepted },
                ]
              : [
                  { label: 'Total', value: rows.length },
                  { label: 'Awaiting Submission', value: awaitingSubmissionCount },
                  ...statusCounts.map((s) => ({ label: s.label, value: s.count })),
                ]
          }
        />
      </div>

      <TableToolbar className="review-responses-toolbar">
        <input
          type="search"
          placeholder="Search request, region, title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">All review statuses</option>
          {REVIEW_STATUSES.map((status) => {
            const { label } = regionalResponseReviewPresentation(status)
            return (
              <option key={status} value={status}>
                {label}
              </option>
            )
          })}
          <option value={AWAITING_SUBMISSION_REVIEW_FILTER}>
            {regionalResponseReviewPresentation(AWAITING_SUBMISSION_REVIEW_FILTER).label}
          </option>
        </select>
        <select value={reqIdFilter} onChange={(e) => setFilter('reqId', e.target.value)}>
          <option value="">All request IDs</option>
          {reqIds.map((id) => {
            const req = requestsById.get(id)
            const submissionsForReq = rows.filter((r) => r.req_id === id)
            const cov = buildProvincialSubmissionCoverage(req?.regions, submissionsForReq)
            const counts = countProvincialSubmissionCoverage(cov)
            const label =
              counts.assigned > 0
                ? `${id} (${counts.submitted}/${counts.assigned} submitted)`
                : `${id} (${submissionsForReq.length} regional)`
            return (
              <option key={id} value={id}>
                {label}
              </option>
            )
          })}
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
          fileBaseName="regional-responses"
          columns={REGIONAL_RESPONSE_DISPLAY_EXPORT_COLUMNS}
          rows={exportRows}
          worksheetName={LABEL_REGIONAL_RESPONSES}
        />
      </TableToolbar>
      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
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
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((entry) => {
              if (entry.kind === 'pending') {
                const pendingKey = `pending-${entry.reqId}-${entry.regionId}`
                return (
                  <tr key={pendingKey} className="data-table-row--muted">
                    <td>{entry.reqId}</td>
                    <td>{entry.regionName}</td>
                    <td>{entry.requestTitle}</td>
                    <td className="muted">Not yet</td>
                    <td>
                      <StatusBadge tone="in-progress">Awaiting submission</StatusBadge>
                    </td>
                    <td className="table-actions">
                      <RowActionsMenu
                        isOpen={openActionId === pendingKey}
                        onOpenChange={(open) => setOpenActionId(open ? pendingKey : null)}
                      >
                        <Button
                          variant="link"
                          onClick={() => {
                            navigate(hrRequestViewPath(entry.reqId, listFromPath))
                            setOpenActionId(null)
                          }}
                        >
                          View request
                        </Button>
                      </RowActionsMenu>
                    </td>
                  </tr>
                )
              }
              const r = entry.row
              const review = regionalResponseReviewPresentation(r.review_status)
              return (
                <tr key={r.id}>
                  <td>{r.req_id}</td>
                  <td>{r.region_name}</td>
                  <td>{r.title}</td>
                  <td>{formatAppDate(r.submission_date)}</td>
                  <td>
                    <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
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
              )
            })}
            {pageRows.length === 0 && (
              <EmptyStateRow colSpan={6} message="No responses match current filters." />
            )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={displayRows.length} onPageChange={setPage} />

    </>
  )

  if (embedded) {
    return body
  }

  return (
    <PageSection title={LABEL_REGIONAL_RESPONSES}>
      {body}
    </PageSection>
  )
}
