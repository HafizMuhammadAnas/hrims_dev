import { useEffect, useMemo, useState } from 'react'
import { fetchHrRequest } from '../api/hrRequests'
import {
  fetchDepartmentTasks,
  fetchRegionalResponses,
  type CompiledRecordRow,
} from '../api/lists'
import { loadCompiledRecordRegionBlocks, type CompiledRecordRegionBlock } from '../lib/compiledRecordDepartmentTasks'
import { coerceIssueEntryKind, issueEntryKindBadgeLabel } from '../lib/issueEntryKind'
import type { HrRequestIssueDetail, HrRequestRow } from '../types/hrRequest'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'

type RecordView = {
  record: CompiledRecordRow
  hrDetail: HrRequestRow | null
  regions: CompiledRecordRegionBlock[]
}

type Props = {
  indicatorId: number
  indicatorLabel?: string
  records: CompiledRecordRow[]
  /** When set, narrows the indicator content/table to this collection year. */
  filterYearId?: number
  filterYearLabel?: string
}

/** A ministry submission (federal → ministry), as opposed to a national/regional compilation. */
function isMinistryCompiledRecord(r: CompiledRecordRow): boolean {
  return Boolean(r.submitted_to && /ministry/i.test(r.submitted_to))
}

/** Prefer the most final compiled row for a request: ministry submission, then latest date. */
function preferCompiledRecord(a: CompiledRecordRow, b: CompiledRecordRow): CompiledRecordRow {
  const rank = (r: CompiledRecordRow) => (isMinistryCompiledRecord(r) ? 2 : r.status === 'submitted' ? 1 : 0)
  if (rank(b) !== rank(a)) return rank(b) > rank(a) ? b : a
  const da = a.compilation_date ?? ''
  const db = b.compilation_date ?? ''
  return db > da ? b : a
}

export function ReportingIndicatorCompiledFocus({
  indicatorId,
  records,
  filterYearId,
  filterYearLabel,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recordViews, setRecordViews] = useState<RecordView[]>([])

  /**
   * A request can have multiple compiled rows (e.g. national compilation and ministry submission)
   * that carry the same responses. Keep one per request so the focus view is not duplicated.
   */
  const dedupedRecords = useMemo(() => {
    // Only ministry submissions; fall back to all rows if none are marked (avoids an empty view).
    const ministry = records.filter(isMinistryCompiledRecord)
    const source = ministry.length > 0 ? ministry : records
    const byReq = new Map<string, CompiledRecordRow>()
    const noReq: CompiledRecordRow[] = []
    for (const r of source) {
      if (!r.req_id) {
        noReq.push(r)
        continue
      }
      const existing = byReq.get(r.req_id)
      byReq.set(r.req_id, existing ? preferCompiledRecord(existing, r) : r)
    }
    return [...byReq.values(), ...noReq]
  }, [records])

  useEffect(() => {
    if (dedupedRecords.length === 0) {
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
        const reqIds = [...new Set(dedupedRecords.map((r) => r.req_id).filter((id): id is string => Boolean(id)))]
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
          dedupedRecords.map(async (record) => {
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
  }, [dedupedRecords, indicatorId])

  /** Collection years the selected indicator is configured to collect (from HR details). */
  const indicatorYearIds = useMemo(() => {
    const ids = new Set<number>()
    for (const view of recordViews) {
      const ind = view.hrDetail?.issue?.indicators?.find((i) => i.id === indicatorId)
      for (const y of ind?.collection_by_year ?? []) ids.add(y.year_id)
    }
    return ids
  }, [recordViews, indicatorId])

  /** The LOI / concluding observation the selected indicator belongs to (same across records). */
  const focusIssue = useMemo<HrRequestIssueDetail | null>(() => {
    for (const view of recordViews) {
      const issue = view.hrDetail?.issue
      if (issue?.indicators?.some((i) => i.id === indicatorId)) return issue
    }
    return recordViews.find((v) => v.hrDetail?.issue)?.hrDetail?.issue ?? null
  }, [recordViews, indicatorId])

  const yearFilterActive = filterYearId != null
  const yearLabelText = filterYearLabel?.trim() || (filterYearId != null ? String(filterYearId) : '')
  const yearUnavailable =
    yearFilterActive && !loading && !error && (records.length === 0 || !indicatorYearIds.has(filterYearId))

  return (
    <div className="reporting-indicator-focus">
      {loading ? <p className="muted">Loading indicator responses…</p> : null}
      {error ? <p className="login-error">{error}</p> : null}

      {yearUnavailable ? (
        <p className="app-alert app-alert--info reporting-indicator-focus__empty" role="status">
          Data is not available for this indicator in {yearLabelText || 'the selected year'}.
        </p>
      ) : null}

      {!loading && !error && !yearUnavailable && records.length === 0 ? (
        <p className="muted">No compiled records match this indicator and filters.</p>
      ) : null}

      {!loading && !error && !yearUnavailable && focusIssue ? (
        <header className="reporting-indicator-focus__issue">
          <span className="reporting-indicator-focus__issue-kind">
            {issueEntryKindBadgeLabel(coerceIssueEntryKind(focusIssue.entry_kind))}
          </span>
          <p className="reporting-indicator-focus__issue-cat">
            <strong>Category:</strong> {focusIssue.category?.name ?? '—'}
          </p>
          {focusIssue.description?.trim() ? (
            <p className="reporting-indicator-focus__issue-desc">{focusIssue.description.trim()}</p>
          ) : null}
        </header>
      ) : null}

      {!loading && !error && !yearUnavailable && recordViews.length > 0 ? (
        <div className="reporting-indicator-focus__list">
          {recordViews.map(({ record, hrDetail, regions }) => (
            <article key={record.id} className="reporting-indicator-focus__record">
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
                                filterYearId={filterYearId}
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
