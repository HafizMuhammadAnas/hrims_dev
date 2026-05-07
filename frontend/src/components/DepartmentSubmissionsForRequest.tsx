import type { DepartmentTaskRow } from '../api/lists'
import { StatusBadge } from './ui/StatusBadge'
import { workflowPresentation } from '../lib/departmentTaskWorkflow'

type Props = {
  tasksForDetail: DepartmentTaskRow[]
  reqId: string
  /** Only show tasks whose region matches (federal consolidated view per province). */
  filterByRegionName?: string | null
}

export function DepartmentSubmissionsForRequest({ tasksForDetail, reqId, filterByRegionName }: Props) {
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
    <div className="submission-history-dept-sections" style={{ marginTop: 12 }}>
      <h4 className="dept-submissions-heading">
        Department submissions
        {filterByRegionName !== undefined ? (
          <>
            {' '}
            — <strong>{filterByRegionName?.trim() || '—'}</strong>
          </>
        ) : null}
      </h4>
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
              <strong style={{ fontSize: 14 }}>{t.department_name ?? t.department_id}</strong>
              <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
            </div>
            <p className="muted" style={{ margin: '8px 0 6px', fontSize: 12 }}>
              Task {t.id}
              {t.region_name ? ` · ${t.region_name}` : ''}
              {t.submission_date ? ` · Submitted ${t.submission_date}` : ''}
            </p>
            <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
              Department response
            </label>
            <textarea
              readOnly
              rows={6}
              value={t.response_data?.trim() ? t.response_data : '—'}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 4 }}
            />
            {t.attachment_url ? (
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                Attachment:{' '}
                <a href={t.attachment_url} target="_blank" rel="noreferrer">
                  {t.attachment_url}
                </a>
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
