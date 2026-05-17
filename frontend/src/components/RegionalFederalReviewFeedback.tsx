import type { RegionalResponseRow } from '../api/lists'
import { Alert } from './ui/Alert'

type Props = {
  row: RegionalResponseRow
  className?: string
}

/** Federal review notes shown to regional admins when a compilation needs changes. */
export function RegionalFederalReviewFeedback({ row, className }: Props) {
  const text = row.comments?.trim()
  if (!text) return null

  if (row.review_status === 'needs-modification') {
    return (
      <Alert
        variant="warning"
        title="Federal feedback — revision requested"
        className={className ?? 'regional-federal-review-feedback'}
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{text}</p>
      </Alert>
    )
  }

  if (row.review_status === 'rejected') {
    return (
      <Alert
        variant="error"
        title="Federal feedback — compilation rejected"
        className={className ?? 'regional-federal-review-feedback'}
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{text}</p>
      </Alert>
    )
  }

  return null
}
