import { useEffect, useMemo, useState } from 'react'
import type { DepartmentTaskRow } from '../api/lists'
import {
  fetchDepartmentTaskRevisions,
  type DepartmentTaskRevisionRow,
} from '../api/workflows'
import { hasDepartmentResponse } from '../lib/departmentTaskWorkflow'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { formatAppDateTime } from '../lib/dateFormat'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'
import { ResponseRevisionChangesPanel } from './ResponseRevisionChangesPanel'

type Props = {
  regionalResponseId: string
  currentTitle: string
  currentContent: string
  tasks: DepartmentTaskRow[]
  issueIndicators?: HrRequestIssueIndicator[]
  /**
   * federal: only department revisions from a federal→region→department chain.
   * regional: full department revision history for the region.
   */
  audience?: 'federal' | 'regional'
}

function sortByRevisionAsc(rows: DepartmentTaskRevisionRow[]) {
  return [...rows].sort((a, b) => a.revision_no - b.revision_no)
}

function FederalDepartmentChangesCard({
  task,
  issueIndicators,
}: {
  task: DepartmentTaskRow
  issueIndicators?: HrRequestIssueIndicator[]
}) {
  const [revs, setRevs] = useState<DepartmentTaskRevisionRow[] | null>(null)
  const [current, setCurrent] = useState<{
    response_data: string | null
    attachment_url: string | null
    updated_at?: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const payload = await fetchDepartmentTaskRevisions(task.id, { audience: 'federal' })
        if (!cancelled) {
          setRevs(payload.revisions)
          setCurrent(payload.current)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load change history.')
          setRevs([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [task.id])

  if (loading) return null
  if (error) return null
  const revsAsc = sortByRevisionAsc(revs ?? [])
  if (revsAsc.length === 0) return null

  const latest = revsAsc[revsAsc.length - 1]!
  const afterData = task.response_data ?? current?.response_data ?? null
  const afterAttachment = task.attachment_url ?? current?.attachment_url ?? null
  const earlier = revsAsc.slice(0, -1).reverse()
  const displayOpts = {
    onlyIndicatorIds:
      Array.isArray(task.assigned_indicator_ids) && task.assigned_indicator_ids.length > 0
        ? task.assigned_indicator_ids
        : undefined,
    issueIndicators,
    locationRegionIds: [task.region_id],
  }

  return (
    <article className="regional-compilation-changes-tab__dept">
      <h3 className="regional-compilation-changes-tab__dept-title">
        {task.department_name ?? task.department_id}
      </h3>
      <div className="response-revision-history" role="region" aria-label="Change history">
        <article className="response-revision-pair">
          <p className="response-revision-pair__meta muted">
            <strong>{`Revision ${latest.revision_no} → current`}</strong>
            {latest.created_at ? <> · {formatAppDateTime(latest.created_at)}</> : null}
            {latest.submitted_by_name ? <> · {latest.submitted_by_name}</> : null}
          </p>
          <div className="response-revision-pair__cols">
            <section className="response-revision-pair__col">
              <h3 className="response-revision-pair__heading">Before</h3>
              <DepartmentResponseDisplay
                responseData={latest.response_data}
                attachmentUrl={latest.attachment_url}
                {...displayOpts}
              />
            </section>
            <section className="response-revision-pair__col response-revision-pair__col--new">
              <h3 className="response-revision-pair__heading">After (current)</h3>
              <p className="response-revision-pair__meta muted">
                <strong>Current</strong>
                {current?.updated_at ? <> · {formatAppDateTime(current.updated_at)}</> : null}
              </p>
              <DepartmentResponseDisplay
                responseData={afterData}
                attachmentUrl={afterAttachment}
                {...displayOpts}
              />
            </section>
          </div>
        </article>
        {earlier.length > 0 ? (
          <details className="response-revision-earlier">
            <summary>Earlier snapshots ({earlier.length})</summary>
            <ul className="response-revision-earlier__list">
              {earlier.map((r) => (
                <li key={String(r.id)}>
                  <p className="response-revision-pair__meta muted">
                    <strong>{`Revision ${r.revision_no}`}</strong>
                    {r.created_at ? <> · {formatAppDateTime(r.created_at)}</> : null}
                    {r.submitted_by_name ? <> · {r.submitted_by_name}</> : null}
                  </p>
                  <DepartmentResponseDisplay
                    responseData={r.response_data}
                    attachmentUrl={r.attachment_url}
                    {...displayOpts}
                  />
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </article>
  )
}

/**
 * Full revision history for a regional compilation review:
 * regional summary changes + department response changes after resubmit.
 */
export function RegionalCompilationChangesTab({
  regionalResponseId,
  currentTitle,
  currentContent,
  tasks,
  issueIndicators,
  audience = 'regional',
}: Props) {
  const submittedTasks = useMemo(
    () =>
      [...tasks]
        .filter((t) => hasDepartmentResponse(t))
        .sort((a, b) =>
          String(a.department_name ?? a.department_id).localeCompare(
            String(b.department_name ?? b.department_id),
          ),
        ),
    [tasks],
  )

  const federalAudience = audience === 'federal'

  return (
    <div className="regional-compilation-changes-tab">
      <section className="regional-compilation-changes-tab__section" aria-label="Regional compilation changes">
        <h2 className="card-section-heading">Regional compilation</h2>
        <ResponseRevisionChangesPanel
          kind="regional"
          regionalResponseId={regionalResponseId}
          currentTitle={currentTitle}
          currentContent={currentContent}
        />
      </section>

      <section className="regional-compilation-changes-tab__section" aria-label="Department response changes">
        <h2 className="card-section-heading">Department responses</h2>
        <p className="muted small regional-compilation-changes-tab__hint">
          {federalAudience
            ? 'Only department changes made after a federal revision request (forwarded by the region) are shown here. Region-only revision rounds are hidden.'
            : 'After a revision request to departments, each department that resubmits appears here with before/after content.'}
        </p>
        {submittedTasks.length === 0 ? (
          <p className="muted response-revision-empty">
            No department submissions for this region yet.
          </p>
        ) : federalAudience ? (
          <div className="regional-compilation-changes-tab__dept-list">
            {submittedTasks.map((task) => (
              <FederalDepartmentChangesCard
                key={task.id}
                task={task}
                issueIndicators={issueIndicators}
              />
            ))}
          </div>
        ) : (
          <div className="regional-compilation-changes-tab__dept-list">
            {submittedTasks.map((task) => (
              <article key={task.id} className="regional-compilation-changes-tab__dept">
                <h3 className="regional-compilation-changes-tab__dept-title">
                  {task.department_name ?? task.department_id}
                </h3>
                <ResponseRevisionChangesPanel
                  kind="department"
                  departmentTaskId={task.id}
                  currentResponseData={task.response_data}
                  currentAttachmentUrl={task.attachment_url}
                  issueIndicators={issueIndicators}
                  locationRegionIds={[task.region_id]}
                  onlyIndicatorIds={
                    Array.isArray(task.assigned_indicator_ids) &&
                    task.assigned_indicator_ids.length > 0
                      ? task.assigned_indicator_ids
                      : undefined
                  }
                  audience="regional"
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
