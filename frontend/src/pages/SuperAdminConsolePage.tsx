import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  adminCreateConvention,
  adminCreateConventionComponent,
  adminCreateDepartment,
  adminCreateDistrict,
  adminCreateArticle,
  adminCreateIssue,
  adminCreateIssueCategory,
  adminDeleteIssueCategory,
  adminCreateKnowledgeCard,
  adminCreateRegion,
  adminCreateSdgNode,
  adminCreateUpr,
  adminDeleteConvention,
  adminDeleteConventionComponent,
  adminDeleteDepartment,
  adminDeleteDistrict,
  adminDeleteIssue,
  adminDeleteArticle,
  adminDeleteKnowledgeCard,
  adminDeleteRegion,
  adminDeleteSdgNode,
  adminDeleteUpr,
  adminFetchCatalogDepartments,
  adminFetchConventionComponents,
  adminFetchArticles,
  adminFetchConventions,
  adminFetchDistricts,
  adminFetchIssue,
  adminFetchIssueCategories,
  adminFetchIssues,
  adminFetchKnowledgeCards,
  adminFetchRegionsPublic,
  adminFetchSdgNodes,
  adminFetchUpr,
  adminUpdateConvention,
  adminUpdateConventionComponent,
  adminUpdateDistrict,
  adminUpdateDepartment,
  adminUpdateIssue,
  adminUpdateIssueCategory,
  adminUpdateArticle,
  adminUpdateKnowledgeCard,
  adminUpdateRegion,
  adminUpdateSdgNode,
  adminUpdateUpr,
  type AdminArticleRow,
  type AdminConvention,
  type AdminIssue,
  type AdminIssueCategory,
  type AdminKnowledgeCard,
} from '../api/admin'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { PageSection } from '../components/ui/PageSection'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { TableCard } from '../components/ui/TableCard'
import { FormControl } from '../components/ui/FormControl'
import { FormField } from '../components/ui/FormField'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { isSuperAdmin } from '../lib/roles'

type Tab =
  | 'geography'
  | 'departments'
  | 'conventions'
  | 'sdg'
  | 'upr'
  | 'hub'
  | 'issues'

const ADMIN_SECTION_TO_TAB: Record<string, Tab> = {
  'regions-districts': 'geography',
  conventions: 'conventions',
  'sdg-nodes': 'sdg',
  'upr-recommendations': 'upr',
  'knowledge-hub': 'hub',
  issues: 'issues',
}

const TAB_PAGE_META: Record<Tab, { title: string; subtitle: string }> = {
  geography: {
    title: 'Regions & districts',
    subtitle: 'Create regions and districts used for provincial scope, user assignment, and reporting.',
  },
  departments: {
    title: 'Departments',
    subtitle:
      'Define departments and link each to one or more regions (for filtering and access). Federal and regional admins assign users to these slots.',
  },
  conventions: {
    title: 'Conventions & components',
    subtitle: 'Treaty catalog and structured components; content can feed the public Conventions knowledge page.',
  },
  sdg: {
    title: 'SDG nodes',
    subtitle: 'Sustainable development goal, target, and indicator nodes for mapping and knowledge hub goals.',
  },
  upr: {
    title: 'UPR recommendations',
    subtitle: 'Universal Periodic Review recommendation rows for workflows and issue mapping.',
  },
  hub: {
    title: 'Knowledge hub pages',
    subtitle: 'Indicator and UPR highlight tiles shown on the Human rights indicators and UPR knowledge pages.',
  },
  issues: {
    title: 'Issues & mappings',
    subtitle: '',
  },
}

export function SuperAdminConsolePage() {
  const { user } = useAuth()
  const { section } = useParams<{ section: string }>()
  const tab = section ? ADMIN_SECTION_TO_TAB[section] : undefined
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [regions, setRegions] = useState<Awaited<ReturnType<typeof adminFetchRegionsPublic>>>([])
  const [districts, setDistricts] = useState<Awaited<ReturnType<typeof adminFetchDistricts>>>([])
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof adminFetchCatalogDepartments>>>([])
  const [conventions, setConventions] = useState<Awaited<ReturnType<typeof adminFetchConventions>>>([])
  const [convComponents, setConvComponents] = useState<Awaited<ReturnType<typeof adminFetchConventionComponents>>>([])
  const [selConv, setSelConv] = useState<number | ''>('')
  const [sdgNodes, setSdgNodes] = useState<Awaited<ReturnType<typeof adminFetchSdgNodes>>>([])
  const [uprRows, setUprRows] = useState<Awaited<ReturnType<typeof adminFetchUpr>>>([])
  const [issues, setIssues] = useState<Awaited<ReturnType<typeof adminFetchIssues>>>([])
  const [issueFormConventions, setIssueFormConventions] = useState<AdminConvention[]>([])
  const [issueFormCategories, setIssueFormCategories] = useState<AdminIssueCategory[]>([])
  const [issueFormArticles, setIssueFormArticles] = useState<AdminArticleRow[]>([])
  const [editingIssue, setEditingIssue] = useState<AdminIssue | null>(null)

  const [geoRegionId, setGeoRegionId] = useState<string>('')
  const [editingRegionId, setEditingRegionId] = useState<number | null>(null)
  const [editRegionName, setEditRegionName] = useState('')
  const [editRegionSlug, setEditRegionSlug] = useState('')
  const [editingDistrictId, setEditingDistrictId] = useState<number | null>(null)
  const [editDistrictRegionId, setEditDistrictRegionId] = useState<number | ''>('')
  const [editDistrictName, setEditDistrictName] = useState('')
  const [editDistrictSlug, setEditDistrictSlug] = useState('')

  const [editingDeptId, setEditingDeptId] = useState<number | null>(null)
  const [editDeptRegionIds, setEditDeptRegionIds] = useState<number[]>([])
  const [editDeptCode, setEditDeptCode] = useState('')
  const [editDeptName, setEditDeptName] = useState('')
  const [editDeptType, setEditDeptType] = useState('')

  const [editingConvId, setEditingConvId] = useState<number | null>(null)
  const [editConvCode, setEditConvCode] = useState('')
  const [editConvName, setEditConvName] = useState('')
  const [editConvIcon, setEditConvIcon] = useState('')
  const [editConvAdopted, setEditConvAdopted] = useState('')
  const [editConvRatified, setEditConvRatified] = useState('')
  const [editConvArticles, setEditConvArticles] = useState('')
  const [editConvImpl, setEditConvImpl] = useState('')
  const [editConvDesc, setEditConvDesc] = useState('')
  const [editConvSort, setEditConvSort] = useState('')

  const [editingCompId, setEditingCompId] = useState<number | null>(null)
  const [editCompType, setEditCompType] = useState('')
  const [editCompCode, setEditCompCode] = useState('')
  const [editCompTitle, setEditCompTitle] = useState('')
  const [editCompBody, setEditCompBody] = useState('')

  const [editingSdgId, setEditingSdgId] = useState<number | null>(null)
  const [editSdgCode, setEditSdgCode] = useState('')
  const [editSdgTitle, setEditSdgTitle] = useState('')
  const [editSdgType, setEditSdgType] = useState('')
  const [editSdgGoalNum, setEditSdgGoalNum] = useState('')
  const [editSdgIcon, setEditSdgIcon] = useState('')
  const [editSdgSummary, setEditSdgSummary] = useState('')
  const [editSdgBody, setEditSdgBody] = useState('')
  const [editSdgS1v, setEditSdgS1v] = useState('')
  const [editSdgS1l, setEditSdgS1l] = useState('')
  const [editSdgS2v, setEditSdgS2v] = useState('')
  const [editSdgS2l, setEditSdgS2l] = useState('')

  const [editingUprId, setEditingUprId] = useState<number | null>(null)
  const [editUprSession, setEditUprSession] = useState('')
  const [editUprCode, setEditUprCode] = useState('')
  const [editUprTitle, setEditUprTitle] = useState('')
  const [editUprBody, setEditUprBody] = useState('')

  const [hubSection, setHubSection] = useState<'indicators' | 'upr'>('indicators')
  const [knowledgeIndicatorCards, setKnowledgeIndicatorCards] = useState<AdminKnowledgeCard[]>([])
  const [knowledgeUprCards, setKnowledgeUprCards] = useState<AdminKnowledgeCard[]>([])
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [editCardIcon, setEditCardIcon] = useState('')
  const [editCardTitle, setEditCardTitle] = useState('')
  const [editCardSummary, setEditCardSummary] = useState('')
  const [editCardS1v, setEditCardS1v] = useState('')
  const [editCardS1l, setEditCardS1l] = useState('')
  const [editCardS2v, setEditCardS2v] = useState('')
  const [editCardS2l, setEditCardS2l] = useState('')
  const [editCardBody, setEditCardBody] = useState('')

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const r = await adminFetchRegionsPublic()
      setRegions(r)
      if (tab === 'geography') {
        const d = await adminFetchDistricts(geoRegionId ? Number(geoRegionId) : undefined)
        setDistricts(d)
      }
      if (tab === 'departments') setDepartments(await adminFetchCatalogDepartments())
      if (tab === 'conventions') {
        const c = await adminFetchConventions()
        setConventions(c)
        if (selConv !== '') {
          setConvComponents(await adminFetchConventionComponents(Number(selConv)))
        } else {
          setConvComponents([])
        }
      }
      if (tab === 'sdg') setSdgNodes(await adminFetchSdgNodes())
      if (tab === 'upr') setUprRows(await adminFetchUpr())
      if (tab === 'hub') {
        setKnowledgeIndicatorCards(await adminFetchKnowledgeCards('indicators'))
        setKnowledgeUprCards(await adminFetchKnowledgeCards('upr'))
      }
      if (tab === 'issues') {
        const [iss, conv, cat, art] = await Promise.all([
          adminFetchIssues(),
          adminFetchConventions(),
          adminFetchIssueCategories(),
          adminFetchArticles(),
        ])
        setIssues(iss)
        setIssueFormConventions(conv)
        setIssueFormCategories(cat)
        setIssueFormArticles(art)
      }
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Load failed')
    }
  }, [tab, geoRegionId, selConv])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  if (!tab) {
    return <Navigate to="/admin/regions-districts" replace />
  }

  const pageMeta = TAB_PAGE_META[tab]

  return (
    <PageSection title={pageMeta.title} subtitle={pageMeta.subtitle}>
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {tab === 'geography' && (
        <TableCard padded>
          <h3 style={{ marginTop: 0 }}>Regions</h3>
          <GeoRegionsForm
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => {
              setRegions(await adminFetchRegionsPublic())
            }}
          />
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.id}>
                  {editingRegionId === r.id ? (
                    <>
                      <td>
                        <input value={editRegionName} onChange={(e) => setEditRegionName(e.target.value)} />
                      </td>
                      <td>
                        <input value={editRegionSlug} onChange={(e) => setEditRegionSlug(e.target.value)} />
                      </td>
                      <td>
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
                                setRegions(await adminFetchRegionsPublic())
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
                      <td>{r.name}</td>
                      <td>{r.slug}</td>
                      <td>
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
                            dangerLink
                            onClick={() => {
                              void (async () => {
                                try {
                                  await adminDeleteRegion(r.id)
                                  setRegions(await adminFetchRegionsPublic())
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
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 24 }}>Districts</h3>
          <p className="text-muted" style={{ fontSize: 14 }}>
            Filter by region (optional), then add districts for that province.
          </p>
          <select value={geoRegionId} onChange={(e) => setGeoRegionId(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <GeoDistrictsForm
            regions={regions}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => setDistricts(await adminFetchDistricts(geoRegionId ? Number(geoRegionId) : undefined))}
          />
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Region</th>
                <th>District</th>
                <th>Slug</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {districts.map((d) => (
                <tr key={d.id}>
                  {editingDistrictId === d.id ? (
                    <>
                      <td>
                        <select
                          value={editDistrictRegionId}
                          onChange={(e) => setEditDistrictRegionId(e.target.value === '' ? '' : Number(e.target.value))}
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
                      <td>
                        <Button
                          variant="primary"
                          compact
                          onClick={() => {
                            void (async () => {
                              try {
                                await adminUpdateDistrict(d.id, {
                                  region_id: Number(editDistrictRegionId),
                                  name: editDistrictName.trim(),
                                  slug: editDistrictSlug.trim() || null,
                                })
                                setEditingDistrictId(null)
                                setDistricts(await adminFetchDistricts(geoRegionId ? Number(geoRegionId) : undefined))
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
                      <td>{d.region_name ?? d.region_id}</td>
                      <td>{d.name}</td>
                      <td>{d.slug ?? '—'}</td>
                      <td>
                        <ActionMenu>
                          <Button
                            variant="link"
                            compact
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
                            dangerLink
                            onClick={() => {
                              void (async () => {
                                try {
                                  await adminDeleteDistrict(d.id)
                                  setDistricts(await adminFetchDistricts(geoRegionId ? Number(geoRegionId) : undefined))
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
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      {tab === 'departments' && (
        <TableCard padded>
          <h3 style={{ marginTop: 0 }}>Departments</h3>
          <DeptForm
            regions={regions}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => setDepartments(await adminFetchCatalogDepartments())}
          />
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Regions</th>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {departments.map((d) =>
                editingDeptId === d.id ? (
                  <tr key={d.id}>
                    <td colSpan={5}>
                      <div style={{ marginBottom: 12 }}>
                        <FormGrid>
                          <FormRow twoCol>
                            <FormControl label="Code">
                              <input value={editDeptCode} onChange={(e) => setEditDeptCode(e.target.value)} placeholder="Code" />
                            </FormControl>
                            <FormControl label="Name">
                              <input value={editDeptName} onChange={(e) => setEditDeptName(e.target.value)} placeholder="Name" />
                            </FormControl>
                          </FormRow>
                          <FormRow twoCol>
                            <FormControl label="Type">
                              <input value={editDeptType} onChange={(e) => setEditDeptType(e.target.value)} placeholder="Type" />
                            </FormControl>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                              <Button
                                variant="primary"
                                compact
                                disabled={editDeptRegionIds.length === 0}
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      await adminUpdateDepartment(d.id, {
                                        region_ids: editDeptRegionIds,
                                        code: editDeptCode.trim() || null,
                                        name: editDeptName.trim(),
                                        type: editDeptType.trim() || null,
                                      })
                                      setEditingDeptId(null)
                                      setDepartments(await adminFetchCatalogDepartments())
                                    } catch (e: unknown) {
                                      setError(isApiError(e) ? e.message : 'Update failed')
                                    }
                                  })()
                                }}
                              >
                                Save
                              </Button>
                              <Button variant="link" compact onClick={() => setEditingDeptId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </FormRow>
                        </FormGrid>
                      </div>
                      <strong style={{ fontSize: 13 }}>Regions (one or more)</strong>
                      <RegionCheckboxMulti
                        regions={regions}
                        selectedIds={editDeptRegionIds}
                        onChange={setEditDeptRegionIds}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={d.id}>
                    <td>
                      {d.regions?.length
                        ? d.regions.map((r) => r.name).join(', ')
                        : '—'}
                    </td>
                    <td>{d.code ?? '—'}</td>
                    <td>{d.name}</td>
                    <td>{d.type ?? '—'}</td>
                    <td>
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          onClick={() => {
                            setEditingDeptId(d.id)
                            setEditDeptRegionIds(d.region_ids ?? [])
                            setEditDeptCode(d.code ?? '')
                            setEditDeptName(d.name)
                            setEditDeptType(d.type ?? '')
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          dangerLink
                          onClick={() => {
                            void (async () => {
                              try {
                                await adminDeleteDepartment(d.id)
                                setDepartments(await adminFetchCatalogDepartments())
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
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </TableCard>
      )}

      {tab === 'conventions' && (
        <TableCard padded>
          <h3 style={{ marginTop: 0 }}>Conventions</h3>
          <p className="text-muted" style={{ fontSize: 14 }}>
            Create the catalog entry, then use <strong>Edit</strong> to fill the knowledge-page fields (icon, treaty
            dates, narrative, and optional sort order). Those fields power the Conventions page in the knowledge hub.
          </p>
          <ConvForm
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => setConventions(await adminFetchConventions())}
          />
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {conventions.map((c) =>
                editingConvId === c.id ? (
                  <tr key={c.id}>
                    <td colSpan={2}>
                      <FormGrid>
                        <FormRow twoCol>
                          <FormControl label="Code">
                            <input value={editConvCode} onChange={(e) => setEditConvCode(e.target.value)} />
                          </FormControl>
                          <FormControl label="Full name">
                            <input value={editConvName} onChange={(e) => setEditConvName(e.target.value)} />
                          </FormControl>
                        </FormRow>
                        <FormRow twoCol>
                          <FormControl label="Icon (emoji)">
                            <input value={editConvIcon} onChange={(e) => setEditConvIcon(e.target.value)} placeholder="📜" />
                          </FormControl>
                          <div />
                        </FormRow>
                        <FormRow twoCol>
                          <FormControl label="Adopted">
                            <input value={editConvAdopted} onChange={(e) => setEditConvAdopted(e.target.value)} />
                          </FormControl>
                          <FormControl label="Ratified">
                            <input value={editConvRatified} onChange={(e) => setEditConvRatified(e.target.value)} />
                          </FormControl>
                        </FormRow>
                        <FormRow twoCol>
                          <FormControl label="Articles">
                            <input value={editConvArticles} onChange={(e) => setEditConvArticles(e.target.value)} />
                          </FormControl>
                          <FormControl label="Implementation %">
                            <input value={editConvImpl} onChange={(e) => setEditConvImpl(e.target.value)} />
                          </FormControl>
                        </FormRow>
                        <FormRow twoCol>
                          <FormControl label="Sort">
                            <input value={editConvSort} onChange={(e) => setEditConvSort(e.target.value)} />
                          </FormControl>
                          <div />
                        </FormRow>
                        <FormField label="Page narrative (knowledge hub)">
                          <textarea rows={4} value={editConvDesc} onChange={(e) => setEditConvDesc(e.target.value)} />
                        </FormField>
                      </FormGrid>
                    </td>
                    <td>
                      <Button
                        variant="primary"
                        compact
                        onClick={() => {
                          void (async () => {
                            try {
                              await adminUpdateConvention(c.id, {
                                code: editConvCode.trim(),
                                name: editConvName.trim(),
                                knowledge_icon: editConvIcon.trim() || null,
                                knowledge_adopted: editConvAdopted.trim() || null,
                                knowledge_ratified: editConvRatified.trim() || null,
                                knowledge_articles: editConvArticles.trim() || null,
                                knowledge_implementation: editConvImpl.trim() || null,
                                description: editConvDesc.trim() || null,
                                sort_order: editConvSort === '' ? undefined : Number(editConvSort),
                              })
                              setEditingConvId(null)
                              setConventions(await adminFetchConventions())
                            } catch (e: unknown) {
                              setError(isApiError(e) ? e.message : 'Update failed')
                            }
                          })()
                        }}
                      >
                        Save
                      </Button>{' '}
                      <Button variant="link" compact onClick={() => setEditingConvId(null)}>
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>{c.name}</td>
                    <td>
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          onClick={() => {
                            setEditingConvId(c.id)
                            setEditConvCode(c.code)
                            setEditConvName(c.name)
                            setEditConvIcon(c.knowledge_icon ?? '')
                            setEditConvAdopted(c.knowledge_adopted ?? '')
                            setEditConvRatified(c.knowledge_ratified ?? '')
                            setEditConvArticles(c.knowledge_articles ?? '')
                            setEditConvImpl(c.knowledge_implementation ?? '')
                            setEditConvDesc(c.description ?? '')
                            setEditConvSort(String(c.sort_order ?? 0))
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="link" onClick={() => setSelConv(c.id)}>
                          Components
                        </Button>
                        <Button
                          variant="link"
                          dangerLink
                          onClick={() => {
                            void (async () => {
                              try {
                                await adminDeleteConvention(c.id)
                                if (selConv === c.id) setSelConv('')
                                setConventions(await adminFetchConventions())
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
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {selConv !== '' && (
            <>
              <h3 style={{ marginTop: 24 }}>Components (convention #{selConv})</h3>
              <p className="text-muted" style={{ fontSize: 14 }}>
                Articles and other treaty parts: optional <strong>Body</strong> text appears on the public convention
                detail page under each component.
              </p>
              <ConvCompForm
                conventionId={Number(selConv)}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                onDone={async () => setConvComponents(await adminFetchConventionComponents(Number(selConv)))}
              />
              <table className="data-table" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Code</th>
                    <th>Title</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {convComponents.map((x) =>
                    editingCompId === x.id ? (
                      <tr key={x.id}>
                        <td colSpan={3}>
                          <FormGrid>
                            <FormRow twoCol>
                              <FormControl label="Type">
                                <input value={editCompType} onChange={(e) => setEditCompType(e.target.value)} />
                              </FormControl>
                              <FormControl label="Code">
                                <input value={editCompCode} onChange={(e) => setEditCompCode(e.target.value)} />
                              </FormControl>
                            </FormRow>
                            <FormField label="Title">
                              <input value={editCompTitle} onChange={(e) => setEditCompTitle(e.target.value)} />
                            </FormField>
                            <FormField label="Body (public page)">
                              <textarea
                                rows={3}
                                placeholder="Body (public page)"
                                value={editCompBody}
                                onChange={(e) => setEditCompBody(e.target.value)}
                              />
                            </FormField>
                          </FormGrid>
                        </td>
                        <td>
                          <Button
                            variant="primary"
                            compact
                            onClick={() => {
                              void (async () => {
                                try {
                                  await adminUpdateConventionComponent(x.id, {
                                    type: editCompType.trim(),
                                    code: editCompCode.trim(),
                                    title: editCompTitle.trim(),
                                    body: editCompBody.trim() || null,
                                  })
                                  setEditingCompId(null)
                                  setConvComponents(await adminFetchConventionComponents(Number(selConv)))
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Update failed')
                                }
                              })()
                            }}
                          >
                            Save
                          </Button>{' '}
                          <Button variant="link" compact onClick={() => setEditingCompId(null)}>
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={x.id}>
                        <td>{x.type}</td>
                        <td>{x.code}</td>
                        <td>{x.title}</td>
                        <td>
                          <ActionMenu>
                            <Button
                              variant="link"
                              compact
                              onClick={() => {
                                setEditingCompId(x.id)
                                setEditCompType(x.type)
                                setEditCompCode(x.code)
                                setEditCompTitle(x.title)
                                setEditCompBody(x.body ?? '')
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              dangerLink
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await adminDeleteConventionComponent(x.id)
                                    setConvComponents(await adminFetchConventionComponents(Number(selConv)))
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
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </>
          )}
        </TableCard>
      )}

      {tab === 'sdg' && (
        <TableCard padded>
          <h3 style={{ marginTop: 0 }}>SDG reference nodes</h3>
          <p className="text-muted" style={{ fontSize: 14 }}>
            For <strong>goal</strong> nodes, use <strong>Edit</strong> to set icon, short summary, longer body text, and
            stat labels for the SDGs knowledge page.
          </p>
          <SdgForm
            nodes={sdgNodes}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => setSdgNodes(await adminFetchSdgNodes())}
          />
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Goal</th>
                <th>Code</th>
                <th>Title</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sdgNodes.map((n) =>
                editingSdgId === n.id ? (
                  <tr key={n.id}>
                    <td colSpan={4}>
                      <FormGrid>
                        <FormRow twoCol>
                          <FormControl label="Node type">
                            <select value={editSdgType} onChange={(e) => setEditSdgType(e.target.value)}>
                              <option value="goal">goal</option>
                              <option value="target">target</option>
                              <option value="indicator">indicator</option>
                            </select>
                          </FormControl>
                          <FormControl label="Goal number">
                            <input value={editSdgGoalNum} onChange={(e) => setEditSdgGoalNum(e.target.value)} placeholder="goal #" />
                          </FormControl>
                        </FormRow>
                        <FormRow twoCol>
                          <FormControl label="Code">
                            <input value={editSdgCode} onChange={(e) => setEditSdgCode(e.target.value)} placeholder="code" />
                          </FormControl>
                          <FormControl label="Title">
                            <input value={editSdgTitle} onChange={(e) => setEditSdgTitle(e.target.value)} placeholder="title" />
                          </FormControl>
                        </FormRow>
                        <FormRow twoCol>
                          <FormControl label="Icon (emoji)">
                            <input
                              value={editSdgIcon}
                              onChange={(e) => setEditSdgIcon(e.target.value)}
                              placeholder="Icon emoji"
                            />
                          </FormControl>
                          <div />
                        </FormRow>
                        <FormField label="Summary (card)">
                          <textarea
                            rows={2}
                            placeholder="Summary (card)"
                            value={editSdgSummary}
                            onChange={(e) => setEditSdgSummary(e.target.value)}
                          />
                        </FormField>
                        <FormField label="Body (detail / extra context)">
                          <textarea
                            rows={3}
                            placeholder="Body (detail / extra context)"
                            value={editSdgBody}
                            onChange={(e) => setEditSdgBody(e.target.value)}
                          />
                        </FormField>
                        <FormRow twoCol>
                          <FormControl label="Stat 1 value">
                            <input value={editSdgS1v} onChange={(e) => setEditSdgS1v(e.target.value)} placeholder="stat 1 value" />
                          </FormControl>
                          <FormControl label="Stat 1 label">
                            <input value={editSdgS1l} onChange={(e) => setEditSdgS1l(e.target.value)} placeholder="stat 1 label" />
                          </FormControl>
                        </FormRow>
                        <FormRow twoCol>
                          <FormControl label="Stat 2 value">
                            <input value={editSdgS2v} onChange={(e) => setEditSdgS2v(e.target.value)} placeholder="stat 2 value" />
                          </FormControl>
                          <FormControl label="Stat 2 label">
                            <input value={editSdgS2l} onChange={(e) => setEditSdgS2l(e.target.value)} placeholder="stat 2 label" />
                          </FormControl>
                        </FormRow>
                      </FormGrid>
                    </td>
                    <td>
                      <Button
                        variant="primary"
                        compact
                        onClick={() => {
                          void (async () => {
                            try {
                              await adminUpdateSdgNode(n.id, {
                                node_type: editSdgType as 'goal' | 'target' | 'indicator',
                                code: editSdgCode.trim(),
                                title: editSdgTitle.trim(),
                                goal_number: editSdgGoalNum === '' ? null : Number(editSdgGoalNum),
                                knowledge_icon: editSdgIcon.trim() || null,
                                summary: editSdgSummary.trim() || null,
                                body: editSdgBody.trim() || null,
                                stat_1_value: editSdgS1v.trim() || null,
                                stat_1_label: editSdgS1l.trim() || null,
                                stat_2_value: editSdgS2v.trim() || null,
                                stat_2_label: editSdgS2l.trim() || null,
                              })
                              setEditingSdgId(null)
                              setSdgNodes(await adminFetchSdgNodes())
                            } catch (e: unknown) {
                              setError(isApiError(e) ? e.message : 'Update failed')
                            }
                          })()
                        }}
                      >
                        Save
                      </Button>{' '}
                      <Button variant="link" compact onClick={() => setEditingSdgId(null)}>
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={n.id}>
                    <td>{n.node_type}</td>
                    <td>{n.goal_number ?? '—'}</td>
                    <td>{n.code}</td>
                    <td>{n.title}</td>
                    <td>
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          onClick={() => {
                            setEditingSdgId(n.id)
                            setEditSdgType(n.node_type)
                            setEditSdgCode(n.code)
                            setEditSdgTitle(n.title)
                            setEditSdgGoalNum(n.goal_number != null ? String(n.goal_number) : '')
                            setEditSdgIcon(n.knowledge_icon ?? '')
                            setEditSdgSummary(n.summary ?? '')
                            setEditSdgBody(n.body ?? '')
                            setEditSdgS1v(n.stat_1_value ?? '')
                            setEditSdgS1l(n.stat_1_label ?? '')
                            setEditSdgS2v(n.stat_2_value ?? '')
                            setEditSdgS2l(n.stat_2_label ?? '')
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          dangerLink
                          onClick={() => {
                            void (async () => {
                              try {
                                await adminDeleteSdgNode(n.id)
                                setSdgNodes(await adminFetchSdgNodes())
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
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </TableCard>
      )}

      {tab === 'upr' && (
        <TableCard padded>
          <h3 style={{ marginTop: 0 }}>UPR recommendations</h3>
          <p className="text-muted" style={{ fontSize: 14 }}>
            Use <strong>Edit</strong> to add narrative <strong>Body</strong> text shown with each recommendation where
            the app links to UPR content.
          </p>
          <UprForm
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => setUprRows(await adminFetchUpr())}
          />
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Session</th>
                <th>Code</th>
                <th>Title</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {uprRows.map((u) =>
                editingUprId === u.id ? (
                  <tr key={u.id}>
                    <td colSpan={3}>
                      <FormGrid>
                        <FormRow twoCol>
                          <FormControl label="Session">
                            <input value={editUprSession} onChange={(e) => setEditUprSession(e.target.value)} />
                          </FormControl>
                          <FormControl label="Code">
                            <input value={editUprCode} onChange={(e) => setEditUprCode(e.target.value)} />
                          </FormControl>
                        </FormRow>
                        <FormField label="Title">
                          <input value={editUprTitle} onChange={(e) => setEditUprTitle(e.target.value)} />
                        </FormField>
                        <FormField label="Body / extended information">
                          <textarea
                            rows={4}
                            placeholder="Body / extended information"
                            value={editUprBody}
                            onChange={(e) => setEditUprBody(e.target.value)}
                          />
                        </FormField>
                      </FormGrid>
                    </td>
                    <td>
                      <Button
                        variant="primary"
                        compact
                        onClick={() => {
                          void (async () => {
                            try {
                              await adminUpdateUpr(u.id, {
                                session_label: editUprSession.trim(),
                                code: editUprCode.trim(),
                                title: editUprTitle.trim(),
                                body: editUprBody.trim() || null,
                              })
                              setEditingUprId(null)
                              setUprRows(await adminFetchUpr())
                            } catch (e: unknown) {
                              setError(isApiError(e) ? e.message : 'Update failed')
                            }
                          })()
                        }}
                      >
                        Save
                      </Button>{' '}
                      <Button variant="link" compact onClick={() => setEditingUprId(null)}>
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id}>
                    <td>{u.session_label}</td>
                    <td>{u.code}</td>
                    <td>{u.title}</td>
                    <td>
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          onClick={() => {
                            setEditingUprId(u.id)
                            setEditUprSession(u.session_label)
                            setEditUprCode(u.code)
                            setEditUprTitle(u.title)
                            setEditUprBody(u.body ?? '')
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          dangerLink
                          onClick={() => {
                            void (async () => {
                              try {
                                await adminDeleteUpr(u.id)
                                setUprRows(await adminFetchUpr())
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
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </TableCard>
      )}

      {tab === 'hub' && (
        <TableCard padded>
          <h3 style={{ marginTop: 0 }}>Knowledge hub — Indicators &amp; UPR tiles</h3>
          <p className="text-muted" style={{ fontSize: 14 }}>
            These cards populate the <strong>Human rights indicators</strong> and <strong>UPR</strong> knowledge pages
            (summary tiles). Convention and SDG pages use the Conventions and SDG tabs above.
          </p>
          <div className="chip-list" style={{ marginBottom: 16 }}>
            {(['indicators', 'upr'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={hubSection === s ? 'nav-item active' : 'nav-item'}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--surface)' }}
                onClick={() => setHubSection(s)}
              >
                {s === 'indicators' ? 'Indicators page' : 'UPR page'}
              </button>
            ))}
          </div>
          <KnowledgeCardSection
            section={hubSection}
            cards={hubSection === 'indicators' ? knowledgeIndicatorCards : knowledgeUprCards}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            editingCardId={editingCardId}
            setEditingCardId={setEditingCardId}
            editCardIcon={editCardIcon}
            setEditCardIcon={setEditCardIcon}
            editCardTitle={editCardTitle}
            setEditCardTitle={setEditCardTitle}
            editCardSummary={editCardSummary}
            setEditCardSummary={setEditCardSummary}
            editCardS1v={editCardS1v}
            setEditCardS1v={setEditCardS1v}
            editCardS1l={editCardS1l}
            setEditCardS1l={setEditCardS1l}
            editCardS2v={editCardS2v}
            setEditCardS2v={setEditCardS2v}
            editCardS2l={editCardS2l}
            setEditCardS2l={setEditCardS2l}
            editCardBody={editCardBody}
            setEditCardBody={setEditCardBody}
            onRefresh={async () => {
              setKnowledgeIndicatorCards(await adminFetchKnowledgeCards('indicators'))
              setKnowledgeUprCards(await adminFetchKnowledgeCards('upr'))
            }}
          />
        </TableCard>
      )}

      {tab === 'issues' && (
        <TableCard padded>
          <div className="issues-page-header-row">
            <h3>Issues &amp; mapping</h3>
            <IssuesLookupBar
              categories={issueFormCategories}
              articles={issueFormArticles}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onRefreshLookups={async () => {
                setIssueFormCategories(await adminFetchIssueCategories())
                setIssueFormArticles(await adminFetchArticles())
              }}
            />
          </div>
          <IssuesCreateForm
            conventions={issueFormConventions}
            categories={issueFormCategories}
            articles={issueFormArticles}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => {
              setIssues(await adminFetchIssues())
            }}
          />
          {editingIssue && (
            <IssuesEditPanel
              key={editingIssue.id}
              issue={editingIssue}
              conventions={issueFormConventions}
              categories={issueFormCategories}
              articles={issueFormArticles}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onClose={() => setEditingIssue(null)}
              onSaved={async () => {
                setEditingIssue(null)
                setIssues(await adminFetchIssues())
              }}
            />
          )}
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Articles</th>
                <th>Convention</th>
                <th>Category</th>
                <th>Title</th>
                <th>Indicators</th>
                <th>Indicator data types</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontSize: 13 }}>{i.articles.map((a) => a.article_name).join(', ') || '—'}</td>
                  <td>{i.convention?.code ?? i.convention_id}</td>
                  <td>{i.category?.name ?? i.category_id}</td>
                  <td>{i.issue_title}</td>
                  <td style={{ fontSize: 13 }}>{i.indicators.length}</td>
                  <td style={{ fontSize: 12 }} className="text-muted">
                    Quantitative:{i.has_quantitative ? ' ✓' : ' —'} · Qualitative:{i.has_qualitative ? ' ✓' : ' —'}
                  </td>
                  <td>
                    <ActionMenu>
                      <Button
                        variant="link"
                        compact
                        onClick={() => {
                          void (async () => {
                            try {
                              setEditingIssue(await adminFetchIssue(i.id))
                            } catch (e: unknown) {
                              setError(isApiError(e) ? e.message : 'Load failed')
                            }
                          })()
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="link"
                        dangerLink
                        onClick={() => {
                          void (async () => {
                            try {
                              await adminDeleteIssue(i.id)
                              setEditingIssue((cur) => (cur?.id === i.id ? null : cur))
                              setIssues(await adminFetchIssues())
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
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </PageSection>
  )
}

function ActionMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <RowActionsMenu isOpen={open} onOpenChange={setOpen}>
      {children}
    </RowActionsMenu>
  )
}

function GeoRegionsForm({
  busy,
  setBusy,
  setError,
  onDone,
}: {
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
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
      <div>
        <Button
          variant="primary"
          compact
          disabled={busy || !name || !slug}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminCreateRegion({ name, slug })
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
}: {
  regions: { id: number; name: string; slug: string }[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
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
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button
            variant="primary"
            compact
            disabled={busy || !regionId || !name}
            onClick={() => {
              void (async () => {
                setBusy(true)
                setError(null)
                try {
                  await adminCreateDistrict({
                    region_id: Number(regionId),
                    name,
                    slug: slug || null,
                  })
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
            Add district
          </Button>
        </div>
      </FormRow>
    </FormGrid>
  )
}

function RegionCheckboxMulti({
  regions,
  selectedIds,
  onChange,
  disabled,
}: {
  regions: { id: number; name: string; slug: string }[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}) {
  const toggle = (id: number) => {
    const set = new Set(selectedIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onChange([...set].sort((a, b) => a - b))
  }
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 16px',
        maxHeight: 220,
        overflowY: 'auto',
        marginTop: 8,
        padding: 8,
        border: '1px solid var(--table-header-border)',
        borderRadius: 8,
      }}
    >
      {regions.map((r) => (
        <label
          key={r.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(r.id)}
            disabled={disabled}
            onChange={() => toggle(r.id)}
          />
          {r.name}
        </label>
      ))}
    </div>
  )
}

function DeptForm({
  regions,
  busy,
  setBusy,
  setError,
  onDone,
}: {
  regions: { id: number; name: string; slug: string }[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const [regionIds, setRegionIds] = useState<number[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('')

  return (
    <div>
      <FormGrid>
        <FormRow twoCol>
          <FormControl label="Code">
            <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          </FormControl>
          <FormControl label="Name">
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormControl>
        </FormRow>
        <FormRow twoCol>
          <FormControl label="Type">
            <input placeholder="Type" value={type} onChange={(e) => setType(e.target.value)} />
          </FormControl>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button
              variant="primary"
              compact
              disabled={busy || regionIds.length === 0 || !name}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    await adminCreateDepartment({
                      region_ids: regionIds,
                      code: code || null,
                      name,
                      type: type || null,
                    })
                    setCode('')
                    setName('')
                    setType('')
                    setRegionIds([])
                    await onDone()
                  } catch (e: unknown) {
                    setError(isApiError(e) ? e.message : 'Save failed')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              Add department
            </Button>
          </div>
        </FormRow>
      </FormGrid>
      <div style={{ marginTop: 12 }}>
        <strong style={{ fontSize: 13 }}>Regions (one or more)</strong>
        <RegionCheckboxMulti regions={regions} selectedIds={regionIds} onChange={setRegionIds} disabled={busy} />
      </div>
    </div>
  )
}

function ConvForm({
  busy,
  setBusy,
  setError,
  onDone,
}: {
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  return (
    <FormGrid>
      <FormRow twoCol>
        <FormControl label="Code">
          <input placeholder="Code (e.g. CEDAW)" value={code} onChange={(e) => setCode(e.target.value)} />
        </FormControl>
        <FormControl label="Name">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormControl>
      </FormRow>
      <div>
        <Button
          variant="primary"
          compact
          disabled={busy || !code || !name}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminCreateConvention({ code, name })
                setCode('')
                setName('')
                await onDone()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Save failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          Add convention
        </Button>
      </div>
    </FormGrid>
  )
}

function ConvCompForm({
  conventionId,
  busy,
  setBusy,
  setError,
  onDone,
}: {
  conventionId: number
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const [type, setType] = useState('article')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return (
    <FormGrid>
      <FormRow twoCol>
        <FormControl label="Type">
          <input placeholder="Type" value={type} onChange={(e) => setType(e.target.value)} />
        </FormControl>
        <FormControl label="Code">
          <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        </FormControl>
      </FormRow>
      <FormField label="Title">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </FormField>
      <FormField label="Body (optional, public page)">
        <textarea rows={2} placeholder="Body (optional, public page)" value={body} onChange={(e) => setBody(e.target.value)} />
      </FormField>
      <div>
        <Button
          variant="primary"
          compact
          disabled={busy || !code || !title}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminCreateConventionComponent(conventionId, {
                  type,
                  code,
                  title,
                  body: body.trim() || null,
                })
                setCode('')
                setTitle('')
                setBody('')
                await onDone()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Save failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          Add component
        </Button>
      </div>
    </FormGrid>
  )
}

function SdgForm({
  nodes,
  busy,
  setBusy,
  setError,
  onDone,
}: {
  nodes: { id: number; title: string; node_type: string }[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const [nodeType, setNodeType] = useState<'goal' | 'target' | 'indicator'>('goal')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [goalNum, setGoalNum] = useState('')
  const [parentId, setParentId] = useState('')
  return (
    <FormGrid>
      <FormRow twoCol>
        <FormControl label="Node type">
          <select value={nodeType} onChange={(e) => setNodeType(e.target.value as typeof nodeType)}>
            <option value="goal">goal</option>
            <option value="target">target</option>
            <option value="indicator">indicator</option>
          </select>
        </FormControl>
        <FormControl label="Parent">
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">No parent</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id}: {n.node_type} — {n.title.slice(0, 40)}
              </option>
            ))}
          </select>
        </FormControl>
      </FormRow>
      <FormRow twoCol>
        <FormControl label="Code">
          <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        </FormControl>
        <FormControl label="Title">
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormControl>
      </FormRow>
      <FormRow twoCol>
        <FormControl label="Goal # (optional)">
          <input placeholder="Goal # (optional)" value={goalNum} onChange={(e) => setGoalNum(e.target.value)} />
        </FormControl>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button
            variant="primary"
            compact
            disabled={busy || !code || !title}
            onClick={() => {
              void (async () => {
                setBusy(true)
                setError(null)
                try {
                  await adminCreateSdgNode({
                    node_type: nodeType,
                    code,
                    title,
                    goal_number: goalNum ? Number(goalNum) : null,
                    parent_id: parentId ? Number(parentId) : null,
                  })
                  setCode('')
                  setTitle('')
                  setGoalNum('')
                  setParentId('')
                  await onDone()
                } catch (e: unknown) {
                  setError(isApiError(e) ? e.message : 'Save failed')
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            Add SDG node
          </Button>
        </div>
      </FormRow>
    </FormGrid>
  )
}

function UprForm({
  busy,
  setBusy,
  setError,
  onDone,
}: {
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const [session, setSession] = useState('')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return (
    <FormGrid>
      <FormRow twoCol>
        <FormControl label="Session label">
          <input placeholder="Session label" value={session} onChange={(e) => setSession(e.target.value)} />
        </FormControl>
        <FormControl label="Code">
          <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        </FormControl>
      </FormRow>
      <FormField label="Title">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </FormField>
      <FormField label="Body (optional)">
        <textarea rows={2} placeholder="Body (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
      </FormField>
      <div>
        <Button
          variant="primary"
          compact
          disabled={busy || !session || !code || !title}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminCreateUpr({ session_label: session, code, title, body: body.trim() || null })
                setSession('')
                setCode('')
                setTitle('')
                setBody('')
                await onDone()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Save failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          Add UPR row
        </Button>
      </div>
    </FormGrid>
  )
}

function KnowledgeCardSection({
  section,
  cards,
  busy,
  setBusy,
  setError,
  editingCardId,
  setEditingCardId,
  editCardIcon,
  setEditCardIcon,
  editCardTitle,
  setEditCardTitle,
  editCardSummary,
  setEditCardSummary,
  editCardS1v,
  setEditCardS1v,
  editCardS1l,
  setEditCardS1l,
  editCardS2v,
  setEditCardS2v,
  editCardS2l,
  setEditCardS2l,
  editCardBody,
  setEditCardBody,
  onRefresh,
}: {
  section: 'indicators' | 'upr'
  cards: AdminKnowledgeCard[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  editingCardId: number | null
  setEditingCardId: (id: number | null) => void
  editCardIcon: string
  setEditCardIcon: (s: string) => void
  editCardTitle: string
  setEditCardTitle: (s: string) => void
  editCardSummary: string
  setEditCardSummary: (s: string) => void
  editCardS1v: string
  setEditCardS1v: (s: string) => void
  editCardS1l: string
  setEditCardS1l: (s: string) => void
  editCardS2v: string
  setEditCardS2v: (s: string) => void
  editCardS2l: string
  setEditCardS2l: (s: string) => void
  editCardBody: string
  setEditCardBody: (s: string) => void
  onRefresh: () => Promise<void>
}) {
  return (
    <>
      <KnowledgeCardAddForm
        section={section}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        onDone={onRefresh}
      />
      <table className="data-table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Icon</th>
            <th>Title</th>
            <th>Summary</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cards.map((k) =>
            editingCardId === k.id ? (
              <tr key={k.id}>
                <td colSpan={3}>
                  <FormGrid>
                    <FormRow twoCol>
                      <FormControl label="Icon">
                        <input value={editCardIcon} onChange={(e) => setEditCardIcon(e.target.value)} placeholder="emoji" />
                      </FormControl>
                      <FormControl label="Title">
                        <input value={editCardTitle} onChange={(e) => setEditCardTitle(e.target.value)} />
                      </FormControl>
                    </FormRow>
                    <FormField label="Summary">
                      <textarea rows={2} value={editCardSummary} onChange={(e) => setEditCardSummary(e.target.value)} />
                    </FormField>
                    <FormRow twoCol>
                      <FormControl label="Stat 1 value">
                        <input value={editCardS1v} onChange={(e) => setEditCardS1v(e.target.value)} placeholder="stat 1 val" />
                      </FormControl>
                      <FormControl label="Stat 1 label">
                        <input value={editCardS1l} onChange={(e) => setEditCardS1l(e.target.value)} placeholder="stat 1 label" />
                      </FormControl>
                    </FormRow>
                    <FormRow twoCol>
                      <FormControl label="Stat 2 value">
                        <input value={editCardS2v} onChange={(e) => setEditCardS2v(e.target.value)} placeholder="stat 2 val" />
                      </FormControl>
                      <FormControl label="Stat 2 label">
                        <input value={editCardS2l} onChange={(e) => setEditCardS2l(e.target.value)} placeholder="stat 2 label" />
                      </FormControl>
                    </FormRow>
                    <FormField label="Body (extra content)">
                      <textarea rows={3} placeholder="Body (extra content)" value={editCardBody} onChange={(e) => setEditCardBody(e.target.value)} />
                    </FormField>
                  </FormGrid>
                </td>
                <td>
                  <Button
                    variant="primary"
                    compact
                    onClick={() => {
                      void (async () => {
                        try {
                          await adminUpdateKnowledgeCard(k.id, {
                            icon: editCardIcon.trim() || '📌',
                            title: editCardTitle.trim(),
                            summary: editCardSummary.trim() || null,
                            stat_1_value: editCardS1v.trim() || null,
                            stat_1_label: editCardS1l.trim() || null,
                            stat_2_value: editCardS2v.trim() || null,
                            stat_2_label: editCardS2l.trim() || null,
                            body: editCardBody.trim() || null,
                          })
                          setEditingCardId(null)
                          await onRefresh()
                        } catch (e: unknown) {
                          setError(isApiError(e) ? e.message : 'Update failed')
                        }
                      })()
                    }}
                  >
                    Save
                  </Button>{' '}
                  <Button variant="link" compact onClick={() => setEditingCardId(null)}>
                    Cancel
                  </Button>
                </td>
              </tr>
            ) : (
              <tr key={k.id}>
                <td>{k.icon}</td>
                <td>{k.title}</td>
                <td style={{ maxWidth: 280, fontSize: 13 }}>{k.summary ?? '—'}</td>
                <td>
                  <ActionMenu>
                    <Button
                      variant="link"
                      compact
                      onClick={() => {
                        setEditingCardId(k.id)
                        setEditCardIcon(k.icon)
                        setEditCardTitle(k.title)
                        setEditCardSummary(k.summary ?? '')
                        setEditCardS1v(k.stat_1_value ?? '')
                        setEditCardS1l(k.stat_1_label ?? '')
                        setEditCardS2v(k.stat_2_value ?? '')
                        setEditCardS2l(k.stat_2_label ?? '')
                        setEditCardBody(k.body ?? '')
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="link"
                      dangerLink
                      onClick={() => {
                        void (async () => {
                          try {
                            await adminDeleteKnowledgeCard(k.id)
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
              </tr>
            ),
          )}
        </tbody>
      </table>
    </>
  )
}

function KnowledgeCardAddForm({
  section,
  busy,
  setBusy,
  setError,
  onDone,
}: {
  section: 'indicators' | 'upr'
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const [icon, setIcon] = useState('📌')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [s1v, setS1v] = useState('')
  const [s1l, setS1l] = useState('')
  const [s2v, setS2v] = useState('')
  const [s2l, setS2l] = useState('')
  const [body, setBody] = useState('')
  return (
    <FormGrid>
      <FormRow twoCol>
        <FormControl label="Icon">
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="icon" />
        </FormControl>
        <FormControl label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title" />
        </FormControl>
      </FormRow>
      <FormField label="Summary">
        <textarea rows={2} placeholder="summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
      </FormField>
      <FormRow twoCol>
        <FormControl label="Stat 1 value">
          <input value={s1v} onChange={(e) => setS1v(e.target.value)} placeholder="stat 1 value" />
        </FormControl>
        <FormControl label="Stat 1 label">
          <input value={s1l} onChange={(e) => setS1l(e.target.value)} placeholder="stat 1 label" />
        </FormControl>
      </FormRow>
      <FormRow twoCol>
        <FormControl label="Stat 2 value">
          <input value={s2v} onChange={(e) => setS2v(e.target.value)} placeholder="stat 2 value" />
        </FormControl>
        <FormControl label="Stat 2 label">
          <input value={s2l} onChange={(e) => setS2l(e.target.value)} placeholder="stat 2 label" />
        </FormControl>
      </FormRow>
      <FormField label="Body (optional)">
        <textarea rows={2} placeholder="body (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
      </FormField>
      <div>
        <Button
          variant="primary"
          compact
          disabled={busy || !title.trim()}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                await adminCreateKnowledgeCard({
                  section,
                  icon: icon.trim() || '📌',
                  title: title.trim(),
                  summary: summary.trim() || null,
                  stat_1_value: s1v.trim() || null,
                  stat_1_label: s1l.trim() || null,
                  stat_2_value: s2v.trim() || null,
                  stat_2_label: s2l.trim() || null,
                  body: body.trim() || null,
                })
                setTitle('')
                setSummary('')
                setS1v('')
                setS1l('')
                setS2v('')
                setS2l('')
                setBody('')
                await onDone()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Save failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          Add card
        </Button>
      </div>
    </FormGrid>
  )
}

type IndicatorDraft = {
  indicator_text: string
  collects_quantitative: boolean
  collects_qualitative: boolean
}

function emptyIndicator(): IndicatorDraft {
  return {
    indicator_text: '',
    collects_quantitative: false,
    collects_qualitative: true,
  }
}

function validateIndicatorDataTypes(rows: IndicatorDraft[]): string | null {
  const filled = rows.filter((x) => x.indicator_text.trim())
  for (const x of filled) {
    if (!x.collects_quantitative && !x.collects_qualitative) {
      return 'Each indicator must have Quantitative and/or Qualitative selected.'
    }
  }
  return null
}

function ArticleMultiSelectDropdown({
  articles,
  selectedIds,
  onChange,
  disabled,
}: {
  articles: AdminArticleRow[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(
    () =>
      [...articles].sort((a, b) =>
        a.article_name.localeCompare(b.article_name, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    [articles],
  )

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((a) => a.article_name.toLowerCase().includes(q))
  }, [sorted, filter])

  useEffect(() => {
    if (!open) {
      setFilter('')
      return
    }
    function onDoc(e: MouseEvent) {
      if (!(e.target instanceof Node)) return
      if (wrapRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const toggle = (id: number) => {
    const set = new Set(selectedIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onChange([...set].sort((a, b) => a - b))
  }

  const summary =
    selectedIds.length === 0
      ? 'Select articles…'
      : selectedIds.length === 1
        ? sorted.find((a) => a.id === selectedIds[0])?.article_name ?? '1 selected'
        : `${selectedIds.length} articles selected`

  return (
    <div className="article-multi-dropdown" ref={wrapRef}>
      <button
        type="button"
        className="article-multi-dropdown__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="article-multi-dropdown__trigger-text">{summary}</span>
        <span className="article-multi-dropdown__chevron" aria-hidden />
      </button>
      {open && (
        <div className="article-multi-dropdown__panel" role="listbox" aria-multiselectable>
          <input
            type="search"
            className="article-multi-dropdown__filter"
            placeholder="Filter articles…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="article-multi-dropdown__list">
            {filtered.length === 0 ? (
              <div className="article-multi-dropdown__empty">No articles match.</div>
            ) : (
              filtered.map((a) => (
                <label key={a.id} className="article-multi-dropdown__item">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(a.id)}
                    onChange={() => toggle(a.id)}
                    disabled={disabled}
                  />
                  <span>{a.article_name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function IssuesLookupBar({
  categories,
  articles,
  busy,
  setBusy,
  setError,
  onRefreshLookups,
}: {
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefreshLookups: () => Promise<void>
}) {
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newArticle, setNewArticle] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null)
  const [editArticleName, setEditArticleName] = useState('')

  useEffect(() => {
    if (!showCategoryModal) {
      setEditingCategoryId(null)
      setEditCategoryName('')
    }
  }, [showCategoryModal])

  useEffect(() => {
    if (!showArticleModal) {
      setEditingArticleId(null)
      setEditArticleName('')
    }
  }, [showArticleModal])

  return (
    <>
      <div
        style={{
          marginBottom: 0,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        <Button variant="primary" compact onClick={() => setShowCategoryModal(true)}>
          Category list
        </Button>
        <Button variant="primary" compact onClick={() => setShowArticleModal(true)}>
          Article list
        </Button>
      </div>

      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 16, maxWidth: 560, width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Category list</h4>
              <Button variant="link" compact onClick={() => setShowCategoryModal(false)}>
                Close
              </Button>
            </div>
            <FormRow twoCol>
              <FormControl label="New category">
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Thematic" />
              </FormControl>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button
                  variant="primary"
                  compact
                  disabled={busy || !newCategory.trim()}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        await adminCreateIssueCategory({ name: newCategory.trim() })
                        setNewCategory('')
                        await onRefreshLookups()
                      } catch (e: unknown) {
                        setError(isApiError(e) ? e.message : 'Save failed')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  Add category
                </Button>
              </div>
            </FormRow>
            <div style={{ marginTop: 12, maxHeight: 280, overflow: 'auto', border: '1px solid var(--field-border)', borderRadius: 8 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th style={{ width: 1 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-muted">
                        No categories yet.
                      </td>
                    </tr>
                  ) : (
                    categories.map((c) => (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td>
                          {editingCategoryId === c.id ? (
                            <input
                              value={editCategoryName}
                              onChange={(e) => setEditCategoryName(e.target.value)}
                              style={{ width: '100%', maxWidth: 280, boxSizing: 'border-box' }}
                            />
                          ) : (
                            c.name
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {editingCategoryId === c.id ? (
                            <>
                              <Button
                                variant="primary"
                                compact
                                disabled={busy || !editCategoryName.trim()}
                                onClick={() => {
                                  void (async () => {
                                    setBusy(true)
                                    setError(null)
                                    try {
                                      await adminUpdateIssueCategory(c.id, { name: editCategoryName.trim() })
                                      setEditingCategoryId(null)
                                      await onRefreshLookups()
                                    } catch (e: unknown) {
                                      setError(isApiError(e) ? e.message : 'Update failed')
                                    } finally {
                                      setBusy(false)
                                    }
                                  })()
                                }}
                              >
                                Save
                              </Button>{' '}
                              <Button variant="link" compact onClick={() => setEditingCategoryId(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="link"
                                compact
                                disabled={busy}
                                onClick={() => {
                                  setEditingCategoryId(c.id)
                                  setEditCategoryName(c.name)
                                }}
                              >
                                Edit
                              </Button>{' '}
                              <Button
                                variant="link"
                                compact
                                dangerLink
                                disabled={busy}
                                onClick={() => {
                                  if (!window.confirm(`Delete category “${c.name}”?`)) return
                                  void (async () => {
                                    setBusy(true)
                                    setError(null)
                                    try {
                                      await adminDeleteIssueCategory(c.id)
                                      await onRefreshLookups()
                                    } catch (e: unknown) {
                                      setError(isApiError(e) ? e.message : 'Delete failed')
                                    } finally {
                                      setBusy(false)
                                    }
                                  })()
                                }}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showArticleModal && (
        <div className="modal-overlay" onClick={() => setShowArticleModal(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 16, maxWidth: 560, width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Article list</h4>
              <Button variant="link" compact onClick={() => setShowArticleModal(false)}>
                Close
              </Button>
            </div>
            <FormRow twoCol>
              <FormControl label="New article name">
                <input value={newArticle} onChange={(e) => setNewArticle(e.target.value)} placeholder='e.g. "Article 16"' />
              </FormControl>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button
                  variant="primary"
                  compact
                  disabled={busy || !newArticle.trim()}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        await adminCreateArticle({ article_name: newArticle.trim() })
                        setNewArticle('')
                        await onRefreshLookups()
                      } catch (e: unknown) {
                        setError(isApiError(e) ? e.message : 'Save failed')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  Add article
                </Button>
              </div>
            </FormRow>
            <div style={{ marginTop: 12, maxHeight: 280, overflow: 'auto', border: '1px solid var(--field-border)', borderRadius: 8 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Article name</th>
                    <th style={{ width: 1 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-muted">
                        No articles yet.
                      </td>
                    </tr>
                  ) : (
                    articles.map((a) => (
                      <tr key={a.id}>
                        <td>{a.id}</td>
                        <td>
                          {editingArticleId === a.id ? (
                            <input
                              value={editArticleName}
                              onChange={(e) => setEditArticleName(e.target.value)}
                              style={{ width: '100%', maxWidth: 280, boxSizing: 'border-box' }}
                            />
                          ) : (
                            a.article_name
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {editingArticleId === a.id ? (
                            <>
                              <Button
                                variant="primary"
                                compact
                                disabled={busy || !editArticleName.trim()}
                                onClick={() => {
                                  void (async () => {
                                    setBusy(true)
                                    setError(null)
                                    try {
                                      await adminUpdateArticle(a.id, { article_name: editArticleName.trim() })
                                      setEditingArticleId(null)
                                      await onRefreshLookups()
                                    } catch (e: unknown) {
                                      setError(isApiError(e) ? e.message : 'Update failed')
                                    } finally {
                                      setBusy(false)
                                    }
                                  })()
                                }}
                              >
                                Save
                              </Button>{' '}
                              <Button variant="link" compact onClick={() => setEditingArticleId(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="link"
                                compact
                                disabled={busy}
                                onClick={() => {
                                  setEditingArticleId(a.id)
                                  setEditArticleName(a.article_name)
                                }}
                              >
                                Edit
                              </Button>{' '}
                              <Button
                                variant="link"
                                compact
                                dangerLink
                                disabled={busy}
                                onClick={() => {
                                  if (!window.confirm(`Delete article “${a.article_name}”?`)) return
                                  void (async () => {
                                    setBusy(true)
                                    setError(null)
                                    try {
                                      await adminDeleteArticle(a.id)
                                      await onRefreshLookups()
                                    } catch (e: unknown) {
                                      setError(isApiError(e) ? e.message : 'Delete failed')
                                    } finally {
                                      setBusy(false)
                                    }
                                  })()
                                }}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function IssueIndicatorsEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: IndicatorDraft[]
  onChange: (rows: IndicatorDraft[]) => void
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.length === 0 && (
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
          No indicators for this issue yet. Add one or leave empty.
        </p>
      )}
      {rows.map((row, idx) => (
        <div key={idx} className="issue-indicator-card">
          <FormRow twoCol>
            <FormControl label="Indicator text">
              <input
                placeholder="Indicator text"
                value={row.indicator_text}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...rows]
                  next[idx] = { ...row, indicator_text: e.target.value }
                  onChange(next)
                }}
              />
            </FormControl>
            <FormControl label="Data type">
              <div className="issue-indicator-type-checks">
                <label className="checkbox-label issue-indicator-type-checks__item">
                  <input
                    type="checkbox"
                    checked={row.collects_quantitative}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...rows]
                      next[idx] = { ...row, collects_quantitative: e.target.checked }
                      onChange(next)
                    }}
                  />
                  Quantitative
                </label>
                <label className="checkbox-label issue-indicator-type-checks__item">
                  <input
                    type="checkbox"
                    checked={row.collects_qualitative}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...rows]
                      next[idx] = { ...row, collects_qualitative: e.target.checked }
                      onChange(next)
                    }}
                  />
                  Qualitative
                </label>
              </div>
            </FormControl>
          </FormRow>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="link" compact dangerLink disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== idx))}>
              Remove indicator
            </Button>
          </div>
        </div>
      ))}
      <Button variant="link" compact disabled={disabled} onClick={() => onChange([...rows, emptyIndicator()])}>
        + Add indicator
      </Button>
    </div>
  )
}

function IssuesCreateForm({
  conventions,
  categories,
  articles,
  busy,
  setBusy,
  setError,
  onDone,
}: {
  conventions: AdminConvention[]
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const sortedArticles = [...articles].sort((a, b) =>
    a.article_name.localeCompare(b.article_name, undefined, { numeric: true, sensitivity: 'base' }),
  )
  const [conventionId, setConventionId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>([])
  const [indicators, setIndicators] = useState<IndicatorDraft[]>([])

  return (
    <div className="issues-create-form">
      <h4 className="issues-create-form__title">Create issue</h4>
      <FormGrid>
        <div className="issues-form-top-grid">
          <FormControl label="Articles">
            <ArticleMultiSelectDropdown
              articles={sortedArticles}
              selectedIds={selectedArticleIds}
              onChange={setSelectedArticleIds}
              disabled={busy}
            />
          </FormControl>
          <FormControl label="Convention">
            <select value={conventionId} onChange={(e) => setConventionId(e.target.value)}>
              <option value="">—</option>
              {conventions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </FormControl>
          <FormControl label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormControl>
        </div>
        <FormRow twoCol>
          <FormField label="Title">
            <input placeholder="Title" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} />
          </FormField>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            <Button variant="secondary" compact disabled={busy} onClick={() => setIndicators((rows) => [...rows, emptyIndicator()])}>
              Add indicators
            </Button>
          </div>
        </FormRow>
        <FormField label="Description">
          <textarea
            className="issues-description-field"
            placeholder="Optional longer description for this issue…"
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            disabled={busy}
            rows={10}
          />
        </FormField>
      </FormGrid>
      <strong style={{ fontSize: 13, display: 'block', marginTop: 16 }}>Indicators (linked to this issue)</strong>
      <IssueIndicatorsEditor rows={indicators} onChange={setIndicators} disabled={busy} />
      <Button
        variant="primary"
        compact
        style={{ marginTop: 12 }}
        disabled={busy || !conventionId || !categoryId || !issueTitle.trim() || selectedArticleIds.length === 0}
        onClick={() => {
          void (async () => {
            setBusy(true)
            setError(null)
            try {
              const typeErr = validateIndicatorDataTypes(indicators)
              if (typeErr) {
                setError(typeErr)
                return
              }
              const filled = indicators.filter((x) => x.indicator_text.trim())
              const indPayload = filled.map((x) => ({
                indicator_text: x.indicator_text.trim(),
                has_quantitative: x.collects_quantitative,
                has_qualitative: x.collects_qualitative,
              }))
              const hasQuantitative = filled.some((x) => x.collects_quantitative)
              const hasQualitative = filled.some((x) => x.collects_qualitative)
              await adminCreateIssue({
                convention_id: Number(conventionId),
                category_id: Number(categoryId),
                issue_title: issueTitle.trim(),
                description: issueDescription.trim() || null,
                has_quantitative: hasQuantitative,
                has_qualitative: hasQualitative,
                articles: selectedArticleIds.map((articleId) => ({ article_id: articleId })),
                indicators: indPayload.length ? indPayload : undefined,
              })
              setConventionId('')
              setCategoryId('')
              setIssueTitle('')
              setIssueDescription('')
              setSelectedArticleIds([])
              setIndicators([])
              await onDone()
            } catch (e: unknown) {
              setError(isApiError(e) ? e.message : 'Save failed')
            } finally {
              setBusy(false)
            }
          })()
        }}
      >
        Create issue
      </Button>
    </div>
  )
}

function IssuesEditPanel({
  issue,
  conventions,
  categories,
  articles,
  busy,
  setBusy,
  setError,
  onClose,
  onSaved,
}: {
  issue: AdminIssue
  conventions: AdminConvention[]
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const sortedArticles = [...articles].sort((a, b) =>
    a.article_name.localeCompare(b.article_name, undefined, { numeric: true, sensitivity: 'base' }),
  )
  const [conventionId, setConventionId] = useState(String(issue.convention_id))
  const [categoryId, setCategoryId] = useState(String(issue.category_id))
  const [issueTitle, setIssueTitle] = useState(issue.issue_title)
  const [issueDescription, setIssueDescription] = useState(issue.description ?? '')
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>(issue.article_ids)
  const [indicators, setIndicators] = useState<IndicatorDraft[]>(
    issue.indicators.map((ind) => {
      const legacyRow = !ind.has_quantitative && !ind.has_qualitative
      return {
        indicator_text: ind.indicator_text,
        collects_quantitative: legacyRow ? issue.has_quantitative : ind.has_quantitative,
        collects_qualitative: legacyRow ? issue.has_qualitative : ind.has_qualitative,
      }
    }),
  )

  return (
    <div className="issue-edit-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>Edit issue #{issue.id}</h4>
        <Button variant="link" compact onClick={onClose}>
          Close
        </Button>
      </div>
      <FormGrid>
        <div className="issues-form-top-grid">
          <FormControl label="Articles">
            <ArticleMultiSelectDropdown
              articles={sortedArticles}
              selectedIds={selectedArticleIds}
              onChange={setSelectedArticleIds}
              disabled={busy}
            />
          </FormControl>
          <FormControl label="Convention">
            <select value={conventionId} onChange={(e) => setConventionId(e.target.value)}>
              {conventions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </FormControl>
          <FormControl label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormControl>
        </div>
        <FormRow twoCol>
          <FormField label="Title">
            <input placeholder="Title" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} />
          </FormField>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            <Button variant="secondary" compact disabled={busy} onClick={() => setIndicators((rows) => [...rows, emptyIndicator()])}>
              Add indicators
            </Button>
          </div>
        </FormRow>
        <FormField label="Description">
          <textarea
            className="issues-description-field"
            placeholder="Optional longer description for this issue…"
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            disabled={busy}
            rows={10}
          />
        </FormField>
      </FormGrid>
      <strong style={{ fontSize: 13, display: 'block', marginTop: 16 }}>Indicators (linked to this issue)</strong>
      <IssueIndicatorsEditor rows={indicators} onChange={setIndicators} disabled={busy} />
      <Button
        variant="primary"
        compact
        style={{ marginTop: 12 }}
        disabled={busy || !conventionId || !categoryId || !issueTitle.trim() || selectedArticleIds.length === 0}
        onClick={() => {
          void (async () => {
            setBusy(true)
            setError(null)
            try {
              const typeErr = validateIndicatorDataTypes(indicators)
              if (typeErr) {
                setError(typeErr)
                return
              }
              const filled = indicators.filter((x) => x.indicator_text.trim())
              const indPayload = filled.map((x) => ({
                indicator_text: x.indicator_text.trim(),
                has_quantitative: x.collects_quantitative,
                has_qualitative: x.collects_qualitative,
              }))
              const hasQuantitative = filled.some((x) => x.collects_quantitative)
              const hasQualitative = filled.some((x) => x.collects_qualitative)
              await adminUpdateIssue(issue.id, {
                convention_id: Number(conventionId),
                category_id: Number(categoryId),
                issue_title: issueTitle.trim(),
                description: issueDescription.trim() || null,
                has_quantitative: hasQuantitative,
                has_qualitative: hasQualitative,
                articles: selectedArticleIds.map((articleId) => ({ article_id: articleId })),
                indicators: indPayload,
              })
              await onSaved()
            } catch (e: unknown) {
              setError(isApiError(e) ? e.message : 'Save failed')
            } finally {
              setBusy(false)
            }
          })()
        }}
      >
        Save changes
      </Button>
    </div>
  )
}
