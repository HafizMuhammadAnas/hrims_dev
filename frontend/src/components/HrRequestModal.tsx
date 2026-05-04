import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { isApiError } from '../api/apiError'
import {
  createHrRequestFromIssueForm,
  fetchHrRequestFormFederalDepartments,
  fetchHrRequestFormIssues,
  fetchKnowledgeConventions,
  updateHrRequest,
  type FederalDepartmentOption,
  type HrRequestIndicatorResponseInput,
  type KnowledgeConventionRow,
} from '../api/hrRequests'
import type { RegionRow } from '../api/regions'
import { useAuth } from '../auth/AuthContext'
import { HR_REQUEST_STATUSES } from '../data/hrRequestFormLookups'
import type { HrRequestIssueDetail, HrRequestRow, HrRequestStatus } from '../types/hrRequest'
import { Alert, FieldError } from './ui/Alert'
import { Button } from './ui/Button'
import { FormControl } from './ui/FormControl'
import { FormField } from './ui/FormField'
import { FormGrid } from './ui/FormGrid'
import { FormRow } from './ui/FormRow'
import { ModalActions, ModalHeader } from './ui/ModalChrome'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type IndicatorValues = Record<number, { quantitative: string; qualitative: string }>

type IssueFormState = {
  title: string
  convention_id: number | ''
  issue_id: number | ''
  region_ids: number[]
  department_ids: number[]
  date: string
  status: HrRequestStatus
  details: string
  indicatorValues: IndicatorValues
  attachmentFiles: File[]
}

function emptyIssueForm(lockedRegionId: number | null): IssueFormState {
  const region_ids = lockedRegionId != null ? [lockedRegionId] : []
  return {
    title: '',
    convention_id: '',
    issue_id: '',
    region_ids,
    department_ids: [],
    date: todayIso(),
    status: 'pending',
    details: '',
    indicatorValues: {},
    attachmentFiles: [],
  }
}

function issueFormFromDetail(row: HrRequestRow, lockedRegionId: number | null): IssueFormState {
  const region_ids =
    row.regions?.length
      ? row.regions.map((r) => r.id)
      : row.region_id != null
        ? [row.region_id]
        : lockedRegionId != null
          ? [lockedRegionId]
          : []
  const ind: IndicatorValues = {}
  for (const r of row.indicator_responses ?? []) {
    ind[r.issue_indicator_id] = {
      quantitative:
        r.quantitative_value != null && !Number.isNaN(r.quantitative_value)
          ? String(r.quantitative_value)
          : '',
      qualitative: r.qualitative_text ?? '',
    }
  }
  return {
    title: row.title,
    convention_id: row.convention_id ?? '',
    issue_id: row.issue_id ?? '',
    region_ids,
    department_ids: row.departments?.map((d) => d.id) ?? [],
    date: row.date,
    status: row.status,
    details: row.details ?? '',
    indicatorValues: ind,
    attachmentFiles: [],
  }
}

function initIndicatorValues(issue: HrRequestIssueDetail | null, prev: IndicatorValues): IndicatorValues {
  if (!issue) return {}
  const next: IndicatorValues = {}
  for (const ind of issue.indicators) {
    const old = prev[ind.id]
    next[ind.id] = {
      quantitative: old?.quantitative ?? '',
      qualitative: old?.qualitative ?? '',
    }
  }
  return next
}

function showQuantitative(issue: HrRequestIssueDetail): boolean {
  return issue.has_quantitative
}

function showQualitative(issue: HrRequestIssueDetail): boolean {
  return issue.has_qualitative
}

function buildIndicatorPayload(
  issue: HrRequestIssueDetail,
  values: IndicatorValues,
): HrRequestIndicatorResponseInput[] {
  const out: HrRequestIndicatorResponseInput[] = []
  for (const ind of issue.indicators) {
    const v = values[ind.id]
    if (!v) continue
    const qRaw = v.quantitative.trim()
    const lRaw = v.qualitative.trim()
    if (!qRaw && !lRaw) continue
    const entry: HrRequestIndicatorResponseInput = { issue_indicator_id: ind.id }
    if (qRaw !== '') {
      const n = Number(qRaw)
      entry.quantitative_value = Number.isFinite(n) ? n : null
    }
    if (lRaw !== '') entry.qualitative_text = lRaw
    out.push(entry)
  }
  return out
}

export type HrRequestModalProps = {
  mode: 'create' | 'edit' | 'view'
  detail: HrRequestRow | null
  detailLoading: boolean
  detailError: string | null
  regions: RegionRow[]
  canManage: boolean
  lockedRegionId?: number | null
  onClose: () => void
  onSaved: () => void
}

export function HrRequestModal({
  mode,
  detail,
  detailLoading,
  detailError,
  regions,
  canManage,
  lockedRegionId = null,
  onClose,
  onSaved,
}: HrRequestModalProps) {
  const { user } = useAuth()
  const showFederalDepartments = Boolean(
    user?.roles.some((r) => r.slug === 'federal_admin'),
  )

  const assignableRegions = useMemo(() => {
    const base = regions.filter((r) => r.slug !== 'federal')
    if (lockedRegionId == null) return base
    if (base.some((r) => r.id === lockedRegionId)) return base
    const mine = regions.find((r) => r.id === lockedRegionId)
    return mine ? [mine, ...base] : base
  }, [regions, lockedRegionId])

  const usesIssueFlow = mode === 'create' || Boolean(detail?.convention_id && detail?.issue_id)

  const [conventions, setConventions] = useState<KnowledgeConventionRow[]>([])
  const [issues, setIssues] = useState<HrRequestIssueDetail[]>([])
  const [federalDepts, setFederalDepts] = useState<FederalDepartmentOption[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [issuesLoading, setIssuesLoading] = useState(false)

  const [legacyForm, setLegacyForm] = useState<{
    title: string
    conv: string
    region_id: number | ''
    date: string
    status: HrRequestStatus
    details: string
  } | null>(null)

  const [issueForm, setIssueForm] = useState<IssueFormState | null>(null)

  const [saving, setSaving] = useState(false)
  const [formBanner, setFormBanner] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const readOnly = mode === 'view' || !canManage

  const loadIssues = useCallback(async (conventionId: number) => {
    setIssuesLoading(true)
    try {
      const rows = await fetchHrRequestFormIssues(conventionId)
      setIssues(rows)
    } catch {
      setIssues([])
      setFormBanner('Could not load issues for this convention.')
    } finally {
      setIssuesLoading(false)
    }
  }, [])

  useLayoutEffect(() => {
    setFormBanner(null)
    setFieldErrors({})
    if (mode === 'create') {
      setLegacyForm(null)
      setIssueForm(emptyIssueForm(lockedRegionId))
      setIssues([])
      setConventions([])
      return
    }
    if (!detailLoading && detail) {
      if (detail.convention_id && detail.issue_id) {
        setLegacyForm(null)
        setIssueForm(issueFormFromDetail(detail, lockedRegionId))
        if (detail.issue) {
          setIssues([detail.issue])
        } else {
          setIssues([])
        }
        const cid = detail.convention?.id ?? detail.convention_id
        if (typeof cid === 'number') {
          void loadIssues(cid)
        }
      } else {
        setIssueForm(null)
        setIssues([])
        setLegacyForm({
          title: detail.title,
          conv: detail.conv,
          region_id: detail.region_id ?? '',
          date: detail.date,
          status: detail.status,
          details: detail.details ?? '',
        })
      }
    }
    if (!detailLoading && !detail) {
      setIssueForm(null)
      setLegacyForm(null)
    }
  }, [mode, detail, detailLoading, assignableRegions, lockedRegionId, loadIssues])

  useEffect(() => {
    if (mode !== 'create' || !issueForm) return
    let cancelled = false
    setCatalogLoading(true)
    void (async () => {
      try {
        const [convRows, deptRows] = await Promise.all([
          fetchKnowledgeConventions(),
          showFederalDepartments ? fetchHrRequestFormFederalDepartments() : Promise.resolve([]),
        ])
        if (!cancelled) {
          setConventions(convRows)
          setFederalDepts(deptRows)
        }
      } catch {
        if (!cancelled) setFormBanner('Could not load form catalogs.')
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, issueForm, showFederalDepartments])

  useEffect(() => {
    if (mode === 'create') return
    if (!detail?.convention_id) return
    let cancelled = false
    void fetchKnowledgeConventions()
      .then((rows) => {
        if (!cancelled) setConventions(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mode, detail?.id, detail?.convention_id])

  useEffect(() => {
    if (mode === 'create' || !showFederalDepartments) return
    if (!detail?.issue_id) return
    let cancelled = false
    void fetchHrRequestFormFederalDepartments()
      .then((rows) => {
        if (!cancelled) setFederalDepts(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mode, detail?.id, detail?.issue_id, showFederalDepartments])

  useEffect(() => {
    if (mode !== 'create' || !issueForm) return
    const cid = issueForm.convention_id
    if (cid === '') {
      setIssues([])
      return
    }
    void loadIssues(cid)
  }, [mode, issueForm?.convention_id, loadIssues])

  useEffect(() => {
    if (!issueForm || issueForm.issue_id === '') return
    const sel = issues.find((i) => i.id === issueForm.issue_id) ?? null
    if (!sel) return
    setIssueForm((f) =>
      f
        ? {
            ...f,
            indicatorValues: initIndicatorValues(sel, f.indicatorValues),
          }
        : f,
    )
  }, [issueForm?.issue_id, issues])

  const selectedIssue = useMemo(() => {
    if (!issueForm || issueForm.issue_id === '') return null
    return issues.find((i) => i.id === issueForm.issue_id) ?? null
  }, [issueForm, issues])

  function runIssueValidation(): boolean {
    if (!issueForm) return false
    const fe: Record<string, string> = {}
    if (!issueForm.title.trim()) fe.title = 'Title is required.'
    if (issueForm.convention_id === '') fe.convention_id = 'Convention is required.'
    if (issueForm.issue_id === '') fe.issue_id = 'Issue is required.'
    if (!issueForm.date) fe.date = 'Due date is required.'
    setFieldErrors(fe)
    if (Object.keys(fe).length > 0) {
      setFormBanner('Please correct the fields below.')
      return false
    }
    setFormBanner(null)
    return true
  }

  function runLegacyValidation(): boolean {
    if (!legacyForm) return false
    const fe: Record<string, string> = {}
    if (!legacyForm.title.trim()) fe.title = 'Title is required.'
    if (!legacyForm.conv.trim()) fe.conv = 'Convention is required.'
    if (legacyForm.region_id === '') fe.region_id = 'Region is required.'
    if (!legacyForm.date) fe.date = 'Due date is required.'
    setFieldErrors(fe)
    if (Object.keys(fe).length > 0) {
      setFormBanner('Please correct the fields below.')
      return false
    }
    setFormBanner(null)
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly) return
    setFormBanner(null)
    setFieldErrors({})

    if (issueForm && usesIssueFlow) {
      if (!runIssueValidation() || !selectedIssue) return
      setSaving(true)
      try {
        if (mode === 'create') {
          if (issueForm.convention_id === '' || issueForm.issue_id === '') return
          await createHrRequestFromIssueForm({
            title: issueForm.title.trim(),
            convention_id: issueForm.convention_id,
            issue_id: issueForm.issue_id,
            date: issueForm.date,
            status: issueForm.status,
            details: issueForm.details.trim() || null,
            region_ids: issueForm.region_ids,
            department_ids: showFederalDepartments ? issueForm.department_ids : [],
            indicator_responses: buildIndicatorPayload(selectedIssue, issueForm.indicatorValues),
            attachments: issueForm.attachmentFiles,
          })
        } else if (mode === 'edit' && detail) {
          await updateHrRequest(detail.id, {
            title: issueForm.title.trim(),
            convention_id:
              issueForm.convention_id === '' ? undefined : issueForm.convention_id,
            issue_id: issueForm.issue_id === '' ? undefined : issueForm.issue_id,
            region_ids: issueForm.region_ids,
            ...(showFederalDepartments ? { department_ids: issueForm.department_ids } : {}),
            date: issueForm.date,
            status: issueForm.status,
            details: issueForm.details.trim() || null,
            indicator_responses: buildIndicatorPayload(selectedIssue, issueForm.indicatorValues),
          })
        }
        onSaved()
        onClose()
      } catch (err) {
        if (isApiError(err)) {
          const fe: Record<string, string> = {}
          for (const [k, arr] of Object.entries(err.fieldErrors)) {
            if (arr[0]) fe[k] = arr[0]
          }
          setFieldErrors(fe)
          setFormBanner(
            Object.keys(fe).length > 0 ? 'Please correct the fields below.' : err.message,
          )
          return
        }
        setFormBanner(err instanceof Error ? err.message : 'Save failed')
      } finally {
        setSaving(false)
      }
      return
    }

    if (legacyForm) {
      if (!runLegacyValidation()) return
      setSaving(true)
      try {
        if (mode === 'edit' && detail) {
          await updateHrRequest(detail.id, {
            title: legacyForm.title.trim(),
            conv: legacyForm.conv.trim(),
            region_id: legacyForm.region_id === '' ? null : Number(legacyForm.region_id),
            date: legacyForm.date,
            status: legacyForm.status,
            details: legacyForm.details.trim() || null,
          })
        }
        onSaved()
        onClose()
      } catch (err) {
        if (isApiError(err)) {
          const fe: Record<string, string> = {}
          for (const [k, arr] of Object.entries(err.fieldErrors)) {
            if (arr[0]) fe[k] = arr[0]
          }
          setFieldErrors(fe)
          setFormBanner(
            Object.keys(fe).length > 0 ? 'Please correct the fields below.' : err.message,
          )
          return
        }
        setFormBanner(err instanceof Error ? err.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    }
  }

  const showLoading = mode !== 'create' && detailLoading
  const showMissing = mode !== 'create' && !detailLoading && !detail

  const requestIdHint =
    mode === 'create' ? 'Assigned automatically on save (REQ-YYYY-####).' : detail?.id ?? '—'

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          title={
            mode === 'create'
              ? 'New request'
              : mode === 'edit'
                ? 'Edit HR request'
                : 'HR request'
          }
          onClose={onClose}
        />

        {showLoading && <p className="muted pad-modal">Loading…</p>}
        {showMissing && (
          <div className="pad-modal">
            <Alert variant="error" title="Could not load request">
              {detailError ?? 'The request may have been removed or you may not have access.'}
            </Alert>
          </div>
        )}

        {!showLoading && !showMissing && issueForm && usesIssueFlow && (
          <form className="modal-form" onSubmit={handleSubmit} noValidate>
            {formBanner && (
              <Alert variant="error" onDismiss={() => setFormBanner(null)}>
                {formBanner}
              </Alert>
            )}
            {(catalogLoading || issuesLoading) && (
              <p className="muted">Loading reference data…</p>
            )}
            <FormGrid>
              <FormField label="Request ID" htmlFor="hr-req-id">
                <input id="hr-req-id" value={requestIdHint} readOnly disabled />
              </FormField>

              <FormField label="Title" htmlFor="hr-title">
                <input
                  id="hr-title"
                  value={issueForm.title}
                  onChange={(e) =>
                    setIssueForm((f) => (f ? { ...f, title: e.target.value } : f))
                  }
                  disabled={readOnly}
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby={fieldErrors.title ? 'hr-title-err' : undefined}
                />
                <FieldError id="hr-title-err" message={fieldErrors.title} />
              </FormField>

              <FormField label="Convention" htmlFor="hr-conv">
                <select
                  id="hr-conv"
                  value={issueForm.convention_id === '' ? '' : String(issueForm.convention_id)}
                  onChange={(e) => {
                    const v = e.target.value === '' ? '' : Number(e.target.value)
                    setIssueForm((f) =>
                      f
                        ? {
                            ...f,
                            convention_id: v === '' ? '' : v,
                            issue_id: '',
                            indicatorValues: {},
                          }
                        : f,
                    )
                  }}
                  disabled={readOnly || mode !== 'create'}
                  aria-invalid={Boolean(fieldErrors.convention_id)}
                  aria-describedby={fieldErrors.convention_id ? 'hr-conv-err' : undefined}
                >
                  <option value="">Select convention</option>
                  {conventions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <FieldError id="hr-conv-err" message={fieldErrors.convention_id} />
              </FormField>

              <FormField label="Issue" htmlFor="hr-issue">
                <select
                  id="hr-issue"
                  value={issueForm.issue_id === '' ? '' : String(issueForm.issue_id)}
                  onChange={(e) => {
                    const v = e.target.value === '' ? '' : Number(e.target.value)
                    setIssueForm((f) =>
                      f
                        ? {
                            ...f,
                            issue_id: v === '' ? '' : v,
                          }
                        : f,
                    )
                  }}
                  disabled={readOnly || issueForm.convention_id === '' || issuesLoading}
                  aria-invalid={Boolean(fieldErrors.issue_id)}
                  aria-describedby={fieldErrors.issue_id ? 'hr-issue-err' : undefined}
                >
                  <option value="">
                    {issueForm.convention_id === '' ? 'Select a convention first' : 'Select issue'}
                  </option>
                  {issues.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.issue_title}
                    </option>
                  ))}
                </select>
                <FieldError id="hr-issue-err" message={fieldErrors.issue_id} />
              </FormField>

              {selectedIssue && (
                <FormRow className="mapping-preview">
                  <fieldset>
                    <legend>Issue mapping (read-only)</legend>
                    <p>
                      <strong>Category:</strong> {selectedIssue.category?.name ?? '—'}
                    </p>
                    <div>
                      <strong>Articles</strong>
                      {selectedIssue.articles.length === 0 ? (
                        <p className="muted">—</p>
                      ) : (
                        <ul className="mapping-indicators" style={{ listStyle: 'disc' }}>
                          {selectedIssue.articles.map((a) => (
                            <li key={a.id}>
                              <strong>{a.article_name}</strong>
                              {a.relevant_paragraph ? (
                                <p
                                  className="muted"
                                  style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}
                                >
                                  {a.relevant_paragraph}
                                </p>
                              ) : (
                                <p className="muted" style={{ margin: '4px 0 0' }}>
                                  <em>No relevant paragraph recorded.</em>
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <strong>Indicators (linked to this issue)</strong>
                      {selectedIssue.indicators.length === 0 ? (
                        <p className="muted">—</p>
                      ) : (
                        <ul className="mapping-indicators">
                          {selectedIssue.indicators.map((ind) => (
                            <li key={ind.id}>
                              <div>{ind.indicator_text}</div>
                              {ind.disaggregation && (
                                <div className="muted small">Disaggregation: {ind.disaggregation}</div>
                              )}
                              {(showQuantitative(selectedIssue) || showQualitative(selectedIssue)) && (
                                <div className="indicator-inputs">
                                  {showQuantitative(selectedIssue) && (
                                    <FormControl label="Quantitative" htmlFor={`hr-ind-q-${ind.id}`}>
                                      <input
                                        id={`hr-ind-q-${ind.id}`}
                                        type="number"
                                        step="any"
                                        value={issueForm.indicatorValues[ind.id]?.quantitative ?? ''}
                                        onChange={(e) =>
                                          setIssueForm((f) =>
                                            f
                                              ? {
                                                  ...f,
                                                  indicatorValues: {
                                                    ...f.indicatorValues,
                                                    [ind.id]: {
                                                      quantitative: e.target.value,
                                                      qualitative:
                                                        f.indicatorValues[ind.id]?.qualitative ?? '',
                                                    },
                                                  },
                                                }
                                              : f,
                                          )
                                        }
                                        disabled={readOnly}
                                      />
                                    </FormControl>
                                  )}
                                  {showQualitative(selectedIssue) && (
                                    <FormControl label="Qualitative" htmlFor={`hr-ind-l-${ind.id}`}>
                                      <input
                                        id={`hr-ind-l-${ind.id}`}
                                        type="text"
                                        value={issueForm.indicatorValues[ind.id]?.qualitative ?? ''}
                                        onChange={(e) =>
                                          setIssueForm((f) =>
                                            f
                                              ? {
                                                  ...f,
                                                  indicatorValues: {
                                                    ...f.indicatorValues,
                                                    [ind.id]: {
                                                      quantitative:
                                                        f.indicatorValues[ind.id]?.quantitative ?? '',
                                                      qualitative: e.target.value,
                                                    },
                                                  },
                                                }
                                              : f,
                                          )
                                        }
                                        disabled={readOnly}
                                      />
                                    </FormControl>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </fieldset>
                </FormRow>
              )}

              <FormField
                label="Regions (optional)"
                hint="Choose regions this request applies to. Your role may limit which regions you can select."
              >
                <div className="checkbox-grid" role="group" aria-label="Regions (optional)">
                  {assignableRegions.map((r) => (
                    <label key={r.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={issueForm.region_ids.includes(r.id)}
                        onChange={(e) =>
                          setIssueForm((f) => {
                            if (!f) return f
                            const on = e.target.checked
                            const next = on
                              ? [...f.region_ids, r.id]
                              : f.region_ids.filter((x) => x !== r.id)
                            return { ...f, region_ids: next }
                          })
                        }
                        disabled={readOnly || lockedRegionId != null}
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
                <FieldError id="hr-regions-err" message={fieldErrors.region_ids} />
              </FormField>

              {showFederalDepartments && federalDepts.length > 0 && (
                <FormField
                  label="Federal departments (optional)"
                  hint="Link national-line departments when coordinating this request at federal level."
                >
                  <div className="checkbox-grid" role="group" aria-label="Federal departments (optional)">
                    {federalDepts.map((d) => (
                      <label key={d.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={issueForm.department_ids.includes(d.id)}
                          onChange={(e) =>
                            setIssueForm((f) => {
                              if (!f) return f
                              const on = e.target.checked
                              const next = on
                                ? [...f.department_ids, d.id]
                                : f.department_ids.filter((x) => x !== d.id)
                              return { ...f, department_ids: next }
                            })
                          }
                          disabled={readOnly}
                        />
                        {d.name}
                      </label>
                    ))}
                  </div>
                </FormField>
              )}

              <FormRow twoCol>
                <FormControl label="Due date" htmlFor="hr-date">
                  <input
                    id="hr-date"
                    type="date"
                    value={issueForm.date}
                    onChange={(e) =>
                      setIssueForm((f) => (f ? { ...f, date: e.target.value } : f))
                    }
                    disabled={readOnly}
                    aria-invalid={Boolean(fieldErrors.date)}
                    aria-describedby={fieldErrors.date ? 'hr-date-err' : undefined}
                  />
                  <FieldError id="hr-date-err" message={fieldErrors.date} />
                </FormControl>
                <FormControl label="Status" htmlFor="hr-status">
                  <select
                    id="hr-status"
                    value={issueForm.status}
                    onChange={(e) =>
                      setIssueForm((f) =>
                        f ? { ...f, status: e.target.value as HrRequestStatus } : f,
                      )
                    }
                    disabled={readOnly}
                  >
                    {HR_REQUEST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FormControl>
              </FormRow>

              {mode === 'create' && !readOnly && (
                <FormField
                  label="Attachments"
                  htmlFor="hr-files"
                  hint="You can select multiple files (up to 15 MB each)."
                >
                  <input
                    id="hr-files"
                    type="file"
                    multiple
                    onChange={(e) =>
                      setIssueForm((f) =>
                        f
                          ? { ...f, attachmentFiles: Array.from(e.target.files ?? []) }
                          : f,
                      )
                    }
                  />
                </FormField>
              )}

              {detail?.attachments && detail.attachments.length > 0 && (
                <FormField label="Uploaded files">
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {detail.attachments.map((a) => (
                      <li key={a.id}>{a.original_name}</li>
                    ))}
                  </ul>
                </FormField>
              )}

              <FormField
                label="Request notes"
                htmlFor="hr-details"
                hint="Optional context for reviewers. Treaty wording for each article is shown in the mapping block above."
              >
                <textarea
                  id="hr-details"
                  rows={4}
                  value={issueForm.details}
                  onChange={(e) =>
                    setIssueForm((f) => (f ? { ...f, details: e.target.value } : f))
                  }
                  disabled={readOnly}
                />
              </FormField>
            </FormGrid>
            <ModalActions>
              <Button variant="secondary" compact type="button" onClick={onClose}>
                {readOnly ? 'Close' : 'Cancel'}
              </Button>
              {!readOnly && (
                <Button variant="primary" compact type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              )}
            </ModalActions>
          </form>
        )}

        {!showLoading && !showMissing && legacyForm && !usesIssueFlow && (
          <form className="modal-form" onSubmit={handleSubmit} noValidate>
            {formBanner && (
              <Alert variant="error" onDismiss={() => setFormBanner(null)}>
                {formBanner}
              </Alert>
            )}
            <p className="muted">
              This request uses the legacy format. Edit basic fields here, or recreate the request with
              the new convention and issue workflow.
            </p>
            <FormGrid>
              <FormField label="Request ID" htmlFor="hr-leg-id">
                <input id="hr-leg-id" value={detail?.id ?? ''} readOnly disabled />
              </FormField>
              <FormField label="Title" htmlFor="hr-leg-title">
                <input
                  id="hr-leg-title"
                  value={legacyForm.title}
                  onChange={(e) =>
                    setLegacyForm((f) => (f ? { ...f, title: e.target.value } : f))
                  }
                  disabled={readOnly}
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby={fieldErrors.title ? 'hr-leg-title-err' : undefined}
                />
                <FieldError id="hr-leg-title-err" message={fieldErrors.title} />
              </FormField>
              <FormField label="Convention (code)" htmlFor="hr-leg-conv">
                <input
                  id="hr-leg-conv"
                  value={legacyForm.conv}
                  onChange={(e) =>
                    setLegacyForm((f) => (f ? { ...f, conv: e.target.value } : f))
                  }
                  disabled={readOnly}
                  aria-invalid={Boolean(fieldErrors.conv)}
                  aria-describedby={fieldErrors.conv ? 'hr-leg-conv-err' : undefined}
                />
                <FieldError id="hr-leg-conv-err" message={fieldErrors.conv} />
              </FormField>
              <FormField label="Region" htmlFor="hr-leg-region">
                <select
                  id="hr-leg-region"
                  value={legacyForm.region_id === '' ? '' : String(legacyForm.region_id)}
                  onChange={(e) =>
                    setLegacyForm((f) =>
                      f
                        ? {
                            ...f,
                            region_id: e.target.value === '' ? '' : Number(e.target.value),
                          }
                        : f,
                    )
                  }
                  disabled={readOnly || lockedRegionId != null}
                  aria-invalid={Boolean(fieldErrors.region_id)}
                  aria-describedby={fieldErrors.region_id ? 'hr-leg-region-err' : undefined}
                >
                  <option value="">Select region</option>
                  {assignableRegions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <FieldError id="hr-leg-region-err" message={fieldErrors.region_id} />
              </FormField>
              <FormRow twoCol>
                <FormControl label="Due date" htmlFor="hr-leg-date">
                  <input
                    id="hr-leg-date"
                    type="date"
                    value={legacyForm.date}
                    onChange={(e) =>
                      setLegacyForm((f) => (f ? { ...f, date: e.target.value } : f))
                    }
                    disabled={readOnly}
                    aria-invalid={Boolean(fieldErrors.date)}
                    aria-describedby={fieldErrors.date ? 'hr-leg-date-err' : undefined}
                  />
                  <FieldError id="hr-leg-date-err" message={fieldErrors.date} />
                </FormControl>
                <FormControl label="Status" htmlFor="hr-leg-status">
                  <select
                    id="hr-leg-status"
                    value={legacyForm.status}
                    onChange={(e) =>
                      setLegacyForm((f) =>
                        f ? { ...f, status: e.target.value as HrRequestStatus } : f,
                      )
                    }
                    disabled={readOnly}
                  >
                    {HR_REQUEST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FormControl>
              </FormRow>
              <FormField label="Details" htmlFor="hr-leg-details">
                <textarea
                  id="hr-leg-details"
                  rows={4}
                  value={legacyForm.details}
                  onChange={(e) =>
                    setLegacyForm((f) => (f ? { ...f, details: e.target.value } : f))
                  }
                  disabled={readOnly}
                />
              </FormField>
            </FormGrid>
            <ModalActions>
              <Button variant="secondary" compact type="button" onClick={onClose}>
                {readOnly ? 'Close' : 'Cancel'}
              </Button>
              {!readOnly && (
                <Button variant="primary" compact type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              )}
            </ModalActions>
          </form>
        )}

      </div>
    </div>
  )
}
