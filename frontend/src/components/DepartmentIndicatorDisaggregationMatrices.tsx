import { useMemo } from 'react'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import type { DistrictRow } from '../api/districts'
import type { CollectionReligionRow } from '../api/collectionReligions'
import { isSelectableCollectionGender } from '../lib/collectionGenderOptions'
import {
  AGE_KEYS,
  AGE_LABELS,
  DISABILITY_KEYS,
  DISABILITY_LABELS,
  DISABILITY_NO,
  DISABILITY_PERSONS_WITH_DISABILITY,
  DISABILITY_YES,
  indicatorCatalogCellAllowed,
  indicatorConfiguredYears,
  indicatorFixedKeyCellAllowed,
  indicatorGenderCellAllowed,
  indicatorIsYearOnly,
  indicatorReligionCellAllowed,
  indicatorUsesAnyDataMatrix,
} from '../lib/indicatorDisaggregation'
import type { MatrixDimensionKey } from '../lib/deptMatrixRowEnabled'
import { isMatrixRowEnabled } from '../lib/deptMatrixRowEnabled'
import {
  DIMENSION_TOTAL_COLUMN_ID,
  YEAR_ONLY_GENDER_ID,
  YEAR_ONLY_GENDER_LABEL,
  genderTotalCellKey,
  matrixCellKey,
} from '../lib/indicatorMatrixColumns'
import { MatrixRowEnableToggle } from './ui/MatrixRowEnableToggle'

type MatrixValues = Record<number, Record<string, string>>

type DimColumn = { id: number | string; label: string }

type Props = {
  indicators: HrRequestIssueIndicator[]
  /**
   * 1-based ordinals from the full request (or assign UI) list, keyed by indicator id.
   * Keeps labels like #1 / #3 stable — not renumbered among quantitative-only cards.
   */
  indicatorOrdinals?: Record<number, number>
  genderValues: MatrixValues
  ageValues: MatrixValues
  disabilityValues: MatrixValues
  districtValues: MatrixValues
  religionValues: MatrixValues
  consolidatedValues: MatrixValues
  districts: DistrictRow[]
  religions: CollectionReligionRow[]
  onGenderChange?: (
    indicatorId: number,
    yearId: number,
    columnId: number | string,
    value: string,
    autoTotalValue?: string,
  ) => void
  onAgeChange?: (
    indicatorId: number,
    yearId: number,
    columnId: number | string,
    value: string,
    autoTotalValue?: string,
  ) => void
  onDisabilityChange?: (
    indicatorId: number,
    yearId: number,
    columnId: number | string,
    value: string,
    autoTotalValue?: string,
  ) => void
  onDistrictChange?: (
    indicatorId: number,
    yearId: number,
    columnId: number | string,
    value: string,
    autoTotalValue?: string,
  ) => void
  onReligionChange?: (
    indicatorId: number,
    yearId: number,
    columnId: number | string,
    value: string,
    autoTotalValue?: string,
  ) => void
  onConsolidatedChange?: (
    indicatorId: number,
    yearId: number,
    columnId: number | string,
    value: string,
    autoTotalValue?: string,
  ) => void
  rowEnabledByIndicator?: Record<number, Partial<Record<MatrixDimensionKey, boolean>>>
  onRowEnabledChange?: (indicatorId: number, dimension: MatrixDimensionKey, enabled: boolean) => void
  readOnly?: boolean
  savedGenderByIndicator?: MatrixValues
  savedAgeByIndicator?: MatrixValues
  savedDisabilityByIndicator?: MatrixValues
  savedDistrictByIndicator?: MatrixValues
  savedReligionByIndicator?: MatrixValues
  savedConsolidatedByIndicator?: MatrixValues
}

function num(v: string | number | '' | undefined | null): number {
  if (v === '' || v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000)
}

function resolveCellKey(yearId: number, columnId: number | string): string {
  if (columnId === DIMENSION_TOTAL_COLUMN_ID) return genderTotalCellKey(yearId)
  if (typeof columnId === 'string') return `${yearId}-${columnId}`
  return matrixCellKey(yearId, columnId)
}

function readCell(
  live: MatrixValues | undefined,
  saved: MatrixValues | undefined,
  indicatorId: number,
  yearId: number,
  columnId: number | string,
  readOnly: boolean,
): string {
  const key = resolveCellKey(yearId, columnId)
  if (!readOnly) return live?.[indicatorId]?.[key] ?? ''
  return saved?.[indicatorId]?.[key] ?? live?.[indicatorId]?.[key] ?? ''
}

function sumBreakdown(
  getValue: (columnId: number | string) => string,
  columns: DimColumn[],
  allowed: (columnId: number | string) => boolean,
  override?: { columnId: number | string; value: string },
): string {
  let sum = 0
  let any = false
  for (const col of columns) {
    if (!allowed(col.id)) continue
    const raw =
      override && String(override.columnId) === String(col.id)
        ? override.value.trim()
        : getValue(col.id).trim()
    if (raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n)) continue
    sum += n
    any = true
  }
  if (!any) return ''
  return formatNumber(sum)
}

function genderColumnsForIndicator(ind: HrRequestIssueIndicator): DimColumn[] {
  if (indicatorIsYearOnly(ind)) {
    return [{ id: YEAR_ONLY_GENDER_ID, label: YEAR_ONLY_GENDER_LABEL }]
  }
  if (!ind.collects_by_gender) return []
  const byId = new Map<number, string>()
  for (const y of ind.collection_by_year ?? []) {
    for (const g of y.genders ?? []) {
      if (!isSelectableCollectionGender(g.name)) continue
      byId.set(g.id, g.name)
    }
  }
  return [...byId.entries()].map(([id, label]) => ({ id, label }))
}

function ageColumns(): DimColumn[] {
  return AGE_KEYS.map((key) => ({ id: key, label: AGE_LABELS[key] ?? key }))
}

function disabilityColumns(saved?: MatrixValues): DimColumn[] {
  const cols: DimColumn[] = DISABILITY_KEYS.map((key) => ({
    id: key,
    label: DISABILITY_LABELS[key] ?? key,
  }))
  if (!saved) return cols
  const legacyKeys = [
    DISABILITY_PERSONS_WITH_DISABILITY,
    DISABILITY_YES,
    DISABILITY_NO,
  ] as const
  const seen = new Set(cols.map((c) => String(c.id)))
  for (const key of Object.keys(saved)) {
    // Matrix keys are `${yearId}|${columnId}` — columnId is after the last '|'.
    const columnId = key.includes('|') ? key.slice(key.lastIndexOf('|') + 1) : key
    if (
      (legacyKeys as readonly string[]).includes(columnId) &&
      !seen.has(columnId)
    ) {
      seen.add(columnId)
      cols.push({ id: columnId, label: DISABILITY_LABELS[columnId] ?? columnId })
    }
  }
  return cols
}

function districtColumns(districts: DistrictRow[]): DimColumn[] {
  return districts.map((d) => ({ id: d.id, label: d.name }))
}

function religionColumns(religions: CollectionReligionRow[]): DimColumn[] {
  return religions.map((r) => ({ id: r.id, label: r.name }))
}

type DimDef = {
  key: MatrixDimensionKey
  title: string
  columns: DimColumn[]
  values: MatrixValues
  saved?: MatrixValues
  onChange?: Props['onGenderChange']
  cellAllowed: (yearId: number, columnId: number | string) => boolean
}

function DepartmentIndicatorDataCard({
  ordinal,
  indicator,
  districts,
  religions,
  genderValues,
  ageValues,
  disabilityValues,
  districtValues,
  religionValues,
  consolidatedValues,
  onGenderChange,
  onAgeChange,
  onDisabilityChange,
  onDistrictChange,
  onReligionChange,
  onConsolidatedChange,
  rowEnabled,
  onRowEnabledChange,
  readOnly,
  savedGenderByIndicator,
  savedAgeByIndicator,
  savedDisabilityByIndicator,
  savedDistrictByIndicator,
  savedReligionByIndicator,
  savedConsolidatedByIndicator,
}: {
  /** 1-based number from the request indicator list (matches regional assign #N). */
  ordinal: number
  indicator: HrRequestIssueIndicator
  districts: DistrictRow[]
  religions: CollectionReligionRow[]
  genderValues: MatrixValues
  ageValues: MatrixValues
  disabilityValues: MatrixValues
  districtValues: MatrixValues
  religionValues: MatrixValues
  consolidatedValues: MatrixValues
  onGenderChange?: Props['onGenderChange']
  onAgeChange?: Props['onAgeChange']
  onDisabilityChange?: Props['onDisabilityChange']
  onDistrictChange?: Props['onDistrictChange']
  onReligionChange?: Props['onReligionChange']
  onConsolidatedChange?: Props['onConsolidatedChange']
  rowEnabled?: Partial<Record<MatrixDimensionKey, boolean>>
  onRowEnabledChange?: (dimension: MatrixDimensionKey, enabled: boolean) => void
  readOnly: boolean
  savedGenderByIndicator?: MatrixValues
  savedAgeByIndicator?: MatrixValues
  savedDisabilityByIndicator?: MatrixValues
  savedDistrictByIndicator?: MatrixValues
  savedReligionByIndicator?: MatrixValues
  savedConsolidatedByIndicator?: MatrixValues
}) {
  const years = useMemo(() => indicatorConfiguredYears(indicator), [indicator])
  const showConsolidated = Boolean(indicator.collects_by_consolidated)
  const showYearOnlyGender = indicatorIsYearOnly(indicator) && !showConsolidated
  const hasGenderBreakdown = Boolean(indicator.collects_by_gender) && !showConsolidated
  const consolidatedIncluded = isMatrixRowEnabled(rowEnabled, 'consolidated')
  const genderIncluded = isMatrixRowEnabled(rowEnabled, 'gender')

  const yearTotalsSource: 'consolidated' | 'year_only_gender' | 'gender_totals' | null =
    showConsolidated
      ? 'consolidated'
      : showYearOnlyGender
        ? 'year_only_gender'
        : hasGenderBreakdown
          ? 'gender_totals'
          : null

  const yearTotalsIncluded =
    yearTotalsSource === 'consolidated'
      ? consolidatedIncluded
      : yearTotalsSource === 'year_only_gender' || yearTotalsSource === 'gender_totals'
        ? genderIncluded
        : true

  function yearTotalValue(yearId: number): string {
    if (yearTotalsSource === 'consolidated') {
      return readCell(
        consolidatedValues,
        savedConsolidatedByIndicator,
        indicator.id,
        yearId,
        DIMENSION_TOTAL_COLUMN_ID,
        readOnly,
      )
    }
    if (yearTotalsSource === 'year_only_gender') {
      return readCell(
        genderValues,
        savedGenderByIndicator,
        indicator.id,
        yearId,
        YEAR_ONLY_GENDER_ID,
        readOnly,
      )
    }
    if (yearTotalsSource === 'gender_totals') {
      return readCell(
        genderValues,
        savedGenderByIndicator,
        indicator.id,
        yearId,
        DIMENSION_TOTAL_COLUMN_ID,
        readOnly,
      )
    }
    return ''
  }

  function setYearTotal(yearId: number, value: string) {
    if (yearTotalsSource === 'consolidated') {
      onConsolidatedChange?.(indicator.id, yearId, DIMENSION_TOTAL_COLUMN_ID, value)
      return
    }
    if (yearTotalsSource === 'year_only_gender') {
      onGenderChange?.(indicator.id, yearId, YEAR_ONLY_GENDER_ID, value)
      return
    }
    if (yearTotalsSource === 'gender_totals') {
      onGenderChange?.(indicator.id, yearId, DIMENSION_TOTAL_COLUMN_ID, value)
    }
  }

  const grandTotal = years.reduce((sum, y) => {
    if (!yearTotalsIncluded) return sum
    return sum + num(yearTotalValue(y.year_id))
  }, 0)

  const dimensions = useMemo(() => {
    const dims: DimDef[] = []
    const gCols = genderColumnsForIndicator(indicator)
    if (indicator.collects_by_gender && gCols.length > 0) {
      dims.push({
        key: 'gender',
        title: 'Gender Disaggregate',
        columns: gCols,
        values: genderValues,
        saved: savedGenderByIndicator,
        onChange: onGenderChange,
        cellAllowed: (yearId, columnId) =>
          indicatorGenderCellAllowed(indicator, yearId, Number(columnId)),
      })
    }
    if (indicator.collects_by_age) {
      dims.push({
        key: 'age',
        title: 'Age Disaggregate',
        columns: ageColumns(),
        values: ageValues,
        saved: savedAgeByIndicator,
        onChange: onAgeChange,
        cellAllowed: (yearId, columnId) =>
          indicatorFixedKeyCellAllowed(
            indicator,
            yearId,
            (i) => Boolean(i.collects_by_age),
            AGE_KEYS,
            String(columnId),
          ),
      })
    }
    if (indicator.collects_by_disability) {
      dims.push({
        key: 'disability',
        title: 'PWDs Disaggregated',
        columns: disabilityColumns(savedDisabilityByIndicator),
        values: disabilityValues,
        saved: savedDisabilityByIndicator,
        onChange: onDisabilityChange,
        cellAllowed: (yearId, columnId) =>
          indicatorFixedKeyCellAllowed(
            indicator,
            yearId,
            (i) => Boolean(i.collects_by_disability),
            DISABILITY_KEYS,
            String(columnId),
          ),
      })
    }
    if (indicator.collects_by_location && districts.length > 0) {
      dims.push({
        key: 'district',
        title: 'District Disaggregate',
        columns: districtColumns(districts),
        values: districtValues,
        saved: savedDistrictByIndicator,
        onChange: onDistrictChange,
        cellAllowed: (yearId, columnId) =>
          indicatorCatalogCellAllowed(
            indicator,
            yearId,
            (i) => Boolean(i.collects_by_location),
            Number(columnId),
          ),
      })
    }
    if (indicator.collects_by_religion && religions.length > 0) {
      dims.push({
        key: 'religion',
        title: 'Religion Disaggregate',
        columns: religionColumns(religions),
        values: religionValues,
        saved: savedReligionByIndicator,
        onChange: onReligionChange,
        cellAllowed: (yearId, columnId) =>
          indicatorReligionCellAllowed(indicator, yearId, Number(columnId)),
      })
    }
    return dims
  }, [
    indicator,
    districts,
    religions,
    genderValues,
    ageValues,
    disabilityValues,
    districtValues,
    religionValues,
    savedGenderByIndicator,
    savedAgeByIndicator,
    savedDisabilityByIndicator,
    savedDistrictByIndicator,
    savedReligionByIndicator,
    onGenderChange,
    onAgeChange,
    onDisabilityChange,
    onDistrictChange,
    onReligionChange,
  ])

  const title = indicator.indicator_text?.trim() || `Indicator #${indicator.id}`
  const showYearTotalsBar = yearTotalsSource != null && years.length > 0
  const showToggle = !readOnly && onRowEnabledChange != null

  return (
    <article className="iwd-card">
      <header className="iwd-card__toolbar">
        <strong className="iwd-card__toolbar-title">
          #{ordinal} {title}
        </strong>
      </header>

      <div className="iwd-card__body">
        <div className="iwd-card__indicator-banner" title={title}>
          {title}
        </div>

        {showYearTotalsBar ? (
          <section className="iwd-totals" aria-label="Year totals">
            <div className="iwd-totals__head">
              <div className="iwd-totals__label">Year totals</div>
              {showToggle && yearTotalsSource === 'consolidated' ? (
                <MatrixRowEnableToggle
                  enabled={consolidatedIncluded}
                  onChange={(enabled) => onRowEnabledChange?.('consolidated', enabled)}
                  label="Include consolidated year totals"
                />
              ) : null}
              {showToggle && yearTotalsSource === 'year_only_gender' ? (
                <MatrixRowEnableToggle
                  enabled={genderIncluded}
                  onChange={(enabled) => onRowEnabledChange?.('gender', enabled)}
                  label="Include year totals"
                />
              ) : null}
              {readOnly && !yearTotalsIncluded ? (
                <span className="iwd-totals__na-badge">data not available</span>
              ) : null}
            </div>
            {!yearTotalsIncluded ? (
              <p className="muted text-compact iwd-totals__na-msg" style={{ margin: 0 }}>
                Year totals marked as N/A (data not available).
              </p>
            ) : (
              <div className="iwd-totals__years">
                {years.map((y) => (
                  <label key={y.year_id} className="iwd-totals__year">
                    <span className="iwd-totals__year-label">{y.label}</span>
                    {readOnly ? (
                      <span className="iwd-totals__value">{num(yearTotalValue(y.year_id))}</span>
                    ) : (
                      <input
                        className="iwd-sheet__input iwd-totals__input"
                        type="number"
                        min={0}
                        step={1}
                        value={yearTotalValue(y.year_id)}
                        onChange={(e) => setYearTotal(y.year_id, e.target.value)}
                        aria-label={`${title} total ${y.label}`}
                      />
                    )}
                  </label>
                ))}
                <div className="iwd-totals__year iwd-totals__year--grand">
                  <span className="iwd-totals__year-label">Grand Total</span>
                  <span className="iwd-totals__value">{grandTotal}</span>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {dimensions.map((dim) => {
          const included = isMatrixRowEnabled(rowEnabled, dim.key)
          return (
            <DimensionYearPanels
              key={dim.key}
              def={dim}
              years={years}
              indicatorId={indicator.id}
              yearTotalFor={(yearId) =>
                yearTotalsIncluded ? num(yearTotalValue(yearId)) : null
              }
              included={included}
              readOnly={readOnly}
              showToggle={showToggle}
              onToggleIncluded={
                onRowEnabledChange ? (enabled) => onRowEnabledChange(dim.key, enabled) : undefined
              }
            />
          )
        })}
      </div>
    </article>
  )
}

function DimensionYearPanels({
  def,
  years,
  indicatorId,
  yearTotalFor,
  included,
  readOnly,
  showToggle,
  onToggleIncluded,
}: {
  def: DimDef
  years: Array<{ year_id: number; label: string }>
  indicatorId: number
  yearTotalFor: (yearId: number) => number | null
  included: boolean
  readOnly: boolean
  showToggle: boolean
  onToggleIncluded?: (enabled: boolean) => void
}) {
  if (years.length === 0 || def.columns.length === 0) return null

  function cellValue(yearId: number, columnId: number | string): string {
    return readCell(def.values, def.saved, indicatorId, yearId, columnId, readOnly)
  }

  function handleChange(yearId: number, columnId: number | string, value: string) {
    if (!def.onChange) return
    const total = sumBreakdown(
      (colId) => cellValue(yearId, colId),
      def.columns,
      (colId) => def.cellAllowed(yearId, colId),
      { columnId, value },
    )
    def.onChange(indicatorId, yearId, columnId, value, total !== '' ? total : undefined)
  }

  return (
    <section className={`iwd-dim${!included ? ' iwd-dim--na' : ''}`}>
      <div className="iwd-dim__title-row">
        <h4 className="iwd-dim__title">{def.title}</h4>
        {showToggle && onToggleIncluded ? (
          <MatrixRowEnableToggle
            enabled={included}
            onChange={onToggleIncluded}
            label={`Include ${def.title}`}
          />
        ) : null}
        {readOnly && !included ? (
          <span className="iwd-totals__na-badge">data not available</span>
        ) : null}
      </div>

      {!included ? (
        <p className="muted text-compact" style={{ margin: 0 }}>
          This dimension is marked as N/A (data not available).
        </p>
      ) : (
        <div className="iwd-dim__years">
          {years.map((y) => {
            const yt = yearTotalFor(y.year_id)
            const distributedRaw = sumBreakdown(
              (colId) => cellValue(y.year_id, colId),
              def.columns,
              (colId) => def.cellAllowed(y.year_id, colId),
            )
            const distributed = distributedRaw === '' ? 0 : num(distributedRaw)
            const ua = yt == null ? null : yt - distributed
            const over = ua != null && ua < 0
            const dimTotal = cellValue(y.year_id, DIMENSION_TOTAL_COLUMN_ID)
            const totalDisplay = yt != null ? yt : dimTotal === '' ? distributed : num(dimTotal)

            return (
              <div key={y.year_id} className="iwd-year-panel">
                <div className="iwd-year-panel__head">{y.label}</div>
                <div className="iwd-year-panel__scroll">
                  <table className="iwd-year-panel__table">
                    <thead>
                      <tr>
                        {def.columns.map((c) => (
                          <th key={String(c.id)}>{c.label}</th>
                        ))}
                        <th className="iwd-year-panel__ua-h">Unaccounted</th>
                        <th className="iwd-year-panel__total-h">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {def.columns.map((c) => {
                          const allowed = def.cellAllowed(y.year_id, c.id)
                          return (
                            <td key={String(c.id)}>
                              {!allowed ? (
                                <span className="iwd-sheet__num muted">—</span>
                              ) : readOnly ? (
                                <span className="iwd-sheet__num">
                                  {cellValue(y.year_id, c.id) === ''
                                    ? ''
                                    : num(cellValue(y.year_id, c.id))}
                                </span>
                              ) : (
                                <input
                                  className="iwd-sheet__input"
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={cellValue(y.year_id, c.id)}
                                  onChange={(e) => handleChange(y.year_id, c.id, e.target.value)}
                                  aria-label={`${def.title} ${c.label} ${y.label}`}
                                />
                              )}
                            </td>
                          )
                        })}
                        <td
                          className={`iwd-year-panel__ua${over ? ' is-over' : ''}`}
                        >
                          {ua == null ? '—' : ua}
                        </td>
                        <td className="iwd-year-panel__total">{totalDisplay}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function DepartmentIndicatorDisaggregationMatrices({
  indicators,
  indicatorOrdinals,
  genderValues,
  ageValues,
  disabilityValues,
  districtValues,
  religionValues,
  consolidatedValues,
  districts,
  religions,
  onGenderChange,
  onAgeChange,
  onDisabilityChange,
  onDistrictChange,
  onReligionChange,
  onConsolidatedChange,
  rowEnabledByIndicator,
  onRowEnabledChange,
  readOnly = false,
  savedGenderByIndicator,
  savedAgeByIndicator,
  savedDisabilityByIndicator,
  savedDistrictByIndicator,
  savedReligionByIndicator,
  savedConsolidatedByIndicator,
}: Props) {
  const matrixIndicators = useMemo(
    () =>
      indicators.filter(
        (ind) => ind.has_quantitative && ind.collects_by_year && indicatorUsesAnyDataMatrix(ind),
      ),
    [indicators],
  )

  if (matrixIndicators.length === 0) return null

  return (
    <div className="iwd-wireframe__card-list dept-iwd-entry">
      {!readOnly && onRowEnabledChange ? (
        <p className="muted text-compact dept-data-matrix-stack__toggle-hint" style={{ margin: 0 }}>
          Use the Include switch on year totals or each dimension to mark it as required (On) or not
          required (N/A), based on instructions from your officer.
        </p>
      ) : null}
      {matrixIndicators.map((ind, index) => (
        <DepartmentIndicatorDataCard
          key={ind.id}
          ordinal={indicatorOrdinals?.[ind.id] ?? index + 1}
          indicator={ind}
          districts={districts}
          religions={religions}
          genderValues={genderValues}
          ageValues={ageValues}
          disabilityValues={disabilityValues}
          districtValues={districtValues}
          religionValues={religionValues}
          consolidatedValues={consolidatedValues}
          onGenderChange={onGenderChange}
          onAgeChange={onAgeChange}
          onDisabilityChange={onDisabilityChange}
          onDistrictChange={onDistrictChange}
          onReligionChange={onReligionChange}
          onConsolidatedChange={onConsolidatedChange}
          rowEnabled={rowEnabledByIndicator?.[ind.id]}
          onRowEnabledChange={
            onRowEnabledChange
              ? (dimension, enabled) => onRowEnabledChange(ind.id, dimension, enabled)
              : undefined
          }
          readOnly={readOnly}
          savedGenderByIndicator={savedGenderByIndicator}
          savedAgeByIndicator={savedAgeByIndicator}
          savedDisabilityByIndicator={savedDisabilityByIndicator}
          savedDistrictByIndicator={savedDistrictByIndicator}
          savedReligionByIndicator={savedReligionByIndicator}
          savedConsolidatedByIndicator={savedConsolidatedByIndicator}
        />
      ))}
    </div>
  )
}
