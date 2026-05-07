import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../api/lists'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableCard } from '../components/ui/TableCard'
import { workflowPresentation } from '../lib/departmentTaskWorkflow'

export function DepartmentTasksPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<DepartmentTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)

  function reload() {
    return fetchDepartmentTasks()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }

  useEffect(() => {
    void reload()
  }, [])

  const fromParam = encodeURIComponent('/department-tasks')

  return (
    <PageSection
      title="Department tasks"
      subtitle="Open a task to read the HR request and submit your department’s response when it is open for input."
    >
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
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const wf = workflowPresentation(t)
              return (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.req_id}</td>
                <td>{t.region_name}</td>
                <td>{t.department_name}</td>
                <td>
                  <StatusBadge tone={wf.tone}>{wf.label}</StatusBadge>
                </td>
                <td>{t.assigned_date}</td>
                <td className="table-actions">
                  <Button
                    variant="primary"
                    compact
                    onClick={() =>
                      navigate(
                        `/requests/${encodeURIComponent(t.req_id)}?task=${encodeURIComponent(t.id)}&from=${fromParam}`,
                      )
                    }
                  >
                    View & response
                  </Button>
                </td>
              </tr>
            )})}
            {rows.length === 0 && <EmptyStateRow colSpan={7} message="No department tasks available." />}
          </tbody>
        </table>
      </TableCard>
    </PageSection>
  )
}
