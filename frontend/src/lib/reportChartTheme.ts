/** Chart palette aligned with DashboardPage. */
export const REPORT_CHART_PRIMARY = '#2e4fa3'
export const REPORT_CHART_PRIMARY_FILL = '#93c5fd'
export const REPORT_PIE_COLORS = ['#c4a574', '#2e4fa3', '#0f766e', '#5b8def', '#f44336', '#9333ea', '#00bcd4', '#ffb300']
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

export function reportColorForLabel(label: string, index: number): string {
  const key = label.toLowerCase().replace(/\s+/g, '-')
  return REPORT_STATUS_COLORS[key] ?? REPORT_PIE_COLORS[index % REPORT_PIE_COLORS.length]
}
