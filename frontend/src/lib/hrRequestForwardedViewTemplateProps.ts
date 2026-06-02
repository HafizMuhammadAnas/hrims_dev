import type { DepartmentTaskRow } from '../api/lists'
import { coerceIssueEntryKind } from './issueEntryKind'
import type { HrRequestIssueDetail } from '../types/hrRequest'
import type { HrRequestRow } from '../types/hrRequest'
import type { HrRequestViewIndicatorRow } from '../components/HrRequestViewTemplate'
import { indicatorYearGenderLines } from './indicatorCollectionDisplay'

/** Matches Super Admin → Issues & mapping label style. */
function conventionOptionLabel(c: { code?: string | null; name?: string | null }): string {
  const code = (c.code ?? '').trim()
  const name = (c.name ?? '').trim()
  if (code && name) return `${code} — ${name}`
  if (name) return name
  if (code) return code
  return 'Convention'
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

/**
 * Region line shown to the department (single province) — same rule as department portal hero.
 */
export function regionNamesForDepartmentForwardedView(detail: HrRequestRow, task: DepartmentTaskRow): string[] {
  const fromTask = task.region_name?.trim()
  if (fromTask) return [fromTask]
  const fromDetail = detail.regions?.find((r) => r.id === task.region_id)?.name?.trim()
  if (fromDetail) return [fromDetail]
  if (detail.regions?.length) return detail.regions.map((r) => r.name)
  return []
}

/**
 * Props for `HrRequestViewTemplate` matching what departments see when a region assigns them a task
 * (regional instructions instead of federal description; scoped indicators; third meta row hidden).
 */
export function buildDepartmentForwardedViewTemplateProps(
  detail: HrRequestRow,
  task: DepartmentTaskRow,
): {
  requestId: string
  title: string
  status: HrRequestRow['status']
  dueDate: string
  regionNames: string[]
  showMetaAssigneeRow: boolean
  ictDepartmentNames: string[] | null
  assignedDepartmentNames: string[] | null
  conventionLabel: string
  issueTitle: string
  issueEntryKind: ReturnType<typeof coerceIssueEntryKind>
  categoryName: string
  issueDescription: string | null
  description: string
  regionalInstructionsOnly: boolean
  regionalInstructionsText: string | null
  /** Overrides the instructions block heading when `regionalInstructionsOnly` is true. */
  instructionsHeading?: string | null
  articles: HrRequestIssueDetail['articles']
  indicators: HrRequestViewIndicatorRow[]
  attachments: HrRequestRow['attachments']
} | null {
  if (!detail.convention_id || !detail.issue_id || !detail.issue) return null

  const selectedIssue = detail.issue
  const selectedIds = new Set((detail.indicator_responses ?? []).map((r) => r.issue_indicator_id))
  const indicatorsForView = selectedIssue.indicators.filter((ind) => selectedIds.has(ind.id))

  const conventionLabel = detail.convention
    ? conventionOptionLabel(detail.convention)
    : '—'

  const indicators: HrRequestViewIndicatorRow[] = indicatorsForView.map((ind) => {
    const resp = detail.indicator_responses?.find((r) => r.issue_indicator_id === ind.id)
    return {
      id: ind.id,
      indicator_text: ind.indicator_text,
      disaggregation: ind.disaggregation,
      hasQuantitative: indicatorAllowsQuantitative(ind, selectedIssue),
      hasQualitative: indicatorAllowsQualitative(ind, selectedIssue),
      collectionByYear: indicatorYearGenderLines(ind),
      quantitative_value: resp?.quantitative_value,
      qualitative_text: resp?.qualitative_text,
    }
  })

  const ictTask = isIctDepartmentTask(detail, task)
  const assignedDepartmentNames = ictTask ? assignedDepartmentNamesForTask(detail, task) : null
  const assignmentNotes = task.assignment_instructions?.trim() ?? ''
  const useRegionalInstructions = !ictTask || Boolean(assignmentNotes)

  return {
    requestId: detail.id,
    title: detail.title,
    status: detail.status,
    dueDate: detail.date,
    regionNames: ictTask ? [] : regionNamesForDepartmentForwardedView(detail, task),
    showMetaAssigneeRow: false,
    ictDepartmentNames: null,
    assignedDepartmentNames: assignedDepartmentNames?.length ? assignedDepartmentNames : null,
    conventionLabel,
    issueTitle: selectedIssue.issue_title,
    issueEntryKind: coerceIssueEntryKind(selectedIssue.entry_kind),
    categoryName: selectedIssue.category?.name ?? '—',
    issueDescription: selectedIssue.description?.trim() ? selectedIssue.description.trim() : null,
    description: detail.details ?? '',
    regionalInstructionsOnly: useRegionalInstructions,
    regionalInstructionsText: useRegionalInstructions ? assignmentNotes || null : null,
    instructionsHeading: ictTask && assignmentNotes ? 'Federal assignment instructions' : null,
    articles: selectedIssue.articles,
    indicators,
    attachments: detail.attachments,
  }
}

export function isIctRegionSlug(slug: string | undefined): boolean {
  return slug === 'ict' || slug === 'federal'
}

/** True when the task is on the ICT / federal national line (direct department distribution). */
export function isIctDepartmentTask(detail: HrRequestRow, task: DepartmentTaskRow): boolean {
  if (isIctRegionSlug(task.region_slug ?? undefined)) return true
  const rn = task.region_name?.trim()
  if (rn && /^ict$/i.test(rn)) return true
  const fromDetail = detail.regions?.find((r) => r.id === task.region_id)
  if (fromDetail && isIctRegionSlug(fromDetail.slug)) return true
  return false
}

function assignedDepartmentNamesForTask(detail: HrRequestRow, task: DepartmentTaskRow): string[] {
  const fromTask = task.department_name?.trim()
  if (fromTask) return [fromTask]
  const fromDetail = (detail.departments ?? []).map((d) => d.name).filter(Boolean)
  return fromDetail
}

/** Region names as on the federal HR request (all targeted regions). */
export function regionNamesForFederalOriginalView(detail: HrRequestRow): string[] {
  if (detail.regions?.length) return detail.regions.map((r) => r.name)
  if (detail.region?.name) return [detail.region.name]
  if (detail.region_name) return [detail.region_name]
  return []
}

/** True when the request targets ICT / federal national line. */
export function requestHasIctRegion(detail: HrRequestRow): boolean {
  if (detail.regions?.some((r) => isIctRegionSlug(r.slug))) return true
  if (detail.region && isIctRegionSlug(detail.region.slug)) return true
  return false
}

/** National-line department names when ICT is on the request; otherwise null (hide meta row). */
export function ictDepartmentNamesForRequest(detail: HrRequestRow): string[] | null {
  if (!requestHasIctRegion(detail)) return null
  const names = (detail.departments ?? []).map((d) => d.name).filter(Boolean)
  return names.length > 0 ? names : null
}

/**
 * Props for `HrRequestViewTemplate` as originally created by federal admin
 * (full request description, standard meta row, indicators scoped to the request).
 */
export function buildFederalOriginalRequestViewTemplateProps(detail: HrRequestRow): {
  requestId: string
  title: string
  status: HrRequestRow['status']
  dueDate: string
  regionNames: string[]
  showMetaAssigneeRow: boolean
  ictDepartmentNames: string[] | null
  assignedDepartmentNames: string[] | null
  conventionLabel: string
  issueTitle: string
  issueEntryKind: ReturnType<typeof coerceIssueEntryKind>
  categoryName: string
  issueDescription: string | null
  description: string
  regionalInstructionsOnly: boolean
  regionalInstructionsText: string | null
  /** Overrides the instructions block heading when `regionalInstructionsOnly` is true. */
  instructionsHeading?: string | null
  articles: HrRequestIssueDetail['articles']
  indicators: HrRequestViewIndicatorRow[]
  attachments: HrRequestRow['attachments']
} | null {
  if (!detail.convention_id || !detail.issue_id || !detail.issue) return null

  const selectedIssue = detail.issue
  const selectedIds = new Set((detail.indicator_responses ?? []).map((r) => r.issue_indicator_id))
  const indicatorsForView = selectedIssue.indicators.filter((ind) => selectedIds.has(ind.id))

  const conventionLabel = detail.convention ? conventionOptionLabel(detail.convention) : '—'

  const indicators: HrRequestViewIndicatorRow[] = indicatorsForView.map((ind) => {
    const resp = detail.indicator_responses?.find((r) => r.issue_indicator_id === ind.id)
    return {
      id: ind.id,
      indicator_text: ind.indicator_text,
      disaggregation: ind.disaggregation,
      hasQuantitative: indicatorAllowsQuantitative(ind, selectedIssue),
      hasQualitative: indicatorAllowsQualitative(ind, selectedIssue),
      collectionByYear: indicatorYearGenderLines(ind),
      quantitative_value: resp?.quantitative_value,
      qualitative_text: resp?.qualitative_text,
    }
  })

  return {
    requestId: detail.id,
    title: detail.title,
    status: detail.status,
    dueDate: detail.date,
    regionNames: regionNamesForFederalOriginalView(detail),
    showMetaAssigneeRow: false,
    ictDepartmentNames: ictDepartmentNamesForRequest(detail),
    assignedDepartmentNames: null,
    conventionLabel,
    issueTitle: selectedIssue.issue_title,
    issueEntryKind: coerceIssueEntryKind(selectedIssue.entry_kind),
    categoryName: selectedIssue.category?.name ?? '—',
    issueDescription: selectedIssue.description?.trim() ? selectedIssue.description.trim() : null,
    description: detail.details ?? '',
    regionalInstructionsOnly: false,
    regionalInstructionsText: null,
    instructionsHeading: null,
    articles: selectedIssue.articles,
    indicators,
    attachments: detail.attachments,
  }
}
