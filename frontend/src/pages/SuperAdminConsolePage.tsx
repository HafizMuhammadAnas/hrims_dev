import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateConventionComponent,
  adminCreateDepartment,
  adminCreateKnowledgeCard,
  adminCreateSdgNode,
  adminCreateUpr,
  adminDeleteConvention,
  adminDeleteConventionComponent,
  adminDeleteDepartment,
  adminDeleteKnowledgeCard,
  adminDeleteSdgNode,
  adminDeleteUpr,
  adminFetchCatalogDepartments,
  adminFetchConventionComponents,
  adminFetchConventions,
  adminFetchKnowledgeCards,
  adminFetchRegionsPublic,
  adminFetchSdgNodes,
  adminFetchUpr,
  adminUpdateConventionComponent,
  adminUpdateDepartment,
  adminUpdateKnowledgeCard,
  adminUpdateSdgNode,
  adminUpdateUpr,
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
import { pickActivityTimestamp, sortRowsLatestFirst } from '../lib/tableRowSort'
import { LABEL_CONVENTIONS_AND_COMPONENTS, LABEL_HUMAN_RIGHTS_INDICATORS, LABEL_KNOWLEDGE_HUB } from '../lib/uiLabels'
import { uprConcludingObservationsLabel } from '../lib/issueEntryKind'

type Tab =
  | 'departments'
  | 'conventions'
  | 'sdg'
  | 'upr'
  | 'hub'

const ADMIN_SECTION_TO_TAB: Record<string, Tab> = {
  conventions: 'conventions',
  'sdg-nodes': 'sdg',
  'upr-recommendations': 'upr',
  'knowledge-hub': 'hub',
}

const TAB_PAGE_META: Record<Tab, { title: string; subtitle: string }> = {
  departments: {
    title: 'Departments',
    subtitle:
      'Define departments and link each to one or more regions (for filtering and access). Federal and regional admins assign users to these slots.',
  },
  conventions: {
    title: LABEL_CONVENTIONS_AND_COMPONENTS,
    subtitle: 'Treaty catalog and structured components; content can feed the public Conventions knowledge page.',
  },
  sdg: {
    title: 'SDG Nodes',
    subtitle: 'Sustainable Development Goal, target, and indicator nodes for mapping and knowledge hub goals.',
  },
  upr: {
    title: uprConcludingObservationsLabel(),
    subtitle: 'Universal Periodic Review Concluding Observation rows for workflows and LOI mapping.',
  },
  hub: {
    title: `${LABEL_KNOWLEDGE_HUB} Pages`,
    subtitle: `Indicator and UPR highlight tiles shown on the ${LABEL_HUMAN_RIGHTS_INDICATORS} and UPR knowledge pages.`,
  },
}

export function SuperAdminConsolePage() {
  const { user } = useAuth()
  const { section } = useParams<{ section: string }>()
  const navigate = useNavigate()
  const tab = section ? ADMIN_SECTION_TO_TAB[section] : undefined
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [regions, setRegions] = useState<Awaited<ReturnType<typeof adminFetchRegionsPublic>>>([])
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof adminFetchCatalogDepartments>>>([])
  const [conventions, setConventions] = useState<Awaited<ReturnType<typeof adminFetchConventions>>>([])
  const [convComponents, setConvComponents] = useState<Awaited<ReturnType<typeof adminFetchConventionComponents>>>([])
  const [selConv, setSelConv] = useState<number | ''>('')
  const [sdgNodes, setSdgNodes] = useState<Awaited<ReturnType<typeof adminFetchSdgNodes>>>([])
  const [uprRows, setUprRows] = useState<Awaited<ReturnType<typeof adminFetchUpr>>>([])

  const [editingDeptId, setEditingDeptId] = useState<number | null>(null)
  const [editDeptRegionIds, setEditDeptRegionIds] = useState<number[]>([])
  const [editDeptCode, setEditDeptCode] = useState('')
  const [editDeptName, setEditDeptName] = useState('')
  const [editDeptType, setEditDeptType] = useState('')

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
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Load failed')
    }
  }, [tab, selConv])

  const departmentsLatestFirst = useMemo(
    () =>
      sortRowsLatestFirst(departments, (d) =>
        pickActivityTimestamp(d.updated_at, d.created_at, d.id),
      ),
    [departments],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  if (!tab) {
    return <Navigate to="/admin/issues" replace />
  }

  const pageMeta = TAB_PAGE_META[tab]

  return (
    <PageSection title={pageMeta.title} subtitle={pageMeta.subtitle}>
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
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
              {departmentsLatestFirst.map((d) =>
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
                      <strong className="font-semibold text-compact">Regions (one or more)</strong>
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
          <p className="text-muted">
            Create a convention, then use <strong>Edit</strong> to fill Overview, Repositories, and Optional Protocol.
            Those sections appear as tabs on Convention Info. Articles, LOI, and Concluding Observations are managed
            under Issues & mappings for the same convention.
          </p>
          <div style={{ marginBottom: 16 }}>
            <Button variant="primary" compact onClick={() => navigate('/admin/conventions/new')}>
              Create convention
            </Button>
          </div>
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {conventions.map((c) => (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>{c.name}</td>
                    <td>
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          onClick={() => navigate(`/admin/conventions/${c.id}/edit`)}
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
              ))}
            </tbody>
          </table>
          {selConv !== '' && (
            <>
              <h3 style={{ marginTop: 24 }}>Components (convention #{selConv})</h3>
              <p className="text-muted">
                Optional catalog parts for this convention. Overview, Repositories, and Optional Protocol are edited
                on the convention form. Articles, LOI, and Concluding Observations come from Issues & mappings.
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
          <p className="text-muted">
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
          <h3 style={{ marginTop: 0 }}>{uprConcludingObservationsLabel()}</h3>
          <p className="text-muted">
            Use <strong>Edit</strong> to add narrative <strong>Body</strong> text shown with each Concluding Observation where
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
          <h3 style={{ marginTop: 0 }}>{LABEL_KNOWLEDGE_HUB} — Indicators &amp; UPR Tiles</h3>
          <p className="text-muted">
            These cards populate the <strong>{LABEL_HUMAN_RIGHTS_INDICATORS}</strong> and <strong>UPR</strong> knowledge pages
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
        <strong className="font-semibold text-compact">Regions (one or more)</strong>
        <RegionCheckboxMulti regions={regions} selectedIds={regionIds} onChange={setRegionIds} disabled={busy} />
      </div>
    </div>
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
                <td className="text-compact" style={{ maxWidth: 280 }}>
                  {k.summary ?? '—'}
                </td>
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

