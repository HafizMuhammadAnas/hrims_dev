import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchHrRequest } from '../api/hrRequests'
import {
  CLARIFICATION_STATUS_LABELS,
  fetchActiveClarificationForRequest,
  submitClarificationRequest,
  type HrRequestClarificationRow,
} from '../api/clarifications'
import {
  fetchDepartmentTasks,
  fetchRegionalResponses,
  type DepartmentTaskRow,
  type RegionalResponseRow,
} from '../api/lists'
import { fetchRegions } from '../api/regions'
import {
  createDepartmentTask,
  fetchDepartments,
  submitDepartmentTaskResponse,
  updateDepartmentTaskReview,
  type DepartmentRow,
} from '../api/workflows'
import { useAuth } from '../auth/AuthContext'
import { canManageHrRequests, hrRequestLockedRegionId } from '../auth/rbac'
import { CompiledRecordsWorkflowNav, isFromCompiledRecordsPath } from '../components/CompiledRecordsWorkflowNav'
import { isFederalRequestManagementView } from '../lib/workflowNavigation'
import { formatAppDate, formatAppDateTime } from '../lib/dateFormat'
import { regionalResponseReviewPresentation } from '../lib/regionalResponseReviewStatus'
import { DepartmentIndicatorDisaggregationMatrices } from '../components/DepartmentIndicatorDisaggregationMatrices'
import {
  DepartmentIndicatorSupplementaryFields,
  emptyDeptIndicatorDraft,
  type DeptIndicatorDraft,
} from '../components/DepartmentIndicatorSupplementaryFields'
import { DepartmentResponseDisplay } from '../components/DepartmentResponseDisplay'
import { fetchDistricts, type DistrictRow } from '../api/districts'
import { fetchCollectionReligions, type CollectionReligionRow } from '../api/collectionReligions'
import {
  deptFormUsesIndicatorMatrix,
  forEachIndicatorMatrixCell,
  indicatorUsesDataMatrix,
  matrixCellKey,
} from '../lib/indicatorMatrixColumns'
import {
  AGE_OVER_18,
  AGE_UNDER_18,
  DISABILITY_NO,
  DISABILITY_YES,
  fixedKeyMatrixCellKey,
  forEachCatalogMatrixCell,
  forEachFixedKeyMatrixCell,
  forEachReligionMatrixCell,
  indicatorIsYearOnly,
  indicatorRequiresQuantitativeMatrixPayload,
} from '../lib/indicatorDisaggregation'
import { scopeLocationCatalogToRegions } from '../lib/departmentLocationCatalog'
import { loadYearKeyedValuesFromBundle, matrixCellInputReady, matrixCellNumericValue } from '../lib/departmentMatrixLoaders'
import { HrRequestModal } from '../components/HrRequestModal'
import { HrRequestViewTemplate } from '../components/HrRequestViewTemplate'
import { Alert } from '../components/ui/Alert'
import { buildDepartmentForwardedViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'
import { ClarificationThreadCard } from '../components/ClarificationThreadCard'
import { PendingFileAttachmentRow } from '../components/PendingFileAttachmentRow'
import { Button } from '../components/ui/Button'
import { PageSection } from '../components/ui/PageSection'
import { StatusBadge } from '../components/ui/StatusBadge'
import { WorkflowActionFootback, type WorkflowActionFeedback } from '../components/WorkflowActionFootback'
import { WorkflowModalHero } from '../components/ui/WorkflowModalHero'
import { parseDepartmentTaskResponseData } from '../lib/departmentTaskResponseFormat'
import {
  canDepartmentSubmitResponse,
  departmentTaskWorkflowBucket,
  hasDepartmentResponse,
  workflowPresentation,
} from '../lib/departmentTaskWorkflow'
import { loiMetadataLoadErrorPageMessage } from '../lib/issueEntryKind'
import { isDepartmentAdmin, isFederalAdmin, isRegionalAdmin, isViewer } from '../lib/roles'
import { indicatorsScopedToRequest } from '../lib/hrRequestIndicatorScope'
import { reviewFeedbackLabelForTask } from '../lib/ictRegion'
import type { AuthUser } from '../types/auth'
import type { HrRequestRow } from '../types/hrRequest'
import type { RegionRow } from '../api/regions'

function pageBackLabel(from: string): string {
  if (from === '/' || from === '') return 'Back to dashboard'
  if (from.includes('region-received')) return 'Back to received requests'
  if (from.includes('federal-department-requests')) return 'Back to departmental responses'
  if (from.includes('region-monitoring')) return 'Back to departmental responses'
  if (from.includes('federal-compilation') || from.includes('region-compilation')) {
    return 'Back to response compilation'
  }
  if (from.includes('department-tasks')) return 'Back to assigned tasks'
  if (from.includes('department-history')) return 'Back to submission history'
  if (from.includes('compiled-records')) return 'Back to compiled records'
  return 'Back to requests list'
}

function userMayReviewDepartmentTask(user: AuthUser | null, t: DepartmentTaskRow): boolean {
  if (!user) return false
  if (isFederalAdmin(user)) return true
  if (isRegionalAdmin(user) && user.region && user.region.id === t.region_id) return true
  return false
}

function loadYearGenderValuesFromBundle(
  byYearGender: Record<string, Record<string, { value?: number }>> | null | undefined,
): Record<string, string> {
  return loadYearKeyedValuesFromBundle(
    byYearGender as import('../lib/departmentTaskResponseFormat').DepartmentQuantitativeByYearKeyed | null | undefined,
    true,
  )
}

function matrixValueReady(values: Record<string, string>, key: string): boolean {
  return matrixCellInputReady(values[key])
}

export function HrRequestViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') ?? '/requests'
  const taskIdFromUrl = searchParams.get('task')
  const fromRegionReceived = from.includes('region-received')
  const fromRequestManagementView = isFederalRequestManagementView(from)

  const { user } = useAuth()
  const canManage = canManageHrRequests(user)
  const lockedRegionId = hrRequestLockedRegionId(user)
  const regionalUser = isRegionalAdmin(user)
  const deptUser =
    (isDepartmentAdmin(user) || isViewer(user)) && user?.department != null

  const [regions, setRegions] = useState<RegionRow[]>([])
  const [districts, setDistricts] = useState<DistrictRow[]>([])
  const [religions, setReligions] = useState<CollectionReligionRow[]>([])
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
  const [activeClarification, setActiveClarification] = useState<HrRequestClarificationRow | null>(null)
  const [clarificationLoading, setClarificationLoading] = useState(false)
  const [regionalPathChoice, setRegionalPathChoice] = useState<'assign' | 'clarification' | null>(null)
  const [clarMessage, setClarMessage] = useState('')
  const [clarFile, setClarFile] = useState<File | null>(null)
  const [clarSubmitting, setClarSubmitting] = useState(false)
  const [clarError, setClarError] = useState<string | null>(null)

  const [responseText, setResponseText] = useState('')
  const [responseFile, setResponseFile] = useState<File | null>(null)
  /** Resubmit: remove stored legacy attachment without replacing it. */
  const [legacyAttachmentClear, setLegacyAttachmentClear] = useState(false)
  /** Bumps remount file inputs after clearing a chosen file (same file can be picked again). */
  const [deptFileInputRev, setDeptFileInputRev] = useState<Record<string, number>>({})
  const [indicatorDrafts, setIndicatorDrafts] = useState<Record<number, DeptIndicatorDraft>>({})
  const [submittingResponse, setSubmittingResponse] = useState(false)
  const [submitResponseError, setSubmitResponseError] = useState<string | null>(null)
  const [deptPortalTab, setDeptPortalTab] = useState<'response' | 'request'>('response')
  const [reviewComments, setReviewComments] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState<WorkflowActionFeedback | null>(null)
  const [savingReview, setSavingReview] = useState(false)

  function bumpDeptFileInput(key: string) {
    setDeptFileInputRev((r) => ({ ...r, [key]: (r[key] ?? 0) + 1 }))
  }

  const reloadTasksAndDepartments = useCallback(async () => {
    const [deptRows, taskRows] = await Promise.all([fetchDepartments(), fetchDepartmentTasks()])
    setDepartments(deptRows)
    setTasks(taskRows)
  }, [])

  useEffect(() => {
    if (regionalUser || deptUser || taskIdFromUrl) {
      void reloadTasksAndDepartments().catch(() => {})
    }
  }, [regionalUser, deptUser, taskIdFromUrl, reloadTasksAndDepartments])

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
    if (!detail?.id || fromRequestManagementView) {
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
  }, [detail?.id, fromRequestManagementView])

  const reloadClarification = useCallback(async () => {
    if (!detail?.id || !regionalUser || !fromRegionReceived) {
      setActiveClarification(null)
      return
    }
    setClarificationLoading(true)
    try {
      const row = await fetchActiveClarificationForRequest(detail.id)
      setActiveClarification(row)
    } catch {
      setActiveClarification(null)
    } finally {
      setClarificationLoading(false)
    }
  }, [detail?.id, regionalUser, fromRegionReceived])

  useEffect(() => {
    void reloadClarification()
  }, [reloadClarification])

  useEffect(() => {
    setRegionalPathChoice(null)
    setClarMessage('')
    setClarFile(null)
    setClarError(null)
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

  const deptLocationRegionIds = useMemo(() => {
    const ids: number[] = []
    if (activeTask?.region_id) ids.push(activeTask.region_id)
    else if (deptUser && user?.region?.id) ids.push(user.region.id)
    return ids
  }, [activeTask?.region_id, deptUser, user?.region?.id])

  const deptLocationCatalog = useMemo(() => {
    return scopeLocationCatalogToRegions(regions, districts, deptLocationRegionIds)
  }, [regions, districts, deptLocationRegionIds])

  useEffect(() => {
    let cancelled = false
    const regionId = deptLocationRegionIds[0]
    void Promise.all([
      fetchRegions(),
      regionId ? fetchDistricts(regionId) : fetchDistricts(),
      fetchCollectionReligions(),
    ])
      .then(([regionRows, districtRows, religionRows]) => {
        if (!cancelled) {
          setRegions(regionRows)
          setDistricts(districtRows)
          setReligions(religionRows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegions([])
          setDistricts([])
          setReligions([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [deptLocationRegionIds])

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
        let yearGenderValues: Record<string, string> = {}
        let yearAgeValues: Record<string, string> = {}
        let yearDisabilityValues: Record<string, string> = {}
        let yearRegionValues: Record<string, string> = {}
        let yearDistrictValues: Record<string, string> = {}
        let yearReligionValues: Record<string, string> = {}
        if (parsed.kind === 'structured') {
          const b = parsed.payload.by_indicator[String(ind.id)]
          if (b?.quantitative?.by_year_gender) {
            yearGenderValues = loadYearGenderValuesFromBundle(b.quantitative.by_year_gender)
          } else if (b?.quantitative && b.quantitative.value != null && !Number.isNaN(b.quantitative.value)) {
            value = String(b.quantitative.value)
          }
          if (b?.quantitative?.by_year_age) {
            yearAgeValues = loadYearKeyedValuesFromBundle(b.quantitative.by_year_age, false)
          }
          if (b?.quantitative?.by_year_disability) {
            yearDisabilityValues = loadYearKeyedValuesFromBundle(b.quantitative.by_year_disability, false)
          }
          if (b?.quantitative?.by_year_region) {
            yearRegionValues = loadYearKeyedValuesFromBundle(b.quantitative.by_year_region, true)
          }
          if (b?.quantitative?.by_year_district) {
            yearDistrictValues = loadYearKeyedValuesFromBundle(b.quantitative.by_year_district, true)
          }
          if (b?.quantitative?.by_year_religion) {
            yearReligionValues = loadYearKeyedValuesFromBundle(b.quantitative.by_year_religion, true)
          }
          if (b?.quantitative?.comment) comment = b.quantitative.comment
          if (b?.qualitative?.text) qualText = b.qualitative.text
        }
        next[ind.id] = {
          ...emptyDeptIndicatorDraft(),
          value,
          comment,
          qualText,
          yearGenderValues,
          yearAgeValues,
          yearDisabilityValues,
          yearRegionValues,
          yearDistrictValues,
          yearReligionValues,
        }
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
      if (indicatorRequiresQuantitativeMatrixPayload(ind)) {
        if (indicatorIsYearOnly(ind) || ind.collects_by_gender) {
          let matrixReady = true
          forEachIndicatorMatrixCell(ind, (yearId, genderId) => {
            if (!matrixValueReady(d.yearGenderValues, matrixCellKey(yearId, genderId))) matrixReady = false
          })
          if (!matrixReady) return false
        }
        if (ind.collects_by_age) {
          let matrixReady = true
          forEachFixedKeyMatrixCell(ind, (i) => Boolean(i.collects_by_age), [AGE_UNDER_18, AGE_OVER_18], (yearId, key) => {
            if (!matrixValueReady(d.yearAgeValues, fixedKeyMatrixCellKey(yearId, key))) matrixReady = false
          })
          if (!matrixReady) return false
        }
        if (ind.collects_by_disability) {
          let matrixReady = true
          forEachFixedKeyMatrixCell(
            ind,
            (i) => Boolean(i.collects_by_disability),
            [DISABILITY_YES, DISABILITY_NO],
            (yearId, key) => {
              if (!matrixValueReady(d.yearDisabilityValues, fixedKeyMatrixCellKey(yearId, key))) matrixReady = false
            },
          )
          if (!matrixReady) return false
        }
        if (ind.collects_by_location) {
          let matrixReady = true
          const districtCatalog = deptLocationCatalog.districts.map((x) => ({ id: x.id, name: x.name }))
          forEachCatalogMatrixCell(
            ind,
            (i) => Boolean(i.collects_by_location),
            districtCatalog,
            (yearId, districtId) => {
              if (!matrixValueReady(d.yearDistrictValues, matrixCellKey(yearId, districtId))) matrixReady = false
            },
          )
          if (!matrixReady) return false
        }
        if (ind.collects_by_religion) {
          let matrixReady = true
          const religionCatalog = religions.map((r) => ({ id: r.id, name: r.name }))
          forEachReligionMatrixCell(ind, religionCatalog, (yearId, religionId) => {
            if (!matrixValueReady(d.yearReligionValues, matrixCellKey(yearId, religionId))) matrixReady = false
          })
          if (!matrixReady) return false
        }
      } else if (ind.has_quantitative) {
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
  }, [deptIndicatorsForForm, indicatorDrafts, activeTask, deptParsedTaskResponse, deptLocationCatalog, religions])

  const deptLegacySubmitReady = useMemo(() => {
    if (!activeTask) return false
    const trimmed = responseText.trim()
    const hadStored = Boolean(activeTask.attachment_url?.trim())
    return Boolean(trimmed || responseFile || (hadStored && !legacyAttachmentClear))
  }, [activeTask, responseText, responseFile, legacyAttachmentClear])

  const canRegionalProceed =
    Boolean(regionalUser && detail && tasksForRequest.length === 0 && regionDepartments.length > 0)

  const clarificationBlocksAssign = activeClarification?.status === 'pending_federal'

  const showRegionalPathChoice =
    fromRegionReceived &&
    canRegionalProceed &&
    !clarificationLoading &&
    !clarificationBlocksAssign &&
    regionalPathChoice === null

  const showRegionalAssign =
    canRegionalProceed &&
    !clarificationBlocksAssign &&
    (fromRegionReceived ? regionalPathChoice === 'assign' : true)

  const showRegionalClarificationForm =
    fromRegionReceived &&
    canRegionalProceed &&
    !clarificationBlocksAssign &&
    regionalPathChoice === 'clarification'

  async function submitClarification() {
    if (!detail) return
    const msg = clarMessage.trim()
    if (!msg) {
      setClarError('Describe what you need clarified.')
      return
    }
    setClarSubmitting(true)
    setClarError(null)
    try {
      const saved = await submitClarificationRequest(detail.id, msg, clarFile)
      setActiveClarification(saved)
      setRegionalPathChoice(null)
      setClarMessage('')
      setClarFile(null)
    } catch (e: unknown) {
      setClarError(e instanceof Error ? e.message : 'Could not submit clarification')
    } finally {
      setClarSubmitting(false)
    }
  }

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
      setRegionalPathChoice(null)
      await reloadTasksAndDepartments()
      await reloadClarification()
      if (fromRegionReceived) {
        navigate('/region-monitoring')
      }
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
            quantitative?: Record<string, unknown>
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
          if (indicatorRequiresQuantitativeMatrixPayload(ind)) {
            const quantitative: {
              comment: string
              by_year_gender?: Record<string, Record<string, { value: string }>>
              by_year_age?: Record<string, Record<string, { value: string }>>
              by_year_disability?: Record<string, Record<string, { value: string }>>
              by_year_region?: Record<string, Record<string, { value: string }>>
              by_year_district?: Record<string, Record<string, { value: string }>>
              by_year_religion?: Record<string, Record<string, { value: string }>>
            } = { comment: d.comment.trim() }

            if (indicatorIsYearOnly(ind) || ind.collects_by_gender) {
              const by_year_gender: Record<string, Record<string, { value: string }>> = {}
              forEachIndicatorMatrixCell(ind, (yearId, genderId) => {
                const yearKey = String(yearId)
                if (!by_year_gender[yearKey]) by_year_gender[yearKey] = {}
                by_year_gender[yearKey][String(genderId)] = {
                  value: matrixCellNumericValue(d.yearGenderValues[matrixCellKey(yearId, genderId)]),
                }
              })
              quantitative.by_year_gender = by_year_gender
            }

            if (ind.collects_by_age) {
              const by_year_age: Record<string, Record<string, { value: string }>> = {}
              forEachFixedKeyMatrixCell(
                ind,
                (i) => Boolean(i.collects_by_age),
                [AGE_UNDER_18, AGE_OVER_18],
                (yearId, key) => {
                  const yearKey = String(yearId)
                  if (!by_year_age[yearKey]) by_year_age[yearKey] = {}
                  by_year_age[yearKey][key] = {
                    value: matrixCellNumericValue(d.yearAgeValues[fixedKeyMatrixCellKey(yearId, key)]),
                  }
                },
              )
              quantitative.by_year_age = by_year_age
            }

            if (ind.collects_by_disability) {
              const by_year_disability: Record<string, Record<string, { value: string }>> = {}
              forEachFixedKeyMatrixCell(
                ind,
                (i) => Boolean(i.collects_by_disability),
                [DISABILITY_YES, DISABILITY_NO],
                (yearId, key) => {
                  const yearKey = String(yearId)
                  if (!by_year_disability[yearKey]) by_year_disability[yearKey] = {}
                  by_year_disability[yearKey][key] = {
                    value: matrixCellNumericValue(d.yearDisabilityValues[fixedKeyMatrixCellKey(yearId, key)]),
                  }
                },
              )
              quantitative.by_year_disability = by_year_disability
            }

            if (ind.collects_by_location) {
              const by_year_district: Record<string, Record<string, { value: string }>> = {}
              const districtCatalog = deptLocationCatalog.districts.map((x) => ({ id: x.id, name: x.name }))
              forEachCatalogMatrixCell(
                ind,
                (i) => Boolean(i.collects_by_location),
                districtCatalog,
                (yearId, districtId) => {
                  const yearKey = String(yearId)
                  if (!by_year_district[yearKey]) by_year_district[yearKey] = {}
                  by_year_district[yearKey][String(districtId)] = {
                    value: matrixCellNumericValue(d.yearDistrictValues[matrixCellKey(yearId, districtId)]),
                  }
                },
              )
              quantitative.by_year_district = by_year_district
            }

            if (ind.collects_by_religion) {
              const by_year_religion: Record<string, Record<string, { value: string }>> = {}
              const religionCatalog = religions.map((r) => ({ id: r.id, name: r.name }))
              forEachReligionMatrixCell(ind, religionCatalog, (yearId, religionId) => {
                const yearKey = String(yearId)
                if (!by_year_religion[yearKey]) by_year_religion[yearKey] = {}
                by_year_religion[yearKey][String(religionId)] = {
                  value: matrixCellNumericValue(d.yearReligionValues[matrixCellKey(yearId, religionId)]),
                }
              })
              quantitative.by_year_religion = by_year_religion
            }

            entry.quantitative = quantitative
            if (d.quantFile) quantFiles[ind.id] = d.quantFile
            if (d.clearSavedQuantAttachment) stripQuantIndicatorIds.push(ind.id)
          } else if (ind.has_quantitative) {
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
  const fromDepartmentTasks = from.includes('department-tasks')
  const fromDepartmentHistory = from.includes('department-history')
  const fromFederalDeptResponses = from.includes('federal-department-requests')
  const fromRegionalMonitoring = from.includes('region-monitoring')
  const fromFederalCompilation = from.includes('federal-compilation')
  const fromRegionalCompilation = from.includes('region-compilation')
  const fromResponseCompilation = fromFederalCompilation || fromRegionalCompilation
  const taskTabbedPageView = Boolean(
    taskIdFromUrl &&
      activeTask &&
      ((deptUser && (fromDepartmentTasks || fromDepartmentHistory)) ||
        (fromFederalDeptResponses && isFederalAdmin(user)) ||
        (fromRegionalMonitoring && userMayReviewDepartmentTask(user, activeTask)) ||
        (fromFederalCompilation && isFederalAdmin(user)) ||
        (fromRegionalCompilation && userMayReviewDepartmentTask(user, activeTask))),
  )
  const embeddedRequestPage = Boolean(
    fromRegionReceived || taskTabbedPageView || fromRequestManagementView,
  )
  const showRegionalContextCard = Boolean(
    detail && !detailLoading && !embeddedRequestPage && !deptUser && !fromRequestManagementView,
  )
  /** Pin footer to viewport bottom only on received-request workflow (long assign UI). */
  const stretchFooterToViewport = fromRegionReceived
  const monitorTaskReview = Boolean(
    taskTabbedPageView &&
      !deptUser &&
      activeTask &&
      userMayReviewDepartmentTask(user, activeTask) &&
      !fromResponseCompilation,
  )

  /** Region/federal task views and department “submitted” state — never edit the matrix here. */
  const showTaskSubmittedResponseReadonly = Boolean(
    taskTabbedPageView &&
      activeTask &&
      hasDepartmentResponse(activeTask) &&
      (showDeptResponseReadonly || !deptUser),
  )

  useEffect(() => {
    setDeptPortalTab('response')
  }, [activeTask?.id, taskIdFromUrl])

  useEffect(() => {
    setReviewComments(activeTask?.regional_review_comments ?? '')
    setReviewFeedback(null)
  }, [activeTask?.id, activeTask?.regional_review_comments])

  const deptRequestTemplateProps = useMemo(
    () => (detail && activeTask ? buildDepartmentForwardedViewTemplateProps(detail, activeTask) : null),
    [detail, activeTask],
  )

  const taskReviewFeedbackLabel = activeTask ? reviewFeedbackLabelForTask(activeTask) : 'Regional review'

  const departmentPortalAssignedNames = useMemo(() => {
    if (!deptUser) return null
    const fromTask = activeTask?.department_name?.trim()
    if (fromTask) return [fromTask]
    const mine = user?.department?.name?.trim()
    return mine ? [mine] : null
  }, [deptUser, activeTask?.department_name, user?.department?.name])

  const pageTitle = fromRegionReceived
    ? 'Received request'
    : (fromFederalDeptResponses || fromResponseCompilation) && activeTask
      ? 'Departmental response'
    : fromRegionalMonitoring && activeTask
      ? 'Departmental response'
    : fromDepartmentHistory && deptUser
      ? 'Submission history'
      : fromDepartmentTasks && deptUser
        ? 'Assigned task'
        : 'Request'

  const monitorReviewBucket = activeTask ? departmentTaskWorkflowBucket(activeTask) : null
  const showMonitorReviewActions = Boolean(
    monitorTaskReview &&
      activeTask &&
      hasDepartmentResponse(activeTask) &&
      monitorReviewBucket === 'responded',
  )
  const showMonitorReviewOutcome = Boolean(
    monitorTaskReview &&
      activeTask &&
      hasDepartmentResponse(activeTask) &&
      (monitorReviewBucket === 'accepted' || monitorReviewBucket === 'revision'),
  )

  async function submitMonitorReview(status: 'accepted' | 'needs-modification') {
    if (!activeTask) return
    if (status === 'needs-modification' && !reviewComments.trim()) {
      setReviewFeedback({
        kind: 'validation',
        message: 'Add a short note for the department when requesting changes.',
      })
      return
    }
    setSavingReview(true)
    setReviewFeedback(null)
    try {
      await updateDepartmentTaskReview(activeTask.id, {
        regional_review_status: status,
        regional_review_comments: reviewComments.trim() || null,
      })
      await reloadTasksAndDepartments()
    } catch (e: unknown) {
      setReviewFeedback({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Could not save review',
      })
    } finally {
      setSavingReview(false)
    }
  }

  const showCompiledWorkflowNav = isFromCompiledRecordsPath(from) && Boolean(id)

  const regionalWorkflowBelowTemplate: ReactNode =
    fromRegionReceived && detail && !detailLoading ? (
      <>
        {canRegionalProceed && clarificationBlocksAssign && activeClarification && (
          <>
            <p className="muted clarification-workflow-status-line">
              <StatusBadge tone="warning">{CLARIFICATION_STATUS_LABELS.pending_federal}</StatusBadge>
              <span>Your clarification was sent to federal. You can assign departments after they respond.</span>
            </p>
            <ClarificationThreadCard
              variant="region"
              title="Your clarification request"
              meta={
                activeClarification.region_submitted_at
                  ? `Submitted ${formatAppDateTime(activeClarification.region_submitted_at)}`
                  : null
              }
              message={activeClarification.region_message}
              attachments={(activeClarification.attachments ?? []).filter((a) => a.side === 'region')}
            />
          </>
        )}

        {canRegionalProceed &&
          activeClarification?.status === 'pending_region' &&
          activeClarification.federal_response && (
            <>
              <p className="muted clarification-workflow-status-line">
                <StatusBadge tone="success">{CLARIFICATION_STATUS_LABELS.pending_region}</StatusBadge>
                <span>Federal has responded. Review below, then assign departments or ask again.</span>
              </p>
              <ClarificationThreadCard
                variant="region"
                title="Your clarification request"
                meta={
                  activeClarification.region_submitted_at
                    ? `Submitted ${formatAppDateTime(activeClarification.region_submitted_at)}`
                    : null
                }
                message={activeClarification.region_message}
                attachments={(activeClarification.attachments ?? []).filter((a) => a.side === 'region')}
              />
              <ClarificationThreadCard
                variant="federal"
                title="Federal clarification response"
                meta={
                  activeClarification.federal_responded_at
                    ? `Responded ${formatAppDateTime(activeClarification.federal_responded_at)}`
                    : null
                }
                message={activeClarification.federal_response}
                attachments={(activeClarification.attachments ?? []).filter((a) => a.side === 'federal')}
              />
            </>
          )}

        {showRegionalPathChoice && (
          <section
            className="hr-request-view-template__card hr-request-regional-workflow-section hr-request-regional-path"
            aria-labelledby="regional-path-heading"
          >
            <h4 id="regional-path-heading" className="dashboard-panel-title" style={{ marginTop: 0, marginBottom: 12 }}>
              How would you like to proceed?
            </h4>
            <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
              Choose one path for this request. You can distribute work to departments or ask federal for clarification
              first.
            </p>
            <div className="hr-request-regional-path__actions">
              <Button variant="primary" compact onClick={() => setRegionalPathChoice('assign')}>
                Assign to departments
              </Button>
              <Button variant="secondary" compact onClick={() => setRegionalPathChoice('clarification')}>
                Need further clarification
              </Button>
            </div>
          </section>
        )}

        {showRegionalClarificationForm && (
          <section className="hr-request-view-template__card hr-request-regional-workflow-section">
            <h4 className="dashboard-panel-title" style={{ marginTop: 0, marginBottom: 12 }}>
              Request clarification from federal
            </h4>
            <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
              Describe what you need clarified before assigning departments.
            </p>
            <Button variant="link" compact type="button" onClick={() => setRegionalPathChoice(null)}>
              ← Choose a different path
            </Button>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label htmlFor="reg-clarification-message">Your question</label>
              <textarea
                id="reg-clarification-message"
                rows={6}
                value={clarMessage}
                onChange={(e) => setClarMessage(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label htmlFor="reg-clarification-file">Attachment (optional)</label>
              <input
                id="reg-clarification-file"
                type="file"
                onChange={(e) => {
                  setClarFile(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </div>
            {clarFile && <PendingFileAttachmentRow file={clarFile} onRemove={() => setClarFile(null)} />}
            {clarError && <p className="login-error" style={{ marginTop: 12 }}>{clarError}</p>}
            <div style={{ marginTop: 16 }}>
              <Button
                variant="primary"
                compact
                disabled={clarSubmitting || !clarMessage.trim()}
                onClick={() => void submitClarification()}
              >
                {clarSubmitting ? 'Submitting…' : 'Submit clarification request'}
              </Button>
            </div>
          </section>
        )}

        {showRegionalAssign && (
          <section className="hr-request-view-template__card hr-request-regional-workflow-section">
            <Button variant="link" compact type="button" onClick={() => setRegionalPathChoice(null)}>
              ← Choose a different path
            </Button>
            <h4 className="dashboard-panel-title" style={{ marginTop: 0, marginBottom: 12 }}>
              Assign to departments ({user?.region?.name ?? 'your region'})
            </h4>
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
          </section>
        )}

        {regionalUser && tasksForRequest.length === 0 && regionDepartments.length === 0 && (
          <p className="muted" style={{ margin: '8px 0 0' }}>
            No departments are mapped to your region. Add departments under <strong>Manage departments</strong> before
            assigning tasks.
          </p>
        )}
      </>
    ) : null

  return (
    <PageSection title={pageTitle}>
      <div
        className={
          stretchFooterToViewport
            ? 'hr-request-view-stack hr-request-view-stack--embedded-footer'
            : taskTabbedPageView
              ? 'hr-request-view-stack hr-request-view-stack--tabbed-page'
              : 'hr-request-view-stack hr-request-view-stack--request-page'
        }
      >
        {showCompiledWorkflowNav && id ? (
          <CompiledRecordsWorkflowNav reqId={id} activeTab="request" />
        ) : null}

        {taskTabbedPageView && activeTask ? (
          <div className="modal-card modal-card-wide hr-request-dept-portal-tabs hr-request-modal--page workflow-tabbed-card">
            <WorkflowModalHero
              embedded
              eyebrow="Department task"
              title={String(activeTask.department_name ?? activeTask.department_id)}
            >
              <StatusBadge tone={workflowPresentation(activeTask).tone}>
                {workflowPresentation(activeTask).label}
              </StatusBadge>
              <span className="workflow-modal-hero__chip">Task {activeTask.id}</span>
              <span className="workflow-modal-hero__chip">{activeTask.req_id}</span>
            </WorkflowModalHero>
            <nav
              className="compiled-record-modal-tabs dept-task-response-modal__tabs"
              aria-label="Request and response"
            >
              <button
                type="button"
                className={
                  'compiled-record-modal-tab' +
                  (deptPortalTab === 'response' ? ' compiled-record-modal-tab--active' : '')
                }
                onClick={() => setDeptPortalTab('response')}
              >
                Response
              </button>
              <button
                type="button"
                className={
                  'compiled-record-modal-tab' +
                  (deptPortalTab === 'request' ? ' compiled-record-modal-tab--active' : '')
                }
                onClick={() => setDeptPortalTab('request')}
              >
                Request
              </button>
            </nav>
            <div className="modal-form dept-task-response-modal__body hr-request-dept-portal-tabs__body">
              {deptPortalTab === 'response' ? (
                <div className="dept-task-response-modal__panel hr-request-view-panel hr-request-dept-portal-tabs__panel">
                  {showTaskSubmittedResponseReadonly ? (
                    <>
                      {activeTask.submission_date ? (
                        <p className="muted small" style={{ margin: '0 0 12px' }}>
                          Submitted {formatAppDate(activeTask.submission_date)}
                        </p>
                      ) : null}
                      {activeTask.regional_review_comments?.trim() ? (
                        <p className="muted small" style={{ margin: '0 0 12px' }}>
                          <strong>{taskReviewFeedbackLabel}:</strong> {activeTask.regional_review_comments}
                        </p>
                      ) : null}
                      <DepartmentResponseDisplay
                        responseData={activeTask.response_data}
                        attachmentUrl={activeTask.attachment_url}
                        onlyIndicatorIds={deptResponseDisplayScopeIds}
                        issueIndicators={detail?.issue?.indicators}
                        locationRegionIds={[activeTask.region_id]}
                      />
                      {showMonitorReviewActions ? (
                        <div style={{ marginTop: 20 }}>
                          <div className="form-row">
                            <label htmlFor="monitor-review-comments">
                              Notes to department (required for modification)
                            </label>
                            <textarea
                              id="monitor-review-comments"
                              rows={4}
                              value={reviewComments}
                              onChange={(e) => {
                                setReviewComments(e.target.value)
                                if (reviewFeedback) setReviewFeedback(null)
                              }}
                              style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                          <WorkflowActionFootback
                            feedback={reviewFeedback}
                            onDismiss={() => setReviewFeedback(null)}
                            className="workflow-action-footback workflow-monitor-review-actions"
                            style={{ marginTop: 12 }}
                          >
                            <Button
                              variant="primary"
                              compact
                              disabled={savingReview}
                              onClick={() => {
                                setReviewFeedback(null)
                                void submitMonitorReview('accepted')
                              }}
                            >
                              {savingReview ? 'Saving…' : 'Accept'}
                            </Button>
                            <Button
                              variant="secondary"
                              compact
                              disabled={savingReview}
                              onClick={() => void submitMonitorReview('needs-modification')}
                            >
                              Request modification
                            </Button>
                          </WorkflowActionFootback>
                        </div>
                      ) : null}
                      {showMonitorReviewOutcome ? (
                        <Alert
                          variant={monitorReviewBucket === 'accepted' ? 'success' : 'warning'}
                          title={monitorReviewBucket === 'accepted' ? 'Submission accepted' : 'Resubmission requested'}
                          className="hr-request-dept-portal-tabs__review-outcome"
                        >
                          <p style={{ margin: 0 }}>
                            {monitorReviewBucket === 'accepted'
                              ? 'This response has already been accepted.'
                              : 'The department must submit an updated response before further review.'}
                          </p>
                        </Alert>
                      ) : null}
                    </>
                  ) : !showDeptResponseForm ? (
                    <p className="muted" style={{ margin: 0 }}>
                      No response content is available for this task yet.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {deptPortalTab === 'request' ? (
                <div className="dept-task-response-modal__panel hr-request-dept-portal-tabs__panel">
                  {detailLoading ? <p className="muted">Loading request…</p> : null}
                  {detailError && !detailLoading ? (
                    <Alert variant="error" title="Could not load request">
                      {detailError}
                    </Alert>
                  ) : null}
                  {!detailLoading && !detailError && deptRequestTemplateProps ? (
                    <div className="hr-request-view-template-modal dept-task-response-modal__request-template">
                      <HrRequestViewTemplate {...deptRequestTemplateProps} />
                    </div>
                  ) : null}
                  {!detailLoading && !detailError && detail && !deptRequestTemplateProps ? (
                    <Alert variant="warning" title="Request preview unavailable">
                      <span>{loiMetadataLoadErrorPageMessage()}</span>
                    </Alert>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!taskTabbedPageView ? (
          <HrRequestModal
            layout="page"
            mode="view"
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            regions={regions}
            canManage={canManage}
            lockedRegionId={lockedRegionId}
            hidePageHeader={embeddedRequestPage}
            pageCloseLabel={backLabel}
            onClose={() => navigate(from)}
            onSaved={() => navigate(from)}
            departmentPortalRegionalNotes={
              deptUser ? (activeTask?.assignment_instructions ?? null) : undefined
            }
            departmentPortalAssignedDepartmentNames={departmentPortalAssignedNames}
            pageViewBelowTemplate={regionalWorkflowBelowTemplate}
            pageViewActions={
              embeddedRequestPage ? undefined : (
                <Button variant="secondary" compact type="button" onClick={() => navigate(from)}>
                  {backLabel}
                </Button>
              )
            }
          />
        ) : null}

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
                      <StatusBadge tone={regionalResponseReviewPresentation(r.review_status).tone}>
                        {regionalResponseReviewPresentation(r.review_status).label}
                      </StatusBadge>
                    </div>
                    <p className="muted small" style={{ margin: '8px 0 10px' }}>
                      Submitted {formatAppDate(r.submission_date)}
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

        {showDeptResponseForm && activeTask && (!taskTabbedPageView || deptPortalTab === 'response') && (
          <div
            className={
              taskTabbedPageView
                ? 'hr-request-view-panel hr-request-dept-portal-tabs__form-attach'
                : 'hr-request-view-panel'
            }
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <h3 className="dashboard-panel-title" style={{ margin: 0 }}>
                Your response — task {activeTask.id}
              </h3>
              <StatusBadge tone={workflowPresentation(activeTask).tone}>
                {workflowPresentation(activeTask).label}
              </StatusBadge>
            </div>
            {activeTask.regional_review_comments?.trim() &&
            departmentTaskWorkflowBucket(activeTask) === 'revision' ? (
              <Alert
                variant="warning"
                title={`${taskReviewFeedbackLabel} — revision requested`}
                className="dept-task-revision-feedback"
              >
                <p className="dept-task-revision-feedback__lead">
                  Update your response using the feedback below, then submit again.
                </p>
                <div className="dept-task-revision-feedback__content">
                  {activeTask.regional_review_comments.trim()}
                </div>
              </Alert>
            ) : null}
            {deptIndicatorsForForm.length > 0 ? (
              <>
                <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
                  Complete each indicator required for this request. Use the data tables for year-based and
                  disaggregated breakdowns where configured; add comments, narrative responses, and attachments
                  as needed.
                </p>
                {deptFormUsesIndicatorMatrix(deptIndicatorsForForm) ? (
                  <DepartmentIndicatorDisaggregationMatrices
                    indicators={deptIndicatorsForForm}
                    districts={deptLocationCatalog.districts}
                    religions={religions}
                    genderValues={Object.fromEntries(
                      deptIndicatorsForForm.map((ind) => [
                        ind.id,
                        indicatorDrafts[ind.id]?.yearGenderValues ?? {},
                      ]),
                    )}
                    ageValues={Object.fromEntries(
                      deptIndicatorsForForm.map((ind) => [
                        ind.id,
                        indicatorDrafts[ind.id]?.yearAgeValues ?? {},
                      ]),
                    )}
                    disabilityValues={Object.fromEntries(
                      deptIndicatorsForForm.map((ind) => [
                        ind.id,
                        indicatorDrafts[ind.id]?.yearDisabilityValues ?? {},
                      ]),
                    )}
                    districtValues={Object.fromEntries(
                      deptIndicatorsForForm.map((ind) => [
                        ind.id,
                        indicatorDrafts[ind.id]?.yearDistrictValues ?? {},
                      ]),
                    )}
                    religionValues={Object.fromEntries(
                      deptIndicatorsForForm.map((ind) => [
                        ind.id,
                        indicatorDrafts[ind.id]?.yearReligionValues ?? {},
                      ]),
                    )}
                    onGenderChange={(indicatorId, yearId, columnId, value) => {
                      const key =
                        typeof columnId === 'string'
                          ? `${yearId}-${columnId}`
                          : matrixCellKey(yearId, columnId)
                      setIndicatorDrafts((prev) => {
                        const cur = prev[indicatorId] ?? emptyDeptIndicatorDraft()
                        return {
                          ...prev,
                          [indicatorId]: {
                            ...cur,
                            yearGenderValues: { ...cur.yearGenderValues, [key]: value },
                          },
                        }
                      })
                    }}
                    onAgeChange={(indicatorId, yearId, columnId, value) => {
                      const key = fixedKeyMatrixCellKey(yearId, String(columnId))
                      setIndicatorDrafts((prev) => {
                        const cur = prev[indicatorId] ?? emptyDeptIndicatorDraft()
                        return {
                          ...prev,
                          [indicatorId]: {
                            ...cur,
                            yearAgeValues: { ...cur.yearAgeValues, [key]: value },
                          },
                        }
                      })
                    }}
                    onDisabilityChange={(indicatorId, yearId, columnId, value) => {
                      const key = fixedKeyMatrixCellKey(yearId, String(columnId))
                      setIndicatorDrafts((prev) => {
                        const cur = prev[indicatorId] ?? emptyDeptIndicatorDraft()
                        return {
                          ...prev,
                          [indicatorId]: {
                            ...cur,
                            yearDisabilityValues: { ...cur.yearDisabilityValues, [key]: value },
                          },
                        }
                      })
                    }}
                    onDistrictChange={(indicatorId, yearId, columnId, value) => {
                      const key = matrixCellKey(yearId, Number(columnId))
                      setIndicatorDrafts((prev) => {
                        const cur = prev[indicatorId] ?? emptyDeptIndicatorDraft()
                        return {
                          ...prev,
                          [indicatorId]: {
                            ...cur,
                            yearDistrictValues: { ...cur.yearDistrictValues, [key]: value },
                          },
                        }
                      })
                    }}
                    onReligionChange={(indicatorId, yearId, columnId, value) => {
                      const key = matrixCellKey(yearId, Number(columnId))
                      setIndicatorDrafts((prev) => {
                        const cur = prev[indicatorId] ?? emptyDeptIndicatorDraft()
                        return {
                          ...prev,
                          [indicatorId]: {
                            ...cur,
                            yearReligionValues: { ...cur.yearReligionValues, [key]: value },
                          },
                        }
                      })
                    }}
                  />
                ) : null}
                <h4 className="font-semibold text-compact" style={{ margin: '16px 0 10px' }}>
                  {deptFormUsesIndicatorMatrix(deptIndicatorsForForm)
                    ? 'Comments, narrative responses, and attachments'
                    : 'Indicator responses'}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {deptIndicatorsForForm.map((ind) => {
                    const d = indicatorDrafts[ind.id] ?? emptyDeptIndicatorDraft()
                    const usesMatrix = indicatorUsesDataMatrix(ind)
                    if (!ind.has_quantitative && !ind.has_qualitative) return null
                    const typeBits = [
                      ind.has_quantitative ? 'Quantitative' : null,
                      ind.has_qualitative ? 'Qualitative' : null,
                    ].filter(Boolean) as string[]
                    return (
                      <div
                        key={ind.id}
                        className="dept-indicator-response-card"
                        style={{
                          padding: 14,
                          border: '1px solid var(--field-border, #e1e7f5)',
                          borderRadius: 10,
                          background: 'var(--field-bg, #fafbfd)',
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                          <strong className="text-sm font-semibold">{ind.indicator_text}</strong>
                          {typeBits.map((t) => (
                            <span key={t} className="dept-data-matrix-block__type-pill">
                              {t}
                            </span>
                          ))}
                        </div>
                        <DepartmentIndicatorSupplementaryFields
                          indicator={ind}
                          draft={d}
                          parsed={deptParsedTaskResponse}
                          matrixMode={usesMatrix}
                          fileInputRev={deptFileInputRev}
                          onBumpFileInput={bumpDeptFileInput}
                          onChange={(next) =>
                            setIndicatorDrafts((prev) => ({ ...prev, [ind.id]: next }))
                          }
                        />
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

        {showDeptResponseReadonly && activeTask && !taskTabbedPageView && (
          <div className="hr-request-view-panel">
            <h3 className="dashboard-panel-title" style={{ marginTop: 0, marginBottom: 12 }}>
              Your submitted response — task {activeTask.id}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <StatusBadge tone={workflowPresentation(activeTask).tone}>
                {workflowPresentation(activeTask).label}
              </StatusBadge>
              {activeTask.submission_date ? (
                <span className="muted small">Submitted {formatAppDate(activeTask.submission_date)}</span>
              ) : null}
            </div>
            {activeTask.regional_review_comments?.trim() ? (
              <p className="muted small" style={{ margin: '0 0 12px' }}>
                <strong>{taskReviewFeedbackLabel}:</strong> {activeTask.regional_review_comments}
              </p>
            ) : null}
            <label className="muted small" style={{ display: 'block', marginBottom: 6 }}>
              Response
            </label>
            <DepartmentResponseDisplay
              responseData={activeTask.response_data}
              attachmentUrl={activeTask.attachment_url}
              onlyIndicatorIds={deptResponseDisplayScopeIds}
              issueIndicators={detail?.issue?.indicators}
              locationRegionIds={[activeTask.region_id]}
            />
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

        {showRegionalAssign && !fromRegionReceived && (
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

        {regionalUser &&
          !fromRegionReceived &&
          detail &&
          !detailLoading &&
          tasksForRequest.length === 0 &&
          regionDepartments.length === 0 && (
            <p className="muted hr-request-view-footnote">
              No departments are mapped to your region. Add departments under <strong>Manage departments</strong>{' '}
              before assigning tasks.
            </p>
          )}

        {embeddedRequestPage ? (
          <div className="hr-request-view-footback hr-request-view-footback--actions">
            {fromDepartmentTasks && !fromDepartmentHistory && (
              <Button variant="secondary" compact type="button" onClick={() => navigate('/department-history')}>
                Open submission history
              </Button>
            )}
            <Button variant="secondary" compact type="button" onClick={() => navigate(from)}>
              {backLabel}
            </Button>
          </div>
        ) : (
          <div className="hr-request-view-footback" style={{ marginTop: 20 }}>
            <Button variant="secondary" compact type="button" onClick={() => navigate(from)}>
              {backLabel}
            </Button>
          </div>
        )}
      </div>
    </PageSection>
  )
}
