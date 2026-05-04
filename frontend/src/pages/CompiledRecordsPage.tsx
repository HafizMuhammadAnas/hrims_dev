import { useEffect, useState } from 'react'
import { fetchCompiledRecords, type CompiledRecordRow } from '../api/lists'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { TableCard } from '../components/ui/TableCard'

export function CompiledRecordsPage() {
  const [rows, setRows] = useState<CompiledRecordRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchCompiledRecords()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  return (
    <PageSection title="Compiled records">
      {error && <p className="login-error">{error}</p>}
      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Regions</th>
              <th>Status</th>
              <th>Compilation date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.region_names?.join(', ')}</td>
                <td>{r.status}</td>
                <td>{r.compilation_date ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyStateRow colSpan={5} message="No compiled records available." />}
          </tbody>
        </table>
      </TableCard>
    </PageSection>
  )
}
