import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDepartmentTasks, fetchRegionalResponses, type DepartmentTaskRow, type RegionalResponseRow } from '../../api/lists'
import { updateRegionalCompiledResponse } from '../../api/workflows'
import { useAuth } from '../../auth/AuthContext'
import { DepartmentSubmissionsForRequest } from '../../components/DepartmentSubmissionsForRequest'
import { Button } from '../../components/ui/Button'
import { EmptyStateRow } from '../../components/ui/EmptyStateRow'
import { ModalActions } from '../../components/ui/ModalChrome'
import { PageSection } from '../../components/ui/PageSection'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableCard } from '../../components/ui/TableCard'
import { RegionalResponsePreviewModal } from '../../components/RegionalResponsePreviewModal'
import { hasDepartmentResponse, workflowPresentation } from '../../lib/departmentTaskWorkflow'
import { isDepartmentAdmin, isRegionalAdmin, isViewer } from '../../lib/roles'

type Props = {
  title: string
}

function sortTasksByDept(a: DepartmentTaskRow, b: DepartmentTaskRow): number {
  const an = (a.department_name ?? a.department_id).toLowerCase()
  const bn = (b.department_name ?? b.department_id).toLowerCase()
  return an.localeCompare(bn)
}

export function SubmissionHistoryPage({ title }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const regional = isRegionalAdmin(user)
  const deptHistoryUser =
    (isDepartmentAdmin(user) || isViewer(user)) && user?.department != null
  const [rows, setRows] = useState<RegionalResponseRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<RegionalResponseRow | null>(null)
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const taskRows = await fetchDepartmentTasks()
    setTasks(taskRows)
    if (deptHistoryUser) {
      setRows([])
      return
    }
    const respRows = await fetchRegionalResponses()
    setRows(respRows.sort((a, b) => b.submission_date.localeCompare(a.submission_date)))
  }, [deptHistoryUser])

  useEffect(() => {
    void reload().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [reload])

  const tasksForDetail = useMemo(() => {
    if (!detail) return []
    return tasks.filter((t) => t.req_id === detail.req_id).sort(sortTasksByDept)
  }, [tasks, detail])

  const submittedDeptTasks = useMemo(() => {
    return tasks
      .filter((t) => hasDepartmentResponse(t))
      .sort((a, b) => (b.submission_date ?? '').localeCompare(a.submission_date ?? ''))
  }, [tasks])

  const fromHistory = encodeURIComponent('/department-history')

  function openView(r: RegionalResponseRow) {
    setDetailMode('view')
    setDetail(r)
    setSaveError(null)
  }

  function openEdit(r: RegionalResponseRow) {
    setDetailMode('edit')
    setDetail(r)
    setEditTitle(r.title)
    setEditContent(r.content)
    setSaveError(null)
  }

  function closeDetail() {
    setDetail(null)
    setSaveError(null)
  }

  async function saveEditedCompilation() {
    if (!detail) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateRegionalCompiledResponse(detail.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      })
      setRows((prev) => {
        const next = prev.map((r) => (r.id === updated.id ? updated : r))
        return next.sort((a, b) => b.submission_date.localeCompare(a.submission_date))
      })
      setDetail(updated)
      setDetailMode('view')
      void fetchDepartmentTasks().then(setTasks).catch(() => {})
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageSection
      title={title}
      subtitle={
        deptHistoryUser
          ? 'Your submitted department tasks. Use View response to open the full request page with the HR request, regional administration, and your response.'
          : 'Compiled responses with per-department submissions, federal review status, and resubmission after modification.'
      }
    >
      {error && <p className="login-error">{error}</p>}

      {deptHistoryUser && (
        <>
          <h3 className="dashboard-panel-title" style={{ marginBottom: 12 }}>
            Your department submissions
          </h3>
          <div style={{ marginBottom: 28 }}>
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
                {submittedDeptTasks.map((t) => {
                  const wf = workflowPresentation(t)
                  return (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{t.req_id}</td>
                      <td>{t.submission_date ?? '—'}</td>
                      <td>
                        <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
                      </td>
                      <td className="table-actions">
                        <Button
                          variant="primary"
                          compact
                          onClick={() =>
                            navigate(
                              `/requests/${encodeURIComponent(t.req_id)}?task=${encodeURIComponent(t.id)}&from=${fromHistory}`,
                            )
                          }
                        >
                          View response
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {submittedDeptTasks.length === 0 && (
                  <EmptyStateRow colSpan={5} message="No submitted tasks yet." />
                )}
              </tbody>
            </table>
          </TableCard>
          </div>
        </>
      )}

      {!deptHistoryUser && (
        <TableCard>
          <table className="data-table">
            <thead>
              <tr>
                <th>Response ID</th>
                <th>Request</th>
                <th>Title</th>
                <th>Date</th>
                <th>Status</th>
                <th className="table-actions">Compilation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.req_id}</td>
                  <td>{r.title}</td>
                  <td>{r.submission_date}</td>
                  <td>{r.review_status}</td>
                  <td className="table-actions">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <Button variant="primary" compact onClick={() => openView(r)}>
                        View compilation
                      </Button>
                      {regional && r.review_status === 'needs-modification' && (
                        <Button variant="secondary" compact onClick={() => openEdit(r)}>
                          Edit
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <EmptyStateRow colSpan={6} message="No history found." />
              )}
            </tbody>
          </table>
        </TableCard>
      )}

      {detail && detailMode === 'view' && (
        <RegionalResponsePreviewModal
          row={detail}
          tasksForDetail={tasksForDetail}
          onClose={closeDetail}
          introText="Consolidated submission for federal review. Department inputs and your compiled narrative are below."
          footerExtra={
            regional && detail.review_status === 'needs-modification' ? (
              <Button variant="primary" compact onClick={() => openEdit(detail)}>
                Edit compilation
              </Button>
            ) : null
          }
        />
      )}

      {detail && detailMode === 'edit' && regional && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeDetail}>
          <div
            className="modal-card modal-card-wide regional-response-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head dept-task-response-modal__head">
              <div>
                <h3>Edit compilation</h3>
                <p className="dept-task-response-modal__head-meta muted small">
                  Federal requested changes · Response <strong>{detail.id}</strong> · Request{' '}
                  <strong>{detail.req_id}</strong>
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeDetail} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-form regional-response-detail-modal__form">
              <p className="muted small" style={{ marginTop: 0 }}>
                Update the consolidated narrative and save. Review status will return to <strong>pending</strong>.
              </p>
              {saveError && <p className="login-error">{saveError}</p>}

              <div className="dept-task-response-modal__panel regional-response-detail-modal__panel">
                <section className="hr-request-view-template__card regional-response-detail-modal__section">
                  <h2 className="hr-request-view-template__section-title">Reference — department submissions</h2>
                  <DepartmentSubmissionsForRequest
                    tasksForDetail={tasksForDetail}
                    reqId={detail.req_id}
                    filterByRegionName={detail.region_name ?? undefined}
                    omitHeading
                  />
                </section>

                <section className="hr-request-view-template__card regional-response-detail-modal__section">
                  <h2 className="hr-request-view-template__section-title">Your compilation</h2>
                  <div className="form-row">
                    <label htmlFor="edit-compilation-title">Title</label>
                    <input
                      id="edit-compilation-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="edit-compilation-content">Compiled regional response</label>
                    <textarea
                      id="edit-compilation-content"
                      rows={12}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </section>
              </div>
              <ModalActions>
                <Button variant="secondary" compact disabled={saving} onClick={closeDetail}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  compact
                  disabled={saving || !editTitle.trim() || !editContent.trim()}
                  onClick={() => void saveEditedCompilation()}
                >
                  {saving ? 'Saving…' : 'Save and resubmit'}
                </Button>
              </ModalActions>
            </div>
          </div>
        </div>
      )}
    </PageSection>
  )
}
