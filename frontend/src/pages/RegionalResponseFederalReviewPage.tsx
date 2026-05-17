import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  fetchRegionalResponseDepartmentTasks,
  fetchRegionalResponses,
  type DepartmentTaskRow,
  type RegionalResponseRow,
} from '../api/lists'
import { useAuth } from '../auth/AuthContext'
import { RegionalResponseFederalReviewView } from '../components/RegionalResponseFederalReviewView'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { PageSection } from '../components/ui/PageSection'
import { isFederalAdmin, isSuperAdmin } from '../lib/roles'
import { workflowBackLabel } from '../lib/workflowNavigation'

export function RegionalResponseFederalReviewPage() {
  const { responseId } = useParams<{ responseId: string }>()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') ?? '/responses'
  const { user } = useAuth()
  const canReviewFederal = isFederalAdmin(user) || isSuperAdmin(user)

  const [responses, setResponses] = useState<RegionalResponseRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchRegionalResponses()
      .then((resp) => {
        if (!cancelled) setResponses(resp)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [responseId])

  useEffect(() => {
    if (!responseId) {
      setTasks([])
      return
    }
    let cancelled = false
    setTasksLoading(true)
    void fetchRegionalResponseDepartmentTasks(responseId)
      .then((taskRows) => {
        if (!cancelled) setTasks(taskRows)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setTasks([])
          setError((prev) => prev ?? (e instanceof Error ? e.message : 'Failed to load department submissions'))
        }
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [responseId])

  const viewing = useMemo(
    () => responses.find((r) => r.id === responseId) ?? null,
    [responses, responseId],
  )

  const backTo = from.startsWith('/') ? from : `/${from}`

  return (
    <PageSection title="Regional response">
      <div className="hr-request-view-stack hr-request-view-stack--request-page">
        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="login-error">{error}</p> : null}
        {!loading && !error && !viewing ? (
          <p className="login-error">Regional response not found.</p>
        ) : null}
        {!loading && !error && viewing && tasksLoading ? (
          <p className="muted">Loading department submissions…</p>
        ) : null}
        {!loading && !error && viewing && !tasksLoading ? (
          <RegionalResponseFederalReviewView
            viewing={viewing}
            allResponses={responses}
            tasks={tasks}
            canReviewFederal={canReviewFederal}
            fromPath={backTo}
          />
        ) : null}
        <WorkflowPageBack to={backTo} label={workflowBackLabel(backTo)} />
      </div>
    </PageSection>
  )
}
