import type { RegionSubmissionCoverageItem } from '../lib/regionalSubmissionCoverage'
import { regionalResponseReviewPresentation } from '../lib/regionalResponseReviewStatus'
import { StatusBadge } from './ui/StatusBadge'

type Props = {
  items: RegionSubmissionCoverageItem[]
  className?: string
}

/** Per-province chips: submitted (with review status) or awaiting submission. */
export function RegionalSubmissionCoverageBar({ items, className }: Props) {
  if (items.length === 0) return null

  return (
    <div
      className={
        'regional-submission-coverage' + (className?.trim() ? ` ${className.trim()}` : '')
      }
      role="list"
      aria-label="Provincial submission status by region"
    >
      {items.map((item) => (
        <div key={item.regionId} className="regional-submission-coverage__item" role="listitem">
          <span className="regional-submission-coverage__name">{item.regionName}</span>
          {item.status === 'pending_submission' ? (
            <StatusBadge tone="in-progress">Awaiting submission</StatusBadge>
          ) : (
            <StatusBadge tone={regionalResponseReviewPresentation(item.response?.review_status ?? 'pending').tone}>
              {item.response
                ? regionalResponseReviewPresentation(item.response.review_status).label
                : 'Submitted'}
            </StatusBadge>
          )}
        </div>
      ))}
    </div>
  )
}
