import { Fragment } from 'react'
import { Download } from 'lucide-react'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import type { MatrixDimensionKey } from '../lib/deptMatrixRowEnabled'
import type { MatrixYearColumnGroup } from '../lib/indicatorMatrixColumns'
import {
  GENDER_TOTAL_COLUMN_ID,
  genderTotalCellKey,
  matrixCellKey,
} from '../lib/indicatorMatrixColumns'
import { downloadMatrixAsExcel } from '../lib/downloadMatrixAsExcel'
import { Button } from './ui/Button'
import { MatrixRowEnableToggle } from './ui/MatrixRowEnableToggle'

type MatrixRowFilter = (
  indicator: HrRequestIssueIndicator,
  yearId: number,
  columnId: number | string,
) => boolean

type Props = {
  title: string
  indicators: HrRequestIssueIndicator[]
  columnGroups: MatrixYearColumnGroup[]
  cellValues: Record<number, Record<string, string>>
  onCellChange?: (
    indicatorId: number,
    yearId: number,
    columnId: number | string,
    value: string,
    /** When set (Gender Total), apply in the same state update as `value`. */
    autoTotalValue?: string,
  ) => void
  readOnly?: boolean
  savedByIndicator?: Record<number, Record<string, string>>
  cellAllowed: MatrixRowFilter
  dimensionKey?: MatrixDimensionKey
  rowEnabledByIndicator?: Record<number, boolean>
  onRowEnabledChange?: (indicatorId: number, enabled: boolean) => void
  columnHeaderClass?: (name: string) => string
  hint?: string
  /** When true, append a read-only Total column after each year's gender columns (Gender matrix only). */
  showYearTotals?: boolean
}

function indicatorTypePills(ind: HrRequestIssueIndicator): string[] {
  const parts: string[] = []
  if (ind.has_quantitative) parts.push('Quantitative')
  if (ind.has_qualitative) parts.push('Qualitative')
  return parts
}

function defaultColumnHeaderClass(_name: string): string {
  return 'dept-data-matrix__gender--other'
}

export function DepartmentDisaggregationMatrixTable({
  title,
  indicators,
  columnGroups,
  cellValues,
  onCellChange,
  readOnly = false,
  savedByIndicator,
  cellAllowed,
  dimensionKey,
  rowEnabledByIndicator,
  onRowEnabledChange,
  columnHeaderClass = defaultColumnHeaderClass,
  hint,
  showYearTotals = false,
}: Props) {
  const showRowToggle = !readOnly && dimensionKey != null && onRowEnabledChange != null

  function rowIncluded(indicatorId: number): boolean {
    return rowEnabledByIndicator?.[indicatorId] !== false
  }

  function rowExcludedByDepartment(indicatorId: number): boolean {
    return rowEnabledByIndicator != null && rowEnabledByIndicator[indicatorId] === false
  }

  function unavailableCellLabel(indicatorId: number): string {
    if (rowExcludedByDepartment(indicatorId)) {
      return 'data not available'
    }
    return '—'
  }

  const hasDepartmentExcludedRows =
    readOnly &&
    indicators.some((indicator) => rowExcludedByDepartment(indicator.id))
  if (indicators.length === 0 || columnGroups.length === 0) {
    return null
  }

  function resolveCellKey(yearId: number, columnId: number | string): string {
    if (columnId === GENDER_TOTAL_COLUMN_ID) {
      return genderTotalCellKey(yearId)
    }
    if (typeof columnId === 'string') {
      return `${yearId}-${columnId}`
    }
    return matrixCellKey(yearId, columnId)
  }

  function cellDisplay(indicatorId: number, yearId: number, columnId: number | string): string {
    const key = resolveCellKey(yearId, columnId)
    if (!readOnly) {
      return cellValues[indicatorId]?.[key] ?? ''
    }
    return savedByIndicator?.[indicatorId]?.[key] ?? ''
  }

  function cellFilled(value: string): boolean {
    return value.trim() !== '' && Number.isFinite(Number(value.trim()))
  }

  function sumYearGenderValues(
    indicator: HrRequestIssueIndicator,
    group: MatrixYearColumnGroup,
    override?: { columnId: number | string; value: string },
  ): string {
    let sum = 0
    let any = false
    for (const g of group.genders) {
      const colId = typeof g.gender_id === 'number' ? g.gender_id : String(g.gender_id)
      if (!cellAllowed(indicator, group.year_id, colId)) continue
      const raw =
        override && String(override.columnId) === String(colId)
          ? override.value.trim()
          : cellDisplay(indicator.id, group.year_id, colId).trim()
      if (raw === '') continue
      const n = Number(raw)
      if (!Number.isFinite(n)) continue
      sum += n
      any = true
    }
    if (!any) return ''
    return Number.isInteger(sum) ? String(sum) : String(Math.round(sum * 1000) / 1000)
  }

  function handleGenderCellChange(
    indicator: HrRequestIssueIndicator,
    group: MatrixYearColumnGroup,
    columnId: number | string,
    value: string,
  ) {
    if (!showYearTotals || columnId === GENDER_TOTAL_COLUMN_ID) {
      onCellChange?.(indicator.id, group.year_id, columnId, value)
      return
    }
    const total = sumYearGenderValues(indicator, group, { columnId, value })
    onCellChange?.(indicator.id, group.year_id, columnId, value, total !== '' ? total : undefined)
  }

  const yearColSpan = (group: MatrixYearColumnGroup) =>
    group.genders.length + (showYearTotals ? 1 : 0)

  function exportCellValue(indicator: HrRequestIssueIndicator, yearId: number, columnId: number | string): string {
    const included = rowIncluded(indicator.id)
    if (!included || rowExcludedByDepartment(indicator.id)) {
      return unavailableCellLabel(indicator.id)
    }
    if (!cellAllowed(indicator, yearId, columnId)) {
      return '—'
    }
    return cellDisplay(indicator.id, yearId, columnId).trim() || '—'
  }

  function handleDownloadExcel() {
    const columns = columnGroups.flatMap((group) => {
      const genderCols = group.genders.map((g) => ({
        header: g.gender_name,
        yearLabel: group.year_label,
      }))
      if (showYearTotals) {
        genderCols.push({ header: 'Total', yearLabel: group.year_label })
      }
      return genderCols
    })

    const rows = indicators.map((indicator) => {
      const cells: string[] = []
      for (const group of columnGroups) {
        for (const g of group.genders) {
          const colId = typeof g.gender_id === 'number' ? g.gender_id : String(g.gender_id)
          cells.push(exportCellValue(indicator, group.year_id, colId))
        }
        if (showYearTotals) {
          const included = rowIncluded(indicator.id)
          if (!included || rowExcludedByDepartment(indicator.id)) {
            cells.push(unavailableCellLabel(indicator.id))
          } else {
            const total = cellDisplay(indicator.id, group.year_id, GENDER_TOTAL_COLUMN_ID).trim()
            cells.push(total || '—')
          }
        }
      }
      return {
        metric: indicator.indicator_text,
        note: rowExcludedByDepartment(indicator.id) ? 'data not available — not required' : undefined,
        cells,
      }
    })

    downloadMatrixAsExcel({
      sheetName: title,
      filename: `${title}-matrix`,
      columns,
      rows,
    })
  }

  return (
    <div className="dept-data-matrix-section">
      <div className="dept-data-matrix-section__head">
        <h4 className="dept-data-matrix-section__title">{title}</h4>
        <Button
          variant="secondary"
          compact
          type="button"
          className="dept-data-matrix-section__excel-btn"
          onClick={handleDownloadExcel}
        >
          <Download size={14} strokeWidth={2} aria-hidden style={{ marginRight: 4 }} />
          Download Excel
        </Button>
      </div>
      <div className="dept-data-matrix-wrap table-card-scroll">
        <table className="dept-data-matrix">
          <thead>
            <tr>
              {showRowToggle ? (
                <th className="dept-data-matrix__include-col" rowSpan={2}>
                  Include
                </th>
              ) : null}
              <th className="dept-data-matrix__metric-col" rowSpan={2}>
                Metric
              </th>
              {columnGroups.map((group) => (
                <th
                  key={group.year_id}
                  className="dept-data-matrix__year-head"
                  colSpan={yearColSpan(group)}
                >
                  {group.year_label}
                </th>
              ))}
            </tr>
            <tr>
              {columnGroups.map((group) => (
                <Fragment key={group.year_id}>
                  {group.genders.map((g) => (
                    <th
                      key={resolveCellKey(group.year_id, g.gender_id)}
                      className="dept-data-matrix__gender-head"
                    >
                      <span className={columnHeaderClass(g.gender_name)}>{g.gender_name}</span>
                    </th>
                  ))}
                  {showYearTotals ? (
                    <th className="dept-data-matrix__gender-head dept-data-matrix__total-head">
                      <span className="dept-data-matrix__gender--other">Total</span>
                    </th>
                  ) : null}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator) => {
              const typeBits = indicatorTypePills(indicator)
              const included = rowIncluded(indicator.id)
              return (
                <tr
                  key={indicator.id}
                  className={included ? undefined : 'dept-data-matrix__row--excluded'}
                >
                  {showRowToggle ? (
                    <td className="dept-data-matrix__include-col">
                      <MatrixRowEnableToggle
                        enabled={included}
                        label={`Include ${indicator.indicator_text} in ${dimensionKey}`}
                        onChange={(enabled) => onRowEnabledChange?.(indicator.id, enabled)}
                      />
                    </td>
                  ) : null}
                  <td className="dept-data-matrix__metric-cell">
                    <div className="dept-data-matrix__metric-title">{indicator.indicator_text}</div>
                    {readOnly && rowExcludedByDepartment(indicator.id) ? (
                      <span className="dept-data-matrix__metric-na-badge">data not available — not required</span>
                    ) : null}
                    {typeBits.length > 0 ? (
                      <div className="dept-data-matrix__metric-pills">
                        {typeBits.map((t) => (
                          <span key={t} className="dept-data-matrix-block__type-pill">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  {columnGroups.map((group) => (
                    <Fragment key={`${indicator.id}-${group.year_id}`}>
                      {group.genders.map((g) => {
                        const colId =
                          typeof g.gender_id === 'number' ? g.gender_id : String(g.gender_id)
                        const allowed = included && cellAllowed(indicator, group.year_id, colId)
                        if (!allowed) {
                          const excluded = rowExcludedByDepartment(indicator.id)
                          return (
                            <td
                              key={`${indicator.id}-${resolveCellKey(group.year_id, colId)}`}
                              className={
                                'dept-data-matrix__cell dept-data-matrix__cell--na' +
                                (excluded ? ' dept-data-matrix__cell--dept-na' : '')
                              }
                            >
                              <span className={excluded ? 'dept-data-matrix__na-label' : 'text-muted'}>
                                {unavailableCellLabel(indicator.id)}
                              </span>
                            </td>
                          )
                        }
                        const display = cellDisplay(indicator.id, group.year_id, colId)
                        const filled = cellFilled(display)
                        return (
                          <td
                            key={`${indicator.id}-${resolveCellKey(group.year_id, colId)}`}
                            className={`dept-data-matrix__cell${filled ? ' dept-data-matrix__cell--filled' : ''}`}
                          >
                            {readOnly ? (
                              <span className="dept-data-matrix__cell-readonly">{display || '—'}</span>
                            ) : (
                              <input
                                type="number"
                                inputMode="decimal"
                                className="dept-data-matrix__input"
                                value={display}
                                aria-label={`${indicator.indicator_text}, ${group.year_label}, ${g.gender_name}`}
                                onChange={(e) =>
                                  handleGenderCellChange(indicator, group, colId, e.target.value)
                                }
                              />
                            )}
                          </td>
                        )
                      })}
                      {showYearTotals ? (
                        (() => {
                          const totalAllowed = included && !rowExcludedByDepartment(indicator.id)
                          if (!totalAllowed) {
                            const excluded = rowExcludedByDepartment(indicator.id)
                            return (
                              <td
                                className={
                                  'dept-data-matrix__cell dept-data-matrix__cell--na dept-data-matrix__cell--total' +
                                  (excluded ? ' dept-data-matrix__cell--dept-na' : '')
                                }
                              >
                                <span className={excluded ? 'dept-data-matrix__na-label' : 'text-muted'}>
                                  {unavailableCellLabel(indicator.id)}
                                </span>
                              </td>
                            )
                          }
                          const totalDisplay = cellDisplay(
                            indicator.id,
                            group.year_id,
                            GENDER_TOTAL_COLUMN_ID,
                          )
                          const filled = cellFilled(totalDisplay)
                          return (
                            <td
                              className={
                                'dept-data-matrix__cell dept-data-matrix__cell--total' +
                                (filled ? ' dept-data-matrix__cell--filled' : '')
                              }
                            >
                              {readOnly ? (
                                <span className="dept-data-matrix__cell-readonly dept-data-matrix__total-value">
                                  {totalDisplay || '—'}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className="dept-data-matrix__input dept-data-matrix__input--total"
                                  value={totalDisplay}
                                  aria-label={`${indicator.indicator_text}, ${group.year_label}, Total`}
                                  onChange={(e) =>
                                    onCellChange?.(
                                      indicator.id,
                                      group.year_id,
                                      GENDER_TOTAL_COLUMN_ID,
                                      e.target.value,
                                    )
                                  }
                                />
                              )}
                            </td>
                          )
                        })()
                      ) : null}
                    </Fragment>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!readOnly && hint ? <p className="muted small dept-data-matrix__hint">{hint}</p> : null}
        {hasDepartmentExcludedRows ? (
          <p className="muted small dept-data-matrix__hint">
            <strong>data not available</strong> — the department marked this metric as not required for{' '}
            {title.toLowerCase()} (no data requested for this row in this dimension).
          </p>
        ) : null}
      </div>
    </div>
  )
}
