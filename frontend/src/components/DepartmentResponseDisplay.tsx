import { useEffect, useMemo, useState } from 'react'
import { fetchDistricts, type DistrictRow } from '../api/districts'
import { fetchCollectionReligions, type CollectionReligionRow } from '../api/collectionReligions'
import { fetchRegions, type RegionRow } from '../api/regions'
import { loadYearKeyedValuesFromBundle } from '../lib/departmentMatrixLoaders'
import {
  parseDepartmentTaskResponseData,
  type DepartmentIndicatorBundle,
} from '../lib/departmentTaskResponseFormat'
import { parseMatrixRowEnabled } from '../lib/deptMatrixRowEnabled'
import type { MatrixDimensionKey } from '../lib/deptMatrixRowEnabled'
import { scopeLocationCatalogToRegions } from '../lib/departmentLocationCatalog'
import { deptFormUsesIndicatorMatrix, indicatorUsesDataMatrix } from '../lib/indicatorMatrixColumns'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { DepartmentIndicatorDisaggregationMatrices } from './DepartmentIndicatorDisaggregationMatrices'

function quantitativeHasMatrixData(bundle: DepartmentIndicatorBundle): boolean {
  const q = bundle.quantitative
  if (!q) return false
  return Boolean(
    (q.by_year_gender && Object.keys(q.by_year_gender).length > 0) ||
      (q.by_year_age && Object.keys(q.by_year_age).length > 0) ||
      (q.by_year_disability && Object.keys(q.by_year_disability).length > 0) ||
      (q.by_year_district && Object.keys(q.by_year_district).length > 0) ||
      (q.by_year_religion && Object.keys(q.by_year_religion).length > 0) ||
      (q.by_year_others && Object.keys(q.by_year_others).length > 0),
  )
}

function bundleHasSupplementaryContent(bundle: DepartmentIndicatorBundle): boolean {
  const hasMatrix = quantitativeHasMatrixData(bundle)
  if (bundle.qualitative?.text?.trim() || bundle.qualitative?.attachment_url?.trim()) return true
  if (bundle.quantitative?.comment?.trim() || bundle.quantitative?.attachment_url?.trim()) return true
  if (
    bundle.quantitative?.value != null &&
    !Number.isNaN(bundle.quantitative.value) &&
    !hasMatrix
  ) {
    return true
  }
  return false
}

export function AttachmentViewLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="dept-response-attachment-btn">
      View attachment
    </a>
  )
}

type Props = {
  responseData: string | null | undefined
  attachmentUrl?: string | null
  onlyIndicatorIds?: number[]
  issueIndicators?: HrRequestIssueIndicator[]
  /** When set, region/district matrix columns are limited to these region(s). */
  locationRegionIds?: number[]
  /** When set, matrix columns are limited to this collection year. */
  filterYearId?: number
}

export function DepartmentResponseDisplay({
  responseData,
  attachmentUrl,
  onlyIndicatorIds,
  issueIndicators = [],
  locationRegionIds = [],
  filterYearId,
}: Props) {
  const [regions, setRegions] = useState<RegionRow[]>([])
  const [districts, setDistricts] = useState<DistrictRow[]>([])
  const [religions, setReligions] = useState<CollectionReligionRow[]>([])
  const parsed = parseDepartmentTaskResponseData(responseData, attachmentUrl)

  useEffect(() => {
    let cancelled = false
    void Promise.all([fetchRegions(), fetchDistricts(), fetchCollectionReligions()])
      .then(([regionRows, districtRows, religionRows]) => {
        if (!cancelled) {
          setRegions(regionRows)
          setDistricts(districtRows)
          setReligions(religionRows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegions([])
          setDistricts([])
          setReligions([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const scopedLocationCatalog = useMemo(
    () => scopeLocationCatalogToRegions(regions, districts, locationRegionIds),
    [regions, districts, locationRegionIds],
  )

  if (parsed.kind === 'legacy') {
    const text = parsed.text?.trim() ? parsed.text : '—'
    return (
      <>
        <textarea
          readOnly
          rows={8}
          value={text}
          className="hr-request-readonly-prose"
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        {parsed.attachmentUrl ? (
          <div style={{ marginTop: 10 }}>
            <AttachmentViewLink url={parsed.attachmentUrl} />
          </div>
        ) : null}
      </>
    )
  }

  let entries = Object.entries(parsed.payload.by_indicator).sort(([a], [b]) => Number(a) - Number(b))
  if (onlyIndicatorIds && onlyIndicatorIds.length > 0) {
    const allow = new Set(onlyIndicatorIds.map((id) => String(id)))
    entries = entries.filter(([id]) => allow.has(id))
  }
  if (entries.length === 0) {
    return <p className="muted">—</p>
  }

  const scopedIndicatorsBase =
    onlyIndicatorIds && onlyIndicatorIds.length > 0
      ? issueIndicators.filter((i) => onlyIndicatorIds.includes(i.id))
      : issueIndicators

  const scopedIndicators =
    filterYearId != null
      ? scopedIndicatorsBase.map((ind) => ({
          ...ind,
          collection_by_year: (ind.collection_by_year ?? []).filter(
            (y) => y.year_id === filterYearId,
          ),
        }))
      : scopedIndicatorsBase

  const matrixValues = useMemo(() => {
    const gender: Record<number, Record<string, string>> = {}
    const age: Record<number, Record<string, string>> = {}
    const disability: Record<number, Record<string, string>> = {}
    const district: Record<number, Record<string, string>> = {}
    const religion: Record<number, Record<string, string>> = {}
    const others: Record<number, Record<string, string>> = {}
    for (const [id, bundle] of entries) {
      const indicatorId = Number(id)
      const q = bundle.quantitative
      if (!q) continue
      if (q.by_year_gender) gender[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_gender, true)
      if (q.by_year_age) age[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_age, false)
      if (q.by_year_disability) disability[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_disability, false)
      if (q.by_year_district) district[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_district, true)
      if (q.by_year_religion) religion[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_religion, true)
      if (q.by_year_others) others[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_others, false)
    }
    return { gender, age, disability, district, religion, others }
  }, [entries])

  const rowEnabledByIndicator = useMemo(() => {
    const out: Record<number, Partial<Record<MatrixDimensionKey, boolean>>> = {}
    for (const [id, bundle] of entries) {
      const enabled = parseMatrixRowEnabled(bundle.quantitative?.matrix_row_enabled ?? undefined)
      if (Object.keys(enabled).length > 0) {
        out[Number(id)] = enabled
      }
    }
    return out
  }, [entries])

  const matrixIndicators = scopedIndicators.filter((ind) => {
    if (!indicatorUsesDataMatrix(ind)) return false
    const bundle = entries.find(([id]) => Number(id) === ind.id)?.[1]
    if (!bundle) return false
    return quantitativeHasMatrixData(bundle) || rowEnabledByIndicator[ind.id] != null
  })
  const showMatrix = matrixIndicators.length > 0 && deptFormUsesIndicatorMatrix(matrixIndicators)

  const cardEntries = entries.filter(([, bundle]) => bundleHasSupplementaryContent(bundle))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {showMatrix ? (
        <DepartmentIndicatorDisaggregationMatrices
          indicators={matrixIndicators}
          districts={scopedLocationCatalog.districts}
          religions={religions}
          genderValues={{}}
          ageValues={{}}
          disabilityValues={{}}
          districtValues={{}}
          religionValues={{}}
          othersValues={{}}
          readOnly
          savedGenderByIndicator={matrixValues.gender}
          savedAgeByIndicator={matrixValues.age}
          savedDisabilityByIndicator={matrixValues.disability}
          savedDistrictByIndicator={matrixValues.district}
          savedReligionByIndicator={matrixValues.religion}
          savedOthersByIndicator={matrixValues.others}
          rowEnabledByIndicator={rowEnabledByIndicator}
        />
      ) : null}
      {cardEntries.map(([id, bundle]) => {
        const title = bundle.indicator_label?.trim() || `Indicator #${id}`
        const hasMatrix = quantitativeHasMatrixData(bundle)
        return (
          <div
            key={id}
            style={{
              padding: 12,
              border: '1px solid var(--field-border, #e1e7f5)',
              borderRadius: 10,
              background: 'var(--field-bg, #fafbfd)',
            }}
          >
            <strong className="text-sm font-semibold" style={{ display: 'block', marginBottom: 10 }}>
              {title}
            </strong>
            {bundle.quantitative ? (
              <div style={{ marginBottom: bundle.qualitative ? 12 : 0 }}>
                {!hasMatrix ? (
                  <>
                    <div className="muted small" style={{ marginBottom: 6 }}>
                      Quantitative
                    </div>
                    <div className="text-sm">Number: {bundle.quantitative.value}</div>
                  </>
                ) : null}
                {bundle.quantitative.comment ? (
                  <p className="muted small" style={{ margin: hasMatrix ? '0 0 6px' : '6px 0 0' }}>
                    Comment: {bundle.quantitative.comment}
                  </p>
                ) : null}
                {bundle.quantitative.attachment_url ? (
                  <div style={{ marginTop: 8 }}>
                    <AttachmentViewLink url={bundle.quantitative.attachment_url} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {bundle.qualitative ? (
              <div>
                <div className="muted small" style={{ marginBottom: 6 }}>
                  Qualitative
                </div>
                {bundle.qualitative.text ? (
                  <p className="text-sm" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {bundle.qualitative.text}
                  </p>
                ) : (
                  <p className="muted small" style={{ margin: 0 }}>
                    (No narrative text)
                  </p>
                )}
                {bundle.qualitative.attachment_url ? (
                  <div style={{ marginTop: 8 }}>
                    <AttachmentViewLink url={bundle.qualitative.attachment_url} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
