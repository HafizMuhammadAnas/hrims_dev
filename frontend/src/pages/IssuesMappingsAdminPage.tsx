import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateArticle,
  adminCreateIssue,
  adminCreateIssueCategory,
  adminDeleteArticle,
  adminDeleteIssue,
  adminDeleteIssueCategory,
  adminFetchArticles,
  adminFetchConventions,
  adminFetchIssue,
  adminFetchIssueCategories,
  adminFetchIssues,
  adminUpdateArticle,
  adminUpdateIssue,
  adminUpdateIssueCategory,
  type AdminArticleRow,
  type AdminConvention,
  type AdminIssue,
  type AdminIssueCategory,
} from '../api/admin'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { FormControl } from '../components/ui/FormControl'
import { FormField } from '../components/ui/FormField'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { workflowBackLabel } from '../lib/workflowNavigation'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import { isSuperAdmin } from '../lib/roles'
import type { AuthUser } from '../types/auth'

const ISSUES_PAGE_SIZE = 10

type IssuesView = 'list' | 'create' | 'categories' | 'articles'

const ISSUES_TABS: { view: IssuesView; to: string; label: string; end?: boolean }[] = [
  { view: 'list', to: '/admin/issues', label: 'Issues & mapping list', end: true },
  { view: 'create', to: '/admin/issues/create', label: 'Create issue' },
  { view: 'categories', to: '/admin/issues/categories', label: 'Category list' },
  { view: 'articles', to: '/admin/issues/articles', label: 'Article list' },
]

function resolveIssuesView(param: string | undefined): IssuesView | null {
  if (!param) return 'list'
  if (param === 'list' || param === 'create' || param === 'categories' || param === 'articles') return param
  return null
}


export function IssuesMappingsAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { issuesView: issuesViewParam, issueId: editIssueIdParam } = useParams<{
    issuesView?: string
    issueId?: string
  }>()
  const isIssueEditRoute = location.pathname.includes('/admin/issues/edit/')
  const editIssueId =
    isIssueEditRoute && editIssueIdParam && !Number.isNaN(Number(editIssueIdParam))
      ? Number(editIssueIdParam)
      : null
  const view = isIssueEditRoute ? null : resolveIssuesView(issuesViewParam)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState<AdminIssue[]>([])
  const [conventions, setConventions] = useState<AdminConvention[]>([])
  const [categories, setCategories] = useState<AdminIssueCategory[]>([])
  const [articles, setArticles] = useState<AdminArticleRow[]>([])
  const refreshLookups = useCallback(async () => {
    const [conv, cat, art] = await Promise.all([
      adminFetchConventions(),
      adminFetchIssueCategories(),
      adminFetchArticles(),
    ])
    setConventions(conv)
    setCategories(cat)
    setArticles(art)
  }, [])

  const refreshIssues = useCallback(async () => {
    setIssues(await adminFetchIssues())
  }, [])

  const refreshAll = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([refreshIssues(), refreshLookups()])
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Load failed')
    }
  }, [refreshIssues, refreshLookups])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  if (!view && !editIssueId) {
    return <Navigate to="/admin/issues" replace />
  }

  if (editIssueId != null) {
    return (
      <IssuesEditPage
        issueId={editIssueId}
        user={user}
        conventions={conventions}
        categories={categories}
        articles={articles}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        error={error}
        onRefreshIssues={refreshIssues}
        onRefreshLookups={refreshLookups}
      />
    )
  }

  return (
    <div className="page-shell">
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label="Issues and mappings sections">
        {ISSUES_TABS.map((tab) => (
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

      {view === 'list' && (
        <IssuesListSection issues={issues} setError={setError} onRefreshIssues={refreshIssues} />
      )}

      {view === 'create' && (
        <TableCard padded>
          <IssuesCreateForm
            conventions={conventions}
            categories={categories}
            articles={articles}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => {
              await refreshIssues()
              navigate('/admin/issues')
            }}
            onCancel={() => navigate('/admin/issues')}
          />
        </TableCard>
      )}

      {view === 'categories' && (
        <IssuesCategoriesSection
          categories={categories}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshLookups}
        />
      )}

      {view === 'articles' && (
        <IssuesArticlesSection
          articles={articles}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshLookups}
        />
      )}
    </div>
  )
}

function IssuesListSection({
  issues,
  setError,
  onRefreshIssues,
}: {
  issues: AdminIssue[]
  setError: (s: string | null) => void
  onRefreshIssues: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: ISSUES_PAGE_SIZE })

  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const byTitle = a.issue_title.localeCompare(b.issue_title, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      if (byTitle !== 0) return byTitle
      return a.id - b.id
    })
  }, [issues])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedIssues
    return sortedIssues.filter((i) => {
      const convCode = (i.convention?.code ?? '').toLowerCase()
      const convName = (i.convention?.name ?? '').toLowerCase()
      const arts = i.articles.map((a) => a.article_name).join(' ').toLowerCase()
      const cat = (i.category?.name ?? String(i.category_id)).toLowerCase()
      return (
        String(i.id).includes(q) ||
        i.issue_title.toLowerCase().includes(q) ||
        convCode.includes(q) ||
        convName.includes(q) ||
        arts.includes(q) ||
        cat.includes(q)
      )
    })
  }, [sortedIssues, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <>

      <TableToolbar className="issues-list-toolbar">
        <input
          type="search"
          placeholder="Search ID, title, convention, category, articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search issues"
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
                <th>Convention</th>
                <th>Articles</th>
                <th>Category</th>
                <th>Title</th>
                <th>Indicators</th>
                <th>Indicator data types</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={7}
                  message={search.trim() ? 'No issues match your search.' : 'No issues yet. Use Create issue to add one.'}
                />
              ) : (
                pageRows.map((i) => (
                  <tr key={i.id}>
                    <td className="text-compact">{issueConventionLabel(i)}</td>
                    <td className="text-compact">
                      {i.articles.map((a) => a.article_name).join(', ') || 'None'}
                    </td>
                    <td>{i.category?.name ?? i.category_id}</td>
                    <td>{i.issue_title}</td>
                    <td className="text-compact">{i.indicators.length}</td>
                    <td className="text-muted text-xs">
                      Quantitative: {i.has_quantitative ? 'Yes' : 'No'} | Qualitative:{' '}
                      {i.has_qualitative ? 'Yes' : 'No'}
                    </td>
                    <td>
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          onClick={() => navigate(`/admin/issues/edit/${i.id}`)}
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
                                await onRefreshIssues()
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


function IssuesCategoriesSection({
  categories,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  categories: AdminIssueCategory[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const [newCategory, setNewCategory] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: ISSUES_PAGE_SIZE })

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    [categories],
  )

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedCategories
    return sortedCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || String(c.id).includes(q),
    )
  }, [sortedCategories, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <>
      <div style={{ marginBottom: 16 }}>
      <TableCard padded>
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
                    await onRefresh()
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
      </TableCard>
      </div>

      <TableToolbar className="issues-list-toolbar">
        <input
          type="search"
          placeholder="Search ID or category name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search categories"
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
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={3}
                  message={search.trim() ? 'No categories match your search.' : 'No categories yet.'}
                />
              ) : (
                pageRows.map((c) => (
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
                    <td className="table-actions">
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
                                  await onRefresh()
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
                        <ActionMenu>
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
                          </Button>
                          <Button
                            variant="link"
                            compact
                            dangerLink
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Delete category "${c.name}"?`)) return
                              void (async () => {
                                setBusy(true)
                                setError(null)
                                try {
                                  await adminDeleteIssueCategory(c.id)
                                  await onRefresh()
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
                        </ActionMenu>
                      )}
                    </td>
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


function IssuesArticlesSection({
  articles,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  articles: AdminArticleRow[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const [newArticle, setNewArticle] = useState('')
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null)
  const [editArticleName, setEditArticleName] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: ISSUES_PAGE_SIZE })

  const sortedArticles = useMemo(
    () =>
      [...articles].sort((a, b) =>
        a.article_name.localeCompare(b.article_name, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    [articles],
  )

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedArticles
    return sortedArticles.filter(
      (a) => a.article_name.toLowerCase().includes(q) || String(a.id).includes(q),
    )
  }, [sortedArticles, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <>
      <div style={{ marginBottom: 16 }}>
      <TableCard padded>
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
                    await onRefresh()
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
      </TableCard>
      </div>

      <TableToolbar className="issues-list-toolbar">
        <input
          type="search"
          placeholder="Search ID or article name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search articles"
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
                <th>Article name</th>
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={3}
                  message={search.trim() ? 'No articles match your search.' : 'No articles yet.'}
                />
              ) : (
                pageRows.map((a) => (
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
                    <td className="table-actions">
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
                                  await onRefresh()
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
                        <ActionMenu>
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
                          </Button>
                          <Button
                            variant="link"
                            compact
                            dangerLink
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Delete article "${a.article_name}"?`)) return
                              void (async () => {
                                setBusy(true)
                                setError(null)
                                try {
                                  await adminDeleteArticle(a.id)
                                  await onRefresh()
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
                        </ActionMenu>
                      )}
                    </td>
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

function issueConventionLabel(issue: AdminIssue): string {
  if (issue.convention?.code) {
    return issue.convention.code
  }
  return String(issue.convention_id)
}
function ActionMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <RowActionsMenu isOpen={open} onOpenChange={setOpen}>
      {children}
    </RowActionsMenu>
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
      ? 'Select articles...'
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
            placeholder="Filter articles..."
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
        <p className="text-muted text-compact" style={{ margin: 0 }}>
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
  onCancel,
}: {
  conventions: AdminConvention[]
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
  onCancel: () => void
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
      <FormGrid>
        <div className="issues-form-top-grid">
          <FormControl label="Convention">
            <select value={conventionId} onChange={(e) => setConventionId(e.target.value)}>
              <option value="">Select convention</option>
              {conventions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </FormControl>
          <FormControl label="Articles">
            <ArticleMultiSelectDropdown
              articles={sortedArticles}
              selectedIds={selectedArticleIds}
              onChange={setSelectedArticleIds}
              disabled={busy}
            />
          </FormControl>
          <FormControl label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormControl>
        </div>
        <FormField label="Title">
          <input placeholder="Title" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} />
        </FormField>
        <FormField label="Description">
          <textarea
            className="issues-description-field"
            placeholder="Optional longer description for this issue..."
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            disabled={busy}
            rows={10}
          />
        </FormField>
      </FormGrid>
      <strong className="font-semibold text-compact" style={{ display: 'block', marginTop: 16 }}>
        Indicators (linked to this issue)
      </strong>
      <IssueIndicatorsEditor rows={indicators} onChange={setIndicators} disabled={busy} />
      <div className="issues-create-form__actions" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" compact disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          compact
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
          Save issue
        </Button>
      </div>
    </div>
  )
}

function IssuesEditPage({
  issueId,
  user,
  conventions,
  categories,
  articles,
  busy,
  setBusy,
  setError,
  error,
  onRefreshIssues,
  onRefreshLookups,
}: {
  issueId: number
  user: AuthUser | null
  conventions: AdminConvention[]
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  error: string | null
  onRefreshIssues: () => Promise<void>
  onRefreshLookups: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [issue, setIssue] = useState<AdminIssue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void adminFetchIssue(issueId)
      .then((row) => {
        if (!cancelled) setIssue(row)
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
  }, [issueId, setError])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  return (
    <PageSection
      title={`Edit issue #${issueId}`}
      leading={
        <WorkflowPageBack to="/admin/issues" label={workflowBackLabel('/admin/issues')} placement="header" />
      }
    >
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loading && <p className="muted">Loading issue…</p>}
      {issue && (
        <TableCard padded>
          <IssuesEditPanel
            issue={issue}
            conventions={conventions}
            categories={categories}
            articles={articles}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onClose={() => navigate('/admin/issues')}
            onSaved={async () => {
              await Promise.all([onRefreshIssues(), onRefreshLookups()])
              navigate('/admin/issues')
            }}
          />
        </TableCard>
      )}
    </PageSection>
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
          <FormControl label="Convention">
            <select value={conventionId} onChange={(e) => setConventionId(e.target.value)}>
              {conventions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </FormControl>
          <FormControl label="Articles">
            <ArticleMultiSelectDropdown
              articles={sortedArticles}
              selectedIds={selectedArticleIds}
              onChange={setSelectedArticleIds}
              disabled={busy}
            />
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
        <FormField label="Title">
          <input placeholder="Title" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} />
        </FormField>
        <FormField label="Description">
          <textarea
            className="issues-description-field"
            placeholder="Optional longer description for this issue..."
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            disabled={busy}
            rows={10}
          />
        </FormField>
      </FormGrid>
      <strong className="font-semibold text-compact" style={{ display: 'block', marginTop: 16 }}>
        Indicators (linked to this issue)
      </strong>
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
