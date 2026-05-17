export function violationStatusPresentation(status: string): {
  label: string
  tone: 'pending' | 'success' | 'warning' | 'danger' | 'default'
} {
  const s = status.trim().toLowerCase()
  if (s === 'resolved' || s === 'closed') return { label: 'Resolved', tone: 'success' }
  if (s === 'in-progress' || s === 'in_progress' || s === 'open') {
    return { label: 'Open', tone: 'warning' }
  }
  if (s === 'pending') return { label: 'Pending', tone: 'pending' }
  if (!s) return { label: '—', tone: 'default' }
  const word = s.replace(/_/g, '-').split('-')[0]
  return { label: word.charAt(0).toUpperCase() + word.slice(1), tone: 'default' }
}

export const VIOLATION_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'in-progress', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'pending', label: 'Pending' },
] as const
