import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchHrRequest } from '../api/hrRequests'
import {
  fetchDepartmentTasks,
  fetchRegionalResponses,
  type DepartmentTaskRow,
  type RegionalResponseRow,
} from '../api/lists'
import { fetchRegions } from '../api/regions'
import { createDepartmentTask, fetchDepartments, submitDepartmentTaskResponse, type DepartmentRow } from '../api/workflows'
import { useAuth } from '../auth/AuthContext'
import { canManageHrRequests, hrRequestLockedRegionId } from '../auth/rbac'
import { CompiledRecordsWorkflowNav, isFromCompiledRecordsPath } from '../components/CompiledRecordsWorkflowNav'
import { DepartmentResponseDisplay } from '../components/DepartmentResponseDisplay'
import { HrRequestModal } from '../components/HrRequestModal'
import { PendingFileAttachmentRow } from '../components/PendingFileAttachmentRow'
import { Button } from '../components/ui/Button'
import { PageSection } from '../components/ui/PageSection'
import { StatusBadge } from '../components/ui/StatusBadge'
import { parseDepartmentTaskResponseData } from '../lib/departmentTaskResponseFormat'
import {
  canDepartmentSubmitResponse,
  hasDepartmentResponse,
  workflowPresentation,
} from '../lib/departmentTaskWorkflow'
import { isDepartmentAdmin, isRegionalAdmin, isViewer } from '../lib/roles'
import { indicatorsScopedToRequest } from '../lib/hrRequestIndicatorScope'
import type { HrRequestRow } from '../types/hrRequest'
import type { RegionRow } from '../api/regions'

function pageBackLabel(from: string): string {
  if (from === '/' || from === '') return 'Back to dashboard'
  if (from.includes('region-received')) return 'Back to received requests'
  if (from.includes('department-tasks')) return 'Back to assigned tasks'
  if (from.includes('department-history')) return 'Back to submission history'
  if (from.includes('compiled-records')) return 'Back to compilation records'
  return 'Back to requests list'
}

type DeptIndicatorDraft = {
  value: string
  comment: string
  qualText: string
  quantFile: File | null
  qualFile: File | null
  /** Resubmit: drop previously saved quantitative attachment. */
  clearSavedQuantAttachment: boolean
  /** Resubmit: drop previously saved qualitative attachment. */
  clearSavedQualAttachment: boolean
}

function emptyDeptIndicatorDraft(): DeptIndicatorDraft {
  return {
    value: '',
    comment: '',
    qualText: '',
    quantFile: null,
    qualFile: null,
    clearSavedQuantAttachment: false,
    clearSavedQualAttachment: false,
  }
}

export function HrRequestViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') ?? '/requests'
  const taskIdFromUrl = searchParams.get('task')

  const { user } = useAuth()
  const canManage = canManageHrRequests(user)
  const lockedRegionId = hrRequestLockedRegionId(user)
  const regionalUser = isRegionalAdmin(user)
  const deptUser =
    (isDepartmentAdmin(user) || isViewer(user)) && user?.department != null

  const [regions, setRegions] = useState<RegionRow[]>([])
  const [detail, setDetail] = useState<HrRequestRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [regionalResponses, setRegionalResponses] = useState<RegionalResponseRow[]>([])

  const [departments, setDepartments] = useState<DepartmentRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [assignDeptIds, setAssignDeptIds] = useState<number[]>([])
  const [assignRegionalNotes, setAssignRegionalNotes] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const [responseText, setResponseText] = useState('')
  const [responseFile, setResponseFile] = useState<File | null>(null)
  /** Resubmit: remove stored legacy attachment without replacing it. */
  const [legacyAttachmentClear, setLegacyAttachmentClear] = useState(false)
  /** Bumps remount file inputs after clearing a chosen file (same file can be picked again). */
  const [deptFileInputRev, setDeptFileInputRev] = useState<Record<string, number>>({})
  const [indicatorDrafts, setIndicatorDrafts] = useState<Record<number, DeptIndicatorDraft>>({})
  const [submittingResponse, setSubmittingResponse] = useState(false)
  const [submitResponseError, setSubmitResponseError] = useState<string | null>(null)

  function bumpDeptFileInput(key: string) {
    setDeptFileInputRev((r) => ({ ...r, [key]: (r[key] ?? 0) + 1 }))
  }

  const reloadTasksAndDepartments = useCallback(async () => {
    const [deptRows, taskRows] = await Promise.all([fetchDepartments(), fetchDepartmentTasks()])
    setDepartments(deptRows)
    setTasks(taskRows)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchRegions()
      .then((r) => {
        if (!cancelled) setRegions(r)
      })
      .catch(() => {
        if (!cancelled) setRegions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (regionalUser || deptUser) {
      void reloadTasksAndDepartments().catch(() => {})
    }
  }, [regionalUser, deptUser, reloadTasksAndDepartments])

  useEffect(() => {
    if (!id) {
      setDetail(null)
      setDetailLoading(false)
      setDetailError('Missing request id.')
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    setDetailError(null)
    void fetchHrRequest(id)
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
  }, [id])

  useEffect(() => {
    if (!detail?.id) {
      setRegionalResponses([])
      return
    }
    let cancelled = false
    void fetchRegionalResponses()
      .then((rows) => {
        if (!cancelled) {
          setRegionalResponses(rows.filter((r) => r.req_id === detail.id))
        }
      })
      .catch(() => {
        if (!cancelled) setRegionalResponses([])
      })
    return () => {
      cancelled = true
    }
  }, [detail?.id])

  const regionDepartments = useMemo(() => {
    const regionId = user?.region?.id
    if (!regionId) return []
    return departments.filter((d) => {
      if (Array.isArray(d.region_ids) && d.region_ids.length > 0) {
        return d.region_ids.includes(regionId)
      }
      return d.region_id === regionId
    })
  }, [departments, user?.region?.id])

  const tasksForRequest = useMemo(
    () => (detail ? tasks.filter((t) => t.req_id === detail.id) : []),
    [detail, tasks],
  )

  const activeTask = useMemo(() => {
    if (!detail || !taskIdFromUrl) return null
    return tasks.find((t) => t.id === taskIdFromUrl && t.req_id === detail.id) ?? null
  }, [detail, taskIdFromUrl, tasks])

  const deptIndicatorsForForm = useMemo(() => indicatorsScopedToRequest(detail), [detail])

  const deptResponseDisplayScopeIds = useMemo(() => {
    if (!detail || (detail.indicator_responses?.length ?? 0) === 0) return undefined
    return indicatorsScopedToRequest(detail).map((i) => i.id)
  }, [detail])

  useEffect(() => {
    if (!activeTask) {
      setResponseText('')
      setResponseFile(null)
      setLegacyAttachmentClear(false)
      setDeptFileInputRev({})
      setIndicatorDrafts({})
      setSubmitResponseError(null)
      return
    }
    setResponseFile(null)
    setLegacyAttachmentClear(false)
    setDeptFileInputRev({})
    setSubmitResponseError(null)
    const collecting = indicatorsScopedToRequest(detail)
    if (collecting.length > 0) {
      setResponseText('')
      const parsed = parseDepartmentTaskResponseData(
        activeTask.response_data,
        activeTask.attachment_url,
      )
      const next: Record<number, DeptIndicatorDraft> = {}
      for (const ind of collecting) {
        let value = ''
        let comment = ''
        let qualText = ''
        if (parsed.kind === 'structured') {
          const b = parsed.payload.by_indicator[String(ind.id)]
          if (b?.quantitative && b.quantitative.value != null && !Number.isNaN(b.quantitative.value)) {
            value = String(b.quantitative.value)
          }
          if (b?.quantitative?.comment) comment = b.quantitative.comment
          if (b?.qualitative?.text) qualText = b.qualitative.text
        }
        next[ind.id] = { ...emptyDeptIndicatorDraft(), value, comment, qualText }
      }
      setIndicatorDrafts(next)
      return
    }
    setIndicatorDrafts({})
    setResponseText(activeTask.response_data?.trim() ? activeTask.response_data : '')
  }, [activeTask?.id, activeTask?.response_data, activeTask?.attachment_url, detail])

  const deptParsedTaskResponse = useMemo(() => {
    if (!activeTask) return null
    return parseDepartmentTaskResponseData(activeTask.response_data, activeTask.attachment_url)
  }, [activeTask])

  const indicatorFormReady = useMemo(() => {
    if (deptIndicatorsForForm.length === 0 || !activeTask) return true
    const parsed = deptParsedTaskResponse
    if (!parsed) return true
    for (const ind of deptIndicatorsForForm) {
      const d = indicatorDrafts[ind.id]
      if (!d) return false
      if (ind.has_quantitative) {
        const v = d.value.trim()
        if (!v || !Number.isFinite(Number(v))) return false
      }
      if (ind.has_qualitative) {
        const prevQualUrl =
          parsed.kind === 'structured'
            ? parsed.payload.by_indicator[String(ind.id)]?.qualitative?.attachment_url?.trim()
            : ''
        const effectiveQualUrl = d.clearSavedQualAttachment ? '' : prevQualUrl
        if (!d.qualText.trim() && !d.qualFile && !effectiveQualUrl) return false
      }
    }
    return true
  }, [deptIndicatorsForForm, indicatorDrafts, activeTask, deptParsedTaskResponse])

  const deptLegacySubmitReady = useMemo(() => {
    if (!activeTask) return false
    const trimmed = responseText.trim()
    const hadStored = Boolean(activeTask.attachment_url?.trim())
    return Boolean(trimmed || responseFile || (hadStored && !legacyAttachmentClear))
  }, [activeTask, responseText, responseFile, legacyAttachmentClear])

  const showRegionalAssign =
    regionalUser &&
    detail &&
    tasksForRequest.length === 0 &&
    regionDepartments.length > 0

  const showDeptResponseForm =
    deptUser &&
    detail &&
    !detailLoading &&
    activeTask &&
    canDepartmentSubmitResponse(activeTask)

  const showDeptResponseReadonly =
    deptUser &&
    detail &&
    !detailLoading &&
    activeTask &&
    hasDepartmentResponse(activeTask) &&
    !canDepartmentSubmitResponse(activeTask)

  const showRegionalContextCard = Boolean(
    detail && !detailLoading && !from.includes('region-received') && !deptUser,
  )

  const selectedAssignDepartmentsText = useMemo(() => {
    if (assignDeptIds.length === 0) return 'Select departments'
    const selected = regionDepartments.filter((d) => assignDeptIds.includes(d.id))
    if (selected.length === 0) return 'Select departments'
    if (selected.length <= 2) return selected.map((d) => d.name).join(', ')
    return `${selected.length} departments selected`
  }, [assignDeptIds, regionDepartments])

  async function assignSelectedDepartments() {
    if (!detail) return
    if (assignDeptIds.length === 0) {
      setAssignError('Select at least one department.')
      return
    }
    setAssigning(true)
    setAssignError(null)
    try {
      const notes = assignRegionalNotes.trim() || null
      for (const departmentId of assignDeptIds) {
        await createDepartmentTask(detail.id, departmentId, {
          assignment_instructions: notes,
        })
      }
      setAssignDeptIds([])
      setAssignRegionalNotes('')
      await reloadTasksAndDepartments()
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Assignment failed')
    } finally {
      setAssigning(false)
    }
  }

  async function submitResponse() {
    if (!activeTask) return
    setSubmittingResponse(true)
    setSubmitResponseError(null)
    try {
      if (deptIndicatorsForForm.length > 0) {
        if (!indicatorFormReady) {
          setSubmitResponseError(
            'Complete each indicator: a number where required, and qualitative text and/or an attachment where required.',
          )
          return
        }
        const by_indicator: Record<
          string,
          {
            indicator_label: string
            quantitative?: { value: string; comment: string }
            qualitative?: { text: string }
          }
        > = {}
        const quantFiles: Record<number, File> = {}
        const qualFiles: Record<number, File> = {}
        const stripQuantIndicatorIds: number[] = []
        const stripQualIndicatorIds: number[] = []
        for (const ind of deptIndicatorsForForm) {
          const d = indicatorDrafts[ind.id]
          if (!d) continue
          const entry: (typeof by_indicator)[string] = { indicator_label: ind.indicator_text }
          if (ind.has_quantitative) {
            entry.quantitative = { value: d.value.trim(), comment: d.comment.trim() }
            if (d.quantFile) quantFiles[ind.id] = d.quantFile
            if (d.clearSavedQuantAttachment) stripQuantIndicatorIds.push(ind.id)
          }
          if (ind.has_qualitative) {
            entry.qualitative = { text: d.qualText.trim() }
            if (d.qualFile) qualFiles[ind.id] = d.qualFile
            if (d.clearSavedQualAttachment) stripQualIndicatorIds.push(ind.id)
          }
          by_indicator[String(ind.id)] = entry
        }
        await submitDepartmentTaskResponse(activeTask.id, {
          mode: 'indicators',
          indicator_bundles: JSON.stringify({ by_indicator }),
          quantFiles,
          qualFiles,
          stripQuantIndicatorIds,
          stripQualIndicatorIds,
        })
      } else {
        const trimmed = responseText.trim()
        if (!deptLegacySubmitReady) {
          setSubmitResponseError('Enter a response and/or attach a file.')
          return
        }
        await submitDepartmentTaskResponse(activeTask.id, {
          mode: 'legacy',
          response_data: trimmed,
          attachment: responseFile ?? undefined,
          removeAttachment: legacyAttachmentClear && !responseFile,
        })
      }
      await reloadTasksAndDepartments()
    } catch (e: unknown) {
      setSubmitResponseError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmittingResponse(false)
    }
  }

  const backLabel = pageBackLabel(from)

  const pageSubtitle = regionalUser
    ? 'Read the request below. Regional admins can assign departments from this same page when distribution is still open.'
    : deptUser
      ? 'Review the request and your regional assignment instructions, then complete your department response when a task is open.'
      : 'View HR request details. Use the button below to return to the previous page.'

  const showCompiledWorkflowNav = isFromCompiledRecordsPath(from) && Boolean(id)

  return (
    <PageSection title="Request" subtitle={pageSubtitle}>
      <div className="hr-request-view-stack">
        {showCompiledWorkflowNav && id ? (
          <CompiledRecordsWorkflowNav reqId={id} activeTab="request" />
        ) : null}
        <HrRequestModal
          layout="page"
          mode="view"
          detail={detail}
          detailLoading={detailLoading}
          detailError={detailError}
          regions={regions}
          canManage={canManage}
          lockedRegionId={lockedRegionId}
          pageCloseLabel={backLabel}
          onClose={() => navigate(from)}
          onSaved={() => navigate(from)}
          departmentPortalRegionalNotes={
            deptUser ? (activeTask?.assignment_instructions ?? null) : undefined
          }
        />

        {showRegionalContextCard && (
          <div className="hr-request-view-panel">
            <h3 className="dashboard-panel-title" style={{ marginTop: 0, marginBottom: 12 }}>
              Regional administration
            </h3>
            <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
              Consolidated regional response and review status for this request (submitted by regional admins).
            </p>
            {regionalResponses.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No regional compilation has been submitted for this request yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {regionalResponses.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: 14,
                      border: '1px solid var(--field-border, #e1e7f5)',
                      borderRadius: 10,
                      background: 'var(--field-bg, #fafbfd)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <strong className="text-sm font-semibold">{r.title}</strong>
                      <StatusBadge tone="default">{r.review_status}</StatusBadge>
                    </div>
                    <p className="muted small" style={{ margin: '8px 0 10px' }}>
                      Submitted {r.submission_date}
                      {r.region_name ? ` · ${r.region_name}` : ''}
                    </p>
                    {r.comments?.trim() ? (
                      <p className="muted small" style={{ margin: '0 0 10px' }}>
                        <strong>Federal / review comments:</strong> {r.comments}
                      </p>
                    ) : null}
                    <label className="muted small" style={{ display: 'block', marginBottom: 6 }}>
                      Response content
                    </label>
                    <textarea
                      readOnly
                      rows={8}
                      value={r.content?.trim() ? r.content : '—'}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showDeptResponseForm && activeTask && (
          <div className="hr-request-view-panel">
            <h3 className="dashboard-panel-title" style={{ marginTop: 0, marginBottom: 12 }}>
              Your response — task {activeTask.id}
            </h3>
            {deptIndicatorsForForm.length > 0 ? (
              <>
                <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
                  Submit values for each indicator in this request. Attachments are optional unless you rely on a file
                  instead of qualitative text (up to 15 MB per file).
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {deptIndicatorsForForm.map((ind) => {
                    const d = indicatorDrafts[ind.id] ?? emptyDeptIndicatorDraft()
                    const prevQuantUrl =
                      deptParsedTaskResponse?.kind === 'structured'
                        ? deptParsedTaskResponse.payload.by_indicator[String(ind.id)]?.quantitative?.attachment_url?.trim() ??
                          ''
                        : ''
                    const prevQualUrl =
                      deptParsedTaskResponse?.kind === 'structured'
                        ? deptParsedTaskResponse.payload.by_indicator[String(ind.id)]?.qualitative?.attachment_url?.trim() ??
                          ''
                        : ''
                    return (
                      <div
                        key={ind.id}
                        style={{
                          padding: 14,
                          border: '1px solid var(--field-border, #e1e7f5)',
                          borderRadius: 10,
                          background: 'var(--field-bg, #fafbfd)',
                        }}
                      >
                        <strong className="text-sm font-semibold" style={{ display: 'block', marginBottom: 10 }}>
                          {ind.indicator_text}
                        </strong>
                        {ind.disaggregation?.trim() ? (
                          <p className="muted small" style={{ margin: '0 0 12px' }}>
                            {ind.disaggregation}
                          </p>
                        ) : null}
                        {ind.has_quantitative ? (
                          <div style={{ marginBottom: ind.has_qualitative ? 14 : 0 }}>
                            <div className="muted small" style={{ marginBottom: 8 }}>
                              Quantitative
                            </div>
                            <div className="form-row" style={{ marginBottom: 8 }}>
                              <label htmlFor={`dept-ind-${ind.id}-num`}>Number</label>
                              <input
                                id={`dept-ind-${ind.id}-num`}
                                type="text"
                                inputMode="decimal"
                                value={d.value}
                                onChange={(e) =>
                                  setIndicatorDrafts((prev) => ({
                                    ...prev,
                                    [ind.id]: { ...d, value: e.target.value },
                                  }))
                                }
                                style={{ width: '100%', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div className="form-row" style={{ marginBottom: 8 }}>
                              <label htmlFor={`dept-ind-${ind.id}-comment`}>Comment (optional)</label>
                              <textarea
                                id={`dept-ind-${ind.id}-comment`}
                                rows={2}
                                value={d.comment}
                                onChange={(e) =>
                                  setIndicatorDrafts((prev) => ({
                                    ...prev,
                                    [ind.id]: { ...d, comment: e.target.value },
                                  }))
                                }
                                style={{ width: '100%', boxSizing: 'border-box' }}
                              />
                            </div>
                            {prevQuantUrl && !d.clearSavedQuantAttachment ? (
                              <div className="form-row" style={{ marginBottom: 8 }}>
                                <span className="muted small" style={{ display: 'block', marginBottom: 6 }}>
                                  Saved quantitative file
                                </span>
                                <span className="hr-request-attachments-list__actions">
                                  <a
                                    href={prevQuantUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-secondary btn-compact"
                                  >
                                    View
                                  </a>
                                  <Button
                                    type="button"
                                    variant="danger"
                                    compact
                                    onClick={() =>
                                      setIndicatorDrafts((prev) => ({
                                        ...prev,
                                        [ind.id]: {
                                          ...(prev[ind.id] ?? emptyDeptIndicatorDraft()),
                                          clearSavedQuantAttachment: true,
                                        },
                                      }))
                                    }
                                  >
                                    Remove
                                  </Button>
                                </span>
                              </div>
                            ) : null}
                            {d.clearSavedQuantAttachment && prevQuantUrl ? (
                              <p className="muted small" style={{ margin: '0 0 8px' }}>
                                Saved quantitative file will be removed when you submit.
                              </p>
                            ) : null}
                            <div className="form-row">
                              <label htmlFor={`dept-ind-${ind.id}-qfile`}>Attach file (optional)</label>
                              <input
                                id={`dept-ind-${ind.id}-qfile`}
                                key={`q-${ind.id}-${deptFileInputRev[`q-${ind.id}`] ?? 0}`}
                                type="file"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null
                                  e.target.value = ''
                                  setIndicatorDrafts((prev) => {
                                    const cur = prev[ind.id] ?? emptyDeptIndicatorDraft()
                                    return {
                                      ...prev,
                                      [ind.id]: { ...cur, quantFile: f, clearSavedQuantAttachment: false },
                                    }
                                  })
                                }}
                              />
                            </div>
                            {d.quantFile ? (
                              <PendingFileAttachmentRow
                                file={d.quantFile}
                                listStyle={{ marginTop: 8 }}
                                onRemove={() => {
                                  bumpDeptFileInput(`q-${ind.id}`)
                                  setIndicatorDrafts((prev) => {
                                    const cur = prev[ind.id] ?? emptyDeptIndicatorDraft()
                                    return { ...prev, [ind.id]: { ...cur, quantFile: null } }
                                  })
                                }}
                              />
                            ) : null}
                          </div>
                        ) : null}
                        {ind.has_qualitative ? (
                          <div>
                            <div className="muted small" style={{ marginBottom: 8 }}>
                              Qualitative
                            </div>
                            <div className="form-row" style={{ marginBottom: 8 }}>
                              <label htmlFor={`dept-ind-${ind.id}-qual`}>Response</label>
                              <textarea
                                id={`dept-ind-${ind.id}-qual`}
                                rows={5}
                                value={d.qualText}
                                onChange={(e) =>
                                  setIndicatorDrafts((prev) => ({
                                    ...prev,
                                    [ind.id]: { ...d, qualText: e.target.value },
                                  }))
                                }
                                placeholder="Narrative response for this indicator…"
                                style={{ width: '100%', boxSizing: 'border-box' }}
                              />
                            </div>
                            {prevQualUrl && !d.clearSavedQualAttachment ? (
                              <div className="form-row" style={{ marginBottom: 8 }}>
                                <span className="muted small" style={{ display: 'block', marginBottom: 6 }}>
                                  Saved qualitative file
                                </span>
                                <span className="hr-request-attachments-list__actions">
                                  <a
                                    href={prevQualUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-secondary btn-compact"
                                  >
                                    View
                                  </a>
                                  <Button
                                    type="button"
                                    variant="danger"
                                    compact
                                    onClick={() =>
                                      setIndicatorDrafts((prev) => ({
                                        ...prev,
                                        [ind.id]: {
                                          ...(prev[ind.id] ?? emptyDeptIndicatorDraft()),
                                          clearSavedQualAttachment: true,
                                        },
                                      }))
                                    }
                                  >
                                    Remove
                                  </Button>
                                </span>
                              </div>
                            ) : null}
                            {d.clearSavedQualAttachment && prevQualUrl ? (
                              <p className="muted small" style={{ margin: '0 0 8px' }}>
                                Saved qualitative file will be removed when you submit.
                              </p>
                            ) : null}
                            <div className="form-row">
                              <label htmlFor={`dept-ind-${ind.id}-lfile`}>Attach file (optional)</label>
                              <input
                                id={`dept-ind-${ind.id}-lfile`}
                                key={`l-${ind.id}-${deptFileInputRev[`l-${ind.id}`] ?? 0}`}
                                type="file"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null
                                  e.target.value = ''
                                  setIndicatorDrafts((prev) => {
                                    const cur = prev[ind.id] ?? emptyDeptIndicatorDraft()
                                    return {
                                      ...prev,
                                      [ind.id]: { ...cur, qualFile: f, clearSavedQualAttachment: false },
                                    }
                                  })
                                }}
                              />
                            </div>
                            {d.qualFile ? (
                              <PendingFileAttachmentRow
                                file={d.qualFile}
                                listStyle={{ marginTop: 8 }}
                                onRemove={() => {
                                  bumpDeptFileInput(`l-${ind.id}`)
                                  setIndicatorDrafts((prev) => {
                                    const cur = prev[ind.id] ?? emptyDeptIndicatorDraft()
                                    return { ...prev, [ind.id]: { ...cur, qualFile: null } }
                                  })
                                }}
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
                  Provide narrative input and optionally attach a file (up to 15 MB). This will mark the task as
                  submitted.
                </p>
                <div className="form-row">
                  <label htmlFor="dept-task-response">Response</label>
                  <textarea
                    id="dept-task-response"
                    rows={8}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Describe your department’s response to this request…"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                {activeTask.attachment_url?.trim() && !legacyAttachmentClear ? (
                  <div className="form-row">
                    <span className="muted small" style={{ display: 'block', marginBottom: 6 }}>
                      Saved attachment
                    </span>
                    <span className="hr-request-attachments-list__actions">
                      <a
                        href={activeTask.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-compact"
                      >
                        View
                      </a>
                      <Button type="button" variant="danger" compact onClick={() => setLegacyAttachmentClear(true)}>
                        Remove
                      </Button>
                    </span>
                  </div>
                ) : null}
                {legacyAttachmentClear && activeTask.attachment_url?.trim() ? (
                  <p className="muted small" style={{ marginTop: 0, marginBottom: 10 }}>
                    Attachment will be removed when you submit.
                  </p>
                ) : null}
                <div className="form-row">
                  <label htmlFor="dept-task-file">Add or replace attachment (optional)</label>
                  <input
                    id="dept-task-file"
                    key={`legacy-${deptFileInputRev.legacy ?? 0}`}
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      e.target.value = ''
                      setResponseFile(f)
                      setLegacyAttachmentClear(false)
                    }}
                  />
                </div>
                {responseFile ? (
                  <PendingFileAttachmentRow
                    file={responseFile}
                    listStyle={{ marginTop: 8 }}
                    onRemove={() => {
                      bumpDeptFileInput('legacy')
                      setResponseFile(null)
                    }}
                  />
                ) : null}
              </>
            )}
            {submitResponseError && <p className="login-error">{submitResponseError}</p>}
            <div style={{ marginTop: 16 }}>
              <Button
                variant="primary"
                compact
                disabled={
                  submittingResponse ||
                  (deptIndicatorsForForm.length > 0 ? !indicatorFormReady : !deptLegacySubmitReady)
                }
                onClick={() => void submitResponse()}
              >
                {submittingResponse ? 'Submitting…' : 'Submit response'}
              </Button>
            </div>
          </div>
        )}

        {showDeptResponseReadonly && activeTask && (
          <div className="hr-request-view-panel">
            <h3 className="dashboard-panel-title" style={{ marginTop: 0, marginBottom: 12 }}>
              Your submitted response — task {activeTask.id}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <StatusBadge tone={workflowPresentation(activeTask).tone}>
                {workflowPresentation(activeTask).label}
              </StatusBadge>
              {activeTask.submission_date ? (
                <span className="muted small">Submitted {activeTask.submission_date}</span>
              ) : null}
            </div>
            {activeTask.regional_review_comments?.trim() ? (
              <p className="muted small" style={{ margin: '0 0 12px' }}>
                <strong>Regional review:</strong> {activeTask.regional_review_comments}
              </p>
            ) : null}
            <label className="muted small" style={{ display: 'block', marginBottom: 6 }}>
              Response
            </label>
            <DepartmentResponseDisplay
              responseData={activeTask.response_data}
              attachmentUrl={activeTask.attachment_url}
              onlyIndicatorIds={deptResponseDisplayScopeIds}
            />
            <p className="muted small" style={{ marginTop: 16 }}>
              <Link to="/department-history">Open submission history</Link>
            </p>
          </div>
        )}

        {deptUser &&
          detail &&
          !detailLoading &&
          taskIdFromUrl &&
          !activeTask && (
            <p className="login-error hr-request-view-footnote">
              That task was not found for this request, or you may not have access.
            </p>
          )}

        {deptUser && !regionalUser && detail && !detailLoading && !taskIdFromUrl && (
          <p className="muted hr-request-view-footnote">
            Open a task from <strong>Assigned tasks</strong> using <strong>View & response</strong> to submit your
            department’s input here.
          </p>
        )}

        {showRegionalAssign && (
          <div className="hr-request-view-panel">
            <h3 className="dashboard-panel-title" style={{ marginTop: 0, marginBottom: 12 }}>
              Assign to departments ({user?.region?.name ?? 'your region'})
            </h3>
            <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
              Select one or more departments, then assign tasks for this request.
            </p>
            <label className="muted" htmlFor="reg-assign-dept-summary">
              Departments
            </label>
            <details className="hr-request-ict-dept-dropdown" style={{ marginTop: 8 }}>
              <summary id="reg-assign-dept-summary">{selectedAssignDepartmentsText}</summary>
              <div className="hr-request-ict-dept-dropdown__menu" role="group" aria-label="Assign departments">
                {regionDepartments.map((d) => (
                  <label key={d.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={assignDeptIds.includes(d.id)}
                      onChange={(e) =>
                        setAssignDeptIds((prev) =>
                          e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id),
                        )
                      }
                    />
                    <span>
                      {d.name} {d.code ? <span className="muted small">({d.code})</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </details>
            <div className="form-row" style={{ marginTop: 14 }}>
              <label htmlFor="reg-assign-instructions">Comments or instructions for departments (optional)</label>
              <textarea
                id="reg-assign-instructions"
                rows={4}
                value={assignRegionalNotes}
                onChange={(e) => setAssignRegionalNotes(e.target.value)}
                placeholder="e.g. Prioritize disaggregated figures by district; deadline for draft input is Friday."
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            {assignError && <p className="login-error" style={{ marginTop: 12 }}>{assignError}</p>}
            <div style={{ marginTop: 16 }}>
              <Button
                variant="primary"
                compact
                disabled={assigning || assignDeptIds.length === 0}
                onClick={() => void assignSelectedDepartments()}
              >
                {assigning ? 'Assigning…' : 'Assign selected departments'}
              </Button>
            </div>
          </div>
        )}

        {regionalUser && detail && !detailLoading && tasksForRequest.length > 0 && (
          <p className="muted hr-request-view-footnote">
            This request already has department tasks. Use <strong>Distributed requests</strong> to track progress.
          </p>
        )}

        {regionalUser &&
          detail &&
          !detailLoading &&
          tasksForRequest.length === 0 &&
          regionDepartments.length === 0 && (
            <p className="muted hr-request-view-footnote">
              No departments are mapped to your region. Add departments under <strong>Manage departments</strong>{' '}
              before assigning tasks.
            </p>
          )}

        <div className="hr-request-view-footback" style={{ marginTop: 20 }}>
          <Button variant="secondary" compact type="button" onClick={() => navigate(from)}>
            {backLabel}
          </Button>
        </div>
      </div>
    </PageSection>
  )
}
