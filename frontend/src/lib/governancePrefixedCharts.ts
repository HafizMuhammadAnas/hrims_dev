import type { ReportLookupIndicator } from '../api/reports'
import type { GovernanceTrendChartShapeId } from './governanceTrendCharts'
import type { IndicatorTrendSeries } from './governanceDashboardData'

export type PrefixedSeriesMatch = {
  /** Stable series key used in chart data rows. */
  key: string
  /** Legend / tooltip name. */
  label: string
  /** Normalized substrings that must all appear in indicator text. */
  includes: string[]
  /** Substrings that disqualify a candidate. */
  excludes?: string[]
  /** Prefer indicator text that equals this after normalize (ignoring trailing period). */
  preferExact?: string
}

export type PrefixedChartDef =
  | {
      key: string
      kind: 'comparison'
      title: string
      shape: 'line' | 'bar' | 'composed'
      series: [PrefixedSeriesMatch, PrefixedSeriesMatch]
    }
  | {
      key: string
      kind: 'trend'
      title: string
      shape: GovernanceTrendChartShapeId
      series: [PrefixedSeriesMatch]
    }

/** Default (mode 2) governance charts — fixed CAT indicators, no filters required. */
export const GOVERNANCE_PREFIXED_CHART_DEFS: PrefixedChartDef[] = [
  {
    key: 'complaints-received-vs-investigated',
    kind: 'comparison',
    title: 'Torture Complaints: Received vs Investigated',
    shape: 'composed',
    series: [
      {
        key: 'received',
        label: 'Complaints Received',
        includes: ['number of torture complaints received'],
        preferExact: 'number of torture complaints received',
      },
      {
        key: 'investigated',
        label: 'Complaints Investigated',
        includes: ['number of complaints investigated'],
        excludes: ['against torture', 'torture-related'],
        preferExact: 'number of complaints investigated',
      },
    ],
  },
  {
    key: 'officials-suspended',
    kind: 'trend',
    title: 'Number of officials suspended pending investigation',
    shape: 'line',
    series: [
      {
        key: 'total',
        label: 'Total',
        includes: ['number of officials suspended pending investigation'],
        preferExact: 'number of officials suspended pending investigation',
      },
    ],
  },
  {
    key: 'prosecutions-initiated',
    kind: 'trend',
    title: 'Number of prosecutions initiated',
    shape: 'bar',
    series: [
      {
        key: 'total',
        label: 'Total',
        includes: ['number of prosecutions initiated'],
        excludes: [
          'under the torture',
          'attempt to commit',
          'complicity',
          'counter terrorism',
          'custodial deaths',
          'based on torture',
        ],
        preferExact: 'number of prosecutions initiated',
      },
    ],
  },
  {
    key: 'convictions-secured',
    kind: 'trend',
    title: 'Number of convictions secured',
    shape: 'area',
    series: [
      {
        key: 'total',
        label: 'Total',
        includes: ['number of convictions secured'],
        excludes: [
          'for torture offences',
          'counter terrorism',
          'torture-related',
          'police officials',
        ],
        preferExact: 'number of convictions secured',
      },
    ],
  },
  {
    key: 'custodial-rape',
    kind: 'trend',
    title: 'Number of custodial rape cases reported',
    shape: 'step',
    series: [
      {
        key: 'total',
        label: 'Total',
        includes: ['number of custodial rape cases reported'],
        preferExact: 'number of custodial rape cases reported',
      },
    ],
  },
  {
    key: 'torture-complaints-registered',
    kind: 'trend',
    title:
      'Number of torture complaints registered under the Torture and Custodial Death (Prevention and Punishment) Act, 2022',
    shape: 'pie',
    series: [
      {
        key: 'total',
        label: 'Total',
        includes: [
          'number of torture complaints registered under the torture and custodial death',
        ],
        preferExact:
          'number of torture complaints registered under the torture and custodial death (prevention and punishment) act, 2022',
      },
    ],
  },
  {
    key: 'superior-officers-prosecuted-vs-convicted',
    kind: 'comparison',
    title: 'Superior Officers: Prosecuted vs Convicted',
    shape: 'line',
    series: [
      {
        key: 'prosecuted',
        label: 'Prosecuted',
        includes: ['number of superior officers prosecuted'],
        preferExact: 'number of superior officers prosecuted',
      },
      {
        key: 'convicted',
        label: 'Convicted',
        includes: ['number of superior officers', 'convicted'],
        excludes: ['prosecuted', 'investigated'],
        preferExact: 'number of superior officers convicted',
      },
    ],
  },
]

export function normalizeIndicatorMatchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .trim()
}

function matchScore(indicatorText: string, rule: PrefixedSeriesMatch): number {
  const text = normalizeIndicatorMatchText(indicatorText)
  for (const ex of rule.excludes ?? []) {
    if (text.includes(normalizeIndicatorMatchText(ex))) return -1
  }
  for (const inc of rule.includes) {
    if (!text.includes(normalizeIndicatorMatchText(inc))) return -1
  }
  let score = 10 + rule.includes.join('').length
  const prefer = rule.preferExact ? normalizeIndicatorMatchText(rule.preferExact) : null
  if (prefer && text === prefer) score += 1000
  else if (prefer && text.startsWith(prefer)) score += 500
  // Prefer shorter titles among loose matches (closer to the intended label).
  score += Math.max(0, 200 - text.length)
  score += (indicatorText.match(/\b\d{4}\b/g)?.length ?? 0) * 2
  return score
}

export function resolvePrefixedIndicator(
  indicators: ReportLookupIndicator[],
  rule: PrefixedSeriesMatch,
): ReportLookupIndicator | null {
  let best: ReportLookupIndicator | null = null
  let bestScore = -1
  for (const ind of indicators) {
    const score = matchScore(ind.indicator_text ?? '', rule)
    if (score < 0) continue
    const yearBoost = (ind.collection_years?.length ?? 0) * 3
    const total = score + yearBoost
    if (
      total > bestScore ||
      (total === bestScore &&
        best != null &&
        (ind.collection_years?.length ?? 0) > (best.collection_years?.length ?? 0))
    ) {
      best = ind
      bestScore = total
    }
  }
  return best
}

export type ResolvedPrefixedSeries = PrefixedSeriesMatch & {
  indicator: ReportLookupIndicator | null
}

export type ResolvedPrefixedChart =
  | {
      key: string
      kind: 'comparison'
      title: string
      shape: 'line' | 'bar' | 'composed'
      series: [ResolvedPrefixedSeries, ResolvedPrefixedSeries]
    }
  | {
      key: string
      kind: 'trend'
      title: string
      shape: GovernanceTrendChartShapeId
      series: [ResolvedPrefixedSeries]
    }
  | {
      key: string
      kind: 'dimension_totals'
      title: string
      shape: 'line' | 'bar' | 'composed'
      series: [ResolvedPrefixedSeries]
    }

export function resolvePrefixedCharts(
  indicators: ReportLookupIndicator[],
): ResolvedPrefixedChart[] {
  return GOVERNANCE_PREFIXED_CHART_DEFS.map((def) => {
    if (def.kind === 'comparison') {
      return {
        ...def,
        series: [
          { ...def.series[0], indicator: resolvePrefixedIndicator(indicators, def.series[0]) },
          { ...def.series[1], indicator: resolvePrefixedIndicator(indicators, def.series[1]) },
        ],
      }
    }
    return {
      ...def,
      series: [{ ...def.series[0], indicator: resolvePrefixedIndicator(indicators, def.series[0]) }],
    }
  })
}

export type PrefixedComparisonPoint = {
  yearId: string
  year: string
  [seriesKey: string]: string | number
}

export function buildComparisonPoints(
  primary: IndicatorTrendSeries | null,
  secondary: IndicatorTrendSeries | null,
  primaryKey: string,
  secondaryKey: string,
): PrefixedComparisonPoint[] {
  const byYear = new Map<string, PrefixedComparisonPoint>()

  const ingest = (series: IndicatorTrendSeries | null, key: string) => {
    if (!series) return
    for (const p of series.points) {
      const existing = byYear.get(p.yearId) ?? {
        yearId: p.yearId,
        year: p.year,
        [primaryKey]: 0,
        [secondaryKey]: 0,
      }
      existing.year = p.year || existing.year
      existing[key] = p.total
      byYear.set(p.yearId, existing)
    }
  }

  ingest(primary, primaryKey)
  ingest(secondary, secondaryKey)

  return [...byYear.values()].sort((a, b) => {
    const na = Number(a.year)
    const nb = Number(b.year)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    return String(a.year).localeCompare(String(b.year), undefined, { numeric: true })
  })
}

/** All indicator ids resolved for prefixed (mode 2) charts. */
export function prefixedIndicatorIds(resolved: ResolvedPrefixedChart[]): string[] {
  const ids: string[] = []
  for (const chart of resolved) {
    for (const s of chart.series) {
      if (s.indicator) ids.push(String(s.indicator.id))
    }
  }
  return [...new Set(ids)]
}

export type SavedGovernanceChartConfig = {
  id: number
  kind: 'trend' | 'comparison' | 'dimension_totals'
  title: string
  shape: string
  series_a_key: string
  series_a_label: string
  series_a_indicator_id: number | null
  series_b_key: string | null
  series_b_label: string | null
  series_b_indicator_id: number | null
}

function indicatorById(
  indicators: ReportLookupIndicator[],
  id: number | null,
): ReportLookupIndicator | null {
  if (id == null) return null
  return indicators.find((i) => Number(i.id) === Number(id)) ?? null
}

function asTrendShape(shape: string): GovernanceTrendChartShapeId {
  const allowed: GovernanceTrendChartShapeId[] = ['line', 'bar', 'pie', 'area', 'step', 'composed']
  return (allowed.includes(shape as GovernanceTrendChartShapeId)
    ? shape
    : 'line') as GovernanceTrendChartShapeId
}

function asComparisonShape(shape: string): 'line' | 'bar' | 'composed' {
  if (shape === 'bar' || shape === 'composed') return shape
  return 'line'
}

/** Build mode-2 charts from Super Admin saved config (indicator ids), falling back to name matching. */
export function resolveChartsFromSavedConfig(
  configs: SavedGovernanceChartConfig[],
  indicators: ReportLookupIndicator[],
): ResolvedPrefixedChart[] {
  if (configs.length === 0) return resolvePrefixedCharts(indicators)

  return configs.map((cfg) => {
    const a = indicatorById(indicators, cfg.series_a_indicator_id)
    if (cfg.kind === 'comparison') {
      const b = indicatorById(indicators, cfg.series_b_indicator_id)
      return {
        key: `saved-${cfg.id}`,
        kind: 'comparison' as const,
        title: cfg.title,
        shape: asComparisonShape(cfg.shape),
        series: [
          {
            key: cfg.series_a_key || 'series_a',
            label: cfg.series_a_label || 'Series A',
            includes: [],
            indicator: a,
          },
          {
            key: cfg.series_b_key || 'series_b',
            label: cfg.series_b_label || 'Series B',
            includes: [],
            indicator: b,
          },
        ],
      }
    }

    if (cfg.kind === 'dimension_totals') {
      return {
        key: `saved-${cfg.id}`,
        kind: 'dimension_totals' as const,
        title: cfg.title,
        shape: asComparisonShape(cfg.shape),
        series: [
          {
            key: cfg.series_a_key || 'dimensions',
            label: cfg.series_a_label || 'Dimension totals',
            includes: [],
            indicator: a,
          },
        ],
      }
    }

    return {
      key: `saved-${cfg.id}`,
      kind: 'trend' as const,
      title: cfg.title,
      shape: asTrendShape(cfg.shape),
      series: [
        {
          key: cfg.series_a_key || 'total',
          label: cfg.series_a_label || 'Total',
          includes: [],
          indicator: a,
        },
      ],
    }
  })
}

/** Indicator ids needed only for dimension-totals charts. */
export function dimensionTotalsIndicatorIds(resolved: ResolvedPrefixedChart[]): string[] {
  const ids: string[] = []
  for (const chart of resolved) {
    if (chart.kind !== 'dimension_totals') continue
    for (const s of chart.series) {
      if (s.indicator) ids.push(String(s.indicator.id))
    }
  }
  return [...new Set(ids)]
}
