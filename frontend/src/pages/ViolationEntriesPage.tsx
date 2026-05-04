import { useEffect, useState } from 'react'
import { fetchViolationEntries, type ViolationRow } from '../api/lists'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { TableCard } from '../components/ui/TableCard'

export function ViolationEntriesPage() {
  const [rows, setRows] = useState<ViolationRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchViolationEntries()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  return (
    <PageSection title="Violation entries">
      {error && <p className="login-error">{error}</p>}
      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>Entry #</th>
              <th>Title</th>
              <th>Region</th>
              <th>Event date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td>{v.entry_number}</td>
                <td>{v.title}</td>
                <td>{v.region_name}</td>
                <td>{v.event_date}</td>
                <td>{v.monitoring_status}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyStateRow colSpan={5} message="No violation entries available." />}
          </tbody>
        </table>
      </TableCard>
    </PageSection>
  )
}
