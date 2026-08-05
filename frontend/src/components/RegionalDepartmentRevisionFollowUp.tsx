import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DepartmentTaskRow } from '../api/lists'
import { updateDepartmentTaskReview } from '../api/workflows'
import {
  canRequestDepartmentTaskModification,
  departmentTaskWorkflowBucket,
  hasDepartmentResponse,
  workflowPresentation,
} from '../lib/departmentTaskWorkflow'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/StatusBadge'

type Props = {
  tasks: DepartmentTaskRow[]
  reqId: string
  regionId?: number | null
  regionName?: string | null
  /** Prefill notes from federal feedback when requesting dept modification. */
  defaultComments?: string
  onUpdated?: (task: DepartmentTaskRow) => void
}

/**
 * After federal marks a regional compilation for revision, regional admins use this
 * to push selected department responses back for correction.
 */
export function RegionalDepartmentRevisionFollowUp({
  tasks,
  reqId,
  regionId,
  regionName,
  defaultComments = '',
  onUpdated,
}: Props) {
  const scoped = useMemo(() => {
    let rows = tasks.filter((t) => t.req_id === reqId && hasDepartmentResponse(t))
    if (regionId != null) {
      rows = rows.filter((t) => t.region_id === regionId)
    } else if (regionName != null) {
      const want = regionName.trim()
      rows = rows.filter((t) => (t.region_name ?? '').trim() === want)
    }
    return rows.sort((a, b) =>
      String(a.department_name ?? a.department_id).localeCompare(
        String(b.department_name ?? b.department_id),
      ),
    )
  }, [tasks, reqId, regionId, regionName])

  const [commentsByTask, setCommentsByTask] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  const reopenable = scoped.filter((t) => canRequestDepartmentTaskModification(t))
  const waitingRevision = scoped.filter((t) => departmentTaskWorkflowBucket(t) === 'revision')

  function commentFor(taskId: string): string {
    if (Object.prototype.hasOwnProperty.call(commentsByTask, taskId)) {
      return commentsByTask[taskId] ?? ''
    }
    return defaultComments
  }

  async function requestModification(task: DepartmentTaskRow) {
    const notes = commentFor(task.id).trim()
    if (!notes) {
      setError('Add feedback for the department when requesting modification.')
      return
    }
    setSavingId(task.id)
    setError(null)
    try {
      const updated = await updateDepartmentTaskReview(task.id, {
        regional_review_status: 'needs-modification',
        regional_review_comments: notes,
        revision_origin: 'federal_follow_up',
      })
      onUpdated?.(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not request modification.')
    } finally {
      setSavingId(null)
    }
  }

  async function requestModificationAll() {
    if (reopenable.length === 0) return
    const notes = (defaultComments || Object.values(commentsByTask)[0] || '').trim()
    if (!notes) {
      setError('Add shared feedback before requesting modification from all departments.')
      return
    }
    setBulkSaving(true)
    setError(null)
    try {
      for (const task of reopenable) {
        const updated = await updateDepartmentTaskReview(task.id, {
          regional_review_status: 'needs-modification',
          regional_review_comments: commentFor(task.id).trim() || notes,
          revision_origin: 'federal_follow_up',
        })
        onUpdated?.(updated)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not request modification for all departments.')
    } finally {
      setBulkSaving(false)
    }
  }

  if (scoped.length === 0) {
    return (
      <Alert variant="warning" title="No department submissions to revise">
        <p style={{ margin: 0 }}>
          There are no submitted department responses for this region on request {reqId}.
        </p>
      </Alert>
    )
  }

  return (
    <section className="hr-request-view-template__card regional-dept-revision-followup">
      <h2 className="card-section-heading">Push revision to departments</h2>
      <p className="muted text-compact" style={{ marginTop: 0 }}>
        Federal requested changes to this compilation. Request modification on department responses
        that need correction. Departments can then update and resubmit; after you re-accept them,
        edit and resubmit the compilation to federal.
      </p>
      {error ? (
        <Alert variant="error" title="Could not update department review" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {reopenable.length > 1 ? (
        <div style={{ marginBottom: 12 }}>
          <Button
            variant="secondary"
            compact
            type="button"
            disabled={bulkSaving || savingId != null}
            onClick={() => void requestModificationAll()}
          >
            {bulkSaving ? 'Requesting…' : `Request modification from all (${reopenable.length})`}
          </Button>
        </div>
      ) : null}
      <div className="regional-dept-revision-followup__list">
        {scoped.map((task) => {
          const wf = workflowPresentation(task)
          const canPush = canRequestDepartmentTaskModification(task)
          const waiting = departmentTaskWorkflowBucket(task) === 'revision'
          const taskPath = `/requests/${encodeURIComponent(reqId)}?task=${encodeURIComponent(task.id)}&from=${encodeURIComponent('/region-monitoring')}`
          return (
            <article key={task.id} className="regional-dept-revision-followup__card">
              <div className="regional-dept-revision-followup__head">
                <strong>{task.department_name ?? task.department_id}</strong>
                <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
              </div>
              <p className="muted small" style={{ margin: '4px 0 8px' }}>
                Task {task.id}
                {' · '}
                <Link to={taskPath}>Open response</Link>
              </p>
              {waiting ? (
                <p className="muted small" style={{ margin: 0 }}>
                  Waiting for the department to resubmit.
                  {task.regional_review_comments?.trim()
                    ? ` Feedback sent: ${task.regional_review_comments.trim()}`
                    : ''}
                </p>
              ) : null}
              {canPush ? (
                <>
                  <label className="regional-dept-revision-followup__label" htmlFor={`rev-notes-${task.id}`}>
                    Feedback to department
                  </label>
                  <textarea
                    id={`rev-notes-${task.id}`}
                    rows={3}
                    value={commentFor(task.id)}
                    onChange={(e) =>
                      setCommentsByTask((prev) => ({ ...prev, [task.id]: e.target.value }))
                    }
                    placeholder="Describe what the department must correct…"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Button
                      variant="secondary"
                      compact
                      type="button"
                      disabled={savingId === task.id || bulkSaving}
                      onClick={() => void requestModification(task)}
                    >
                      {savingId === task.id ? 'Saving…' : 'Request modification'}
                    </Button>
                  </div>
                </>
              ) : null}
              {!canPush && !waiting ? (
                <p className="muted small" style={{ margin: 0 }}>
                  No further push-back actions for this task right now.
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
      {waitingRevision.length > 0 ? (
        <p className="muted small" style={{ marginTop: 12 }}>
          {waitingRevision.length} department
          {waitingRevision.length === 1 ? '' : 's'} currently revising.
        </p>
      ) : null}
    </section>
  )
}
