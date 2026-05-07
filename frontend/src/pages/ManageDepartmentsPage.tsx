import { useEffect, useMemo, useState } from 'react'
import { createDepartment, deleteDepartment, fetchDepartments, updateDepartment, type DepartmentRow } from '../api/workflows'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { FormControl } from '../components/ui/FormControl'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { ModalActions } from '../components/ui/ModalChrome'
import { PageSection } from '../components/ui/PageSection'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { TableCard } from '../components/ui/TableCard'
import { useNotify } from '../context/NotificationsContext'
import { isFederalAdmin, isRegionalAdmin } from '../lib/roles'

type EditState = {
  id: number
  name: string
  code: string
  type: string
}

export function ManageDepartmentsPage() {
  const { user } = useAuth()
  const notify = useNotify()
  const federal = isFederalAdmin(user)
  const regional = isRegionalAdmin(user)

  const [rows, setRows] = useState<DepartmentRow[]>([])
  const [createName, setCreateName] = useState('')
  const [createCode, setCreateCode] = useState('')
  const [createType, setCreateType] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [openActionId, setOpenActionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const subtitle = federal
    ? 'Create and maintain federal department records (ICT scope).'
    : regional
      ? 'Create and maintain your region department records only.'
      : 'Department management is available for federal and regional administrators.'

  const regionLabel = useMemo(() => {
    const labels = new Set(rows.map((r) => r.region_name).filter(Boolean) as string[])
    return labels.size > 0 ? Array.from(labels).join(', ') : 'N/A'
  }, [rows])

  async function load() {
    setRows(await fetchDepartments())
  }

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load departments'))
  }, [])

  async function handleCreate() {
    if (!createName.trim()) {
      setError('Department name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createDepartment({
        name: createName.trim(),
        code: createCode.trim() || null,
        type: createType.trim() || null,
      })
      setCreateName('')
      setCreateCode('')
      setCreateType('')
      await load()
      notify.success('Department created.')
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!edit) return
    if (!edit.name.trim()) {
      setError('Department name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateDepartment(edit.id, {
        name: edit.name.trim(),
        code: edit.code.trim() || null,
        type: edit.type.trim() || null,
      })
      setEdit(null)
      await load()
      notify.success('Department updated.')
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    setSaving(true)
    setError(null)
    try {
      await deleteDepartment(id)
      await load()
      notify.info('Department deleted.')
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageSection title="Manage departments" subtitle={subtitle}>
      {error && (
        <Alert variant="error" title="Something went wrong" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableCard padded>
        <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
          Department scope: <strong>{regionLabel}</strong>
        </p>
        <FormGrid>
          <FormRow twoCol>
            <FormControl label="Department name">
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Department name" />
            </FormControl>
            <FormControl label="Code (optional)">
              <input value={createCode} onChange={(e) => setCreateCode(e.target.value)} placeholder="Code" />
            </FormControl>
          </FormRow>
          <FormControl label="Type (optional)">
            <input value={createType} onChange={(e) => setCreateType(e.target.value)} placeholder="e.g. federal-line" />
          </FormControl>
          <ModalActions>
            <Button variant="primary" compact disabled={saving} onClick={() => void handleCreate()}>
              {saving ? 'Saving...' : 'Create department'}
            </Button>
          </ModalActions>
        </FormGrid>
      </TableCard>

      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Region</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) =>
              edit?.id === d.id ? (
                <tr key={d.id}>
                  <td>
                    <input
                      value={edit.code}
                      onChange={(e) => setEdit((prev) => (prev ? { ...prev, code: e.target.value } : prev))}
                    />
                  </td>
                  <td>
                    <input
                      value={edit.name}
                      onChange={(e) => setEdit((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                    />
                  </td>
                  <td>
                    <input
                      value={edit.type}
                      onChange={(e) => setEdit((prev) => (prev ? { ...prev, type: e.target.value } : prev))}
                    />
                  </td>
                  <td>{d.region_name ?? '—'}</td>
                  <td>
                    <Button variant="primary" compact disabled={saving} onClick={() => void handleUpdate()}>
                      Save
                    </Button>{' '}
                    <Button variant="link" compact onClick={() => setEdit(null)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={d.id}>
                  <td>{d.code ?? '—'}</td>
                  <td>{d.name}</td>
                  <td>{d.type ?? '—'}</td>
                  <td>{d.region_name ?? '—'}</td>
                  <td>
                    <RowActionsMenu
                      isOpen={openActionId === d.id}
                      onOpenChange={(open) => setOpenActionId(open ? d.id : null)}
                    >
                      <Button
                        variant="link"
                        compact
                        onClick={() =>
                          setEdit({
                            id: d.id,
                            name: d.name,
                            code: d.code ?? '',
                            type: d.type ?? '',
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        variant="link"
                        compact
                        dangerLink
                        disabled={saving}
                        onClick={() => {
                          void handleDelete(d.id)
                          setOpenActionId(null)
                        }}
                      >
                        Delete
                      </Button>
                    </RowActionsMenu>
                  </td>
                </tr>
              ),
            )}
            {rows.length === 0 && <EmptyStateRow colSpan={5} message="No departments in your scope." />}
          </tbody>
        </table>
      </TableCard>
    </PageSection>
  )
}
