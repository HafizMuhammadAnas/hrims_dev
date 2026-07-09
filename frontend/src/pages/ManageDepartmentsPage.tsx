import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { createDepartment, deleteDepartment, fetchDepartments, updateDepartment, type DepartmentRow } from '../api/workflows'
import { isApiError } from '../api/apiError'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { FormControl } from '../components/ui/FormControl'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { ModalActions } from '../components/ui/ModalChrome'
import { PageSection } from '../components/ui/PageSection'
import { LABEL_CREATE_DEPARTMENT, LABEL_EDIT_DEPARTMENT, LABEL_MANAGE_DEPARTMENTS } from '../lib/uiLabels'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { StatsCards } from '../components/ui/StatsCards'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { useNotify } from '../context/NotificationsContext'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { sortRowsLatestFirst } from '../lib/tableRowSort'
import { workflowBackLabel } from '../lib/workflowNavigation'
import {
  departmentsMgmtBasePath,
  departmentsMgmtEditId,
  departmentsMgmtEditPath,
  departmentsMgmtTabs,
  resolveDepartmentsMgmtView,
} from '../lib/departmentsMgmtNavigation'

export function ManageDepartmentsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const notify = useNotify()
  const basePath = departmentsMgmtBasePath(location.pathname)
  const view = resolveDepartmentsMgmtView(location.pathname)
  const editDepartmentId = departmentsMgmtEditId(location.pathname)
  const tabs = departmentsMgmtTabs(basePath)

  const [rows, setRows] = useState<DepartmentRow[]>([])
  const [createName, setCreateName] = useState('')
  const [createCode, setCreateCode] = useState('')
  const [createType, setCreateType] = useState('')
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editType, setEditType] = useState('')
  const [saving, setSaving] = useState(false)
  const [openActionId, setOpenActionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, page, setPage, pageSize } = table

  const regionCount = useMemo(() => {
    return new Set(rows.map((r) => r.region_name).filter(Boolean)).size
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matched = !q
      ? rows
      : rows.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            (d.code ?? '').toLowerCase().includes(q) ||
            (d.type ?? '').toLowerCase().includes(q) ||
            (d.region_name ?? '').toLowerCase().includes(q),
        )
    return sortRowsLatestFirst(matched, (d) => d.id)
  }, [rows, search])

  const { pageRows } = useMemo(
    () => derivePaginatedRows(filteredRows, page, pageSize),
    [filteredRows, page, pageSize],
  )

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
      navigate(basePath)
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const editingDepartment = useMemo(() => {
    if (editDepartmentId == null) return null
    return rows.find((d) => d.id === editDepartmentId) ?? null
  }, [rows, editDepartmentId])

  useEffect(() => {
    if (view !== 'edit' || !editingDepartment) return
    setEditName(editingDepartment.name)
    setEditCode(editingDepartment.code ?? '')
    setEditType(editingDepartment.type ?? '')
  }, [view, editingDepartment])

  async function handleUpdate() {
    if (editDepartmentId == null) return
    if (!editName.trim()) {
      setError('Department name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateDepartment(editDepartmentId, {
        name: editName.trim(),
        code: editCode.trim() || null,
        type: editType.trim() || null,
      })
      await load()
      notify.success('Department updated.')
      navigate(basePath)
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

  const editBack =
    view === 'edit' ? (
      <WorkflowPageBack to={basePath} label={workflowBackLabel(basePath)} placement="header" />
    ) : null

  return (
    <PageSection
      title={view === 'edit' ? LABEL_EDIT_DEPARTMENT : LABEL_MANAGE_DEPARTMENTS}
      leading={editBack}
    >
      {error && (
        <Alert variant="error" title="Something went wrong" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {view !== 'edit' && (
      <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label="Department management sections">
        {tabs.map((tab) => (
          <NavLink
            key={tab.view}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `compiled-record-modal-tab issues-admin-tab${isActive ? ' compiled-record-modal-tab--active' : ''}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      )}

      {view === 'edit' && (
        <>
          {!editingDepartment && !error ? <p className="muted">Loading department…</p> : null}
          {editingDepartment && (
            <TableCard padded>
              <FormGrid>
                <FormRow twoCol>
                  <FormControl label="Department name">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </FormControl>
                  <FormControl label="Code (optional)">
                    <input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                  </FormControl>
                </FormRow>
                <FormControl label="Type (optional)">
                  <input value={editType} onChange={(e) => setEditType(e.target.value)} />
                </FormControl>
                <ModalActions>
                  <Button variant="secondary" compact onClick={() => navigate(basePath)}>
                    Cancel
                  </Button>
                  <Button variant="primary" compact disabled={saving} onClick={() => void handleUpdate()}>
                    {saving ? 'Saving...' : 'Save changes'}
                  </Button>
                </ModalActions>
              </FormGrid>
            </TableCard>
          )}
        </>
      )}

      {view === 'list' && (
        <>
          <div style={{ marginTop: 16 }}>
            <StatsCards
              items={[
                { label: 'Total Departments', value: filteredRows.length },
                { label: 'Regions Represented', value: regionCount },
              ]}
            />
          </div>

          <TableToolbar>
            <input
              type="search"
              placeholder="Search name, code, type, region…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search departments"
            />
            <Button variant="secondary" compact type="button" onClick={() => setSearch('')}>
              Reset search
            </Button>
          </TableToolbar>

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
                {pageRows.map((d) => (
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
                            onClick={() => {
                              navigate(departmentsMgmtEditPath(basePath, d.id))
                              setOpenActionId(null)
                            }}
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
                ))}
                {pageRows.length === 0 && (
                  <EmptyStateRow
                    colSpan={5}
                    message={
                      search.trim() ? 'No departments match your search.' : 'No departments in your scope.'
                    }
                  />
                )}
              </tbody>
            </table>
          </TableCard>
          <PaginationBar page={page} pageSize={pageSize} totalItems={filteredRows.length} onPageChange={setPage} />
        </>
      )}

      {view === 'new' && (
        <TableCard padded>
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
              <Button variant="secondary" compact onClick={() => navigate(basePath)}>
                Cancel
              </Button>
              <Button variant="primary" compact disabled={saving} onClick={() => void handleCreate()}>
                {saving ? 'Saving...' : LABEL_CREATE_DEPARTMENT}
              </Button>
            </ModalActions>
          </FormGrid>
        </TableCard>
      )}
    </PageSection>
  )
}
