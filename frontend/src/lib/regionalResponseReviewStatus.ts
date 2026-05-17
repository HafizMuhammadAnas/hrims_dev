export type ReviewStatusBadgeTone = 'pending' | 'success' | 'warning' | 'danger' | 'default'

export function regionalResponseReviewPresentation(status: string): {
  label: string
  tone: ReviewStatusBadgeTone
} {
  if (status === 'accepted') return { label: 'Accepted', tone: 'success' }
  if (status === 'needs-modification') return { label: 'Revision', tone: 'warning' }
  if (status === 'rejected') return { label: 'Rejected', tone: 'danger' }
  if (status === 'pending') return { label: 'Pending', tone: 'pending' }
  if (status === 'awaiting-submission') return { label: 'Awaiting submission', tone: 'pending' }
  const s = status.replace(/-/g, ' ')
  if (!s) return { label: status, tone: 'default' }
  return { label: s.charAt(0).toUpperCase() + s.slice(1), tone: 'pending' }
}
