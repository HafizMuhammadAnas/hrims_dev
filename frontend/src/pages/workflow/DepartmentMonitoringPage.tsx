import { useEffect, useMemo, useState } from 'react'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../../api/lists'
import { updateDepartmentTaskReview } from '../../api/workflows'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { EmptyStateRow } from '../../components/ui/EmptyStateRow'
import { ModalActions, ModalHeader } from '../../components/ui/ModalChrome'
import { PageSection } from '../../components/ui/PageSection'
import { PaginationBar } from '../../components/ui/PaginationBar'
import { StatsCards } from '../../components/ui/StatsCards'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { TableToolbar } from '../../components/ui/TableToolbar'
import { derivePaginatedRows, useClientTableState } from '../../hooks/useClientTableState'
import { hasDepartmentResponse, workflowPresentation } from '../../lib/departmentTaskWorkflow'
import { isFederalAdmin, isRegionalAdmin } from '../../lib/roles'
import type { AuthUser } from '../../types/auth'

type Props = {
  title: string
}

function userMayReviewTask(user: AuthUser | null, t: DepartmentTaskRow): boolean {
  if (!user) return false
  if (isFederalAdmin(user)) return true
  if (isRegionalAdmin(user) && user.region && user.region.id === t.region_id) return true
  return false
}

export function DepartmentMonitoringPage({ title }: Props) {
  const { user } = useAuth()
  const [rows, setRows] = useState<DepartmentTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<DepartmentTaskRow | null>(null)
  const [reviewComments, setReviewComments] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [savingReview, setSavingReview] = useState(false)
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table

  async function load() {
    const data = await fetchDepartmentTasks()
    setRows(data)
  }

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const requestIds = useMemo(() => Array.from(new Set(rows.map((r) => r.req_id))), [rows])
  const requestFilter = filters.requestId ?? ''
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (requestFilter && r.req_id !== requestFilter) return false
        const q = search.trim().toLowerCase()
        if (!q) return true
        return (
          r.id.toLowerCase().includes(q) ||
          r.req_id.toLowerCase().includes(q) ||
          String(r.department_name ?? r.department_id).toLowerCase().includes(q)
        )
      }),
    [rows, requestFilter, search],
  )
  const { pageRows } = useMemo(
    () => derivePaginatedRows(filtered, page, pageSize),
    [filtered, page, pageSize],
  )

  const inProcessCount = filtered.filter((r) => !hasDepartmentResponse(r)).length
  const revisionCount = filtered.filter((r) => r.regional_review_status === 'needs-modification').length
  const respondedCount = filtered.filter(
    (r) => hasDepartmentResponse(r) && r.regional_review_status !== 'needs-modification',
  ).length

  function openView(row: DepartmentTaskRow) {
    setViewing(row)
    setReviewComments(row.regional_review_comments ?? '')
    setReviewError(null)
  }

  async function submitReview(status: 'accepted' | 'needs-modification') {
    if (!viewing) return
    if (status === 'needs-modification' && !reviewComments.trim()) {
      setReviewError('Add a short note for the department when requesting changes.')
      return
    }
    setSavingReview(true)
    setReviewError(null)
    try {
      const updated = await updateDepartmentTaskReview(viewing.id, {
        regional_review_status: status,
        regional_review_comments: reviewComments.trim() || null,
      })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setViewing(null)
      setReviewComments('')
      setReviewError(null)
    } catch (e: unknown) {
      setReviewError(e instanceof Error ? e.message : 'Could not save review')
    } finally {
      setSavingReview(false)
    }
  }

  const showReviewForm = viewing && userMayReviewTask(user, viewing) && hasDepartmentResponse(viewing)

  return (
    <PageSection
      title={title}
      subtitle="Distributed requests by department: track progress, read submissions, and accept or request changes."
    >
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'In process', value: inProcessCount },
            { label: 'Responded', value: respondedCount },
            { label: 'Revision', value: revisionCount },
          ]}
        />
      </div>

      <TableToolbar>
        <input
          type="search"
          placeholder="Search task ID, request ID, department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search department tasks"
        />
        <select value={requestFilter} onChange={(e) => setFilter('requestId', e.target.value)}>
          <option value="">All request IDs</option>
          {requestIds.map((id) => (
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
      </TableToolbar>

      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>Task ID</th>
              <th>Request</th>
              <th>Department</th>
              <th>Progress</th>
              <th>Assigned</th>
              <th>Submitted</th>
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => {
              const wf = workflowPresentation(t)
              return (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.req_id}</td>
                  <td>{t.department_name ?? t.department_id}</td>
                  <td>
                    <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
                  </td>
                  <td>{t.assigned_date}</td>
                  <td>{t.submission_date ?? '—'}</td>
                  <td className="table-actions">
                    <Button variant="primary" compact onClick={() => openView(t)}>
                      View
                    </Button>
                  </td>
                </tr>
              )
            })}
            {pageRows.length === 0 && <EmptyStateRow colSpan={7} message="No department tasks found." />}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />

      {viewing && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewing(null)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Department response" onClose={() => setViewing(null)} />
            <div className="modal-form">
              <p className="muted" style={{ marginTop: 0 }}>
                Task <strong>{viewing.id}</strong> · Request <strong>{viewing.req_id}</strong> ·{' '}
                {viewing.department_name ?? viewing.department_id}
              </p>
              <div className="form-row">
                <label>Submission</label>
                {hasDepartmentResponse(viewing) ? (
                  <>
                    <textarea
                      rows={10}
                      readOnly
                      value={viewing.response_data?.trim() ? viewing.response_data : '—'}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                    {viewing.attachment_url ? (
                      <p className="muted" style={{ marginTop: 8 }}>
                        Attachment:{' '}
                        <a href={viewing.attachment_url} target="_blank" rel="noreferrer">
                          {viewing.attachment_url}
                        </a>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="muted">The department has not submitted a response yet.</p>
                )}
              </div>

              {showReviewForm ? (
                <>
                  <div className="form-row">
                    <label htmlFor="dept-review-comments">Notes to department (required for modification)</label>
                    <textarea
                      id="dept-review-comments"
                      rows={4}
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      placeholder="e.g. Please add disaggregated data for female respondents."
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  {reviewError && <p className="login-error">{reviewError}</p>}
                  <ModalActions>
                    <Button variant="secondary" compact disabled={savingReview} onClick={() => setViewing(null)}>
                      Close
                    </Button>
                    <Button
                      variant="primary"
                      compact
                      disabled={savingReview}
                      onClick={() => void submitReview('accepted')}
                    >
                      {savingReview ? 'Saving…' : 'Accept'}
                    </Button>
                    <Button
                      variant="secondary"
                      compact
                      disabled={savingReview}
                      onClick={() => void submitReview('needs-modification')}
                    >
                      Request modification
                    </Button>
                  </ModalActions>
                </>
              ) : (
                <ModalActions>
                  <Button variant="secondary" compact onClick={() => setViewing(null)}>
                    Close
                  </Button>
                </ModalActions>
              )}
            </div>
          </div>
        </div>
      )}
    </PageSection>
  )
}
