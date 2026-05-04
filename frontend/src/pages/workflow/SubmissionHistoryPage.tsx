import { useEffect, useState } from 'react'
import { fetchRegionalResponses, type RegionalResponseRow } from '../../api/lists'
import { EmptyStateRow } from '../../components/ui/EmptyStateRow'
import { PageSection } from '../../components/ui/PageSection'
import { TableCard } from '../../components/ui/TableCard'

type Props = {
  title: string
}

export function SubmissionHistoryPage({ title }: Props) {
  const [rows, setRows] = useState<RegionalResponseRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchRegionalResponses()
      .then((r) => setRows(r.sort((a, b) => b.submission_date.localeCompare(a.submission_date))))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  return (
    <PageSection title={title} subtitle="Submission history and federal review outcomes.">
      {error && <p className="login-error">{error}</p>}
      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>Response ID</th>
              <th>Request</th>
              <th>Title</th>
              <th>Date</th>
              <th>Status</th>
              <th>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.req_id}</td>
                <td>{r.title}</td>
                <td>{r.submission_date}</td>
                <td>{r.review_status}</td>
                <td>{r.comments || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyStateRow colSpan={6} message="No history found." />}
          </tbody>
        </table>
      </TableCard>
    </PageSection>
  )
}
