import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateUprCategory,
  adminCreateUprCycle,
  adminCreateUprEntry,
  adminCreateUprRecommendationEntry,
  adminCreateUprType,
  adminDeleteUprCategory,
  adminDeleteUprCycle,
  adminDeleteUprRecommendationEntry,
  adminDeleteUprType,
  adminFetchUprCategories,
  adminFetchUprCycles,
  adminFetchUprEntries,
  adminFetchUprEntry,
  adminFetchUprRecommendationEntries,
  adminFetchUprTypes,
  adminUpdateUprCategory,
  adminUpdateUprCycle,
  adminUpdateUprEntry,
  adminUpdateUprRecommendationEntry,
  adminUpdateUprType,
  type AdminUprCategory,
  type AdminUprCycle,
  type AdminUprEntry,
  type AdminUprRecommendationEntry,
  type AdminUprType,
} from '../api/admin'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { DragHandle } from '../components/ui/DragHandle'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { FormControl } from '../components/ui/FormControl'
import { FormField } from '../components/ui/FormField'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { SortColumnHeader } from '../components/ui/SortColumnHeader'
import { StatsCards } from '../components/ui/StatsCards'
import { TableCard } from '../components/ui/TableCard'
import { TableExportButton } from '../components/ui/TableExportButton'
import { TableToolbar } from '../components/ui/TableToolbar'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { derivePaginatedRows, useClientTableState, type SortDirection } from '../hooks/useClientTableState'
import { reorderList } from '../lib/reorderList'
import { isSuperAdmin } from '../lib/roles'
import { compareStringValues } from '../lib/tableRowSort'
import type { TableExportColumn } from '../lib/tableExcelExport'
import {
  SUPER_ADMIN_UPR_MANAGEMENT,
  superAdminUprEntryEditPath,
  superAdminUprEntryViewPath,
  superAdminUprManagementCategoriesPath,
  superAdminUprManagementCategoryViewPath,
  superAdminUprManagementCreatePath,
  superAdminUprManagementCyclesPath,
  superAdminUprManagementCycleViewPath,
  superAdminUprManagementIndicatorsPath,
  superAdminUprManagementListPath,
  superAdminUprManagementRecommendationsPath,
  superAdminUprManagementRecommendationViewPath,
  superAdminUprManagementTypeViewPath,
} from '../lib/superAdminRoutes'

const PAGE_SIZE = 10

type UprMgmtView = 'types' | 'cycles' | 'categories' | 'recommendations' | 'list' | 'create' | 'indicators'

const UPR_MGMT_TABS: { view: UprMgmtView; to: string; label: string; end?: boolean }[] = [
  { view: 'types', to: SUPER_ADMIN_UPR_MANAGEMENT, label: 'UPR Types', end: true },
  { view: 'cycles', to: superAdminUprManagementCyclesPath(), label: 'Cycles' },
  { view: 'categories', to: superAdminUprManagementCategoriesPath(), label: 'Categories' },
  { view: 'recommendations', to: superAdminUprManagementRecommendationsPath(), label: 'Recommendation' },
  { view: 'list', to: superAdminUprManagementListPath(), label: 'List of UPR' },
  { view: 'create', to: superAdminUprManagementCreatePath(), label: 'Create UPR' },
  { view: 'indicators', to: superAdminUprManagementIndicatorsPath(), label: 'Indicator list' },
]

function resolveUprMgmtView(param: string | undefined, pathname: string): UprMgmtView | null {
  if (pathname.includes('/types/view/')) return 'types'
  if (pathname.includes('/cycles/view/')) return 'cycles'
  if (pathname.includes('/categories/view/')) return 'categories'
  if (pathname.includes('/recommendations/view/')) return 'recommendations'
  if (pathname.includes('/entries/view/') || pathname.includes('/entries/edit/')) return 'list'
  if (!param) return 'types'
  if (
    param === 'types' ||
    param === 'cycles' ||
    param === 'categories' ||
    param === 'recommendations' ||
    param === 'list' ||
    param === 'create' ||
    param === 'indicators'
  ) {
    return param
  }
  return null
}

function ActionMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <RowActionsMenu isOpen={open} onOpenChange={setOpen}>
      {children}
    </RowActionsMenu>
  )
}

function catalogIsActive(row: { is_active: boolean }): boolean {
  return row.is_active !== false
}

function statusLabel(row: { is_active: boolean }): string {
  return catalogIsActive(row) ? 'Active' : 'Inactive'
}

function formatTimestamp(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

export function UprManagementAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { uprView: uprViewParam, recordId: recordIdParam } = useParams<{
    uprView?: string
    recordId?: string
  }>()
  const view = resolveUprMgmtView(uprViewParam, location.pathname)
  const viewRecordId =
    recordIdParam && !Number.isNaN(Number(recordIdParam)) ? Number(recordIdParam) : null
  const isViewRoute = location.pathname.includes('/view/')

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [types, setTypes] = useState<AdminUprType[]>([])
  const [cycles, setCycles] = useState<AdminUprCycle[]>([])
  const [categories, setCategories] = useState<AdminUprCategory[]>([])
  const [recommendations, setRecommendations] = useState<AdminUprRecommendationEntry[]>([])
  const [entries, setEntries] = useState<AdminUprEntry[]>([])
  const isEditRoute = location.pathname.includes('/entries/edit/')

  const refreshTypes = useCallback(async () => {
    setTypes(await adminFetchUprTypes())
  }, [])

  const refreshCycles = useCallback(async () => {
    setCycles(await adminFetchUprCycles())
  }, [])

  const refreshCategories = useCallback(async () => {
    setCategories(await adminFetchUprCategories())
  }, [])

  const refreshRecommendations = useCallback(async () => {
    setRecommendations(await adminFetchUprRecommendationEntries())
  }, [])

  const refreshEntries = useCallback(async () => {
    setEntries(await adminFetchUprEntries())
  }, [])

  const refreshAll = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([
        refreshTypes(),
        refreshCycles(),
        refreshCategories(),
        refreshRecommendations(),
        refreshEntries(),
      ])
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Load failed')
    }
  }, [refreshTypes, refreshCycles, refreshCategories, refreshRecommendations, refreshEntries])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  if (!view) {
    return <Navigate to={SUPER_ADMIN_UPR_MANAGEMENT} replace />
  }

  if (isEditRoute && viewRecordId != null) {
    return (
      <div className="page-shell">
        {error ? (
          <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <WorkflowPageBack
          placement="header"
          label="Back to List of UPR"
          to={superAdminUprManagementListPath()}
        />
        <TableCard padded>
          <UprCreateForm
            types={types}
            cycles={cycles}
            categories={categories}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            editEntryId={viewRecordId}
            onSaved={async () => {
              await refreshEntries()
            }}
          />
        </TableCard>
      </div>
    )
  }

  if (isViewRoute && viewRecordId != null) {
    if (location.pathname.includes('/entries/view/')) {
      return (
        <UprEntryViewPage
          entryId={viewRecordId}
          error={error}
          setError={setError}
          busy={busy}
          setBusy={setBusy}
          onRefresh={refreshEntries}
        />
      )
    }
    if (view === 'types') {
      const row = types.find((t) => t.id === viewRecordId)
      return (
        <div className="page-shell">
          {error ? (
            <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          ) : null}
          <WorkflowPageBack
            placement="header"
            label="Back to UPR Types"
            to={SUPER_ADMIN_UPR_MANAGEMENT}
          />
          {!row ? (
            <p className="muted">Type not found.</p>
          ) : (
            <UprTypeViewCard
              row={row}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onRefresh={refreshTypes}
            />
          )}
        </div>
      )
    }
    if (view === 'cycles') {
      const row = cycles.find((c) => c.id === viewRecordId)
      return (
        <div className="page-shell">
          {error ? (
            <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          ) : null}
          <WorkflowPageBack
            placement="header"
            label="Back to Cycles"
            to={superAdminUprManagementCyclesPath()}
          />
          {!row ? (
            <p className="muted">Cycle not found.</p>
          ) : (
            <UprCycleViewCard
              row={row}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onRefresh={refreshCycles}
            />
          )}
        </div>
      )
    }
    if (view === 'categories') {
      const row = categories.find((c) => c.id === viewRecordId)
      return (
        <div className="page-shell">
          {error ? (
            <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          ) : null}
          <WorkflowPageBack
            placement="header"
            label="Back to Categories"
            to={superAdminUprManagementCategoriesPath()}
          />
          {!row ? (
            <p className="muted">Category not found.</p>
          ) : (
            <UprCategoryViewCard
              row={row}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onRefresh={refreshCategories}
            />
          )}
        </div>
      )
    }
    if (view === 'recommendations') {
      const row = recommendations.find((r) => r.id === viewRecordId)
      return (
        <div className="page-shell">
          {error ? (
            <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          ) : null}
          <WorkflowPageBack
            placement="header"
            label="Back to Recommendation"
            to={superAdminUprManagementRecommendationsPath()}
          />
          {!row ? (
            <p className="muted">Recommendation not found.</p>
          ) : (
            <UprRecommendationViewCard
              row={row}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onRefresh={refreshRecommendations}
            />
          )}
        </div>
      )
    }
  }

  return (
    <div className="page-shell">
      {error ? (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label="UPR Management sections">
        {UPR_MGMT_TABS.map((tab) => (
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

      {view === 'types' ? (
        <UprTypesSection
          rows={types}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshTypes}
        />
      ) : null}

      {view === 'cycles' ? (
        <UprCyclesSection
          rows={cycles}
          types={types}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshCycles}
        />
      ) : null}

      {view === 'categories' ? (
        <UprCategoriesSection
          rows={categories}
          cycles={cycles}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshCategories}
        />
      ) : null}

      {view === 'recommendations' ? (
        <UprRecommendationsSection
          rows={recommendations}
          cycles={cycles}
          categories={categories}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshRecommendations}
        />
      ) : null}

      {view === 'list' ? (
        <UprEntriesListSection
          rows={entries}
          setError={setError}
          onRefresh={refreshEntries}
        />
      ) : null}

      {view === 'create' ? (
        <TableCard padded>
          <UprCreateForm
            types={types}
            cycles={cycles}
            categories={categories}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onSaved={async () => {
              await refreshEntries()
            }}
          />
        </TableCard>
      ) : null}

      {view === 'indicators' ? <UprIndicatorsListSection entries={entries} /> : null}
    </div>
  )
}

function UprTypeViewCard({
  row,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  row: AdminUprType
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  return (
    <TableCard padded>
      <h2 style={{ marginTop: 0 }}>UPR Type #{row.id}</h2>
      <dl className="upr-mgmt-view-dl">
        <div>
          <dt>Name</dt>
          <dd>{row.name}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={catalogIsActive(row) ? 'status-badge success' : 'status-badge default'}>
              {statusLabel(row)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatTimestamp(row.created_at)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatTimestamp(row.updated_at)}</dd>
        </div>
      </dl>
      <div style={{ marginTop: 16 }}>
        <Button
          variant="secondary"
          compact
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminUpdateUprType(row.id, { is_active: !catalogIsActive(row) })
                await onRefresh()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Update failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          {catalogIsActive(row) ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </TableCard>
  )
}

function UprCycleViewCard({
  row,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  row: AdminUprCycle
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  return (
    <TableCard padded>
      <h2 style={{ marginTop: 0 }}>Cycle #{row.id}</h2>
      <dl className="upr-mgmt-view-dl">
        <div>
          <dt>Name</dt>
          <dd>{row.name}</dd>
        </div>
        <div>
          <dt>UPR Type</dt>
          <dd>{row.type?.name || '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={catalogIsActive(row) ? 'status-badge success' : 'status-badge default'}>
              {statusLabel(row)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatTimestamp(row.created_at)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatTimestamp(row.updated_at)}</dd>
        </div>
      </dl>
      <div style={{ marginTop: 16 }}>
        <Button
          variant="secondary"
          compact
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminUpdateUprCycle(row.id, { is_active: !catalogIsActive(row) })
                await onRefresh()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Update failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          {catalogIsActive(row) ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </TableCard>
  )
}

function UprCategoryViewCard({
  row,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  row: AdminUprCategory
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  return (
    <TableCard padded>
      <h2 style={{ marginTop: 0 }}>Category #{row.id}</h2>
      <dl className="upr-mgmt-view-dl">
        <div>
          <dt>Name</dt>
          <dd>{row.name}</dd>
        </div>
        <div>
          <dt>Cycle</dt>
          <dd>{row.cycle?.name || '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={catalogIsActive(row) ? 'status-badge success' : 'status-badge default'}>
              {statusLabel(row)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatTimestamp(row.created_at)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatTimestamp(row.updated_at)}</dd>
        </div>
      </dl>
      <div style={{ marginTop: 16 }}>
        <Button
          variant="secondary"
          compact
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminUpdateUprCategory(row.id, { is_active: !catalogIsActive(row) })
                await onRefresh()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Update failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          {catalogIsActive(row) ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </TableCard>
  )
}

function UprTypesSection({
  rows,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  rows: AdminUprType[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: PAGE_SIZE })

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q) || String(r.id).includes(q))
  }, [rows, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)
  const activeCount = rows.filter(catalogIsActive).length

  return (
    <div className="issues-catalog-page">
      <div className="upr-mgmt-create-bar">
        <Button
          variant="primary"
          compact
          onClick={() => {
            setCreateOpen((open) => {
              if (open) setName('')
              return !open
            })
          }}
        >
          {createOpen ? 'Close create form' : 'Create type'}
        </Button>
      </div>

      {createOpen ? (
        <div style={{ marginBottom: 16 }}>
          <TableCard padded>
            <div className="issues-catalog-add-form">
              <FormField label="Type name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Recommendation"
                  disabled={busy}
                />
              </FormField>
              <div className="issues-catalog-add-form__actions">
                <Button
                  variant="primary"
                  compact
                  disabled={busy || !name.trim()}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        await adminCreateUprType({ name: name.trim() })
                        setName('')
                        setCreateOpen(false)
                        await onRefresh()
                      } catch (e: unknown) {
                        setError(isApiError(e) ? e.message : 'Create failed')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  Add type
                </Button>
                <Button
                  variant="secondary"
                  compact
                  disabled={busy}
                  onClick={() => {
                    setName('')
                    setCreateOpen(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </TableCard>
        </div>
      ) : null}

      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <StatsCards
          items={[
            { label: 'Total Types', value: rows.length },
            { label: 'Active', value: activeCount },
            { label: 'Inactive', value: rows.length - activeCount },
          ]}
        />
      </div>

      <TableToolbar className="issues-list-toolbar">
        <input
          type="search"
          placeholder="Search ID or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search UPR types"
        />
        <Button variant="secondary" compact onClick={() => setSearch('')}>
          Reset search
        </Button>
      </TableToolbar>

      <TableCard>
        <div className="table-card-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={4}
                  message={search.trim() ? 'No types match your search.' : 'No UPR types yet. Add one above.'}
                />
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className={catalogIsActive(r) ? undefined : 'issues-mapping-table__row--inactive'}>
                    {editingId === r.id ? (
                      <>
                        <td>{r.id}</td>
                        <td>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </td>
                        <td>
                          <span className={catalogIsActive(r) ? 'status-badge success' : 'status-badge default'}>
                            {statusLabel(r)}
                          </span>
                        </td>
                        <td className="table-actions">
                          <Button
                            variant="primary"
                            compact
                            disabled={!editName.trim()}
                            onClick={() => {
                              void (async () => {
                                try {
                                  await adminUpdateUprType(r.id, { name: editName.trim() })
                                  setEditingId(null)
                                  await onRefresh()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Update failed')
                                }
                              })()
                            }}
                          >
                            Save
                          </Button>{' '}
                          <Button variant="link" compact onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{r.id}</td>
                        <td>{r.name}</td>
                        <td>
                          <span className={catalogIsActive(r) ? 'status-badge success' : 'status-badge default'}>
                            {statusLabel(r)}
                          </span>
                        </td>
                        <td className="table-actions">
                          <ActionMenu>
                            <Button
                              variant="link"
                              compact
                              onClick={() => navigate(superAdminUprManagementTypeViewPath(r.id))}
                            >
                              View
                            </Button>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                setEditingId(r.id)
                                setEditName(r.name)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await adminUpdateUprType(r.id, { is_active: !catalogIsActive(r) })
                                    await onRefresh()
                                  } catch (e: unknown) {
                                    setError(isApiError(e) ? e.message : 'Update failed')
                                  }
                                })()
                              }}
                            >
                              {catalogIsActive(r) ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="link"
                              compact
                              dangerLink
                              onClick={() => {
                                if (!window.confirm(`Delete UPR type “${r.name}”?`)) return
                                void (async () => {
                                  try {
                                    await adminDeleteUprType(r.id)
                                    await onRefresh()
                                  } catch (e: unknown) {
                                    setError(isApiError(e) ? e.message : 'Delete failed')
                                  }
                                })()
                              }}
                            >
                              Delete
                            </Button>
                          </ActionMenu>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

function UprCyclesSection({
  rows,
  types,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  rows: AdminUprCycle[]
  types: AdminUprType[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const navigate = useNavigate()
  const activeTypes = useMemo(() => types.filter(catalogIsActive), [types])
  const [typeId, setTypeId] = useState('')
  const [name, setName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [listTypeFilter, setListTypeFilter] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTypeId, setEditTypeId] = useState('')
  const [editName, setEditName] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: PAGE_SIZE })

  const filtered = useMemo(() => {
    if (!listTypeFilter) return rows
    return rows.filter((r) => String(r.upr_type_id ?? '') === listTypeFilter)
  }, [rows, listTypeFilter])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return filtered
    return filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.type?.name ?? '').toLowerCase().includes(q) ||
        String(r.id).includes(q),
    )
  }, [filtered, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)
  const activeCount = rows.filter(catalogIsActive).length

  function resetCreateForm() {
    setName('')
    setTypeId('')
  }

  return (
    <div className="issues-catalog-page">
      <div className="upr-mgmt-create-bar">
        <Button
          variant="primary"
          compact
          onClick={() => {
            setCreateOpen((open) => {
              if (open) resetCreateForm()
              return !open
            })
          }}
        >
          {createOpen ? 'Close create form' : 'Create cycle'}
        </Button>
      </div>

      {createOpen ? (
        <div style={{ marginBottom: 16 }}>
          <TableCard padded>
            <div className="issues-catalog-add-form">
              <FormField label="UPR Type">
                <select value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={busy}>
                  <option value="">Select UPR type</option>
                  {activeTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Cycle name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 4th Cycle"
                  disabled={busy}
                />
              </FormField>
              <div className="issues-catalog-add-form__actions">
                <Button
                  variant="primary"
                  compact
                  disabled={busy || !name.trim() || !typeId}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        await adminCreateUprCycle({
                          name: name.trim(),
                          upr_type_id: Number(typeId),
                        })
                        resetCreateForm()
                        setCreateOpen(false)
                        await onRefresh()
                      } catch (e: unknown) {
                        setError(isApiError(e) ? e.message : 'Create failed')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  Add cycle
                </Button>
                <Button
                  variant="secondary"
                  compact
                  disabled={busy}
                  onClick={() => {
                    resetCreateForm()
                    setCreateOpen(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </TableCard>
        </div>
      ) : null}

      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <StatsCards
          items={[
            { label: 'Total Cycles', value: rows.length },
            { label: 'Active', value: activeCount },
            { label: 'Inactive', value: rows.length - activeCount },
          ]}
        />
      </div>

      <TableToolbar className="issues-list-toolbar">
        <select
          value={listTypeFilter}
          onChange={(e) => setListTypeFilter(e.target.value)}
          aria-label="Filter by UPR type"
        >
          <option value="">All UPR types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search ID, name, type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search UPR cycles"
        />
        <Button
          variant="secondary"
          compact
          onClick={() => {
            setSearch('')
            setListTypeFilter('')
          }}
        >
          Reset filters
        </Button>
      </TableToolbar>

      <TableCard>
        <div className="table-card-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>UPR Type</th>
                <th>Name</th>
                <th>Status</th>
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={5}
                  message={
                    search.trim() || listTypeFilter
                      ? 'No cycles match your filters.'
                      : 'No UPR cycles yet. Add one above.'
                  }
                />
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className={catalogIsActive(r) ? undefined : 'issues-mapping-table__row--inactive'}>
                    {editingId === r.id ? (
                      <>
                        <td>{r.id}</td>
                        <td>
                          <select value={editTypeId} onChange={(e) => setEditTypeId(e.target.value)}>
                            <option value="">Select UPR type</option>
                            {types.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </td>
                        <td>
                          <span className={catalogIsActive(r) ? 'status-badge success' : 'status-badge default'}>
                            {statusLabel(r)}
                          </span>
                        </td>
                        <td className="table-actions">
                          <Button
                            variant="primary"
                            compact
                            disabled={!editName.trim() || !editTypeId}
                            onClick={() => {
                              void (async () => {
                                try {
                                  await adminUpdateUprCycle(r.id, {
                                    name: editName.trim(),
                                    upr_type_id: Number(editTypeId),
                                  })
                                  setEditingId(null)
                                  await onRefresh()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Update failed')
                                }
                              })()
                            }}
                          >
                            Save
                          </Button>{' '}
                          <Button variant="link" compact onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{r.id}</td>
                        <td>{r.type?.name || '—'}</td>
                        <td>{r.name}</td>
                        <td>
                          <span className={catalogIsActive(r) ? 'status-badge success' : 'status-badge default'}>
                            {statusLabel(r)}
                          </span>
                        </td>
                        <td className="table-actions">
                          <ActionMenu>
                            <Button
                              variant="link"
                              compact
                              onClick={() => navigate(superAdminUprManagementCycleViewPath(r.id))}
                            >
                              View
                            </Button>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                setEditingId(r.id)
                                setEditName(r.name)
                                setEditTypeId(r.upr_type_id != null ? String(r.upr_type_id) : '')
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await adminUpdateUprCycle(r.id, { is_active: !catalogIsActive(r) })
                                    await onRefresh()
                                  } catch (e: unknown) {
                                    setError(isApiError(e) ? e.message : 'Update failed')
                                  }
                                })()
                              }}
                            >
                              {catalogIsActive(r) ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="link"
                              compact
                              dangerLink
                              onClick={() => {
                                if (!window.confirm(`Delete cycle “${r.name}”?`)) return
                                void (async () => {
                                  try {
                                    await adminDeleteUprCycle(r.id)
                                    await onRefresh()
                                  } catch (e: unknown) {
                                    setError(isApiError(e) ? e.message : 'Delete failed')
                                  }
                                })()
                              }}
                            >
                              Delete
                            </Button>
                          </ActionMenu>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

function UprCategoriesSection({
  rows,
  cycles,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  rows: AdminUprCategory[]
  cycles: AdminUprCycle[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const navigate = useNavigate()
  const activeCycles = useMemo(() => cycles.filter(catalogIsActive), [cycles])
  const [cycleId, setCycleId] = useState('')
  const [name, setName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [listCycleFilter, setListCycleFilter] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editCycleId, setEditCycleId] = useState('')
  const [editName, setEditName] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: PAGE_SIZE })

  const filtered = useMemo(() => {
    if (!listCycleFilter) return rows
    return rows.filter((r) => String(r.upr_cycle_id ?? '') === listCycleFilter)
  }, [rows, listCycleFilter])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return filtered
    return filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.cycle?.name ?? '').toLowerCase().includes(q) ||
        String(r.id).includes(q),
    )
  }, [filtered, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)
  const activeCount = rows.filter(catalogIsActive).length

  function resetCreateForm() {
    setName('')
    setCycleId('')
  }

  return (
    <div className="issues-catalog-page">
      <div className="upr-mgmt-create-bar">
        <Button
          variant="primary"
          compact
          onClick={() => {
            setCreateOpen((open) => {
              if (open) resetCreateForm()
              return !open
            })
          }}
        >
          {createOpen ? 'Close create form' : 'Create category'}
        </Button>
      </div>

      {createOpen ? (
        <div style={{ marginBottom: 16 }}>
          <TableCard padded>
            <div className="issues-catalog-add-form">
              <FormField label="Cycle (optional)">
                <select value={cycleId} onChange={(e) => setCycleId(e.target.value)} disabled={busy}>
                  <option value="">No cycle</option>
                  {activeCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.type?.name ? ` — ${c.type.name}` : ''}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Category name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Civil and political rights"
                  disabled={busy}
                />
              </FormField>
              <div className="issues-catalog-add-form__actions">
                <Button
                  variant="primary"
                  compact
                  disabled={busy || !name.trim()}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        await adminCreateUprCategory({
                          name: name.trim(),
                          upr_cycle_id: cycleId ? Number(cycleId) : null,
                        })
                        resetCreateForm()
                        setCreateOpen(false)
                        await onRefresh()
                      } catch (e: unknown) {
                        setError(isApiError(e) ? e.message : 'Create failed')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  Add category
                </Button>
                <Button
                  variant="secondary"
                  compact
                  disabled={busy}
                  onClick={() => {
                    resetCreateForm()
                    setCreateOpen(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </TableCard>
        </div>
      ) : null}

      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <StatsCards
          items={[
            { label: 'Total Categories', value: rows.length },
            { label: 'Active', value: activeCount },
            { label: 'Inactive', value: rows.length - activeCount },
          ]}
        />
      </div>

      <TableToolbar className="issues-list-toolbar">
        <select
          value={listCycleFilter}
          onChange={(e) => setListCycleFilter(e.target.value)}
          aria-label="Filter by cycle"
        >
          <option value="">All cycles</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search ID, name, cycle…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search UPR categories"
        />
        <Button
          variant="secondary"
          compact
          onClick={() => {
            setSearch('')
            setListCycleFilter('')
          }}
        >
          Reset filters
        </Button>
      </TableToolbar>

      <TableCard>
        <div className="table-card-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cycle</th>
                <th>Name</th>
                <th>Status</th>
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={5}
                  message={
                    search.trim() || listCycleFilter
                      ? 'No categories match your filters.'
                      : 'No UPR categories yet. Add one above.'
                  }
                />
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className={catalogIsActive(r) ? undefined : 'issues-mapping-table__row--inactive'}>
                    {editingId === r.id ? (
                      <>
                        <td>{r.id}</td>
                        <td>
                          <select value={editCycleId} onChange={(e) => setEditCycleId(e.target.value)}>
                            <option value="">No cycle</option>
                            {cycles.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </td>
                        <td>
                          <span className={catalogIsActive(r) ? 'status-badge success' : 'status-badge default'}>
                            {statusLabel(r)}
                          </span>
                        </td>
                        <td className="table-actions">
                          <Button
                            variant="primary"
                            compact
                            disabled={!editName.trim()}
                            onClick={() => {
                              void (async () => {
                                try {
                                  await adminUpdateUprCategory(r.id, {
                                    name: editName.trim(),
                                    upr_cycle_id: editCycleId ? Number(editCycleId) : null,
                                  })
                                  setEditingId(null)
                                  await onRefresh()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Update failed')
                                }
                              })()
                            }}
                          >
                            Save
                          </Button>{' '}
                          <Button variant="link" compact onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{r.id}</td>
                        <td>{r.cycle?.name || '—'}</td>
                        <td>{r.name}</td>
                        <td>
                          <span className={catalogIsActive(r) ? 'status-badge success' : 'status-badge default'}>
                            {statusLabel(r)}
                          </span>
                        </td>
                        <td className="table-actions">
                          <ActionMenu>
                            <Button
                              variant="link"
                              compact
                              onClick={() => navigate(superAdminUprManagementCategoryViewPath(r.id))}
                            >
                              View
                            </Button>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                setEditingId(r.id)
                                setEditCycleId(r.upr_cycle_id != null ? String(r.upr_cycle_id) : '')
                                setEditName(r.name)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await adminUpdateUprCategory(r.id, { is_active: !catalogIsActive(r) })
                                    await onRefresh()
                                  } catch (e: unknown) {
                                    setError(isApiError(e) ? e.message : 'Update failed')
                                  }
                                })()
                              }}
                            >
                              {catalogIsActive(r) ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="link"
                              compact
                              dangerLink
                              onClick={() => {
                                if (!window.confirm(`Delete category “${r.name}”?`)) return
                                void (async () => {
                                  try {
                                    await adminDeleteUprCategory(r.id)
                                    await onRefresh()
                                  } catch (e: unknown) {
                                    setError(isApiError(e) ? e.message : 'Delete failed')
                                  }
                                })()
                              }}
                            >
                              Delete
                            </Button>
                          </ActionMenu>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

function UprRecommendationViewCard({
  row,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  row: AdminUprRecommendationEntry
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  return (
    <TableCard padded>
      <h2 style={{ marginTop: 0 }}>Recommendation #{row.id}</h2>
      <dl className="upr-mgmt-view-dl">
        <div>
          <dt>Name</dt>
          <dd>{row.name}</dd>
        </div>
        <div>
          <dt>Cycle</dt>
          <dd>{row.cycle?.name || '—'}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{row.category?.name || '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={catalogIsActive(row) ? 'status-badge success' : 'status-badge default'}>
              {statusLabel(row)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatTimestamp(row.created_at)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatTimestamp(row.updated_at)}</dd>
        </div>
      </dl>
      <div style={{ marginTop: 16 }}>
        <Button
          variant="secondary"
          compact
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminUpdateUprRecommendationEntry(row.id, { is_active: !catalogIsActive(row) })
                await onRefresh()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Update failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          {catalogIsActive(row) ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </TableCard>
  )
}

function UprRecommendationsSection({
  rows,
  cycles,
  categories,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  rows: AdminUprRecommendationEntry[]
  cycles: AdminUprCycle[]
  categories: AdminUprCategory[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const navigate = useNavigate()
  const activeCycles = useMemo(() => cycles.filter(catalogIsActive), [cycles])
  const [cycleId, setCycleId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [listCycleFilter, setListCycleFilter] = useState('')
  const [listCategoryFilter, setListCategoryFilter] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editCycleId, setEditCycleId] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editName, setEditName] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: PAGE_SIZE })

  const createCategories = useMemo(() => {
    if (!cycleId) return []
    return categories.filter(
      (c) => catalogIsActive(c) && String(c.upr_cycle_id ?? '') === cycleId,
    )
  }, [categories, cycleId])

  const editCategories = useMemo(() => {
    if (!editCycleId) return []
    return categories.filter((c) => String(c.upr_cycle_id ?? '') === editCycleId)
  }, [categories, editCycleId])

  const filtered = useMemo(() => {
    let next = rows
    if (listCycleFilter) {
      next = next.filter((r) => String(r.upr_cycle_id) === listCycleFilter)
    }
    if (listCategoryFilter) {
      next = next.filter((r) => String(r.upr_category_id) === listCategoryFilter)
    }
    return next
  }, [rows, listCycleFilter, listCategoryFilter])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return filtered
    return filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.cycle?.name ?? '').toLowerCase().includes(q) ||
        (r.category?.name ?? '').toLowerCase().includes(q) ||
        String(r.id).includes(q),
    )
  }, [filtered, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)
  const activeCount = rows.filter(catalogIsActive).length

  function resetCreateForm() {
    setName('')
    setCycleId('')
    setCategoryId('')
  }

  return (
    <div className="issues-catalog-page">
      <div className="upr-mgmt-create-bar">
        <Button
          variant="primary"
          compact
          onClick={() => {
            setCreateOpen((open) => {
              if (open) resetCreateForm()
              return !open
            })
          }}
        >
          {createOpen ? 'Close create form' : 'Create recommendation'}
        </Button>
      </div>

      {createOpen ? (
        <div style={{ marginBottom: 16 }}>
          <TableCard padded>
            <div className="issues-catalog-add-form">
              <FormField label="Cycle">
                <select
                  value={cycleId}
                  onChange={(e) => {
                    setCycleId(e.target.value)
                    setCategoryId('')
                  }}
                  disabled={busy}
                >
                  <option value="">Select cycle</option>
                  {activeCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.type?.name ? ` — ${c.type.name}` : ''}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Category">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={busy || !cycleId}
                >
                  <option value="">{cycleId ? 'Select category' : 'Select a cycle first'}</option>
                  {createCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Recommendation name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Strengthen independent monitoring"
                  disabled={busy}
                />
              </FormField>
              <div className="issues-catalog-add-form__actions">
                <Button
                  variant="primary"
                  compact
                  disabled={busy || !name.trim() || !cycleId || !categoryId}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        await adminCreateUprRecommendationEntry({
                          name: name.trim(),
                          upr_cycle_id: Number(cycleId),
                          upr_category_id: Number(categoryId),
                        })
                        resetCreateForm()
                        setCreateOpen(false)
                        await onRefresh()
                      } catch (e: unknown) {
                        setError(isApiError(e) ? e.message : 'Create failed')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  Add recommendation
                </Button>
                <Button
                  variant="secondary"
                  compact
                  disabled={busy}
                  onClick={() => {
                    resetCreateForm()
                    setCreateOpen(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </TableCard>
        </div>
      ) : null}

      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <StatsCards
          items={[
            { label: 'Total Recommendations', value: rows.length },
            { label: 'Active', value: activeCount },
            { label: 'Inactive', value: rows.length - activeCount },
          ]}
        />
      </div>

      <TableToolbar className="issues-list-toolbar">
        <select
          value={listCycleFilter}
          onChange={(e) => {
            setListCycleFilter(e.target.value)
            setListCategoryFilter('')
          }}
          aria-label="Filter by cycle"
        >
          <option value="">All cycles</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={listCategoryFilter}
          onChange={(e) => setListCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories
            .filter((c) => !listCycleFilter || String(c.upr_cycle_id ?? '') === listCycleFilter)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <input
          type="search"
          placeholder="Search ID, name, cycle, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search recommendations"
        />
        <Button
          variant="secondary"
          compact
          onClick={() => {
            setSearch('')
            setListCycleFilter('')
            setListCategoryFilter('')
          }}
        >
          Reset filters
        </Button>
      </TableToolbar>

      <TableCard>
        <div className="table-card-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cycle</th>
                <th>Category</th>
                <th>Name</th>
                <th>Status</th>
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={6}
                  message={
                    search.trim() || listCycleFilter || listCategoryFilter
                      ? 'No recommendations match your filters.'
                      : 'No recommendations yet. Add one above.'
                  }
                />
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className={catalogIsActive(r) ? undefined : 'issues-mapping-table__row--inactive'}>
                    {editingId === r.id ? (
                      <>
                        <td>{r.id}</td>
                        <td>
                          <select
                            value={editCycleId}
                            onChange={(e) => {
                              setEditCycleId(e.target.value)
                              setEditCategoryId('')
                            }}
                          >
                            <option value="">Select cycle</option>
                            {cycles.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                            <option value="">{editCycleId ? 'Select category' : 'Select a cycle first'}</option>
                            {editCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </td>
                        <td>
                          <span className={catalogIsActive(r) ? 'status-badge success' : 'status-badge default'}>
                            {statusLabel(r)}
                          </span>
                        </td>
                        <td className="table-actions">
                          <Button
                            variant="primary"
                            compact
                            disabled={!editName.trim() || !editCycleId || !editCategoryId}
                            onClick={() => {
                              void (async () => {
                                try {
                                  await adminUpdateUprRecommendationEntry(r.id, {
                                    name: editName.trim(),
                                    upr_cycle_id: Number(editCycleId),
                                    upr_category_id: Number(editCategoryId),
                                  })
                                  setEditingId(null)
                                  await onRefresh()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Update failed')
                                }
                              })()
                            }}
                          >
                            Save
                          </Button>{' '}
                          <Button variant="link" compact onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{r.id}</td>
                        <td>{r.cycle?.name || '—'}</td>
                        <td>{r.category?.name || '—'}</td>
                        <td>{r.name}</td>
                        <td>
                          <span className={catalogIsActive(r) ? 'status-badge success' : 'status-badge default'}>
                            {statusLabel(r)}
                          </span>
                        </td>
                        <td className="table-actions">
                          <ActionMenu>
                            <Button
                              variant="link"
                              compact
                              onClick={() => navigate(superAdminUprManagementRecommendationViewPath(r.id))}
                            >
                              View
                            </Button>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                setEditingId(r.id)
                                setEditCycleId(String(r.upr_cycle_id))
                                setEditCategoryId(String(r.upr_category_id))
                                setEditName(r.name)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await adminUpdateUprRecommendationEntry(r.id, {
                                      is_active: !catalogIsActive(r),
                                    })
                                    await onRefresh()
                                  } catch (e: unknown) {
                                    setError(isApiError(e) ? e.message : 'Update failed')
                                  }
                                })()
                              }}
                            >
                              {catalogIsActive(r) ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="link"
                              compact
                              dangerLink
                              onClick={() => {
                                if (!window.confirm(`Delete recommendation “${r.name}”?`)) return
                                void (async () => {
                                  try {
                                    await adminDeleteUprRecommendationEntry(r.id)
                                    await onRefresh()
                                  } catch (e: unknown) {
                                    setError(isApiError(e) ? e.message : 'Delete failed')
                                  }
                                })()
                              }}
                            >
                              Delete
                            </Button>
                          </ActionMenu>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

type UprIndicatorDraft = {
  id?: number
  client_key: string
  indicator_text: string
  collects_quantitative: boolean
  collects_qualitative: boolean
}

let uprIndicatorClientKeyCounter = 0

function nextUprIndicatorClientKey(existingId?: number): string {
  if (existingId != null) return `upr-ind-${existingId}`
  uprIndicatorClientKeyCounter += 1
  return `upr-ind-new-${uprIndicatorClientKeyCounter}`
}

function emptyUprIndicator(): UprIndicatorDraft {
  return {
    client_key: nextUprIndicatorClientKey(),
    indicator_text: '',
    collects_quantitative: false,
    collects_qualitative: true,
  }
}

function indicatorDraftFromAdmin(ind: AdminUprEntry['indicators'][number]): UprIndicatorDraft {
  return {
    id: ind.id,
    client_key: nextUprIndicatorClientKey(ind.id),
    indicator_text: ind.indicator_text,
    collects_quantitative: ind.has_quantitative,
    collects_qualitative: ind.has_qualitative,
  }
}

function validateUprIndicatorDataTypes(rows: UprIndicatorDraft[]): string | null {
  const filled = rows.filter((x) => x.indicator_text.trim())
  for (const x of filled) {
    if (!x.collects_quantitative && !x.collects_qualitative) {
      return 'Each indicator must have Quantitative and/or Qualitative selected.'
    }
  }
  return null
}

type UprIndicatorListSortKey = 'indicator' | 'type' | 'cycle' | 'category' | 'dataType' | 'status' | 'uprId'

type UprIndicatorListRow = {
  key: string
  indicatorId: number
  indicatorText: string
  uprEntryId: number
  typeId: number
  typeName: string
  cycleId: number
  cycleName: string
  categoryId: number
  categoryName: string
  quantitative: boolean
  qualitative: boolean
  dataTypeLabel: string
  isActive: boolean
  statusLabel: string
}

type UprIndicatorDataTypeFilter = '' | 'quantitative' | 'qualitative'

const UPR_INDICATOR_LIST_EXPORT_COLUMNS: TableExportColumn<UprIndicatorListRow>[] = [
  { header: 'Indicator', value: (r) => r.indicatorText },
  { header: 'UPR ID', value: (r) => r.uprEntryId },
  { header: 'Type', value: (r) => r.typeName },
  { header: 'Cycle', value: (r) => r.cycleName },
  { header: 'Category', value: (r) => r.categoryName },
  { header: 'Data type', value: (r) => r.dataTypeLabel },
  { header: 'Status', value: (r) => r.statusLabel },
]

function uprIndicatorDataTypeLabel(ind: AdminUprEntry['indicators'][number]): string {
  const parts: string[] = []
  if (ind.has_quantitative) parts.push('Quantitative')
  if (ind.has_qualitative) parts.push('Qualitative')
  return parts.length ? parts.join(' / ') : '—'
}

function buildUprIndicatorListRows(entries: AdminUprEntry[]): UprIndicatorListRow[] {
  const rows: UprIndicatorListRow[] = []
  for (const entry of entries) {
    for (const ind of entry.indicators ?? []) {
      const isActive = ind.is_active !== false
      rows.push({
        key: `${entry.id}-${ind.id}`,
        indicatorId: ind.id,
        indicatorText: ind.indicator_text?.trim() || `Indicator #${ind.id}`,
        uprEntryId: entry.id,
        typeId: entry.upr_type_id,
        typeName: entry.type?.name?.trim() || String(entry.upr_type_id),
        cycleId: entry.upr_cycle_id,
        cycleName: entry.cycle?.name?.trim() || String(entry.upr_cycle_id),
        categoryId: entry.upr_category_id,
        categoryName: entry.category?.name?.trim() || String(entry.upr_category_id),
        quantitative: Boolean(ind.has_quantitative),
        qualitative: Boolean(ind.has_qualitative),
        dataTypeLabel: uprIndicatorDataTypeLabel(ind),
        isActive,
        statusLabel: isActive ? 'Active' : 'Inactive',
      })
    }
  }
  return rows
}

function sortUprIndicatorListRows(
  rows: UprIndicatorListRow[],
  sortKey: UprIndicatorListSortKey | undefined,
  sortDir: SortDirection,
): UprIndicatorListRow[] {
  const list = [...rows]
  list.sort((a, b) => {
    switch (sortKey) {
      case 'type':
        return compareStringValues(a.typeName, b.typeName, sortDir)
      case 'cycle':
        return compareStringValues(a.cycleName, b.cycleName, sortDir)
      case 'category':
        return compareStringValues(a.categoryName, b.categoryName, sortDir)
      case 'dataType':
        return compareStringValues(a.dataTypeLabel, b.dataTypeLabel, sortDir)
      case 'status':
        return compareStringValues(a.statusLabel, b.statusLabel, sortDir)
      case 'uprId':
        return sortDir === 'asc' ? a.uprEntryId - b.uprEntryId : b.uprEntryId - a.uprEntryId
      case 'indicator':
      default:
        return compareStringValues(a.indicatorText, b.indicatorText, sortDir)
    }
  })
  return list
}

function UprIndicatorsListSection({ entries }: { entries: AdminUprEntry[] }) {
  const navigate = useNavigate()
  const allRows = useMemo(() => buildUprIndicatorListRows(entries), [entries])

  const [typeFilter, setTypeFilter] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dataTypeFilter, setDataTypeFilter] = useState<UprIndicatorDataTypeFilter>('')

  const { page, setPage, pageSize, sortKey, sortDir, toggleSort } =
    useClientTableState<UprIndicatorListSortKey>({
      pageSize: PAGE_SIZE,
      initialSortKey: 'indicator',
      initialSortDir: 'asc',
    })

  const typeOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of allRows) {
      if (!map.has(row.typeId)) map.set(row.typeId, row.typeName)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [allRows])

  const afterType = useMemo(() => {
    if (!typeFilter) return allRows
    const id = Number(typeFilter)
    return allRows.filter((r) => r.typeId === id)
  }, [allRows, typeFilter])

  const cycleOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of afterType) {
      if (!map.has(row.cycleId)) map.set(row.cycleId, row.cycleName)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [afterType])

  const afterCycle = useMemo(() => {
    if (!cycleFilter) return afterType
    const id = Number(cycleFilter)
    return afterType.filter((r) => r.cycleId === id)
  }, [afterType, cycleFilter])

  const categoryOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of afterCycle) {
      if (!map.has(row.categoryId)) map.set(row.categoryId, row.categoryName)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [afterCycle])

  useEffect(() => {
    if (cycleFilter && !cycleOptions.some((c) => String(c.id) === cycleFilter)) {
      setCycleFilter('')
    }
  }, [cycleFilter, cycleOptions])

  useEffect(() => {
    if (categoryFilter && !categoryOptions.some((c) => String(c.id) === categoryFilter)) {
      setCategoryFilter('')
    }
  }, [categoryFilter, categoryOptions])

  const filtered = useMemo(() => {
    let rows = afterCycle
    if (categoryFilter) {
      const id = Number(categoryFilter)
      rows = rows.filter((r) => r.categoryId === id)
    }
    if (dataTypeFilter === 'quantitative') {
      rows = rows.filter((r) => r.quantitative)
    } else if (dataTypeFilter === 'qualitative') {
      rows = rows.filter((r) => r.qualitative)
    }
    return rows
  }, [afterCycle, categoryFilter, dataTypeFilter])

  const processed = useMemo(
    () => sortUprIndicatorListRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  )

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  const kpiItems = useMemo(() => {
    let active = 0
    let inactive = 0
    let quantitative = 0
    let qualitative = 0
    for (const row of processed) {
      if (row.isActive) active += 1
      else inactive += 1
      if (row.quantitative) quantitative += 1
      if (row.qualitative) qualitative += 1
    }
    return [
      { label: 'Total indicators', value: processed.length },
      { label: 'Active', value: active },
      { label: 'Inactive', value: inactive },
      { label: 'Quantitative', value: quantitative },
      { label: 'Qualitative', value: qualitative },
    ]
  }, [processed])

  const hasFilters =
    Boolean(typeFilter) || Boolean(cycleFilter) || Boolean(categoryFilter) || Boolean(dataTypeFilter)

  return (
    <div className="issues-catalog-page">
      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <StatsCards items={kpiItems} />
      </div>

      <TableToolbar className="issues-list-toolbar">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setCycleFilter('')
            setCategoryFilter('')
            setPage(1)
          }}
          aria-label="Filter indicators by UPR type"
        >
          <option value="">All types</option>
          {typeOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={cycleFilter}
          onChange={(e) => {
            setCycleFilter(e.target.value)
            setCategoryFilter('')
            setPage(1)
          }}
          aria-label="Filter indicators by cycle"
        >
          <option value="">All cycles</option>
          {cycleOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter indicators by category"
        >
          <option value="">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={dataTypeFilter}
          onChange={(e) => {
            setDataTypeFilter(e.target.value as UprIndicatorDataTypeFilter)
            setPage(1)
          }}
          aria-label="Filter indicators by data type"
        >
          <option value="">All data types</option>
          <option value="quantitative">Quantitative</option>
          <option value="qualitative">Qualitative</option>
        </select>
        <Button
          variant="secondary"
          compact
          type="button"
          disabled={!hasFilters}
          onClick={() => {
            setTypeFilter('')
            setCycleFilter('')
            setCategoryFilter('')
            setDataTypeFilter('')
            setPage(1)
          }}
        >
          Reset filters
        </Button>
        <TableExportButton
          fileBaseName="upr-indicator-list"
          columns={UPR_INDICATOR_LIST_EXPORT_COLUMNS}
          rows={processed}
          worksheetName="UPR Indicators"
        />
      </TableToolbar>

      <TableCard className="issues-mapping-list-card">
        <div className="table-card-scroll">
          <table className="data-table issues-mapping-table">
            <thead>
              <tr>
                <SortColumnHeader
                  label="Indicator"
                  active={sortKey === 'indicator'}
                  direction={sortDir}
                  onSort={() => toggleSort('indicator')}
                />
                <SortColumnHeader
                  label="UPR ID"
                  active={sortKey === 'uprId'}
                  direction={sortDir}
                  onSort={() => toggleSort('uprId')}
                />
                <SortColumnHeader
                  label="Type"
                  active={sortKey === 'type'}
                  direction={sortDir}
                  onSort={() => toggleSort('type')}
                />
                <SortColumnHeader
                  label="Cycle"
                  active={sortKey === 'cycle'}
                  direction={sortDir}
                  onSort={() => toggleSort('cycle')}
                />
                <SortColumnHeader
                  label="Category"
                  active={sortKey === 'category'}
                  direction={sortDir}
                  onSort={() => toggleSort('category')}
                />
                <SortColumnHeader
                  label="Data type"
                  active={sortKey === 'dataType'}
                  direction={sortDir}
                  onSort={() => toggleSort('dataType')}
                />
                <SortColumnHeader
                  label="Status"
                  active={sortKey === 'status'}
                  direction={sortDir}
                  onSort={() => toggleSort('status')}
                />
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={8}
                  message={
                    hasFilters
                      ? 'No indicators match your filters.'
                      : 'No indicators yet. Create a UPR with indicators.'
                  }
                />
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.key}
                    className={row.isActive ? undefined : 'issues-mapping-table__row--inactive'}
                  >
                    <td className="text-compact">{row.indicatorText}</td>
                    <td className="text-compact">{row.uprEntryId}</td>
                    <td className="text-compact">{row.typeName}</td>
                    <td className="text-compact">{row.cycleName}</td>
                    <td className="text-compact">{row.categoryName}</td>
                    <td className="text-compact">{row.dataTypeLabel}</td>
                    <td>
                      <span className={row.isActive ? 'status-badge success' : 'status-badge default'}>
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="table-actions">
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          onClick={() => navigate(superAdminUprEntryViewPath(row.uprEntryId))}
                        >
                          View UPR
                        </Button>
                        <Button
                          variant="link"
                          compact
                          onClick={() => navigate(superAdminUprEntryEditPath(row.uprEntryId))}
                        >
                          Edit UPR
                        </Button>
                      </ActionMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

function UprEntriesListSection({
  rows,
  setError,
  onRefresh,
}: {
  rows: AdminUprEntry[]
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: PAGE_SIZE })
  const [typeFilter, setTypeFilter] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')

  const processed = useMemo(() => {
    let next = rows
    if (typeFilter) {
      next = next.filter((r) => String(r.upr_type_id) === typeFilter)
    }
    if (cycleFilter) {
      next = next.filter((r) => String(r.upr_cycle_id) === cycleFilter)
    }
    const q = search.trim().toLowerCase()
    if (!q) return next
    return next.filter(
      (r) =>
        String(r.id).includes(q) ||
        (r.type?.name ?? '').toLowerCase().includes(q) ||
        (r.cycle?.name ?? '').toLowerCase().includes(q) ||
        (r.category?.name ?? '').toLowerCase().includes(q),
    )
  }, [rows, search, typeFilter, cycleFilter])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)
  const activeCount = rows.filter(catalogIsActive).length
  const typeOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of rows) {
      if (r.type) map.set(r.upr_type_id, r.type.name)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [rows])
  const cycleOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of rows) {
      if (r.cycle && (!typeFilter || String(r.upr_type_id) === typeFilter)) {
        map.set(r.upr_cycle_id, r.cycle.name)
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [rows, typeFilter])

  return (
    <div className="issues-catalog-page">
      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <StatsCards
          items={[
            { label: 'Total UPRs', value: rows.length },
            { label: 'Active', value: activeCount },
            { label: 'Inactive', value: rows.length - activeCount },
          ]}
        />
      </div>

      <TableToolbar className="issues-list-toolbar">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setCycleFilter('')
          }}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {typeOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={cycleFilter}
          onChange={(e) => setCycleFilter(e.target.value)}
          aria-label="Filter by cycle"
        >
          <option value="">All cycles</option>
          {cycleOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search ID, type, cycle, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search UPRs"
        />
        <Button
          variant="secondary"
          compact
          onClick={() => {
            setSearch('')
            setTypeFilter('')
            setCycleFilter('')
          }}
        >
          Reset filters
        </Button>
      </TableToolbar>

      <TableCard>
        <div className="table-card-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Cycle</th>
                <th>Category</th>
                <th>Recommendations</th>
                <th>Indicators</th>
                <th>Status</th>
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={8}
                  message={
                    search.trim() || typeFilter || cycleFilter
                      ? 'No UPRs match your filters.'
                      : 'No UPRs yet. Use Create UPR to add one.'
                  }
                />
              ) : (
                pageRows.map((r) => (
                  <tr
                    key={r.id}
                    className={catalogIsActive(r) ? undefined : 'issues-mapping-table__row--inactive'}
                  >
                    <td>{r.id}</td>
                    <td>{r.type?.name || '—'}</td>
                    <td>{r.cycle?.name || '—'}</td>
                    <td>{r.category?.name || '—'}</td>
                    <td>{r.recommendations?.length ?? 0}</td>
                    <td>{r.indicators?.length ?? 0}</td>
                    <td>
                      <span className={catalogIsActive(r) ? 'status-badge success' : 'status-badge default'}>
                        {statusLabel(r)}
                      </span>
                    </td>
                    <td className="table-actions">
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          onClick={() => navigate(superAdminUprEntryViewPath(r.id))}
                        >
                          View
                        </Button>
                        <Button
                          variant="link"
                          compact
                          onClick={() => navigate(superAdminUprEntryEditPath(r.id))}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          compact
                          onClick={() => {
                            void (async () => {
                              try {
                                await adminUpdateUprEntry(r.id, { is_active: !catalogIsActive(r) })
                                await onRefresh()
                              } catch (e: unknown) {
                                setError(isApiError(e) ? e.message : 'Update failed')
                              }
                            })()
                          }}
                        >
                          {catalogIsActive(r) ? 'Deactivate' : 'Activate'}
                        </Button>
                      </ActionMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

function UprTypeToggle({
  types,
  value,
  onChange,
  disabled,
}: {
  types: AdminUprType[]
  value: number | null
  onChange: (next: number) => void
  disabled?: boolean
}) {
  if (types.length === 0) {
    return <p className="muted text-compact">No active UPR types. Create a type first.</p>
  }

  return (
    <div className="issue-entry-kind-toggle" role="radiogroup" aria-label="UPR type">
      {types.map((t) => (
        <button
          key={t.id}
          type="button"
          className={
            'issue-entry-kind-toggle__btn' +
            (value === t.id ? ' issue-entry-kind-toggle__btn--active' : '')
          }
          disabled={disabled}
          aria-pressed={value === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.name}
        </button>
      ))}
    </div>
  )
}

function UprIndicatorsEditor({
  rows,
  onChange,
  disabled,
  dummyChecked,
  onDummyChange,
}: {
  rows: UprIndicatorDraft[]
  onChange: (rows: UprIndicatorDraft[]) => void
  disabled?: boolean
  dummyChecked: boolean
  onDummyChange: (checked: boolean) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  function finishDrag() {
    setDragIndex(null)
    setDropIndex(null)
  }

  function handleDrop(toIndex: number) {
    if (dragIndex == null || disabled) {
      finishDrag()
      return
    }
    onChange(reorderList(rows, dragIndex, toIndex))
    finishDrag()
  }

  function patchRow(idx: number, patch: Partial<UprIndicatorDraft>) {
    const next = [...rows]
    next[idx] = { ...rows[idx], ...patch }
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.length > 1 && !disabled ? (
        <p className="text-muted text-compact" style={{ margin: 0 }}>
          Drag indicators to set the list order.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-muted text-compact" style={{ margin: 0 }}>
          No indicators yet. Use + Add indicator below.
        </p>
      ) : null}
      {rows.map((row, idx) => (
        <div
          key={row.client_key}
          className={
            'issue-indicator-card' +
            (dropIndex === idx ? ' issue-indicator-card--drop-target' : '') +
            (dragIndex === idx ? ' issue-indicator-card--dragging' : '')
          }
          draggable={!disabled}
          onDragStart={() => {
            if (disabled) return
            setDragIndex(idx)
          }}
          onDragEnd={finishDrag}
          onDragOver={(e) => {
            if (disabled || dragIndex == null) return
            e.preventDefault()
            setDropIndex(idx)
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(idx)
          }}
        >
          <div className="issue-indicator-card__head">
            <DragHandle disabled={disabled} className="issue-indicator-card__drag" />
            <span className="issue-indicator-card__position text-muted text-compact">#{idx + 1}</span>
          </div>
          <FormRow twoCol>
            <FormControl label="Indicator text">
              <input
                placeholder="Indicator text"
                value={row.indicator_text}
                disabled={disabled}
                onChange={(e) => patchRow(idx, { indicator_text: e.target.value })}
              />
            </FormControl>
            <FormControl label="Response data type (Q/L)">
              <div className="issue-indicator-type-checks">
                <label className="checkbox-label issue-indicator-type-checks__item">
                  <input
                    type="checkbox"
                    checked={row.collects_quantitative}
                    disabled={disabled}
                    onChange={(e) => patchRow(idx, { collects_quantitative: e.target.checked })}
                  />
                  Quantitative
                </label>
                <label className="checkbox-label issue-indicator-type-checks__item">
                  <input
                    type="checkbox"
                    checked={row.collects_qualitative}
                    disabled={disabled}
                    onChange={(e) => patchRow(idx, { collects_qualitative: e.target.checked })}
                  />
                  Qualitative
                </label>
              </div>
            </FormControl>
          </FormRow>
          {row.collects_quantitative ? (
            <div className="issue-indicator-mapping-block">
              <div className="issue-indicator-dimension-checks" role="group" aria-label="Disaggregation dimensions">
                {(
                  [
                    'Gender',
                    'Age (Under 18, 18 - 60, Above 60 for respondents)',
                    'Disability (Hearing, Lower Limb, Mental, Speech, Upper Limb, Visual Full, Visual Partial, Other)',
                    'Religion (full list for respondents)',
                    'Consolidated Data (Total count only for respondents)',
                  ] as const
                ).map((label) => (
                  <label key={label} className="checkbox-label issue-indicator-dimension-checks__item">
                    <input type="checkbox" checked disabled />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="link"
              compact
              dangerLink
              disabled={disabled}
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            >
              Remove indicator
            </Button>
          </div>
        </div>
      ))}
      <label className="checkbox-label" style={{ marginTop: 4 }}>
        <input
          type="checkbox"
          checked={dummyChecked}
          disabled={disabled}
          onChange={(e) => onDummyChange(e.target.checked)}
        />
        Dummy
      </label>
      <Button variant="link" compact disabled={disabled} onClick={() => onChange([...rows, emptyUprIndicator()])}>
        + Add indicator
      </Button>
    </div>
  )
}

function UprCreateForm({
  types,
  cycles,
  categories,
  busy,
  setBusy,
  setError,
  editEntryId,
  onSaved,
}: {
  types: AdminUprType[]
  cycles: AdminUprCycle[]
  categories: AdminUprCategory[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  editEntryId?: number
  onSaved?: () => Promise<void>
}) {
  const navigate = useNavigate()
  const isEditing = editEntryId != null
  const activeTypes = useMemo(() => types.filter(catalogIsActive), [types])
  const [typeId, setTypeId] = useState<number | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isDummy, setIsDummy] = useState(false)
  const [indicators, setIndicators] = useState<UprIndicatorDraft[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(isEditing)

  useEffect(() => {
    if (!isEditing || editEntryId == null) return
    let cancelled = false
    setLoadingEdit(true)
    void adminFetchUprEntry(editEntryId)
      .then((row) => {
        if (cancelled) return
        setTypeId(row.upr_type_id)
        setCycleId(String(row.upr_cycle_id))
        setCategoryId(String(row.upr_category_id))
        setIsDummy(Boolean(row.is_dummy))
        setIndicators(
          (row.indicators ?? []).filter((ind) => ind.is_active !== false).map(indicatorDraftFromAdmin),
        )
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Load failed')
      })
      .finally(() => {
        if (!cancelled) setLoadingEdit(false)
      })
    return () => {
      cancelled = true
    }
  }, [editEntryId, isEditing, setError])

  useEffect(() => {
    if (isEditing) return
    if (typeId != null) return
    if (activeTypes.length > 0) setTypeId(activeTypes[0].id)
  }, [activeTypes, typeId, isEditing])

  const typeCycles = useMemo(() => {
    if (typeId == null) return []
    return cycles.filter((c) => {
      if (c.upr_type_id !== typeId) return false
      return catalogIsActive(c) || String(c.id) === cycleId
    })
  }, [cycles, typeId, cycleId])

  const cycleCategories = useMemo(() => {
    if (!cycleId) return []
    return categories.filter((c) => {
      if (String(c.upr_cycle_id ?? '') !== cycleId) return false
      return catalogIsActive(c) || String(c.id) === categoryId
    })
  }, [categories, cycleId, categoryId])

  function resetForm() {
    setCycleId('')
    setCategoryId('')
    setIsDummy(false)
    setIndicators([])
  }

  if (loadingEdit) {
    return <p className="muted">Loading…</p>
  }

  return (
    <div className="issues-create-form">
      {success ? (
        <Alert variant="success" title="Saved" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      ) : null}
      <div className="issues-create-form__kind">
        {isEditing ? (
          <p className="issues-create-form__kind-label muted text-compact">
            {activeTypes.find((t) => t.id === typeId)?.name ||
              types.find((t) => t.id === typeId)?.name ||
              'UPR'}
          </p>
        ) : (
          <UprTypeToggle
            types={activeTypes}
            value={typeId}
            disabled={busy}
            onChange={(next) => {
              setTypeId(next)
              setCycleId('')
              setCategoryId('')
            }}
          />
        )}
      </div>
      <FormGrid>
        <div className="issues-form-top-grid">
          <FormControl label="Cycle">
            <select
              value={cycleId}
              onChange={(e) => {
                setCycleId(e.target.value)
                setCategoryId('')
              }}
              disabled={busy || typeId == null}
            >
              <option value="">{typeId != null ? 'Select cycle' : 'Select UPR type first'}</option>
              {typeCycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormControl>
          {/* Recommendations are hidden: all active recommendations for the selected
              cycle + category are attached automatically on save and shown on the view page. */}
          <FormControl label="Category">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={busy || !cycleId}
            >
              <option value="">{cycleId ? 'Select category' : 'Select cycle first'}</option>
              {cycleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormControl>
        </div>
      </FormGrid>
      <strong className="font-semibold text-compact" style={{ display: 'block', marginTop: 16 }}>
        Indicators linked to this UPR
      </strong>
      <UprIndicatorsEditor
        rows={indicators}
        onChange={setIndicators}
        disabled={busy}
        dummyChecked={isDummy}
        onDummyChange={setIsDummy}
      />
      <div className="issues-create-form__actions" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button
          variant="secondary"
          compact
          disabled={busy}
          onClick={() => {
            if (isEditing) {
              navigate(superAdminUprManagementListPath())
              return
            }
            resetForm()
            setSuccess(null)
            setError(null)
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          compact
          disabled={busy || typeId == null || !cycleId || !categoryId}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              setSuccess(null)
              try {
                const typeErr = validateUprIndicatorDataTypes(indicators)
                if (typeErr) {
                  setError(typeErr)
                  return
                }
                const filled = indicators.filter((x) => x.indicator_text.trim())
                const payload = {
                  upr_type_id: typeId!,
                  upr_cycle_id: Number(cycleId),
                  upr_category_id: Number(categoryId),
                  is_dummy: isDummy,
                  has_quantitative: filled.some((x) => x.collects_quantitative),
                  has_qualitative: filled.some((x) => x.collects_qualitative),
                  indicators: filled.map((x) => ({
                    ...(x.id != null ? { id: x.id } : {}),
                    indicator_text: x.indicator_text.trim(),
                    has_quantitative: x.collects_quantitative,
                    has_qualitative: x.collects_qualitative,
                    collects_by_gender: x.collects_quantitative,
                    collects_by_age: x.collects_quantitative,
                    collects_by_location: false,
                    collects_by_disability: x.collects_quantitative,
                    collects_by_religion: x.collects_quantitative,
                    collects_by_consolidated: x.collects_quantitative,
                  })),
                }
                if (isEditing && editEntryId != null) {
                  await adminUpdateUprEntry(editEntryId, payload)
                  await onSaved?.()
                  setSuccess('UPR updated successfully.')
                  navigate(superAdminUprEntryViewPath(editEntryId))
                } else {
                  const saved = await adminCreateUprEntry(payload)
                  resetForm()
                  await onSaved?.()
                  navigate(superAdminUprEntryViewPath(saved.id))
                }
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Save failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          {isEditing ? 'Save changes' : 'Save UPR'}
        </Button>
      </div>
    </div>
  )
}

function UprEntryViewPage({
  entryId,
  error,
  setError,
  busy,
  setBusy,
  onRefresh,
}: {
  entryId: number
  error: string | null
  setError: (s: string | null) => void
  busy: boolean
  setBusy: (v: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [entry, setEntry] = useState<AdminUprEntry | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const row = await adminFetchUprEntry(entryId)
    setEntry(row)
  }, [entryId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void adminFetchUprEntry(entryId)
      .then((row) => {
        if (!cancelled) setEntry(row)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Load failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entryId, setError])

  return (
    <div className="page-shell">
      {error ? (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <WorkflowPageBack
        placement="header"
        label="Back to List of UPR"
        to={superAdminUprManagementListPath()}
      />
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && !entry ? <p className="muted">UPR entry not found.</p> : null}
      {entry ? (
        <TableCard padded>
          <h2 style={{ marginTop: 0 }}>UPR #{entry.id}</h2>
          <dl className="upr-mgmt-view-dl">
            <div>
              <dt>Type</dt>
              <dd>{entry.type?.name || '—'}</dd>
            </div>
            <div>
              <dt>Cycle</dt>
              <dd>{entry.cycle?.name || '—'}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{entry.category?.name || '—'}</dd>
            </div>
            <div>
              <dt>Dummy</dt>
              <dd>{entry.is_dummy ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={catalogIsActive(entry) ? 'status-badge success' : 'status-badge default'}>
                  {statusLabel(entry)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatTimestamp(entry.created_at)}</dd>
            </div>
          </dl>

          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              compact
              disabled={busy}
              onClick={() => navigate(superAdminUprEntryEditPath(entry.id))}
            >
              Edit
            </Button>
            <Button
              variant="secondary"
              compact
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    await adminUpdateUprEntry(entry.id, { is_active: !catalogIsActive(entry) })
                    await reload()
                    await onRefresh()
                  } catch (e: unknown) {
                    setError(isApiError(e) ? e.message : 'Update failed')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              {catalogIsActive(entry) ? 'Deactivate' : 'Activate'}
            </Button>
          </div>

          <h3 style={{ marginTop: 24 }}>Recommendations</h3>
          {entry.recommendations.length === 0 ? (
            <p className="muted text-compact">No recommendations were attached for this cycle and category.</p>
          ) : (
            <ul>
              {entry.recommendations.map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
            </ul>
          )}

          <h3 style={{ marginTop: 24 }}>Indicators</h3>
          {entry.indicators.length === 0 ? (
            <p className="muted text-compact">No indicators linked.</p>
          ) : (
            <ol>
              {entry.indicators.map((ind) => (
                <li key={ind.id} style={{ marginBottom: 8 }}>
                  {ind.indicator_text}
                  <span className="muted text-compact" style={{ marginLeft: 8 }}>
                    {[
                      ind.has_quantitative ? 'Quantitative' : null,
                      ind.has_qualitative ? 'Qualitative' : null,
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </TableCard>
      ) : null}
    </div>
  )
}
