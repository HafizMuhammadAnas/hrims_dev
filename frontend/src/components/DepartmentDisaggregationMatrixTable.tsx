import type { HrRequestIssueIndicator } from '../types/hrRequest'
import type { MatrixYearColumnGroup } from '../lib/indicatorMatrixColumns'
import { matrixCellKey } from '../lib/indicatorMatrixColumns'

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
  onCellChange?: (indicatorId: number, yearId: number, columnId: number | string, value: string) => void
  readOnly?: boolean
  savedByIndicator?: Record<number, Record<string, string>>
  cellAllowed: MatrixRowFilter
  columnHeaderClass?: (name: string) => string
  hint?: string
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
  columnHeaderClass = defaultColumnHeaderClass,
  hint,
}: Props) {
  if (indicators.length === 0 || columnGroups.length === 0) {
    return null
  }

  function resolveCellKey(yearId: number, columnId: number | string): string {
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

  return (
    <div className="dept-data-matrix-section">
      <h4 className="dept-data-matrix-section__title">{title}</h4>
      <div className="dept-data-matrix-wrap table-card-scroll">
        <table className="dept-data-matrix">
          <thead>
            <tr>
              <th className="dept-data-matrix__metric-col" rowSpan={2}>
                Metric
              </th>
              {columnGroups.map((group) => (
                <th key={group.year_id} className="dept-data-matrix__year-head" colSpan={group.genders.length}>
                  {group.year_label}
                </th>
              ))}
            </tr>
            <tr>
              {columnGroups.map((group) =>
                group.genders.map((g) => (
                  <th
                    key={resolveCellKey(group.year_id, g.gender_id)}
                    className="dept-data-matrix__gender-head"
                  >
                    <span className={columnHeaderClass(g.gender_name)}>{g.gender_name}</span>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator) => {
              const typeBits = indicatorTypePills(indicator)
              return (
                <tr key={indicator.id}>
                  <td className="dept-data-matrix__metric-cell">
                    <div className="dept-data-matrix__metric-title">{indicator.indicator_text}</div>
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
                  {columnGroups.map((group) =>
                    group.genders.map((g) => {
                      const colId =
                        typeof g.gender_id === 'number' ? g.gender_id : String(g.gender_id)
                      const allowed = cellAllowed(indicator, group.year_id, colId)
                      if (!allowed) {
                        return (
                          <td
                            key={`${indicator.id}-${resolveCellKey(group.year_id, colId)}`}
                            className="dept-data-matrix__cell dept-data-matrix__cell--na"
                          >
                            <span className="text-muted">—</span>
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
                              onChange={(e) => onCellChange?.(indicator.id, group.year_id, colId, e.target.value)}
                            />
                          )}
                        </td>
                      )
                    }),
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!readOnly && hint ? <p className="muted small dept-data-matrix__hint">{hint}</p> : null}
      </div>
    </div>
  )
}
