import { useMemo } from 'react'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import type { DistrictRow } from '../api/districts'
import type { CollectionReligionRow } from '../api/collectionReligions'
import {
  AGE_KEYS,
  AGE_LABELS,
  DISABILITY_KEYS,
  DISABILITY_LABELS,
  buildCatalogMatrixGroups,
  buildFixedKeyMatrixGroups,
  buildGenderMatrixGroups,
  buildReligionMatrixGroups,
  buildYearTotalOnlyMatrixGroups,
  indicatorCatalogCellAllowed,
  indicatorFixedKeyCellAllowed,
  indicatorGenderCellAllowed,
  indicatorIsYearOnly,
  indicatorReligionCellAllowed,
} from '../lib/indicatorDisaggregation'
import type { MatrixDimensionKey } from '../lib/deptMatrixRowEnabled'
import { isMatrixRowEnabled } from '../lib/deptMatrixRowEnabled'
import { DepartmentDisaggregationMatrixTable } from './DepartmentDisaggregationMatrixTable'

function genderHeaderClass(name: string): string {
  const n = name.trim().toLowerCase()
  if (n.includes('female') && !n.includes('male')) return 'dept-data-matrix__gender--female'
  if (n.includes('male')) return 'dept-data-matrix__gender--male'
  if (n.includes('trans')) return 'dept-data-matrix__gender--trans'
  return 'dept-data-matrix__gender--other'
}

type MatrixValues = Record<number, Record<string, string>>

type Props = {
  indicators: HrRequestIssueIndicator[]
  genderValues: MatrixValues
  ageValues: MatrixValues
  disabilityValues: MatrixValues
  districtValues: MatrixValues
  religionValues: MatrixValues
  othersValues: MatrixValues
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
  onOthersChange?: (
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
  savedOthersByIndicator?: MatrixValues
}

function indicatorsForDimension(
  indicators: HrRequestIssueIndicator[],
  enabled: (ind: HrRequestIssueIndicator) => boolean,
): HrRequestIssueIndicator[] {
  return indicators.filter(
    (ind) => ind.has_quantitative && ind.collects_by_year && enabled(ind),
  )
}

export function DepartmentIndicatorDisaggregationMatrices({
  indicators,
  genderValues,
  ageValues,
  disabilityValues,
  districtValues,
  religionValues,
  othersValues,
  districts,
  religions,
  onGenderChange,
  onAgeChange,
  onDisabilityChange,
  onDistrictChange,
  onReligionChange,
  onOthersChange,
  rowEnabledByIndicator,
  onRowEnabledChange,
  readOnly = false,
  savedGenderByIndicator,
  savedAgeByIndicator,
  savedDisabilityByIndicator,
  savedDistrictByIndicator,
  savedReligionByIndicator,
  savedOthersByIndicator,
}: Props) {
  const genderIndicators = useMemo(
    () =>
      indicators.filter(
        (ind) =>
          ind.has_quantitative &&
          ind.collects_by_year &&
          (indicatorIsYearOnly(ind) || ind.collects_by_gender),
      ),
    [indicators],
  )
  const ageIndicators = useMemo(
    () => indicatorsForDimension(indicators, (ind) => Boolean(ind.collects_by_age)),
    [indicators],
  )
  const disabilityIndicators = useMemo(
    () => indicatorsForDimension(indicators, (ind) => Boolean(ind.collects_by_disability)),
    [indicators],
  )
  const locationIndicators = useMemo(
    () => indicatorsForDimension(indicators, (ind) => Boolean(ind.collects_by_location)),
    [indicators],
  )
  const religionIndicators = useMemo(
    () => indicatorsForDimension(indicators, (ind) => Boolean(ind.collects_by_religion)),
    [indicators],
  )
  const othersIndicators = useMemo(
    () => indicatorsForDimension(indicators, (ind) => Boolean(ind.collects_by_others)),
    [indicators],
  )

  const genderGroups = useMemo(() => buildGenderMatrixGroups(genderIndicators), [genderIndicators])
  const ageGroups = useMemo(
    () =>
      buildFixedKeyMatrixGroups(
        ageIndicators,
        'age',
        (ind) => Boolean(ind.collects_by_age),
        AGE_KEYS,
        AGE_LABELS,
      ),
    [ageIndicators],
  )
  const disabilityGroups = useMemo(
    () =>
      buildFixedKeyMatrixGroups(
        disabilityIndicators,
        'disability',
        (ind) => Boolean(ind.collects_by_disability),
        DISABILITY_KEYS,
        DISABILITY_LABELS,
      ),
    [disabilityIndicators],
  )
  const districtGroups = useMemo(
    () =>
      buildCatalogMatrixGroups(
        locationIndicators,
        (ind) => Boolean(ind.collects_by_location),
        districts.map((d) => ({ id: d.id, name: d.name })),
      ),
    [locationIndicators, districts],
  )
  const religionGroups = useMemo(
    () =>
      buildReligionMatrixGroups(
        religionIndicators,
        religions.map((r) => ({ id: r.id, name: r.name })),
      ),
    [religionIndicators, religions],
  )
  const othersGroups = useMemo(
    () =>
      buildYearTotalOnlyMatrixGroups(othersIndicators, (ind) => Boolean(ind.collects_by_others)),
    [othersIndicators],
  )

  function handleRowEnabledChange(dimension: MatrixDimensionKey, indicatorId: number, enabled: boolean) {
    onRowEnabledChange?.(indicatorId, dimension, enabled)
  }

  const genderRowEnabled = useMemo(() => {
    const out: Record<number, boolean> = {}
    for (const ind of indicators) {
      out[ind.id] = isMatrixRowEnabled(rowEnabledByIndicator?.[ind.id], 'gender')
    }
    return out
  }, [indicators, rowEnabledByIndicator])

  const ageRowEnabled = useMemo(() => {
    const out: Record<number, boolean> = {}
    for (const ind of indicators) {
      out[ind.id] = isMatrixRowEnabled(rowEnabledByIndicator?.[ind.id], 'age')
    }
    return out
  }, [indicators, rowEnabledByIndicator])

  const disabilityRowEnabled = useMemo(() => {
    const out: Record<number, boolean> = {}
    for (const ind of indicators) {
      out[ind.id] = isMatrixRowEnabled(rowEnabledByIndicator?.[ind.id], 'disability')
    }
    return out
  }, [indicators, rowEnabledByIndicator])

  const districtRowEnabled = useMemo(() => {
    const out: Record<number, boolean> = {}
    for (const ind of indicators) {
      out[ind.id] = isMatrixRowEnabled(rowEnabledByIndicator?.[ind.id], 'district')
    }
    return out
  }, [indicators, rowEnabledByIndicator])

  const religionRowEnabled = useMemo(() => {
    const out: Record<number, boolean> = {}
    for (const ind of indicators) {
      out[ind.id] = isMatrixRowEnabled(rowEnabledByIndicator?.[ind.id], 'religion')
    }
    return out
  }, [indicators, rowEnabledByIndicator])

  const othersRowEnabled = useMemo(() => {
    const out: Record<number, boolean> = {}
    for (const ind of indicators) {
      out[ind.id] = isMatrixRowEnabled(rowEnabledByIndicator?.[ind.id], 'others')
    }
    return out
  }, [indicators, rowEnabledByIndicator])

  return (
    <div className="dept-data-matrix-stack">
      {!readOnly && onRowEnabledChange ? (
        <p className="muted text-compact dept-data-matrix-stack__toggle-hint" style={{ margin: 0 }}>
          Use the Include switch on each row to mark a metric as required (On) or not required (N/A) for that
          dimension, based on instructions from your officer.
        </p>
      ) : null}
      <DepartmentDisaggregationMatrixTable
        title="Year Wise Consolidated Data"
        indicators={othersIndicators}
        columnGroups={othersGroups}
        cellValues={othersValues}
        onCellChange={onOthersChange}
        readOnly={readOnly}
        savedByIndicator={savedOthersByIndicator}
        dimensionKey="others"
        rowEnabledByIndicator={rowEnabledByIndicator ? othersRowEnabled : undefined}
        onRowEnabledChange={
          onRowEnabledChange
            ? (indicatorId, enabled) => handleRowEnabledChange('others', indicatorId, enabled)
            : undefined
        }
        cellAllowed={() => true}
        showYearTotals
        showGrandTotal={false}
        hint="Enter a Total count for each configured year."
      />
      <DepartmentDisaggregationMatrixTable
        title="Gender"
        indicators={genderIndicators}
        columnGroups={genderGroups}
        cellValues={genderValues}
        onCellChange={onGenderChange}
        readOnly={readOnly}
        savedByIndicator={savedGenderByIndicator}
        dimensionKey="gender"
        rowEnabledByIndicator={rowEnabledByIndicator ? genderRowEnabled : undefined}
        onRowEnabledChange={
          onRowEnabledChange
            ? (indicatorId, enabled) => handleRowEnabledChange('gender', indicatorId, enabled)
            : undefined
        }
        cellAllowed={(ind, yearId, columnId) =>
          indicatorGenderCellAllowed(ind, yearId, Number(columnId))
        }
        columnHeaderClass={genderHeaderClass}
        showYearTotals
        hint="Enter gender values when available — Total updates automatically. If you only know the overall count, enter it in Total."
      />
      <DepartmentDisaggregationMatrixTable
        title="Age"
        indicators={ageIndicators}
        columnGroups={ageGroups}
        cellValues={ageValues}
        onCellChange={onAgeChange}
        readOnly={readOnly}
        savedByIndicator={savedAgeByIndicator}
        dimensionKey="age"
        rowEnabledByIndicator={rowEnabledByIndicator ? ageRowEnabled : undefined}
        onRowEnabledChange={
          onRowEnabledChange
            ? (indicatorId, enabled) => handleRowEnabledChange('age', indicatorId, enabled)
            : undefined
        }
        cellAllowed={(ind, yearId, columnId) =>
          indicatorFixedKeyCellAllowed(
            ind,
            yearId,
            (i) => Boolean(i.collects_by_age),
            AGE_KEYS,
            String(columnId),
          )
        }
        showYearTotals
        hint="Enter age-band values when available — Total updates automatically. If you only know the overall count, enter it in Total."
      />
      <DepartmentDisaggregationMatrixTable
        title="Persons with disability"
        indicators={disabilityIndicators}
        columnGroups={disabilityGroups}
        cellValues={disabilityValues}
        onCellChange={onDisabilityChange}
        readOnly={readOnly}
        savedByIndicator={savedDisabilityByIndicator}
        dimensionKey="disability"
        rowEnabledByIndicator={rowEnabledByIndicator ? disabilityRowEnabled : undefined}
        onRowEnabledChange={
          onRowEnabledChange
            ? (indicatorId, enabled) => handleRowEnabledChange('disability', indicatorId, enabled)
            : undefined
        }
        cellAllowed={(ind, yearId, columnId) =>
          indicatorFixedKeyCellAllowed(
            ind,
            yearId,
            (i) => Boolean(i.collects_by_disability),
            DISABILITY_KEYS,
            String(columnId),
          )
        }
        showYearTotals
        hint="Enter disability counts when available — Total updates automatically. If you only know the overall count, enter it in Total."
      />
      <DepartmentDisaggregationMatrixTable
        title="District"
        indicators={locationIndicators}
        columnGroups={districtGroups}
        cellValues={districtValues}
        onCellChange={onDistrictChange}
        readOnly={readOnly}
        savedByIndicator={savedDistrictByIndicator}
        dimensionKey="district"
        rowEnabledByIndicator={rowEnabledByIndicator ? districtRowEnabled : undefined}
        onRowEnabledChange={
          onRowEnabledChange
            ? (indicatorId, enabled) => handleRowEnabledChange('district', indicatorId, enabled)
            : undefined
        }
        cellAllowed={(ind, yearId, columnId) =>
          indicatorCatalogCellAllowed(ind, yearId, (i) => Boolean(i.collects_by_location), Number(columnId))
        }
        showYearTotals
        hint="Enter district values when available — Total updates automatically. Leave blank for zero. If you only know the overall count, enter it in Total."
      />
      <DepartmentDisaggregationMatrixTable
        title="Religion"
        indicators={religionIndicators}
        columnGroups={religionGroups}
        cellValues={religionValues}
        onCellChange={onReligionChange}
        readOnly={readOnly}
        savedByIndicator={savedReligionByIndicator}
        dimensionKey="religion"
        rowEnabledByIndicator={rowEnabledByIndicator ? religionRowEnabled : undefined}
        onRowEnabledChange={
          onRowEnabledChange
            ? (indicatorId, enabled) => handleRowEnabledChange('religion', indicatorId, enabled)
            : undefined
        }
        cellAllowed={(ind, yearId, columnId) =>
          indicatorReligionCellAllowed(ind, yearId, Number(columnId))
        }
        showYearTotals
        hint="Enter religion values when available — Total updates automatically. If you only know the overall count, enter it in Total."
      />
    </div>
  )
}
