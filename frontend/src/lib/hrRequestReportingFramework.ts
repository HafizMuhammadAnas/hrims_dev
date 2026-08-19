/** Top-level reporting framework on the federal new-request form. */
export type HrReportingFramework =
  | 'upr'
  | 'treaty_body_obligatory'
  | 'treaty_body_optional_protocol'
  | 'other_issue'

export const HR_REPORTING_FRAMEWORK_OPTIONS: Array<{
  value: HrReportingFramework
  label: string
}> = [
  { value: 'upr', label: 'Universal Periodic Review Reporting' },
  { value: 'treaty_body_obligatory', label: 'Treaty Body Reporting – Obligatory' },
  {
    value: 'treaty_body_optional_protocol',
    label: 'Treaty Body Reporting – Optional Protocol',
  },
  { value: 'other_issue', label: 'Other Issues' },
]

export const UPR_REPORTING_CYCLE_OPTIONS = [
  { value: 'cycle_1', label: 'Cycle 1' },
  { value: 'cycle_2', label: 'Cycle 2' },
  { value: 'cycle_3', label: 'Cycle 3' },
  { value: 'cycle_4', label: 'Cycle 4' },
  { value: 'cycle_5', label: 'Cycle 5' },
] as const

export const UPR_RECOMMENDATION_OPTIONS = [
  { value: 'recommendation_1', label: 'Recommendation 1' },
  { value: 'recommendation_2', label: 'Recommendation 2' },
  { value: 'recommendation_3', label: 'Recommendation 3' },
  { value: 'recommendation_4', label: 'Recommendation 4' },
  { value: 'recommendation_5', label: 'Recommendation 5' },
] as const

export function isTreatyBodyReportingFramework(
  value: HrReportingFramework | '' | null | undefined,
): boolean {
  return value === 'treaty_body_obligatory' || value === 'treaty_body_optional_protocol'
}

export function reportingFrameworkLabel(
  value: HrReportingFramework | '' | null | undefined,
): string {
  if (!value) return ''
  return HR_REPORTING_FRAMEWORK_OPTIONS.find((o) => o.value === value)?.label ?? value
}

/** Resolve reporting type for display; backfills legacy rows that predate the column. */
export function inferReportingFramework(
  row: {
    reporting_framework?: HrReportingFramework | null
    request_type?: string | null
    issue_id?: number | null
    convention_id?: number | null
  } | null | undefined,
): HrReportingFramework | '' {
  if (!row) return ''
  if (row.reporting_framework) return row.reporting_framework
  if (row.request_type === 'other_issue') return 'other_issue'
  if (row.issue_id || row.convention_id) return 'treaty_body_obligatory'
  return ''
}

export const UPR_COMPLETION_BLOCKED_MESSAGE =
  'Universal Periodic Review Reporting cannot be used to complete a request yet. Select Treaty Body Reporting or Other Issues.'
