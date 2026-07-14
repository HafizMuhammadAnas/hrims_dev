import type { IndicatorTrendPoint, IndicatorTrendSeries } from './governanceDashboardData'

/**
 * Fixed sequence of trend chart shapes.
 * Third chart (index 2) is always Pie; each chart is half-width (2 per row).
 */
export const GOVERNANCE_TREND_CHART_SHAPES = [
  { id: 'line', label: 'Line' },
  { id: 'bar', label: 'Bar' },
  { id: 'pie', label: 'Pie' },
  { id: 'area', label: 'Area' },
  { id: 'step', label: 'Step' },
  { id: 'composed', label: 'Composed' },
] as const

export type GovernanceTrendChartShapeId = (typeof GOVERNANCE_TREND_CHART_SHAPES)[number]['id']

export type GovernanceTrendChartItem = IndicatorTrendSeries & {
  shapeId: GovernanceTrendChartShapeId
  colorIndex: number
}

export type GovernanceTrendChartRow = {
  key: string
  items: GovernanceTrendChartItem[]
}

export function chartShapeForIndex(index: number): (typeof GOVERNANCE_TREND_CHART_SHAPES)[number] {
  return GOVERNANCE_TREND_CHART_SHAPES[index % GOVERNANCE_TREND_CHART_SHAPES.length]
}

/** Pack indicators into rows of exactly two equal charts. */
export function buildGovernanceTrendChartRows(
  series: IndicatorTrendSeries[],
): GovernanceTrendChartRow[] {
  const assigned: GovernanceTrendChartItem[] = series.map((s, index) => {
    const shape = chartShapeForIndex(index)
    return {
      ...s,
      shapeId: shape.id,
      colorIndex: index,
    }
  })

  const rows: GovernanceTrendChartRow[] = []
  for (let i = 0; i < assigned.length; i += 2) {
    const items = assigned.slice(i, i + 2)
    rows.push({
      key: `row-${i / 2}-${items.map((item) => item.indicatorId).join('-')}`,
      items,
    })
  }
  return rows
}

export type { IndicatorTrendPoint }
