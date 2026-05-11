import type { DepartmentTaskRow } from '../api/lists'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'
import { StatusBadge } from './ui/StatusBadge'
import { workflowPresentation } from '../lib/departmentTaskWorkflow'

type Props = {
  tasksForDetail: DepartmentTaskRow[]
  reqId: string
  /** Only show tasks whose region matches (federal consolidated view per province). */
  filterByRegionName?: string | null
  /** When the parent already provides a section title (e.g. modal card). */
  omitHeading?: boolean
}

export function DepartmentSubmissionsForRequest({
  tasksForDetail,
  reqId,
  filterByRegionName,
  omitHeading = false,
}: Props) {
  const scoped = (() => {
    if (filterByRegionName === undefined) {
      return tasksForDetail
    }
    const want = (filterByRegionName ?? '').trim()
    return tasksForDetail.filter((t) => (t.region_name ?? '').trim() === want)
  })()

  if (scoped.length === 0) {
    if (filterByRegionName !== undefined) {
      return (
        <p className="muted" style={{ margin: '12px 0' }}>
          No distributed department tasks for region <strong>{filterByRegionName?.trim() || '—'}</strong> on request{' '}
          <strong>{reqId}</strong>.
        </p>
      )
    }
    return (
      <p className="muted" style={{ margin: '12px 0' }}>
        No distributed department tasks found for this request. Department submissions will appear here when tasks exist for{' '}
        <strong>{reqId}</strong>.
      </p>
    )
  }
  return (
    <div className="submission-history-dept-sections" style={{ marginTop: omitHeading ? 0 : 12 }}>
      {!omitHeading ? (
        <h4 className="dept-submissions-heading">
          Department submissions
          {filterByRegionName !== undefined ? (
            <>
              {' '}
              — <strong>{filterByRegionName?.trim() || '—'}</strong>
            </>
          ) : null}
        </h4>
      ) : null}
      {scoped.map((t) => {
        const wf = workflowPresentation(t)
        return (
          <div
            key={t.id}
            className="dept-submission-card"
            style={{
              marginBottom: 14,
              padding: 12,
              border: '1px solid var(--field-border, #e1e7f5)',
              borderRadius: 10,
              background: '#fafbfd',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <strong className="text-sm font-semibold">{t.department_name ?? t.department_id}</strong>
              <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
            </div>
            <p className="muted small" style={{ margin: '8px 0 6px' }}>
              Task {t.id}
              {t.region_name ? ` · ${t.region_name}` : ''}
              {t.submission_date ? ` · Submitted ${t.submission_date}` : ''}
            </p>
            <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
              Department response
            </label>
            <div style={{ marginTop: 4 }}>
              <DepartmentResponseDisplay responseData={t.response_data} attachmentUrl={t.attachment_url} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
