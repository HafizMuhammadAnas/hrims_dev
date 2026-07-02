import { indicatorCollectionLines, indicatorDimensionLabelNames } from '../lib/indicatorCollectionDisplay'
import type { HrRequestIssueIndicator } from '../types/hrRequest'

type Props = {
  indicator: Pick<
    HrRequestIssueIndicator,
    | 'collects_by_year'
    | 'collects_by_gender'
    | 'collects_by_age'
    | 'collects_by_location'
    | 'collects_by_disability'
    | 'collects_by_religion'
    | 'collection_by_year'
    | 'disaggregation'
  >
  className?: string
  style?: React.CSSProperties
}

/** Read-only year collection and disaggregation dimensions configured on the issue indicator. */
export function IndicatorYearGenderHint({ indicator, className, style }: Props) {
  const lines = indicatorCollectionLines(indicator)
  const dimensionLabels = indicatorDimensionLabelNames(indicator)
  if (lines.length > 0 || dimensionLabels.length > 0) {
    return (
      <div className={className ?? 'muted small indicator-year-gender-hint'} style={style}>
        {lines.map((line) => (
          <div key={line.year_id}>
            <span className="indicator-year-gender-hint__year">{line.label}</span>
            {line.genders.length > 0 ? (
              <>
                {' · Gender: '}
                <span>{line.genders.join(', ')}</span>
              </>
            ) : null}
          </div>
        ))}
        {dimensionLabels.length > 0 ? <div>{dimensionLabels.join(', ')}</div> : null}
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
