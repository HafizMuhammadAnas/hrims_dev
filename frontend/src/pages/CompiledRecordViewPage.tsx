import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { fetchCompiledRecords, type CompiledRecordRow } from '../api/lists'
import { useAuth } from '../auth/AuthContext'
import { MinistryCompiledRecordViewModal } from '../components/MinistryCompiledRecordViewModal'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { PageSection } from '../components/ui/PageSection'
import { LABEL_COMPILED_RECORD } from '../lib/uiLabels'
import { isFederalAdmin, isSuperAdmin } from '../lib/roles'
import { workflowBackLabel } from '../lib/workflowNavigation'

export function CompiledRecordViewPage() {
  const { recordId } = useParams<{ recordId: string }>()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') ?? '/compiled-records'
  const { user } = useAuth()
  const canFinalize = isFederalAdmin(user) || isSuperAdmin(user)

  const [rows, setRows] = useState<CompiledRecordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchCompiledRecords()
      .then((list) => {
        if (!cancelled) setRows(list)
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
  }, [recordId])

  const record = useMemo(() => rows.find((r) => r.id === recordId) ?? null, [rows, recordId])
  const backTo = from.startsWith('/') ? from : `/${from}`
  const fromPath = encodeURIComponent(backTo)

  return (
    <PageSection title={LABEL_COMPILED_RECORD}>
      <div className="hr-request-view-stack hr-request-view-stack--request-page">
        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="login-error">{error}</p> : null}
        {!loading && !error && !record ? (
          <p className="login-error">Compiled record not found.</p>
        ) : null}
        {!loading && !error && record ? (
          <MinistryCompiledRecordViewModal
            layout="page"
            record={record}
            canFinalize={canFinalize}
            fromPath={fromPath}
            onRecordUpdated={(updated) => {
              setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
            }}
          />
        ) : null}
        <WorkflowPageBack to={backTo} label={workflowBackLabel(backTo)} />
      </div>
    </PageSection>
  )
}
