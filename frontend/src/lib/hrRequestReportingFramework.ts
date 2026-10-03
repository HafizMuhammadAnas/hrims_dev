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

export function isTreatyBodyReportingFramework(
  value: HrReportingFramework | '' | null | undefined,
): boolean {
  return value === 'treaty_body_obligatory' || value === 'treaty_body_optional_protocol'
}

export function isUprReportingFramework(
  value: HrReportingFramework | '' | null | undefined,
): boolean {
  return value === 'upr'
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
  if (row.request_type === 'upr') return 'upr'
  if (row.request_type === 'other_issue') return 'other_issue'
  if (row.issue_id || row.convention_id) return 'treaty_body_obligatory'
  return ''
}
