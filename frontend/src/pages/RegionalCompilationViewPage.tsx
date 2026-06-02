import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchHrRequest } from '../api/hrRequests'
import { fetchDepartmentTasks, fetchRegionalResponses, type DepartmentTaskRow, type RegionalResponseRow } from '../api/lists'
import type { HrRequestRow } from '../types/hrRequest'
import { updateRegionalCompiledResponse } from '../api/workflows'
import { useAuth } from '../auth/AuthContext'
import { DepartmentSubmissionsForRequest } from '../components/DepartmentSubmissionsForRequest'
import { RegionalFederalReviewFeedback } from '../components/RegionalFederalReviewFeedback'
import { RegionalResponsePreviewView } from '../components/RegionalResponsePreviewModal'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { Button } from '../components/ui/Button'
import { ModalActions } from '../components/ui/ModalChrome'
import { PageSection } from '../components/ui/PageSection'
import { WorkflowModalHero } from '../components/ui/WorkflowModalHero'
import { isRegionalAdmin } from '../lib/roles'
import { regionalCompilationViewPath, workflowBackLabel } from '../lib/workflowNavigation'

function sortTasksByDept(a: DepartmentTaskRow, b: DepartmentTaskRow): number {
  const an = (a.department_name ?? a.department_id).toLowerCase()
  const bn = (b.department_name ?? b.department_id).toLowerCase()
  return an.localeCompare(bn)
}

export function RegionalCompilationViewPage() {
  const { responseId } = useParams<{ responseId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const from = searchParams.get('from') ?? '/region-history'
  const editMode = searchParams.get('edit') === '1'
  const { user } = useAuth()
  const regional = isRegionalAdmin(user)

  const [rows, setRows] = useState<RegionalResponseRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(editMode)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [hrDetail, setHrDetail] = useState<HrRequestRow | null>(null)

  const backTo = from.startsWith('/') ? from : `/${from}`

  const reload = useCallback(async () => {
    const [respRows, taskRows] = await Promise.all([fetchRegionalResponses(), fetchDepartmentTasks()])
    setRows(respRows)
    setTasks(taskRows)
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
  }, [reload, responseId])

  const row = useMemo(() => rows.find((r) => r.id === responseId) ?? null, [rows, responseId])

  useEffect(() => {
    setEditing(editMode)
  }, [editMode, row?.id])

  useEffect(() => {
    if (!row) return
    setEditTitle(row.title)
    setEditContent(row.content)
    setSaveError(null)
  }, [row])

  useEffect(() => {
    if (!row) {
      setHrDetail(null)
      return
    }
    let cancelled = false
    void fetchHrRequest(row.req_id)
      .then((r) => {
        if (!cancelled) setHrDetail(r)
      })
      .catch(() => {
        if (!cancelled) setHrDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [row?.req_id])

  const tasksForDetail = useMemo(() => {
    if (!row) return []
    return tasks.filter((t) => t.req_id === row.req_id).sort(sortTasksByDept)
  }, [tasks, row])

  async function saveEditedCompilation() {
    if (!row) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateRegionalCompiledResponse(row.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setEditing(false)
      navigate(regionalCompilationViewPath(updated.id, backTo), { replace: true })
      void fetchDepartmentTasks().then(setTasks).catch(() => {})
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const footerExtra =
    regional && row && row.review_status === 'needs-modification' && !editing ? (
      <Button
        variant="primary"
        compact
        type="button"
        onClick={() =>
          navigate(regionalCompilationViewPath(row.id, backTo, { edit: true }), { replace: true })
        }
      >
        Edit compilation
      </Button>
    ) : null

  return (
    <PageSection title={editing ? 'Edit compilation' : 'Regional compilation'}>
      <div className="hr-request-view-stack hr-request-view-stack--request-page">
        {loading ? <p className="muted">Loading...</p> : null}
        {error ? <p className="login-error">{error}</p> : null}
        {!loading && !error && !row ? (
          <p className="login-error">Regional compilation not found.</p>
        ) : null}
        {!loading && !error && row && !editing ? (
          <RegionalResponsePreviewView
            row={row}
            tasksForDetail={tasksForDetail}
            embedded
            footerExtra={footerExtra}
          />
        ) : null}
        {!loading && !error && row && editing && regional ? (
          <div className="modal-card modal-card-wide regional-response-detail-modal workflow-tabbed-card">
            <WorkflowModalHero
              eyebrow="Regional compilation"
              title="Edit compilation"
              embedded
            >
              <span className="workflow-modal-hero__chip">{row.req_id}</span>
            </WorkflowModalHero>
            <div className="modal-form regional-response-detail-modal__form dept-task-response-modal__body">
              <RegionalFederalReviewFeedback row={row} />
              {saveError ? <p className="login-error">{saveError}</p> : null}
              <section className="hr-request-view-template__card regional-response-detail-modal__section">
                <h2 className="card-section-heading">Reference - department submissions</h2>
                <DepartmentSubmissionsForRequest
                  tasksForDetail={tasksForDetail}
                  reqId={row.req_id}
                  issueIndicators={hrDetail?.issue?.indicators}
                  filterByRegionName={row.region_name ?? undefined}
                  omitHeading
                />
              </section>
              <section className="hr-request-view-template__card regional-response-detail-modal__section">
                <h2 className="card-section-heading">Your compilation</h2>
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
              <ModalActions>
                <Button
                  variant="secondary"
                  compact
                  disabled={saving}
                  type="button"
                  onClick={() => {
                    if (editMode) {
                      navigate(regionalCompilationViewPath(row.id, backTo), { replace: true })
                    } else {
                      setEditing(false)
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  compact
                  disabled={saving || !editTitle.trim() || !editContent.trim()}
                  type="button"
                  onClick={() => void saveEditedCompilation()}
                >
                  {saving ? 'Saving...' : 'Save and resubmit'}
                </Button>
              </ModalActions>
            </div>
          </div>
        ) : null}
        <WorkflowPageBack to={backTo} label={workflowBackLabel(backTo)} />
      </div>
    </PageSection>
  )
}
