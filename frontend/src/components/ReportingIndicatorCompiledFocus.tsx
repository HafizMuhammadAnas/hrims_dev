import { useEffect, useState } from 'react'
import { fetchHrRequest } from '../api/hrRequests'
import {
  fetchDepartmentTasks,
  fetchRegionalResponses,
  type CompiledRecordRow,
} from '../api/lists'
import { loadCompiledRecordRegionBlocks, type CompiledRecordRegionBlock } from '../lib/compiledRecordDepartmentTasks'
import { formatAppDate } from '../lib/dateFormat'
import type { HrRequestRow } from '../types/hrRequest'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'
import { StatusBadge } from './ui/StatusBadge'

type RecordView = {
  record: CompiledRecordRow
  hrDetail: HrRequestRow | null
  regions: CompiledRecordRegionBlock[]
}

type Props = {
  indicatorId: number
  indicatorLabel?: string
  records: CompiledRecordRow[]
}

function formatCompiledStatusLabel(status: string): string {
  if (status === 'submitted') return 'Submitted'
  if (status === 'draft') return 'Draft'
  const s = status.replace(/-/g, ' ')
  if (!s) return status
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ReportingIndicatorCompiledFocus({ indicatorId, indicatorLabel, records }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recordViews, setRecordViews] = useState<RecordView[]>([])

  useEffect(() => {
    if (records.length === 0) {
      setRecordViews([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const [regionalResponses, indexTasks] = await Promise.all([
          fetchRegionalResponses(),
          fetchDepartmentTasks(),
        ])
        const reqIds = [...new Set(records.map((r) => r.req_id).filter((id): id is string => Boolean(id)))]
        const hrPairs = await Promise.all(
          reqIds.map(async (id) => {
            try {
              return [id, await fetchHrRequest(id)] as const
            } catch {
              return [id, null] as const
            }
          }),
        )
        const hrByReq = new Map(hrPairs)

        const views = await Promise.all(
          records.map(async (record) => {
            const regions = await loadCompiledRecordRegionBlocks(record, regionalResponses, indexTasks)
            const hrDetail = record.req_id ? (hrByReq.get(record.req_id) ?? null) : null
            return { record, hrDetail, regions }
          }),
        )

        if (!cancelled) setRecordViews(views)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load indicator data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [records, indicatorId])

  const title = indicatorLabel?.trim() || `Indicator #${indicatorId}`

  return (
    <div className="reporting-indicator-focus">
      <h4 className="reporting-indicator-focus__title">Compiled data — {title}</h4>

      {loading ? <p className="muted">Loading indicator responses…</p> : null}
      {error ? <p className="login-error">{error}</p> : null}

      {!loading && !error && records.length === 0 ? (
        <p className="muted">No compiled records match this indicator and filters.</p>
      ) : null}

      {!loading && !error && recordViews.length > 0 ? (
        <div className="reporting-indicator-focus__list">
          {recordViews.map(({ record, hrDetail, regions }) => (
            <article key={record.id} className="reporting-indicator-focus__record">
              <header className="reporting-indicator-focus__record-head">
                <div>
                  <strong className="reporting-indicator-focus__record-title">{record.title}</strong>
                  <p className="reporting-indicator-focus__record-meta muted small">
                    {record.id}
                    {record.req_id ? ` · Request ${record.req_id}` : ''}
                    {record.compilation_date ? ` · ${formatAppDate(record.compilation_date)}` : ''}
                  </p>
                </div>
                <StatusBadge tone={record.status === 'submitted' ? 'success' : 'warning'}>
                  {formatCompiledStatusLabel(record.status)}
                </StatusBadge>
              </header>

              {regions.length === 0 ? (
                <p className="muted reporting-indicator-focus__empty">No departmental responses for this record.</p>
              ) : (
                <div className="ministry-compiled-regions-stack">
                  {regions.map(({ regionName, tasks }) => (
                    <section key={`${record.id}-${regionName}`} className="ministry-compiled-region-card">
                      <h2 className="ministry-compiled-region-card__title">{regionName}</h2>
                      <h3 className="ministry-compiled-region-card__section-label">Responses</h3>
                      {tasks.length === 0 ? (
                        <p className="muted small ministry-compiled-region-card__empty">—</p>
                      ) : (
                        <div className="ministry-compiled-region-card__responses">
                          {tasks.map((task) => (
                            <div key={task.id} className="ministry-compiled-dept-response-item">
                              <p className="ministry-compiled-dept-response-item__dept">
                                {task.department_name ?? task.department_id}
                              </p>
                              <DepartmentResponseDisplay
                                responseData={task.response_data}
                                attachmentUrl={task.attachment_url}
                                onlyIndicatorIds={[indicatorId]}
                                issueIndicators={hrDetail?.issue?.indicators ?? []}
                                locationRegionIds={[task.region_id]}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}

              {record.summary?.trim() ? (
                <section className="ministry-compiled-region-card ministry-compiled-summary-card">
                  <h3 className="ministry-compiled-region-card__section-label">Compilation summary</h3>
                  <p className="ministry-compiled-summary-card__prose">{record.summary.trim()}</p>
                </section>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}
