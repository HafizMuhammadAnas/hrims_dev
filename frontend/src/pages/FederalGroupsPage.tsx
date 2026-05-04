import { useEffect, useState } from 'react'
import { fetchFederalGroups } from '../api/federalGroups'
import type { FederalGroupRow } from '../api/federalGroups'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { TableCard } from '../components/ui/TableCard'

export function FederalGroupsPage() {
  const [rows, setRows] = useState<FederalGroupRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchFederalGroups()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  return (
    <PageSection title="Federal groups" subtitle="Initiatives linking multiple HR requests.">
      {error && <p className="login-error">{error}</p>}
      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Convention</th>
              <th>Date</th>
              <th>Status</th>
              <th>Linked requests</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id}>
                <td>{g.id}</td>
                <td>{g.title}</td>
                <td>{g.conv}</td>
                <td>{g.date}</td>
                <td>{g.status}</td>
                <td>{g.linked_requests.join(', ')}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyStateRow colSpan={6} message="No federal groups found." />}
          </tbody>
        </table>
      </TableCard>
    </PageSection>
  )
}
