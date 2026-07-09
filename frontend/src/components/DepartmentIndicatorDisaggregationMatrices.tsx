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
  indicatorCatalogCellAllowed,
  indicatorFixedKeyCellAllowed,
  indicatorGenderCellAllowed,
  indicatorIsYearOnly,
  indicatorReligionCellAllowed,
} from '../lib/indicatorDisaggregation'
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
  districts: DistrictRow[]
  religions: CollectionReligionRow[]
  onGenderChange?: (indicatorId: number, yearId: number, columnId: number | string, value: string) => void
  onAgeChange?: (indicatorId: number, yearId: number, columnId: number | string, value: string) => void
  onDisabilityChange?: (indicatorId: number, yearId: number, columnId: number | string, value: string) => void
  onDistrictChange?: (indicatorId: number, yearId: number, columnId: number | string, value: string) => void
  onReligionChange?: (indicatorId: number, yearId: number, columnId: number | string, value: string) => void
  readOnly?: boolean
  savedGenderByIndicator?: MatrixValues
  savedAgeByIndicator?: MatrixValues
  savedDisabilityByIndicator?: MatrixValues
  savedDistrictByIndicator?: MatrixValues
  savedReligionByIndicator?: MatrixValues
}

function indicatorsForDimension(
  indicators: HrRequestIssueIndicator[],
  enabled: (ind: HrRequestIssueIndicator) => boolean,
): HrRequestIssueIndicator[] {
  return indicators.filter((ind) => ind.collects_by_year && enabled(ind))
}

export function DepartmentIndicatorDisaggregationMatrices({
  indicators,
  genderValues,
  ageValues,
  disabilityValues,
  districtValues,
  religionValues,
  districts,
  religions,
  onGenderChange,
  onAgeChange,
  onDisabilityChange,
  onDistrictChange,
  onReligionChange,
  readOnly = false,
  savedGenderByIndicator,
  savedAgeByIndicator,
  savedDisabilityByIndicator,
  savedDistrictByIndicator,
  savedReligionByIndicator,
}: Props) {
  const genderIndicators = useMemo(
    () =>
      indicators.filter(
        (ind) => ind.collects_by_year && (indicatorIsYearOnly(ind) || ind.collects_by_gender),
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

  return (
    <div className="dept-data-matrix-stack">
      <DepartmentDisaggregationMatrixTable
        title="Gender"
        indicators={genderIndicators}
        columnGroups={genderGroups}
        cellValues={genderValues}
        onCellChange={onGenderChange}
        readOnly={readOnly}
        savedByIndicator={savedGenderByIndicator}
        cellAllowed={(ind, yearId, columnId) =>
          indicatorGenderCellAllowed(ind, yearId, Number(columnId))
        }
        columnHeaderClass={genderHeaderClass}
        hint="Enter a number for each year and gender combination required for that metric."
      />
      <DepartmentDisaggregationMatrixTable
        title="Age"
        indicators={ageIndicators}
        columnGroups={ageGroups}
        cellValues={ageValues}
        onCellChange={onAgeChange}
        readOnly={readOnly}
        savedByIndicator={savedAgeByIndicator}
        cellAllowed={(ind, yearId, columnId) =>
          indicatorFixedKeyCellAllowed(
            ind,
            yearId,
            (i) => Boolean(i.collects_by_age),
            AGE_KEYS,
            String(columnId),
          )
        }
        hint="Enter a number for Under 18, 18 - 60, and Above 60 for each configured year."
      />
      <DepartmentDisaggregationMatrixTable
        title="Persons with disability"
        indicators={disabilityIndicators}
        columnGroups={disabilityGroups}
        cellValues={disabilityValues}
        onCellChange={onDisabilityChange}
        readOnly={readOnly}
        savedByIndicator={savedDisabilityByIndicator}
        cellAllowed={(ind, yearId, columnId) =>
          indicatorFixedKeyCellAllowed(
            ind,
            yearId,
            (i) => Boolean(i.collects_by_disability),
            DISABILITY_KEYS,
            String(columnId),
          )
        }
        hint="Enter the count of persons with disability for each configured year."
      />
      <DepartmentDisaggregationMatrixTable
        title="District"
        indicators={locationIndicators}
        columnGroups={districtGroups}
        cellValues={districtValues}
        onCellChange={onDistrictChange}
        readOnly={readOnly}
        savedByIndicator={savedDistrictByIndicator}
        cellAllowed={(ind, yearId, columnId) =>
          indicatorCatalogCellAllowed(ind, yearId, (i) => Boolean(i.collects_by_location), Number(columnId))
        }
        hint="Enter a number for each district in your assigned region and configured year. Leave blank for zero."
      />
      <DepartmentDisaggregationMatrixTable
        title="Religion"
        indicators={religionIndicators}
        columnGroups={religionGroups}
        cellValues={religionValues}
        onCellChange={onReligionChange}
        readOnly={readOnly}
        savedByIndicator={savedReligionByIndicator}
        cellAllowed={(ind, yearId, columnId) =>
          indicatorReligionCellAllowed(ind, yearId, Number(columnId))
        }
        hint="Enter a number for each religion and configured year."
      />
    </div>
  )
}
