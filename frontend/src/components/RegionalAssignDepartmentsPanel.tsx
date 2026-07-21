import type { DepartmentRow } from '../api/workflows'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { Button } from './ui/Button'

type Props = {
  regionName: string
  indicators: HrRequestIssueIndicator[]
  departments: DepartmentRow[]
  /** departmentId → issue indicator ids assigned to that department */
  departmentIndicators: Record<number, number[]>
  onChangeDepartmentIndicators: (next: Record<number, number[]>) => void
  /** Department-only selection for Other Issues requests, which have no indicators. */
  selectedDepartmentIds?: number[]
  onChangeSelectedDepartmentIds?: (next: number[]) => void
  notes: string
  onChangeNotes: (value: string) => void
  assigning: boolean
  error: string | null
  onBack?: () => void
  onAssign: () => void
  showBackLink?: boolean
}

function indicatorSummary(selectedIds: number[]): string {
  if (selectedIds.length === 0) return 'No indicators selected'
  if (selectedIds.length === 1) return '1 indicator selected'
  return `${selectedIds.length} indicators selected`
}

/** Departments that have at least one indicator selected. */
export function assignedDepartmentIndicatorMap(
  departmentIndicators: Record<number, number[]>,
): Map<number, number[]> {
  const byDept = new Map<number, number[]>()
  for (const [deptKey, indicatorIds] of Object.entries(departmentIndicators)) {
    const departmentId = Number(deptKey)
    if (!Number.isFinite(departmentId) || departmentId <= 0) continue
    const ids = indicatorIds.filter((id) => Number.isFinite(id) && id > 0)
    if (ids.length === 0) continue
    byDept.set(departmentId, [...new Set(ids)])
  }
  return byDept
}

/**
 * Regional assign UI: collapsible department cards with multi-select indicators.
 */
export function RegionalAssignDepartmentsPanel({
  regionName,
  indicators,
  departments,
  departmentIndicators,
  onChangeDepartmentIndicators,
  selectedDepartmentIds = [],
  onChangeSelectedDepartmentIds,
  notes,
  onChangeNotes,
  assigning,
  error,
  onBack,
  onAssign,
  showBackLink = true,
}: Props) {
  const byDepartment = assignedDepartmentIndicatorMap(departmentIndicators)
  const noIndicatorMode = indicators.length === 0
  const mappedDeptCount = noIndicatorMode ? selectedDepartmentIds.length : byDepartment.size
  const canAssign = mappedDeptCount > 0 && departments.length > 0

  function toggleIndicator(departmentId: number, indicatorId: number, checked: boolean) {
    const current = departmentIndicators[departmentId] ?? []
    const nextIds = checked
      ? [...current, indicatorId]
      : current.filter((id) => id !== indicatorId)
    onChangeDepartmentIndicators({
      ...departmentIndicators,
      [departmentId]: nextIds,
    })
  }

  return (
    <section className="hr-request-view-template__card hr-request-regional-workflow-section">
      {showBackLink && onBack ? (
        <Button variant="link" compact type="button" onClick={onBack}>
          ← Choose a different path
        </Button>
      ) : null}
      <h4 className="dashboard-panel-title" style={{ marginTop: showBackLink ? 0 : undefined, marginBottom: 12 }}>
        Assign to departments ({regionName})
      </h4>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        {noIndicatorMode
          ? 'Select the departments that should provide a written response and attachment.'
          : 'Open a department to select the indicators they should respond to. Leave a department empty to skip it.'}
      </p>

      {departments.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No departments are mapped to your region. Add departments under <strong>Manage departments</strong> before
          assigning tasks.
        </p>
      ) : noIndicatorMode ? (
        <div className="regional-assign-dept-list">
          {departments.map((d) => (
            <label key={d.id} className="checkbox-label regional-assign-dept-card__indicator">
              <input
                type="checkbox"
                checked={selectedDepartmentIds.includes(d.id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selectedDepartmentIds, d.id]
                    : selectedDepartmentIds.filter((id) => id !== d.id)
                  onChangeSelectedDepartmentIds?.([...new Set(next)])
                }}
              />
              <span>
                {d.name} {d.code ? <span className="muted small">({d.code})</span> : null}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="regional-assign-dept-list">
          {departments.map((d) => {
            const selected = departmentIndicators[d.id] ?? []
            return (
              <details key={d.id} className="regional-assign-dept-card">
                <summary className="regional-assign-dept-card__summary">
                  <span className="regional-assign-dept-card__title">
                    {d.name} {d.code ? <span className="muted small">({d.code})</span> : null}
                  </span>
                  <span className="muted small regional-assign-dept-card__meta">
                    {indicatorSummary(selected)}
                  </span>
                </summary>
                <div
                  className="regional-assign-dept-card__body"
                  role="group"
                  aria-label={`Indicators for ${d.name}`}
                >
                  <div className="muted small" style={{ marginBottom: 8 }}>
                    Indicators
                  </div>
                  <div className="regional-assign-dept-card__indicators">
                    {indicators.map((ind, index) => (
                      <label key={ind.id} className="checkbox-label regional-assign-dept-card__indicator">
                        <input
                          type="checkbox"
                          checked={selected.includes(ind.id)}
                          onChange={(e) => toggleIndicator(d.id, ind.id, e.target.checked)}
                        />
                        <span>
                          <span className="muted small">#{index + 1}</span> {ind.indicator_text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      )}

      <div className="form-row" style={{ marginTop: 14 }}>
        <label htmlFor="reg-assign-instructions">Comments or instructions for departments (optional)</label>
        <textarea
          id="reg-assign-instructions"
          rows={4}
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          placeholder="e.g. Prioritize disaggregated figures by district; deadline for draft input is Friday."
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      {error && <p className="login-error" style={{ marginTop: 12 }}>{error}</p>}
      <div style={{ marginTop: 16 }}>
        <Button variant="primary" compact disabled={assigning || !canAssign} onClick={onAssign}>
          {assigning
            ? 'Assigning…'
            : mappedDeptCount > 0
              ? `Assign ${mappedDeptCount} department${mappedDeptCount === 1 ? '' : 's'}`
              : 'Assign selected departments'}
        </Button>
      </div>
    </section>
  )
}
