import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { isApiError } from '../api/apiError'
import {
  createHrRequestFromIssueForm,
  fetchHrRequestFormFederalDepartments,
  fetchHrRequestFormIssues,
  fetchHrRequestFormConventions,
  updateHrRequest,
  type FederalDepartmentOption,
  type HrRequestIndicatorResponseInput,
  type KnowledgeConventionRow,
} from '../api/hrRequests'
import type { RegionRow } from '../api/regions'
import { useAuth } from '../auth/AuthContext'
import { isDepartmentAdmin, isViewer } from '../lib/roles'
import { HR_REQUEST_STATUSES, HR_REQUEST_STATUS_LABELS } from '../data/hrRequestFormLookups'
import type { HrRequestIssueDetail, HrRequestRow, HrRequestStatus } from '../types/hrRequest'
import { HrRequestViewTemplate } from './HrRequestViewTemplate'
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

/** ICT replaced the former “federal” region; accept legacy slug until data is migrated. */
function isIctRegionSlug(slug: string | undefined): boolean {
  return slug === 'ict' || slug === 'federal'
}

/** Matches Super Admin → Issues & mapping: `ICCPR — International Covenant on…`. */
function conventionOptionLabel(c: { code?: string | null; name?: string | null }): string {
  const code = (c.code ?? '').trim()
  const name = (c.name ?? '').trim()
  if (code && name) return `${code} — ${name}`
  if (name) return name
  if (code) return code
  return 'Convention'
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
  /** Indicators included in this request (subset of the issue’s indicators). */
  selectedIndicatorIds: number[]
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
    status: 'draft',
    details: '',
    selectedIndicatorIds: [],
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
  const selectedIndicatorIds = [
    ...new Set((row.indicator_responses ?? []).map((r) => r.issue_indicator_id)),
  ]
  return {
    title: row.title,
    convention_id: row.convention_id ?? '',
    issue_id: row.issue_id ?? '',
    region_ids,
    department_ids: row.departments?.map((d) => d.id) ?? [],
    date: row.date,
    status: row.status,
    details: row.details ?? '',
    selectedIndicatorIds,
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

function hasExplicitIndicatorTypeFlags(ind: HrRequestIssueDetail['indicators'][number]): boolean {
  return (
    ind.has_quantitative === true ||
    ind.has_quantitative === false ||
    ind.has_qualitative === true ||
    ind.has_qualitative === false
  )
}

function indicatorAllowsQuantitative(
  ind: HrRequestIssueDetail['indicators'][number],
  issue: HrRequestIssueDetail,
): boolean {
  if (!hasExplicitIndicatorTypeFlags(ind)) return issue.has_quantitative
  if (ind.has_quantitative || ind.has_qualitative) return Boolean(ind.has_quantitative)
  return issue.has_quantitative
}

function indicatorAllowsQualitative(
  ind: HrRequestIssueDetail['indicators'][number],
  issue: HrRequestIssueDetail,
): boolean {
  if (!hasExplicitIndicatorTypeFlags(ind)) return issue.has_qualitative
  if (ind.has_quantitative || ind.has_qualitative) return Boolean(ind.has_qualitative)
  return issue.has_qualitative
}

function buildIndicatorPayload(
  issue: HrRequestIssueDetail,
  values: IndicatorValues,
  selectedIds: number[],
): HrRequestIndicatorResponseInput[] {
  const selected = new Set(selectedIds)
  const out: HrRequestIndicatorResponseInput[] = []
  for (const ind of issue.indicators) {
    if (!selected.has(ind.id)) continue
    const v = values[ind.id] ?? { quantitative: '', qualitative: '' }
    const qRaw = v.quantitative.trim()
    const lRaw = v.qualitative.trim()
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
  /** Inline full-width layout (no overlay) for `/requests/:id` */
  layout?: 'modal' | 'page'
  /** When `layout` is `page`, label for the read-only close/back button */
  pageCloseLabel?: string
  /**
   * Department portal: when set (including null), the view template shows regional assignment notes here
   * instead of the federal request description. Omit for federal/regional admin viewers.
   */
  departmentPortalRegionalNotes?: string | null
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
  layout = 'modal',
  pageCloseLabel,
  departmentPortalRegionalNotes,
}: HrRequestModalProps) {
  const { user: authUser } = useAuth()
  const portalDeptViewer = Boolean(
    authUser &&
      (isDepartmentAdmin(authUser) || isViewer(authUser)) &&
      authUser.department != null,
  )

  const assignableRegions = useMemo(() => {
    const base = regions.filter((r) => r.slug !== 'federal')
    if (lockedRegionId == null) return base
    if (base.some((r) => r.id === lockedRegionId)) return base
    const mine = regions.find((r) => r.id === lockedRegionId)
    return mine ? [mine, ...base] : base
  }, [regions, lockedRegionId])

  const ictRegionIdSet = useMemo(() => {
    const s = new Set<number>()
    for (const r of regions) {
      if (isIctRegionSlug(r.slug)) s.add(r.id)
    }
    return s
  }, [regions])

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

  /** Full list for the convention `<select>`, including `detail.convention` when the catalog fetch hasn’t merged yet (edit/view). */
  const conventionChoices = useMemo((): KnowledgeConventionRow[] => {
    const byId = new Map<number, KnowledgeConventionRow>()
    for (const c of conventions) {
      byId.set(c.id, c)
    }
    const conv = detail?.convention
    if (conv && typeof conv.id === 'number' && !byId.has(conv.id)) {
      byId.set(conv.id, { id: conv.id, code: conv.code, name: conv.name })
    }
    return Array.from(byId.values()).sort((a, b) =>
      (a.code || a.name || '').localeCompare(b.code || b.name || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    )
  }, [conventions, detail?.convention])

  const readOnly = mode === 'view' || !canManage
  const hideRegionsInRegionalView = readOnly && lockedRegionId != null
  const readOnlyCloseLabel =
    layout === 'page' && pageCloseLabel ? pageCloseLabel : readOnly ? 'Close' : 'Cancel'

  const ictAmongSelected = useMemo(() => {
    if (!issueForm) return false
    return issueForm.region_ids.some((id) => ictRegionIdSet.has(id))
  }, [issueForm?.region_ids, ictRegionIdSet])

  const selectedRegionIdsKey = issueForm?.region_ids.join(',') ?? ''

  const loadIssues = useCallback(async (conventionId: number, fallback: HrRequestIssueDetail[] = []) => {
    setIssuesLoading(true)
    try {
      const rows = await fetchHrRequestFormIssues(conventionId)
      setIssues(rows)
    } catch {
      setIssues(fallback)
      if (fallback.length === 0) {
        setFormBanner('Could not load issues for this convention.')
      }
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
          const hasEmbeddedIssue = Boolean(detail.issue)
          const skipIssuesFetch = mode === 'view' && hasEmbeddedIssue
          if (!skipIssuesFetch) {
            void loadIssues(cid, hasEmbeddedIssue && detail.issue ? [detail.issue] : [])
          }
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
    if (mode !== 'create') return
    let cancelled = false
    setCatalogLoading(true)
    void (async () => {
      try {
        const convRows = await fetchHrRequestFormConventions()
        if (!cancelled) {
          setConventions(convRows)
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
  }, [mode])

  useEffect(() => {
    if (mode === 'create') return
    if (!detail?.convention_id) return
    let cancelled = false
    void fetchHrRequestFormConventions()
      .then((rows) => {
        if (!cancelled) setConventions(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mode, detail?.id, detail?.convention_id])

  useEffect(() => {
    if (readOnly || !issueForm) {
      setFederalDepts([])
      return
    }
    if (!ictAmongSelected) {
      setFederalDepts([])
      return
    }
    let cancelled = false
    void fetchHrRequestFormFederalDepartments()
      .then((rows) => {
        if (!cancelled) setFederalDepts(rows)
      })
      .catch(() => {
        if (!cancelled) setFederalDepts([])
      })
    return () => {
      cancelled = true
    }
  }, [readOnly, ictAmongSelected, selectedRegionIdsKey])

  useEffect(() => {
    if (!issueForm || readOnly) return
    if (!ictAmongSelected && issueForm.department_ids.length > 0) {
      setIssueForm((f) => (f ? { ...f, department_ids: [] } : f))
    }
  }, [ictAmongSelected, readOnly, issueForm?.department_ids.length])

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

  /** Options for Issue `<select>`; always include embedded `detail.issue` when it matches the saved id. */
  const issueOptions = useMemo(() => {
    const list = [...issues]
    const embedded = detail?.issue
    if (
      embedded &&
      issueForm &&
      issueForm.issue_id !== '' &&
      issueForm.issue_id === embedded.id &&
      !list.some((i) => i.id === embedded.id)
    ) {
      list.push(embedded)
    }
    return list
  }, [issues, detail?.issue, issueForm?.issue_id])

  const selectedIssue = useMemo(() => {
    if (!issueForm || issueForm.issue_id === '') return null
    return (
      issues.find((i) => i.id === issueForm.issue_id) ??
      (detail?.issue?.id === issueForm.issue_id ? detail.issue : null) ??
      null
    )
  }, [issueForm, issues, detail?.issue])

  const selectedIctDepartmentsText = useMemo(() => {
    if (!issueForm || federalDepts.length === 0) return 'Select ICT departments'
    const picked = federalDepts.filter((d) => issueForm.department_ids.includes(d.id))
    if (picked.length === 0) return 'Select ICT departments'
    if (picked.length <= 2) return picked.map((d) => d.name).join(', ')
    return `${picked.length} departments selected`
  }, [issueForm?.department_ids, federalDepts])

  const selectedRegions = useMemo(() => {
    if (!issueForm) return []
    const byId = new Map(assignableRegions.map((r) => [r.id, r.name]))
    return issueForm.region_ids.map((id) => byId.get(id) ?? `Region ${id}`)
  }, [issueForm?.region_ids, assignableRegions])

  /** In read-only view, only list indicators included on this request (federal selection). */
  const indicatorsForMappingUi = useMemo(() => {
    if (!selectedIssue) return []
    if (readOnly) {
      const picked = new Set(issueForm?.selectedIndicatorIds ?? [])
      return selectedIssue.indicators.filter((ind) => picked.has(ind.id))
    }
    return selectedIssue.indicators
  }, [selectedIssue, readOnly, issueForm?.selectedIndicatorIds])

  const conventionDisplayLabel = useMemo(() => {
    if (detail?.convention) return conventionOptionLabel(detail.convention)
    if (issueForm?.convention_id !== '' && issueForm?.convention_id !== undefined) {
      const c = conventions.find((x) => x.id === issueForm.convention_id)
      if (c) return conventionOptionLabel(c)
    }
    return '—'
  }, [detail?.convention, issueForm?.convention_id, conventions])

  /** Regional / department portals: show only the viewer's region in the hero. */
  const viewTemplateRegionNames = useMemo(() => {
    if (lockedRegionId != null) {
      const nm =
        assignableRegions.find((r) => r.id === lockedRegionId)?.name ?? authUser?.region?.name ?? null
      if (nm) return [nm]
    }
    if (portalDeptViewer && authUser?.region?.name) {
      return [authUser.region.name]
    }
    return selectedRegions
  }, [
    lockedRegionId,
    assignableRegions,
    selectedRegions,
    portalDeptViewer,
    authUser?.region?.name,
  ])

  const viewTemplateShowAssigneeMeta = lockedRegionId == null && !portalDeptViewer

  function runIssueValidation(): boolean {
    if (!issueForm) return false
    const fe: Record<string, string> = {}
    if (!issueForm.title.trim()) fe.title = 'Title is required.'
    if (issueForm.convention_id === '') fe.convention_id = 'Convention is required.'
    if (issueForm.issue_id === '') fe.issue_id = 'Issue is required.'
    if (!issueForm.date) fe.date = 'Due date is required.'
    if (
      selectedIssue &&
      selectedIssue.indicators.length > 0 &&
      issueForm.selectedIndicatorIds.length === 0
    ) {
      fe.indicator_ids = 'Select at least one indicator for this issue.'
    }
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
      const ictInPayload = issueForm.region_ids.some((id) => ictRegionIdSet.has(id))
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
            department_ids: ictInPayload ? issueForm.department_ids : [],
            indicator_responses: buildIndicatorPayload(
              selectedIssue,
              issueForm.indicatorValues,
              issueForm.selectedIndicatorIds,
            ),
            attachments: issueForm.attachmentFiles,
          })
        } else if (mode === 'edit' && detail) {
          await updateHrRequest(detail.id, {
            title: issueForm.title.trim(),
            convention_id:
              issueForm.convention_id === '' ? undefined : issueForm.convention_id,
            issue_id: issueForm.issue_id === '' ? undefined : issueForm.issue_id,
            region_ids: issueForm.region_ids,
            department_ids: ictInPayload ? issueForm.department_ids : [],
            date: issueForm.date,
            status: issueForm.status,
            details: issueForm.details.trim() || null,
            indicator_responses: buildIndicatorPayload(
              selectedIssue,
              issueForm.indicatorValues,
              issueForm.selectedIndicatorIds,
            ),
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

  const card = (
      <div
        className={`modal-card modal-card-wide${layout === 'page' ? ' hr-request-modal--page' : ''}`}
        onClick={layout === 'modal' ? (e) => e.stopPropagation() : undefined}
      >
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

        {!showLoading && !showMissing && issueForm && usesIssueFlow && mode === 'view' && (
          <>
            <div className="modal-form hr-request-view-template-modal">
              {formBanner && (
                <Alert variant="error" onDismiss={() => setFormBanner(null)}>
                  {formBanner}
                </Alert>
              )}
              {(catalogLoading || issuesLoading) && (
                <p className="muted">Loading reference data…</p>
              )}
              {selectedIssue ? (
                <HrRequestViewTemplate
                  requestId={detail?.id ?? requestIdHint}
                  title={issueForm.title}
                  status={issueForm.status}
                  dueDate={issueForm.date}
                  regionNames={viewTemplateRegionNames}
                  showMetaAssigneeRow={viewTemplateShowAssigneeMeta}
                  conventionLabel={conventionDisplayLabel}
                  issueTitle={selectedIssue.issue_title}
                  categoryName={selectedIssue.category?.name ?? '—'}
                  issueDescription={selectedIssue.description ?? null}
                  description={issueForm.details}
                  regionalInstructionsOnly={departmentPortalRegionalNotes !== undefined}
                  regionalInstructionsText={
                    departmentPortalRegionalNotes !== undefined ? departmentPortalRegionalNotes : null
                  }
                  articles={selectedIssue.articles}
                  indicators={indicatorsForMappingUi.map((ind) => {
                    const resp = detail?.indicator_responses?.find(
                      (r) => r.issue_indicator_id === ind.id,
                    )
                    return {
                      id: ind.id,
                      indicator_text: ind.indicator_text,
                      disaggregation: ind.disaggregation,
                      hasQuantitative: indicatorAllowsQuantitative(ind, selectedIssue),
                      hasQualitative: indicatorAllowsQualitative(ind, selectedIssue),
                      quantitative_value: resp?.quantitative_value,
                      qualitative_text: resp?.qualitative_text,
                    }
                  })}
                  attachments={detail?.attachments}
                />
              ) : (
                <Alert variant="error" title="Missing issue data">
                  <span>Issue metadata could not be loaded for this request.</span>
                </Alert>
              )}
            </div>
            {!(layout === 'page' && mode === 'view') && (
              <ModalActions>
                <Button variant="secondary" compact type="button" onClick={onClose}>
                  {readOnlyCloseLabel}
                </Button>
              </ModalActions>
            )}
          </>
        )}

        {!showLoading && !showMissing && issueForm && usesIssueFlow && mode !== 'view' && (
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
                            selectedIndicatorIds: [],
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
                  {conventionChoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {conventionOptionLabel(c)}
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
                            selectedIndicatorIds: [],
                          }
                        : f,
                    )
                  }}
                  disabled={
                    readOnly || issueForm.convention_id === '' || (!readOnly && issuesLoading)
                  }
                  aria-invalid={Boolean(fieldErrors.issue_id)}
                  aria-describedby={fieldErrors.issue_id ? 'hr-issue-err' : undefined}
                >
                  <option value="">
                    {issueForm.convention_id === '' ? 'Select a convention first' : 'Select issue'}
                  </option>
                  {issueOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.issue_title}
                    </option>
                  ))}
                </select>
                <FieldError id="hr-issue-err" message={fieldErrors.issue_id} />
              </FormField>

              {readOnly && (
                <FormField label="Request description" htmlFor="hr-details-summary">
                  {issueForm.details?.trim() ? (
                    <div
                      id="hr-details-summary"
                      className="hr-request-readonly-prose"
                      tabIndex={0}
                      role="region"
                      aria-label="Request description"
                    >
                      {issueForm.details}
                    </div>
                  ) : (
                    <p className="muted" id="hr-details-summary" style={{ margin: 0 }}>
                      No additional description was provided for this request.
                    </p>
                  )}
                </FormField>
              )}

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
                        <ul className="mapping-indicators mapping-article-list">
                          {selectedIssue.articles.map((a) => (
                            <li key={a.id}>
                              {a.article_name}
                              {a.relevant_paragraph ? (
                                <p
                                  className="muted"
                                  style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}
                                >
                                  {a.relevant_paragraph}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <strong>Indicators for this request</strong>
                      <FieldError id="hr-ind-sel-err" message={fieldErrors.indicator_ids} />
                      {indicatorsForMappingUi.length === 0 ? (
                        <p className="muted">—</p>
                      ) : (
                        <ul className="mapping-indicators" style={{ listStyle: 'none', paddingLeft: 0 }}>
                          {indicatorsForMappingUi.map((ind) => {
                            const checked = issueForm.selectedIndicatorIds.includes(ind.id)
                            const allowQ = indicatorAllowsQuantitative(ind, selectedIssue)
                            const allowL = indicatorAllowsQualitative(ind, selectedIssue)
                            const typeHint = [
                              allowQ ? 'Quantitative' : null,
                              allowL ? 'Qualitative' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                            return (
                              <li key={ind.id} style={{ marginBottom: 12 }}>
                                <label className="checkbox-label" style={{ alignItems: 'flex-start' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={readOnly}
                                    onChange={(e) => {
                                      const on = e.target.checked
                                      setIssueForm((f) => {
                                        if (!f) return f
                                        const set = new Set(f.selectedIndicatorIds)
                                        if (on) set.add(ind.id)
                                        else set.delete(ind.id)
                                        const nextVals = { ...f.indicatorValues }
                                        if (!on) {
                                          nextVals[ind.id] = { quantitative: '', qualitative: '' }
                                        }
                                        return {
                                          ...f,
                                          selectedIndicatorIds: [...set].sort((a, b) => a - b),
                                          indicatorValues: nextVals,
                                        }
                                      })
                                    }}
                                  />
                                  <span>
                                    <span style={{ fontWeight: 600 }}>{ind.indicator_text}</span>
                                    {typeHint ? (
                                      <span className="muted small" style={{ marginLeft: 8 }}>
                                        ({typeHint})
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                                {ind.disaggregation && (
                                  <div className="muted small" style={{ marginLeft: 28 }}>
                                    Disaggregation: {ind.disaggregation}
                                  </div>
                                )}
                                {checked &&
                                  readOnly &&
                                  (() => {
                                    const resp = detail?.indicator_responses?.find(
                                      (r) => r.issue_indicator_id === ind.id,
                                    )
                                    if (
                                      !resp ||
                                      (resp.quantitative_value == null &&
                                        !(resp.qualitative_text && resp.qualitative_text.trim()))
                                    ) {
                                      return null
                                    }
                                    return (
                                      <div className="muted small" style={{ marginLeft: 28, marginTop: 8 }}>
                                        {resp.quantitative_value != null &&
                                        !Number.isNaN(resp.quantitative_value) ? (
                                          <div>Quantitative: {resp.quantitative_value}</div>
                                        ) : null}
                                        {resp.qualitative_text?.trim() ? (
                                          <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                                            Qualitative: {resp.qualitative_text}
                                          </div>
                                        ) : null}
                                      </div>
                                    )
                                  })()}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </fieldset>
                </FormRow>
              )}

              {!hideRegionsInRegionalView && (
                <FormField
                  label="Regions (optional)"
                  hint={
                    readOnly
                      ? undefined
                      : 'Include ICT when this request applies at national level. ICT national-line departments can be linked after ICT is selected.'
                  }
                >
                  {readOnly ? (
                    selectedRegions.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {selectedRegions.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted" style={{ margin: 0 }}>
                        —
                      </p>
                    )
                  ) : (
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
                                const ictStill = next.some((id) => ictRegionIdSet.has(id))
                                return {
                                  ...f,
                                  region_ids: next,
                                  department_ids: ictStill ? f.department_ids : [],
                                }
                              })
                            }
                            disabled={readOnly || lockedRegionId != null}
                          />
                          {r.name}
                        </label>
                      ))}
                    </div>
                  )}
                  <FieldError id="hr-regions-err" message={fieldErrors.region_ids} />
                </FormField>
              )}

              {readOnly && (detail?.departments?.length ?? 0) > 0 && (
                <FormField label="ICT departments">
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {detail!.departments!.map((d) => (
                      <li key={d.id}>
                        {d.name} ({d.code})
                      </li>
                    ))}
                  </ul>
                </FormField>
              )}

              {!readOnly && ictAmongSelected && federalDepts.length > 0 && (
                <FormField
                  label="ICT departments (optional)"
                  hint="Select one or more national-line departments for this request."
                >
                  <details className="hr-request-ict-dept-dropdown">
                    <summary>{selectedIctDepartmentsText}</summary>
                    <div
                      className="hr-request-ict-dept-dropdown__menu"
                      role="group"
                      aria-label="ICT departments (optional)"
                    >
                      {federalDepts.map((d) => (
                        <label key={d.id} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={issueForm.department_ids.includes(d.id)}
                            onChange={(e) => {
                              const on = e.target.checked
                              setIssueForm((f) => {
                                if (!f) return f
                                const next = on
                                  ? [...f.department_ids, d.id]
                                  : f.department_ids.filter((x) => x !== d.id)
                                return { ...f, department_ids: next }
                              })
                            }}
                          />
                          <span>
                            {d.name} <span className="muted small">({d.code})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
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
                <FormControl label="Request status" htmlFor="hr-status">
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
                        {HR_REQUEST_STATUS_LABELS[s]}
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

              {!readOnly && (
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
              )}
            </FormGrid>
            <ModalActions>
              <Button variant="secondary" compact type="button" onClick={onClose}>
                {readOnlyCloseLabel}
              </Button>
              {!readOnly && (
                <Button variant="primary" compact type="submit" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit'}
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
                {hideRegionsInRegionalView && readOnly ? (
                  <input
                    id="hr-leg-region"
                    value={
                      legacyForm.region_id === ''
                        ? '—'
                        : assignableRegions.find((r) => r.id === legacyForm.region_id)?.name ?? '—'
                    }
                    readOnly
                    disabled
                  />
                ) : (
                  <>
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
                  </>
                )}
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
                <FormControl label="Request status" htmlFor="hr-leg-status">
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
                        {HR_REQUEST_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </FormControl>
              </FormRow>
              <FormField label="Details" htmlFor="hr-leg-details">
                {readOnly ? (
                  legacyForm.details?.trim() ? (
                    <div id="hr-leg-details" className="hr-request-readonly-prose" tabIndex={0}>
                      {legacyForm.details}
                    </div>
                  ) : (
                    <p className="muted" id="hr-leg-details" style={{ margin: 0 }}>
                      —
                    </p>
                  )
                ) : (
                  <textarea
                    id="hr-leg-details"
                    rows={4}
                    value={legacyForm.details}
                    onChange={(e) =>
                      setLegacyForm((f) => (f ? { ...f, details: e.target.value } : f))
                    }
                  />
                )}
              </FormField>
            </FormGrid>
            {!(layout === 'page' && mode === 'view') && (
              <ModalActions>
                <Button variant="secondary" compact type="button" onClick={onClose}>
                  {readOnlyCloseLabel}
                </Button>
                {!readOnly && (
                  <Button variant="primary" compact type="submit" disabled={saving}>
                    {saving ? 'Submitting…' : 'Submit'}
                  </Button>
                )}
              </ModalActions>
            )}
          </form>
        )}

      </div>
  )

  if (layout === 'page') {
    return card
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      {card}
    </div>
  )
}
