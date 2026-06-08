import { indicatorYearGenderLines } from '../lib/indicatorCollectionDisplay'
import type { HrRequestIssueIndicator } from '../types/hrRequest'

type Props = {
  indicator: Pick<
    HrRequestIssueIndicator,
    'collects_by_year' | 'collects_by_gender' | 'collection_by_year' | 'disaggregation'
  >
  className?: string
  style?: React.CSSProperties
}

/** Read-only year → gender lines configured on the issue indicator (shown on federal request forms). */
export function IndicatorYearGenderHint({ indicator, className, style }: Props) {
  const lines = indicatorYearGenderLines(indicator)
  if (lines.length > 0) {
    return (
      <div className={className ?? 'muted small indicator-year-gender-hint'} style={style}>
        {lines.map((line) => (
          <div key={line.year_id}>
            <span className="indicator-year-gender-hint__year">{line.label}</span>
            {line.genders.length > 0 ? (
              <>
                {': '}
                <span>{line.genders.join(', ')}</span>
              </>
            ) : null}
          </div>
        ))}
      </div>
    )
  }
  const text = indicator.disaggregation?.trim()
  if (!text) return null
  return (
    <div className={className ?? 'muted small'} style={style}>
      Disaggregation: {text}
    </div>
  )
}
