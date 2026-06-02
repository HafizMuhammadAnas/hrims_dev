import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { buildMatrixColumnGroups, matrixCellKey } from '../lib/indicatorMatrixColumns'
import type { DepartmentQuantitativeByYearGender } from '../lib/departmentTaskResponseFormat'

function genderHeaderClass(name: string): string {
  const n = name.trim().toLowerCase()
  if (n.includes('female') && !n.includes('male')) return 'dept-data-matrix__gender--female'
  if (n.includes('male')) return 'dept-data-matrix__gender--male'
  if (n.includes('trans')) return 'dept-data-matrix__gender--trans'
  return 'dept-data-matrix__gender--other'
}

function indicatorTypePills(ind: HrRequestIssueIndicator): string[] {
  const parts: string[] = []
  if (ind.has_quantitative) parts.push('Quantitative')
  if (ind.has_qualitative) parts.push('Qualitative')
  return parts
}

function yearGenderAllowed(
  indicator: HrRequestIssueIndicator,
  yearId: number,
  genderId: number,
): boolean {
  return (indicator.collection_by_year ?? []).some(
    (y) => y.year_id === yearId && (y.genders ?? []).some((g) => g.id === genderId),
  )
}

type Props = {
  indicators: HrRequestIssueIndicator[]
  cellValues: Record<number, Record<string, string>>
  onCellChange?: (indicatorId: number, yearId: number, genderId: number, value: string) => void
  readOnly?: boolean
  savedByIndicator?: Record<string, { by_year_gender?: DepartmentQuantitativeByYearGender | null }>
}

export function DepartmentIndicatorDataMatrix({
  indicators,
  cellValues,
  onCellChange,
  readOnly = false,
  savedByIndicator,
}: Props) {
  const columnGroups = buildMatrixColumnGroups(indicators)
  const tableRows = indicators

  if (tableRows.length === 0 || columnGroups.length === 0) {
    return null
  }

  function cellDisplay(indicatorId: number, yearId: number, genderId: number): string {
    if (!readOnly) {
      return cellValues[indicatorId]?.[matrixCellKey(yearId, genderId)] ?? ''
    }
    const saved = savedByIndicator?.[String(indicatorId)]?.by_year_gender
    const cell = saved?.[String(yearId)]?.[String(genderId)]
    if (cell?.value == null || Number.isNaN(cell.value)) return ''
    return String(cell.value)
  }

  function cellFilled(value: string): boolean {
    return value.trim() !== '' && Number.isFinite(Number(value.trim()))
  }

  return (
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
                <th key={matrixCellKey(group.year_id, g.gender_id)} className="dept-data-matrix__gender-head">
                  <span className={genderHeaderClass(g.gender_name)}>{g.gender_name}</span>
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((indicator) => {
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
                    const allowed = yearGenderAllowed(indicator, group.year_id, g.gender_id)
                    if (!allowed) {
                      return (
                        <td
                          key={`${indicator.id}-${matrixCellKey(group.year_id, g.gender_id)}`}
                          className="dept-data-matrix__cell dept-data-matrix__cell--na"
                        >
                          <span className="text-muted">—</span>
                        </td>
                      )
                    }
                    const display = cellDisplay(indicator.id, group.year_id, g.gender_id)
                    const filled = cellFilled(display)
                    return (
                      <td
                        key={`${indicator.id}-${matrixCellKey(group.year_id, g.gender_id)}`}
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
                              onCellChange?.(indicator.id, group.year_id, g.gender_id, e.target.value)
                            }
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
      {!readOnly ? (
        <p className="muted small dept-data-matrix__hint">
          Enter a number for each year and gender combination required for that metric. Use the sections below
          for qualitative responses and attachments.
        </p>
      ) : null}
    </div>
  )
}
