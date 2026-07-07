/** Chart palette aligned with DashboardPage. */
export const REPORT_CHART_PRIMARY = '#2e4fa3'
export const REPORT_CHART_PRIMARY_FILL = '#93c5fd'

/** Reporting dashboard row-1 charts & rank bars (reference palette). */
export const REPORT_DASHBOARD_CHART_COLORS = [
  '#3E5896', // dark blue
  '#126B6B', // dark teal
  '#5D8DF1', // medium blue
  '#F5A623', // amber
  '#A23CF0', // purple
  '#00BCD4', // cyan
] as const

export const REPORT_DASHBOARD_RANK_DOT = '#FF7F27'

export const REPORT_PIE_COLORS = [...REPORT_DASHBOARD_CHART_COLORS, '#ffb300']
export const REPORT_STATUS_COLORS: Record<string, string> = {
  draft: '#c4a574',
  active: '#2e4fa3',
  pending: '#ffb300',
  accepted: '#4caf50',
  approved: '#4caf50',
  'needs-modification': '#f44336',
  submitted: '#2e4fa3',
  unknown: '#94a3b8',
}

export function reportDashboardChartColor(index: number): string {
  return REPORT_DASHBOARD_CHART_COLORS[index % REPORT_DASHBOARD_CHART_COLORS.length]
}

export function reportColorForLabel(label: string, index: number): string {
  const key = label.toLowerCase().replace(/\s+/g, '-')
  return REPORT_STATUS_COLORS[key] ?? reportDashboardChartColor(index)
}
