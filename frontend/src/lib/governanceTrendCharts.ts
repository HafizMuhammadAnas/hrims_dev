import type { IndicatorTrendPoint, IndicatorTrendSeries } from './governanceDashboardData'

/** Fixed sequence of trend chart shapes (loops by indicator index). */
export const GOVERNANCE_TREND_CHART_SHAPES = [
  { id: 'line', label: 'Line', span: 6 },
  { id: 'bar', label: 'Bar', span: 6 },
  { id: 'area', label: 'Area', span: 12 },
  { id: 'step', label: 'Step', span: 4 },
  { id: 'composed', label: 'Composed', span: 12 },
] as const

export type GovernanceTrendChartShapeId = (typeof GOVERNANCE_TREND_CHART_SHAPES)[number]['id']

export type GovernanceTrendChartItem = IndicatorTrendSeries & {
  shapeId: GovernanceTrendChartShapeId
  /** Base span on a 12-column grid before row balancing. */
  span: number
  /** Final span after stretching the row to fill 12 columns (symmetry). */
  renderSpan: number
  colorIndex: number
}

export type GovernanceTrendChartRow = {
  key: string
  items: GovernanceTrendChartItem[]
}

export function chartShapeForIndex(index: number): (typeof GOVERNANCE_TREND_CHART_SHAPES)[number] {
  return GOVERNANCE_TREND_CHART_SHAPES[index % GOVERNANCE_TREND_CHART_SHAPES.length]
}

/**
 * Assign chart shapes in sequence (loop), pack into 12-col rows, then stretch
 * each row so columns fill evenly for visual symmetry.
 */
export function buildGovernanceTrendChartRows(
  series: IndicatorTrendSeries[],
): GovernanceTrendChartRow[] {
  const assigned: Omit<GovernanceTrendChartItem, 'renderSpan'>[] = series.map((s, index) => {
    const shape = chartShapeForIndex(index)
    return {
      ...s,
      shapeId: shape.id,
      span: shape.span,
      colorIndex: index,
    }
  })

  const rows: Omit<GovernanceTrendChartItem, 'renderSpan'>[][] = []
  let current: Omit<GovernanceTrendChartItem, 'renderSpan'>[] = []
  let used = 0

  for (const item of assigned) {
    if (current.length > 0 && used + item.span > 12) {
      rows.push(current)
      current = []
      used = 0
    }
    current.push(item)
    used += item.span
    if (used >= 12) {
      rows.push(current)
      current = []
      used = 0
    }
  }
  if (current.length > 0) rows.push(current)

  return rows.map((rowItems, rowIndex) => {
    const raw = rowItems.reduce((sum, i) => sum + i.span, 0)
    const items: GovernanceTrendChartItem[] =
      raw >= 12
        ? rowItems.map((i) => ({ ...i, renderSpan: i.span }))
        : // Stretch evenly across the row for symmetry when under-filled.
          rowItems.map((i) => ({
            ...i,
            renderSpan: 12 / rowItems.length,
          }))

    return {
      key: `row-${rowIndex}-${items.map((i) => i.indicatorId).join('-')}`,
      items,
    }
  })
}

export type { IndicatorTrendPoint }
