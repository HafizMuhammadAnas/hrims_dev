import { useEffect, useState } from 'react'
import {
  fetchDepartmentTaskRevisions,
  fetchRegionalResponseRevisions,
  type DepartmentTaskRevisionRow,
  type RegionalResponseRevisionRow,
} from '../api/workflows'
import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { formatAppDateTime } from '../lib/dateFormat'
import { DepartmentResponseDisplay } from './DepartmentResponseDisplay'

type RegionalProps = {
  kind: 'regional'
  regionalResponseId: string
  /** Optional live title/content override (falls back to API `current`). */
  currentTitle?: string
  currentContent?: string
  /** When true, render nothing if there are no revision snapshots. */
  silentWhenEmpty?: boolean
}

type DepartmentProps = {
  kind: 'department'
  departmentTaskId: string
  currentResponseData?: string | null
  currentAttachmentUrl?: string | null
  onlyIndicatorIds?: number[]
  issueIndicators?: HrRequestIssueIndicator[]
  locationRegionIds?: number[]
  /** When true, render nothing if there are no revision snapshots. */
  silentWhenEmpty?: boolean
  /** Federal portal: only revisions from a federal→region→department chain. */
  audience?: 'federal' | 'regional'
}

type Props = RegionalProps | DepartmentProps

function RegionalBody({
  title,
  content,
  changedTitle,
  changedContent,
}: {
  title: string
  content: string
  changedTitle?: boolean
  changedContent?: boolean
}) {
  return (
    <div className="response-revision-snapshot">
      {title.trim() ? (
        <h4
          className={`response-revision-snapshot__title${
            changedTitle ? ' response-revision-changed response-revision-changed--block' : ''
          }`}
        >
          {title.trim()}
        </h4>
      ) : null}
      <div
        className={`compiled-record-body regional-response-body${
          changedContent ? ' response-revision-changed response-revision-changed--block' : ''
        }`}
      >
        {content.trim() ? content : '—'}
      </div>
    </div>
  )
}

function RevisionMeta({
  label,
  at,
  by,
}: {
  label: string
  at: string | null | undefined
  by?: string | null
}) {
  return (
    <p className="response-revision-pair__meta muted">
      <strong>{label}</strong>
      {at ? <> · {formatAppDateTime(at)}</> : null}
      {by ? <> · {by}</> : null}
    </p>
  )
}

function sortByRevisionAsc<T extends { revision_no: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.revision_no - b.revision_no)
}

export function ResponseRevisionChangesPanel(props: Props) {
  const [regionalRevs, setRegionalRevs] = useState<RegionalResponseRevisionRow[] | null>(null)
  const [regionalCurrent, setRegionalCurrent] = useState<{ title: string; content: string; updated_at?: string | null } | null>(
    null,
  )
  const [deptRevs, setDeptRevs] = useState<DepartmentTaskRevisionRow[] | null>(null)
  const [deptCurrent, setDeptCurrent] = useState<{
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
        if (props.kind === 'regional') {
          const payload = await fetchRegionalResponseRevisions(props.regionalResponseId)
          if (!cancelled) {
            setRegionalRevs(payload.revisions)
            setRegionalCurrent(payload.current)
          }
        } else {
          const payload = await fetchDepartmentTaskRevisions(props.departmentTaskId, {
            audience: props.audience,
          })
          if (!cancelled) {
            setDeptRevs(payload.revisions)
            setDeptCurrent(payload.current)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load change history.')
          setRegionalRevs([])
          setDeptRevs([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    props.kind,
    props.kind === 'regional' ? props.regionalResponseId : props.departmentTaskId,
    props.kind === 'department' ? props.audience : undefined,
  ])

  if (loading) {
    return <p className="muted response-revision-empty">Loading change history…</p>
  }
  if (error) {
    return <p className="form-error response-revision-empty">{error}</p>
  }

  if (props.kind === 'regional') {
    const revsAsc = sortByRevisionAsc(regionalRevs ?? [])
    if (revsAsc.length === 0) {
      if (props.silentWhenEmpty) return null
      return (
        <p className="muted response-revision-empty">
          No resubmissions yet. Change history appears after the region updates a compilation that was
          sent back for revision.
        </p>
      )
    }
    const latest = revsAsc[revsAsc.length - 1]!
    const afterTitle = (props.currentTitle ?? regionalCurrent?.title ?? '').trim()
    const afterContent = props.currentContent ?? regionalCurrent?.content ?? ''
    const earlier = revsAsc.slice(0, -1).reverse()

    return (
      <div className="response-revision-history" role="region" aria-label="Change history">
        <article className="response-revision-pair">
          <RevisionMeta
            label={`Revision ${latest.revision_no} → current`}
            at={latest.created_at}
            by={latest.submitted_by_name}
          />
          <div className="response-revision-pair__cols">
            <section className="response-revision-pair__col">
              <h3 className="response-revision-pair__heading">Before</h3>
              <RegionalBody title={latest.title} content={latest.content} />
            </section>
            <section className="response-revision-pair__col response-revision-pair__col--new">
              <h3 className="response-revision-pair__heading">After (current)</h3>
              <RevisionMeta label="Current" at={regionalCurrent?.updated_at} />
              <RegionalBody
                title={afterTitle}
                content={afterContent}
                changedTitle={afterTitle.trim() !== (latest.title ?? '').trim()}
                changedContent={(afterContent ?? '').trim() !== (latest.content ?? '').trim()}
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
                  <RevisionMeta
                    label={`Revision ${r.revision_no}`}
                    at={r.created_at}
                    by={r.submitted_by_name}
                  />
                  <RegionalBody title={r.title} content={r.content} />
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    )
  }

  const revsAsc = sortByRevisionAsc(deptRevs ?? [])
  if (revsAsc.length === 0) {
    if (props.silentWhenEmpty) return null
    return (
      <p className="muted response-revision-empty">
        {props.audience === 'federal'
          ? 'No department resubmissions from a federal revision request yet.'
          : 'No resubmissions yet. Change history appears after the department updates a response that was sent back for revision.'}
      </p>
    )
  }

  const latest = revsAsc[revsAsc.length - 1]!
  const afterData = props.currentResponseData ?? deptCurrent?.response_data ?? null
  const afterAttachment = props.currentAttachmentUrl ?? deptCurrent?.attachment_url ?? null
  const earlier = revsAsc.slice(0, -1).reverse()
  const displayOpts = {
    onlyIndicatorIds: props.onlyIndicatorIds,
    issueIndicators: props.issueIndicators,
    locationRegionIds: props.locationRegionIds,
  }

  return (
    <div className="response-revision-history" role="region" aria-label="Change history">
      <article className="response-revision-pair">
        <RevisionMeta
          label={`Revision ${latest.revision_no} → current`}
          at={latest.created_at}
          by={latest.submitted_by_name}
        />
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
            <RevisionMeta label="Current" at={deptCurrent?.updated_at} />
            <DepartmentResponseDisplay
              responseData={afterData}
              attachmentUrl={afterAttachment}
              compareAgainstResponseData={latest.response_data}
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
                <RevisionMeta
                  label={`Revision ${r.revision_no}`}
                  at={r.created_at}
                  by={r.submitted_by_name}
                />
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
  )
}
