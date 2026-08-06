import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { indicatorUsesDataMatrix } from '../lib/indicatorMatrixColumns'
import { indicatorQualitativeYears } from '../lib/indicatorDisaggregation'
import type { ParsedDepartmentResponse } from '../lib/departmentTaskResponseFormat'
import { IndicatorYearGenderHint } from './IndicatorYearGenderHint'
import { PendingFileAttachmentRow } from './PendingFileAttachmentRow'
import { Button } from './ui/Button'

import type { MatrixRowEnabledMap } from '../lib/deptMatrixRowEnabled'

export type DeptIndicatorDraft = {
  value: string
  comment: string
  /** Legacy single qualitative text when no qualitative years are configured. */
  qualText: string
  /** year_id → narrative text for each qualitative collection year. */
  qualByYear: Record<string, string>
  yearGenderValues: Record<string, string>
  yearAgeValues: Record<string, string>
  yearDisabilityValues: Record<string, string>
  yearRegionValues: Record<string, string>
  yearDistrictValues: Record<string, string>
  yearReligionValues: Record<string, string>
  yearConsolidatedValues: Record<string, string>
  matrixRowEnabled: MatrixRowEnabledMap
  quantFile: File | null
  qualFile: File | null
  clearSavedQuantAttachment: boolean
  clearSavedQualAttachment: boolean
}

export function emptyDeptIndicatorDraft(): DeptIndicatorDraft {
  return {
    value: '',
    comment: '',
    qualText: '',
    qualByYear: {},
    yearGenderValues: {},
    yearAgeValues: {},
    yearDisabilityValues: {},
    yearRegionValues: {},
    yearDistrictValues: {},
    yearReligionValues: {},
    yearConsolidatedValues: {},
    matrixRowEnabled: {},
    quantFile: null,
    qualFile: null,
    clearSavedQuantAttachment: false,
    clearSavedQualAttachment: false,
  }
}

type Props = {
  indicator: HrRequestIssueIndicator
  draft: DeptIndicatorDraft
  parsed: ParsedDepartmentResponse | null
  matrixMode?: boolean
  /** Which fields to render — used when the form is split into Quantitative / Qualitative sections. */
  section?: 'quantitative' | 'qualitative' | 'all'
  onChange: (next: DeptIndicatorDraft) => void
  onBumpFileInput: (key: string) => void
  fileInputRev: Record<string, number>
}

export function DepartmentIndicatorSupplementaryFields({
  indicator,
  draft,
  parsed,
  matrixMode = false,
  section = 'all',
  onChange,
  onBumpFileInput,
  fileInputRev,
}: Props) {
  const ind = indicator
  const d = draft
  const usesMatrix = matrixMode || indicatorUsesDataMatrix(ind)
  const qualYears = indicatorQualitativeYears(ind)
  const showQuantitative = section === 'all' || section === 'quantitative'
  const showQualitative = section === 'all' || section === 'qualitative'

  const prevQuantUrl =
    parsed?.kind === 'structured'
      ? parsed.payload.by_indicator[String(ind.id)]?.quantitative?.attachment_url?.trim() ?? ''
      : ''
  const prevQualUrl =
    parsed?.kind === 'structured'
      ? parsed.payload.by_indicator[String(ind.id)]?.qualitative?.attachment_url?.trim() ?? ''
      : ''

  return (
    <>
      {showQuantitative && !usesMatrix ? (
        <IndicatorYearGenderHint indicator={ind} style={{ margin: '0 0 12px' }} />
      ) : null}

      {showQuantitative && ind.has_quantitative ? (
        <div style={{ marginBottom: showQualitative && ind.has_qualitative && section === 'all' ? 14 : 0 }}>
          {section === 'all' ? (
            <div className="muted small" style={{ marginBottom: 8 }}>
              Quantitative
            </div>
          ) : null}
          {usesMatrix ? (
            <p className="muted small" style={{ margin: '0 0 10px' }}>
              Enter numbers in the table above. Add a narrative and optional attachment for this metric
              below.
            </p>
          ) : (
            <div className="form-row" style={{ marginBottom: 8 }}>
              <label htmlFor={`dept-ind-${ind.id}-num`}>Number</label>
              <input
                id={`dept-ind-${ind.id}-num`}
                type="text"
                inputMode="decimal"
                value={d.value}
                onChange={(e) => onChange({ ...d, value: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          )}
          <div className="form-row" style={{ marginBottom: 8 }}>
            <label htmlFor={`dept-ind-${ind.id}-comment`}>
              Please provide narrative related to the indicator
            </label>
            <textarea
              id={`dept-ind-${ind.id}-comment`}
              rows={2}
              value={d.comment}
              onChange={(e) => onChange({ ...d, comment: e.target.value })}
              placeholder="Narrative related to this indicator…"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          {prevQuantUrl && !d.clearSavedQuantAttachment ? (
            <div className="form-row" style={{ marginBottom: 8 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 6 }}>
                Saved quantitative file
              </span>
              <span className="hr-request-attachments-list__actions">
                <a href={prevQuantUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-compact">
                  View
                </a>
                <Button
                  type="button"
                  variant="danger"
                  compact
                  onClick={() => onChange({ ...d, clearSavedQuantAttachment: true })}
                >
                  Remove
                </Button>
              </span>
            </div>
          ) : null}
          {d.clearSavedQuantAttachment && prevQuantUrl ? (
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              Saved quantitative file will be removed when you submit.
            </p>
          ) : null}
          <div className="form-row">
            <label htmlFor={`dept-ind-${ind.id}-qfile`}>Attach file (optional)</label>
            <input
              id={`dept-ind-${ind.id}-qfile`}
              key={`q-${ind.id}-${fileInputRev[`q-${ind.id}`] ?? 0}`}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                e.target.value = ''
                onChange({ ...d, quantFile: f, clearSavedQuantAttachment: false })
              }}
            />
          </div>
          {d.quantFile ? (
            <PendingFileAttachmentRow
              file={d.quantFile}
              listStyle={{ marginTop: 8 }}
              onRemove={() => {
                onBumpFileInput(`q-${ind.id}`)
                onChange({ ...d, quantFile: null })
              }}
            />
          ) : null}
        </div>
      ) : null}

      {showQualitative && ind.has_qualitative ? (
        <div>
          {section === 'all' ? (
            <div className="muted small" style={{ marginBottom: 8 }}>
              Qualitative
            </div>
          ) : null}
          {qualYears.length > 0 ? (
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              Enter a narrative response for each selected qualitative year.
            </p>
          ) : usesMatrix && ind.has_quantitative ? (
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              Narrative response for this metric (required unless you attach a file).
            </p>
          ) : null}
          {qualYears.length > 0 ? (
            qualYears.map((y) => {
              const yearKey = String(y.year_id)
              return (
                <div className="form-row" style={{ marginBottom: 8 }} key={yearKey}>
                  <label htmlFor={`dept-ind-${ind.id}-qual-${yearKey}`}>{y.label}</label>
                  <textarea
                    id={`dept-ind-${ind.id}-qual-${yearKey}`}
                    rows={4}
                    value={d.qualByYear[yearKey] ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...d,
                        qualByYear: { ...d.qualByYear, [yearKey]: e.target.value },
                      })
                    }
                    placeholder={`Describe your department's response for ${y.label}…`}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              )
            })
          ) : (
            <div className="form-row" style={{ marginBottom: 8 }}>
              <label htmlFor={`dept-ind-${ind.id}-qual`}>Response</label>
              <textarea
                id={`dept-ind-${ind.id}-qual`}
                rows={5}
                value={d.qualText}
                onChange={(e) => onChange({ ...d, qualText: e.target.value })}
                placeholder="Describe your department's response for this indicator…"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          )}
          {prevQualUrl && !d.clearSavedQualAttachment ? (
            <div className="form-row" style={{ marginBottom: 8 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 6 }}>
                Saved qualitative file
              </span>
              <span className="hr-request-attachments-list__actions">
                <a href={prevQualUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-compact">
                  View
                </a>
                <Button
                  type="button"
                  variant="danger"
                  compact
                  onClick={() => onChange({ ...d, clearSavedQualAttachment: true })}
                >
                  Remove
                </Button>
              </span>
            </div>
          ) : null}
          {d.clearSavedQualAttachment && prevQualUrl ? (
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              Saved qualitative file will be removed when you submit.
            </p>
          ) : null}
          <div className="form-row">
            <label htmlFor={`dept-ind-${ind.id}-lfile`}>Attach file (optional)</label>
            <input
              id={`dept-ind-${ind.id}-lfile`}
              key={`l-${ind.id}-${fileInputRev[`l-${ind.id}`] ?? 0}`}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                e.target.value = ''
                onChange({ ...d, qualFile: f, clearSavedQualAttachment: false })
              }}
            />
          </div>
          {d.qualFile ? (
            <PendingFileAttachmentRow
              file={d.qualFile}
              listStyle={{ marginTop: 8 }}
              onRemove={() => {
                onBumpFileInput(`l-${ind.id}`)
                onChange({ ...d, qualFile: null })
              }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  )
}
