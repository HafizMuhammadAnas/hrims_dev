import type { StatusBadgeTone } from './statusBadgeTone'

export function regionalResponseReviewPresentation(status: string): {
  label: string
  tone: StatusBadgeTone
} {
  if (status === 'accepted') return { label: 'Accepted', tone: 'success' }
  if (status === 'needs-modification') return { label: 'Revision', tone: 'warning' }
  if (status === 'rejected') return { label: 'Rejected', tone: 'danger' }
  if (status === 'pending') return { label: 'Under Review', tone: 'pending' }
  if (status === 'awaiting-submission') return { label: 'Pending', tone: 'in-progress' }
  const s = status.replace(/-/g, ' ')
  if (!s) return { label: status, tone: 'default' }
  return { label: s.charAt(0).toUpperCase() + s.slice(1), tone: 'pending' }
}
