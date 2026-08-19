/** Chart palette aligned with DashboardPage. */
export const REPORT_CHART_PRIMARY = '#2e4fa3'
export const REPORT_CHART_PRIMARY_FILL = '#93c5fd'

/**
 * Reporting dashboard charts & Top 10 rank bars.
 * Ten distinct colors so Categories — top 10 never repeats a bar color.
 */
export const REPORT_DASHBOARD_CHART_COLORS = [
  '#3E5896', // dark blue
  '#126B6B', // dark teal
  '#5D8DF1', // medium blue
  '#F5A623', // amber
  '#A23CF0', // purple
  '#00BCD4', // cyan
  '#E53935', // red
  '#43A047', // green
  '#FB8C00', // orange
  '#8D6E63', // brown
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

/**
 * Top 10 rank bar color by row index.
 * Categories use forward order; Indicators use the reverse of the same palette.
 */
export function reportTop10BarColor(index: number, reverse = false): string {
  const n = REPORT_DASHBOARD_CHART_COLORS.length
  const i = ((index % n) + n) % n
  return REPORT_DASHBOARD_CHART_COLORS[reverse ? n - 1 - i : i]
}

export function reportColorForLabel(label: string, index: number): string {
  const key = label.toLowerCase().replace(/\s+/g, '-')
  return REPORT_STATUS_COLORS[key] ?? reportDashboardChartColor(index)
}
