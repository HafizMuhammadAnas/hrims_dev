import { useEffect, useState } from 'react'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../api/lists'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { TableCard } from '../components/ui/TableCard'

export function DepartmentTasksPage() {
  const [rows, setRows] = useState<DepartmentTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchDepartmentTasks()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  return (
    <PageSection title="Department tasks">
      {error && <p className="login-error">{error}</p>}
      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Request</th>
              <th>Region</th>
              <th>Department</th>
              <th>Status</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.req_id}</td>
                <td>{t.region_name}</td>
                <td>{t.department_name}</td>
                <td>{t.status}</td>
                <td>{t.assigned_date}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyStateRow colSpan={6} message="No department tasks available." />}
          </tbody>
        </table>
      </TableCard>
    </PageSection>
  )
}
