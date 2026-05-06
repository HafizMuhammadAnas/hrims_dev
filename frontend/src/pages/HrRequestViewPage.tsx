import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchHrRequest } from '../api/hrRequests'
import { fetchRegions } from '../api/regions'
import { useAuth } from '../auth/AuthContext'
import { canManageHrRequests, hrRequestLockedRegionId } from '../auth/rbac'
import { HrRequestModal } from '../components/HrRequestModal'
import { PageSection } from '../components/ui/PageSection'
import type { HrRequestRow } from '../types/hrRequest'
import type { RegionRow } from '../api/regions'

export function HrRequestViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = canManageHrRequests(user)
  const lockedRegionId = hrRequestLockedRegionId(user)

  const [regions, setRegions] = useState<RegionRow[]>([])
  const [detail, setDetail] = useState<HrRequestRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchRegions()
      .then((r) => {
        if (!cancelled) setRegions(r)
      })
      .catch(() => {
        if (!cancelled) setRegions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!id) {
      setDetail(null)
      setDetailLoading(false)
      setDetailError('Missing request id.')
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    setDetailError(null)
    void fetchHrRequest(id)
      .then((row) => {
        if (!cancelled) setDetail(row)
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

  return (
    <PageSection
      title="Request"
      subtitle="View HR request details. Use the button below to return to the full list."
    >
      <HrRequestModal
        layout="page"
        mode="view"
        detail={detail}
        detailLoading={detailLoading}
        detailError={detailError}
        regions={regions}
        canManage={canManage}
        lockedRegionId={lockedRegionId}
        onClose={() => navigate('/requests')}
        onSaved={() => navigate('/requests')}
      />
    </PageSection>
  )
}
