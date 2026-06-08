import { HR_REQUEST_STATUS_LABELS } from '../data/hrRequestFormLookups'
import type { HrRequestRow } from '../types/hrRequest'
import type { StatusBadgeTone } from './statusBadgeTone'

export function hrRequestStatusPresentation(status: string): {
  label: string
  tone: StatusBadgeTone
} {
  if (status === 'active') {
    return { label: HR_REQUEST_STATUS_LABELS.active, tone: 'success' }
  }
  if (status === 'draft') {
    return { label: HR_REQUEST_STATUS_LABELS.draft, tone: 'warning' }
  }
  const s = status.replace(/-/g, ' ')
  return { label: s ? s.charAt(0).toUpperCase() + s.slice(1) : status, tone: 'default' }
}

export function hrRequestListStats(rows: HrRequestRow[]): { label: string; value: number }[] {
  const active = rows.filter((r) => r.status === 'active').length
  const draft = rows.filter((r) => r.status === 'draft').length
  return [
    { label: 'Total requests', value: rows.length },
    { label: 'Active', value: active },
    { label: 'Draft', value: draft },
  ]
}
