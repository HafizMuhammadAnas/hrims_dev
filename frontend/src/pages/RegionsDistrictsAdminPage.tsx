import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateDistrict,
  adminCreateRegion,
  adminDeleteDistrict,
  adminDeleteRegion,
  adminFetchDistricts,
  adminFetchRegionsPublic,
  adminUpdateDistrict,
  adminUpdateRegion,
  type AdminDistrict,
  type AdminRegion,
} from '../api/admin'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { FormControl } from '../components/ui/FormControl'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { StatsCards } from '../components/ui/StatsCards'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { isSuperAdmin } from '../lib/roles'

const GEO_PAGE_SIZE = 10

type GeoView = 'regions' | 'create-region' | 'districts' | 'create-district'

const GEO_TABS: { view: GeoView; to: string; label: string; end?: boolean }[] = [
  { view: 'regions', to: '/admin/regions-districts', label: 'Regions list', end: true },
  { view: 'create-region', to: '/admin/regions-districts/create-region', label: 'Create region' },
  { view: 'districts', to: '/admin/regions-districts/districts', label: 'District list' },
  { view: 'create-district', to: '/admin/regions-districts/create-district', label: 'Create district' },
]

function resolveGeoView(param: string | undefined): GeoView | null {
  if (!param) return 'regions'
  if (param === 'regions' || param === 'create-region' || param === 'districts' || param === 'create-district') {
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

export function RegionsDistrictsAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { geoView: geoViewParam } = useParams<{ geoView?: string }>()
  const view = resolveGeoView(geoViewParam)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [regions, setRegions] = useState<AdminRegion[]>([])
  const [districts, setDistricts] = useState<AdminDistrict[]>([])

  const refreshRegions = useCallback(async () => {
    setRegions(await adminFetchRegionsPublic())
  }, [])

  const refreshDistricts = useCallback(async () => {
    setDistricts(await adminFetchDistricts())
  }, [])

  const refreshAll = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([refreshRegions(), refreshDistricts()])
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Load failed')
    }
  }, [refreshRegions, refreshDistricts])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  if (!view) {
    return <Navigate to="/admin/regions-districts" replace />
  }

  return (
    <div className="page-shell">
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label="Regions and districts sections">
        {GEO_TABS.map((tab) => (
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

      {view === 'regions' && (
        <RegionsListSection
          regions={regions}
          setError={setError}
          onRefreshRegions={refreshRegions}
        />
      )}

      {view === 'create-region' && (
        <TableCard padded>
          <GeoRegionsForm
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => {
              await refreshRegions()
              navigate('/admin/regions-districts')
            }}
            onCancel={() => navigate('/admin/regions-districts')}
          />
        </TableCard>
      )}

      {view === 'districts' && (
        <DistrictsListSection
          regions={regions}
          districts={districts}
          busy={busy}
          setError={setError}
          onRefreshDistricts={refreshDistricts}
        />
      )}

      {view === 'create-district' && (
        <TableCard padded>
          <GeoDistrictsForm
            regions={regions}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => {
              await refreshDistricts()
              navigate('/admin/regions-districts/districts')
            }}
            onCancel={() => navigate('/admin/regions-districts/districts')}
          />
        </TableCard>
      )}
    </div>
  )
}

function RegionsListSection({
  regions,
  setError,
  onRefreshRegions,
}: {
  regions: AdminRegion[]
  setError: (s: string | null) => void
  onRefreshRegions: () => Promise<void>
}) {
  const [editingRegionId, setEditingRegionId] = useState<number | null>(null)
  const [editRegionName, setEditRegionName] = useState('')
  const [editRegionSlug, setEditRegionSlug] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: GEO_PAGE_SIZE })

  const sortedRegions = useMemo(
    () =>
      [...regions].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    [regions],
  )

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedRegions
    return sortedRegions.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        String(r.id).includes(q),
    )
  }, [sortedRegions, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <>
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            
            { label: 'Total regions', value: regions.length },
            { label: 'Matching search', value: processed.length },
          ]}
        />
      </div>

      <TableToolbar className="issues-list-toolbar">
        <input
          type="search"
          placeholder="Search ID, name, or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search regions"
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
                <th>Slug</th>
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={4}
                  message={search.trim() ? 'No regions match your search.' : 'No regions yet. Use Create region to add one.'}
                />
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id}>
                    {editingRegionId === r.id ? (
                      <>
                        <td>{r.id}</td>
                        <td>
                          <input value={editRegionName} onChange={(e) => setEditRegionName(e.target.value)} />
                        </td>
                        <td>
                          <input value={editRegionSlug} onChange={(e) => setEditRegionSlug(e.target.value)} />
                        </td>
                        <td className="table-actions">
                          <Button
                            variant="primary"
                            compact
                            disabled={!editRegionName.trim() || !editRegionSlug.trim()}
                            onClick={() => {
                              void (async () => {
                                try {
                                  await adminUpdateRegion(r.id, {
                                    name: editRegionName.trim(),
                                    slug: editRegionSlug.trim(),
                                  })
                                  setEditingRegionId(null)
                                  await onRefreshRegions()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Update failed')
                                }
                              })()
                            }}
                          >
                            Save
                          </Button>{' '}
                          <Button variant="link" compact onClick={() => setEditingRegionId(null)}>
                            Cancel
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{r.id}</td>
                        <td>{r.name}</td>
                        <td>{r.slug}</td>
                        <td className="table-actions">
                          <ActionMenu>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                setEditingRegionId(r.id)
                                setEditRegionName(r.name)
                                setEditRegionSlug(r.slug)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              compact
                              dangerLink
                              onClick={() => {
                                if (!window.confirm(`Delete region “${r.name}”?`)) return
                                void (async () => {
                                  try {
                                    await adminDeleteRegion(r.id)
                                    await onRefreshRegions()
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
    </>
  )
}

function DistrictsListSection({
  regions,
  districts,
  busy,
  setError,
  onRefreshDistricts,
}: {
  regions: AdminRegion[]
  districts: AdminDistrict[]
  busy: boolean
  setError: (s: string | null) => void
  onRefreshDistricts: () => Promise<void>
}) {
  const [regionFilter, setRegionFilter] = useState('')
  const [editingDistrictId, setEditingDistrictId] = useState<number | null>(null)
  const [editDistrictRegionId, setEditDistrictRegionId] = useState<number | ''>('')
  const [editDistrictName, setEditDistrictName] = useState('')
  const [editDistrictSlug, setEditDistrictSlug] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: GEO_PAGE_SIZE })

  const sortedDistricts = useMemo(
    () =>
      [...districts].sort((a, b) => {
        const byRegion = (a.region_name ?? '').localeCompare(b.region_name ?? '', undefined, {
          numeric: true,
          sensitivity: 'base',
        })
        if (byRegion !== 0) return byRegion
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      }),
    [districts],
  )

  const processed = useMemo(() => {
    let data = sortedDistricts
    if (regionFilter) {
      const rid = Number(regionFilter)
      data = data.filter((d) => d.region_id === rid)
    }
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.slug ?? '').toLowerCase().includes(q) ||
        (d.region_name ?? '').toLowerCase().includes(q) ||
        String(d.id).includes(q) ||
        String(d.region_id).includes(q),
    )
  }, [sortedDistricts, search, regionFilter])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <>
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            
            { label: 'Total districts', value: districts.length },
            { label: 'Matching filters', value: processed.length },
          ]}
        />
      </div>

      <TableToolbar className="issues-list-toolbar">
        <input
          type="search"
          placeholder="Search ID, region, district, or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search districts"
        />
        <select
          value={regionFilter}
          onChange={(e) => {
            setRegionFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by region"
        >
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          compact
          onClick={() => {
            setSearch('')
            setRegionFilter('')
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
                <th>Region</th>
                <th>District</th>
                <th>Slug</th>
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={5}
                  message={
                    search.trim() || regionFilter
                      ? 'No districts match your filters.'
                      : 'No districts yet. Use Create district to add one.'
                  }
                />
              ) : (
                pageRows.map((d) => (
                  <tr key={d.id}>
                    {editingDistrictId === d.id ? (
                      <>
                        <td>{d.id}</td>
                        <td>
                          <select
                            value={editDistrictRegionId}
                            onChange={(e) =>
                              setEditDistrictRegionId(e.target.value === '' ? '' : Number(e.target.value))
                            }
                          >
                            <option value="">—</option>
                            {regions.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input value={editDistrictName} onChange={(e) => setEditDistrictName(e.target.value)} />
                        </td>
                        <td>
                          <input value={editDistrictSlug} onChange={(e) => setEditDistrictSlug(e.target.value)} />
                        </td>
                        <td className="table-actions">
                          <Button
                            variant="primary"
                            compact
                            disabled={!editDistrictRegionId || !editDistrictName.trim()}
                            onClick={() => {
                              void (async () => {
                                try {
                                  await adminUpdateDistrict(d.id, {
                                    region_id: Number(editDistrictRegionId),
                                    name: editDistrictName.trim(),
                                    slug: editDistrictSlug.trim() || null,
                                  })
                                  setEditingDistrictId(null)
                                  await onRefreshDistricts()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Update failed')
                                }
                              })()
                            }}
                          >
                            Save
                          </Button>{' '}
                          <Button variant="link" compact onClick={() => setEditingDistrictId(null)}>
                            Cancel
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{d.id}</td>
                        <td>{d.region_name ?? d.region_id}</td>
                        <td>{d.name}</td>
                        <td>{d.slug ?? '—'}</td>
                        <td className="table-actions">
                          <ActionMenu>
                            <Button
                              variant="link"
                              compact
                              disabled={busy}
                              onClick={() => {
                                setEditingDistrictId(d.id)
                                setEditDistrictRegionId(d.region_id)
                                setEditDistrictName(d.name)
                                setEditDistrictSlug(d.slug ?? '')
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              compact
                              dangerLink
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm(`Delete district “${d.name}”?`)) return
                                void (async () => {
                                  try {
                                    await adminDeleteDistrict(d.id)
                                    await onRefreshDistricts()
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
    </>
  )
}

function GeoRegionsForm({
  busy,
  setBusy,
  setError,
  onDone,
  onCancel,
}: {
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  return (
    <FormGrid>
      <FormRow twoCol>
        <FormControl label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormControl>
        <FormControl label="Slug">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="punjab-north" />
        </FormControl>
      </FormRow>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" compact disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          compact
          disabled={busy || !name.trim() || !slug.trim()}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminCreateRegion({ name: name.trim(), slug: slug.trim() })
                setName('')
                setSlug('')
                await onDone()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Save failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          Add region
        </Button>
      </div>
    </FormGrid>
  )
}

function GeoDistrictsForm({
  regions,
  busy,
  setBusy,
  setError,
  onDone,
  onCancel,
}: {
  regions: AdminRegion[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [regionId, setRegionId] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  return (
    <FormGrid>
      <FormRow twoCol>
        <FormControl label="Region">
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            <option value="">—</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </FormControl>
        <FormControl label="District name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormControl>
      </FormRow>
      <FormRow twoCol>
        <FormControl label="Slug (optional)">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </FormControl>
      </FormRow>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" compact disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          compact
          disabled={busy || !regionId || !name.trim()}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminCreateDistrict({
                  region_id: Number(regionId),
                  name: name.trim(),
                  slug: slug.trim() || null,
                })
                setName('')
                setSlug('')
                setRegionId('')
                await onDone()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Save failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          Add district
        </Button>
      </div>
    </FormGrid>
  )
}
