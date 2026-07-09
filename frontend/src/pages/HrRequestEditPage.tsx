import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchHrRequest } from '../api/hrRequests'
import { fetchRegions } from '../api/regions'
import { useAuth } from '../auth/AuthContext'
import { canManageHrRequests, hrRequestLockedRegionId } from '../auth/rbac'
import { HrRequestModal } from '../components/HrRequestModal'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { Alert } from '../components/ui/Alert'
import { PageSection } from '../components/ui/PageSection'
import { LABEL_EDIT_REQUEST } from '../lib/uiLabels'
import { workflowBackLabel } from '../lib/workflowNavigation'
import { hrRequestAllowsEditDelete, type HrRequestRow } from '../types/hrRequest'
import type { RegionRow } from '../api/regions'

export function HrRequestEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') ?? '/requests'
  const backTo = from.startsWith('/') ? from : `/${from}`

  const { user } = useAuth()
  const canManage = canManageHrRequests(user)
  const lockedRegionId = hrRequestLockedRegionId(user)

  const [regions, setRegions] = useState<RegionRow[]>([])
  const [detail, setDetail] = useState<HrRequestRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError] = useState<string | null>(null)

  const reloadDetail = useCallback(async () => {
    if (!id) return
    const row = await fetchHrRequest(id)
    setDetail(row)
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    void Promise.all([fetchHrRequest(id), fetchRegions()])
      .then(([row, regRows]) => {
        if (cancelled) return
        setDetail(row)
        setRegions(regRows)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDetailError(e instanceof Error ? e.message : 'Failed to load request')
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!canManage) {
    return <Navigate to={backTo} replace />
  }

  if (!id) {
    return <Navigate to="/requests" replace />
  }

  if (!detailLoading && detail && !hrRequestAllowsEditDelete(detail.status)) {
    return <Navigate to={backTo} replace />
  }

  return (
    <PageSection
      title={LABEL_EDIT_REQUEST}
      leading={<WorkflowPageBack to={backTo} label={workflowBackLabel(backTo)} placement="header" />}
    >
      {detailError && (
        <Alert variant="error" title="Could not load request" onDismiss={() => setDetailError(null)}>
          {detailError}
        </Alert>
      )}

      <HrRequestModal
        mode="edit"
        detail={detail}
        detailLoading={detailLoading}
        detailError={detailError}
        regions={regions}
        canManage={canManage}
        lockedRegionId={lockedRegionId}
        layout="page"
        pageCloseLabel={workflowBackLabel(backTo)}
        onClose={() => navigate(backTo)}
        onSaved={() => {
          void reloadDetail()
          navigate(backTo)
        }}
        onDetailRefresh={reloadDetail}
      />
    </PageSection>
  )
}
