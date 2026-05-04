import { useEffect, useMemo, useState } from 'react'
import { isApiError } from '../api/apiError'
import { fetchRegions } from '../api/regions'
import { createUser, deleteUser, fetchUsers } from '../api/users'
import { fetchDepartments } from '../api/workflows'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { FormControl } from '../components/ui/FormControl'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { ModalActions, ModalHeader } from '../components/ui/ModalChrome'
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { StatsCards } from '../components/ui/StatsCards'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { useNotify } from '../context/NotificationsContext'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { isSuperAdmin } from '../lib/roles'
import type { AuthUser } from '../types/auth'

type RoleSlug = 'federal_admin' | 'regional_admin' | 'department_admin' | 'viewer'

export function UserManagementPage() {
  const { user } = useAuth()
  const notify = useNotify()
  const superUser = isSuperAdmin(user)
  const [rows, setRows] = useState<AuthUser[]>([])
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([])
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
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

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.row-actions-menu')) return
      setOpenActionId(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

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
      setShowCreateModal(false)
      await load()
      notify.success(`User “${uname}” was created.`)
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

  const activeCount = rows.filter((u) => u.is_active).length
  const roleBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    rows.forEach((u) => {
      const key = u.roles[0]?.slug ?? 'unknown'
      counts[key] = (counts[key] ?? 0) + 1
    })
    return Object.entries(counts)
  }, [rows])

  const subtitle = superUser
    ? 'Create federal and regional administrators only. Define department records per region under Super admin → Departments; federal and regional admins assign department user accounts.'
    : 'Federal admins add federal-line department accounts; regional admins add accounts for departments in their region only. Regional administrator accounts are created by a super administrator.'
  const roleFilter = filters.role ?? ''
  const statusFilter = filters.status ?? ''
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((u) => {
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
  }, [rows, search, roleFilter, statusFilter])
  const roleOptions = useMemo(() => {
    return Array.from(new Set(rows.flatMap((u) => u.roles.map((r) => r.slug)))).sort()
  }, [rows])
  const { pageRows } = useMemo(
    () => derivePaginatedRows(filteredRows, page, pageSize),
    [filteredRows, page, pageSize],
  )

  return (
    <PageSection title="User management" subtitle={subtitle}>
      {error && (
        <Alert variant="error" title="Something went wrong" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'Users in scope', value: rows.length },
            { label: 'Active users', value: activeCount },
            { label: 'Inactive users', value: rows.length - activeCount },
          ]}
        />
      </div>
      {roleBreakdown.length > 0 && (
        <div className="chip-list" style={{ marginTop: 10 }}>
          {roleBreakdown.map(([role, count]) => (
            <StatusBadge key={role} tone="pending">
              {role}: {count}
            </StatusBadge>
          ))}
        </div>
      )}

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
        <Button variant="primary" compact className="user-management-toolbar__create" onClick={() => setShowCreateModal(true)}>
          {superUser ? 'Create admin' : 'Create user'}
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
              <th>Department</th>
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
                <td>{u.region?.name ?? '—'}</td>
                <td>{u.department?.name ?? '—'}</td>
                <td>
                  <StatusBadge tone={u.is_active ? 'success' : 'pending'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </td>
                <td className="table-actions">
                  {Number(u.id) !== Number(user?.id) && !u.roles.some((r) => r.slug === 'super_admin') ? (
                    <div className="row-actions-menu">
                      <button
                        type="button"
                        className="row-actions-trigger"
                        onClick={() => setOpenActionId((prev) => (prev === Number(u.id) ? null : Number(u.id)))}
                      >
                        Action
                      </button>
                      {openActionId === Number(u.id) && (
                        <div className="row-actions-list">
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
                        </div>
                      )}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && <EmptyStateRow colSpan={7} message="No users found in current scope." />}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={filteredRows.length} onPageChange={setPage} />

      {showCreateModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={superUser ? 'Create administrator' : 'Create user'} onClose={() => setShowCreateModal(false)} />
            <div className="modal-form">
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
                        <option value="">Select region…</option>
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
                        <option value="">Select department…</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code ? `${d.code} — ` : ''}
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  )}
                </FormRow>
              </FormGrid>
              <ModalActions>
                <Button variant="secondary" compact onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" compact disabled={saving} onClick={() => void submit()}>
                  {saving ? 'Creating...' : 'Create user'}
                </Button>
              </ModalActions>
            </div>
          </div>
        </div>
      )}
    </PageSection>
  )
}
