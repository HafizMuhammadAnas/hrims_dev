import {
  indicatorAllDimensionLabelNames,
  indicatorCollectionLines,
} from '../lib/indicatorCollectionDisplay'
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
    | 'collects_by_others'
    | 'collection_by_year'
    | 'disaggregation'
  >
  className?: string
  style?: React.CSSProperties
}

/**
 * Read-only years + dimension names for an indicator.
 * Years are sorted by value; each year lists dimension names only (no Male/Female/etc.).
 */
export function IndicatorYearGenderHint({ indicator, className, style }: Props) {
  const lines = indicatorCollectionLines(indicator)
  const dimensionLabels = indicatorAllDimensionLabelNames(indicator)
  if (lines.length > 0) {
    return (
      <div className={className ?? 'muted small indicator-year-gender-hint'} style={style}>
        {lines.map((line) => (
          <div key={line.year_id}>
            <span className="indicator-year-gender-hint__year">{line.label}</span>
            {dimensionLabels.length > 0 ? (
              <>
                {' · '}
                <span>{dimensionLabels.join(', ')}</span>
              </>
            ) : null}
          </div>
        ))}
      </div>
    )
  }
  if (dimensionLabels.length > 0) {
    return (
      <div className={className ?? 'muted small indicator-year-gender-hint'} style={style}>
        <div>{dimensionLabels.join(', ')}</div>
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
