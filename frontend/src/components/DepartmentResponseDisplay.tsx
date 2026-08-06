import { useEffect, useMemo, useState } from 'react'
import { fetchDistricts, type DistrictRow } from '../api/districts'
import { fetchCollectionReligions, type CollectionReligionRow } from '../api/collectionReligions'
import { fetchRegions, type RegionRow } from '../api/regions'
import { loadYearKeyedValuesFromBundle } from '../lib/departmentMatrixLoaders'
import {
  departmentResponseChallenges,
  parseDepartmentTaskResponseData,
  qualitativeTextsForDisplay,
  type DepartmentIndicatorBundle,
} from '../lib/departmentTaskResponseFormat'
import { indicatorQualitativeYears } from '../lib/indicatorDisaggregation'
import { parseMatrixRowEnabled } from '../lib/deptMatrixRowEnabled'
import type { MatrixDimensionKey } from '../lib/deptMatrixRowEnabled'
import { scopeLocationCatalogToRegions } from '../lib/departmentLocationCatalog'
import { deptFormUsesIndicatorMatrix, indicatorUsesDataMatrix } from '../lib/indicatorMatrixColumns'
import { buildResponseRevisionHighlight } from '../lib/responseRevisionDiff'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { DepartmentIndicatorDisaggregationMatrices } from './DepartmentIndicatorDisaggregationMatrices'
import { DeptResponseFormSection } from './DeptResponseFormSection'

function quantitativeHasMatrixData(bundle: DepartmentIndicatorBundle): boolean {
  const q = bundle.quantitative
  if (!q) return false
  return Boolean(
    (q.by_year_gender && Object.keys(q.by_year_gender).length > 0) ||
      (q.by_year_age && Object.keys(q.by_year_age).length > 0) ||
      (q.by_year_disability && Object.keys(q.by_year_disability).length > 0) ||
      (q.by_year_district && Object.keys(q.by_year_district).length > 0) ||
      (q.by_year_religion && Object.keys(q.by_year_religion).length > 0) ||
      ((q.by_year_consolidated ?? q.by_year_others) &&
        Object.keys(q.by_year_consolidated ?? q.by_year_others ?? {}).length > 0),
  )
}

function bundleHasQuantitativeText(bundle: DepartmentIndicatorBundle): boolean {
  const q = bundle.quantitative
  if (!q) return false
  const hasMatrix = quantitativeHasMatrixData(bundle)
  if (q.comment?.trim() || q.attachment_url?.trim()) return true
  if (q.value != null && !Number.isNaN(q.value) && !hasMatrix) return true
  return false
}

function bundleHasQualitativeContent(
  bundle: DepartmentIndicatorBundle,
  filterYearId?: number,
  qualYearLabels?: Array<{ year_id: number; label: string }>,
): boolean {
  if (qualitativeTextsForDisplay(bundle.qualitative, qualYearLabels, filterYearId).length > 0) {
    return true
  }
  return Boolean(bundle.qualitative?.attachment_url?.trim())
}

export function AttachmentViewLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="dept-response-attachment-btn">
      View attachment
    </a>
  )
}

/** Highlight whole block, or each changed line when multi-line text differs. */
function ChangedMultilineText({
  text,
  beforeText,
  changed,
  className = 'text-sm',
  prefix,
}: {
  text: string
  beforeText?: string | null
  changed: boolean
  className?: string
  prefix?: string
}) {
  if (!changed) {
    return (
      <p className={className} style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {prefix}
        {text}
      </p>
    )
  }

  const afterLines = text.replace(/\r\n/g, '\n').split('\n')
  const beforeLines = (beforeText ?? '').replace(/\r\n/g, '\n').split('\n')
  const useLineDiff = afterLines.length > 1 || beforeLines.length > 1

  if (!useLineDiff) {
    return (
      <p
        className={`${className} response-revision-changed response-revision-changed--block`}
        style={{ margin: 0, whiteSpace: 'pre-wrap' }}
      >
        {prefix}
        {text}
      </p>
    )
  }

  return (
    <div className={`${className} response-revision-text-diff`} style={{ margin: 0 }}>
      {prefix ? <div className="response-revision-text-diff__prefix muted small">{prefix}</div> : null}
      {afterLines.map((line, i) => {
        const lineChanged = (beforeLines[i] ?? '') !== line
        return (
          <div
            key={i}
            className={
              lineChanged
                ? 'response-revision-changed response-revision-changed--line'
                : 'response-revision-text-diff__line'
            }
          >
            {line.length > 0 ? line : '\u00a0'}
          </div>
        )
      })}
    </div>
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
  /**
   * Before-revision snapshot. When set, values that differ from this snapshot
   * are highlighted (Changes tab After column).
   */
  compareAgainstResponseData?: string | null
}

export function DepartmentResponseDisplay({
  responseData,
  attachmentUrl,
  onlyIndicatorIds,
  issueIndicators = [],
  locationRegionIds = [],
  filterYearId,
  compareAgainstResponseData,
}: Props) {
  const [regions, setRegions] = useState<RegionRow[]>([])
  const [districts, setDistricts] = useState<DistrictRow[]>([])
  const [religions, setReligions] = useState<CollectionReligionRow[]>([])
  const parsed = parseDepartmentTaskResponseData(responseData, attachmentUrl)

  const revisionHighlight = useMemo(() => {
    if (compareAgainstResponseData == null) return null
    return buildResponseRevisionHighlight(compareAgainstResponseData, responseData)
  }, [compareAgainstResponseData, responseData])

  const beforeParsed = useMemo(() => {
    if (compareAgainstResponseData == null) return null
    return parseDepartmentTaskResponseData(compareAgainstResponseData)
  }, [compareAgainstResponseData])

  const beforePayload = beforeParsed?.kind === 'structured' ? beforeParsed.payload : null

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

  const entries = useMemo(() => {
    if (parsed.kind !== 'structured') return [] as Array<[string, DepartmentIndicatorBundle]>
    let list = Object.entries(parsed.payload.by_indicator).sort(([a], [b]) => Number(a) - Number(b))
    if (onlyIndicatorIds && onlyIndicatorIds.length > 0) {
      const allow = new Set(onlyIndicatorIds.map((id) => String(id)))
      list = list.filter(([id]) => allow.has(id))
    }
    return list
  }, [parsed, onlyIndicatorIds])

  const scopedIndicators = useMemo(() => {
    const base =
      onlyIndicatorIds && onlyIndicatorIds.length > 0
        ? issueIndicators.filter((i) => onlyIndicatorIds.includes(i.id))
        : issueIndicators
    if (filterYearId == null) return base
    return base.map((ind) => ({
      ...ind,
      collection_by_year: (ind.collection_by_year ?? []).filter((y) => y.year_id === filterYearId),
      qualitative_collection_by_year: (ind.qualitative_collection_by_year ?? []).filter(
        (y) => y.year_id === filterYearId,
      ),
    }))
  }, [issueIndicators, onlyIndicatorIds, filterYearId])

  const matrixValues = useMemo(() => {
    const gender: Record<number, Record<string, string>> = {}
    const age: Record<number, Record<string, string>> = {}
    const disability: Record<number, Record<string, string>> = {}
    const district: Record<number, Record<string, string>> = {}
    const religion: Record<number, Record<string, string>> = {}
    const consolidated: Record<number, Record<string, string>> = {}
    for (const [id, bundle] of entries) {
      const indicatorId = Number(id)
      const q = bundle.quantitative
      if (!q) continue
      if (q.by_year_gender) gender[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_gender, true)
      if (q.by_year_age) age[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_age, false)
      if (q.by_year_disability) {
        disability[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_disability, false)
      }
      if (q.by_year_district) {
        district[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_district, true)
      }
      if (q.by_year_religion) {
        religion[indicatorId] = loadYearKeyedValuesFromBundle(q.by_year_religion, true)
      }
      const consolidatedBundle = q.by_year_consolidated ?? q.by_year_others
      if (consolidatedBundle) {
        consolidated[indicatorId] = loadYearKeyedValuesFromBundle(consolidatedBundle, false)
      }
    }
    return { gender, age, disability, district, religion, consolidated }
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

  if (parsed.kind === 'legacy') {
    const text = parsed.text?.trim() ? parsed.text : '—'
    const beforeParsed =
      compareAgainstResponseData != null
        ? parseDepartmentTaskResponseData(compareAgainstResponseData)
        : null
    const beforeText =
      beforeParsed?.kind === 'legacy' ? (beforeParsed.text?.trim() ?? '') : ''
    const textChanged =
      compareAgainstResponseData != null &&
      (parsed.text?.trim() ?? '') !== beforeText
    return (
      <>
        <textarea
          readOnly
          rows={8}
          value={text}
          className={`hr-request-readonly-prose${textChanged ? ' response-revision-changed' : ''}`}
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

  if (entries.length === 0) {
    return <p className="muted">—</p>
  }

  const matrixIndicators = scopedIndicators.filter((ind) => {
    if (!indicatorUsesDataMatrix(ind)) return false
    const bundle = entries.find(([id]) => Number(id) === ind.id)?.[1]
    if (!bundle) return false
    return quantitativeHasMatrixData(bundle) || rowEnabledByIndicator[ind.id] != null
  })
  const showMatrix = matrixIndicators.length > 0 && deptFormUsesIndicatorMatrix(matrixIndicators)

  const quantitativeTextEntries = entries.filter(([, bundle]) => bundleHasQuantitativeText(bundle))
  const qualitativeEntries = entries.filter(([id, bundle]) => {
    const ind = scopedIndicators.find((i) => i.id === Number(id))
    const qualYears = ind ? indicatorQualitativeYears(ind) : []
    return bundleHasQualitativeContent(bundle, filterYearId, qualYears)
  })
  const challengesText = departmentResponseChallenges(parsed.payload)
  const showQuantitativeSection = showMatrix || quantitativeTextEntries.length > 0
  const showQualitativeSection = qualitativeEntries.length > 0
  const showChallengesSection = Boolean(challengesText)

  const indicatorCardStyle = {
    padding: 12,
    border: '1px solid var(--field-border, #e1e7f5)',
    borderRadius: 10,
    background: 'var(--field-bg, #fafbfd)',
  } as const

  return (
    <div className="dept-response-display" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {showQuantitativeSection ? (
        <DeptResponseFormSection title="Quantitative data">
          {showMatrix ? (
            <DepartmentIndicatorDisaggregationMatrices
              indicators={matrixIndicators}
              indicatorOrdinals={Object.fromEntries(
                scopedIndicators.map((ind, index) => [ind.id, index + 1]),
              )}
              districts={scopedLocationCatalog.districts}
              religions={religions}
              genderValues={{}}
              ageValues={{}}
              disabilityValues={{}}
              districtValues={{}}
              religionValues={{}}
              consolidatedValues={{}}
              readOnly
              savedGenderByIndicator={matrixValues.gender}
              savedAgeByIndicator={matrixValues.age}
              savedDisabilityByIndicator={matrixValues.disability}
              savedDistrictByIndicator={matrixValues.district}
              savedReligionByIndicator={matrixValues.religion}
              savedConsolidatedByIndicator={matrixValues.consolidated}
              rowEnabledByIndicator={rowEnabledByIndicator}
              revisionHighlight={revisionHighlight}
            />
          ) : null}
          {quantitativeTextEntries.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                marginTop: showMatrix ? 14 : 0,
              }}
            >
              {quantitativeTextEntries.map(([id, bundle]) => {
                const title = bundle.indicator_label?.trim() || `Indicator #${id}`
                const hasMatrix = quantitativeHasMatrixData(bundle)
                const q = bundle.quantitative!
                const valueChanged = Boolean(revisionHighlight?.values.has(id))
                const commentChanged = Boolean(revisionHighlight?.comments.has(id))
                return (
                  <div key={`quant-${id}`} style={indicatorCardStyle}>
                    <strong className="text-sm font-semibold" style={{ display: 'block', marginBottom: 10 }}>
                      {title}
                    </strong>
                    {!hasMatrix && q.value != null && !Number.isNaN(q.value) ? (
                      <div
                        className={`text-sm${valueChanged ? ' response-revision-changed' : ''}`}
                        style={{ marginBottom: q.comment || q.attachment_url ? 8 : 0 }}
                      >
                        Number: {q.value}
                      </div>
                    ) : null}
                    {q.comment ? (
                      <ChangedMultilineText
                        className="muted small"
                        prefix="Please provide narrative related to the indicator: "
                        text={q.comment}
                        beforeText={
                          beforePayload?.by_indicator?.[id]?.quantitative?.comment ?? ''
                        }
                        changed={commentChanged}
                      />
                    ) : null}
                    {q.attachment_url ? (
                      <div style={{ marginTop: 8 }}>
                        <AttachmentViewLink url={q.attachment_url} />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </DeptResponseFormSection>
      ) : null}

      {showQualitativeSection ? (
        <DeptResponseFormSection title="Qualitative data">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {qualitativeEntries.map(([id, bundle]) => {
              const title = bundle.indicator_label?.trim() || `Indicator #${id}`
              const ind = scopedIndicators.find((i) => i.id === Number(id))
              const qualYears = ind ? indicatorQualitativeYears(ind) : []
              const qualRows = qualitativeTextsForDisplay(bundle.qualitative, qualYears, filterYearId)
              const showQualAttachment = Boolean(bundle.qualitative?.attachment_url?.trim())
              return (
                <div key={`qual-${id}`} style={indicatorCardStyle}>
                  <strong className="text-sm font-semibold" style={{ display: 'block', marginBottom: 10 }}>
                    {title}
                  </strong>
                  {qualRows.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {qualRows.map((row) => {
                        const qualKey =
                          row.year_id != null ? `${id}|${row.year_id}` : `${id}|legacy`
                        const textChanged = Boolean(revisionHighlight?.qualTexts.has(qualKey))
                        const beforeBundle = beforePayload?.by_indicator?.[id]
                        const beforeQual = beforeBundle?.qualitative
                        let beforeText = ''
                        if (row.year_id != null && beforeQual?.by_year) {
                          beforeText = beforeQual.by_year[String(row.year_id)]?.text ?? ''
                        } else {
                          beforeText = beforeQual?.text ?? ''
                        }
                        return (
                          <div key={`${id}-qual-${row.year_id ?? 'legacy'}-${row.label}`}>
                            {row.year_id != null || qualRows.length > 1 ? (
                              <div className="muted small" style={{ marginBottom: 4 }}>
                                {row.label}
                              </div>
                            ) : null}
                            <ChangedMultilineText
                              className="text-sm"
                              text={row.text}
                              beforeText={beforeText}
                              changed={textChanged}
                            />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="muted small" style={{ margin: 0 }}>
                      (No narrative text)
                    </p>
                  )}
                  {showQualAttachment ? (
                    <div style={{ marginTop: 8 }}>
                      <AttachmentViewLink url={bundle.qualitative!.attachment_url!} />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </DeptResponseFormSection>
      ) : null}

      {showChallengesSection ? (
        <DeptResponseFormSection title="Other information (challenges)">
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            Please provide any additional relevant information, including any challenges you face in
            the implementation of your mandate related to this category of concluding observation/
            list of issues.
          </p>
          <ChangedMultilineText
            className="text-sm"
            text={challengesText}
            beforeText={
              beforePayload
                ? departmentResponseChallenges(beforePayload)
                : ''
            }
            changed={Boolean(revisionHighlight?.challenges)}
          />
        </DeptResponseFormSection>
      ) : null}
    </div>
  )
}
