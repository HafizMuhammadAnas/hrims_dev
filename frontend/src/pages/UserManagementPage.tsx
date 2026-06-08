import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { isApiError } from '../api/apiError'
import { fetchRegions } from '../api/regions'
import { createUser, deleteUser, fetchUsers, updateUser } from '../api/users'
import { fetchDepartments } from '../api/workflows'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { FormControl } from '../components/ui/FormControl'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { ModalActions } from '../components/ui/ModalChrome'
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { StatsCards } from '../components/ui/StatsCards'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { useNotify } from '../context/NotificationsContext'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { sortRowsLatestFirst } from '../lib/tableRowSort'
import { isSuperAdmin } from '../lib/roles'
import { workflowBackLabel } from '../lib/workflowNavigation'
import {
  resolveUsersMgmtView,
  usersMgmtBasePath,
  usersMgmtEditPath,
  usersMgmtEditUserId,
  usersMgmtTabs,
} from '../lib/usersMgmtNavigation'
import type { AuthUser } from '../types/auth'

type RoleSlug = 'federal_admin' | 'regional_admin' | 'department_admin' | 'viewer'

const ADMIN_ROLE_SLUGS = ['federal_admin', 'regional_admin'] as const

export function UserManagementPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const notify = useNotify()
  const superUser = isSuperAdmin(user)
  const basePath = usersMgmtBasePath(location.pathname)
  const view = resolveUsersMgmtView(location.pathname)
  const editUserId = usersMgmtEditUserId(location.pathname)
  const createTabLabel = superUser ? 'Create admin' : 'Create user'
  const tabs = usersMgmtTabs(basePath, createTabLabel)
  const [rows, setRows] = useState<AuthUser[]>([])
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([])
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [openActionId, setOpenActionId] = useState<number | null>(null)
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role_slug: 'department_admin' as RoleSlug,
    region_id: '',
    department_id: '',
  })
  const table = useClientTableState({ pageSize: 10 })
  const { search, setSearch, filters, setFilter, resetFilters, page, setPage, pageSize } = table

  async function load() {
    const users = await fetchUsers()
    setRows(users)
    if (superUser) {
      setRegions(await fetchRegions())
    } else {
      setDepartments(await fetchDepartments())
    }
  }

  useEffect(() => {
    if (superUser) {
      setForm((f) =>
        f.role_slug === 'department_admin' || f.role_slug === 'viewer' ? { ...f, role_slug: 'federal_admin' } : f,
      )
    }
  }, [superUser])

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when super flag from auth
  }, [superUser])

  async function submit() {
    if (!form.name || !form.username || !form.password) {
      setError('Name, username, and password are required.')
      return
    }
    if (superUser) {
      if (form.role_slug === 'regional_admin' && !form.region_id) {
        setError('Region is required for regional administrators.')
        return
      }
    } else {
      if (!form.department_id) {
        setError('Department is required.')
        return
      }
    }
    setSaving(true)
    setError(null)
    const uname = form.username
    try {
      if (superUser) {
        if (form.role_slug === 'federal_admin') {
          await createUser({
            name: form.name,
            username: form.username,
            email: form.email || null,
            password: form.password,
            role_slug: 'federal_admin',
            region_id: null,
            department_id: null,
          })
        } else {
          await createUser({
            name: form.name,
            username: form.username,
            email: form.email || null,
            password: form.password,
            role_slug: 'regional_admin',
            region_id: Number(form.region_id),
            department_id: null,
          })
        }
      } else {
        await createUser({
          name: form.name,
          username: form.username,
          email: form.email || null,
          password: form.password,
          role_slug: form.role_slug as 'department_admin' | 'viewer',
          department_id: Number(form.department_id),
        })
      }
      setForm({
        name: '',
        username: '',
        email: '',
        password: '',
        role_slug: superUser ? 'federal_admin' : 'department_admin',
        region_id: '',
        department_id: '',
      })
      await load()
      notify.success(`User "${uname}" was created.`)
      navigate(basePath)
    } catch (e) {
      if (isApiError(e)) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : 'Create failed')
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    try {
      await deleteUser(id)
      await load()
      notify.info('User removed.')
    } catch (e) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const scopedRows = useMemo(() => {
    if (!superUser) return rows
    return rows.filter((u) =>
      u.roles.some((r) => ADMIN_ROLE_SLUGS.includes(r.slug as (typeof ADMIN_ROLE_SLUGS)[number])),
    )
  }, [rows, superUser])

  const activeCount = scopedRows.filter((u) => u.is_active).length
  const roleFilter = filters.role ?? ''
  const statusFilter = filters.status ?? ''
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matched = scopedRows.filter((u) => {
      if (roleFilter && !u.roles.some((r) => r.slug === roleFilter)) return false
      if (statusFilter) {
        const normalized = u.is_active ? 'active' : 'inactive'
        if (normalized !== statusFilter) return false
      }
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.region?.name ?? '').toLowerCase().includes(q) ||
        (u.department?.name ?? '').toLowerCase().includes(q)
      )
    })
    return sortRowsLatestFirst(matched, (u) => u.id)
  }, [scopedRows, search, roleFilter, statusFilter])
  const roleOptions = useMemo(() => {
    if (superUser) return [...ADMIN_ROLE_SLUGS]
    return Array.from(new Set(scopedRows.flatMap((u) => u.roles.map((r) => r.slug)))).sort()
  }, [scopedRows, superUser])
  const { pageRows } = useMemo(
    () => derivePaginatedRows(filteredRows, page, pageSize),
    [filteredRows, page, pageSize],
  )
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    is_active: true,
    password: '',
  })

  const editingUser = useMemo(() => {
    if (editUserId == null) return null
    return scopedRows.find((u) => Number(u.id) === editUserId) ?? null
  }, [scopedRows, editUserId])

  useEffect(() => {
    if (view !== 'edit' || !editingUser) return
    setEditForm({
      name: editingUser.name,
      email: editingUser.email ?? '',
      is_active: editingUser.is_active,
      password: '',
    })
  }, [view, editingUser])

  async function submitEdit() {
    if (editUserId == null) return
    if (!editForm.name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateUser(editUserId, {
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        is_active: editForm.is_active,
        ...(editForm.password.trim() ? { password: editForm.password.trim() } : {}),
      })
      await load()
      notify.success('User updated.')
      navigate(basePath)
    } catch (e) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Update failed')
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
      title={view === 'edit' ? 'Edit user' : 'User management'}
      leading={editBack}
    >
      {error && (
        <Alert variant="error" title="Something went wrong" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {view !== 'edit' && (
      <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label="User management sections">
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
          {!editingUser && !error ? <p className="muted">Loading user…</p> : null}
          {editingUser && (
            <TableCard padded>
              <p className="muted" style={{ marginTop: 0 }}>
                Username: <strong>{editingUser.username}</strong>
                {' | '}
                Role: {editingUser.roles.map((r) => r.slug).join(', ')}
              </p>
              <FormGrid>
                <FormRow twoCol>
                  <FormControl label="Name">
                    <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                  </FormControl>
                  <FormControl label="Email">
                    <input
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="email@example.com"
                    />
                  </FormControl>
                </FormRow>
                <FormRow twoCol>
                  <FormControl label="Temporary password (optional)">
                    <input
                      type="password"
                      value={editForm.password}
                      onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Leave blank to keep existing password"
                    />
                  </FormControl>
                  <FormControl label="Status">
                    <select
                      value={editForm.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.value === 'active' }))}
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </FormControl>
                </FormRow>
              </FormGrid>
              <ModalActions>
                <Button variant="secondary" compact onClick={() => navigate(basePath)}>
                  Cancel
                </Button>
                <Button variant="primary" compact disabled={saving} onClick={() => void submitEdit()}>
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              </ModalActions>
            </TableCard>
          )}
        </>
      )}

      {view === 'list' && (
        <>
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'Users in scope', value: scopedRows.length },
            { label: 'Active users', value: activeCount },
            { label: 'Inactive users', value: scopedRows.length - activeCount },
          ]}
        />
      </div>

      <TableToolbar className="user-management-toolbar">
        <input
          type="search"
          placeholder="Search name, username, email, region..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />
        <select value={roleFilter} onChange={(e) => setFilter('role', e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <Button
          variant="secondary"
          compact
          onClick={() => {
            setSearch('')
            resetFilters()
          }}
        >
          Reset filters
        </Button>
      </TableToolbar>

      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Region</th>
              {!superUser ? <th>Department</th> : null}
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.username}</td>
                <td>{u.roles.map((r) => r.slug).join(', ')}</td>
                <td>{u.region?.name ?? '-'}</td>
                {!superUser ? <td>{u.department?.name ?? '-'}</td> : null}
                <td>
                  <StatusBadge tone={u.is_active ? 'success' : 'default'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </td>
                <td className="table-actions">
                  {Number(u.id) !== Number(user?.id) && !u.roles.some((r) => r.slug === 'super_admin') ? (
                    <RowActionsMenu
                      isOpen={openActionId === Number(u.id)}
                      onOpenChange={(open) => setOpenActionId(open ? Number(u.id) : null)}
                    >
                      <Button
                        variant="link"
                        onClick={() => {
                          navigate(usersMgmtEditPath(basePath, Number(u.id)))
                          setOpenActionId(null)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="link"
                        dangerLink
                        onClick={() => {
                          void remove(Number(u.id))
                          setOpenActionId(null)
                        }}
                      >
                        Delete
                      </Button>
                    </RowActionsMenu>
                  ) : null}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <EmptyStateRow
                colSpan={superUser ? 6 : 7}
                message={
                  superUser
                    ? 'No federal or regional administrators found.'
                    : 'No users found in current scope.'
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
              <FormControl label="Name">
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </FormControl>
              <FormControl label="Username">
                <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              </FormControl>
            </FormRow>
            <FormRow twoCol>
              <FormControl label="Email">
                <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </FormControl>
              <FormControl label="Temporary password">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </FormControl>
            </FormRow>
            <FormRow twoCol>
              <FormControl label="Role">
                <select
                  value={form.role_slug}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      role_slug: e.target.value as RoleSlug,
                      region_id: '',
                      department_id: '',
                    }))
                  }
                >
                  {superUser && <option value="federal_admin">Federal admin</option>}
                  {superUser && <option value="regional_admin">Regional admin</option>}
                  {!superUser && <option value="department_admin">Department admin</option>}
                  {!superUser && <option value="viewer">Viewer</option>}
                </select>
              </FormControl>
              {superUser && form.role_slug === 'regional_admin' && (
                <FormControl label="Region">
                  <select value={form.region_id} onChange={(e) => setForm((f) => ({ ...f, region_id: e.target.value }))}>
                    <option value="">Select region...</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
              )}
              {!superUser && (
                <FormControl label="Department">
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">Select department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code ? `${d.code} - ` : ''}
                        {d.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
              )}
            </FormRow>
          </FormGrid>
          <ModalActions>
            <Button variant="secondary" compact onClick={() => navigate(basePath)}>
              Cancel
            </Button>
            <Button variant="primary" compact disabled={saving} onClick={() => void submit()}>
              {saving ? 'Creating...' : createTabLabel}
            </Button>
          </ModalActions>
        </TableCard>
      )}

    </PageSection>
  )
}
